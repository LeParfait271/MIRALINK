# MiraLink Pico 2 W firmware 2.3.0

This is a local, manual-test release candidate for Raspberry Pi Pico 2 W only.
It was built from the MiraLink source in this repository on 2026-08-13.

## What changed

Windows reported `CM_PROB_FAILED_START` / Code 10 for the previously flashed
HID bridge. Static inspection found duplicated HID report IDs in the complete
descriptor. Version 2.3.0 gives each descriptor report a unique ID:

- command feature: `0x01`;
- response feature: `0x02`;
- event input: `0x03`;
- standard gamepad input: `0x10`;
- raw controller-output envelope: `0x11`.

The raw output continues to carry the same fixed, validated 47-byte DualSense
body. The internal DualSense packet format is not exposed as a second HID
report ID.

## Verification completed

- Native MiraLink core tests passed.
- The release UF2 identifies as `MiraLink Pico 2 W`, version `2.3.0`, target
  `RP2350`, image type `ARM Secure`, board `pico2_w`.
- SHA-256 values are listed in `SHA256SUMS.txt`.

## Limits and safe test

This release was not flashed or tested on a physical Pico 2 W in this build
session. USB audio remains unavailable. Adaptive trigger and Bluetooth output
paths are not claimed to be hardware-validated.

To test, enter BOOTSEL mode on a Pico 2 W and manually copy only
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. After reboot, first
confirm in Windows Device Manager that the HID device starts without Code 10;
then use Chrome's MiraLink page and choose the device in the WebHID dialog.
No automatic flash is performed by MiraLink.
