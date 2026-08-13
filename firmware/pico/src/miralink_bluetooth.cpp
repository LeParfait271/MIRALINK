#include "miralink_bluetooth.h"

#include "btstack.h"
#include "btstack_config.h"
#include "pico/stdlib.h"
#include "pico/sync.h"

#include <array>
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace miralink::bluetooth {
namespace {

// Keep enough room for the complete SDP HID descriptor of DualSense
// revisions, including the Edge model, without allowing descriptor data to
// consume the rest of the controller state memory.
constexpr std::size_t kHidDescriptorStorageBytes = 2048;
constexpr std::uint32_t kPairingWindowMs = 300000;
constexpr std::uint8_t kInquiryDuration = 8;
constexpr std::uint8_t kBluetoothHidInputHeader = 0xa1;
constexpr std::uint8_t kDualSenseBluetoothReportId = dualsense::kBluetoothInputReportId;
constexpr std::uint16_t kSonyVendorId = dualsense::kSonyVendorId;
constexpr std::uint16_t kDualSenseProductId = dualsense::kDualSenseProductId;
constexpr std::size_t kMaxRememberedControllers = 4;
constexpr std::uint16_t kHapticMaxDurationMs = 3000;
constexpr std::uint32_t kReconnectDelayMs = 250;
constexpr std::uint32_t kReconnectRetryDelayMs = 2000;
constexpr std::uint32_t kConnectionHandshakeTimeoutMs = 10000;
constexpr std::uint32_t kAudioStreamingTimeoutMs = 250;
constexpr std::uint32_t kInquiryRetryDelayMs = 1000;
constexpr std::uint32_t kOutputFlightGuardMs = 4;

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
std::uint64_t g_pairing_window_deadline_ms = 0;
bool g_initialized = false;
bool g_hci_working = false;
bool g_pairing_requested = false;
bool g_inquiry_active = false;
bool g_connection_pending = false;
std::array<std::array<std::uint8_t, 6>, kMaxRememberedControllers> g_paired_addresses{};
std::size_t g_paired_address_count = 0;
std::size_t g_reconnect_index = 0;
std::uint64_t g_reconnect_deadline_ms = 0;
std::uint64_t g_connection_deadline_ms = 0;
std::uint64_t g_inquiry_retry_deadline_ms = 0;
std::uint64_t g_output_flight_deadline_ms = 0;
bool g_connection_failure_recorded = false;
std::uint16_t g_ignored_hid_cid = 0;
std::array<OutputPacket, 2> g_output_packets{};
int g_output_in_flight = -1;
int g_output_queued = -1;
std::uint8_t g_output_sequence = 0;
bool g_haptic_stop_pending = false;
std::uint64_t g_haptic_stop_deadline_ms = 0;
std::uint64_t g_audio_last_packet_ms = 0;
std::array<std::uint8_t, 63> g_controller_state{};

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
void try_next_paired_controller();
void try_send_output();

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
    return to_ms_since_boot(get_absolute_time());
}

void schedule_reconnect(const std::uint32_t delay_ms, const bool restart_from_first = true) {
    if (g_paired_address_count == 0) {
        g_reconnect_deadline_ms = 0;
        return;
    }
    if (restart_from_first) g_reconnect_index = 0;
    g_reconnect_deadline_ms = now_ms() + delay_ms;
}

bool pairing_window_active() {
    return g_pairing_window_deadline_ms != 0 && now_ms() < g_pairing_window_deadline_ms;
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
    return contains_name(name, length, "dualsense") || contains_name(name, length, "wireless controller");
}

bool inquiry_result_is_dualsense(const std::uint8_t* packet) {
    if (gap_event_inquiry_result_get_device_id_available(packet)) {
        const auto vendor = gap_event_inquiry_result_get_device_id_vendor_id(packet);
        const auto product = gap_event_inquiry_result_get_device_id_product_id(packet);
        if (vendor == kSonyVendorId && (product == kDualSenseProductId || product == dualsense::kDualSenseEdgeProductId)) return true;
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
    g_reconnect_index = 0;

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
    if (!g_pairing_requested || !g_hci_working || g_inquiry_active || g_connection_pending || g_hid_cid != 0) return;
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

bool begin_hid_connection(const bd_addr_t address, const bool reconnect = false) {
    if ((!g_pairing_requested && !paired_address_known(address)) || g_connection_pending) return false;
    stop_inquiry();
    bd_addr_t mutable_address;
    std::memcpy(mutable_address, address, sizeof(mutable_address));
    g_hid_cid = 0;
    record_connection_attempt(reconnect);
    const auto status = hid_host_connect(mutable_address, HID_PROTOCOL_MODE_REPORT, &g_hid_cid);
    if (status != ERROR_CODE_SUCCESS) {
        record_connection_failure(ConnectionError::HidConnect, status);
        clear_candidate();
        if (g_pairing_requested) start_inquiry();
        return false;
    }
    g_reconnect_deadline_ms = 0;
    g_connection_deadline_ms = now_ms() + kConnectionHandshakeTimeoutMs;
    g_connection_pending = true;
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.connection_pending = true;
    g_snapshot.state = LinkState::Starting;
    critical_section_exit(&g_state_lock);
    return true;
}

void try_next_paired_controller() {
    if (!g_hci_working || g_pairing_requested || g_connection_pending || g_hid_cid != 0) return;
    while (g_reconnect_index < g_paired_address_count) {
        bd_addr_t address{};
        std::memcpy(address, g_paired_addresses[g_reconnect_index].data(), sizeof(address));
        ++g_reconnect_index;
        if (begin_hid_connection(address, true)) return;
    }
    // A controller may be powered off temporarily. Retry the complete local
    // key database later instead of exhausting the index permanently.
    g_reconnect_deadline_ms = now_ms() + kReconnectRetryDelayMs;
    g_reconnect_index = 0;
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
    g_output_queued = -1;
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
    critical_section_enter_blocking(&g_state_lock);
    const bool ready = g_hid_cid != 0 && g_snapshot.descriptor_available
        && g_snapshot.state == LinkState::Connected;
    critical_section_exit(&g_state_lock);
    return ready;
}

int output_free_slot() {
    for (std::size_t index = 0; index < g_output_packets.size(); ++index) {
        if (static_cast<int>(index) != g_output_in_flight && static_cast<int>(index) != g_output_queued) {
            return static_cast<int>(index);
        }
    }
    return -1;
}

bool queue_output(const dualsense::OutputRequest& request) {
    if (!output_link_ready() || g_output_queued >= 0) return false;
    const auto slot = output_free_slot();
    if (slot < 0) return false;
    g_output_packets[slot].bytes.fill(0);
    const auto report = dualsense::build_bluetooth_output_report(request, g_output_sequence++ & 0x0fu);
    std::copy(report.begin(), report.end(), g_output_packets[slot].bytes.begin());
    g_output_packets[slot].report_id = dualsense::kBluetoothOutputReportId;
    g_output_packets[slot].length = report.size();
    g_output_packets[slot].occupied = true;
    g_output_queued = slot;
    if (request.usb_output) {
        std::copy(request.usb_output_payload.begin(), request.usb_output_payload.end(), g_controller_state.begin());
    }
    if (request.haptics || request.lightbar || request.player_leds || request.microphone_mute) {
        std::copy(report.begin() + 3, report.begin() + 3 + g_controller_state.size(), g_controller_state.begin());
    }
    try_send_output();
    return true;
}

void try_send_output() {
    if (g_output_queued < 0 || !output_link_ready()) return;

    // BTstack exposes no completion event for an interrupt output report.
    // Keep one accepted packet protected for a short bounded interval so a
    // fast audio poll or a second command cannot overwrite BTstack's pending
    // report before its CAN_SEND_NOW callback has consumed it.
    if (g_output_in_flight >= 0) {
        if (now_ms() < g_output_flight_deadline_ms) return;
        g_output_packets[g_output_in_flight].occupied = false;
        g_output_in_flight = -1;
        g_output_flight_deadline_ms = 0;
    }

    const auto slot = g_output_queued;
    const auto status = hid_host_send_report(g_hid_cid, g_output_packets[slot].report_id,
        g_output_packets[slot].bytes.data() + 1,
        static_cast<std::uint16_t>(g_output_packets[slot].length - 1));
    if (status != ERROR_CODE_SUCCESS) return;

    if (g_output_in_flight >= 0) {
        g_output_packets[g_output_in_flight].occupied = false;
    }
    g_output_in_flight = slot;
    g_output_queued = -1;
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
    g_connection_pending = false;
    g_reconnect_deadline_ms = 0;
    g_connection_deadline_ms = 0;
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
    if (pairing_window_active()) start_inquiry();
    else schedule_reconnect(kReconnectDelayMs, false);
}

void handle_report(const std::uint8_t* report, const std::uint16_t length) {
    if (report == nullptr || length == 0) return;

    const std::uint8_t report_id = report[0] == kBluetoothHidInputHeader && length > 1 ? report[1] : report[0];
    if (report_id != kDualSenseBluetoothReportId) return;

    const auto parsed = dualsense::parse_bluetooth_input_report(report, length);
    critical_section_enter_blocking(&g_state_lock);
    if (parsed) {
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
    try_send_output();
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
                g_pairing_window_deadline_ms = 0;
                g_pairing_requested = false;
                g_reconnect_deadline_ms = 0;
                g_connection_deadline_ms = 0;
                g_inquiry_retry_deadline_ms = 0;
                clear_candidate();
                gap_connectable_control(1);
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
                schedule_reconnect(kReconnectDelayMs);
            } else if (btstack_event_state_get_state(packet) == HCI_STATE_OFF) {
                g_hci_working = false;
                g_pairing_window_deadline_ms = 0;
                g_pairing_requested = false;
                g_connection_pending = false;
                g_hid_cid = 0;
                g_ignored_hid_cid = 0;
                g_reconnect_deadline_ms = 0;
                g_connection_deadline_ms = 0;
                g_inquiry_retry_deadline_ms = 0;
                clear_output_queue();
                clear_candidate();
                critical_section_enter_blocking(&g_state_lock);
                g_snapshot.bluetooth_available = false;
                g_snapshot.pairing_window_open = false;
                g_snapshot.inquiry_active = false;
                g_snapshot.connection_pending = false;
                g_snapshot.state = LinkState::Unavailable;
                critical_section_exit(&g_state_lock);
            }
            break;

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

        case HCI_EVENT_HID_META:
            switch (hci_event_hid_meta_get_subevent_code(packet)) {
                case HID_SUBEVENT_INCOMING_CONNECTION: {
                    const auto cid = hid_subevent_incoming_connection_get_hid_cid(packet);
                    if (hid_subevent_incoming_connection_get_status(packet) != ERROR_CODE_SUCCESS) break;
                    bd_addr_t address{};
                    hid_subevent_incoming_connection_get_address(packet, address);
                    if (pairing_window_active() || paired_address_known(address)) {
                        stop_inquiry();
                        record_connection_attempt(false);
                        g_hid_cid = cid;
                        g_connection_pending = true;
                        critical_section_enter_blocking(&g_state_lock);
                        g_snapshot.connection_pending = true;
                        critical_section_exit(&g_state_lock);
                        remember_paired_address(address);
                        const auto accept_status = hid_host_accept_connection(cid, HID_PROTOCOL_MODE_REPORT);
                        if (accept_status == ERROR_CODE_SUCCESS) {
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
                        g_hid_cid = hid_subevent_connection_opened_get_hid_cid(packet);
                        bd_addr_t address{};
                        hid_subevent_connection_opened_get_bd_addr(packet, address);
                        remember_paired_address(address);
                        g_reconnect_deadline_ms = 0;
                        g_connection_deadline_ms = now_ms() + kConnectionHandshakeTimeoutMs;
                        g_reconnect_index = 0;
                        g_connection_pending = false;
                        critical_section_enter_blocking(&g_state_lock);
                        g_snapshot.connection_pending = false;
                        g_snapshot.pairing_window_open = pairing_window_active();
                        g_snapshot.descriptor_available = false;
                        g_snapshot.input_available = false;
                        g_snapshot.state = LinkState::Starting;
                        critical_section_exit(&g_state_lock);
                        clear_output_queue();
                    } else {
                        record_connection_failure(ConnectionError::ConnectionOpen,
                            hid_subevent_connection_opened_get_status(packet));
                        set_connection_closed();
                    }
                    break;

                case HID_SUBEVENT_SET_PROTOCOL_RESPONSE:
                    if (hid_subevent_set_protocol_response_get_handshake_status(packet)
                        != HID_HANDSHAKE_PARAM_TYPE_SUCCESSFUL && g_hid_cid != 0) {
                        record_connection_failure(ConnectionError::ProtocolHandshake,
                            hid_subevent_set_protocol_response_get_handshake_status(packet));
                        // A report-mode handshake failure cannot produce a
                        // valid DualSense stream. Close it and let the normal
                        // bounded reconnect path try again.
                        hid_host_disconnect(g_hid_cid);
                    }
                    break;

                case HID_SUBEVENT_DESCRIPTOR_AVAILABLE:
                    if (hid_subevent_descriptor_available_get_status(packet) != ERROR_CODE_SUCCESS) {
                        record_connection_failure(ConnectionError::Descriptor,
                            hid_subevent_descriptor_available_get_status(packet));
                    }
                    critical_section_enter_blocking(&g_state_lock);
                    g_snapshot.descriptor_available = hid_subevent_descriptor_available_get_status(packet) == ERROR_CODE_SUCCESS;
                    critical_section_exit(&g_state_lock);
                    try_send_output();
                    break;

                case HID_SUBEVENT_REPORT:
                    handle_report(hid_subevent_report_get_report(packet), hid_subevent_report_get_report_len(packet));
                    break;

                case HID_SUBEVENT_CONNECTION_CLOSED:
                    {
                        const auto closed_cid = hid_subevent_connection_closed_get_hid_cid(packet);
                        if (closed_cid == g_ignored_hid_cid) {
                            g_ignored_hid_cid = 0;
                            break;
                        }
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

bool open_pairing_window() {
    if (!g_initialized || !g_hci_working) return false;
    g_pairing_window_deadline_ms = now_ms() + kPairingWindowMs;
    g_pairing_requested = true;
    g_reconnect_deadline_ms = 0;
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
        // The close event will still arrive asynchronously, but releasing the
        // local gate here lets poll() retry inquiry while BTstack completes
        // the teardown instead of waiting forever on a stale CID.
        g_hid_cid = 0;
        g_connection_pending = false;
        g_connection_deadline_ms = 0;
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
    dualsense::OutputRequest request{};
    request.haptics = true;
    request.left_motor = left_motor;
    request.right_motor = right_motor;
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
    return queue_output(request);
}

bool send_audio_haptics_report(const std::uint8_t* report, const std::size_t length) {
    if (!static_cast<bool>(dualsense::validate_bluetooth_audio_report(report, length))
        || !output_link_ready() || g_output_queued >= 0) return false;
    const auto slot = output_free_slot();
    if (slot < 0) return false;
    g_output_packets[slot].bytes.fill(0);
    std::copy(report, report + length, g_output_packets[slot].bytes.begin());
    // The audio packet carries the most recent complete controller state so a
    // host output report cannot be undone by a later audio frame.
    std::copy(g_controller_state.begin(), g_controller_state.end(), g_output_packets[slot].bytes.begin() + 13);
    g_output_packets[slot].report_id = dualsense::kBluetoothAudioReportId;
    g_output_packets[slot].length = length;
    g_output_packets[slot].occupied = true;
    g_output_queued = slot;
    try_send_output();
    return g_output_queued != slot;
}

void poll() {
    if (!g_initialized) return;
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
    } else if (!pairing_window_active() && g_reconnect_deadline_ms != 0
        && now_ms() >= g_reconnect_deadline_ms && !g_connection_pending && g_hid_cid == 0) {
        g_reconnect_deadline_ms = 0;
        try_next_paired_controller();
    }
    if (g_connection_deadline_ms != 0 && now_ms() >= g_connection_deadline_ms) {
        const auto current = snapshot();
        if (!current.input_available && g_hid_cid != 0) {
            // A controller that never completes its descriptor/report
            // handshake must not hold the radio forever. The close event
            // drives the same bounded reconnect path as a real disconnect.
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
