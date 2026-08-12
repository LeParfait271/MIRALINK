#include "miralink_config_store.h"
#include "miralink_bluetooth.h"
#include "miralink_protocol.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

#include "bsp/board_api.h"
#include "hardware/flash.h"
#include "pico/cyw43_arch.h"
#include "pico/stdlib.h"
#include "tusb.h"

namespace {
constexpr std::uint8_t kReportCommand = 0x01;
constexpr std::uint8_t kReportResponse = 0x02;
constexpr std::uint8_t kReportEvent = 0x03;
constexpr std::uint8_t kFlagResponse = 1u << 0;
constexpr std::uint8_t kFlagError = 1u << 1;
// Keep the two MiraLink configuration sectors before BTstack's two-sector
// link-key bank near the end of RP2350 flash. The final sector remains free
// for the RP2350 erratum reservation used by the SDK on supported revisions.
constexpr std::uint32_t kFlashStorageOffset = PICO_FLASH_SIZE_BYTES - (5u * FLASH_SECTOR_SIZE);

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
    std::vector<std::uint8_t> payload(16, 0);
    payload[0] = 1;
    if (snapshot.state == miralink::bluetooth::LinkState::Connected) payload[1] |= 1u << 0;
    if (snapshot.descriptor_available) payload[1] |= 1u << 1;
    if (snapshot.input_available) payload[1] |= 1u << 2;
    if (snapshot.bluetooth_available) payload[1] |= 1u << 3;
    if (snapshot.pairing_window_open) payload[1] |= 1u << 4;
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
    }
    return payload;
}

void publish_controller_event() {
    const auto snapshot = miralink::bluetooth::snapshot();
    const bool changed = !g_event_initialized
        || g_last_event_sample_count != snapshot.sample_count
        || g_last_event_input_available != snapshot.input_available
        || g_last_event_descriptor_available != snapshot.descriptor_available
        || g_last_event_bluetooth_available != snapshot.bluetooth_available
        || g_last_event_pairing_window_open != snapshot.pairing_window_open;
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
            set_response(sequence, decoded.frame.command, 0, {1, miralink::kConfigSchema, 1, 0});
            return;
        case miralink::Command::GetInfo:
            set_response(sequence, decoded.frame.command, 0, {'M', 'i', 'r', 'a', 'L', 'i', 'n', 'k', 2, 0, 1, 0});
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
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        }
        case miralink::Command::CommitConfig:
            if (!g_config_store.commit()) { set_error(sequence, decoded.frame.command, "flash verification failed"); return; }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::ResetConfig:
            g_config_store.reset_to_defaults();
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::GetDiagnostics:
            set_response(sequence, decoded.frame.command, 0, {1, static_cast<std::uint8_t>(g_config_was_loaded ? 1 : 0), static_cast<std::uint8_t>(tud_mounted() ? 1 : 0)});
            return;
        case miralink::Command::GetControllerState:
            set_response(sequence, decoded.frame.command, 0, controller_state_payload(miralink::bluetooth::snapshot()));
            return;
        case miralink::Command::OpenPairingWindow:
            if (!miralink::bluetooth::open_pairing_window()) {
                set_error(sequence, decoded.frame.command, "Bluetooth is not ready");
                return;
            }
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::GetLogPage:
            set_response(sequence, decoded.frame.command, 0, {});
            return;
        case miralink::Command::ReconnectUsb:
        case miralink::Command::EnterRecovery:
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
    if (report_type != HID_REPORT_TYPE_FEATURE || report_id != kReportCommand) return;
    if (bufsize != miralink::kHidReportBytes) {
        set_error(0, miralink::Command::Hello, "invalid HID report length");
        return;
    }
    process_frame(buffer, bufsize);
}

}

int main() {
    board_init();
    g_config_was_loaded = g_config_store.load();

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
        miralink::bluetooth::poll();
        publish_controller_event();
    }
}
