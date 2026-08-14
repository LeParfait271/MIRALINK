# MiraLink

MiraLink is a new, independent desktop control center and Pico 2 W firmware project.

The project is intentionally created from zero. It has its own application, firmware, communication protocol, configuration store, visual language, tests and release process.

## Current identity

- Product: MiraLink
- Developer: MaruChiwa
- Initial version: `0.1.0`
- Current site version: `0.40`
- Current firmware version: `0.40` (passive remembered-controller reconnect candidate, persistent `0x71` response reads and hardened WebHID transactions; USB audio remains source-only)
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

The manual Windows test of firmware `0.38` confirmed one bridge-owned
controller and working buttons/sticks in `joy.cpl`; its configuration commit
also reached the Pico before the then-implicit USB re-enumeration. The later
`0.39` run confirmed initial bridge pairing, a live input sample in the quick
test, a functional Controller Lab, diagnostics and configuration read. It did
not separately prove a `0.39` commit. Motion, touch, controller outputs,
suspend/wake and audio were not physically validated.

The same `0.39` run exposed a reconnect defect: after the controller was turned
off it could not reconnect from its remembered key and had to be paired again.
Source analysis found that an automatic outgoing `hid_host_connect` could
reserve BTstack's single HID-host slot while the remembered controller was
trying to reconnect inbound. Candidate `0.40` therefore listens passively for
remembered controllers, permits outgoing HID connects only during an explicit
pairing inquiry, enables page scan only after `HCI_STATE_WORKING`, and closes
the pairing window after the first complete CRC-valid `0x31` report. This fix
is software-validated only until a new Pico 2 W/DualSense hardware run.

The web application is an original desktop control deck with working WebHID
discovery, guided diagnostics, local profiles, local UF2 inspection and an
offline shell. Version `0.40` keeps the quick-access navigation introduced in
`0.39` and hardens WebHID command handling with a cancellable per-device FIFO,
bounded response-read retries that never resend an ambiguously written
command, 100 ms controller polling, and explicit USB-disappearance checks for
`RECONNECT_USB`. The firmware keeps response `0x71` readable until the next
MiraLink command report produces either a success or error response. These
changes do not alter binary protocol version
`1`. The interface turns the former tab bar into an actual quick-access
navigator, keeps every tool visible in one continuous page,
softens the palette and uses original motion/depth effects. Controller Lab now
visualizes local input, battery, motion and touch and computes read-only stick
analysis. The observable workflows of DualShock Tools and DS5 Bridge Config
informed this feature inventory, but no third-party code or assets were copied
and no permanent controller calibration is exposed.

## Local build outputs

- Application bundle: run `node app/scripts/build.mjs`; output goes to `app/dist/`.
- Pico 2 W firmware: follow `firmware/pico/README.md`; output goes to the selected local build directory.
- Firmware inspection: use the local `picotool` and MiraLink's own UF2 validator before any manual hardware operation.
