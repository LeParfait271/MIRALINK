# MiraLink — Product specification

## 1. Vision

MiraLink is a local-first control center for a Pico 2 W bridge and PlayStation controllers. It combines configuration, calibration, diagnostics, firmware verification and recovery into one coherent application.

It is not a reskin of an existing tool. The visual system, application structure, data model, firmware interface and safety model are original MiraLink work.

## 2. Target hardware

The first supported board is the Raspberry Pi Pico 2 W only. Other boards are out of scope until the user explicitly reopens that decision.

The controller workspace is intended to support DualSense, DualSense Edge, DualShock 4 and PlayStation VR2 controllers through independent adapters. Each adapter must be tested separately and must never be assumed to work simply because the device is visible to the browser.

## 3. Main application

The application is one desktop-first page with tabs:

- **Overview** — connected devices, health state and pending actions.
- **Bridge** — Pico 2 W settings stored in the board flash.
- **Controllers** — controller connection, stick calibration, range checks and history.
- **Diagnostics** — USB, radio, audio, battery, input and error checks.
- **Firmware** — installed version, local file inspection, checksum and recovery guidance.
- **Backups** — export, import, comparison and restore.
- **Logs** — local event history with redaction controls.

Multiple devices must be represented as separate cards or tabs. A write operation must always identify its target device.

## 4. Configuration requirements

The Pico 2 W remains the source of truth. The application reads the configuration, edits a local working copy, shows a diff, then asks for confirmation before committing it to flash.

The configuration covers all useful bridge controls:

- haptic strength;
- speaker, headset and microphone behavior;
- trigger reduction;
- polling mode;
- audio buffering;
- inactive timeout;
- controller mode;
- LED behavior;
- USB identity options;
- host wake behavior;
- volume locking and board status output when supported by the hardware revision.

Unknown fields must be preserved during a read/edit/write cycle whenever the schema allows it.

## 5. Safety model

- Read-only state is available before write permission is requested.
- Flash writes show a human-readable diff.
- Reset, reconnect, recovery and firmware operations use explicit confirmation dialogs.
- Invalid values are rejected in the application and firmware.
- The firmware validates packet type, length, schema and checksum before acting.
- A failed flash verification never reports success.
- Recovery instructions are available even when no device is connected.

## 6. Privacy model

MiraLink is local-first and telemetry-free:

- no analytics;
- no remote logging;
- no cloud backup;
- no remote device identifiers;
- no Bluetooth address upload;
- no external CDN required by the application.

Exports are user initiated. Sensitive identifiers are masked by default and can be revealed only by an explicit local action.

## 7. Visual language

- dark-only interface;
- deep blue-black and transparent oceanic surfaces;
- cyan primary signal colour with emerald secondary accents;
- crystalline blue fragments, cool white highlights and restrained warm warnings;
- octagonal panels and clipped corners;
- compact HUD typography with readable body text;
- animation only when it communicates state;
- visible focus rings and high contrast;
- original crystalline geometry only; no copied logos, game assets or proprietary artwork.

## 8. Languages

English is the default. The localisation system must support the official languages of the European Union plus additional European languages and regional variants without changing application code.

The initial locale catalogue is designed to cover EU languages, then extend to major non-EU and regional languages. Missing translations must fall back to English visibly and never render empty labels.

## 9. Local delivery

The first delivery is a local folder containing source, tests, documentation and, only after a successful build, a clearly identified UF2. No hosting, push or automatic flashing is part of the default workflow.
