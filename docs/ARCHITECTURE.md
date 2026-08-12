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
- controller radio transport;
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
