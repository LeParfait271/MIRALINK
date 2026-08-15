# MiraLink firmware 0.53

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate fixes two PS-only reconnect lifecycle gaps found by comparing
the clean-room implementation with the DS5Dongle reference. The native
DualSense Bluetooth state report `0x32` is sent immediately after the HID
report-mode handshake, before the Feature GET sequence. In addition, an
authenticated incoming ACL is admitted before MiraLink's RAM address cache is
rebuilt after a Pico reboot; descriptor parsing and a strict CRC-valid `0x31`
report remain the input trust boundary. No DS5Dongle source or binary was
copied.

The firmware keeps passive interlaced page-scan reconnect enabled for
remembered controllers, and limits outgoing HID connection attempts to the
explicit pairing window. It is a test candidate: no physical Pico 2 W
validation has been performed for 0.53 yet. Audio streaming remains disabled.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 451,788 | `80D137DEE57EE135926A86D70AE3366F842ED17FF60DAD092FBDB1C5DBA6D75E` |
| `miralink_pico_firmware.elf` | 2,989,020 | `780B812EE60E0CBCFFCEF0853E2AE68A87CFAA7BBEE5D1F1A10F0C953FD3A4BE` |
| `miralink_pico_firmware.hex` | 1,270,828 | `E9854342FCDD6996DFFB9118E51DB770E98C0BC587BB372D738BA6A2458E2693` |
| `miralink_pico_firmware.uf2` | 904,192 | `1BC2559DA01F2926B65B3F160EABE5D07E76F77EAB6B201D07AFCF7FFF257163` |

Verify `SHA256SUMS.txt` before flashing. Keep the previous UF2 available for
rollback. The first test should use a controller already paired to the Pico,
then power-cycle the controller with PS only; do not open the web pairing
window for that reconnect test. This artifact is not a claim that the cycle
has passed: the hardware result remains pending.
