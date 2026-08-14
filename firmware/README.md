# MiraLink firmware core

This directory contains the new MiraLink firmware core and the first compiled
Pico 2 W hardware target. Protocol framing, configuration validation and the
two-slot flash store are independent of the board layer; the `pico/` target
connects them to USB HID and Pico flash operations without importing any
previous firmware source.

The manual Windows test of firmware 0.37 showed exactly one controller child,
partially validating the corrected single-root USB topology, but Windows
received no usable controller input. No Bluetooth packet was captured. Source
analysis found an activation lock consistent with that result: 0.37 accepted
only enhanced report `0x31`, a DualSense can begin with minimal report `0x01`,
and the bridge did not initiate the Feature sequence that enables the enhanced
stream.

Firmware 0.38 keeps the one-root experimental DualSense-family USB persona and
adds a bounded asynchronous Feature bootstrap (`0x05` → `0x09` → `0x20`)
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
until a physical Pico 2 W validation is complete. The `0.38` Bluetooth
correction remains a compiled software candidate; a successful build and host
tests are not a physical Pico 2 W/controller validation.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
