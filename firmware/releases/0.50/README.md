# MiraLink firmware 0.50

Developer: MaruChiwa<br>
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure<br>
SDK: Pico SDK 2.3.0<br>
Build: Release

Firmware 0.50 adds a fixed four-packet Bluetooth output FIFO: one report may
be in flight and three more remain queued. Haptic, lightbar, trigger and
audio-output requests stay ordered until BTstack accepts each report. The
queue uses static storage and is bounded; it does not claim USB audio support.

This is a locally built, manually published candidate. It was not flashed to
a physical Pico 2 W and no new hardware validation is claimed. Compare
`SHA256SUMS.txt` before flashing.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 709,860 | `27BBCBBCA577729712DFF3A1444F210193802F77701431DEF3575CFC267CA352` |
| `miralink_pico_firmware.elf` | 4,542,020 | `D65EF2716901583841A245F00DEEFE132F7BE724510036691B531476934A02A5` |
| `miralink_pico_firmware.hex` | 1,996,730 | `8362B75CEA79F6EC4E37CDD76923DF7F2BE166F7083DCF281796AC7A79553091` |
| `miralink_pico_firmware.uf2` | 1,420,288 | `04D5AA36F4D4B30B2976599DD1BD1D896794364570B3A7097238F00A638A8408` |
