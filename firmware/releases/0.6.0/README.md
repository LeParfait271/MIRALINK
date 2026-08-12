# MiraLink Pico 2 W firmware — 0.6.0

This is the locally built MiraLink firmware for the Raspberry Pi Pico 2 W
(RP2350 ARM Secure). It is an independent build and does not reuse the old
MiraLink-audited UF2.

## Contents

- `miralink_pico_firmware.uf2` — manual UF2 image;
- `SHA256SUMS.txt` — checksum for the image.

## Scope of this build

- USB HID MiraLink protocol with persistent configuration in Pico flash;
- Classic HID host input path for DualSense Bluetooth reports;
- CRC-checked DualSense Bluetooth input report `0x31`;
- typed controller-state events over USB;
- Bluetooth pairing window closed at boot and opened only by an explicit,
  confirmation-gated local command for five minutes;
- separate flash areas for MiraLink configuration and BTstack link keys.

Battery telemetry, audio, haptics and adaptive-trigger output are not claimed
by this build. No physical Pico 2 W or DualSense was connected during its
validation, so hardware behavior remains `not-tested`.

## Manual recovery boundary

No automatic flashing is performed. If the image is tested, use the Pico 2 W
BOOTSEL procedure manually, keep the previous known-good image available, and
verify the board identity after reboot. Stop if enumeration or configuration
verification fails; do not erase unrelated flash areas.

The visible MiraLink application control for opening the pairing window is
being connected by the parallel visual work. The application core already
requires confirmation and exposes the local `miralink:open-pairing-window`
action hook.
