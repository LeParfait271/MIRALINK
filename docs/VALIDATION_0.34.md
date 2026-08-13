# MiraLink 0.34 firmware validation record

Date: 2026-08-13<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: local manual-test candidate only

## Static and automated validation

| Check | Result |
| --- | --- |
| Application tests | Passed (`64/64`) |
| Application JavaScript syntax checks | Passed |
| Native MiraLink core build and test | Passed (`1/1`) |
| Pico 2 W firmware build | Passed with ARM GNU 15.2.1 and Pico SDK 2.3.0 |
| Active USB descriptor | HID-only vendor bridge plus standard gamepad; UAC2 disabled |
| HID feature-report buffer | 65 bytes: report ID plus 64-byte frame |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W, `0.34`, RP2350 ARM Secure |

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.34/miralink_pico_firmware.uf2` | 1,404,928 | `851FB92687616A56B0F3158178EEEBB5B1328EFF6F7249CAF85B1C917E47D48E` |
| `firmware/releases/0.34/miralink_pico_firmware.elf` | 4,431,396 | `69CEB8AA50B715C8D3C727D3C2396F5D1761778A634E0BC557F73897B0483BDA` |
| `firmware/releases/0.34/miralink_pico_firmware.bin` | 701,996 | `E0674206B04C31CD78A17737FCC4CC4C5B85C3C8AFD26A0CEB9E6ABDEDF70E48` |
| `firmware/releases/0.34/miralink_pico_firmware.hex` | 1,974,606 | `23DCEC4BC923C2594D23DFE7B8D691476FB8DBB9CCA44B58554B006EDB912D93` |

## Hardware validation still required

No Pico 2 W or DualSense was connected for this build session, and no UF2 was
flashed. The following checks remain manual: Windows HID enumeration without
Code 10, Chrome WebHID permission and `HELLO`, Bluetooth pairing/reconnection,
controller input, rumble, adaptive triggers and flash persistence.
