# Validation 0.53

## Scope

0.53 is a firmware candidate built from the current `main` source after a
comparison with the official [DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
The native `0x32` state output is queued first after HID report-mode setup;
Feature reports `0x05`, `0x09` and `0x20` follow through the existing bounded
retry state machine. The reconnect policy now also admits an authenticated
incoming ACL while the Pico rebuilds its RAM address cache after reboot. The
goal is to activate enhanced reports after a PS-only wake without requiring
the web pairing window.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- Host core test: 1/1 passed with the corrected LLVM-MinGW runtime path.
- UF2 metadata: version 0.53, SDK 2.3.0, binary range `0x10000000..0x1006e4cc`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.53 yet. The
previous v0.51/v0.52 assets did not contain the complete 0.53 lifecycle change
and must not be used to evaluate this fix. Audio streaming remains disabled.

## Release artifact

`firmware/releases/0.53/miralink_pico_firmware.uf2` — 904,192 bytes
SHA-256: `1BC2559DA01F2926B65B3F160EABE5D07E76F77EAB6B201D07AFCF7FFF257163`

Verify `SHA256SUMS.txt` before flashing and keep the previous firmware for
rollback.
