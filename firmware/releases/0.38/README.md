# MiraLink Pico 2 W firmware 0.38

Developer: MaruChiwa<br>
Release date: 2026-08-14

This directory contains the clean-room `0.38` manual-test candidate built on
2026-08-14. No build or release command flashes a board automatically.

## What 0.38 changes

- The one-root USB topology from `0.37` is retained. Its manual Windows test
  showed exactly one `DualSense` controller child, but no buttons or sticks
  reached Windows.
- After the Bluetooth HID descriptor is available, MiraLink now performs a
  bounded asynchronous Feature sequence `0x05` → `0x09` → `0x20`, followed by
  a bounded neutral-output fallback if enhanced input has not started.
- Minimal Bluetooth report `0x01` proves liveness only. Only a complete,
  strict-length, CRC-valid enhanced report `0x31` can mark the controller
  connected, feed USB input and trust a provisional Bluetooth address.
- A version-locked build overlay makes BTstack accept a new asynchronous HID
  output only after the previous caller-owned buffer was consumed. The
  official Pico SDK checkout is not modified.
- Persistent configuration erase/program runs inside the Pico SDK flash-safe
  executor. Deadlines use the 64-bit boot clock; radio-off clears stale input,
  and failed CYW43 initialization leaves a safe USB diagnostic mode.
- Sony-compatible VID/PID and reports remain experimental compatibility work,
  without Sony certification, endorsement or affiliation.
- USB audio remains disabled and source-only.

## Validation completed before release

- Application syntax and all `98/98` unit tests passed.
- `npm audit` reported no known dependency vulnerability at release time.
- Browser automation passed `20/20` scenarios (10 desktop, 10 mobile), including a
  synthetic MiraLink bridge exchange, cold offline reload, keyboard tabs,
  responsive layout and serious/critical accessibility checks.
- The native MiraLink core test passed (`1/1`) with `libc++.dll` and
  `libunwind.dll` copied beside the test executable.
- The Pico 2 W Release build passed with Pico SDK `2.3.0` and Arm GNU `15.2.1`.
- The generated build uses the SHA-locked BTstack overlay exactly once and does
  not compile the original `hid_host.c` in parallel.
- Picotool identifies MiraLink `0.38`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, SDK `2.3.0`; extra security is reported as not enabled.
- Artifact sizes and SHA-256 hashes are recorded in `SHA256SUMS.txt` and
  `docs/VALIDATION_0.38.md`.

## Hardware boundary and manual test

The `0.38` Bluetooth correction has not been flashed or validated on a real
Pico 2 W and DualSense. It is a software-validated test candidate, not proof
that pairing, input, output, reconnect or wake now work on hardware.

To test manually, enter BOOTSEL mode on a Pico 2 W and copy only
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. Confirm that Windows still
shows exactly one controller. In Chrome or Edge, connect the Pico through the
MiraLink site, run Diagnostics, open the pairing window, then put the DualSense
in pairing mode with Create + PS. Verify live buttons/sticks before testing
rumble, LEDs, triggers, reconnect and wake. Stop and report the exact
diagnostic summary if no enhanced input arrives.

## DS5Dongle baseline

| Capability | DS5Dongle | MiraLink 0.37 observed | MiraLink 0.38 candidate |
| --- | ---: | ---: | ---: |
| USB persona / host compatibility | 100% | 72% | 72% |
| Bluetooth pairing / reconnect | 100% | 25% | 45% |
| Input / motion / touch | 100% | 50% | 63% |
| Output / rumble / triggers | 100% | 48% | 48% |
| USB audio / HD haptics / microphone | 100% | 5% | 5% |
| **Weighted proven score** | **100%** | **44.0%** | **50.3%** |

Raw source coverage remains `76%`. The `0.38` UF2 is `92.7%` of the
DS5Dongle reference size; size is not a quality score.
