# MiraLink firmware 0.54

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate fixes three PS-only reconnect lifecycle gaps found by comparing
the clean-room implementation with the DS5Dongle reference. The native
DualSense Bluetooth state report `0x32` is sent immediately after the HID
report-mode handshake, before the Feature GET sequence. In addition, an
authenticated incoming ACL is admitted before MiraLink's RAM address cache is
rebuilt after a Pico reboot; descriptor parsing and a strict CRC-valid `0x31`
report remain the input trust boundary. Finally, a new explicit pairing action
re-arms a bounded teardown retry if BTstack's old SDP/HID CID outlives the
first retry window. No DS5Dongle source or binary was copied.

The firmware keeps passive interlaced page-scan reconnect enabled for
remembered controllers, and limits outgoing HID connection attempts to the
explicit pairing window. It is a test candidate: no physical Pico 2 W
validation has been performed for 0.54 yet. Audio streaming remains disabled.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 451,868 | `9F0F21908CCC9A4B47EB21CBD14C728EAA27008107190454C03E8319201A056A` |
| `miralink_pico_firmware.elf` | 2,989,380 | `4E8661371E21F9780A04A76712C4F8CD4601FB8BEBD4EED0F3A8927DC3E1458C` |
| `miralink_pico_firmware.hex` | 1,271,053 | `8E5F3BDB333B064A0397B837EA4D2C590C57D27D71088C2F80E2616D3D6B6FDA` |
| `miralink_pico_firmware.uf2` | 904,704 | `E497C984AF845CED5BADF900EB88D16F986D12780157FC5E4C6ECC38B877C4F1` |

Verify `SHA256SUMS.txt` before flashing. Keep the previous UF2 available for
rollback. The first test should use a controller already paired to the Pico,
then power-cycle the controller with PS only; do not open the web pairing
window for that reconnect test. This artifact is not a claim that the cycle
has passed: the hardware result remains pending.
