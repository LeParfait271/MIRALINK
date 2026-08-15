# MiraLink firmware 0.55

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate fixes four PS-only reconnect lifecycle gaps found by comparing
the clean-room implementation with the DS5Dongle reference. The native
DualSense Bluetooth state report `0x32` is sent immediately after the HID
report-mode handshake, before the Feature GET sequence. In addition, an
authenticated incoming ACL is admitted before MiraLink's RAM address cache is
rebuilt after a Pico reboot; descriptor parsing and a strict CRC-valid `0x31`
report remain the input trust boundary. Finally, a new explicit pairing action
re-arms a bounded teardown retry if BTstack's old SDP/HID CID outlives the
first retry window. Bootstrap and controller output now wait for the ACL
encryption event. No DS5Dongle source or binary was copied.

The firmware keeps passive interlaced page-scan reconnect enabled for
remembered controllers, and limits outgoing HID connection attempts to the
explicit pairing window. It is a test candidate: no physical Pico 2 W
validation has been performed for 0.55 yet. Audio streaming remains disabled.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 452,300 | `53923A5D24D4FD7FAD6E04179B34FA84CA7CC0CECD0B373FAF91551AC1BF34BA` |
| `miralink_pico_firmware.elf` | 2,991,964 | `F8F9E02F57BCA76C857D30986F20F3F5BA0C8C4FF6D473B567107D2431D3FE34` |
| `miralink_pico_firmware.hex` | 1,272,268 | `BAEEC35924E65E6405DC2EA25AD7960B81F76E65DD9DDCB95CDFB76CDC5D3C11` |
| `miralink_pico_firmware.uf2` | 905,216 | `287D17005E9CE30798764B3544DCC4C18A00CC32A596C8D41C70A95673DC98D6` |

Verify `SHA256SUMS.txt` before flashing. Keep the previous UF2 available for
rollback. The first test should use a controller already paired to the Pico,
then power-cycle the controller with PS only; do not open the web pairing
window for that reconnect test. This artifact is not a claim that the cycle
has passed: the hardware result remains pending.
