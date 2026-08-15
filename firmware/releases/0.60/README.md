# MiraLink firmware 0.60

This build fixes the passive PS-only reconnect deadlock found in 0.59. An
incoming HID connection accepted in Report mode does not produce a
`SET_PROTOCOL` response in BTstack; 0.60 therefore starts the descriptor and
DualSense activation sequence without waiting for that impossible event.

Build target: Pico 2 W / RP2350 ARM Secure / Pico SDK 2.3.0 / Release.

Validation performed locally:

- Pico cross-build: passed
- host core test: 1/1 passed
- physical Pico/DualSense reconnect: not yet validated
- USB Audio: still source-only and disabled in the shipped USB persona

The UF2 is a firmware image only. It does not erase Bluetooth bonds or alter
configuration storage.

Developer: MaruChiwa
Version: 0.60
Date: 2026-08-16
