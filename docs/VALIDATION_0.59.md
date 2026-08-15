# Validation 0.59

## Scope

0.59 completes the ACL/security/timeout comparison against the official
[DS5Dongle v0.7.2-hotfix Bluetooth lifecycle](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).
MiraLink now tracks an incoming gamepad page before HID, answers the same
controller SSP/PIN fallback, removes the active stale key after authentication
failure, and closes an ACL that never reaches HID. The descriptor and strict
CRC-valid enhanced report `0x31` remain the functional trust boundary.

## Automated evidence

- Pico 2 W / RP2350 ARM Secure Release cross-build: passed.
- Host core test: 1/1 passed with the versioned LLVM-MinGW runtime on `PATH`.
- Web application syntax check: passed.
- Web application unit tests: 109/109 passed.
- Desktop Playwright scenarios: 16/16 passed.
- `npm audit --audit-level=low`: 0 vulnerabilities.
- UF2 metadata: version 0.59, SDK 2.3.0, binary range `0x10000000..0x1006e62c`.

## Hardware boundary

No physical Pico 2 W / DualSense run has been performed with 0.59. Earlier
manual runs established initial pairing and live Controller Lab input but
failed PS-only reconnect; they do not prove or disprove this completed ACL,
SSP, key-recovery and timeout path. USB audio streaming remains disabled.

## Release artifact

`firmware/releases/0.59/miralink_pico_firmware.uf2` — 905,216 bytes
SHA-256: `6BDC106E99B238C560E50295C4EAF3DECFAE9E1E2C0032885A25D35A3248ACE6`

Verify `SHA256SUMS.txt` before flashing. Keep the 0.58 UF2 available for
rollback. This batch is intended to reduce the hardware work to one final
reconnect validation, not a sequence of incremental guesses.
