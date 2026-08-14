# MiraLink

MiraLink is a new, independent desktop control center and Pico 2 W firmware project.

The project is intentionally created from zero. It has its own application, firmware, communication protocol, configuration store, visual language, tests and release process.

## Current identity

- Product: MiraLink
- Developer: MaruChiwa
- Initial version: `0.1.0`
- Current site version: `0.38`
- Current firmware version: `0.38` (experimental DualSense/Edge USB persona with native-size input/output reports, one proven Windows controller child and a bounded Bluetooth enhanced-report bootstrap; USB audio remains source-only)
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

The manual Windows test of firmware `0.37` showed exactly one `DualSense`
controller entry, so the corrected one-root USB topology is partially validated
on hardware. Pairing completed far enough for the controller LED to turn off,
but no buttons or sticks moved in the Windows controller properties. The
test did not capture Bluetooth packets. Source analysis subsequently found a
lock consistent with that result: `0.37` accepted only enhanced report `0x31`,
a DualSense can begin with minimal report `0x01`, and the bridge did not
initiate the Feature-report sequence needed to enable the enhanced stream.

Firmware `0.38` is the compiled software candidate for that failure. It runs a
bounded `0x05` → `0x09` → `0x20` Feature bootstrap, keeps minimal reports as
liveness-only evidence, and does not declare the controller connected until a
complete enhanced `0x31` report passes strict validation. This correction has
not yet been validated on a physical Pico 2 W and DualSense. Configuration
writes now use the SDK flash-safe executor, and radio startup failure falls
back to a usable USB diagnostic state instead of touching an uninitialized
Bluetooth lock.

The web application is now an original high-tech control deck with working
WebHID discovery, guided diagnostics, local profiles, local UF2 inspection and
an offline shell. Its current software baseline passes 98 unit tests and 20
desktop/mobile end-to-end scenarios; synthetic browser coverage is not a
physical bridge test.

## Local build outputs

- Application bundle: run `node app/scripts/build.mjs`; output goes to `app/dist/`.
- Pico 2 W firmware: follow `firmware/pico/README.md`; output goes to the selected local build directory.
- Firmware inspection: use the local `picotool` and MiraLink's own UF2 validator before any manual hardware operation.
