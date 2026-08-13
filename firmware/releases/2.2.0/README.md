# MiraLink Pico 2 W firmware 2.2.0

Local manual-test candidate compiled from the independent MiraLink source for
the Raspberry Pi Pico 2 W (`pico2_w`, RP2350 ARM Secure / `rp2350-arm-s`).

## What changed

- Replaced the failing USB composite descriptor with one HID-only
  configuration containing the MiraLink feature channel and standard gamepad
  collection.
- Removed the active UAC2 interface after Windows reported Code 10 on both the
  audio and HID child interfaces of the previously installed 2.0.0 composite
  firmware.
- Kept local DualSense Bluetooth discovery, input validation, configuration
  persistence, diagnostics and bounded output routes in the source.

USB audio is unavailable in this candidate. The audio pipeline remains in the
source for a later descriptor-specific validation cycle; it is not exposed by
the USB descriptor and no audio stream is claimed.

## Manual installation

1. Hold `BOOTSEL` while connecting the Pico 2 W by USB.
2. Copy `miralink_pico_firmware.uf2` to the `RPI-RP2` drive.
3. Wait for the drive to disappear and the Pico to reboot.
4. Open MiraLink in desktop Chrome or Edge and select the MiraLink HID bridge.
5. Confirm that Windows shows the bridge without a Code 10 error before
   opening the local pairing window.
6. Open the local pairing window from MiraLink, then hold `PS + Create` on the
   DualSense until it is discoverable.

No automatic flash, rollback, push or publication is performed. This candidate
has not been flashed or tested on a physical Pico 2 W or DualSense.

## Files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1398784 | `1027599BC3E81F352BC4C6DEBE738B5287211EB41EC1E206EA37FE2D1699BC54` |
| `miralink_pico_firmware.elf` | 4376384 | `5555D8587694BE5997E9E6FA62EC738E328526044457A34B7DCA5766B06030B4` |
| `miralink_pico_firmware.bin` | 698884 | `771A6A238AD3AF927A09C52521FB3BD6DB70BC5B620617E68A29ADFFDBE493D7` |
| `miralink_pico_firmware.hex` | 1965860 | `036C784F91DB7791C39628A0CF63E7D07C2CD56319DE9DEC040925226CDAC6E6` |
