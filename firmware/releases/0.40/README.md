# MiraLink Pico 2 W firmware 0.40

Developer: MaruChiwa<br>
Release date: 2026-08-14

This directory contains the clean-room `0.40` manual-test candidate built for
Raspberry Pi Pico 2 W. No build or release command flashes a board
automatically.

## What 0.40 changes

- A controller with a remembered Bluetooth key now reconnects passively. The
  bridge no longer occupies BTstack's single HID-host connection slot with an
  automatic outgoing connection while it is waiting for that controller.
- Outgoing HID connections are limited to an active pairing window. The first
  opens automatically only when no remembered key exists; later windows are
  opened by the user.
  Interlaced page scanning is enabled once the radio is ready, connectability
  is rearmed after a closed connection, and the pairing window closes after the
  first complete, strict-length, CRC-valid enhanced input report `0x31`.
- Feature response `0x71` remains readable until a later MiraLink command
  report produces a success or error response. The USB reconnect intent is
  still consumed only once, so a host can retry
  receiving the acknowledgement without sending the command a second time.
- The WebHID application serializes work through a cancellable per-device FIFO,
  verifies the bridge with `HELLO` before management commands, never retries an
  ambiguous send, and limits transient receive recovery to rereading the same
  response.
- Controller polling now runs every 100 ms with bounded 250/500 ms backoff.
  Explicit USB reconnect handling observes actual disappearance of the device
  and does not resend the reconnect command when its acknowledgement is lost.
- USB Audio remains disabled. No audio stream is implemented or validated;
  the reported audio path is diagnostic/source-only.

## Validation completed before packaging

- `npm run check` passed; application unit tests passed `109/109`.
- `npm audit --audit-level=low` reported 0 known vulnerabilities.
- Desktop Playwright automation passed `15/15` scenarios.
- The final application build contains 29 files totaling 313,178 bytes; all
  `28/28` checked source-to-distribution files match.
- The Pico 2 W Release cross-build passed with Pico SDK `2.3.0`.
- ARM-target syntax-only core tests passed. The Windows native core-test
  executable was deliberately not run during this `0.40` pass.
- Picotool identifies MiraLink `0.40`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, SDK `2.3.0`, Release build, binary range
  `0x10000000..0x100ac9e4`; extra security is not enabled.
- Packaged sizes and SHA-256 values match the frozen build outputs and are
  recorded in `SHA256SUMS.txt`.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1,414,656 | `A3BB4FF3A67D9EB293D8499033D0FADFA2BCD59365A711B60C9D8754A7DBA677` |
| `miralink_pico_firmware.elf` | 4,508,868 | `52D685219DC146793F79318CF0806D5FF7E6E9CD14FB15C1EDBD3C2F5A4BA16A` |
| `miralink_pico_firmware.bin` | 707,044 | `2EB04518B8B9E2CA11B961C00DAA6CC46E3F8C1501B6DC1865C9B17AB1D39B53` |
| `miralink_pico_firmware.hex` | 1,988,810 | `8B1F1EFC48688D0AFB3770C7946395D858E85AFEA26E72CD6CB288A82B4ADA52` |

## Hardware boundary

**Firmware `0.40` has not been flashed or tested on real hardware.** Version
`0.38` exposed working buttons/sticks in `joy.cpl` and completed a material
configuration commit. Version `0.39` paired and delivered a live quick-test
sample to Controller Lab, diagnostics and configuration read, but a controller
powered off afterward did not reconnect without pairing again. Version `0.40`
addresses that failure in source and passes the software checks above; those
results are not proof that radio reconnection works on the physical bridge.
Audio streaming is also absent.

## Manual test plan

1. Preserve the current Diagnostics and Journals, enter BOOTSEL mode on a Pico
   2 W, and copy only `miralink_pico_firmware.uf2` to the `RPI-RP2` volume.
2. Confirm one Windows controller, firmware `0.40`, successful pairing if
   required, live buttons/sticks, and responsive Controller Lab input.
3. Power the controller off, then press PS. It must reconnect through the
   remembered key without reopening pairing. Repeat this cycle 20 times, then
   repeat after rebooting the Pico.
4. Test abrupt controller power loss and an out-of-range/in-range cycle. Check
   that the bridge becomes connectable again and that no duplicate controller
   appears.
5. Run Controller Lab plus configuration reads and Diagnostics for 30–60
   minutes. Record any persistent `Failed to write/receive the feature report`
   sequence and judge whether the 100 ms polling remains smooth.
6. Exercise the explicit USB reconnect once with a normal acknowledgement and
   once while the acknowledgement read is interrupted. There must be at most
   one re-enumeration and no duplicate command execution.
7. If any reconnect fails, do not erase the remembered key automatically.
   Preserve the full log and note the exact LED, Windows-device and Pico state
   before manually pairing again.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.39 observed | MiraLink 0.40 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** |
| UF2 relative size, not a quality score | 100% | 92.8% | 92.7% |

The `0.40` score remains unchanged until the manual test plan supplies new
hardware evidence.
