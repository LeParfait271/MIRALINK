# MiraLink firmware 0.49

Developer: MaruChiwa<br>
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure<br>
SDK: Pico SDK 2.3.0<br>
Build: Release

This release fixes the inactivity timer so unchanged enhanced DualSense
telemetry does not count as user activity. Buttons, sticks, triggers and touch
transitions reset the timer. Bluetooth reconnect behavior is unchanged from
0.48 and remains untested on a physical Pico 2 W in this release.

The USB audio class remains disabled; this UF2 does not provide a validated USB
audio stream. Flashing is manual only. Compare `SHA256SUMS.txt` before flashing.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 708,556 | `3514C6B6DC97E0C3DA0C698A8F90B0534573F4C4A01BC00ADF1935D2FC2031A2` |
| `miralink_pico_firmware.elf` | 4,524,412 | `FC79BD202BAB9A3C08388B37F72EB41F2EBD24B3CBD640FA2048B6408E4D78C5` |
| `miralink_pico_firmware.hex` | 1,993,069 | `1E35F9B1F141FBE3B8161943675B1E2E4B2900BA61C8CF882CE589A86047B553` |
| `miralink_pico_firmware.uf2` | 1,417,728 | `60B2B7A12AAC31FE08802B252E677CCAD0AADC6B2B45ED369C8E4D07FBC284AE` |
