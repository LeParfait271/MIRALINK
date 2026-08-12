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
- `GET_CONTROLLER_STATE` — return the latest validated Pico-side controller state.
- `OPEN_PAIRING_WINDOW` — open the Pico Bluetooth pairing window after an explicit local confirmation.
- `GET_CONTROLLER_CAPABILITIES` — return the connected controller model, transport and explicitly supported local capabilities.
- `SEND_HAPTIC` — request one bounded, temporary DualSense compatible-rumble pulse; the firmware automatically schedules a neutral stop.
- `SET_LIGHTBAR` — set the DualSense RGB lightbar and player indicator mask through a bounded local request.
- `SET_MICROPHONE_MUTE` — request the DualSense microphone mute LED/power state.

### 3.1 Current diagnostics payload

`GET_DIAGNOSTICS` returns 18 structured bytes for schema `2`. The application
keeps accepting the historical three-byte schema `1` so an older local build
does not become unreadable:

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 1 | Diagnostics schema (`2`) |
| 1 | 1 | Configuration loaded from a valid flash record (`0` or `1`) |
| 2 | 1 | MiraLink USB device mounted (`0` or `1`) |
| 3 | 1 | Pico Bluetooth host initialized (`0` or `1`) |
| 4 | 1 | Pairing window open (`0` or `1`) |
| 5 | 1 | Bluetooth inquiry active (`0` or `1`) |
| 6 | 1 | Controller connection pending (`0` or `1`) |
| 7 | 1 | Controller link connected (`0` or `1`) |
| 8 | 1 | Controller HID descriptor received (`0` or `1`) |
| 9 | 1 | At least one validated input report received (`0` or `1`) |
| 10 | 4 | Validated input sample count, little-endian |
| 14 | 4 | Rejected input report count, little-endian |

`bluetoothAvailable` means that the Pico radio host initialized; it does not
claim that a controller is connected. Audio streaming and adaptive-trigger
effects remain explicitly unavailable. Battery status, compatible rumble,
lightbar, motion, touch and microphone state are reported only after a
validated DualSense input report has been received.

### 3.2 Pico controller state payload

`GET_CONTROLLER_STATE` and event report `0x03` use a 48-byte payload for schema
`2`. The application still accepts the historical 16-byte schema `1`:

| Offset | Meaning |
|---:|---|
| 0 | State schema (`2`) |
| 1 | Flags: connected `0`, descriptor `1`, input `2`, Bluetooth available `3`, pairing window `4`, inquiry `5`, connection pending `6` |
| 2 | Controller report ID |
| 3..6 | Left X/Y and right X/Y, raw bytes `0..255` |
| 7..8 | Left and right trigger, raw bytes `0..255` |
| 9 | D-pad and face-button byte |
| 10 | Shoulder, stick and option-button byte |
| 11 | System, touchpad and mute-button byte |
| 12..15 | Reserved and zero-filled for the legacy portion |
| 16 | Battery percentage, or `0xff` when unknown |
| 17 | Battery state: `0` unknown, `1` discharging, `2` charging, `3` full, `4` error |
| 18 | Status bits: battery valid `0`, headphone `1`, microphone `2`, mute `3`, touch 0 `4`, touch 1 `5` |
| 19 | DualSense input sequence byte |
| 20..31 | Gyroscope and accelerometer signed little-endian 16-bit values |
| 32..35 | Sensor timestamp, little-endian |
| 36..43 | Two touch points as little-endian X/Y pairs |
| 44..47 | Reserved and zero-filled |

The event is persistent only in the current USB transfer; the firmware does
not record controller input in flash.

`OPEN_PAIRING_WINDOW` is confirmation-gated by the application and lasts five
minutes. It does not flash firmware or write configuration. Incoming HID
connections outside that window are declined.

### 3.3 Local diagnostics and recovery commands

`GET_LOG_PAGE` accepts an optional one-byte page index and returns a bounded
local record: schema, page, presence, timestamp, message length and at most
40 UTF-8 message bytes. The records live in a 12-entry RAM ring and are lost
when the Pico restarts; controller input is never written to this log.

`RECONNECT_USB` accepts no payload and schedules a local USB re-enumeration
after the acknowledgement. `ENTER_RECOVERY` accepts exactly the confirmation
token `RCV1` and schedules the Pico BOOTSEL recovery path. The application must
confirm both actions separately; the firmware never triggers either one from a
background event.

### 3.4 DualSense output payloads

`GET_CONTROLLER_CAPABILITIES` returns eight bytes: schema, connected flag,
transport (`1` for Bluetooth), model (`1` for DualSense), a little-endian
capability mask and the maximum haptic duration. The capability mask currently
includes battery, compatible rumble, lightbar, motion, touchpad, audio-status
and microphone-mute state. Adaptive triggers are deliberately not advertised.

`SEND_HAPTIC` accepts `[schema=1, left motor, right motor, duration-ms-le16]`
with a duration from 1 to 3000 ms. `SET_LIGHTBAR` accepts
`[schema=1, red, green, blue, player-led-mask]`; `SET_MICROPHONE_MUTE` accepts
`[schema=1, muted]`. These commands never write flash, never accept raw HID
frames and remain unavailable unless the Pico has a ready validated controller
link. The Bluetooth output packet is held in a bounded local queue and its
compatible-rumble pulse is stopped automatically.

### 3.5 DualSense adapter boundary

The application can identify a standard wired DualSense locally through Sony
VID `0x054c` and product ID `0x0ce6`, then decode its USB input report ID
`0x01` into local Controller Lab samples. This is a direct computer-to-controller
adapter for software verification; it is not the Pico bridge path. The Pico
host accepts the Bluetooth input report ID `0x31` only after length and CRC
validation. Direct WebHID controller mode remains input-only; the output
commands above are bridge-only.

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
