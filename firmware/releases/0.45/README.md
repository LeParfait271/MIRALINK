# MiraLink Pico 2 W firmware 0.45

Developer: MaruChiwa<br>
Release date: 2026-08-15

This directory contains the clean-room `0.45` manual-test candidate built for
the Raspberry Pi Pico 2 W. No build or release command flashes a board
automatically.

## What 0.45 changes

- Uses the official DS5Dongle `v0.7.2-hotfix` lifecycle as the mandatory
  behavioral comparator for this firmware issue.
- Requests passive page-scan recovery at
  `HCI_EVENT_DISCONNECTION_COMPLETE`, after the old ACL/HID teardown boundary,
  then performs the actual BTstack writes from the foreground poll.
- Reapplies scan parameters and forces the connectable `0 -> 1` transition.
- Keeps discoverability disabled outside the explicit five-minute pairing
  window and keeps incoming acceptance limited to remembered controllers.
- Keeps protocol version `1`, desktop-only scope, HID-only USB and manual
  flashing unchanged.

## Validation completed before packaging

- The Pico 2 W Release cross-build passed with Pico SDK `2.3.0` and Arm GNU
  Toolchain `15.2.1`.
- The native core-test target compiled with LLVM-MinGW, but
  `miralink-core-tests.exe` was deliberately **not launched** under Windows.
- Picotool identifies MiraLink `0.45`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, binary range `0x10000000..0x100acaac`; extra security is not
  enabled.
- The artifacts below are copied from the frozen build outputs and their
  SHA-256 values are recorded in `SHA256SUMS.txt`.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1,415,168 | `3FEA11515204D34E8167FF3F7FA80797499CB51358064B4405B829779CDA40B9` |
| `miralink_pico_firmware.elf` | 4,510,432 | `C1A0FCD2B0F8FAAA76A2A7441CEADF662F2E0EB4575B72367223698B0B33A8D8` |
| `miralink_pico_firmware.bin` | 707,244 | `A3D1997C9CFC42265D61D31A91743FBD476AAE689424079D32E40D5E885F9D1F` |
| `miralink_pico_firmware.hex` | 1,989,353 | `A6F3877314C450A141D18E9E39BF166D40817FC79D3DB3B83A62FC04DEE3D2DC` |

## Hardware boundary

**Firmware `0.45` has not been flashed or tested on real hardware.** The
`0.42` run showed the remembered DualSense blinking once and remaining offline
after the power-off/Pico-restart sequence; re-pairing was required. The `0.45`
HCI-boundary correction is source and build evidence only. WebHID/Controller Lab
stability also remains unproven for this candidate.

## Discriminating manual test

1. Flash only `miralink_pico_firmware.uf2` manually in BOOTSEL mode and keep the
   existing Bluetooth key.
2. Turn the DualSense off, then press `PS` once without opening pairing in
   MiraLink. Confirm passive reconnect, one Windows controller and resumed
   input.
3. Repeat after Pico restart and after one abrupt controller loss.
4. Run Controller Lab/WebHID for 30–60 minutes without opening a new pairing
   window. Keep the full log if any attempt fails.

The test separates the HCI-disconnection correction from ordinary pairing. A
build, hash or picotool inspection does not prove this behavior.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.42 | MiraLink 0.45 |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** |
| UF2 relative size, not a quality score | 100% | 92.5% | 92.8% |

The score remains unchanged until the manual test supplies new, reproducible
physical evidence. Flashing is manual only.
