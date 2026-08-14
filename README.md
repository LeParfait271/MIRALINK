# MiraLink

MiraLink is a new, independent desktop control center and Pico 2 W firmware project.

The project is intentionally created from zero. It has its own application, firmware, communication protocol, configuration store, visual language, tests and release process.

## Current identity

- Product: MiraLink
- Developer: MaruChiwa
- Initial version: `0.1.0`
- Current site version: `0.39`
- Current firmware version: `0.39` (explicit USB-identity re-enumeration, persona-independent DualSense/Edge discovery and the bounded Bluetooth enhanced-report bootstrap validated through real input on 0.38; USB audio remains source-only)
- Last update: `2026-08-14`
- First hardware target: Raspberry Pi Pico 2 W
- Delivery mode: GitHub source and manual firmware release

## Repository layout

- `app/` — MiraLink desktop-first web application.
- `firmware/` — new MiraLink Pico 2 W firmware.
- `protocol/` — protocol definitions shared by the application and firmware.
- `docs/` — product, architecture, safety and release documentation.
- `VERSION.json` — displayed version and update metadata.
- `MIRALINK_GARDE_FOU.md` — mandatory working rules.

## Start here

1. Read `MIRALINK_GARDE_FOU.md`.
2. Read `docs/PRODUCT_SPEC.md`.
3. Read `docs/ARCHITECTURE.md`.
4. Read `docs/PROTOCOL.md`.
5. Check `VERSION.json` before making a commit.

No external service is required for the local application, and no device is flashed automatically.

## Current validation state

The manual Windows test of firmware `0.38` confirmed one `DualSense` controller
entry, a ready MiraLink bridge, active Bluetooth input, and working buttons and
sticks in `joy.cpl`. Diagnostics reported USB, radio and flash available; the
audio link existed without a stream. Motion, touch, controller outputs,
suspend/wake and audio were not tested. The retained Bluetooth diagnostic was
`connection opening (status 0x04)`, a page timeout, and does not by itself prove
an authentication or stored-key failure.

That same run exposed a configuration lifecycle defect. Enabling the USB
serial number committed successfully, then firmware `0.38` re-enumerated USB
without a separate user decision; the controller subsequently could not be
reached or re-paired during the run. Firmware `0.39` no longer disconnects USB
from `COMMIT_CONFIG`. A versioned acknowledgement tells the application when
the effective PID or serial policy changed, and re-enumeration is a distinct,
confirmed action. Bluetooth discovery also accepts supported standard and Edge
controllers independently of the selected USB persona. These `0.39` recovery
changes still require a new physical test.

The web application is an original desktop control deck with working WebHID
discovery, guided diagnostics, local profiles, local UF2 inspection and an
offline shell. Version `0.39` turns the former tab bar into an actual
quick-access navigator, keeps every tool visible in one continuous page,
softens the palette and uses original motion/depth effects. Controller Lab now
visualizes local input, battery, motion and touch and computes read-only stick
analysis. The observable workflows of DualShock Tools and DS5 Bridge Config
informed this feature inventory, but no third-party code or assets were copied
and no permanent controller calibration is exposed.

## Local build outputs

- Application bundle: run `node app/scripts/build.mjs`; output goes to `app/dist/`.
- Pico 2 W firmware: follow `firmware/pico/README.md`; output goes to the selected local build directory.
- Firmware inspection: use the local `picotool` and MiraLink's own UF2 validator before any manual hardware operation.
