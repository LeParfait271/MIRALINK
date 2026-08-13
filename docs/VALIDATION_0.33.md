# MiraLink 0.33 firmware validation record

Date: 2026-08-13<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: local manual-test candidate only

## Static and automated validation

| Check | Result |
| --- | --- |
| Native core build | Passed |
| Native core test | Passed (`1/1`, assertions active) |
| Pico 2 W firmware build | Passed |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W, `0.33`, RP2350 ARM Secure |
| Cloudflare clean-clone asset prerequisite | Added: tracked `app/assets/.gitkeep` |

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.33/miralink_pico_firmware.uf2` | 1,417,728 | `A156277E099716961152D29E97A6F2D35B109AD13AD341548F9B95F8C320D263` |
| `firmware/releases/0.33/miralink_pico_firmware.elf` | 4,511,728 | `784E34F653BA45B42C2910F1CAA29AF0E8893084BB4CD871D6C1FAF340BE5785` |
| `firmware/releases/0.33/miralink_pico_firmware.bin` | 708,604 | `3F57796C0FD3A4AE80B150A03A6B298263D2C8B6144108E7ABFB4704E490BE99` |
| `firmware/releases/0.33/miralink_pico_firmware.hex` | 1,993,191 | `1E63260AFB6377D2F06FAC66C028AECF4F151EC97538D8C1DE407CCC2E50602F` |

## Hardware validation still required

No Pico 2 W or DualSense was connected for this build session. The following
remain manual hardware checks: Windows HID/UAC2 enumeration, pairing and
reconnection, controller inputs, audio, haptics, adaptive triggers, remote
wake and any external status-GPIO circuit.
