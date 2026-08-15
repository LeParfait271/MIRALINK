# Validation 0.54

## Scope

0.54 is a firmware candidate built from the current `main` source after a
comparison with the official [DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
The native `0x32` state output is queued first after HID report-mode setup;
Feature reports `0x05`, `0x09` and `0x20` follow through the existing bounded
retry state machine. The reconnect policy now also admits an authenticated
incoming ACL while the Pico rebuilds its RAM address cache after reboot. A new
explicit pairing action re-arms a bounded teardown retry when an old SDP/HID
CID outlives the first retry window. The goal is to activate enhanced reports
after a PS-only wake without requiring the web pairing window.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- Host core test: 1/1 passed with the corrected LLVM-MinGW runtime path.
- UF2 metadata: version 0.54, SDK 2.3.0, binary range `0x10000000..0x1006e51c`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.54 yet. The
previous v0.51/v0.52/v0.53 assets did not contain the complete 0.54 lifecycle change
and must not be used to evaluate this fix. Audio streaming remains disabled.

## Release artifact

`firmware/releases/0.54/miralink_pico_firmware.uf2` — 904,704 bytes
SHA-256: `E497C984AF845CED5BADF900EB88D16F986D12780157FC5E4C6ECC38B877C4F1`

Verify `SHA256SUMS.txt` before flashing and keep the previous firmware for
rollback.
