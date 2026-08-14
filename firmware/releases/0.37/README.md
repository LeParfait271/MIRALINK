# MiraLink Pico 2 W firmware 0.37

This directory contains the clean-room 0.37 manual-test candidate built on
2026-08-14. No build or release command flashes a board automatically.

## What 0.37 corrects

- The USB descriptor now has exactly one top-level Application/Gamepad
  collection. MiraLink's vendor Feature channel is an Application collection
  nested inside that root, so Windows should no longer create the two
  controller children observed with 0.36.
- A previously unknown Bluetooth address is remembered only after its first
  valid DualSense input report. If that new attempt fails first, only its new,
  unvalidated link key is discarded; keys that existed before the attempt are
  preserved.
- CYW43 and BTstack now run by explicit polling in the main loop. This removes
  the prior split between background IRQ callbacks and foreground Bluetooth
  calls.
- Late HID events from a stale connection being torn down are filtered by
  their exact CID, preventing an old report from recreating a false Connected
  state while a new pairing window is open.
- Sony-compatible VID/PID and reports remain experimental compatibility work,
  with no Sony certification, endorsement or affiliation.
- USB audio remains disabled.

## Validation completed before release

- Application syntax, production build and all `68/68` tests passed.
- Native MiraLink core test passed (`1/1`) with the LLVM runtime directory in
  `PATH`.
- The Pico 2 W Release build passed with Pico SDK `2.3.0` and Arm GNU `15.2.1`.
- Compile-time descriptor checks prove one root collection, one nested vendor
  collection, balanced collections, exact report sizes and Features
  `0x70`/`0x71` inside the vendor collection.
- Picotool identifies MiraLink `0.37`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, SDK `2.3.0`, and reports extra security as not enabled.
- Artifact sizes and SHA-256 hashes are recorded in `SHA256SUMS.txt` and
  `docs/VALIDATION_0.37.md`.

## Hardware boundary

Firmware 0.36 failed its first Windows test: both visible `DualSense` entries
came from the Pico, and the Bluetooth pairing window expired without a valid
link. Version 0.37 directly corrects those source paths, but it has not yet
been flashed or enumerated. It is a test candidate, not a hardware-validated
release.

To test manually, put a Pico 2 W into BOOTSEL mode and copy only
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. First check that Windows
shows exactly one controller before attempting Bluetooth pairing. Stop and
report the result if two entries still appear.

## DS5Dongle baseline

| Capability | DS5Dongle | MiraLink 0.36 observed | MiraLink 0.37 candidate |
| --- | ---: | ---: | ---: |
| USB persona / host compatibility | 100% | 30% | 43% |
| Bluetooth pairing / reconnect | 100% | 30% | 40% |
| Input / motion / touch | 100% | 63% | 63% |
| Output / rumble / triggers | 100% | 48% | 48% |
| USB audio / HD haptics / microphone | 100% | 5% | 5% |
| **Weighted proven score** | **100%** | **39%** | **43%** |

Raw source coverage remains `76%`; the proven score stays lower until the
0.37 candidate succeeds on real Pico 2 W, DualSense and host hardware. Its UF2
is `92.3%` of the DS5Dongle reference size; size is not a quality score.
