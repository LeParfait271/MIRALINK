# MiraLink Pico 2 W firmware 0.42

Developer: MaruChiwa<br>
Release date: 2026-08-14

This directory contains the clean-room `0.42` manual-test candidate built for
Raspberry Pi Pico 2 W. No build or release command flashes a board
automatically.

## What 0.42 changes

- Keeps the 0.41 passive remembered-controller policy and foreground page-scan
  rearm after a HID link closes.
- Fixes the local-idle resume path so a configuration commit does not call
  BTstack directly while TinyUSB dispatches the USB report.
- Queues the same bounded page-scan recovery for `bluetooth::poll()`, which
  reapplies scan parameters and forces the connectable `0 -> 1` transition.
- Keeps protocol version `1`, HID-only USB, USB Audio-disabled behavior,
  WebHID safeguards, desktop-only scope and manual flashing unchanged.

## Validation completed before packaging

- The Pico 2 W Release cross-build passed with Pico SDK `2.3.0` and Arm GNU
  Toolchain `15.2.1`.
- Picotool identifies MiraLink `0.42`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, binary range `0x10000000..0x100ac294`; extra security is not
  enabled.
- The idle-resume policy assertions are present in the core-test source. The
  Windows native `miralink-core-tests.exe` was deliberately not run.
- The artifacts below are copied from the frozen build outputs and their
  SHA-256 values are recorded in `SHA256SUMS.txt`.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1,411,072 | `AB734548F183B85EA3ED91AD1E7AF24F1203DADFACFCB2E66F2AB3B4044EE060` |
| `miralink_pico_firmware.elf` | 4,500,432 | `BA5F39F483D6AE1EB4A259D23D97463AA94D6B3A29F376323052E64C64CF60B0` |
| `miralink_pico_firmware.bin` | 705,172 | `5912C1683BAD074FD34B53761DE8483AD28F27C0B71C0A3ECEA8276F03F86714` |
| `miralink_pico_firmware.hex` | 1,983,532 | `6A94F12F6FE2A910DB249D52A7312E1876DED4D7295BCCE1F8CC6FE5897E4640` |

## Hardware boundary

**Firmware `0.42` has not been flashed or tested on real hardware.** The
manual `0.40` test proved USB/radio/flash diagnostics after a Pico restart but
the remembered DualSense stayed offline after controller power-off and Pico
restart. The 0.41 close-rearm and 0.42 idle-resume corrections are source and
build evidence only. Audio streaming remains absent.

## Discriminating manual test

1. Flash only `miralink_pico_firmware.uf2` manually in BOOTSEL mode.
2. Pair the DualSense once if necessary and configure a short local inactivity
   timeout.
3. Let the HID link enter local idle suspension, then commit a configuration
   with the inactivity timeout disabled. Do not open a new pairing window.
4. Press `PS` only and confirm passive reconnect, one Windows controller and
   resumed input without re-pairing.
5. Repeat after Pico restart and after one abrupt controller power loss. Keep
   the full log if any attempt fails; never erase the remembered key
   automatically.

The test separates the idle-resume path from ordinary pairing. A build, hash or
picotool inspection does not prove this behavior.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.41 candidate | MiraLink 0.42 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** |
| UF2 relative size, not a quality score | 100% | 92.8% | 92.5% |

The 0.42 score remains unchanged until the manual test supplies new physical
evidence. Flashing is manual only.
