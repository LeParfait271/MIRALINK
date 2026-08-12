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

The USB VID/PID in `include/miralink_usb_identity.h` is development-only. It
must be replaced by an assigned identity before any public release.

Building produces UF2/BIN/HEX files locally. The versioned delivery artifact
for this commit is in `firmware/releases/0.2.0/` with SHA-256 checksums and
manual-use notes. MiraLink never flashes the board automatically.
