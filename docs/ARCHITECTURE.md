# MiraLink — Architecture

## 1. Principles

MiraLink is built as independent layers with narrow contracts. The web application, firmware and controller adapters do not share hidden state or undocumented side effects.

## 2. Repository layers

### Application

The application is a local static web application with no runtime dependency on a remote service. It owns:

- navigation and accessibility;
- device discovery;
- local working state;
- configuration diff and backup files;
- diagnostics presentation;
- firmware file inspection;
- local logs and redaction.

### Firmware

The firmware owns:

- Pico 2 W hardware initialization;
- controller radio transport when a validated Pico-side transport is present;
- USB HID exposure;
- MiraLink command transport;
- configuration validation and flash persistence;
- diagnostics collection;
- recovery state.

The firmware must remain safe when the application disappears, disconnects or sends malformed data.

### Protocol

The protocol is defined in `docs/PROTOCOL.md` and implemented independently on both sides. No UI code may depend on firmware struct layout directly; it must use a versioned decoder.

### Controller adapters

Each controller family has an adapter with:

- discovery rules;
- connection mode checks;
- report-length validation;
- input decoding;
- calibration operations;
- error mapping;
- test fixtures.

The first DualSense tranche adds a standalone wired USB report parser to the
firmware core and a local WebHID input adapter in the application. The Pico 2 W
firmware also contains a Classic HID host path for the DualSense Bluetooth
input report (`0x31`, CRC checked) and relays validated samples through the
native-size USB input report `0x01`. MiraLink management uses Feature reports
`0x70`/`0x71` in a vendor collection nested under the single root Gamepad
Application collection of the same HID interface;
the app polls typed controller state so management traffic does not compete
with game input. A fresh Pico with no remembered key opens a bounded local
pairing window automatically; it can also be reopened by a confirmed command.

During that explicit window the Pico performs a bounded Bluetooth inquiry and
filters Sony DualSense identities before attempting a Classic HID connection.
The firmware also exposes bounded diagnostics and in-memory diagnostic logs;
these are local state and are never uploaded or persisted as controller input.

The current firmware forwards validated input and exposes bounded routes for
battery state, compatible rumble, lightbar, microphone mute and fixed
controller output. The USB audio pipeline remains source-only while the active
USB configuration is HID-only. A route in source is not a physical-effect
claim: Bluetooth audio, haptics, adaptive triggers and controller microphone
transport still require a distinct Pico 2 W and DualSense hardware validation.
The direct WebHID path and the Pico bridge path are kept distinct so a direct
controller connection cannot be presented as a Pico hardware test.

One adapter failure must not corrupt the state of another device.

## 3. State model

Every device has an explicit state:

`discovered → opening → identified → ready → busy → disconnected → error`

The UI must expose the state and the reason for an error. A device cannot receive a write command unless it is identified and ready.

## 4. Storage model

- Pico 2 W flash is the persistent source of truth for bridge settings.
- The firmware reserves two independent flash sectors for configuration records.
  Each record carries a schema, generation and CRC; a new record is written to
  the inactive sector, read back and validated before it becomes active.
- BTstack's local Bluetooth link-key bank is kept in a separate SDK-managed
  flash area; the MiraLink configuration sectors are deliberately offset to
  avoid overlap.
- The application stores only local preferences, draft changes and user-created backups.
- Backup files contain a schema version, device type, export date and checksum.
- Serial numbers and addresses are masked by default.

## 5. Test layers

- protocol unit tests;
- configuration validation tests;
- malformed-packet tests;
- application DOM and keyboard tests;
- firmware host-side tests for pure logic;
- build reproducibility checks;
- hardware tests with a real Pico 2 W and real controllers.

Hardware claims are reported separately from software-only validation.
