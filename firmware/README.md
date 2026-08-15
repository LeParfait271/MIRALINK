# MiraLink firmware core

This directory contains the new MiraLink firmware core and the first compiled
Pico 2 W hardware target. Protocol framing, configuration validation and the
two-slot flash store are independent of the board layer; the `pico/` target
connects them to USB HID and Pico flash operations without importing any
previous firmware source.

The manual Windows test of firmware 0.38 showed one bridge-owned controller and
working buttons/sticks in `joy.cpl`. The later 0.39 run showed initial bridge
pairing, a live quick-test input sample, Controller Lab, diagnostics and
configuration read. After the controller was turned off, however, it did not
reconnect from the remembered key and had to be paired again. No Bluetooth
packet capture was made, and motion, touch, outputs, wake and audio were not
exercised.

Firmware 0.51 keeps the one-root experimental DualSense-family USB persona and
the bounded asynchronous Feature bootstrap introduced in 0.38 (`0x05` → `0x09` → `0x20`)
after the Bluetooth HID descriptor is accepted. A minimal `0x01` report counts
only as link liveness. Only a complete, strictly validated enhanced `0x31`
report can mark the controller connected and trust it for input. Bluetooth
authentication establishes the remembered bond independently, so a
bootstrap failure does not force a web re-pair. A remembered controller now
reconnects passively: automatic
remembered-key `hid_host_connect` calls no longer reserve BTstack's only HID
host slot, while outgoing connects remain available only during an active
pairing inquiry. The first such window opens automatically when no key exists;
later windows require a user request. Page scan is configured only after
`HCI_STATE_WORKING`, connectability is rearmed after
`HCI_EVENT_DISCONNECTION_COMPLETE` from the foreground poll, and the pairing window closes on the first CRC-valid
enhanced input. The compiled candidate also keeps CYW43/BTstack work in the explicit
polling path and serializes the relevant output/BTstack calls at build time.
Configuration erase/program now uses the Pico SDK flash-safe executor, all
deadlines use the 64-bit boot clock, and failed radio startup leaves USB
diagnostics available without accessing an uninitialized lock. These changes retain the safe
runtime wiring for persisted settings and automatic first-pair Bluetooth:
speaker/headset volume, bounded speaker gain, trigger-effect reduction,
optional unique USB serial exposure, conservative local inactivity suspension
and a disabled-by-default external status GPIO. It retains the local Bluetooth
inquiry/connection path for DualSense input, bounded diagnostics, local RAM
logs, USB reconnection, confirmation-token recovery, native-size DualSense
input/output bridging and opt-in USB remote wake. The UAC2 audio source
remains in the firmware tree but is disabled from the active USB descriptor
until a physical Pico 2 W validation is complete. Version `0.51` retains the
`0.39` rule that prevents configuration commits from implicitly disconnecting
USB, reports a separate
re-enumeration requirement in the commit acknowledgement, and lets pairing
discovery accept supported standard and Edge controllers independently of the
selected USB persona. Response Feature report `0x71` remains readable until
the next MiraLink command report produces a success or error response, enabling bounded receive retries without
resending a command. The manual `0.40` run confirmed the bridge and radio
transport after a Pico restart but showed the known controller still offline.
Source inspection found that BTstack's cached connectable flag can suppress the
page-scan rearm after a link close. The `0.41` candidate deferred that rearm to
the foreground poll and forced a fresh page-scan enable transition. The `0.42`
candidate also routes idle-resume recovery through that foreground path instead
of calling BTstack from the USB configuration callback. The `0.46` candidate
uses the official DS5Dongle `v0.7.2-hotfix` lifecycle boundary as the mandatory
diagnostic comparator and waits for `HCI_EVENT_DISCONNECTION_COMPLETE` before
requesting the same foreground rearm. Version `0.48` additionally restores the
discoverable radio state for a bonded PS-only reconnect, matching DS5Dongle's
post-disconnection lifecycle. It tracks the active ACL handle and drops only a
stale remembered key after a correlated authentication failure, before a valid
enhanced input report. This remains a
software candidate until a new physical Pico 2 W / controller test.

Firmware 0.51 adds an immediate HCI-disconnection radio re-arm and a neutral
CRC-protected native Bluetooth state report (`0x32`) after `SET_PROTOCOL`.
These changes are clean-room behavior aligned with the DS5Dongle reference;
they are not yet hardware-validated.

The Bluetooth output path now uses a fixed four-packet FIFO (one packet in
flight plus three queued packets), preserving haptic, lightbar, trigger and
audio-output order until BTstack accepts each report. The queue uses static
storage only and remains bounded under a busy host.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
