# MiraLink Pico 2 W firmware

This directory is the first hardware target for MiraLink. It is a new USB HID
feature-report firmware for the Raspberry Pi Pico 2 W and does not reuse the
previous projects or the supplied UF2.

The firmware currently provides:

- fixed 64-byte MiraLink HID reports;
- HELLO, INFO, configuration draft/commit/reset and basic diagnostics;
- two-sector flash configuration records with generation, CRC and read-back
  verification;
- safe defaults when both flash records are invalid.
- a Classic HID host for DualSense Bluetooth input reports with CRC validation;
- typed controller-state responses and event reports over USB;
- a five-minute, confirmation-gated pairing window that is closed at boot;
- separate flash reservations for MiraLink configuration and BTstack link keys.

The current controller tranche is input-only. Battery, audio, haptics and
adaptive-trigger output remain explicitly unavailable until their own hardware
paths are implemented and validated.

The USB VID/PID in `include/miralink_usb_identity.h` is development-only. It
must be replaced by an assigned identity before any public release.

The current source version is `0.6.0`. The source was rebuilt locally with
Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1` and `picotool` `2.3.0`; the
resulting local 0.6.0 manual-test candidate is in
`firmware/releases/0.6.0/`. It has not been flashed or published. The
previously built delivery artifact in `firmware/releases/0.2.0/` is retained
as historical evidence. No physical Pico 2 W or controller was connected
during this validation.

Building produces the binary formats locally. The files in
`firmware/releases/0.6.0/` are a manually testable local candidate with a
SHA-256 manifest; the files in `firmware/releases/0.2.0/` are historical
artifacts. MiraLink never flashes the board automatically.
