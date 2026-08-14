# MiraLink Pico 2 W firmware 0.36

This directory contains the local manual-test candidate built from MiraLink's
clean-room source on 2026-08-14. Nothing in this build process flashed a board
or published a release.

## Native controller persona

- Experimental Sony-compatible USB identity: VID `054c`, PID `0ce6` for
  standard/Auto or `0df2` for Edge mode. This is not Sony firmware and does
  not imply certification, endorsement or affiliation.
- Exactly one HID interface, with native Gamepad and MiraLink vendor
  top-level collections on 1 ms IN/OUT endpoints.
- Native input `0x01` (64 wire bytes), compact/Linux output `0x02` (48 or 63
  wire bytes), host-probe Features `0x05`/`0x09`/`0x20`, and typed MiraLink
  command/response Features `0x70`/`0x71`.
- A bounded 47-byte controller-output body, privacy-aware bridge identifier,
  nominal synthetic IMU calibration, timestamp continuity and explicit-only
  remote wake.
- USB audio remains disabled and is not a capability of this candidate.

## Static validation completed

- MiraLink core test: passed (`1/1`).
- Application tests: passed (`68/68`), syntax check and production build
  passed.
- Pico 2 W Release build: passed with Pico SDK `2.3.0` and Arm GNU Toolchain
  `15.2.1`.
- The generated HID report descriptor is checked at compile time for exact
  report bit counts and absence of asynchronous report `0x72`.
- Picotool identifies version `0.36`, board `pico2_w`, target `RP2350`, image
  type `ARM Secure`, family `rp2350-arm-s`. Picotool also reports that extra
  security is not enabled; the image is not claimed to be signed or encrypted.
- File hashes are recorded in `SHA256SUMS.txt` and
  `docs/VALIDATION_0.36.md`.

## Manual test boundary

This candidate has not been flashed or enumerated on hardware. Before calling
the persona compatible, test it on a real Pico 2 W under Windows and Linux:
enumeration, WebHID Feature exchange, Bluetooth pairing/reconnect, all inputs,
rumble, adaptive triggers, suspend/wake and both standard/Edge modes.

To test manually, put a Pico 2 W into BOOTSEL mode and copy only
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. This repository never
performs that copy automatically.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.36 |
| --- | ---: | ---: |
| Functional coverage, before proof penalty | 100% | 76% |
| **Proven weighted score** | **100%** | **46%** |
| UF2 relative size, not a quality score | 100% | 92.3% |

See `docs/COMPARISON_DS5DONGLE.md` for weights, evidence coefficients and the
per-capability breakdown.
