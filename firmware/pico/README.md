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
- a standard USB HID gamepad collection that forwards validated DualSense input
  and releases all buttons when the controller disconnects;
- a five-minute, confirmation-gated pairing window that is closed at boot;
- local DualSense inquiry during that window, with Sony identity/name filtering
  before a Classic HID connection is attempted;
- local BTstack link-key discovery, bounded reconnection at startup and
  acceptance of a previously paired controller after the pairing window closes;
- separate flash reservations for MiraLink configuration and BTstack link keys.
- schema-2 DualSense state with battery, headset/microphone, motion and touch
  status after a validated full Bluetooth report;
- bounded compatible rumble, lightbar/player LED and microphone mute output
  commands with a local queue, Bluetooth CRC and automatic rumble stop.

Audio streaming and adaptive-trigger effects remain explicitly unavailable.
The output commands are bridge-only and still require physical validation.

The USB VID/PID in `include/miralink_usb_identity.h` is development-only. It
must be replaced by an assigned identity before any public release.

The current source version is `1.5.0`. The source was rebuilt locally with
Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1` and `picotool` `2.3.0`; the
resulting local 1.5.0 manual-test candidate is in
`firmware/releases/1.5.0/`. It has not been flashed or published. The
previously built delivery artifact in `firmware/releases/0.2.0/` is retained
as historical evidence. No physical Pico 2 W or controller was connected
during this validation.

Building produces the ELF, BIN and HEX formats locally. The UF2 is then
generated from that same ELF with the local SDK-matched `picotool` command:

```text
picotool uf2 convert miralink_pico_firmware.elf miralink_pico_firmware.uf2 --family rp2350-arm-s --platform rp2350 --abs-block
```

The files in
`firmware/releases/1.5.0/` are a manually testable local candidate with a
SHA-256 manifest; the files in `firmware/releases/0.2.0/` are historical
artifacts. MiraLink never flashes the board automatically.
