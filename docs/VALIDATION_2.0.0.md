# MiraLink 2.0.0 validation record

Date: 2026-08-13  
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure (`rp2350-arm-s`)  
Status: local software candidate; physical hardware test pending

## Evidence

- Pico firmware rebuilt successfully with Pico SDK 2.3.0 and Arm GNU
  Toolchain 15.2.1.
- Host C++ core test passed through CTest, including fixed audio-report
  layout validation and DualSense Bluetooth CRC checks.
- Application protocol tests: 61/61 passed, including diagnostics schema 4,
  audio status and bounded controller-output coverage.
- `picotool 2.3.0 info` identifies the UF2 as MiraLink Pico 2 W, version
  `2.0.0`, RP2350 ARM Secure, with binary end `0x100ab6fc`.
- `arm-none-eabi-size`: text 706296, data 0, bss 42184, total 748480 bytes.
- No flash, cloud operation, telemetry, push or public release was performed.

## 2.0.0 software changes

- Added a local failure stage and bounded attempt counters to make Bluetooth
  discovery, HID connection, descriptor and handshake failures distinguishable
  without exporting a radio address.
- Hardened the output queue against concurrent HID writes and preserved one
  validated audio report in RAM while the queue is busy.
- Validated the fixed audio report layout and encoded the actual Opus payload
  length rather than the full buffer capacity.

## What remains unproven

The automatic checks do not prove composite USB enumeration on Windows, WebHID
feature-report exchange on the installed board, Bluetooth discovery, PS +
Create pairing, reconnection after power cycling, real input relay, audio
acceptance or rendering, haptics, adaptive-trigger rendering, lightbar/LED
behavior, microphone mute or flash recovery. Those require a real Pico 2 W and
a real DualSense. This workspace has not made that physical test.

## Artifact hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/2.0.0/miralink_pico_firmware.uf2` | 1404416 | `FDCCB5E7F40F0A0EB7220ADA8620E61BCAAB51B23B28EF1412662A88B2496C3E` |
| `firmware/releases/2.0.0/miralink_pico_firmware.elf` | 4418664 | `BDED10F6A58A3A1D7386C3CEA2366BD4EFDA41CE0911E738690CBFDBBB43E800` |
| `firmware/releases/2.0.0/miralink_pico_firmware.bin` | 702204 | `ADCF631F84E132D4E55F110AA2FCCDFFEE406AC5A23A2BEEAA2038BCFF214885` |
| `firmware/releases/2.0.0/miralink_pico_firmware.hex` | 1975191 | `0B6FD04BEE96186355E67ADE5C62B75EAE44CF80F0F6C750F0045FC8D87AC0CB` |
