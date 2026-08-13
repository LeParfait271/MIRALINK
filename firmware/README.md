# MiraLink firmware core

This directory contains the new MiraLink firmware core and the first compiled
Pico 2 W hardware target. Protocol framing, configuration validation and the
two-slot flash store are independent of the board layer; the `pico/` target
connects them to USB HID and Pico flash operations without importing any
previous firmware source.

The current firmware tranche includes the local Bluetooth inquiry/connection
path for DualSense input, bounded diagnostics, local RAM logs, USB
reconnection and a confirmation-token recovery command. It also includes a
local UAC2 four-channel audio ingress, a fixed DualSense audio HID report
route using locally vendored Opus, a fixed-size DualSense output adapter and
opt-in standard USB remote wake from a validated controller input. Those paths
remain subject to physical Pico 2 W and controller validation; a successful
build is not a hardware test.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
