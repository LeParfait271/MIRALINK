# MiraLink firmware 0.61

This candidate adds offline BOOTSEL recovery gestures and extends the
Bluetooth lifecycle contract tests with deterministic event-fault replay,
teardown-order coverage and reconnect-generation stress. The incoming HID
path also arms the native DualSense state activation at descriptor discovery.

Build target: Pico 2 W / RP2350 ARM Secure / Pico SDK 2.3.0 / Release.

Validation performed locally:

- Pico cross-build: passed
- host core test: 1/1 passed
- application unit tests: 109/109 passed
- desktop Playwright journeys: 16/16 passed
- deterministic Bluetooth event replay: 32,768 scenarios passed
- reconnect-generation stress: 512 cycles passed
- physical Pico/DualSense reconnect: not yet validated
- USB Audio: still source-only and disabled in the shipped USB persona

The UF2 is a firmware image only. It does not erase Bluetooth bonds or alter
configuration storage. The BOOTSEL hold gesture is the explicit exception: it
clears Bluetooth link keys only, then opens a fresh pairing window.

Developer: MaruChiwa
Version: 0.61
Date: 2026-08-16
