# MiraLink firmware core

This directory contains the new MiraLink firmware core and the first compiled
Pico 2 W hardware target. Protocol framing, configuration validation and the
two-slot flash store are independent of the board layer; the `pico/` target
connects them to USB HID and Pico flash operations without importing any
previous firmware source.

Firmware 0.36 adds an experimental DualSense-family USB persona to the safe
runtime wiring for persisted settings and automatic first-pair Bluetooth:
speaker/headset volume, bounded speaker gain, trigger-effect reduction,
optional unique USB serial exposure, conservative local inactivity suspension
and a disabled-by-default external status GPIO. It retains the local Bluetooth
inquiry/connection path for DualSense input, bounded diagnostics, local RAM
logs, USB reconnection, confirmation-token recovery, native-size DualSense
input/output bridging and opt-in USB remote wake. The UAC2 audio source
remains in the firmware tree but is disabled from the active USB descriptor
until a physical Pico 2 W validation is complete. These paths remain
subject to physical Pico 2 W and controller validation; a successful build is
not a hardware test.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
