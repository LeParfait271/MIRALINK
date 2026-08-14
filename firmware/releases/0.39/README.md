# MiraLink Pico 2 W firmware 0.39

Developer: MaruChiwa<br>
Release date: 2026-08-14

This directory contains the clean-room `0.39` manual-test candidate built for
Raspberry Pi Pico 2 W. No build or release command flashes a board
automatically.

## What 0.39 changes

- `COMMIT_CONFIG` persists and applies a validated configuration without
  disconnecting USB. Its versioned two-byte acknowledgement reports whether
  the effective PID or USB serial policy requires re-enumeration.
- Configuration stays wire-strict: the payload is exactly 24 bytes, only
  Feature-flag bits `0..6` are supported, and reserved bytes `15..23` must be
  zero. Malformed configuration is rejected before staging.
- Standard and Auto share PID `0x0ce6`; Edge uses PID `0x0df2`. The same pure
  mapping drives both descriptor selection and the re-enumeration decision.
- USB re-enumeration remains a separate explicit command. Its 250 ms grace
  period starts only after the host has read that command's response `0x71`;
  replacing the pending response also cancels an unread reconnect intent.
- The standard/Auto/Edge setting selects the USB persona only. Bluetooth
  discovery can find supported standard and Edge controllers during the same
  bounded pairing window, independently of that choice.
- Successful descriptor acquisition and a complete, strict-length,
  CRC-valid enhanced Bluetooth report `0x31` still gate input and provisional
  controller trust. A fresh bridge with no remembered key retains the bounded
  automatic first-pairing window.
- The single-interface, one-root HID topology and experimental Sony-compatible
  VID/PIDs remain compatibility work without Sony certification, endorsement
  or affiliation.
- USB Audio remains disabled and source-only.

## Validation completed before packaging

- `npm run check` passed; application unit tests passed `105/105`.
- `npm audit` reported 0 known vulnerabilities at packaging time.
- Desktop Playwright automation passed `11/11` scenarios.
- The final application build contains 29 files totaling 302,822 bytes.
- The Pico 2 W Release cross-build passed with Pico SDK `2.3.0` and Arm GNU
  `15.2.1`.
- Picotool identifies MiraLink `0.39`, `pico2_w`, RP2350 ARM Secure,
  `rp2350-arm-s`, SDK `2.3.0`, binary range
  `0x10000000..0x100aca64`; extra security is not enabled.
- Packaged sizes and SHA-256 values match the frozen build outputs and are
  recorded in `SHA256SUMS.txt` and `docs/VALIDATION_0.39.md`.
- The Windows native core-test executable was not run during this `0.39` pass.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1,415,168 | `4133C3792562AA99D835D41E322B629C1D8FB741C5B56F1168D9FF6E31EBBBBE` |
| `miralink_pico_firmware.elf` | 4,506,684 | `F960F8696230AC89C1569D1366D907AA3076FB1E5596EEC5157C2266C7CC46DF` |
| `miralink_pico_firmware.bin` | 707,172 | `C50071FE58910015979CC3724FBE78CA2E014CA8C983E7770D7208FDDA6E3B98` |
| `miralink_pico_firmware.hex` | 1,989,170 | `0B768AA7C50A508986F415089E3D4075B60468C2EC202554583376E946AF4598` |

## Hardware boundary and manual test

Firmware `0.38` produced one Windows controller, active enhanced Bluetooth
input and working buttons/sticks. Its implicit USB cycle after enabling the
serial number was followed by a failed reconnect/re-pair attempt. Version
`0.39` corrects that lifecycle in source, but has not been flashed or tested on
real hardware. It is not yet proof that commit, explicit re-enumeration,
reconnect or Edge pairing work physically.

To test manually, enter BOOTSEL mode on a Pico 2 W and copy only
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. Confirm one controller and
firmware `0.39`, then test pairing and live input before configuration. Verify a
normal save does not disconnect USB. For an identity change, read the warning
first and use the separately confirmed reconnect action, or physically
unplug/replug. Stop and preserve Diagnostics if the controller cannot reconnect.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.38 observed | MiraLink 0.39 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** |
| UF2 relative size, not a quality score | 100% | 92.7% | 92.8% |

The `0.39` score remains unchanged until a new hardware test supplies evidence.
