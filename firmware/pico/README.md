# MiraLink Pico 2 W firmware

This directory contains MiraLink's independent firmware for Raspberry Pi Pico
2 W. It is built from MiraLink source only and does not reuse previous
projects or the supplied UF2.

## Firmware 0.36

The firmware exposes one experimental HID-only DualSense-family persona. It
uses Sony VID `0x054c` with PID `0x0ce6` (standard/Auto) or `0x0df2` (Edge)
because the bridge is intended to be consumed by native controller stacks. It
does not claim to be Sony firmware or a Sony product.

- one HID interface with a Gamepad collection and a separate vendor-defined
  MiraLink collection, avoiding a second Sony-matched interface on Linux;
- native-size input report `0x01` (64 bytes wire) forwarding the fixed
  DualSense common body, with a neutral report while Bluetooth is unavailable;
- output report `0x02`, accepting both the compact 48-byte wire form and the
  63-byte form emitted by Linux, while forwarding only the bounded 47-byte
  common body;
- Linux probe Feature reports `0x05`, `0x09` and `0x20`. Calibration is a
  synthetic nominal-scale fallback, firmware words are marked as MiraLink, and the
  pairing identifier is ephemeral unless USB serial exposure is opted in;
- MiraLink command `0x70` and response `0x71` Feature reports. State is polled
  through the typed protocol; asynchronous `0x72` is reserved but not declared
  or emitted because gamepad input owns the interrupt endpoint.

The HID-only configuration is intentional for connection recovery. The
unvalidated UAC2 composite descriptor is not active. The audio pipeline remains
in source and is not exposed as a working USB capability.

## Functional coverage

- Two-sector configuration records in Pico flash with CRC and read-back
  verification; safe defaults if both records are invalid.
- Local Classic HID pairing for DualSense and DualSense Edge, bounded
  reconnection through the local BTstack key database, and bounded handshake
  recovery. When no BTstack controller key exists at Bluetooth startup, the
  Pico automatically opens a five-minute local pairing window and starts
  discovery; the web interface is not required for first association.
- Validated input forwarding with battery, headset/mic state, motion and touch
  data after a complete Bluetooth report.
- Bounded rumble, lightbar, player LED, microphone-mute and fixed 47-byte
  controller-output forwarding. Trigger effects use that validated controller
  output route and still require a physical effect test.
- Local Opus speaker/haptic encoding remains compiled for a later validated
  transport, with no audio persistence or external transmission.
- Runtime application of saved controller mode, haptic gain, speaker volume,
  headset monitor volume, bounded speaker gain, speaker/microphone disable,
  volume lock, audio prebuffer, gamepad reporting mode and Pico status LED
  preference. On Pico 2 W, the status LED is driven through the CYW43 wireless
  chip rather than a normal RP2350 GPIO.
- Runtime application of trigger-effect reduction to the bounded output body;
  `10` neutralizes both trigger blocks and intermediate values attenuate their
  non-type parameters only.
- Optional privacy-preserving USB serial exposure, conservative local
  inactivity suspension, and a disabled-by-default status GPIO on user-facing
  Pico 2 W pins `0..22`. These settings require the existing configuration
  confirmation. A controller-mode or serial change schedules USB
  re-enumeration after the commit acknowledgement.
- Optional standard USB remote wake: only a validated controller input can
  request it, and only when both the locally saved profile and the USB host have
  enabled it.

Serial CDC, USB audio, arbitrary GPIO outside the safe `0..22` status range, PS
host shortcuts and a controller-microphone transport are intentionally not
represented as working features in this firmware because there is no safe,
validated hardware route for them yet. They remain stored configuration values
or source-only paths and must not be presented as active capabilities.

## Validation boundary

The source is built locally with Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1`,
vendored Opus and picotool. Native MiraLink core tests pass. The HID-only
configuration descriptor is checked at compile time, and the UF2 is inspected
locally for Pico 2 W / RP2350 ARM Secure targeting.

The first manual 0.35 flash showed that Windows enumerated the Pico but the
game-controller Properties test failed and no LED blink was observed. The
0.36 candidate replaces that generic gamepad path with the new native-size
persona; it has not been flashed. Windows/Linux input, Bluetooth
pairing, rumble, adaptive triggers and reconnection on a real Pico 2 W and
DualSense remain manual hardware tests, never automatic actions.

## Local manual-test candidate

`firmware/releases/0.36/` contains ELF, BIN, HEX, UF2 and SHA-256 values
created from the current source. To test, enter BOOTSEL mode on a Pico 2 W and
manually copy only `miralink_pico_firmware.uf2` to the `RPI-RP2` volume. The
firmware never flashes a board automatically.

The Sony-compatible VID/PID is an explicit experimental compatibility choice,
not an allocation or endorsement. Public distribution requires a separate
compatibility, trademark and platform-policy review.

To rebuild the UF2 from the ELF with the local SDK-matched picotool:

```text
picotool uf2 convert miralink_pico_firmware.elf miralink_pico_firmware.uf2 --family rp2350-arm-s --platform rp2350 --abs-block
```
