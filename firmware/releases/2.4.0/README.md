# MiraLink Pico 2 W firmware 2.4.0

This is a local, manual-test candidate for Raspberry Pi Pico 2 W only. It was
built from MiraLink source in this repository on 2026-08-13. It is neither
published nor flashed automatically.

## What changed

- Restored a standards-based UAC2 headset function alongside the independent
  MiraLink HID channel and standard gamepad collection.
- Added 48 kHz / PCM 16-bit four-channel playback and mono local-monitor
  capture, with separate audio endpoints and UAC2 clock/mute/volume controls.
- Kept HID report identifiers unique: `0x01` command, `0x02` response, `0x03`
  event, `0x10` gamepad and `0x11` controller output.
- Applied persisted controller mode, haptic gain, speaker/microphone flags,
  volume lock, audio prebuffer, gamepad reporting mode and LED preference at
  runtime.
- Added opt-in standard USB remote wake from validated controller input. It is
  active only when both the saved profile and the USB host permit it.

Playback channels 3-4 feed the bounded haptic path. The capture interface is a
local monitor source; it is not presented as a DualSense microphone transport.
Adaptive-trigger effects remain available through the validated 47-byte
controller-output route, but require a physical effect test before being
declared working.

## Verification completed

- MiraLink native core test suite: passed.
- UAC2 descriptor size and endpoint separation: checked at compile time.
- UF2 inspected locally with picotool:
  - name: `MiraLink Pico 2 W`
  - version: `2.4.0`
  - board: `pico2_w`
  - target: `RP2350`, `ARM Secure`
- SHA-256 values are in `SHA256SUMS.txt`.

## Manual test boundary

No physical Pico 2 W or DualSense was connected during this build. Windows
enumeration, WebHID, pairing/reconnection, UAC2 audio, rumble and adaptive
triggers are therefore not yet hardware-validated.

To test, put the Pico 2 W into BOOTSEL mode and copy **only**
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. Then unplug/reconnect the
Pico and first confirm in Device Manager that the HID and audio interfaces start
without Code 10. This procedure is manual by design.
