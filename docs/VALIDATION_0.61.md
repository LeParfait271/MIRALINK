# Validation 0.61

MiraLink 0.61 is a source-and-release candidate built from the passive
reconnect hardening commit and the subsequent version bump. It adds an
offline BOOTSEL recovery path and a deterministic Bluetooth event-replay
harness; no claim of radio or controller hardware validation is made here.

Evidence:

- Official DS5Dongle behavior remains the diagnostic reference for passive
  reconnect and incoming HID activation.
- Pico Release cross-build: PASS; `picotool` reports version `0.61`, Pico 2 W,
  RP2350 ARM Secure, binary range `0x10000000..0x1006ec0c`.
- Host core test: 1/1 PASS.
- Deterministic Bluetooth event replay: 32,768/32,768 scenarios PASS.
- Reconnect-generation stress: 512/512 cycles PASS.
- Application unit tests: 109/109 PASS.
- Desktop Playwright journeys: 16/16 PASS.
- Physical Pico 2 W/DualSense test: not performed for 0.61 yet.

Firmware artifacts:

- `firmware/releases/0.61/miralink_pico_firmware.uf2`
- 908,288 bytes
- SHA-256 `F219127363CD6F4B088F42DF4F91AD4736975CE7AE1564434E8C100B59058CED`

No Bluetooth key or configuration reset is performed by flashing this build.
The physical BOOTSEL hold gesture is an explicit local action that clears
Bluetooth link keys only.
