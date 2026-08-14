#pragma once

#include <cstddef>

namespace miralink::bluetooth::reconnect {

// A remembered DualSense reconnects by paging the Pico and opening the HID
// control/interrupt services itself when the PS button is pressed. Reserving
// BTstack's single HID-host slot with an outgoing SDP query would make that
// incoming connection lose the race, so outgoing HID connects are restricted
// to controllers found during an explicit pairing inquiry.
enum class RadioAction {
    None,
    ExplicitPairingInquiry,
    PassiveReconnect
};

constexpr RadioAction radio_action(const bool hci_working,
    const bool pairing_window_active,
    const std::size_t remembered_controller_count) {
    if (!hci_working) return RadioAction::None;
    if (pairing_window_active) return RadioAction::ExplicitPairingInquiry;
    if (remembered_controller_count != 0) return RadioAction::PassiveReconnect;
    return RadioAction::None;
}

constexpr bool allows_outgoing_hid_connect(const RadioAction action) {
    return action == RadioAction::ExplicitPairingInquiry;
}

constexpr bool accepts_incoming_controller(const bool pairing_window_active,
    const bool address_is_remembered) {
    return pairing_window_active || address_is_remembered;
}

constexpr bool should_rearm_page_scan(const bool hci_working,
    const bool idle_suspended, const bool hid_link_active) {
    return hci_working && !idle_suspended && !hid_link_active;
}

constexpr bool should_rearm_after_idle_resume(const bool hci_working,
    const bool resume_from_idle) {
    return hci_working && resume_from_idle;
}

constexpr bool completes_pairing_window(const bool pairing_window_active,
    const bool first_valid_enhanced_input) {
    return pairing_window_active && first_valid_enhanced_input;
}

static_assert(!allows_outgoing_hid_connect(RadioAction::PassiveReconnect));
static_assert(accepts_incoming_controller(false, true));
static_assert(!accepts_incoming_controller(false, false));

} // namespace miralink::bluetooth::reconnect
