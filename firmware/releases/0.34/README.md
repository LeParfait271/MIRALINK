# MiraLink Pico 2 W firmware 0.34

This is a local manual-test candidate for Raspberry Pi Pico 2 W only. It was
built from MiraLink source in this repository on 2026-08-13. It is neither
published nor flashed automatically.

The firmware version is deliberately identical to the public site version.
The source build uses CMake's technical form `0.34.0`, while the Pico metadata
and the released UF2 report `0.34`.

## Connection fix

- Restored the HID-only USB configuration used by the stable connection path.
- Kept the MiraLink vendor HID bridge and the standard gamepad collection with
  unique report identifiers: `0x01` command, `0x02` response, `0x03` event,
  `0x10` gamepad and `0x11` controller output.
- Kept 65-byte TinyUSB feature-report buffers for the report ID plus 64 data
  bytes expected by the bridge.
- Disabled the unvalidated UAC2 composite descriptor from the active USB
  configuration. The audio source remains in the tree for a separate,
  hardware-validated integration.

## Verification completed

- Application tests: 64 passed.
- Application JavaScript syntax checks: passed.
- Native MiraLink core test: passed (`1/1`).
- Pico 2 W / RP2350 ARM Secure target compiled locally.
- The UF2 was inspected locally with picotool: `MiraLink Pico 2 W`, version
  `0.34`, board `pico2_w`, target `RP2350 ARM Secure`.
- SHA-256 values are listed in `SHA256SUMS.txt`.

## Manual test boundary

No Pico 2 W or DualSense was connected during this build session. Windows HID
enumeration, Chrome WebHID discovery and `HELLO`, Bluetooth pairing and
reconnection, controller input, rumble, adaptive triggers and flash persistence
remain unvalidated on physical hardware.

To test, put the Pico 2 W into BOOTSEL mode and copy **only**
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. Then unplug/reconnect the
Pico and first confirm that the HID interfaces start without Code 10. No
automatic flashing occurs.
