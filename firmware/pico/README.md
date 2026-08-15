# MiraLink Pico 2 W firmware

This directory contains MiraLink's independent firmware for Raspberry Pi Pico
2 W. It is built from MiraLink source only and does not reuse previous
projects or the supplied UF2.

## Firmware 0.45

The firmware exposes one experimental HID-only DualSense-family persona. It
uses Sony VID `0x054c` with PID `0x0ce6` (standard/Auto) or `0x0df2` (Edge)
because the bridge is intended to be consumed by native controller stacks. It
does not claim to be Sony firmware or a Sony product.

- one HID interface with exactly one root Gamepad Application collection and
  a nested vendor-defined MiraLink collection. This avoids both a second
  Sony-matched interface on Linux and the duplicate controller child observed
  with firmware 0.36 in Windows `joy.cpl`;
- native-size input report `0x01` (64 bytes wire) forwarding the fixed
  DualSense common body, with a neutral report while Bluetooth is unavailable;
- output report `0x02`, accepting both the compact 48-byte wire form and the
  63-byte form emitted by Linux, while forwarding only the bounded 47-byte
  common body;
- Linux probe Feature reports `0x05`, `0x09` and `0x20`. Calibration is a
  synthetic nominal-scale fallback, firmware words are marked as MiraLink, and the
  pairing identifier is ephemeral unless USB serial exposure is opted in;
- MiraLink command `0x70` and response `0x71` Feature reports. The latest
  response remains readable until a new command report produces a success or
  error response, while any
  deferred USB reconnect action is consumed only once. State is polled through
  the typed protocol; asynchronous `0x72` is reserved but not declared or
  emitted because gamepad input owns the interrupt endpoint.

The HID-only configuration is intentional for connection recovery. The
unvalidated UAC2 composite descriptor is not active. The audio pipeline remains
in source and is not exposed as a working USB capability.

## Functional coverage

- Two-sector configuration records in Pico flash with CRC and read-back
  verification; erase/program is wrapped in the SDK flash-safe executor so
  USB and radio interrupts cannot execute from XIP during the write. Safe
  defaults are used if both records are invalid.
- Millisecond deadlines are derived from the 64-bit boot clock, HCI-off purges
  stale input state, and a failed CYW43 initialization leaves the USB persona
  in a safe unavailable/diagnostic mode.
- Local Classic HID pairing for DualSense and DualSense Edge, passive
  reconnection through the local BTstack key database, and bounded handshake
  recovery. A remembered controller reconnects inbound while the Pico remains
  page-scannable; no automatic outgoing `hid_host_connect` reserves BTstack's
  single HID-host slot. Outgoing HID connects are attempted only for devices
  discovered during an active pairing inquiry. When no BTstack controller
  key exists at Bluetooth startup, the Pico automatically opens a five-minute
  local pairing window and starts discovery; the web interface is not required
  for first association.
- Bluetooth page scan is configured only after the radio reports
  `HCI_STATE_WORKING`. The HCI disconnection-complete event requests a
  foreground rearm after the old ACL/HID teardown, while connectability is
  rearmed only after that lifecycle boundary,
  discoverability remains disabled outside an active pairing window, and that
  window closes after the first complete CRC-valid enhanced `0x31` report.
- A newly observed Bluetooth address is kept provisional until its first valid
  DualSense input report. If that new attempt closes before validation, only
  the new unvalidated link key is discarded; keys that predated the attempt
  are preserved.
- After the Bluetooth HID descriptor is accepted, a bounded asynchronous
  bootstrap requests Feature reports `0x05`, `0x09` and `0x20` in order. Only
  one request is in flight, transient BTstack busy/not-ready responses are
  handled without blocking callbacks, and a bounded neutral-output fallback is
  available if the Feature path does not activate the enhanced input stream.
- Minimal Bluetooth input report `0x01` is treated as liveness evidence only.
  It cannot mark the controller connected, populate game input or persist a
  provisional controller. Those transitions require a complete enhanced
  report `0x31` with the expected size and a valid CRC.
- CYW43 and BTstack use the SDK polling async context. The main loop services
  USB first, dispatches radio/BTstack work, then advances the Bluetooth state
  machine, avoiding foreground/background BTstack races.
- In the compiled `0.45` candidate, a build-generated SDK source patch also
  keeps the relevant Bluetooth output path inside that serialization boundary.
  This is software evidence only until exercised on a real Pico 2 W.
- A stale HID CID released for explicit pairing is tombstoned until its close;
  late descriptor, protocol and input events from it cannot overwrite the new
  pairing state.
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
  confirmation. `COMMIT_CONFIG` never disconnects USB: its two-byte
  acknowledgement reports whether the effective PID or serial policy requires
  re-enumeration. Only a separately confirmed `RECONNECT_USB` command can
  schedule it, after that command's response has actually been read.
- The configured standard/Auto/Edge mode selects only the USB persona. During
  pairing, discovery accepts supported standard and Edge identities regardless
  of that persona; strict descriptor, enhanced-report length and CRC checks
  still gate controller input.
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
vendored Opus and picotool. The HID-only configuration descriptor is checked at
compile time, and the UF2 is inspected locally for Pico 2 W / RP2350 ARM Secure
targeting. The Windows host-test executable is not launched during the 0.45
pass; its new pure assertions are compiled separately and the complete Pico
cross-build remains the release gate.

The first manual 0.35 flash showed that Windows enumerated the Pico but the
game-controller Properties test failed and no LED blink was observed. A manual
0.36 flash then exposed two `DualSense` entries in `joy.cpl`; both disappeared
when the Pico was unplugged.

The subsequent manual `0.37` test showed exactly one `DualSense` entry even
after a restart, which partially validates the corrected one-root USB topology.
After the physical controller was paired its LED turned off, but buttons and
sticks did not move in the Windows Properties panel. No Bluetooth packet was
captured during that test. Source analysis established a lock consistent with
the result: MiraLink accepted only enhanced Bluetooth report `0x31`, a
DualSense can begin with minimal report `0x01`, and MiraLink did not initiate
the Sony Feature-report activation sequence.

The subsequent manual `0.38` test confirmed one controller entry, a ready
MiraLink bridge, active Bluetooth input and working buttons/sticks. Diagnostics
reported an audio link with no stream. After the user changed polling, enabled
the USB serial and enabled the persisted PS flag, the serial-policy commit
caused the old implicit USB re-enumeration; the controller could not then be
reached or re-paired during that run. Status `0x04` recorded a page timeout, not
proof of an authentication or key-store failure.

The subsequent manual `0.39` test confirmed initial bridge pairing, a live
quick-test input sample, a functional Controller Lab, diagnostics and
configuration read. Isolated WebHID response read/write failures were logged.
The `joy.cpl` buttons/sticks and configuration-commit evidence remain from the
earlier `0.38` run; they were not separately repeated in the supplied `0.39`
log. After the controller was turned off, it did not reconnect from the
remembered key and had to be paired again.

Firmware `0.40` introduced the passive remembered-controller policy, but the
manual run showed that reconnect still failed after controller power-off and
after Pico reboot. Firmware `0.41` kept that policy and deferred page-scan
rearming after a HID close. Firmware `0.42` applies the same foreground-only
rearm when a configuration commit resumes local idle suspension, without
changing the report table, command identifiers or binary protocol version `1`.
Firmware `0.45` compares the reconnect lifecycle with the official DS5Dongle
`v0.7.2-hotfix` source and defers the passive rearm request until
`HCI_EVENT_DISCONNECTION_COMPLETE`; the actual BTstack writes remain in the
foreground poll. Reconnect after power-off, after Pico reboot and after abrupt
range/power loss, idle-resume recovery, plus explicit USB re-enumeration,
motion, touch, rumble, adaptive triggers and wake still require a fresh manual
`0.45` hardware test.

## Local manual-test candidate

`firmware/releases/0.45/` contains ELF, BIN, HEX, UF2 and SHA-256 values
created from the current source. To test, enter BOOTSEL mode on a Pico 2 W and
manually copy only `miralink_pico_firmware.uf2` to the `RPI-RP2` volume. The
firmware never flashes a board automatically.

The release UF2 is 1,415,168 bytes, covers `0x10000000..0x100acaac`, and has
SHA-256
`3FEA11515204D34E8167FF3F7FA80797499CB51358064B4405B829779CDA40B9`.
These values establish artifact identity only; firmware `0.45` remains
materially unvalidated until the manual reconnect matrix is complete.

The Sony-compatible VID/PID is an explicit experimental compatibility choice,
not an allocation or endorsement. Public distribution requires a separate
compatibility, trademark and platform-policy review.

To rebuild the UF2 from the ELF with the local SDK-matched picotool:

```text
picotool uf2 convert miralink_pico_firmware.elf miralink_pico_firmware.uf2 --family rp2350-arm-s --platform rp2350 --abs-block
```
