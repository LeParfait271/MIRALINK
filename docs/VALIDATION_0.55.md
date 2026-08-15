# Validation 0.55

## Scope

0.55 is a firmware candidate built from the current `main` source after a
comparison with the official [DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
The native `0x32` state output is queued first after HID report-mode setup;
Feature reports `0x05`, `0x09` and `0x20` follow through the existing bounded
retry state machine. The reconnect policy admits an authenticated incoming
ACL while the Pico rebuilds its RAM address cache after reboot. An explicit
pairing action re-arms a bounded teardown retry when an old SDP/HID CID
outlives the first retry window. Bootstrap reports, Feature GETs and
controller outputs wait for the active ACL encryption event.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Host core test: 1/1 passed.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- UF2 metadata: version 0.55, SDK 2.3.0, binary range `0x10000000..0x1006e6cc`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.55. Previous
v0.51 through v0.54 assets did not contain the complete 0.55 lifecycle change
and must not be used to evaluate this fix. Audio streaming remains disabled.

## Release artifact

`firmware/releases/0.55/miralink_pico_firmware.uf2` - 905,216 bytes
SHA-256: `287D17005E9CE30798764B3544DCC4C18A00CC32A596C8D41C70A95673DC98D6`

Verify `SHA256SUMS.txt` before flashing and keep the previous UF2 for rollback.
