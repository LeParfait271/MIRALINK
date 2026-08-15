# MiraLink

MiraLink is a new, independent desktop control center and Pico 2 W firmware project.

The project is intentionally created from zero. It has its own application, firmware, communication protocol, configuration store, visual language, tests and release process.

## Current identity

- Product: MiraLink
- Developer: MaruChiwa
- Initial version: `0.1.0`
- Current site version: `0.58`
- Current firmware version: `0.58` (DS5-style gamepad ACL/HID admission for passive PS reconnect; USB audio remains source-only)
- Last update: `2026-08-15`
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
The manual `0.40` run reproduced the failure after controller power-off and
after a Pico restart: WebHID recovered the bridge, radio transport reported
`PASS`, but the known DualSense remained offline without opening a new pairing
window. Source inspection found a likely page-scan rearm hole: BTstack can keep
its cached `connectable` flag true after the controller disables page scan, so a
later `gap_connectable_control(1)` call does nothing. Candidate `0.41` deferred
the rearm to the foreground poll and forced a fresh page-scan enable command.
Candidate `0.42` applies the same foreground-only rule when a configuration
commit resumes the radio from local idle suspension. Candidate `0.46` used
the official DS5Dongle `v0.7.2-hotfix` behavior as a mandatory diagnostic
reference and queues passive page-scan recovery at
`HCI_EVENT_DISCONNECTION_COMPLETE`. Candidate `0.48` extends the same
comparison to authentication failures: only a remembered address on the
active ACL handle, still unvalidated by enhanced input, can be dropped.
These corrections remain software-validated until a new manual Pico 2 W/
DualSense run.

The web application is an original desktop control deck with working WebHID
discovery, guided diagnostics, local profiles, local UF2 inspection and an
offline shell. Version `0.58` keeps the quick-access navigation introduced in
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
and no permanent controller calibration is exposed. Firmware 0.51 also keeps a
four-slot ordered Bluetooth output FIFO so rapid controller output requests are
not silently replaced while BTstack is transmitting the previous packet.

## Local build outputs

- Application bundle: run `node app/scripts/build.mjs`; output goes to `app/dist/`.
- Pico 2 W firmware: follow `firmware/pico/README.md`; output goes to the selected local build directory.
- Firmware inspection: use the local `picotool` and MiraLink's own UF2 validator before any manual hardware operation.
