# MiraLink Pico 2 W firmware 0.32

This is a local manual-test candidate for Raspberry Pi Pico 2 W only. It was
built from MiraLink source in this repository on 2026-08-13. It is neither
published nor flashed automatically.

## Included functionality

- Persisted speaker volume, headset-monitor volume, bounded speaker gain and
  trigger-effect reduction.
- Conservative local inactivity suspension, optional USB serial exposure and a
  disabled-by-default status GPIO limited to Pico 2 W pins `0..22`.
- Local DualSense pairing/reconnection, validated input forwarding, bounded
  controller output, haptics/lightbar routes and local diagnostics.
- Standard UAC2 playback plus a RAM-only local playback-monitor capture. The
  capture endpoint is not a DualSense microphone transport.

## Verification completed

- Native MiraLink core tests passed (`1/1`).
- Pico 2 W / RP2350 ARM Secure target compiled locally.
- The UF2 was inspected locally: `MiraLink Pico 2 W`, version `0.32`,
  RP2350 ARM Secure.
- SHA-256 values are listed in `SHA256SUMS.txt`.

## Manual test boundary

No Pico 2 W or DualSense was connected during this build session. Windows
enumeration, pairing/reconnection, USB Audio Class 2, speaker, haptics,
adaptive triggers, idle wake-up and status GPIO are not hardware-validated.

To test, put the Pico 2 W into BOOTSEL mode and copy **only**
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. Then unplug/reconnect the
Pico and check the HID and audio interfaces. No automatic flashing occurs.
