# MiraLink 1.7.0 validation record

Date: 2026-08-13
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure (`rp2350-arm-s`)
Status: software candidate; physical hardware test pending

## Evidence

- Firmware build: passed with Pico SDK 2.3.0 and Arm GNU Toolchain 15.2.1.
- C++ core tests: 1/1 passed.
- Application tests: 60/60 passed, 0 failed.
- MiraLink UF2 parser: 1,711 valid blocks, 876,544 bytes.
- UF2 generation used the RP2350 ARM Secure family and absolute-block metadata.
- No flash, cloud operation, telemetry, push or public release was performed.

## Artifact hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/1.7.0/miralink_pico_firmware.uf2` | 876544 | `4368CAE89F0A56DC4E1AC9FE66BC9CA4259D36A1458CA0C3CE7A2E84A4964ADD` |
| `firmware/releases/1.7.0/miralink_pico_firmware.elf` | 2729392 | `B84509A8AB080B702D1B8E07A935957AFDB0A7ADF44FE80B3E61AFB635B015A5` |
| `firmware/releases/1.7.0/miralink_pico_firmware.bin` | 437788 | `903EEBD85AF610154F1BA9F3819E9290D854C7E8F1741B930D40C60581736BA2` |
| `firmware/releases/1.7.0/miralink_pico_firmware.hex` | 1231453 | `8BBEC2D9C43E922DE3F679C731262FE1B7FB6E66F72881FA3B86BA6690ADABF4` |

## What remains unproven

The automatic checks do not prove USB enumeration on the user's computer,
Bluetooth discovery, DualSense pairing, reconnection after power cycling,
real input relay, haptics, lightbar, LEDs, microphone mute or flash recovery.
Those require the real Pico 2 W and DualSense. Audio streaming and adaptive
trigger effects remain unsupported and must not be reported as tested.
