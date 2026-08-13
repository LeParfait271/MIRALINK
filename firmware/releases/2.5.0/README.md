# MiraLink Pico 2 W firmware 2.5.0

This is a local manual-test candidate for Raspberry Pi Pico 2 W only. It was
built from MiraLink source in this repository on 2026-08-13. It is neither
published nor flashed automatically.

## What changed

- Activated persisted speaker volume, headset-monitor volume and bounded
  speaker gain at runtime.
- Activated bounded trigger-effect reduction on the fixed 47-byte
  controller-output body. `10` neutralizes both trigger effect blocks; values
  `1..9` attenuate their non-type parameters.
- Added conservative local inactivity suspension. It closes an inactive known
  controller link without erasing pairing keys and waits for an explicit
  pairing action or an inbound reconnection.
- Added an optional USB unique-board serial descriptor, disabled by default.
  A manual USB reconnect is required after changing this privacy setting.
- Added a disabled-by-default status GPIO, limited to user-facing Pico 2 W
  digital pins `0..22`; the selected pin returns to input mode when replaced.
- Made the core test executable enforce its assertions even under a Release
  build, then added coverage for trigger reduction and GPIO validation.

The established UAC2 playback route, local-monitor capture, local Opus audio
pipeline, haptics, lightbar, player LEDs, microphone-mute output, controller
output route, pairing and automatic reconnect remain included.

## Verification completed

- Native MiraLink core tests: passed (`1/1`) with active assertions.
- Pico 2 W / RP2350 ARM Secure target: compiled locally.
- UF2 inspected locally with picotool:
  - name: `MiraLink Pico 2 W`
  - version: `2.5.0`
  - target: `RP2350`, `ARM Secure`
- SHA-256 values are in `SHA256SUMS.txt`.

## Manual test boundary

No physical Pico 2 W or DualSense was connected during this build. Windows
enumeration, pairing/reconnection, USB Audio Class 2, speaker, haptics,
adaptive triggers, idle wake-up and status GPIO are not hardware-validated.

The capture interface is still the local playback monitor; it must not be
described as a DualSense microphone transport. Serial CDC and PS-to-operating-
system shortcuts are intentionally not active.

To test, put the Pico 2 W into BOOTSEL mode and copy **only**
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. Then unplug/reconnect the
Pico and check that HID and audio interfaces start without Code 10.
