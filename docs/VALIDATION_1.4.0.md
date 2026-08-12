# MiraLink 1.4.0 validation

## Verified locally

- Application and protocol tests: 57/57 passed.
- Pico 2 W firmware built for RP2350 ARM Secure.
- BTstack reconnect source compiled without new errors.
- `picotool info` identifies the UF2 as MiraLink Pico 2 W, version 1.4.0,
  family `rp2350-arm-s`.
- The release directory contains BIN, ELF, HEX, UF2, README and SHA-256
  manifest files generated from the same build.
- The protocol exposes the local paired-controller flag without exporting a
  Bluetooth address.
- The USB descriptor source includes a separate standard gamepad collection;
  its live forwarding still requires a physical host/controller test.

## Not yet verified

- The 1.4.0 UF2 has not been flashed automatically or silently.
- USB feature exchange with the 1.4.0 binary still requires manual physical
  testing on the Pico 2 W.
- DualSense pairing, link-key reconnect and live input counters remain
  untested until a real controller is connected to the manually flashed Pico.
- Battery, audio, haptics and adaptive triggers are not implemented in this
  tranche and must remain unavailable in the application.
