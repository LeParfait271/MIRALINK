# MiraLink firmware core

This directory contains the new MiraLink firmware core and the first compiled
Pico 2 W hardware target. Protocol framing, configuration validation and the
two-slot flash store are independent of the board layer; the `pico/` target
connects them to USB HID and Pico flash operations without importing any
previous firmware source.

The current firmware tranche includes the local Bluetooth inquiry/connection
path for DualSense input, bounded diagnostics, local RAM logs, USB
reconnection and a confirmation-token recovery command. Audio, battery,
haptics and adaptive triggers remain separate capability-gated work items and
are not claimed as implemented.

## Core and hardware builds

- `CMakeLists.txt` contains the host-testable core target.
- `pico/CMakeLists.txt` builds the real Raspberry Pi Pico 2 W target with the
  official SDK and local ARM toolchain.
- The current Pico build produces ELF, BIN, HEX and UF2 artifacts.

No board is flashed by any build command.
