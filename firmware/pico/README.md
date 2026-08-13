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
- reconnect rotation across remembered controllers, SSP reconnection for known
  addresses and a bounded HID handshake timeout that releases stuck links;
- DualSense Edge USB identity support, tolerant local Bluetooth inquiry hints and
  stale-HID cleanup before a new pairing or reconnect attempt;
- legacy DualSense PIN pairing with `0000` only during the explicit local
  pairing window or for an already known controller address;
- tolerant host-side normalization for MiraLink feature reports with or
  without the report ID in the TinyUSB callback buffer;
- separate flash reservations for MiraLink configuration and BTstack link keys.
- schema-2 DualSense state with battery, headset/microphone, motion and touch
  status after a validated full Bluetooth report;
- bounded compatible rumble, lightbar/player LED and microphone mute output
  commands with a local queue, Bluetooth CRC and automatic rumble stop.
- a compiled local audio pipeline retained for future descriptor work; USB
  UAC2 is not exposed in this candidate because the previous composite
  descriptor produced Windows Code 10 on the physical bridge;
- the fixed DualSense audio-report validator remains in the source, but no
  USB audio stream is advertised or counted by this HID-only candidate;
- a fixed 47-byte DualSense USB output body route for game output and adaptive
  trigger effects, wrapped by MiraLink with its own Bluetooth header and CRC;
- diagnostics schema 4 and `GET_AUDIO_STATUS` for distinguishing the USB
  stream, a validated Bluetooth HID output link and an active audio report
  stream.
- local Bluetooth failure stage and bounded connection/reconnect counters,
  without radio addresses or remote telemetry;
- a bounded output-flight guard and one in-memory pending audio report so
  concurrent HID writes cannot overwrite each other.

USB audio and audio streaming are unavailable in 2.3.0. Adaptive-trigger
effects remain a bounded output route but still require physical validation on
a Pico 2 W and a real DualSense. The output commands are bridge-only.

The USB VID/PID in `include/miralink_usb_identity.h` is development-only. It
must be replaced by an assigned identity before any public release.

The current source version is `2.3.0`. The source was rebuilt locally with
Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1` and `picotool` `2.3.0`; the
resulting local 2.3.0 manual-test candidate is in
`firmware/releases/2.3.0/`. It has not been flashed or published. The
previously built delivery artifact in `firmware/releases/0.2.0/` is retained
as historical evidence. No physical Pico 2 W or controller was connected
during this validation.

Building produces the ELF, BIN and HEX formats locally. The UF2 is then
generated from that same ELF with the local SDK-matched `picotool` command:

```text
picotool uf2 convert miralink_pico_firmware.elf miralink_pico_firmware.uf2 --family rp2350-arm-s --platform rp2350 --abs-block
```

The files in
`firmware/releases/2.3.0/` are a manually testable local candidate with a
SHA-256 manifest; the files in `firmware/releases/2.0.0/` and
`firmware/releases/0.2.0/` are historical artifacts. MiraLink never flashes
the board automatically.

Version 2.3.0 also assigns a unique HID report identifier to every top-level
report in the active descriptor. The raw controller-output envelope now uses
`0x11`; the 47-byte DualSense body it transports is unchanged. This fixes the
previous descriptor collision between command/response feature reports and
output reports that could make Windows reject the HID device with Code 10.
This correction is statically verified only; physical enumeration still needs
to be tested on a Pico 2 W.
