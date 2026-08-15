#pragma once

#include <cstddef>
#include <cstdint>

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

// DS5Dongle accepts an incoming gamepad ACL first and lets the authenticated
// HID lifecycle establish whether it is a usable controller. A remembered
// address is the normal path, but an active ACL must also be admitted while
// authentication/descriptor events are still in flight; gating this event on
// the rebuilt RAM address cache can reject a valid bond after reboot.
constexpr bool accepts_incoming_controller(const bool pairing_window_active,
    const bool address_is_remembered, const bool acl_link_present) {
    return pairing_window_active || address_is_remembered || acl_link_present;
}

constexpr bool should_rearm_page_scan(const bool hci_working,
    const bool idle_suspended, const bool hid_link_active) {
    return hci_working && !idle_suspended && !hid_link_active;
}

constexpr bool should_rearm_after_idle_resume(const bool hci_working,
    const bool resume_from_idle) {
    return hci_working && resume_from_idle;
}

// DS5Dongle re-enables its page-scannable state when the controller's ACL
// teardown is complete. MiraLink keeps the actual BTstack writes in the
// foreground poll, but the HCI event is the authoritative trigger.
constexpr bool should_rearm_after_hci_disconnection(const bool hci_working,
    const bool idle_suspended) {
    return hci_working && !idle_suspended;
}

// DS5Dongle restores discoverability together with connectability at the ACL
// teardown boundary.  DualSense PS-only reconnects have been observed to
// require that complete radio state even when the address is already bonded.
constexpr bool should_restore_discoverable(const bool hci_working,
    const bool idle_suspended) {
    return hci_working && !idle_suspended;
}

// A completed ACL teardown is authoritative even if HID host is still
// finishing SDP/L2CAP bookkeeping. The foreground can retire the stale host
// slot before rearming passive page scan.
constexpr bool should_recover_after_hci_disconnection(const bool hci_working,
    const bool idle_suspended, const bool hid_link_active) {
    return hci_working && !idle_suspended && hid_link_active;
}

// An ACL page attempt can fail before BTstack emits any HID-host event. The
// caller must release its pending attempt and return to page-scan/inquiry;
// otherwise the single HID-host slot remains logically busy until timeout.
constexpr bool should_recover_after_acl_failure(const bool hci_working,
    const bool idle_suspended, const bool connection_pending) {
    return hci_working && !idle_suspended && connection_pending;
}

// HCI_EVENT_DISCONNECTION_COMPLETE is emitted for every ACL link handled by
// the controller.  Only the handle belonging to MiraLink's active DualSense
// may tear down its HID state; an unrelated Bluetooth device must be ignored.
// If BTstack delivered the event before the ACL handle was recorded, an active
// HID/pending link is the conservative fallback and is still eligible for
// recovery.  With no active link, an unknown handle is never actionable.
constexpr bool matches_active_acl_disconnection(const bool acl_handle_valid,
    const std::uint16_t active_acl_handle,
    const std::uint16_t disconnected_acl_handle,
    const bool hid_link_active) {
    if (acl_handle_valid) return active_acl_handle == disconnected_acl_handle;
    return hid_link_active;
}

// DS5Dongle drops a remembered link key after a controller-authentication
// failure. MiraLink applies that recovery only when the HCI handle is the
// active controller, the address was already remembered before this attempt,
// and no valid enhanced input has crossed the trust boundary yet. A transient
// failure for a brand-new pairing must not erase anything else.
constexpr bool should_drop_key_after_auth_failure(const bool handle_matches,
    const bool address_known_before_attempt, const bool input_validated) {
    return handle_matches && address_known_before_attempt && !input_validated;
}

// A link key is a bond credential, not an input-validation token.  Keep a
// newly authenticated address even when HID descriptor/bootstrap traffic is
// interrupted; input remains gated separately until a CRC-valid enhanced
// report is received.  The third argument preserves the defensive behavior
// for a controller that managed to send valid input before the auth event was
// observed by the application.
constexpr bool should_drop_unvalidated_key(const bool address_known_before_attempt,
    const bool link_authenticated, const bool input_validated) {
    return !address_known_before_attempt && !link_authenticated && !input_validated;
}

constexpr bool completes_pairing_window(const bool pairing_window_active,
    const bool first_valid_enhanced_input) {
    return pairing_window_active && first_valid_enhanced_input;
}

static_assert(!allows_outgoing_hid_connect(RadioAction::PassiveReconnect));
static_assert(accepts_incoming_controller(false, true, false));
static_assert(accepts_incoming_controller(true, false, false));
static_assert(accepts_incoming_controller(false, false, true));
static_assert(!accepts_incoming_controller(false, false, false));
static_assert(should_rearm_after_hci_disconnection(true, false));
static_assert(!should_rearm_after_hci_disconnection(false, false));
static_assert(!should_rearm_after_hci_disconnection(true, true));
static_assert(should_restore_discoverable(true, false));
static_assert(!should_restore_discoverable(false, false));
static_assert(!should_restore_discoverable(true, true));
static_assert(should_recover_after_hci_disconnection(true, false, true));
static_assert(!should_recover_after_hci_disconnection(true, false, false));
static_assert(!should_recover_after_hci_disconnection(true, true, true));
static_assert(should_recover_after_acl_failure(true, false, true));
static_assert(!should_recover_after_acl_failure(true, false, false));
static_assert(!should_recover_after_acl_failure(true, true, true));
static_assert(matches_active_acl_disconnection(true, 0x0042, 0x0042, true));
static_assert(!matches_active_acl_disconnection(true, 0x0042, 0x0043, true));
static_assert(matches_active_acl_disconnection(false, 0xffff, 0x0043, true));
static_assert(!matches_active_acl_disconnection(false, 0xffff, 0x0043, false));
static_assert(should_drop_key_after_auth_failure(true, true, false));
static_assert(!should_drop_key_after_auth_failure(false, true, false));
static_assert(!should_drop_key_after_auth_failure(true, false, false));
static_assert(!should_drop_key_after_auth_failure(true, true, true));
static_assert(should_drop_unvalidated_key(false, false, false));
static_assert(!should_drop_unvalidated_key(true, false, false));
static_assert(!should_drop_unvalidated_key(false, true, false));
static_assert(!should_drop_unvalidated_key(false, false, true));

} // namespace miralink::bluetooth::reconnect
