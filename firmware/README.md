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

Firmware 0.40 keeps the one-root experimental DualSense-family USB persona and
the bounded asynchronous Feature bootstrap introduced in 0.38 (`0x05` → `0x09` → `0x20`)
after the Bluetooth HID descriptor is accepted. A minimal `0x01` report counts
only as link liveness. Only a complete, strictly validated enhanced `0x31`
report can mark the controller connected and make a new Bluetooth address
trusted. A remembered controller now reconnects passively: automatic
remembered-key `hid_host_connect` calls no longer reserve BTstack's only HID
host slot, while outgoing connects remain available only during an active
pairing inquiry. The first such window opens automatically when no key exists;
later windows require a user request. Page scan is configured only after `HCI_STATE_WORKING`, connectability
is rearmed after close, and the pairing window closes on the first CRC-valid
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
until a physical Pico 2 W validation is complete. Version `0.40` retains the
`0.39` rule that prevents configuration commits from implicitly disconnecting
USB, reports a separate
re-enumeration requirement in the commit acknowledgement, and lets pairing
discovery accept supported standard and Edge controllers independently of the
selected USB persona. Response Feature report `0x71` remains readable until
the next MiraLink command report produces a success or error response, enabling bounded receive retries without
resending a command. These reconnect and transport changes are compiled
software candidates; their build does not replace a new physical Pico 2 W /
controller test.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
