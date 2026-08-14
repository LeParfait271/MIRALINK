# MiraLink Pico 2 W firmware 0.41

Developer: MaruChiwa<br>
Release date: 2026-08-14

This directory contains the clean-room `0.41` manual-test candidate built for
Raspberry Pi Pico 2 W. No build or release command flashes a board
automatically.

## What 0.41 changes

- After a DualSense HID link closes, Bluetooth page-scan rearming is deferred
  to the foreground poll instead of being issued from the HID callback.
- The rearm reapplies page-scan parameters and forces a fresh `0 -> 1`
  connectable transition so BTstack cannot suppress it through a stale cached
  connectable flag.
- Reconnect rearming is skipped while the Pico is idle-suspended, while a HID
  link is active, or while the Bluetooth stack is not working.
- Explicit pairing-window behavior, protocol version `1`, USB Audio-disabled
  behavior, WebHID safeguards, and desktop-only scope are unchanged.

## Validation completed before packaging

- The Pico 2 W Release cross-build passed with Pico SDK `2.3.0`.
- Picotool identifies MiraLink `0.41`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, SDK `2.3.0`, Release build, binary range
  `0x10000000..0x100aca74`; extra security is not enabled.
- The reconnect-policy assertions compiled as part of the permitted
  cross-platform syntax-only core validation; they were not executed. The
  Windows native `miralink-core-tests.exe` was deliberately not run.
- The artifacts below are copied from the frozen build outputs and their
  SHA-256 values are recorded in `SHA256SUMS.txt`.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1,415,168 | `0EAE9C8BE83A817C1E5E2365834F08B4DA284D3464CDC4C169CA4BAF159F4873` |
| `miralink_pico_firmware.elf` | 4,510,272 | `303F9D2CA83088A23FB9ACF7E937DAF1114A9C07199A201F471DC8FC2174004D` |
| `miralink_pico_firmware.bin` | 707,188 | `30D41DA2B77AC992431E5E3A090D0CEFF4ACE671442FBC00C2A08B67F72C33E9` |
| `miralink_pico_firmware.hex` | 1,989,215 | `D3E9AE075F8CFE88F5222AFDA908E7609A9296D396C224D2241791AAB5F5B8AD` |

## Hardware boundary

**Firmware `0.41` has not been flashed or tested on real hardware.** The
manual v0.40 test proved USB/radio/flash diagnostics after a Pico restart and
manual WebHID reconnection, but the remembered DualSense stayed offline after
controller power-off and after Pico reboot. This candidate addresses the
probable page-scan rearm hole; it does not prove the correction until the
manual test below is completed. Audio streaming remains absent.

## Manual test plan

1. Preserve the current Diagnostics and Journals, enter BOOTSEL mode on a Pico
   2 W, and copy only `miralink_pico_firmware.uf2` to the `RPI-RP2` volume.
2. Confirm one Windows controller, firmware `0.41`, successful initial pairing
   if required, live buttons/sticks, and responsive Controller Lab input.
3. With the remembered key retained and without opening pairing, power the
   controller off, then press PS. It must reconnect passively. Repeat this
   cycle 20 times.
4. Repeat the same passive reconnect cycle after rebooting the Pico. Include
   an abrupt controller power-loss and an out-of-range/in-range cycle; check
   that no duplicate Windows controller appears.
5. Run Controller Lab plus configuration reads and Diagnostics for 30-60
   minutes. Record any feature-report failure and whether polling remains
   smooth.
6. If any reconnect fails, do not erase the remembered key automatically.
   Preserve the full log and note the exact LED, Windows-device and Pico state
   before manually pairing again.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.40 observed | MiraLink 0.41 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** |
| UF2 relative size, not a quality score | 100% | 92.7% | 92.8% |

The `0.41` score remains unchanged until the manual test plan supplies new
hardware evidence.
