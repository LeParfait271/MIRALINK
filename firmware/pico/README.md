# MiraLink Pico 2 W firmware

This directory contains MiraLink's independent firmware for Raspberry Pi Pico
2 W. It is built from MiraLink source only and does not reuse the previous
projects or the supplied UF2.

## Firmware 0.32

The firmware exposes one USB composite device with separate, standards-based
interfaces:

- MiraLink vendor HID feature reports for local configuration, diagnostics,
  pairing and recovery;
- a standard USB HID gamepad forwarding validated DualSense input and sending a
  neutral report on disconnection;
- USB Audio Class 2 at 48 kHz / PCM 16-bit: four playback channels and one
  capture channel.

For playback, channels 1-2 are the speaker pair and channels 3-4 feed the
bounded haptic pipeline. Capture is a local mono monitor of the playback pair;
it deliberately does **not** claim to be a DualSense microphone stream. Empty
capture is emitted as silence and is kept in RAM only.

The USB audio function has a fixed 48 kHz clock, a standards-compliant UAC2
mute/volume feature unit, separate audio endpoints (`0x02` playback and `0x83`
capture), and an IAD composite descriptor. HID stays on `0x81` with the unique
report IDs introduced in 2.3.0: command `0x01`, response `0x02`, event `0x03`,
gamepad `0x10`, controller output `0x11`.

## Functional coverage

- Two-sector configuration records in Pico flash with CRC and read-back
  verification; safe defaults if both records are invalid.
- Local Classic HID pairing for DualSense and DualSense Edge, bounded
  reconnection through the local BTstack key database, and bounded handshake
  recovery.
- Validated input forwarding with battery, headset/mic state, motion and touch
  data after a complete Bluetooth report.
- Bounded rumble, lightbar, player LED, microphone-mute and fixed 47-byte
  controller-output forwarding. Trigger effects use that validated controller
  output route and still require a physical effect test.
- Local Opus speaker/haptic encoding, one bounded pending audio packet and no
  audio persistence or external transmission.
- Runtime application of saved controller mode, haptic gain, speaker volume,
  headset monitor volume, bounded speaker gain, speaker/microphone disable,
  volume lock, audio prebuffer, gamepad reporting mode and Pico status LED
  preference.
- Runtime application of trigger-effect reduction to the bounded output body;
  `10` neutralizes both trigger blocks and intermediate values attenuate their
  non-type parameters only.
- Optional privacy-preserving USB serial exposure, conservative local
  inactivity suspension, and a disabled-by-default status GPIO on user-facing
  Pico 2 W pins `0..22`. These settings require the existing configuration
  confirmation; a USB reconnect is required after the serial setting changes.
- Optional standard USB remote wake: only a validated controller input can
  request it, and only when both the locally saved profile and the USB host
  have enabled it.

Serial CDC, arbitrary GPIO outside the safe `0..22` status range, PS host
shortcuts and a controller-microphone transport are intentionally not
represented as working features in this firmware because there is no safe,
validated hardware route for them yet. They remain stored configuration values
only and must not be presented as active capabilities. The UAC2 capture source
remains the local playback monitor, not the controller microphone.

## Validation boundary

The source was built locally with Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1`,
vendored Opus and picotool. Native MiraLink core tests passed. The UAC2
descriptor size is checked at compile time, and the UF2 is inspected locally
for Pico 2 W / RP2350 ARM Secure targeting.

None of that proves Windows enumeration, Bluetooth audio, rumble, adaptive
triggers or reconnection on a real Pico 2 W and DualSense. Those are manual
hardware tests, never automatic actions.

## Local manual-test candidate

`firmware/releases/0.32/` contains ELF, BIN, HEX, UF2 and SHA-256 values
created from the current source. To test, enter BOOTSEL mode on a Pico 2 W and
manually copy only `miralink_pico_firmware.uf2` to the `RPI-RP2` volume. The
firmware never flashes a board automatically.

The USB VID/PID in `include/miralink_usb_identity.h` is development-only and
must be replaced by an assigned identity before public distribution.

To rebuild the UF2 from the ELF with the local SDK-matched picotool:

```text
picotool uf2 convert miralink_pico_firmware.elf miralink_pico_firmware.uf2 --family rp2350-arm-s --platform rp2350 --abs-block
```
