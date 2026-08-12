# MiraLink — Protocol draft

This document defines a new MiraLink protocol. It is deliberately independent of earlier project formats.

## 1. Transport

The first transport is a vendor-defined USB HID feature-report channel exposed by the MiraLink Pico 2 W firmware. The USB identity and descriptor values will be assigned to MiraLink and kept in one protocol manifest.

The browser never sends raw flash commands. It sends typed MiraLink frames; the firmware decides whether a command is allowed.

## 2. Frame

Every feature report is exactly 64 bytes. The frame uses the beginning of the
report and the remaining bytes are required to be zero padding. This keeps the
browser transport deterministic and avoids silently truncating a USB HID
feature report.

| Field | Size | Meaning |
|---|---:|---|
| Magic | 2 bytes | `ML` |
| Protocol version | 1 byte | Frame protocol version |
| Flags | 1 byte | Response, error and continuation flags |
| Sequence | 2 bytes | Request/response correlation |
| Command | 1 byte | Typed operation |
| Payload length | 2 bytes | Little-endian bounded length |
| Payload | N bytes, 0..48 | Command-specific data |
| CRC32 | 4 bytes | Frame integrity |
| Padding | Remaining bytes | Must be zero |

The firmware rejects a frame if the report is not exactly 64 bytes, the
declared payload is outside the report, the CRC fails, the padding is not zero,
or the command is not supported.

## 3. Commands

- `HELLO` — protocol and capability negotiation.
- `GET_INFO` — firmware, board and capability information.
- `GET_CONFIG` — read the persistent configuration.
- `SET_CONFIG_DRAFT` — validate and stage a complete configuration in RAM.
- `COMMIT_CONFIG` — write the staged configuration to flash and verify it.
- `RESET_CONFIG` — restore safe defaults after confirmation.
- `RECONNECT_USB` — intentionally re-enumerate the USB device.
- `GET_DIAGNOSTICS` — return structured health data.
- `GET_LOG_PAGE` — return bounded local diagnostic records.
- `ENTER_RECOVERY` — enter a documented recovery state after confirmation.

## 4. Configuration record

Configuration records are versioned, length-delimited and checksum protected. New fields are appended. An older reader must preserve unknown fields when it can do so safely; otherwise it must refuse the write instead of silently dropping them.

## 5. Error model

Errors are typed and safe to display:

- invalid frame;
- unsupported protocol;
- unsupported command;
- invalid schema;
- invalid value;
- busy;
- flash verification failed;
- device not ready;
- recovery required.

Error text is data, not HTML. The application renders it as text.
