# Validation 0.57

## Scope

0.57 is a firmware candidate built from the current `main` source after a
comparison with the official [DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
The native `0x32` state output is queued first after HID report-mode setup;
Feature reports `0x05`, `0x09` and `0x20` follow through the existing bounded
retry state machine. The reconnect policy explicitly accepts the incoming
gamepad ACL request and stops inquiry before admitting the authenticated
ACL while the Pico rebuilds its RAM address cache after reboot. The ACL
request no longer requires the rebuilt RAM address cache; authentication and
the strict HID descriptor/CRC boundary remain the trust gates. An explicit
pairing action re-arms a bounded teardown retry when an old SDP/HID CID
outlives the first retry window. Bootstrap reports, Feature GETs and
controller outputs wait for the active ACL encryption event.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Host core test: 1/1 passed.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- UF2 metadata: version 0.57, SDK 2.3.0, binary range `0x10000000..0x1006e704`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.57. Previous
v0.51 through v0.56 assets did not contain the complete 0.57 lifecycle change
and must not be used to evaluate this fix. Audio streaming remains disabled.

## Release artifact

`firmware/releases/0.57/miralink_pico_firmware.uf2` - 905,728 bytes
SHA-256: `5DE1452BB618E8DF1A629D5C56CC8293219AC5D5BAF4BDB24870C06E879041AC`

Verify `SHA256SUMS.txt` before flashing and keep the previous UF2 for rollback.
