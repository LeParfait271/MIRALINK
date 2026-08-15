# MiraLink firmware 0.59

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate completes the DS5Dongle-style passive reconnect lifecycle at
the Classic ACL boundary. A gamepad ACL is tracked as a live attempt before
HID opens; SSP/PIN responses no longer depend on a rebuilt RAM address cache;
authentication failures remove the active stale key; and a timeout can close a
raw ACL even when no HID CID was allocated. HID admission remains open after a
gamepad ACL, with descriptor validation and strict CRC-valid enhanced report
0x31 as the functional trust boundary.

This is a source/build candidate, not a claim of completed hardware validation.
No physical Pico 2 W / DualSense run has been performed for 0.59. USB audio
streaming remains disabled. No DS5Dongle source or binary was copied.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 452,124 | `1419F9CCD2DB9ECF75BE0AB30FDE592469A25B2287DBF65761828CD3BC0C0BCE` |
| `miralink_pico_firmware.elf` | 2,993,736 | `7B6D9BE28F4B0FA94F98E0CFE24E4078A3F5ABE601700F00D6EC632154A9685A` |
| `miralink_pico_firmware.hex` | 1,271,773 | `185029B7557953365A6677702CFCD6AFF5731A483769034373764B4DAAE21EDA` |
| `miralink_pico_firmware.uf2` | 905,216 | `6BDC106E99B238C560E50295C4EAF3DECFAE9E1E2C0032885A25D35A3248ACE6` |

UF2 metadata: version 0.59, Pico SDK 2.3.0, range
`0x10000000..0x1006e62c`, extra security not enabled. Verify
`SHA256SUMS.txt` before flashing and keep the previous UF2 for rollback.
