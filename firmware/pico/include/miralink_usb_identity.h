#pragma once

// Development-only identity. A production VID/PID must be assigned before release.
constexpr unsigned short kMiraLinkUsbVendorId = 0xcafe;
constexpr unsigned short kMiraLinkUsbProductId = 0x4d4c;

namespace miralink::usb_identity {

// The Pico unique-board identifier is sensitive device metadata. It is only
// exposed as the USB serial descriptor when the locally persisted setting is
// enabled. A USB reconnect is required before a host observes a change.
void set_unique_serial_enabled(bool enabled);
bool unique_serial_enabled();

} // namespace miralink::usb_identity
