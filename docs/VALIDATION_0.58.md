# Validation 0.58

## Scope

0.58 removes the remaining early HID-admission gate identified by comparing
MiraLink with the official [DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
The Pico now admits a gamepad-class ACL and its HID service before consulting
the rebuilt RAM bond cache or an active pairing window. Strict descriptor
handling and CRC-valid enhanced report `0x31` input remain the trust boundary;
this is not an unauthenticated-device claim.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Host core test: 1/1 passed with the versioned LLVM-MinGW runtime on `PATH`.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- UF2 metadata: version 0.58, SDK 2.3.0, binary range `0x10000000..0x1006e62c`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.58. The
previous manual runs established initial pairing and live Controller Lab input
but repeatedly failed PS-only reconnect; they do not prove or disprove this
new ACL/HID admission path. USB audio streaming remains disabled.

## Release artifact

`firmware/releases/0.58/miralink_pico_firmware.uf2` — 905,216 bytes
SHA-256: `62C6B2576162E0DDA93BC4D8797E2EDE96713FA99D5409ED918B2E79F6C99BEC`

Verify `SHA256SUMS.txt` before flashing. Keep the 0.57 UF2 available for
rollback; only one eventual hardware validation run is needed after this
source-level batch is accepted.
