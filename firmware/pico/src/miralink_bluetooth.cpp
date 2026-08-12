#include "miralink_bluetooth.h"

#include "btstack.h"
#include "btstack_config.h"
#include "pico/stdlib.h"
#include "pico/sync.h"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace miralink::bluetooth {
namespace {

constexpr std::size_t kHidDescriptorStorageBytes = 512;
constexpr std::uint32_t kPairingWindowMs = 300000;
constexpr std::uint8_t kInquiryDuration = 8;
constexpr std::uint8_t kBluetoothHidInputHeader = 0xa1;
constexpr std::uint8_t kDualSenseBluetoothReportId = dualsense::kBluetoothInputReportId;
constexpr std::uint16_t kSonyVendorId = dualsense::kSonyVendorId;
constexpr std::uint16_t kDualSenseProductId = dualsense::kDualSenseProductId;
constexpr std::uint16_t kDualSenseEdgeProductId = 0x0df2;

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

struct InquiryCandidate {
    bd_addr_t address{};
    std::uint8_t page_scan_repetition_mode = 0;
    std::uint16_t clock_offset = 0;
    bool valid = false;
    bool name_requested = false;
};

InquiryCandidate g_candidate{};

std::uint64_t now_ms() {
    return to_ms_since_boot(get_absolute_time());
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
        if (vendor == kSonyVendorId && (product == kDualSenseProductId || product == kDualSenseEdgeProductId)) return true;
        if (vendor != 0 || product != 0) return false;
    }
    if (!gap_event_inquiry_result_get_name_available(packet)) return false;
    return name_is_dualsense(gap_event_inquiry_result_get_name(packet), gap_event_inquiry_result_get_name_len(packet));
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

void start_inquiry() {
    if (!g_pairing_requested || !g_hci_working || g_inquiry_active || g_connection_pending || g_hid_cid != 0) return;
    if (gap_inquiry_start(kInquiryDuration) == ERROR_CODE_SUCCESS) set_inquiry_snapshot(true);
}

void stop_inquiry() {
    if (g_inquiry_active) gap_inquiry_stop();
    set_inquiry_snapshot(false);
}

void begin_hid_connection(const bd_addr_t address) {
    if (!g_pairing_requested || g_connection_pending) return;
    stop_inquiry();
    bd_addr_t mutable_address;
    std::memcpy(mutable_address, address, sizeof(mutable_address));
    const auto status = hid_host_connect(mutable_address, HID_PROTOCOL_MODE_REPORT, &g_hid_cid);
    if (status != ERROR_CODE_SUCCESS) {
        clear_candidate();
        start_inquiry();
        return;
    }
    g_connection_pending = true;
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.connection_pending = true;
    g_snapshot.state = LinkState::Starting;
    critical_section_exit(&g_state_lock);
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

void set_connection_closed() {
    g_connection_pending = false;
    critical_section_enter_blocking(&g_state_lock);
    g_hid_cid = 0;
    g_snapshot.connection_pending = false;
    g_snapshot.descriptor_available = false;
    g_snapshot.input_available = false;
    g_snapshot.pairing_window_open = pairing_window_active();
    g_snapshot.state = pairing_window_active() ? LinkState::PairingWindow : LinkState::Disconnected;
    critical_section_exit(&g_state_lock);
    clear_candidate();
    start_inquiry();
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
    } else {
        g_snapshot.rejected_report_count += 1;
    }
    critical_section_exit(&g_state_lock);
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
                clear_candidate();
                gap_connectable_control(1);
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
            } else if (btstack_event_state_get_state(packet) == HCI_STATE_OFF) {
                g_hci_working = false;
                g_pairing_window_deadline_ms = 0;
                g_pairing_requested = false;
                g_connection_pending = false;
                g_hid_cid = 0;
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
            gap_pin_code_negative(address);
            break;
        }

        case HCI_EVENT_USER_CONFIRMATION_REQUEST: {
            bd_addr_t address;
            hci_event_user_confirmation_request_get_bd_addr(packet, address);
            if (pairing_window_active()) {
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
                    if (pairing_window_active()) {
                        stop_inquiry();
                        g_hid_cid = cid;
                        g_connection_pending = true;
                        critical_section_enter_blocking(&g_state_lock);
                        g_snapshot.connection_pending = true;
                        critical_section_exit(&g_state_lock);
                        hid_host_accept_connection(cid, HID_PROTOCOL_MODE_REPORT);
                        set_link_state(LinkState::Starting);
                    } else {
                        hid_host_decline_connection(cid);
                    }
                    break;
                }

                case HID_SUBEVENT_CONNECTION_OPENED:
                    if (hid_subevent_connection_opened_get_status(packet) == ERROR_CODE_SUCCESS) {
                        g_hid_cid = hid_subevent_connection_opened_get_hid_cid(packet);
                        g_connection_pending = false;
                        critical_section_enter_blocking(&g_state_lock);
                        g_snapshot.connection_pending = false;
                        g_snapshot.pairing_window_open = pairing_window_active();
                        g_snapshot.descriptor_available = false;
                        g_snapshot.input_available = false;
                        g_snapshot.state = LinkState::Starting;
                        critical_section_exit(&g_state_lock);
                    } else {
                        set_connection_closed();
                    }
                    break;

                case HID_SUBEVENT_DESCRIPTOR_AVAILABLE:
                    critical_section_enter_blocking(&g_state_lock);
                    g_snapshot.descriptor_available = hid_subevent_descriptor_available_get_status(packet) == ERROR_CODE_SUCCESS;
                    critical_section_exit(&g_state_lock);
                    break;

                case HID_SUBEVENT_REPORT:
                    handle_report(hid_subevent_report_get_report(packet), hid_subevent_report_get_report_len(packet));
                    break;

                case HID_SUBEVENT_CONNECTION_CLOSED:
                    set_connection_closed();
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
    clear_candidate();
    gap_connectable_control(1);
    gap_discoverable_control(1);
    critical_section_enter_blocking(&g_state_lock);
    g_snapshot.pairing_window_open = true;
    if (g_snapshot.state != LinkState::Connected) g_snapshot.state = LinkState::PairingWindow;
    critical_section_exit(&g_state_lock);
    start_inquiry();
    return true;
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
    }
}

Snapshot snapshot() {
    critical_section_enter_blocking(&g_state_lock);
    const Snapshot value = g_snapshot;
    critical_section_exit(&g_state_lock);
    return value;
}

} // namespace miralink::bluetooth
