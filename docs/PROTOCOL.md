# MiraLink — Protocol draft

This document defines a new MiraLink protocol. It is deliberately independent of earlier project formats.

## 1. Transport

The first transport is a vendor-defined USB HID Feature-report collection
inside the single root Gamepad Application collection of MiraLink's
experimental DualSense-family interface. Firmware 0.37 uses
Sony VID `0x054c` and PID `0x0ce6` or `0x0df2` for host compatibility; this is
not an assigned MiraLink identity, Sony firmware or an affiliation claim.

The browser never sends raw flash commands. It sends typed MiraLink frames; the firmware decides whether a command is allowed.

The single HID interface declares these non-colliding reports:

| ID | Type | Wire bytes | Purpose |
|---:|---|---:|---|
| `0x01` | Input | 64 | Native-size controller state |
| `0x02` | Output | 48 declared; 48 or 63 accepted | Bounded controller output body |
| `0x05` | Feature | 41 | Synthetic nominal-scale motion calibration fallback |
| `0x09` | Feature | 20 | Local/unicast bridge identifier required by host drivers |
| `0x20` | Feature | 64 | MiraLink-marked persona revision |
| `0x70` | Feature | 65 | MiraLink command frame |
| `0x71` | Feature | 65 | MiraLink response frame |

When USB serial exposure is disabled, the `0x09` identifier is generated once
per boot and retained only in RAM. When serial exposure is enabled, it is
stable and derived locally from the Pico identifier. It never reuses the
Bluetooth address of the attached controller. The synthetic calibration is a
safe probe fallback, not the factory calibration of the physical controller;
motion precision therefore still requires hardware measurement and a future
calibration pass-through path.

## 2. Frame

MiraLink command `0x70` and response `0x71` Feature payloads are exactly 64
bytes (65 bytes on the control wire after the report ID). The frame uses the beginning of the
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
- `SET_CONTROLLER_OUTPUT` — forward one validated, fixed-size DualSense USB output body through the MiraLink Bluetooth adapter.
- `GET_AUDIO_STATUS` — return local USB audio and Bluetooth audio-link counters.

For a first association, the web interface is optional: after firmware startup,
the Pico opens the local Bluetooth window automatically when its BTstack key
database is empty. `OPEN_PAIRING_WINDOW` remains available as a manual way to
reopen the five-minute window later.

### 3.1 Current diagnostics payload

`GET_DIAGNOSTICS` returns 48 structured bytes for schema `4`. The application
keeps accepting the historical three-byte schema `1`, 18-byte schema `2` and
28-byte schema `3` so an older local build does not become unreadable:

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 1 | Diagnostics schema (`4`) |
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
| 18 | 1 | USB UAC2 stream active (`0` or `1`) |
| 19 | 1 | Bluetooth audio stream active (`0` or `1`) |
| 20 | 4 | USB audio packet count, little-endian |
| 24 | 4 | Dropped audio-frame count, little-endian |
| 28 | 1 | Last Bluetooth failure stage (`0` none, `1` inquiry, `2` HID connect, `3` HID accept, `4` connection open, `5` protocol handshake, `6` descriptor, `7` timeout, `8` close) |
| 29 | 1 | Last Bluetooth status byte, or `0` when the stage has no status |
| 30..31 | 2 | Reserved and zero-filled |
| 32 | 4 | Bluetooth connection attempts, little-endian |
| 36 | 4 | Bluetooth connection failures, little-endian |
| 40 | 4 | Automatic-reconnect attempts, little-endian |
| 44..47 | 4 | Reserved and zero-filled |

`bluetoothAvailable` means that the Pico radio host initialized; it does not
claim that a controller is connected. Firmware 0.37 exposes one HID-only USB
interface with one root Gamepad Application collection and a nested MiraLink
vendor collection. The
UAC2 audio source remains source-compatible but is disabled from the active USB
descriptor until physical Pico 2 W validation is complete; USB audio counters
therefore remain inactive in this build. The capture endpoint is not a
DualSense microphone transport. No standard A2DP/SBC route is used.
`bluetoothStreaming` only means that a bounded audio report was accepted by the
local Bluetooth queue; it is not proof that a physical controller rendered
audio. Adaptive-trigger effects are reachable through the bounded output route
below but require real hardware validation. Battery status, compatible rumble,
lightbar, motion, touch and microphone state are reported only after a
validated DualSense input report has been received.

### 3.2 Pico controller state payload

`GET_CONTROLLER_STATE` returns a 48-byte payload for schema `2`. Firmware 0.37
does not declare or emit an asynchronous management Input report under the
Sony persona; the application polls this command every 40 ms. It still accepts
the historical 16-byte schema `1`:

| Offset | Meaning |
|---:|---|
| 0 | State schema (`2`) |
| 1 | Flags: connected `0`, descriptor `1`, input `2`, Bluetooth available `3`, pairing window `4`, inquiry `5`, connection pending `6`, paired controller known `7` |
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

Controller state is transient and is never recorded in flash.

`OPEN_PAIRING_WINDOW` is confirmation-gated by the application when invoked
manually and lasts five minutes. A fresh Pico with no remembered BTstack key
opens the same local window automatically after the radio reaches
`HCI_STATE_WORKING`; no web page command is required for the first association.
The command does not flash firmware or write configuration. Incoming HID
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
includes battery, compatible rumble, lightbar, motion, touchpad, audio-status,
microphone-mute state and the bounded adaptive-trigger output route. A bit in
this mask describes an available route; it is not a claim that a physical
controller has accepted or rendered the effect.

`SEND_HAPTIC` accepts `[schema=1, left motor, right motor, duration-ms-le16]`
with a duration from 1 to 3000 ms. `SET_LIGHTBAR` accepts
`[schema=1, red, green, blue, player-led-mask]`; `SET_MICROPHONE_MUTE` accepts
`[schema=1, muted]`. These commands never write flash, never accept raw HID
frames and remain unavailable unless the Pico has a ready validated controller
link. The Bluetooth output packet is held in a bounded local queue and its
compatible-rumble pulse is stopped automatically.

`SET_CONTROLLER_OUTPUT` accepts exactly `[schema=1, 47-byte USB output body]`.
The firmware validates the fixed size, copies it into a local queue, preserves
MiraLink ownership of the Bluetooth report id/sequence/CRC and sends the
result only when a validated controller link is ready. Native HID output report
`0x02` accepts the compact 48-byte wire form and the 63-byte Linux form; only
the first fixed 47-byte common body is relayed. No variable-length or arbitrary
HID payload is accepted.

`GET_AUDIO_STATUS` accepts no payload and returns 16 bytes:
`[schema=1, usb-streaming, bluetooth-streaming, bluetooth-link-available,
usb-packets-u32, dropped-frames-u32, bluetooth-packets-u32]`. Counters are
volatile and reset on restart.

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
