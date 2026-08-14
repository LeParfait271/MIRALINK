# MiraLink firmware core

This directory contains the new MiraLink firmware core and the first compiled
Pico 2 W hardware target. Protocol framing, configuration validation and the
two-slot flash store are independent of the board layer; the `pico/` target
connects them to USB HID and Pico flash operations without importing any
previous firmware source.

The manual Windows test of firmware 0.38 showed exactly one controller child,
an active enhanced Bluetooth input stream, and working buttons/sticks in
`joy.cpl`. No Bluetooth packet capture was made, and motion, touch, outputs,
wake and audio were not exercised.

Firmware 0.39 keeps the one-root experimental DualSense-family USB persona and
the bounded asynchronous Feature bootstrap introduced in 0.38 (`0x05` → `0x09` → `0x20`)
after the Bluetooth HID descriptor is accepted. A minimal `0x01` report counts
only as link liveness. Only a complete, strictly validated enhanced `0x31`
report can mark the controller connected and make a new Bluetooth address
trusted. The compiled candidate also keeps CYW43/BTstack work in the explicit
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
until a physical Pico 2 W validation is complete. Version `0.39` prevents
configuration commits from implicitly disconnecting USB, reports a separate
re-enumeration requirement in the commit acknowledgement, and lets pairing
discovery accept supported standard and Edge controllers independently of the
selected USB persona. These recovery changes are compiled software candidates;
their build does not replace a new physical Pico 2 W/controller test.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
