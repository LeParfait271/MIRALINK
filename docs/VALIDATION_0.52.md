# Validation 0.52

## Scope

0.52 is a firmware candidate built from the current `main` source after a
comparison with the official [DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
The native `0x32` state output is now queued first after HID report-mode setup;
Feature reports `0x05`, `0x09` and `0x20` follow through the existing bounded
retry state machine. The goal is to activate enhanced reports after a PS-only
wake without requiring the web pairing window.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Host core test: 1/1 passed.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- UF2 metadata: version 0.52, SDK 2.3.0, binary range `0x10000000..0x1006e51c`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.52 yet. The
previous v0.51 asset did not contain this ordering change and must not be used
to evaluate the fix. Audio streaming remains disabled.

## Release artifact

`firmware/releases/0.52/miralink_pico_firmware.uf2` — 904,704 bytes
SHA-256: `26C11AEFAA34BEA031725BB087DFDB0189992A00FAAE7F54113C70BB1FC26D98`

Verify `SHA256SUMS.txt` before flashing and keep the previous firmware for
rollback.
