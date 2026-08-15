#include "miralink_bluetooth.h"
#include "miralink_bluetooth_bootstrap.h"
#include "miralink_bluetooth_reconnect.h"
#include "miralink_config.h"

#include "btstack.h"
#include "btstack_config.h"
#include "pico/stdlib.h"
#include "pico/sync.h"

#include <array>
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

extern "C" std::uint8_t miralink_btstack_hid_host_abort_get_report(std::uint16_t hid_cid);
extern "C" std::uint8_t miralink_btstack_hid_host_abort_connection(std::uint16_t hid_cid);

namespace miralink::bluetooth {
bool open_pairing_window();

namespace {

// Keep enough room for the complete SDP HID descriptor of DualSense
// revisions, including the Edge model, without allowing descriptor data to
// consume the rest of the controller state memory.
constexpr std::size_t kHidDescriptorStorageBytes = 2048;
constexpr std::uint32_t kPairingWindowMs = 300000;
constexpr std::uint8_t kInquiryDuration = 8;
constexpr std::size_t kMaxRememberedControllers = 4;
constexpr std::uint16_t kHapticMaxDurationMs = 3000;
constexpr std::uint32_t kConnectionHandshakeTimeoutMs = 10000;
constexpr std::uint32_t kFeatureResponseTimeoutMs = 1500;
constexpr std::uint32_t kFeatureRetryDelayMs = 25;
constexpr std::uint32_t kFeatureActivationTimeoutMs = 500;
constexpr std::uint32_t kFallbackActivationTimeoutMs = 1000;
constexpr std::uint8_t kFeatureMaxAttempts = 4;
constexpr std::uint32_t kAudioStreamingTimeoutMs = 250;
constexpr std::uint32_t kInquiryRetryDelayMs = 1000;
constexpr std::uint32_t kRssiPollIntervalMs = 1000;
constexpr std::uint32_t kOutputFlightGuardMs = 4;
constexpr std::size_t kOutputPacketCapacity = 4;
constexpr std::uint8_t kInitialStateOutputMaxAttempts = 3;
constexpr std::uint32_t kInitialStateOutputRetryMs = 25;
constexpr std::uint32_t kIgnoredHidDisconnectRetryMs = 250;
constexpr std::uint32_t kIgnoredHidDisconnectWindowMs = 10000;
constexpr std::uint8_t kIgnoredHidDisconnectMaxAttempts = 40;
constexpr std::uint16_t kPageScanInterval = 0x0012;
constexpr std::uint16_t kPageScanWindow = 0x0012;

struct OutputPacket {
    std::array<std::uint8_t, dualsense::kBluetoothAudioReportBytes> bytes{};
    std::uint8_t report_id = 0;
    std::size_t length = 0;
    bool occupied = false;
};

std::uint8_t g_hid_descriptor_storage[kHidDescriptorStorageBytes]{};
btstack_packet_callback_registration_t g_hci_event_registration{};
critical_section_t g_state_lock{};
Snapshot g_snapshot{};
std::uint16_t g_hid_cid = 0;
hci_con_handle_t g_acl_handle = HCI_CON_HANDLE_INVALID;
std::array<std::uint8_t, 6> g_acl_address{};
bool g_acl_address_valid = false;
bool g_acl_address_known_before_attempt = false;
bool g_acl_authenticated = false;
std::uint64_t g_pairing_window_deadline_ms = 0;
bool g_initialized = false;
bool g_hci_working = false;
bool g_pairing_requested = false;
bool g_inquiry_active = false;
bool g_connection_pending = false;
bool g_page_scan_rearm_pending = false;
// HCI reports ACL teardown before every HID-host state has necessarily
// emitted its close event; the foreground poll retires any stale host slot.
bool g_hci_disconnection_recovery_pending = false;
std::array<std::array<std::uint8_t, 6>, kMaxRememberedControllers> g_paired_addresses{};
std::size_t g_paired_address_count = 0;
struct ActiveControllerAttempt {
    std::array<std::uint8_t, 6> address{};
    bool address_valid = false;
    bool address_known_before_attempt = false;
    bool link_authenticated = false;
    bool input_validated = false;
};
ActiveControllerAttempt g_active_controller_attempt{};
std::uint64_t g_connection_deadline_ms = 0;
bootstrap::State g_feature_bootstrap{};
std::uint64_t g_feature_retry_deadline_ms = 0;
std::uint64_t g_feature_response_deadline_ms = 0;
std::uint64_t g_feature_activation_deadline_ms = 0;
std::uint8_t g_feature_attempt_count = 0;
std::uint8_t g_last_feature_status = 0;
bool g_protocol_handshake_pending = false;
std::array<std::uint8_t, dualsense::kBluetoothOutputReportBytes> g_bootstrap_output_packet{};
std::uint64_t g_bootstrap_output_flight_deadline_ms = 0;
std::array<std::uint8_t, dualsense::kBluetoothStateOutputReportBytes> g_initial_state_output_packet{};
bool g_initial_state_output_pending = false;
std::uint8_t g_initial_state_output_attempts = 0;
std::uint64_t g_initial_state_output_retry_deadline_ms = 0;
std::uint64_t g_inquiry_retry_deadline_ms = 0;
std::uint64_t g_rssi_next_poll_ms = 0;
std::uint64_t g_output_flight_deadline_ms = 0;
bool g_connection_failure_recorded = false;
std::uint16_t g_ignored_hid_cid = 0;
bool g_ignored_hid_disconnect_pending = false;
std::uint8_t g_ignored_hid_disconnect_attempts = 0;
std::uint64_t g_ignored_hid_disconnect_retry_ms = 0;
std::uint64_t g_ignored_hid_disconnect_deadline_ms = 0;
std::array<OutputPacket, kOutputPacketCapacity> g_output_packets{};
int g_output_in_flight = -1;
std::array<int, kOutputPacketCapacity> g_output_queue{};
std::size_t g_output_queue_head = 0;
std::size_t g_output_queue_tail = 0;
std::size_t g_output_queue_count = 0;
std::uint8_t g_output_sequence = 0;
bool g_haptic_stop_pending = false;
std::uint64_t g_haptic_stop_deadline_ms = 0;
std::uint64_t g_audio_last_packet_ms = 0;
std::array<std::uint8_t, 63> g_controller_state{};
std::uint16_t g_haptic_gain_q8_8 = 256;
std::uint8_t g_trigger_reduce = 0;
std::uint8_t g_inactive_minutes = 0;
std::uint64_t g_last_activity_ms = 0;
bool g_idle_suspended = false;

struct InquiryCandidate {
    bd_addr_t address{};
    std::uint8_t page_scan_repetition_mode = 0;
    std::uint16_t clock_offset = 0;
    bool valid = false;
    bool name_requested = false;
};

InquiryCandidate g_candidate{};

void packet_handler(std::uint8_t packet_type, std::uint16_t channel, std::uint8_t* packet, std::uint16_t size);
std::uint64_t now_ms();
void try_send_output();
void service_initial_state_output();
void service_feature_bootstrap();
void service_page_scan_rearm();
void set_connection_closed();
void remember_paired_address(const bd_addr_t address);
void service_rssi_measurement();

void record_connection_attempt(const bool reconnect) {
    g_connection_failure_recorded = false;
    critical_section_enter_blocking(&g_state_lock);
    ++g_snapshot.connection_attempt_count;
    if (reconnect) ++g_snapshot.reconnect_attempt_count;
    critical_section_exit(&g_state_lock);
}

void record_connection_failure(const ConnectionError error, const std::uint8_t status = 0) {
    g_connection_failure_recorded = true;
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.last_connection_error = error;
    g_snapshot.last_connection_status = status;
    ++g_snapshot.connection_failure_count;
    critical_section_exit(&g_state_lock);
}

std::uint64_t now_ms() {
    return to_us_since_boot(get_absolute_time()) / 1000u;
}

void reset_feature_bootstrap() {
    bootstrap::reset(g_feature_bootstrap);
    g_feature_retry_deadline_ms = 0;
    g_feature_response_deadline_ms = 0;
    g_feature_activation_deadline_ms = 0;
    g_feature_attempt_count = 0;
    g_last_feature_status = 0;
    g_bootstrap_output_packet.fill(0);
    g_bootstrap_output_flight_deadline_ms = 0;
    g_initial_state_output_packet.fill(0);
    g_initial_state_output_pending = false;
    g_initial_state_output_attempts = 0;
    g_initial_state_output_retry_deadline_ms = 0;
}

void arm_initial_state_output() {
    g_initial_state_output_packet = dualsense::build_bluetooth_state_output_report();
    g_initial_state_output_pending = true;
    g_initial_state_output_attempts = 0;
    g_initial_state_output_retry_deadline_ms = now_ms();
}

void clear_ignored_hid_teardown() {
    g_ignored_hid_cid = 0;
    g_ignored_hid_disconnect_pending = false;
    g_ignored_hid_disconnect_attempts = 0;
    g_ignored_hid_disconnect_retry_ms = 0;
    g_ignored_hid_disconnect_deadline_ms = 0;
}

void arm_ignored_hid_disconnect() {
    if (g_ignored_hid_cid == 0) {
        clear_ignored_hid_teardown();
        return;
    }
    const auto current_ms = now_ms();
    g_ignored_hid_disconnect_pending = true;
    g_ignored_hid_disconnect_attempts = 0;
    g_ignored_hid_disconnect_retry_ms = current_ms;
    g_ignored_hid_disconnect_deadline_ms = current_ms + kIgnoredHidDisconnectWindowMs;
}

void service_ignored_hid_disconnect() {
    if (!g_ignored_hid_disconnect_pending || g_ignored_hid_cid == 0) return;
    const auto current_ms = now_ms();
    if (g_ignored_hid_disconnect_attempts >= kIgnoredHidDisconnectMaxAttempts
        || current_ms >= g_ignored_hid_disconnect_deadline_ms) {
        g_ignored_hid_disconnect_pending = false;
        return;
    }
    if (current_ms < g_ignored_hid_disconnect_retry_ms) return;

    const auto ignored_cid = g_ignored_hid_cid;
    ++g_ignored_hid_disconnect_attempts;
    g_ignored_hid_disconnect_retry_ms = current_ms + kIgnoredHidDisconnectRetryMs;
    // poll() runs after cyw43_arch_poll(), outside the BTstack callback that
    // emitted OPENED. BTstack has therefore committed its final connection
    // state and cannot overwrite this disconnect request on callback return.
    hid_host_disconnect(ignored_cid);
    if (g_ignored_hid_cid == ignored_cid
        && g_ignored_hid_disconnect_attempts >= kIgnoredHidDisconnectMaxAttempts) {
        g_ignored_hid_disconnect_pending = false;
    }
}

void note_activity() {
    g_last_activity_ms = now_ms();
    g_idle_suspended = false;
}

std::uint16_t configured_haptic_gain_q8_8() {
    if (!g_initialized) return g_haptic_gain_q8_8;
    critical_section_enter_blocking(&g_state_lock);
    const auto value = g_haptic_gain_q8_8;
    critical_section_exit(&g_state_lock);
    return value;
}

std::uint8_t configured_trigger_reduce() {
    if (!g_initialized) return g_trigger_reduce;
    critical_section_enter_blocking(&g_state_lock);
    const auto value = g_trigger_reduce;
    critical_section_exit(&g_state_lock);
    return value;
}

std::uint8_t configured_inactive_minutes() {
    if (!g_initialized) return g_inactive_minutes;
    critical_section_enter_blocking(&g_state_lock);
    const auto value = g_inactive_minutes;
    critical_section_exit(&g_state_lock);
    return value;
}

bool pairing_window_active() {
    return g_pairing_window_deadline_ms != 0 && now_ms() < g_pairing_window_deadline_ms;
}

reconnect::RadioAction current_radio_action() {
    return reconnect::radio_action(g_hci_working, pairing_window_active(), g_paired_address_count);
}

char ascii_lower(const char value) {
    return value >= 'A' && value <= 'Z' ? static_cast<char>(value - 'A' + 'a') : value;
}

bool contains_name(const std::uint8_t* name, std::size_t length, const char* needle) {
    if (name == nullptr || needle == nullptr) return false;
    const auto needle_length = std::strlen(needle);
    if (needle_length == 0 || length < needle_length) return false;
    for (std::size_t offset = 0; offset + needle_length <= length; ++offset) {
        bool equal = true;
        for (std::size_t index = 0; index < needle_length; ++index) {
            if (ascii_lower(static_cast<char>(name[offset + index])) != ascii_lower(needle[index])) {
                equal = false;
                break;
            }
        }
        if (equal) return true;
    }
    return false;
}

bool name_is_dualsense(const std::uint8_t* name, std::size_t length) {
    // The configured controller mode selects only the USB persona. During an
    // explicit pairing window, discovery accepts either supported controller;
    // descriptor bootstrap and strict enhanced-report/CRC validation remain
    // mandatory before any input is exposed.
    return contains_name(name, length, "dualsense") || contains_name(name, length, "wireless controller");
}

bool inquiry_result_is_dualsense(const std::uint8_t* packet) {
    if (gap_event_inquiry_result_get_device_id_available(packet)) {
        const auto vendor = gap_event_inquiry_result_get_device_id_vendor_id(packet);
        const auto product = gap_event_inquiry_result_get_device_id_product_id(packet);
        if (dualsense::is_dualsense_usb(vendor, product)) return true;
    }
    // Some controller revisions expose an incomplete device-id during
    // inquiry. A matching local name is a valid pairing hint; the complete
    // HID report is still validated before any input is exposed.
    return gap_event_inquiry_result_get_name_available(packet)
        && name_is_dualsense(gap_event_inquiry_result_get_name(packet), gap_event_inquiry_result_get_name_len(packet));
}

bool inquiry_result_may_be_gamepad(const std::uint8_t* packet) {
    // The major device class 0x05 is the Bluetooth peripheral class. Keep this
    // fallback narrow: a remote name is requested before any HID connection.
    const auto class_of_device = gap_event_inquiry_result_get_class_of_device(packet);
    return ((class_of_device >> 8u) & 0x1fu) == 0x05u;
}

void clear_candidate() {
    g_candidate = InquiryCandidate{};
}

void set_inquiry_snapshot(const bool active) {
    critical_section_enter_blocking(&g_state_lock);
    g_inquiry_active = active;
    g_snapshot.inquiry_active = active;
    critical_section_exit(&g_state_lock);
}

bool paired_address_known(const bd_addr_t address) {
    for (std::size_t index = 0; index < g_paired_address_count; ++index) {
        if (bd_addr_cmp(address, g_paired_addresses[index].data()) == 0) return true;
    }
    return false;
}

void begin_controller_attempt(const bd_addr_t address) {
    if (address == nullptr) return;
    if (g_active_controller_attempt.address_valid
        && bd_addr_cmp(address, g_active_controller_attempt.address.data()) == 0) {
        return;
    }
    g_active_controller_attempt = {};
    std::memcpy(g_active_controller_attempt.address.data(), address,
        g_active_controller_attempt.address.size());
    g_active_controller_attempt.address_valid = true;
    // Capture trust before this attempt can create or replace a BTstack key.
    // This lets failure cleanup distinguish a new, unvalidated association
    // from every controller that was already remembered at attempt start.
    g_active_controller_attempt.address_known_before_attempt = paired_address_known(address);
    g_active_controller_attempt.link_authenticated = g_acl_authenticated
        && g_acl_address_valid
        && bd_addr_cmp(address, g_acl_address.data()) == 0;
    if (g_active_controller_attempt.link_authenticated) {
        // Authentication is the bond boundary.  The report parser still
        // withholds input until a complete CRC-valid 0x31 arrives.
        remember_paired_address(address);
    }
}

void clear_controller_attempt() {
    g_active_controller_attempt = {};
}

void forget_paired_address(const bd_addr_t address) {
    if (address == nullptr) return;
    for (std::size_t index = 0; index < g_paired_address_count; ++index) {
        if (bd_addr_cmp(address, g_paired_addresses[index].data()) != 0) continue;
        for (std::size_t move = index; move + 1 < g_paired_address_count; ++move) {
            g_paired_addresses[move] = g_paired_addresses[move + 1];
        }
        g_paired_addresses[g_paired_address_count - 1].fill(0);
        --g_paired_address_count;
        critical_section_enter_blocking(&g_state_lock);
        g_snapshot.paired_controller_known = g_paired_address_count != 0;
        critical_section_exit(&g_state_lock);
        return;
    }
}

void clear_acl_context() {
    g_acl_handle = HCI_CON_HANDLE_INVALID;
    g_acl_address.fill(0);
    g_acl_address_valid = false;
    g_acl_address_known_before_attempt = false;
    g_acl_authenticated = false;
    g_rssi_next_poll_ms = 0;
    if (g_initialized) {
        critical_section_enter_blocking(&g_state_lock);
        g_snapshot.rssi_valid = false;
        g_snapshot.rssi_dbm = 0;
        critical_section_exit(&g_state_lock);
    }
}

void service_rssi_measurement() {
    if (!g_hci_working || !g_acl_authenticated
        || g_acl_handle == HCI_CON_HANDLE_INVALID) {
        g_rssi_next_poll_ms = 0;
        return;
    }
    const auto current_ms = now_ms();
    if (g_rssi_next_poll_ms != 0 && current_ms < g_rssi_next_poll_ms) return;
    g_rssi_next_poll_ms = current_ms + kRssiPollIntervalMs;
    // BTstack emits GAP_EVENT_RSSI_MEASUREMENT asynchronously. Keep this at
    // 1 Hz so diagnostics never competes with HID bootstrap or output traffic.
    (void)gap_read_rssi(g_acl_handle);
}

void discard_unvalidated_controller_attempt() {
    if (g_active_controller_attempt.address_valid
        && reconnect::should_drop_unvalidated_key(
            g_active_controller_attempt.address_known_before_attempt,
            g_active_controller_attempt.link_authenticated,
            g_active_controller_attempt.input_validated)) {
        bd_addr_t address{};
        std::memcpy(address, g_active_controller_attempt.address.data(), sizeof(address));
        gap_drop_link_key_for_bd_addr(address);
    }
    clear_controller_attempt();
}

void remember_paired_address(const bd_addr_t address) {
    if (address == nullptr || paired_address_known(address)) return;
    if (g_paired_address_count < g_paired_addresses.size()) {
        std::memcpy(g_paired_addresses[g_paired_address_count].data(), address, g_paired_addresses[g_paired_address_count].size());
        ++g_paired_address_count;
    } else {
        std::memcpy(g_paired_addresses.back().data(), address, g_paired_addresses.back().size());
    }
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.paired_controller_known = true;
    critical_section_exit(&g_state_lock);
}

void load_paired_addresses() {
    g_paired_addresses = {};
    g_paired_address_count = 0;

    btstack_link_key_iterator_t iterator{};
    if (!gap_link_key_iterator_init(&iterator)) return;

    bd_addr_t address{};
    link_key_t key{};
    link_key_type_t type{};
    while (g_paired_address_count < g_paired_addresses.size()
        && gap_link_key_iterator_get_next(&iterator, address, key, &type)) {
        remember_paired_address(address);
    }
    gap_link_key_iterator_done(&iterator);
}

void start_inquiry() {
    if (current_radio_action() != reconnect::RadioAction::ExplicitPairingInquiry
        || g_inquiry_active || g_connection_pending || g_hid_cid != 0) return;
    if (g_inquiry_retry_deadline_ms != 0 && now_ms() < g_inquiry_retry_deadline_ms) return;
    const auto status = gap_inquiry_start(kInquiryDuration);
    if (status == ERROR_CODE_SUCCESS) {
        g_inquiry_retry_deadline_ms = 0;
        set_inquiry_snapshot(true);
    } else {
        record_connection_failure(ConnectionError::Inquiry, status);
        g_inquiry_retry_deadline_ms = now_ms() + kInquiryRetryDelayMs;
    }
}

void stop_inquiry() {
    if (g_inquiry_active) gap_inquiry_stop();
    set_inquiry_snapshot(false);
}

void complete_pairing_window() {
    g_pairing_window_deadline_ms = 0;
    g_pairing_requested = false;
    g_inquiry_retry_deadline_ms = 0;
    clear_candidate();
    stop_inquiry();
    gap_discoverable_control(0);
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.pairing_window_open = false;
    critical_section_exit(&g_state_lock);
}

bool begin_hid_connection(const bd_addr_t address) {
    if (g_idle_suspended
        || !reconnect::allows_outgoing_hid_connect(current_radio_action())
        || g_connection_pending || g_hid_cid != 0) return false;
    begin_controller_attempt(address);
    stop_inquiry();
    bd_addr_t mutable_address;
    std::memcpy(mutable_address, address, sizeof(mutable_address));
    reset_feature_bootstrap();
    g_protocol_handshake_pending = false;
    g_hid_cid = 0;
    record_connection_attempt(false);
    const auto status = hid_host_connect(mutable_address, HID_PROTOCOL_MODE_REPORT, &g_hid_cid);
    if (status != ERROR_CODE_SUCCESS) {
        record_connection_failure(ConnectionError::HidConnect, status);
        discard_unvalidated_controller_attempt();
        clear_candidate();
        if (g_pairing_requested) start_inquiry();
        return false;
    }
    g_connection_deadline_ms = now_ms() + kConnectionHandshakeTimeoutMs;
    g_connection_pending = true;
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.connection_pending = true;
    g_snapshot.state = LinkState::Starting;
    critical_section_exit(&g_state_lock);
    return true;
}

void remember_candidate(const std::uint8_t* packet) {
    gap_event_inquiry_result_get_bd_addr(packet, g_candidate.address);
    g_candidate.page_scan_repetition_mode = gap_event_inquiry_result_get_page_scan_repetition_mode(packet);
    g_candidate.clock_offset = gap_event_inquiry_result_get_clock_offset(packet);
    g_candidate.valid = true;
    g_candidate.name_requested = false;
}

void set_link_state(const LinkState state) {
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.state = state;
    critical_section_exit(&g_state_lock);
}

void clear_output_queue() {
    g_output_packets = {};
    g_output_in_flight = -1;
    g_output_queue.fill(-1);
    g_output_queue_head = 0;
    g_output_queue_tail = 0;
    g_output_queue_count = 0;
    g_output_flight_deadline_ms = 0;
    g_haptic_stop_pending = false;
    g_haptic_stop_deadline_ms = 0;
    g_audio_last_packet_ms = 0;
    g_controller_state.fill(0);
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.audio_link_available = false;
    g_snapshot.audio_streaming = false;
    g_snapshot.audio_packet_count = 0;
    critical_section_exit(&g_state_lock);
}

bool output_link_ready() {
    if (!g_initialized) return false;
    critical_section_enter_blocking(&g_state_lock);
    const bool ready = g_hid_cid != 0 && g_snapshot.descriptor_available
        && g_snapshot.state == LinkState::Connected
        && !g_protocol_handshake_pending
        && bootstrap::output_safe(g_feature_bootstrap)
        && (g_bootstrap_output_flight_deadline_ms == 0
            || now_ms() >= g_bootstrap_output_flight_deadline_ms);
    critical_section_exit(&g_state_lock);
    return ready;
}

void disconnect_after_bootstrap_failure(const ConnectionError error,
    const std::uint8_t status) {
    if (!g_connection_failure_recorded) record_connection_failure(error, status);
    const auto failed_cid = g_hid_cid;
    reset_feature_bootstrap();
    if (failed_cid != 0) hid_host_disconnect(failed_cid);
}

void service_initial_state_output() {
    if (!g_initial_state_output_pending || g_hid_cid == 0
        || g_protocol_handshake_pending
        // DS5Dongle primes the controller with its Feature reads before the
        // native 0x32 state packet. Do not spend the bounded state-output
        // retries while BTstack is still processing a GET_REPORT.
        || !bootstrap::initial_state_output_safe(g_feature_bootstrap)) return;
    bool descriptor_available = false;
    critical_section_enter_blocking(&g_state_lock);
    descriptor_available = g_snapshot.descriptor_available;
    critical_section_exit(&g_state_lock);
    if (!descriptor_available) return;

    const auto current_ms = now_ms();
    if (current_ms < g_initial_state_output_retry_deadline_ms) return;
    if (g_initial_state_output_attempts >= kInitialStateOutputMaxAttempts) {
        // Some controller revisions do not expose the native state report in
        // their SDP descriptor.  Treat that as a best-effort activation and
        // continue the feature bootstrap instead of tearing down a usable HID
        // link.
        g_initial_state_output_pending = false;
        return;
    }

    ++g_initial_state_output_attempts;
    const auto status = hid_host_send_report(g_hid_cid,
        dualsense::kBluetoothStateOutputReportId,
        g_initial_state_output_packet.data() + 1,
        static_cast<std::uint16_t>(g_initial_state_output_packet.size() - 1));
    if (status == ERROR_CODE_SUCCESS) {
        // BTstack retains this pointer until CAN_SEND_NOW. The packet is a
        // connection-lifetime buffer and is not rewritten until the next HID
        // connection, so no transient stack storage can corrupt the send.
        g_initial_state_output_pending = false;
        return;
    }
    if (status == ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER) {
        record_connection_failure(ConnectionError::ProtocolHandshake, status);
        set_connection_closed();
        return;
    }
    if (g_initial_state_output_attempts < kInitialStateOutputMaxAttempts) {
        g_initial_state_output_retry_deadline_ms = current_ms + kInitialStateOutputRetryMs;
    } else {
        g_initial_state_output_pending = false;
    }
}

void service_feature_bootstrap() {
    if (g_hid_cid == 0 || g_protocol_handshake_pending) return;
    const auto current_ms = now_ms();

    if (g_feature_bootstrap.phase == bootstrap::Phase::FeatureResponsePending) {
        if (g_feature_response_deadline_ms != 0
            && current_ms >= g_feature_response_deadline_ms) {
            const auto report_id = g_feature_bootstrap.pending_report_id;
            const auto abort_status = miralink_btstack_hid_host_abort_get_report(g_hid_cid);
            if (abort_status == ERROR_CODE_SUCCESS) {
                g_feature_response_deadline_ms = 0;
                g_last_feature_status = ERROR_CODE_CONNECTION_TIMEOUT;
                bootstrap::feature_response_received(g_feature_bootstrap, report_id, false);
                g_feature_attempt_count = 0;
                g_feature_retry_deadline_ms = current_ms + kFeatureRetryDelayMs;
            } else if (abort_status == ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER) {
                record_connection_failure(ConnectionError::ProtocolHandshake, abort_status);
                set_connection_closed();
            } else {
                disconnect_after_bootstrap_failure(ConnectionError::Timeout, report_id);
            }
        }
        return;
    }

    if (g_feature_bootstrap.phase == bootstrap::Phase::WaitingForEnhancedInput) {
        if (g_feature_activation_deadline_ms == 0
            || current_ms < g_feature_activation_deadline_ms) return;
        g_feature_activation_deadline_ms = 0;
        bootstrap::enhanced_input_timed_out(g_feature_bootstrap);
        g_feature_attempt_count = 0;
        if (g_feature_bootstrap.phase == bootstrap::Phase::Failed) {
            disconnect_after_bootstrap_failure(ConnectionError::ProtocolHandshake,
                g_last_feature_status);
        } else {
            g_feature_retry_deadline_ms = current_ms;
        }
        return;
    }

    if (g_feature_bootstrap.phase == bootstrap::Phase::FeatureRequestReady) {
        if (g_feature_retry_deadline_ms != 0
            && current_ms < g_feature_retry_deadline_ms) return;
        const auto report_id = bootstrap::feature_report_id(g_feature_bootstrap);
        if (report_id == 0) return;

        ++g_feature_attempt_count;
        const auto status = hid_host_send_get_report(g_hid_cid,
            HID_REPORT_TYPE_FEATURE, report_id);
        if (status == ERROR_CODE_SUCCESS) {
            bootstrap::feature_request_sent(g_feature_bootstrap, report_id);
            g_feature_retry_deadline_ms = 0;
            g_feature_response_deadline_ms = current_ms + kFeatureResponseTimeoutMs;
            return;
        }

        g_last_feature_status = status;
        if (status == ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER) {
            record_connection_failure(ConnectionError::ProtocolHandshake, status);
            set_connection_closed();
            return;
        }
        if (status == ERROR_CODE_COMMAND_DISALLOWED
            && g_feature_attempt_count < kFeatureMaxAttempts) {
            g_feature_retry_deadline_ms = current_ms + kFeatureRetryDelayMs;
            return;
        }
        bootstrap::feature_request_failed(g_feature_bootstrap, report_id);
        g_feature_attempt_count = 0;
        g_feature_retry_deadline_ms = current_ms + kFeatureRetryDelayMs;
        return;
    }

    if (g_feature_bootstrap.phase == bootstrap::Phase::FallbackOutputReady) {
        if (g_feature_retry_deadline_ms != 0
            && current_ms < g_feature_retry_deadline_ms) return;
        if (g_feature_attempt_count == 0) {
            const dualsense::OutputRequest request{};
            g_bootstrap_output_packet = dualsense::build_bluetooth_output_report(
                request, g_output_sequence++ & 0x0fu);
        }

        ++g_feature_attempt_count;
        const auto status = hid_host_send_report(g_hid_cid,
            dualsense::kBluetoothOutputReportId,
            g_bootstrap_output_packet.data() + 1,
            static_cast<std::uint16_t>(g_bootstrap_output_packet.size() - 1));
        if (status == ERROR_CODE_SUCCESS) {
            bootstrap::fallback_output_sent(g_feature_bootstrap);
            g_feature_attempt_count = 0;
            g_feature_retry_deadline_ms = 0;
            g_feature_activation_deadline_ms = current_ms + kFallbackActivationTimeoutMs;
            g_bootstrap_output_flight_deadline_ms = current_ms + kOutputFlightGuardMs;
            return;
        }

        g_last_feature_status = status;
        if (status == ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER) {
            record_connection_failure(ConnectionError::ProtocolHandshake, status);
            set_connection_closed();
            return;
        }
        if (status == ERROR_CODE_COMMAND_DISALLOWED
            && g_feature_attempt_count < kFeatureMaxAttempts) {
            g_feature_retry_deadline_ms = current_ms + kFeatureRetryDelayMs;
            return;
        }
        bootstrap::fallback_output_failed(g_feature_bootstrap);
        disconnect_after_bootstrap_failure(ConnectionError::ProtocolHandshake, status);
    }
}

int output_free_slot() {
    for (std::size_t index = 0; index < g_output_packets.size(); ++index) {
        if (!g_output_packets[index].occupied
            && static_cast<int>(index) != g_output_in_flight) {
            return static_cast<int>(index);
        }
    }
    return -1;
}

bool enqueue_output_packet(const std::uint8_t report_id,
    const std::uint8_t* bytes, const std::size_t length) {
    if (bytes == nullptr || length == 0 || length > g_output_packets[0].bytes.size()
        || g_output_queue_count >= g_output_packets.size()) return false;
    const auto slot = output_free_slot();
    if (slot < 0) return false;
    g_output_packets[slot].bytes.fill(0);
    std::copy(bytes, bytes + length, g_output_packets[slot].bytes.begin());
    g_output_packets[slot].report_id = report_id;
    g_output_packets[slot].length = length;
    g_output_packets[slot].occupied = true;
    g_output_queue[g_output_queue_tail] = slot;
    g_output_queue_tail = (g_output_queue_tail + 1) % g_output_queue.size();
    ++g_output_queue_count;
    return true;
}

bool queue_output(const dualsense::OutputRequest& request) {
    if (!output_link_ready()) return false;
    const auto report = dualsense::build_bluetooth_output_report(request, g_output_sequence++ & 0x0fu);
    if (!enqueue_output_packet(dualsense::kBluetoothOutputReportId,
        report.data(), report.size())) return false;
    note_activity();
    if (request.usb_output) {
        std::copy(request.usb_output_payload.begin(), request.usb_output_payload.end(), g_controller_state.begin());
    }
    if (request.haptics || request.lightbar || request.player_leds || request.microphone_mute) {
        std::copy(report.begin() + 3, report.begin() + 3 + g_controller_state.size(), g_controller_state.begin());
    }
    return true;
}

void try_send_output() {
    if (g_output_queue_count == 0 || !output_link_ready()) return;

    // The build-time BTstack overlay only accepts a new interrupt report once
    // the previous CAN_SEND_NOW callback has copied its payload. Keep the
    // bounded FIFO intact until that SUCCESS proves the old caller-owned
    // buffer is no longer referenced by BTstack.
    if (g_output_in_flight >= 0) {
        if (now_ms() < g_output_flight_deadline_ms) return;
    }

    const auto slot = g_output_queue[g_output_queue_head];
    const auto status = hid_host_send_report(g_hid_cid, g_output_packets[slot].report_id,
        g_output_packets[slot].bytes.data() + 1,
        static_cast<std::uint16_t>(g_output_packets[slot].length - 1));
    if (status == ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER) {
        record_connection_failure(ConnectionError::ProtocolHandshake, status);
        set_connection_closed();
        return;
    }
    if (status != ERROR_CODE_SUCCESS) return;

    if (g_output_in_flight >= 0) {
        g_output_packets[g_output_in_flight].occupied = false;
    }
    g_output_in_flight = slot;
    g_output_queue[g_output_queue_head] = -1;
    g_output_queue_head = (g_output_queue_head + 1) % g_output_queue.size();
    --g_output_queue_count;
    g_output_flight_deadline_ms = now_ms() + kOutputFlightGuardMs;
    if (g_output_packets[slot].report_id == dualsense::kBluetoothAudioReportId) {
        critical_section_enter_blocking(&g_state_lock);
        g_snapshot.audio_link_available = true;
        g_snapshot.audio_streaming = true;
        ++g_snapshot.audio_packet_count;
        g_audio_last_packet_ms = now_ms();
        critical_section_exit(&g_state_lock);
    }
}

void set_connection_closed() {
    discard_unvalidated_controller_attempt();
    g_connection_pending = false;
    g_connection_deadline_ms = 0;
    g_rssi_next_poll_ms = 0;
    reset_feature_bootstrap();
    g_protocol_handshake_pending = false;
    clear_output_queue();
    critical_section_enter_blocking(&g_state_lock);
    g_hid_cid = 0;
    g_snapshot.connection_pending = false;
    g_snapshot.descriptor_available = false;
    g_snapshot.input_available = false;
    g_snapshot.pairing_window_open = pairing_window_active();
    g_snapshot.state = pairing_window_active() ? LinkState::PairingWindow : LinkState::Disconnected;
    critical_section_exit(&g_state_lock);
    clear_candidate();
    g_connection_failure_recorded = false;
}

void service_page_scan_rearm() {
    if (!g_page_scan_rearm_pending) return;

    // DS5Dongle treats HCI_EVENT_DISCONNECTION_COMPLETE as the authoritative
    // lifecycle boundary. BTstack's HID host can still retain a CID while an
    // SDP query is finalized, so waiting for HID_SUBEVENT_CONNECTION_CLOSED
    // can leave its sole host slot reserved forever. Retire that slot from
    // the foreground context before rearming passive page scan.
    if (g_hci_disconnection_recovery_pending
        && g_hci_working && !g_idle_suspended) {
        if (g_hid_cid != 0) {
            (void) miralink_btstack_hid_host_abort_connection(g_hid_cid);
        }
        // Also normalize the snapshot when a late HID close already cleared
        // the local CID without passing through the normal state path.
        set_connection_closed();
        g_hci_disconnection_recovery_pending = false;
    }

    const bool hid_link_active = g_hid_cid != 0 || g_connection_pending;
    if (!reconnect::should_rearm_page_scan(g_hci_working, g_idle_suspended, hid_link_active)) {
        // A HID close can precede the ACL teardown event. Keep the request
        // pending until HCI_EVENT_DISCONNECTION_COMPLETE confirms that the
        // controller has finished disabling the old page scan.
        if (!g_hci_working || g_idle_suspended) {
            g_page_scan_rearm_pending = false;
        }
        return;
    }

    g_page_scan_rearm_pending = false;
    // BTstack's cached connectable flag can remain true after the controller
    // disables page scan when an ACL link closes. Reapply the scan parameters
    // and force a 0 -> 1 transition outside the HID callback so the controller
    // receives a fresh page-scan enable command for passive PS reconnect.
    gap_set_page_scan_activity(kPageScanInterval, kPageScanWindow);
    gap_set_page_scan_type(PAGE_SCAN_MODE_INTERLACED);
    gap_connectable_control(0);
    gap_connectable_control(1);
    if (current_radio_action() == reconnect::RadioAction::ExplicitPairingInquiry) {
        gap_discoverable_control(1);
        start_inquiry();
    } else {
        // Match DS5Dongle's reconnect lifecycle: re-enable discoverability as
        // well as page scan after ACL teardown.  The HID admission policy still
        // accepts only a remembered address outside an explicit pairing window;
        // discoverability alone does not authorize a new controller.
        gap_discoverable_control(reconnect::should_restore_discoverable(
            g_hci_working, g_idle_suspended) ? 1 : 0);
    }
}

void handle_report(const std::uint8_t* report, const std::uint16_t length) {
    if (report == nullptr || length == 0) return;

    const auto report_kind = bootstrap::classify_input_report(report, length);
    if (report_kind == bootstrap::InputReportKind::Simple) {
        // A compact 0x01 packet proves that the HID interrupt channel and the
        // controller are alive, but it lacks the state required by the USB
        // bridge. Count it in the existing diagnostics without promoting the
        // link to Connected or extending the bounded handshake deadline.
        note_activity();
        critical_section_enter_blocking(&g_state_lock);
        ++g_snapshot.rejected_report_count;
        critical_section_exit(&g_state_lock);
        return;
    }
    if (report_kind != bootstrap::InputReportKind::Enhanced) return;

    const auto parsed = dualsense::parse_bluetooth_input_report(report, length);
    const bool first_valid_enhanced_input = parsed
        && g_active_controller_attempt.address_valid
        && !g_active_controller_attempt.input_validated;
    if (first_valid_enhanced_input) {
        remember_paired_address(g_active_controller_attempt.address.data());
        g_active_controller_attempt.input_validated = true;
    }
    if (reconnect::completes_pairing_window(pairing_window_active(), first_valid_enhanced_input)) {
        // A valid CRC-protected 0x31 report is the trust boundary for a new
        // association. Stop inquiry immediately; leaving the five-minute
        // window open would restart discovery instead of passive reconnect
        // when the newly paired controller is switched off.
        complete_pairing_window();
    }
    bool user_activity = false;
    critical_section_enter_blocking(&g_state_lock);
    if (parsed) {
        // DualSense sends enhanced reports continuously, including while it
        // is completely idle.  Treating every sample as activity makes the
        // configured inactivity timeout ineffective.  Compare only the
        // controls/touch state; sequence, sensors and battery telemetry are
        // deliberately excluded by this helper.
        user_activity = dualsense::has_user_controller_activity(
            g_snapshot.input, parsed.state);
        bootstrap::enhanced_input_received(g_feature_bootstrap);
        g_feature_activation_deadline_ms = 0;
        g_snapshot.input = parsed.state;
        g_snapshot.input_available = true;
        g_snapshot.sample_count += 1;
        g_snapshot.state = LinkState::Connected;
        g_snapshot.audio_link_available = true;
        g_connection_deadline_ms = 0;
    } else {
        g_snapshot.rejected_report_count += 1;
    }
    critical_section_exit(&g_state_lock);
    if (user_activity) note_activity();
}

void handle_feature_response(const std::uint8_t* packet) {
    if (packet == nullptr
        || hid_subevent_get_report_response_get_hid_cid(packet) != g_hid_cid
        || g_feature_bootstrap.phase != bootstrap::Phase::FeatureResponsePending) return;

    const auto report_id = g_feature_bootstrap.pending_report_id;
    const auto status = hid_subevent_get_report_response_get_handshake_status(packet);
    g_feature_response_deadline_ms = 0;

    if (status == HID_HANDSHAKE_PARAM_TYPE_NOT_READY
        && !g_feature_bootstrap.enhanced_input_seen
        && g_feature_attempt_count < kFeatureMaxAttempts) {
        bootstrap::retry_feature_request(g_feature_bootstrap, report_id);
        g_feature_retry_deadline_ms = now_ms() + kFeatureRetryDelayMs;
        return;
    }

    const auto report_length = hid_subevent_get_report_response_get_report_len(packet);
    const auto* report = hid_subevent_get_report_response_get_report(packet);
    const bool successful = status == HID_HANDSHAKE_PARAM_TYPE_SUCCESSFUL
        && bootstrap::valid_feature_response(report_id, report, report_length);
    if (!successful) {
        g_last_feature_status = status == HID_HANDSHAKE_PARAM_TYPE_SUCCESSFUL
            ? static_cast<std::uint8_t>(HID_HANDSHAKE_PARAM_TYPE_ERR_INVALID_REPORT_ID)
            : status;
    }
    bootstrap::feature_response_received(g_feature_bootstrap, report_id, successful);
    g_feature_attempt_count = 0;

    if (g_feature_bootstrap.phase == bootstrap::Phase::Complete) {
        g_feature_activation_deadline_ms = 0;
    } else if (successful) {
        g_last_feature_status = 0;
        g_feature_activation_deadline_ms = now_ms() + kFeatureActivationTimeoutMs;
    } else {
        // BTstack restores HID_HOST_CONNECTION_ESTABLISHED after this callback
        // returns. Defer the next GET_REPORT to poll() instead of colliding
        // with the control transaction which is still being finalized.
        g_feature_retry_deadline_ms = now_ms() + kFeatureRetryDelayMs;
    }
}

void packet_handler(std::uint8_t packet_type, std::uint16_t channel, std::uint8_t* packet, std::uint16_t size) {
    (void)channel;
    (void)size;
    if (packet_type != HCI_EVENT_PACKET || packet == nullptr) return;

    const std::uint8_t event = hci_event_packet_get_type(packet);
    switch (event) {
        case BTSTACK_EVENT_STATE:
            if (btstack_event_state_get_state(packet) == HCI_STATE_WORKING) {
                g_hci_working = true;
                g_inquiry_active = false;
                g_pairing_window_deadline_ms = 0;
                g_pairing_requested = false;
                g_connection_deadline_ms = 0;
                g_inquiry_retry_deadline_ms = 0;
                reset_feature_bootstrap();
                g_protocol_handshake_pending = false;
                g_idle_suspended = false;
                g_hci_disconnection_recovery_pending = false;
                clear_acl_context();
                g_last_activity_ms = now_ms();
                clear_ignored_hid_teardown();
                clear_controller_attempt();
                clear_candidate();
                // BTstack can only queue these controller commands once HCI is
                // working. A fast interlaced page scan matches DS5Dongle's
                // proven PS-button reconnect path on Pico 2 W.
                gap_set_page_scan_activity(kPageScanInterval, kPageScanWindow);
                gap_set_page_scan_type(PAGE_SCAN_MODE_INTERLACED);
                gap_connectable_control(1);
                // Make the bond policy explicit instead of relying on
                // BTstack defaults.  DS5Dongle enables Secure Simple Pairing
                // with general bonding, which is what lets a PS-only wake
                // reuse the stored link key after a Pico reboot.
                gap_ssp_set_enable(1);
                gap_secure_connections_enable(true);
                gap_set_bondable_mode(1);
                gap_ssp_set_authentication_requirement(
                    SSP_IO_AUTHREQ_MITM_PROTECTION_NOT_REQUIRED_GENERAL_BONDING);
                // Reapply the controller scan state from the foreground poll
                // as well; this covers a BTstack reset where its cached
                // connectable flag survives the radio transition.
                g_page_scan_rearm_pending = true;
                gap_discoverable_control(0);
                gap_set_local_name("MiraLink Pico 2 W");
                gap_set_class_of_device(0x2508);
                gap_set_default_link_policy_settings(LM_LINK_POLICY_ENABLE_SNIFF_MODE | LM_LINK_POLICY_ENABLE_ROLE_SWITCH);
                hci_set_master_slave_policy(HCI_ROLE_MASTER);
                gap_ssp_set_io_capability(SSP_IO_CAPABILITY_NO_INPUT_NO_OUTPUT);
                gap_ssp_set_auto_accept(0);
                critical_section_enter_blocking(&g_state_lock);
                g_snapshot.bluetooth_available = true;
                g_snapshot.pairing_window_open = false;
                g_snapshot.inquiry_active = false;
                g_snapshot.connection_pending = false;
                g_snapshot.state = LinkState::Disconnected;
                critical_section_exit(&g_state_lock);
                load_paired_addresses();
                if (g_paired_address_count == 0) {
                    // A fresh Pico must be usable without a WebHID command:
                    // expose the radio and start discovery as soon as the
                    // controller host is ready. Remembered controllers stay
                    // page-scannable and reconnect through incoming HID.
                    open_pairing_window();
                }
            } else if (btstack_event_state_get_state(packet) == HCI_STATE_OFF) {
                g_hci_working = false;
                g_inquiry_active = false;
                g_pairing_window_deadline_ms = 0;
                g_pairing_requested = false;
                g_connection_pending = false;
                g_hid_cid = 0;
                g_hci_disconnection_recovery_pending = false;
                clear_acl_context();
                clear_ignored_hid_teardown();
                g_connection_deadline_ms = 0;
                g_inquiry_retry_deadline_ms = 0;
                reset_feature_bootstrap();
                g_protocol_handshake_pending = false;
                discard_unvalidated_controller_attempt();
                g_page_scan_rearm_pending = false;
                clear_output_queue();
                clear_candidate();
                critical_section_enter_blocking(&g_state_lock);
                g_snapshot.bluetooth_available = false;
                g_snapshot.pairing_window_open = false;
                g_snapshot.inquiry_active = false;
                g_snapshot.connection_pending = false;
                g_snapshot.descriptor_available = false;
                g_snapshot.input_available = false;
                g_snapshot.audio_link_available = false;
                g_snapshot.audio_streaming = false;
                g_snapshot.state = LinkState::Unavailable;
                critical_section_exit(&g_state_lock);
            }
            break;

        case HCI_EVENT_CONNECTION_COMPLETE: {
            const auto status = hci_event_connection_complete_get_status(packet);
            if (status == ERROR_CODE_SUCCESS) {
                const auto handle = hci_event_connection_complete_get_connection_handle(packet);
                bd_addr_t address{};
                hci_event_connection_complete_get_bd_addr(packet, address);
                g_acl_handle = handle;
                std::memcpy(g_acl_address.data(), address, g_acl_address.size());
                g_acl_address_valid = true;
                g_acl_address_known_before_attempt = paired_address_known(address);
                // DS5Dongle explicitly starts the Classic authentication
                // phase after the ACL is complete.  Keep that lifecycle
                // boundary explicit here too; HID admission is still gated
                // separately by the remembered-address/pairing-window policy.
                if (pairing_window_active() || g_acl_address_known_before_attempt) {
                    (void) hci_send_cmd(&hci_authentication_requested, handle);
                }
            } else {
                const bool hid_attempt_pending = g_connection_pending;
                if (hid_attempt_pending) {
                    // A page timeout (commonly status 0x04) may arrive before
                    // HID host emits CONNECTION_OPENED/CLOSED. Release the
                    // pending attempt immediately instead of waiting for the
                    // 10 s HID deadline, then let the normal foreground radio
                    // re-arm return the Pico to passive PS reconnect/inquiry.
                    record_connection_failure(ConnectionError::ConnectionOpen, status);
                    set_connection_closed();
                    g_page_scan_rearm_pending = reconnect::should_recover_after_acl_failure(
                        g_hci_working, g_idle_suspended, hid_attempt_pending);
                }
                clear_acl_context();
            }
            break;
        }

        case GAP_EVENT_RSSI_MEASUREMENT: {
            const auto handle = gap_event_rssi_measurement_get_con_handle(packet);
            if (handle != g_acl_handle) break;
            critical_section_enter_blocking(&g_state_lock);
            g_snapshot.rssi_dbm = static_cast<std::int8_t>(
                gap_event_rssi_measurement_get_rssi(packet));
            g_snapshot.rssi_valid = true;
            critical_section_exit(&g_state_lock);
            break;
        }

        case HCI_EVENT_AUTHENTICATION_COMPLETE: {
            const auto status = hci_event_authentication_complete_get_status(packet);
            const auto handle = hci_event_authentication_complete_get_connection_handle(packet);
            const bool handle_matches = g_acl_handle != HCI_CON_HANDLE_INVALID
                && handle == g_acl_handle;
            if (status == ERROR_CODE_SUCCESS && handle_matches && g_acl_address_valid) {
                g_acl_authenticated = true;
                if (g_active_controller_attempt.address_valid
                    && bd_addr_cmp(g_active_controller_attempt.address.data(), g_acl_address.data()) == 0) {
                    g_active_controller_attempt.link_authenticated = true;
                    // Persist the address at the same lifecycle boundary as
                    // the link key.  A later HID/feature failure must not
                    // turn a valid bond into a mandatory web re-pair.
                    remember_paired_address(g_acl_address.data());
                }
                // Authentication completes before the controller's HID
                // channels are opened. Request encryption explicitly, as the
                // reference firmware does, while BTstack still owns the
                // authenticated ACL handle.
                (void) hci_send_cmd(&hci_set_connection_encryption, handle, 1);
            }
            if (status != ERROR_CODE_SUCCESS
                && reconnect::should_drop_key_after_auth_failure(
                    handle_matches,
                    g_acl_address_known_before_attempt,
                    g_active_controller_attempt.input_validated)
                && g_acl_address_valid) {
                bd_addr_t address{};
                std::memcpy(address, g_acl_address.data(), sizeof(address));
                // This mirrors DS5Dongle's stale-bond recovery, but only for
                // the active controller handle and before valid input trust.
                gap_drop_link_key_for_bd_addr(address);
                forget_paired_address(address);
                clear_controller_attempt();
                g_acl_authenticated = false;
            }
            if (status != ERROR_CODE_SUCCESS && handle_matches) {
                record_connection_failure(ConnectionError::ConnectionOpen, status);
            }
            break;
        }

        case HCI_EVENT_DISCONNECTION_COMPLETE: {
            const auto disconnected_handle =
                hci_event_disconnection_complete_get_connection_handle(packet);
            const bool acl_handle_valid = g_acl_handle != HCI_CON_HANDLE_INVALID;
            const bool hid_link_active = g_hid_cid != 0 || g_connection_pending;
            if (!reconnect::matches_active_acl_disconnection(
                    acl_handle_valid, g_acl_handle, disconnected_handle, hid_link_active)) {
                // Other Bluetooth ACL links must not clear the active
                // DualSense state or consume its reconnect recovery request.
                break;
            }
            // DS5Dongle re-enables its connectable/discoverable state at this
            // lifecycle boundary. This event is the controller's last
            // authoritative teardown edge; deferring the first scan-enable
            // command until the next foreground poll can miss the short
            // page window used by a PS-only reconnect. Issue the same bounded
            // radio re-arm immediately, and retain the foreground request as
            // a retry for adapters that reject a command while busy.
            if (g_hci_working && !g_idle_suspended) {
                gap_set_page_scan_activity(kPageScanInterval, kPageScanWindow);
                gap_set_page_scan_type(PAGE_SCAN_MODE_INTERLACED);
                gap_connectable_control(1);
                gap_discoverable_control(1);
            }
            g_hci_disconnection_recovery_pending = reconnect::should_recover_after_hci_disconnection(
                g_hci_working, g_idle_suspended,
                g_hid_cid != 0 || g_connection_pending);
            g_page_scan_rearm_pending = reconnect::should_rearm_after_hci_disconnection(
                g_hci_working, g_idle_suspended);
            clear_acl_context();
            break;
        }

        case HCI_EVENT_PIN_CODE_REQUEST: {
            bd_addr_t address;
            hci_event_pin_code_request_get_bd_addr(packet, address);
            // Some DualSense revisions still fall back to legacy PIN pairing.
            // Only accept the fixed controller PIN during the explicit local
            // pairing window or for an address already stored by BTstack.
            if (pairing_window_active() || paired_address_known(address)) {
                gap_pin_code_response(address, "0000");
            } else {
                gap_pin_code_negative(address);
            }
            break;
        }

        case HCI_EVENT_USER_CONFIRMATION_REQUEST: {
            bd_addr_t address;
            hci_event_user_confirmation_request_get_bd_addr(packet, address);
            if (pairing_window_active() || paired_address_known(address)) {
                gap_ssp_confirmation_response(address);
            } else {
                gap_ssp_confirmation_negative(address);
            }
            break;
        }

        case HCI_EVENT_REMOTE_NAME_REQUEST_COMPLETE: {
            if (!g_candidate.valid) break;
            bd_addr_t address;
            hci_event_remote_name_request_complete_get_bd_addr(packet, address);
            if (bd_addr_cmp(address, g_candidate.address) != 0) break;
            bool matches = false;
            if (hci_event_remote_name_request_complete_get_status(packet) == ERROR_CODE_SUCCESS && size > 9) {
                std::size_t name_length = 0;
                const auto* name = reinterpret_cast<const std::uint8_t*>(hci_event_remote_name_request_complete_get_remote_name(packet));
                while (9 + name_length < size && name[name_length] != 0) ++name_length;
                matches = name_is_dualsense(name, name_length);
            }
            if (matches) {
                begin_hid_connection(g_candidate.address);
            } else {
                clear_candidate();
                start_inquiry();
            }
            break;
        }

                case GAP_EVENT_INQUIRY_RESULT: {
            if (!g_pairing_requested || g_connection_pending) break;
            if (inquiry_result_is_dualsense(packet)) {
                bd_addr_t address;
                gap_event_inquiry_result_get_bd_addr(packet, address);
                begin_hid_connection(address);
            } else if (!g_candidate.valid && inquiry_result_may_be_gamepad(packet)) {
                remember_candidate(packet);
            }
            break;
        }

        case GAP_EVENT_INQUIRY_COMPLETE:
            set_inquiry_snapshot(false);
            if (!g_pairing_requested || g_connection_pending) break;
            if (g_candidate.valid && !g_candidate.name_requested) {
                g_candidate.name_requested = true;
                const auto status = gap_remote_name_request(g_candidate.address, g_candidate.page_scan_repetition_mode, static_cast<std::uint16_t>(g_candidate.clock_offset | 0x8000u));
                if (status != ERROR_CODE_SUCCESS) {
                    clear_candidate();
                    start_inquiry();
                }
            } else {
                clear_candidate();
                start_inquiry();
            }
            break;

        case HCI_EVENT_HID_META: {
            const auto subevent = hci_event_hid_meta_get_subevent_code(packet);
            std::uint16_t event_cid = 0;
            switch (subevent) {
                case HID_SUBEVENT_INCOMING_CONNECTION:
                    event_cid = hid_subevent_incoming_connection_get_hid_cid(packet);
                    break;
                case HID_SUBEVENT_CONNECTION_OPENED:
                    event_cid = hid_subevent_connection_opened_get_hid_cid(packet);
                    break;
                case HID_SUBEVENT_SET_PROTOCOL_RESPONSE:
                    event_cid = hid_subevent_set_protocol_response_get_hid_cid(packet);
                    break;
                case HID_SUBEVENT_GET_REPORT_RESPONSE:
                    event_cid = hid_subevent_get_report_response_get_hid_cid(packet);
                    break;
                case HID_SUBEVENT_DESCRIPTOR_AVAILABLE:
                    event_cid = hid_subevent_descriptor_available_get_hid_cid(packet);
                    break;
                case HID_SUBEVENT_REPORT:
                    event_cid = hid_subevent_report_get_hid_cid(packet);
                    break;
                case HID_SUBEVENT_CONNECTION_CLOSED:
                    event_cid = hid_subevent_connection_closed_get_hid_cid(packet);
                    break;
                default:
                    break;
            }
            if (g_ignored_hid_cid != 0 && event_cid == g_ignored_hid_cid) {
                // open_pairing_window() releases the active slot before
                // BTstack finishes tearing down the stale link. Ignore every
                // late event from that exact CID so it cannot repopulate the
                // state belonging to a newer connection. A disconnect issued
                // during SDP can be a no-op because no L2CAP channel exists
                // yet. A successful OPENED therefore arms a retry in poll(),
                // after BTstack has returned from this callback and committed
                // its own final state. Failed OPENED events are finalized by
                // BTstack without a CLOSE; otherwise CLOSE consumes the
                // tombstone. Events for every other CID continue below.
                if (subevent == HID_SUBEVENT_CONNECTION_OPENED) {
                    if (hid_subevent_connection_opened_get_status(packet) == ERROR_CODE_SUCCESS) {
                        arm_ignored_hid_disconnect();
                    } else {
                        clear_ignored_hid_teardown();
                    }
                } else if (subevent == HID_SUBEVENT_CONNECTION_CLOSED) {
                    clear_ignored_hid_teardown();
                }
                break;
            }

            switch (subevent) {
                case HID_SUBEVENT_INCOMING_CONNECTION: {
                    const auto cid = hid_subevent_incoming_connection_get_hid_cid(packet);
                    if (hid_subevent_incoming_connection_get_status(packet) != ERROR_CODE_SUCCESS) break;
                    bd_addr_t address{};
                    hid_subevent_incoming_connection_get_address(packet, address);
                    const bool address_is_remembered = paired_address_known(address);
                    if (reconnect::accepts_incoming_controller(pairing_window_active(), address_is_remembered)) {
                        begin_controller_attempt(address);
                        note_activity();
                        stop_inquiry();
                        record_connection_attempt(address_is_remembered);
                        g_hid_cid = cid;
                        g_connection_pending = true;
                        reset_feature_bootstrap();
                        g_protocol_handshake_pending = false;
                        critical_section_enter_blocking(&g_state_lock);
                        g_snapshot.connection_pending = true;
                        critical_section_exit(&g_state_lock);
                        const auto accept_status = hid_host_accept_connection(cid, HID_PROTOCOL_MODE_REPORT);
                        if (accept_status == ERROR_CODE_SUCCESS) {
                            g_protocol_handshake_pending = true;
                            g_connection_deadline_ms = now_ms() + kConnectionHandshakeTimeoutMs;
                            set_link_state(LinkState::Starting);
                        } else {
                            record_connection_failure(ConnectionError::HidAccept, accept_status);
                            set_connection_closed();
                        }
                    } else {
                        hid_host_decline_connection(cid);
                    }
                    break;
                }

                case HID_SUBEVENT_CONNECTION_OPENED:
                    if (hid_subevent_connection_opened_get_status(packet) == ERROR_CODE_SUCCESS) {
                        note_activity();
                        g_hid_cid = hid_subevent_connection_opened_get_hid_cid(packet);
                        bd_addr_t address{};
                        hid_subevent_connection_opened_get_bd_addr(packet, address);
                        begin_controller_attempt(address);
                        g_connection_deadline_ms = now_ms() + kConnectionHandshakeTimeoutMs;
                        g_connection_pending = false;
                        critical_section_enter_blocking(&g_state_lock);
                        g_snapshot.connection_pending = false;
                        g_snapshot.pairing_window_open = pairing_window_active();
                        g_snapshot.descriptor_available = false;
                        g_snapshot.input_available = false;
                        g_snapshot.state = LinkState::Starting;
                        critical_section_exit(&g_state_lock);
                        clear_output_queue();
                        reset_feature_bootstrap();
                        // A DualSense can remain in its compact BT report
                        // mode after a PS-only reconnect.  Queue the native
                        // state report for poll() once SET_PROTOCOL has
                        // returned, matching the proven DS5Dongle lifecycle
                        // without issuing BTstack writes from this callback.
                        arm_initial_state_output();
                    } else {
                        record_connection_failure(ConnectionError::ConnectionOpen,
                            hid_subevent_connection_opened_get_status(packet));
                        set_connection_closed();
                    }
                    break;

                case HID_SUBEVENT_SET_PROTOCOL_RESPONSE:
                    g_protocol_handshake_pending = false;
                    if (hid_subevent_set_protocol_response_get_handshake_status(packet)
                        != HID_HANDSHAKE_PARAM_TYPE_SUCCESSFUL && g_hid_cid != 0) {
                        record_connection_failure(ConnectionError::ProtocolHandshake,
                            hid_subevent_set_protocol_response_get_handshake_status(packet));
                        // A report-mode handshake failure cannot produce a
                        // valid DualSense stream. Close it and return to the
                        // passive PS-button reconnect path.
                        hid_host_disconnect(g_hid_cid);
                    } else {
                        // Defer feature traffic until BTstack has returned the
                        // control channel to its established state.
                        g_feature_retry_deadline_ms = now_ms() + kFeatureRetryDelayMs;
                    }
                    break;

                case HID_SUBEVENT_DESCRIPTOR_AVAILABLE: {
                    const auto descriptor_status = hid_subevent_descriptor_available_get_status(packet);
                    if (descriptor_status != ERROR_CODE_SUCCESS) {
                        record_connection_failure(ConnectionError::Descriptor,
                            descriptor_status);
                    }
                    critical_section_enter_blocking(&g_state_lock);
                    g_snapshot.descriptor_available = descriptor_status == ERROR_CODE_SUCCESS;
                    critical_section_exit(&g_state_lock);
                    if (descriptor_status == ERROR_CODE_SUCCESS) {
                        bootstrap::begin(g_feature_bootstrap);
                        g_feature_retry_deadline_ms = now_ms();
                    }
                    break;
                }

                case HID_SUBEVENT_GET_REPORT_RESPONSE:
                    handle_feature_response(packet);
                    break;

                case HID_SUBEVENT_REPORT:
                    handle_report(hid_subevent_report_get_report(packet), hid_subevent_report_get_report_len(packet));
                    break;

                case HID_SUBEVENT_CONNECTION_CLOSED:
                    {
                        const auto closed_cid = hid_subevent_connection_closed_get_hid_cid(packet);
                        if (g_hid_cid != 0 && closed_cid != g_hid_cid) break;
                        const auto prior = snapshot();
                        if (!g_connection_failure_recorded
                            && (prior.connection_pending || prior.state == LinkState::Starting)) {
                            record_connection_failure(ConnectionError::Closed);
                        }
                        set_connection_closed();
                    }
                    break;

                default:
                    break;
            }
            break;
        }

        default:
            break;
    }
}

} // namespace

void init() {
    if (g_initialized) return;
    critical_section_init(&g_state_lock);
    g_initialized = true;
    g_snapshot.state = LinkState::Starting;
    g_snapshot.bluetooth_available = false;

    // cyw43_arch_init() installs the Pico SDK's local BTstack TLV/link-key
    // database before this module is initialized. The iterator in
    // load_paired_addresses() therefore uses persistent keys without a
    // second flash-store instance or a collision with MiraLink configuration.
    l2cap_init();
    hid_host_init(g_hid_descriptor_storage, sizeof(g_hid_descriptor_storage));
    hid_host_register_packet_handler(packet_handler);
    g_hci_event_registration.callback = packet_handler;
    hci_add_event_handler(&g_hci_event_registration);
    hci_power_control(HCI_POWER_ON);
}

void apply_config(const Config& config) {
    const auto haptic_gain_q8_8 = static_cast<std::uint16_t>(std::clamp<std::int32_t>(
        static_cast<std::int32_t>(config.haptics_gain * 256.0f), 256, 512));
    if (!g_initialized) {
        g_haptic_gain_q8_8 = haptic_gain_q8_8;
        g_trigger_reduce = config.trigger_reduce;
        g_inactive_minutes = config.inactive_minutes;
        return;
    }
    const bool resume_from_idle = config.inactive_minutes == 0 && g_idle_suspended;
    critical_section_enter_blocking(&g_state_lock);
    g_haptic_gain_q8_8 = haptic_gain_q8_8;
    g_trigger_reduce = config.trigger_reduce;
    g_inactive_minutes = config.inactive_minutes;
    critical_section_exit(&g_state_lock);
    if (resume_from_idle) {
        g_idle_suspended = false;
        note_activity();
        // Configuration commits can arrive while TinyUSB is dispatching a
        // control report. Keep all BTstack controller writes in the
        // foreground poll, just like the HID-close recovery path.
        g_page_scan_rearm_pending = reconnect::should_rearm_after_idle_resume(
            g_hci_working, resume_from_idle);
    }
}

bool open_pairing_window() {
    if (!g_initialized || !g_hci_working) return false;
    note_activity();
    g_pairing_window_deadline_ms = now_ms() + kPairingWindowMs;
    g_pairing_requested = true;
    g_inquiry_retry_deadline_ms = 0;
    clear_candidate();
    gap_connectable_control(1);
    gap_discoverable_control(1);

    // A controller can remain at the HID-descriptor stage after a failed or
    // interrupted reconnect.  That stale CID prevents a new inquiry from
    // starting and makes the pairing window look open while the radio is
    // effectively stuck.  An explicit pairing action is the safe boundary to
    // discard that unvalidated link; a link that already delivered valid
    // input remains connected.
    const auto current = snapshot();
    if (g_hid_cid != 0 && current.state != LinkState::Connected && !current.input_available) {
        const auto stale_cid = g_hid_cid;
        g_ignored_hid_cid = stale_cid;
        hid_host_disconnect(stale_cid);
        arm_ignored_hid_disconnect();
        discard_unvalidated_controller_attempt();
        // The close event will still arrive asynchronously, but releasing the
        // local gate here lets poll() retry inquiry while BTstack completes
        // the teardown instead of waiting forever on a stale CID.
        g_hid_cid = 0;
        g_connection_pending = false;
        g_connection_deadline_ms = 0;
        reset_feature_bootstrap();
        g_protocol_handshake_pending = false;
        clear_output_queue();
        critical_section_enter_blocking(&g_state_lock);
        g_snapshot.connection_pending = false;
        g_snapshot.descriptor_available = false;
        g_snapshot.input_available = false;
        g_snapshot.state = LinkState::PairingWindow;
        critical_section_exit(&g_state_lock);
    }

    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.pairing_window_open = true;
    if (g_snapshot.state != LinkState::Connected) g_snapshot.state = LinkState::PairingWindow;
    critical_section_exit(&g_state_lock);

    // The HID close event clears the CID and starts inquiry.  If there is no
    // stale link, start immediately as before.
    if (g_hid_cid == 0 && !g_connection_pending) start_inquiry();
    return true;
}

bool send_haptic(const std::uint8_t left_motor, const std::uint8_t right_motor, const std::uint16_t duration_ms) {
    if (duration_ms == 0 || duration_ms > kHapticMaxDurationMs) return false;
    const auto haptic_gain_q8_8 = configured_haptic_gain_q8_8();
    dualsense::OutputRequest request{};
    request.haptics = true;
    request.left_motor = static_cast<std::uint8_t>(std::min<std::uint32_t>(255,
        (static_cast<std::uint32_t>(left_motor) * haptic_gain_q8_8 + 128u) / 256u));
    request.right_motor = static_cast<std::uint8_t>(std::min<std::uint32_t>(255,
        (static_cast<std::uint32_t>(right_motor) * haptic_gain_q8_8 + 128u) / 256u));
    if (!queue_output(request)) return false;
    g_haptic_stop_pending = true;
    g_haptic_stop_deadline_ms = now_ms() + duration_ms;
    return true;
}

bool set_lightbar(const std::uint8_t red, const std::uint8_t green, const std::uint8_t blue, const std::uint8_t player_leds_mask) {
    dualsense::OutputRequest request{};
    request.lightbar = true;
    request.lightbar_red = red;
    request.lightbar_green = green;
    request.lightbar_blue = blue;
    request.player_leds = true;
    request.player_leds_mask = static_cast<std::uint8_t>(player_leds_mask & 0x1fu);
    return queue_output(request);
}

bool set_microphone_mute(const bool muted) {
    dualsense::OutputRequest request{};
    request.microphone_mute = true;
    request.microphone_muted = muted;
    return queue_output(request);
}

bool send_controller_output(const std::uint8_t* payload, const std::size_t length) {
    if (payload == nullptr || length != dualsense::kUsbOutputPayloadBytes) return false;
    dualsense::OutputRequest request{};
    request.usb_output = true;
    std::copy(payload, payload + length, request.usb_output_payload.begin());
    dualsense::apply_usb_output_trigger_reduction(request.usb_output_payload, configured_trigger_reduce());
    return queue_output(request);
}

bool send_audio_haptics_report(const std::uint8_t* report, const std::size_t length) {
    if (!static_cast<bool>(dualsense::validate_bluetooth_audio_report(report, length))
        || !output_link_ready()) return false;
    std::array<std::uint8_t, dualsense::kBluetoothAudioReportBytes> packet{};
    std::copy(report, report + length, packet.begin());
    // The audio packet carries the most recent complete controller state so a
    // host output report cannot be undone by a later audio frame.
    std::copy(g_controller_state.begin(), g_controller_state.end(), packet.begin() + 13);
    return enqueue_output_packet(dualsense::kBluetoothAudioReportId,
        packet.data(), length);
}

void poll() {
    if (!g_initialized) return;
    service_ignored_hid_disconnect();
    service_page_scan_rearm();
    service_rssi_measurement();
    // Keep the first Feature GET ahead of the native state packet, matching
    // DS5Dongle's HID-open lifecycle and avoiding two control/interrupt
    // transactions competing during the compact-to-enhanced transition.
    service_feature_bootstrap();
    service_initial_state_output();
    const auto inactive_minutes = configured_inactive_minutes();
    if (!g_idle_suspended && inactive_minutes != 0 && g_hid_cid != 0) {
        const auto current = snapshot();
        const auto inactive_ms = static_cast<std::uint64_t>(inactive_minutes) * 60u * 1000u;
        if (current.state == LinkState::Connected && current.input_available
            && g_last_activity_ms != 0 && now_ms() - g_last_activity_ms >= inactive_ms) {
            // Sleep is local and conservative: close the current HID link and
            // keep waiting for an explicit
            // pairing action or an inbound reconnection from a remembered
            // controller. It never erases pairing keys or configuration.
            g_idle_suspended = true;
            g_haptic_stop_pending = false;
            hid_host_disconnect(g_hid_cid);
            return;
        }
    }
    if (g_idle_suspended) return;
    if (g_pairing_window_deadline_ms != 0 && !pairing_window_active()) {
        g_pairing_window_deadline_ms = 0;
        g_pairing_requested = false;
        clear_candidate();
        stop_inquiry();
        gap_discoverable_control(0);
        critical_section_enter_blocking(&g_state_lock);
        g_snapshot.pairing_window_open = false;
        if (g_snapshot.state == LinkState::PairingWindow) g_snapshot.state = LinkState::Disconnected;
        critical_section_exit(&g_state_lock);
    } else if (pairing_window_active() && !g_connection_pending) {
        start_inquiry();
    }
    if (g_connection_deadline_ms != 0 && now_ms() >= g_connection_deadline_ms) {
        const auto current = snapshot();
        if (!current.input_available && g_hid_cid != 0) {
            // A controller that never completes its descriptor/report
            // handshake must not hold the radio forever. The close event
            // returns the radio to the passive reconnect path.
            g_connection_deadline_ms = 0;
            record_connection_failure(ConnectionError::Timeout);
            hid_host_disconnect(g_hid_cid);
        } else if (current.input_available) {
            g_connection_deadline_ms = 0;
        }
    }
    if (g_haptic_stop_pending && g_haptic_stop_deadline_ms != 0 && now_ms() >= g_haptic_stop_deadline_ms) {
        dualsense::OutputRequest request{};
        request.haptics = true;
        if (queue_output(request)) {
            g_haptic_stop_pending = false;
            g_haptic_stop_deadline_ms = 0;
        }
    }
    try_send_output();
}

Snapshot snapshot() {
    // cyw43_arch_init() can fail before the state lock exists. Preserve a
    // usable USB/diagnostic degraded mode instead of entering an uninitialized
    // critical section.
    if (!g_initialized) return {};
    critical_section_enter_blocking(&g_state_lock);
    Snapshot value = g_snapshot;
    const auto last_audio_packet_ms = g_audio_last_packet_ms;
    critical_section_exit(&g_state_lock);
    if (value.audio_streaming && (last_audio_packet_ms == 0
        || now_ms() - last_audio_packet_ms > kAudioStreamingTimeoutMs)) {
        value.audio_streaming = false;
    }
    return value;
}

} // namespace miralink::bluetooth
