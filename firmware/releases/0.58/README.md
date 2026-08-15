# MiraLink firmware 0.58

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate follows the DS5Dongle Bluetooth lifecycle more closely for the
failure reproduced across the previous MiraLink releases. A gamepad-class ACL
is accepted before the RAM bond cache is consulted, and the HID service is no
longer declined solely because the pairing window is closed or the address has
not yet been rebuilt after reboot. The descriptor and strict CRC-valid enhanced
report 0x31 remain the functional trust boundary. Inquiry is stopped before an
incoming controller is admitted, page scan is restored after teardown, and
outgoing HID connects remain limited to the explicit pairing window.

This is a source/build candidate, not a claim of completed hardware validation.
No physical Pico 2 W / DualSense run has been performed for 0.58. USB audio
streaming remains disabled. No DS5Dongle source or binary was copied.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 452,140 | `77962CD0520B6304E47956969C8814D1D3AF29990BD2ADBF17458346D5BF2569` |
| `miralink_pico_firmware.elf` | 2,993,244 | `094FCDD7BFD7581D364B1C7243B060EFEB12DADB0DFD6E84E430F2CA0306A2CF` |
| `miralink_pico_firmware.hex` | 1,271,818 | `CDFC721A5D0B029D463B3909F6BAB00E4D4BD34CCD86A2392632FF50E7A24C12` |
| `miralink_pico_firmware.uf2` | 905,216 | `62C6B2576162E0DDA93BC4D8797E2EDE96713FA99D5409ED918B2E79F6C99BEC` |

UF2 metadata: version 0.58, Pico SDK 2.3.0, range
`0x10000000..0x1006e62c`, extra security not enabled. Verify
`SHA256SUMS.txt` before flashing and keep the previous UF2 for rollback.
