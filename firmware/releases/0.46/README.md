# MiraLink Pico 2 W firmware 0.46

Developer: MaruChiwa<br>
Release date: 2026-08-15

This is the manual-test candidate for the passive remembered-controller
reconnect correction. It is clean-room MiraLink firmware; no DS5Dongle code or
binary is included. No build or release command flashes a board automatically.

## What changed from 0.45

- Uses the DS5Dongle `v0.7.2-hotfix` lifecycle as the behavioral reference for
  `HCI_EVENT_DISCONNECTION_COMPLETE`.
- Treats completed ACL teardown as authoritative even if BTstack has not yet
  emitted `HID_SUBEVENT_CONNECTION_CLOSED`.
- Retires a stale SDP/HID-host slot from the foreground poll before rearming
  page scan, then reapplies the interlaced scan parameters and connectable
  `0 -> 1` transition.
- Keeps the existing passive remembered-key policy, strict `0x31` input gate,
  USB protocol, desktop-only UI and manual-flash boundary unchanged.

## Build validation

- Pico 2 W / RP2350 ARM Secure cross-build: PASS.
- Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1`, Release build.
- `picotool` identifies version `0.46`, family `rp2350-arm-s`, range
  `0x10000000..0x100acbbc`, extra security not enabled.
- Native Windows core-test executable: compiled but **not launched**.
- No board was flashed during packaging.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1,415,680 | `B1B9DDBF916E5C9EA48C2E99C848C62CF468B1D7DD6169749E73A9EC4D538826` |
| `miralink_pico_firmware.elf` | 4,512,560 | `5A4597B32439048A777D96BD8F0DE5539ADDD7CE53F88F9A22241B97BAA5C6C5` |
| `miralink_pico_firmware.bin` | 707,516 | `8EE870A090BE6A2F17C6EB35318A6FFE0CDBAC597A32A88625450463D02DB00E` |
| `miralink_pico_firmware.hex` | 1,990,118 | `E18550BB285384915BFBE24DC47DB6E46636647223E70EE800B927EB1A9E5F31` |

## Required manual test

1. Flash only `miralink_pico_firmware.uf2` manually in BOOTSEL mode, preserving
   the existing Bluetooth bond.
2. Confirm initial input in Controller Lab.
3. Turn the DualSense off, then press **PS only** once without opening a new
   pairing window. Confirm that the same bond reconnects and input resumes.
4. Repeat once after a Pico restart. Record whether the LED, Controller Lab
   state and Windows controller entry recover.

This candidate is not considered hardware-validated until that test passes.

## DS5Dongle comparison

| Axis | DS5Dongle | MiraLink 0.45 | MiraLink 0.46 |
| --- | ---: | ---: | ---: |
| Bluetooth pairing / reconnect | 100% | 55% | 55% |
| Overall weighted proven score | 100% | 54.4% | 54.4% |

The score remains unchanged until the new manual run provides reproducible
hardware evidence. The UF2 size is not a quality score.
