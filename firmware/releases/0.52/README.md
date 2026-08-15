# MiraLink firmware 0.52

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate fixes the PS-only reconnect bootstrap. The native DualSense
Bluetooth state report `0x32` is now sent immediately after the HID report-mode
handshake, before the Feature GET sequence. The Feature requests remain
bounded and retry after BTstack releases the interrupt send. This follows the
ordering used by the clean-room DS5Dongle reference; no DS5Dongle source or
binary was copied.

The firmware also keeps passive page-scan reconnect enabled for remembered
controllers. It is a test candidate: no physical Pico 2 W validation has been
performed for 0.52 yet. Audio streaming remains disabled.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 451,868 | `ADEF68500CFC885E3207228E450ABBFEF293955C3EF7EA024C170C7970505E23` |
| `miralink_pico_firmware.elf` | 2,989,144 | `665DDE7744AA8FB963FD284DA296D22C574B003A32A38970775BE857A6158DD5` |
| `miralink_pico_firmware.hex` | 1,271,053 | `A57F832B3808500D9D43D601F3578EFB935E25939A1338E6DE4401127F121FE9` |
| `miralink_pico_firmware.uf2` | 904,704 | `26C11AEFAA34BEA031725BB087DFDB0189992A00FAAE7F54113C70BB1FC26D98` |

Verify `SHA256SUMS.txt` before flashing. Keep the previous UF2 available for
rollback. The first test should use a controller already paired to the Pico,
then power-cycle the controller with PS only; do not open the web pairing
window for that reconnect test.
