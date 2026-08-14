#pragma once

#include <cstddef>
#include <cstdint>

namespace miralink::usb_identity {

// Bridge mode deliberately presents the controller-facing interface as a
// DualSense family device. Auto resolves to the standard DualSense persona;
// an Edge-only configuration selects the Edge PID before TinyUSB starts.
constexpr std::uint16_t kSonyVendorId = 0x054c;
constexpr std::uint16_t kDualSenseProductId = 0x0ce6;
constexpr std::uint16_t kDualSenseEdgeProductId = 0x0df2;
constexpr std::uint8_t kControllerModeStandard = 0;
constexpr std::uint8_t kControllerModeEdge = 1;
constexpr std::uint8_t kControllerModeAuto = 2;

// Auto and unknown values deliberately resolve to the broadly compatible
// standard persona. Keep this mapping pure so descriptor selection and the
// decision to re-enumerate can never drift apart.
constexpr std::uint16_t product_id_for_mode(const std::uint8_t mode) {
    return mode == kControllerModeEdge
        ? kDualSenseEdgeProductId
        : kDualSenseProductId;
}

constexpr bool requires_reenumeration(const std::uint8_t previous_mode,
    const bool previous_unique_serial_enabled, const std::uint8_t next_mode,
    const bool next_unique_serial_enabled) {
    return product_id_for_mode(previous_mode) != product_id_for_mode(next_mode)
        || previous_unique_serial_enabled != next_unique_serial_enabled;
}
// One root Gamepad collection and its nested vendor-management collection
// intentionally share one HID interface. Windows creates a child per top-level
// collection, while hid-playstation matches the Sony VID/PID per interface;
// both operating systems therefore require this single-root topology.
constexpr std::uint8_t kHidInstance = 0;
constexpr std::uint8_t kBridgeHidInstance = kHidInstance;
constexpr std::uint8_t kControlHidInstance = kHidInstance;
constexpr std::uint8_t kControlReportCommand = 0x70;
constexpr std::uint8_t kControlReportResponse = 0x71;
// Reserved for a future non-Sony transport. The Sony persona deliberately
// does not emit this asynchronous report because native gamepad traffic owns
// the interrupt IN endpoint; the app polls state through Feature reports.
constexpr std::uint8_t kControlReportEvent = 0x72;
constexpr std::uint8_t kCalibrationFeatureReport = 0x05;
constexpr std::uint8_t kPairingFeatureReport = 0x09;
constexpr std::uint8_t kFirmwareFeatureReport = 0x20;

void set_controller_mode(std::uint8_t mode);

// The Pico unique-board identifier is sensitive device metadata. It is only
// exposed as the USB serial descriptor when the locally persisted setting is
// enabled. A USB reconnect is required before a host observes a change.
void set_unique_serial_enabled(bool enabled);
bool unique_serial_enabled();

// TinyUSB supplies the report ID separately and prefixes it on the wire.
// This function therefore writes only the Feature payload.
std::size_t copy_bridge_feature_report(
    std::uint8_t report_id, std::uint8_t* buffer, std::size_t capacity);

} // namespace miralink::usb_identity
