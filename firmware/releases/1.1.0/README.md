# MiraLink Pico 2 W firmware — 1.1.0

This is the locally built MiraLink firmware candidate for the Raspberry Pi
Pico 2 W (RP2350 ARM Secure). It is created from the MiraLink source tree and
does not reuse the supplied historical UF2.

## Included files

- `miralink_pico_firmware.elf` — debug/inspection image;
- `miralink_pico_firmware.bin` — raw program image;
- `miralink_pico_firmware.hex` — Intel HEX image;
- `miralink_pico_firmware.uf2` — manual BOOTSEL image;
- `SHA256SUMS.txt` — SHA-256 manifest for every image.

## Implemented in this candidate

- persistent two-slot MiraLink configuration in Pico flash;
- vendor-defined USB HID command channel with CRC-checked frames;
- DualSense Bluetooth Classic HID inquiry and identity/name filtering during
  the explicit five-minute pairing window;
- validated Bluetooth input report relay and structured live diagnostics;
- bounded in-memory logs, manual USB reconnect and confirmation-token recovery.

Battery, audio, haptics, adaptive triggers, production USB identity and real
hardware operation remain unvalidated or unavailable. No Pico 2 W or DualSense
was connected while producing this candidate. Do not treat this file as a
hardware-tested release.

## Manual recovery boundary

MiraLink never flashes automatically. Keep the previous known-good image,
enter BOOTSEL manually, verify the UF2 checksum locally, and stop if the board
does not enumerate as expected. Recovery commands in the protocol require an
explicit confirmation token and are not a substitute for physical recovery.
