# MiraLink firmware 0.57

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate fixes six PS-only reconnect lifecycle gaps found by comparing
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
validation has been performed for 0.57 yet. Audio streaming remains disabled.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 452,356 | `D014EADAD313D8A36942A9EE0C990AB105EE1CF6F3AAABFC7B6EB29E4C7CD954` |
| `miralink_pico_firmware.elf` | 2,994,588 | `A01DE6F84C0E5D0171A5B50FC60164FBB7ECDC2E5DC5EBCBD5F50C24F049FCD0` |
| `miralink_pico_firmware.hex` | 1,272,419 | `5DD51C65EB4E4542CD6CA144CA4233943088A220F481031C8EA44AB094319531` |
| `miralink_pico_firmware.uf2` | 905,728 | `5DE1452BB618E8DF1A629D5C56CC8293219AC5D5BAF4BDB24870C06E879041AC` |

Verify `SHA256SUMS.txt` before flashing. Keep the previous UF2 available for
rollback. The first test should use a controller already paired to the Pico,
then power-cycle the controller with PS only; do not open the web pairing
window for that reconnect test. This artifact is not a claim that the cycle
has passed: the hardware result remains pending.
