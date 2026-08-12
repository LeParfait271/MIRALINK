# MiraLink 1.8.0 validation record

Date: 2026-08-13
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure (`rp2350-arm-s`)
Status: software candidate; physical hardware test pending

## Evidence

- Firmware build: passed with Pico SDK 2.3.0 and Arm GNU Toolchain 15.2.1.
- C++ core tests: 1/1 passed.
- Application tests: 60/60 passed, 0 failed.
- MiraLink UF2 parser: 1,711 valid blocks, 876,544 bytes.
- UF2 generation used the RP2350 ARM Secure family and absolute-block metadata.
- `git diff --check`: passed before packaging.
- No flash, cloud operation, telemetry, push or public release was performed.

## 1.8.0 changes verified in software

- DualSense and DualSense Edge USB identities are accepted only for the Sony
  vendor identifier.
- Bluetooth inquiry accepts complete Sony model metadata and a bounded local
  name hint for controller revisions that report incomplete metadata.
- A failed HID handshake cannot leave a stale connection identifier blocking a
  subsequent pairing or remembered-controller reconnect attempt.
- The HID descriptor buffer is sized for complete DualSense revisions.
- Audio streaming and adaptive-trigger effects remain explicitly unavailable;
  they are not advertised as supported capabilities.

## Artifact hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/1.8.0/miralink_pico_firmware.uf2` | 876544 | `E31515DC209437115D1344103B19DB4C166BB5369A1AA23791C36517B79F030E` |
| `firmware/releases/1.8.0/miralink_pico_firmware.elf` | 2729880 | `98103B8B4838709F0D05CF7B4228CE6BFB09E3A1852B801831CD60F2C0DCD74F` |
| `firmware/releases/1.8.0/miralink_pico_firmware.bin` | 437836 | `1A6B09E3166211F41CBBBE11A4D03031B6ABB0497DD1E8A75AAC8CA55552674E` |
| `firmware/releases/1.8.0/miralink_pico_firmware.hex` | 1231588 | `7A70BE79CA18BD0079450DEFD0F356C6D27754F2B7FF4817D3346C1BFBDB8DD5` |

## What remains unproven

The automatic checks do not prove USB enumeration on the user's computer,
Bluetooth discovery, DualSense pairing, reconnection after power cycling,
real input relay, haptics, lightbar, LEDs, microphone mute or flash recovery.
Those require a real Pico 2 W and a real controller. This workspace has not
made that physical test.
