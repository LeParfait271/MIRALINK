# MiraLink firmware 0.56

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate fixes five PS-only reconnect lifecycle gaps found by comparing
the clean-room implementation with the DS5Dongle reference. The native
DualSense Bluetooth state report `0x32` is sent immediately after the HID
report-mode handshake, before the Feature GET sequence. In addition, an
authenticated incoming ACL is admitted before MiraLink's RAM address cache is
rebuilt after a Pico reboot; descriptor parsing and a strict CRC-valid `0x31`
report remain the input trust boundary. Finally, a new explicit pairing action
re-arms a bounded teardown retry if BTstack's old SDP/HID CID outlives the
first retry window. The Classic gamepad ACL request is now accepted explicitly,
with inquiry stopped before authentication/encryption. Bootstrap and controller output now wait for the ACL
encryption event. No DS5Dongle source or binary was copied.

The firmware keeps passive interlaced page-scan reconnect enabled for
remembered controllers, and limits outgoing HID connection attempts to the
explicit pairing window. It is a test candidate: no physical Pico 2 W
validation has been performed for 0.56 yet. Audio streaming remains disabled.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 452,492 | `0AA1B869C45C628ADD596463F201EDE06A5595D0670093BD89ECF8FF90BEBEA6` |
| `miralink_pico_firmware.elf` | 2,995,392 | `A52931AE2933A2213A6DC354AEE5A3C447C5C10F3E8EB6C44C0343037E08A0B0` |
| `miralink_pico_firmware.hex` | 1,272,808 | `292036086F38E0EED702740B1A3AC5E8C1A5F15EFD2897CD7FAD990A49821557` |
| `miralink_pico_firmware.uf2` | 905,728 | `E1A5E20085167FA8AF40D2E833EA19DB40CC3EFF49D1A2E059A6D25679045970` |

Verify `SHA256SUMS.txt` before flashing. Keep the previous UF2 available for
rollback. The first test should use a controller already paired to the Pico,
then power-cycle the controller with PS only; do not open the web pairing
window for that reconnect test. This artifact is not a claim that the cycle
has passed: the hardware result remains pending.
