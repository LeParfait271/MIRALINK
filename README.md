# MiraLink

MiraLink is a new, independent desktop control center and Pico 2 W firmware project.

The project is intentionally created from zero. It has its own application, firmware, communication protocol, configuration store, visual language, tests and release process.

## Current identity

- Product: MiraLink
- Developer: MaruChiwa
- Initial version: `0.1.0`
- Current site version: `0.26`
- Current firmware version: `2.3.0` (HID-only USB recovery candidate; Windows Code 10 descriptor conflict corrected; audio USB remains deliberately unavailable)
- Last update: `2026-08-13`
- First hardware target: Raspberry Pi Pico 2 W
- Delivery mode: local only

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

## Local build outputs

- Application bundle: run `node app/scripts/build.mjs`; output goes to `app/dist/`.
- Pico 2 W firmware: follow `firmware/pico/README.md`; output goes to the selected local build directory.
- Firmware inspection: use the local `picotool` and MiraLink's own UF2 validator before any manual hardware operation.
