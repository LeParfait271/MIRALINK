# MiraLink Pico 2 W firmware — 0.2.0

This directory contains the locally built MiraLink firmware delivery for the Raspberry Pi Pico 2 W.

- Board: `pico2_w`
- Target: `RP2350 ARM Secure`
- Firmware version: `0.2.0`
- Developer: `MaruChiwa`
- Build date: `2026-08-12`
- Delivery: local/manual only

Files:

- `miralink_pico_firmware.uf2` — manual Pico firmware file;
- `miralink_pico_firmware.elf` — inspection/debug symbol image;
- `miralink_pico_firmware.bin` — raw binary image;
- `miralink_pico_firmware.hex` — Intel HEX image;
- `SHA256SUMS.txt` — integrity checksums.

No file in this directory is flashed automatically. Verify the target and checksum locally before any manual hardware operation. No real Pico 2 W was connected during this build validation.
