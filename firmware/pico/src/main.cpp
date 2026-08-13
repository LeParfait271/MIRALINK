#include "miralink_config_store.h"
#include "miralink_bluetooth.h"
#include "miralink_audio.h"
#include "miralink_protocol.h"
#include "miralink_usb_identity.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

#include "bsp/board_api.h"
#include "hardware/flash.h"
#include "hardware/gpio.h"
#include "pico/bootrom.h"
#include "pico/btstack_flash_bank.h"
#include "pico/cyw43_arch.h"
#include "pico/stdlib.h"
#include "tusb.h"

namespace {
constexpr std::uint8_t kReportCommand = 0x01;
constexpr std::uint8_t kReportResponse = 0x02;
constexpr std::uint8_t kReportEvent = 0x03;
constexpr std::uint8_t kReportGamepad = 0x10;
constexpr std::uint8_t kReportControllerOutput = 0x11;
constexpr std::uint8_t kFlagResponse = 1u << 0;
constexpr std::uint8_t kFlagError = 1u << 1;
constexpr std::uint8_t kLogSchema = 1;
constexpr std::uint8_t kDiagnosticsSchema = 4;
constexpr std::size_t kLogMessageBytes = 40;
constexpr std::size_t kLogCapacity = 12;
constexpr std::array<std::uint8_t, 4> kRecoveryToken = {'R', 'C', 'V', '1'};
// Keep the two MiraLink configuration sectors before BTstack's two-sector
// link-key bank near the end of RP2350 flash. The final sector remains free
// for the RP2350 erratum reservation used by the SDK on supported revisions.
constexpr std::uint32_t kFlashStorageOffset = PICO_FLASH_SIZE_BYTES - (5u * FLASH_SECTOR_SIZE);
constexpr std::uint32_t kFlashStorageEnd = kFlashStorageOffset
    + static_cast<std::uint32_t>(miralink::kConfigStorageSlots * FLASH_SECTOR_SIZE);
static_assert(kFlashStorageEnd <= PICO_FLASH_BANK_STORAGE_OFFSET,
    "MiraLink configuration flash overlaps BTstack link-key storage");
static_assert(PICO_FLASH_BANK_STORAGE_OFFSET + PICO_FLASH_BANK_TOTAL_SIZE <= PICO_FLASH_SIZE_BYTES,
    "BTstack link-key storage exceeds Pico flash");

class PicoFlashBackend final : public miralink::FlashBackend {
public:
    bool read(std::vector<std::uint8_t>& bytes) const override {
        bytes.clear();
        for (std::size_t slot = 0; slot < miralink::kConfigStorageSlots; ++slot) {
            const auto* address = reinterpret_cast<const std::uint8_t*>(XIP_BASE + kFlashStorageOffset + slot * FLASH_SECTOR_SIZE);
            bytes.insert(bytes.end(), address, address + miralink::kConfigStorageSlotBytes);
        }
        return true;
    }

    bool write_slot(std::size_t slot, const std::vector<std::uint8_t>& record) override {
        if (slot >= miralink::kConfigStorageSlots || record.size() != miralink::kConfigStorageSlotBytes) return false;
        std::array<std::uint8_t, FLASH_PAGE_SIZE> page{};
        std::fill(page.begin(), page.end(), 0xff);
        std::memcpy(page.data(), record.data(), record.size());
        const auto offset = kFlashStorageOffset + static_cast<std::uint32_t>(slot * FLASH_SECTOR_SIZE);
        flash_range_erase(offset, FLASH_SECTOR_SIZE);
        flash_range_program(offset, page.data(), FLASH_PAGE_SIZE);
        return true;
    }
};

PicoFlashBackend g_flash_backend;
miralink::ConfigStore g_config_store(g_flash_backend);
std::array<std::uint8_t, miralink::kHidReportBytes> g_response{};
bool g_response_ready = false;
bool g_config_was_loaded = false;
bool g_event_initialized = false;
std::uint32_t g_last_event_sample_count = 0;
bool g_last_event_input_available = false;
bool g_last_event_descriptor_available = false;
bool g_last_event_bluetooth_available = false;
bool g_last_event_pairing_window_open = false;
bool g_last_event_inquiry_active = false;
bool g_last_event_connection_pending = false;
bool g_usb_reconnect_pending = false;
bool g_recovery_pending = false;
bool g_gamepad_report_pending = false;
bool g_gamepad_was_available = false;
std::uint32_t g_last_gamepad_sample_count = 0;
std::uint64_t g_last_gamepad_report_us = 0;
std::uint64_t g_usb_reconnect_deadline_ms = 0;
std::uint64_t g_recovery_deadline_ms = 0;
std::array<std::uint8_t, 11> g_gamepad_report{};
constexpr std::uint8_t kStatusGpioDisabled = 0xff;
std::uint8_t g_status_gpio_pin = kStatusGpioDisabled;
bool g_status_gpio_active_low = false;

struct LogRecord {
    std::uint32_t timestamp_ms = 0;
    std::uint8_t length = 0;
    std::array<char, kLogMessageBytes> message{};
};

std::array<LogRecord, kLogCapacity> g_log_records{};
std::size_t g_log_next = 0;
std::size_t g_log_count = 0;

std::uint32_t now_ms() {
    return to_ms_since_boot(get_absolute_time());
}

void write_status_gpio(const bool active) {
    if (g_status_gpio_pin == kStatusGpioDisabled) return;
    gpio_put(g_status_gpio_pin, (active ^ g_status_gpio_active_low) ? 1 : 0);
}

void apply_status_gpio_config(const miralink::Config& config) {
    const auto requested_pin = config.status_gpio_pin;
    const auto requested_active_low = config.status_gpio_mode != 0;
    if (g_status_gpio_pin != kStatusGpioDisabled && g_status_gpio_pin != requested_pin) {
        // Return a previously selected status output to a safe high-impedance
        // input before a new one is configured.
        gpio_set_dir(g_status_gpio_pin, GPIO_IN);
    }
    g_status_gpio_pin = requested_pin;
    g_status_gpio_active_low = requested_active_low;
    if (g_status_gpio_pin == kStatusGpioDisabled) return;
    gpio_init(g_status_gpio_pin);
    gpio_set_dir(g_status_gpio_pin, GPIO_OUT);
    write_status_gpio(false);
}

void apply_runtime_config() {
    const auto& config = g_config_store.active();
    miralink::audio::apply_config(config);
    miralink::bluetooth::apply_config(config);
    miralink::usb_identity::set_unique_serial_enabled(config.enable_usb_serial);
    apply_status_gpio_config(config);
}

std::uint64_t gamepad_publish_interval_us() {
    switch (g_config_store.active().polling_mode) {
        case 0: return 4000; // 250 Hz: reliable baseline.
        case 1: return 2000; // 500 Hz: default balance.
        default: return 0;   // Real-time: send each validated input report.
    }
}

void update_status_led() {
    const auto snapshot = miralink::bluetooth::snapshot();
    const bool pairing = snapshot.pairing_window_open || snapshot.inquiry_active || snapshot.connection_pending;
    const bool blink_on = ((now_ms() / 250u) & 1u) == 0;
    const bool status_active = snapshot.state == miralink::bluetooth::LinkState::Connected || pairing;
    const bool visible = !g_config_store.active().disable_led
        && (snapshot.state == miralink::bluetooth::LinkState::Connected || (pairing && blink_on));
    board_led_write(visible ? 1 : 0);
    write_status_gpio(status_active);
}

void append_log(const char* message) {
    if (message == nullptr) return;
    auto& record = g_log_records[g_log_next];
    record.timestamp_ms = now_ms();
    record.length = static_cast<std::uint8_t>(std::min<std::size_t>(std::strlen(message), kLogMessageBytes));
    record.message.fill('\0');
    std::memcpy(record.message.data(), message, record.length);
    g_log_next = (g_log_next + 1) % kLogCapacity;
    g_log_count = std::min<std::size_t>(g_log_count + 1, kLogCapacity);
}

void write_u32(std::vector<std::uint8_t>& bytes, const std::uint32_t value) {
    for (std::size_t index = 0; index < 4; ++index) bytes.push_back(static_cast<std::uint8_t>((value >> (index * 8)) & 0xffu));
}

void write_u16_at(std::vector<std::uint8_t>& bytes, const std::size_t offset, const std::uint16_t value) {
    bytes[offset] = static_cast<std::uint8_t>(value & 0xffu);
    bytes[offset + 1] = static_cast<std::uint8_t>((value >> 8u) & 0xffu);
}

void write_i16_at(std::vector<std::uint8_t>& bytes, const std::size_t offset, const std::int16_t value) {
    write_u16_at(bytes, offset, static_cast<std::uint16_t>(value));
}

std::vector<std::uint8_t> log_page_payload(const std::uint8_t page) {
    std::vector<std::uint8_t> payload = {kLogSchema, page, 0};
    if (page >= g_log_count) {
        write_u32(payload, 0);
        payload.push_back(0);
        return payload;
    }
    const auto newest = (g_log_next + kLogCapacity - 1) % kLogCapacity;
    const auto index = (newest + kLogCapacity - page) % kLogCapacity;
    const auto& record = g_log_records[index];
    payload[2] = 1;
    write_u32(payload, record.timestamp_ms);
    payload.push_back(record.length);
    payload.insert(payload.end(), record.message.begin(), record.message.begin() + record.length);
    return payload;
}

void service_deferred_actions() {
    const auto now = static_cast<std::uint64_t>(now_ms());
    if (g_recovery_pending && now >= g_recovery_deadline_ms) {
        g_recovery_pending = false;
        reset_usb_boot(0, 0);
    }
    if (g_usb_reconnect_pending && now >= g_usb_reconnect_deadline_ms) {
        g_usb_reconnect_pending = false;
        tud_disconnect();
        sleep_ms(50);
        tud_connect();
    }
}

std::vector<std::uint8_t> text_payload(const char* text) {
    const auto length = std::min<std::size_t>(std::strlen(text), miralink::kMaxPayload);
    return std::vector<std::uint8_t>(reinterpret_cast<const std::uint8_t*>(text), reinterpret_cast<const std::uint8_t*>(text) + length);
}

void set_response(std::uint16_t sequence, miralink::Command command, std::uint8_t flags, const std::vector<std::uint8_t>& payload) {
    miralink::Frame frame;
    frame.sequence = sequence;
    frame.command = command;
    frame.flags = static_cast<std::uint8_t>(flags | kFlagResponse);
    frame.payload = payload;
    const auto encoded = miralink::encode_frame(frame);
    if (encoded.size() == g_response.size()) {
        std::copy(encoded.begin(), encoded.end(), g_response.begin());
        g_response_ready = true;
    }
}

void set_error(std::uint16_t sequence, miralink::Command command, const char* message) {
    set_response(sequence, command, kFlagError, text_payload(message));
}

std::vector<std::uint8_t> controller_state_payload(const miralink::bluetooth::Snapshot& snapshot) {
    std::vector<std::uint8_t> payload(48, 0);
    payload[0] = 2;
    if (snapshot.state == miralink::bluetooth::LinkState::Connected) payload[1] |= 1u << 0;
    if (snapshot.descriptor_available) payload[1] |= 1u << 1;
    if (snapshot.input_available) payload[1] |= 1u << 2;
    if (snapshot.bluetooth_available) payload[1] |= 1u << 3;
    if (snapshot.pairing_window_open) payload[1] |= 1u << 4;
    if (snapshot.inquiry_active) payload[1] |= 1u << 5;
    if (snapshot.connection_pending) payload[1] |= 1u << 6;
    if (snapshot.paired_controller_known) payload[1] |= 1u << 7;
    if (snapshot.input_available) {
        payload[2] = snapshot.input.report_id;
        payload[3] = snapshot.input.left_x;
        payload[4] = snapshot.input.left_y;
        payload[5] = snapshot.input.right_x;
        payload[6] = snapshot.input.right_y;
        payload[7] = snapshot.input.left_trigger;
        payload[8] = snapshot.input.right_trigger;
        payload[9] = snapshot.input.dpad_face;
        payload[10] = snapshot.input.shoulder;
        payload[11] = snapshot.input.system;
        payload[16] = snapshot.input.battery_percent;
        payload[17] = static_cast<std::uint8_t>(snapshot.input.battery_state);
        if (snapshot.input.battery_valid) payload[18] |= 1u << 0;
        if (snapshot.input.headphone_connected) payload[18] |= 1u << 1;
        if (snapshot.input.microphone_connected) payload[18] |= 1u << 2;
        if (snapshot.input.microphone_muted) payload[18] |= 1u << 3;
        if (snapshot.input.touch[0].active) payload[18] |= 1u << 4;
        if (snapshot.input.touch[1].active) payload[18] |= 1u << 5;
        payload[19] = snapshot.input.input_sequence;
        write_i16_at(payload, 20, snapshot.input.gyro_x);
        write_i16_at(payload, 22, snapshot.input.gyro_y);
        write_i16_at(payload, 24, snapshot.input.gyro_z);
        write_i16_at(payload, 26, snapshot.input.accel_x);
        write_i16_at(payload, 28, snapshot.input.accel_y);
        write_i16_at(payload, 30, snapshot.input.accel_z);
        payload[32] = static_cast<std::uint8_t>(snapshot.input.sensor_timestamp & 0xffu);
        payload[33] = static_cast<std::uint8_t>((snapshot.input.sensor_timestamp >> 8u) & 0xffu);
        payload[34] = static_cast<std::uint8_t>((snapshot.input.sensor_timestamp >> 16u) & 0xffu);
        payload[35] = static_cast<std::uint8_t>((snapshot.input.sensor_timestamp >> 24u) & 0xffu);
        write_u16_at(payload, 36, snapshot.input.touch[0].x);
        write_u16_at(payload, 38, snapshot.input.touch[0].y);
        write_u16_at(payload, 40, snapshot.input.touch[1].x);
        write_u16_at(payload, 42, snapshot.input.touch[1].y);
    }
    return payload;
}

std::vector<std::uint8_t> controller_capabilities_payload(const miralink::bluetooth::Snapshot& snapshot) {
    constexpr std::uint16_t kBattery = 1u << 0;
    constexpr std::uint16_t kHaptics = 1u << 1;
    constexpr std::uint16_t kLightbar = 1u << 2;
    constexpr std::uint16_t kMotion = 1u << 3;
    constexpr std::uint16_t kTouchpad = 1u << 4;
    constexpr std::uint16_t kAudioStatus = 1u << 5;
    constexpr std::uint16_t kMicrophoneMute = 1u << 6;
    constexpr std::uint16_t kAdaptiveTriggers = 1u << 7;
    std::vector<std::uint8_t> payload(8, 0);
    payload[0] = 1;
    payload[1] = snapshot.input_available ? 1 : 0;
    payload[2] = snapshot.input.report_id == miralink::dualsense::kBluetoothInputReportId ? 1 : 0;
    payload[3] = snapshot.input_available ? 1 : 0;
    std::uint16_t capabilities = 0;
    if (snapshot.input_available && snapshot.input.battery_valid) capabilities |= kBattery;
    if (snapshot.input_available) capabilities |= kHaptics | kLightbar | kMotion | kTouchpad | kMicrophoneMute | kAdaptiveTriggers;
    if (snapshot.audio_link_available) capabilities |= kAudioStatus;
    write_u16_at(payload, 4, capabilities);
    write_u16_at(payload, 6, 3000);
    return payload;
}

std::vector<std::uint8_t> diagnostics_payload() {
    const auto snapshot = miralink::bluetooth::snapshot();
    const auto audio = miralink::audio::snapshot();
    std::vector<std::uint8_t> payload = {
        kDiagnosticsSchema,
        static_cast<std::uint8_t>(g_config_was_loaded ? 1 : 0),
        static_cast<std::uint8_t>(tud_mounted() ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.bluetooth_available ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.pairing_window_open ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.inquiry_active ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.connection_pending ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.state == miralink::bluetooth::LinkState::Connected ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.descriptor_available ? 1 : 0),
        static_cast<std::uint8_t>(snapshot.input_available ? 1 : 0)
    };
    write_u32(payload, snapshot.sample_count);
    write_u32(payload, snapshot.rejected_report_count);
    payload.push_back(static_cast<std::uint8_t>(audio.usb_streaming ? 1 : 0));
    payload.push_back(static_cast<std::uint8_t>(snapshot.audio_streaming ? 1 : 0));
    write_u32(payload, audio.usb_packet_count);
    write_u32(payload, audio.dropped_frame_count);
    payload.push_back(static_cast<std::uint8_t>(snapshot.last_connection_error));
    payload.push_back(snapshot.last_connection_status);
    payload.push_back(0);
    payload.push_back(0);
    write_u32(payload, snapshot.connection_attempt_count);
    write_u32(payload, snapshot.connection_failure_count);
    write_u32(payload, snapshot.reconnect_attempt_count);
    payload.resize(48, 0);
    return payload;
}

std::vector<std::uint8_t> audio_status_payload() {
    const auto audio = miralink::audio::snapshot();
    const auto bluetooth = miralink::bluetooth::snapshot();
    std::vector<std::uint8_t> payload = {
        1,
        static_cast<std::uint8_t>(audio.usb_streaming ? 1 : 0),
        static_cast<std::uint8_t>(bluetooth.audio_streaming ? 1 : 0),
        static_cast<std::uint8_t>(bluetooth.audio_link_available ? 1 : 0)
    };
    write_u32(payload, audio.usb_packet_count);
    write_u32(payload, audio.dropped_frame_count);
    write_u32(payload, bluetooth.audio_packet_count);
    return payload;
}

void publish_controller_event() {
    const auto snapshot = miralink::bluetooth::snapshot();
    const bool changed = !g_event_initialized
        || g_last_event_sample_count != snapshot.sample_count
        || g_last_event_input_available != snapshot.input_available
        || g_last_event_descriptor_available != snapshot.descriptor_available
        || g_last_event_bluetooth_available != snapshot.bluetooth_available
        || g_last_event_pairing_window_open != snapshot.pairing_window_open
        || g_last_event_inquiry_active != snapshot.inquiry_active
        || g_last_event_connection_pending != snapshot.connection_pending;
    if (!changed || !tud_mounted() || !tud_hid_ready()) return;

    miralink::Frame frame;
    frame.command = miralink::Command::GetControllerState;
    frame.payload = controller_state_payload(snapshot);
    const auto encoded = miralink::encode_frame(frame);
    if (encoded.size() != miralink::kHidReportBytes) return;
    if (!tud_hid_report(kReportEvent, encoded.data(), static_cast<std::uint16_t>(encoded.size()))) return;

    g_event_initialized = true;
    g_last_event_sample_count = snapshot.sample_count;
    g_last_event_input_available = snapshot.input_available;
    g_last_event_descriptor_available = snapshot.descriptor_available;
    g_last_event_bluetooth_available = snapshot.bluetooth_available;
    g_last_event_pairing_window_open = snapshot.pairing_window_open;
    g_last_event_inquiry_active = snapshot.inquiry_active;
    g_last_event_connection_pending = snapshot.connection_pending;
}

std::uint8_t signed_axis(const std::uint8_t value) {
    const auto centered = std::clamp(static_cast<int>(value) - 128, -127, 127);
    return static_cast<std::uint8_t>(static_cast<std::int8_t>(centered));
}

void clear_gamepad_report() {
    g_gamepad_report.fill(0);
    // TinyUSB's gamepad template uses 8 as the neutral hat value.
    g_gamepad_report[6] = 8;
}

void set_gamepad_button(std::uint32_t& buttons, const std::uint8_t value, const std::uint8_t bit, const std::uint8_t mask) {
    if (value & mask) buttons |= 1u << bit;
}

void build_gamepad_report(const miralink::dualsense::InputState& input) {
    g_gamepad_report[0] = signed_axis(input.left_x);
    g_gamepad_report[1] = signed_axis(input.left_y);
    g_gamepad_report[2] = signed_axis(input.right_x);
    g_gamepad_report[3] = signed_axis(input.right_y);
    g_gamepad_report[4] = input.left_trigger;
    g_gamepad_report[5] = input.right_trigger;
    const auto dpad = static_cast<std::uint8_t>(input.dpad_face & 0x0f);
    g_gamepad_report[6] = static_cast<std::uint8_t>(dpad < 8 ? dpad + 1 : 8);

    std::uint32_t buttons = 0;
    set_gamepad_button(buttons, input.dpad_face, 0, 1u << 4); // square
    set_gamepad_button(buttons, input.dpad_face, 1, 1u << 5); // cross
    set_gamepad_button(buttons, input.dpad_face, 2, 1u << 6); // circle
    set_gamepad_button(buttons, input.dpad_face, 3, 1u << 7); // triangle
    set_gamepad_button(buttons, input.shoulder, 4, 1u << 0); // L1
    set_gamepad_button(buttons, input.shoulder, 5, 1u << 1); // R1
    set_gamepad_button(buttons, input.shoulder, 6, 1u << 2); // L2 digital
    set_gamepad_button(buttons, input.shoulder, 7, 1u << 3); // R2 digital
    set_gamepad_button(buttons, input.shoulder, 8, 1u << 6); // L3
    set_gamepad_button(buttons, input.shoulder, 9, 1u << 7); // R3
    set_gamepad_button(buttons, input.system, 10, 1u << 4); // create
    set_gamepad_button(buttons, input.system, 11, 1u << 5); // options
    set_gamepad_button(buttons, input.system, 12, 1u << 0); // PS
    set_gamepad_button(buttons, input.system, 13, 1u << 1); // touchpad
    set_gamepad_button(buttons, input.system, 14, 1u << 2); // mute
    g_gamepad_report[7] = static_cast<std::uint8_t>(buttons & 0xffu);
    g_gamepad_report[8] = static_cast<std::uint8_t>((buttons >> 8u) & 0xffu);
    g_gamepad_report[9] = static_cast<std::uint8_t>((buttons >> 16u) & 0xffu);
    g_gamepad_report[10] = static_cast<std::uint8_t>((buttons >> 24u) & 0xffu);
}

void publish_gamepad_report() {
    const auto snapshot = miralink::bluetooth::snapshot();
    if (snapshot.input_available && snapshot.sample_count != g_last_gamepad_sample_count) {
        build_gamepad_report(snapshot.input);
        // Remote wake is opt-in twice: the saved local profile must enable it
        // and the USB host must have armed the standard USB remote-wakeup
        // feature.  A validated controller report is the only event that can
        // request it, so background polling can never wake the computer.
        if (g_config_store.active().enable_wake && tud_suspended()) {
            (void)tud_remote_wakeup();
        }
        g_last_gamepad_sample_count = snapshot.sample_count;
        g_gamepad_was_available = true;
        g_gamepad_report_pending = true;
    } else if (!snapshot.input_available && g_gamepad_was_available) {
        clear_gamepad_report();
        g_gamepad_was_available = false;
        g_gamepad_report_pending = true;
    }
    const auto minimum_interval_us = gamepad_publish_interval_us();
    const auto now_us = time_us_64();
    const bool interval_elapsed = minimum_interval_us == 0
        || g_last_gamepad_report_us == 0
        || now_us - g_last_gamepad_report_us >= minimum_interval_us;
    if (g_gamepad_report_pending && interval_elapsed && tud_mounted() && tud_hid_ready()) {
        if (tud_hid_report(kReportGamepad, g_gamepad_report.data(), static_cast<std::uint16_t>(g_gamepad_report.size()))) {
            g_gamepad_report_pending = false;
            g_last_gamepad_report_us = now_us;
        }
    }
}

void process_frame(const std::uint8_t* buffer, std::uint16_t length) {
    const std::vector<std::uint8_t> bytes(buffer, buffer + length);
    const auto decoded = miralink::decode_frame(bytes);
    if (!decoded) {
        set_error(decoded.frame.sequence, decoded.frame.command, "invalid frame");
        return;
    }

    const auto sequence = decoded.frame.sequence;
    switch (decoded.frame.command) {
        case miralink::Command::Hello:
            set_response(sequence, decoded.frame.command, 0, {1, miralink::kConfigSchema, 1,
                static_cast<std::uint8_t>(miralink::kFeatureConfigPersistence
                    | miralink::kFeatureControllerInput
                    | miralink::kFeatureBluetoothPairing
                    | miralink::kFeatureUsbReconnect
                    | miralink::kFeatureRecovery
                    | miralink::kFeatureLocalLogs
                    | miralink::kFeatureBluetoothReconnect
                    | miralink::kFeatureUsbGamepad)});
            return;
        case miralink::Command::GetInfo:
            set_response(sequence, decoded.frame.command, 0, {'M', 'i', 'r', 'a', 'L', 'i', 'n', 'k', 2, 5, 0, 0});
            return;
        case miralink::Command::GetConfig: {
            const auto encoded = miralink::encode_config(g_config_store.active());
            const std::vector<std::uint8_t> payload(encoded.begin(), encoded.end());
            set_response(sequence, decoded.frame.command, 0, payload);
            return;
        }
        case miralink::Command::SetConfigDraft: {
            miralink::Config candidate;
            const auto result = miralink::decode_config(decoded.frame.payload, candidate);
            if (!result.ok) { set_error(sequence, decoded.frame.command, result.message.c_str()); return; }
            const auto staged = g_config_store.stage(candidate);
            if (!staged.ok) { set_error(sequence, decoded.frame.command, staged.message.c_str()); return; }
            append_log("configuration staged");
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        }
        case miralink::Command::CommitConfig:
            if (!g_config_store.commit()) { set_error(sequence, decoded.frame.command, "flash verification failed"); return; }
            apply_runtime_config();
            g_config_was_loaded = true;
            append_log("configuration committed");
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::ResetConfig:
            g_config_store.reset_to_defaults();
            append_log("configuration reset staged");
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::GetDiagnostics:
            set_response(sequence, decoded.frame.command, 0, diagnostics_payload());
            return;
        case miralink::Command::GetControllerState:
            set_response(sequence, decoded.frame.command, 0, controller_state_payload(miralink::bluetooth::snapshot()));
            return;
        case miralink::Command::GetControllerCapabilities:
            if (!decoded.frame.payload.empty()) { set_error(sequence, decoded.frame.command, "capabilities payload is invalid"); return; }
            set_response(sequence, decoded.frame.command, 0, controller_capabilities_payload(miralink::bluetooth::snapshot()));
            return;
        case miralink::Command::SendHaptic:
            if (decoded.frame.payload.size() != 5 || decoded.frame.payload[0] != 1) {
                set_error(sequence, decoded.frame.command, "haptic payload is invalid");
                return;
            }
            if (!miralink::bluetooth::send_haptic(decoded.frame.payload[1], decoded.frame.payload[2],
                static_cast<std::uint16_t>(decoded.frame.payload[3] | (decoded.frame.payload[4] << 8u)))) {
                set_error(sequence, decoded.frame.command, "haptic output unavailable or busy");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::SetLightbar:
            if (decoded.frame.payload.size() != 5 || decoded.frame.payload[0] != 1) {
                set_error(sequence, decoded.frame.command, "lightbar payload is invalid");
                return;
            }
            if (!miralink::bluetooth::set_lightbar(decoded.frame.payload[1], decoded.frame.payload[2], decoded.frame.payload[3], decoded.frame.payload[4])) {
                set_error(sequence, decoded.frame.command, "lightbar output unavailable or busy");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::SetMicrophoneMute:
            if (decoded.frame.payload.size() != 2 || decoded.frame.payload[0] != 1 || decoded.frame.payload[1] > 1) {
                set_error(sequence, decoded.frame.command, "microphone payload is invalid");
                return;
            }
            if (!miralink::bluetooth::set_microphone_mute(decoded.frame.payload[1] != 0)) {
                set_error(sequence, decoded.frame.command, "microphone output unavailable or busy");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::SetControllerOutput:
            if (decoded.frame.payload.size() != miralink::dualsense::kUsbOutputPayloadBytes + 1
                || decoded.frame.payload[0] != 1) {
                set_error(sequence, decoded.frame.command, "controller output payload is invalid");
                return;
            }
            if (!miralink::bluetooth::send_controller_output(decoded.frame.payload.data() + 1,
                miralink::dualsense::kUsbOutputPayloadBytes)) {
                set_error(sequence, decoded.frame.command, "controller output unavailable or busy");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::GetAudioStatus:
            if (!decoded.frame.payload.empty()) {
                set_error(sequence, decoded.frame.command, "audio status payload is invalid");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, audio_status_payload());
            return;
        case miralink::Command::OpenPairingWindow:
            if (!miralink::bluetooth::open_pairing_window()) {
                set_error(sequence, decoded.frame.command, "Bluetooth is not ready");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::GetLogPage:
            if (decoded.frame.payload.size() > 1) { set_error(sequence, decoded.frame.command, "log page payload is invalid"); return; }
            set_response(sequence, decoded.frame.command, 0, log_page_payload(decoded.frame.payload.empty() ? 0 : decoded.frame.payload[0]));
            return;
        case miralink::Command::ReconnectUsb:
            if (!decoded.frame.payload.empty()) { set_error(sequence, decoded.frame.command, "reconnect payload is invalid"); return; }
            append_log("USB reconnect scheduled");
            g_usb_reconnect_pending = true;
            g_usb_reconnect_deadline_ms = static_cast<std::uint64_t>(now_ms()) + 250;
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::EnterRecovery:
            if (decoded.frame.payload.size() != kRecoveryToken.size()
                || !std::equal(decoded.frame.payload.begin(), decoded.frame.payload.end(), kRecoveryToken.begin())) {
                set_error(sequence, decoded.frame.command, "recovery confirmation token required");
                return;
            }
            append_log("recovery scheduled");
            g_recovery_pending = true;
            g_recovery_deadline_ms = static_cast<std::uint64_t>(now_ms()) + 250;
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        default:
            set_error(sequence, decoded.frame.command, "command is not available in this firmware build");
            return;
    }
}
} // namespace

extern "C" {

uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type, uint8_t* buffer, uint16_t reqlen) {
    (void)instance;
    if (report_type != HID_REPORT_TYPE_FEATURE || report_id != kReportResponse) return 0;
    if (!g_response_ready || reqlen < g_response.size()) return 0;
    std::memcpy(buffer, g_response.data(), g_response.size());
    g_response_ready = false;
    return static_cast<uint16_t>(g_response.size());
}

void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type, uint8_t const* buffer, uint16_t bufsize) {
    (void)instance;
    if (report_type == HID_REPORT_TYPE_OUTPUT && report_id == kReportControllerOutput) {
        if (buffer == nullptr) return;
        const auto* payload = buffer;
        auto length = static_cast<std::size_t>(bufsize);
        if (length == miralink::dualsense::kUsbOutputReportBytes && payload[0] == report_id) {
            ++payload;
            --length;
        }
        if (length == miralink::dualsense::kUsbOutputPayloadBytes) {
            (void)miralink::bluetooth::send_controller_output(payload, length);
        }
        return;
    }
    if (report_type != HID_REPORT_TYPE_FEATURE || report_id != kReportCommand) return;
    if (buffer == nullptr) {
        set_error(0, miralink::Command::Hello, "empty HID report");
        return;
    }
    const auto* frame = buffer;
    auto frame_length = bufsize;
    // TinyUSB normally removes a duplicated report ID before invoking this
    // callback. A few host stacks deliver the ID in the callback buffer, so
    // accept that equivalent 65-byte form as well.
    if (frame_length == miralink::kHidReportBytes + 1 && frame[0] == report_id) {
        ++frame;
        --frame_length;
    }
    if (frame_length != miralink::kHidReportBytes) {
        set_error(0, miralink::Command::Hello, "invalid HID report length");
        return;
    }
    process_frame(frame, frame_length);
}

}

int main() {
    board_init();
    miralink::audio::init();
    g_config_was_loaded = g_config_store.load();
    apply_runtime_config();
    append_log(g_config_was_loaded ? "configuration loaded" : "safe defaults active");
    clear_gamepad_report();

    if (cyw43_arch_init() == PICO_OK) {
        miralink::bluetooth::init();
    }

    tusb_rhport_init_t device_init = {
        .role = TUSB_ROLE_DEVICE,
        .speed = TUSB_SPEED_AUTO
    };
    tusb_init(0, &device_init);

    while (true) {
        tud_task();
        miralink::audio::poll();
        miralink::bluetooth::poll();
        update_status_led();
        publish_gamepad_report();
        publish_controller_event();
        service_deferred_actions();
    }
}
