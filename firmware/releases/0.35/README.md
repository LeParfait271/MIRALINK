# MiraLink Pico 2 W firmware 0.35

This is a local manual-test candidate for Raspberry Pi Pico 2 W only. It was
built from MiraLink source in this repository on 2026-08-14. It is neither
published nor flashed automatically.

## Connection fix

- When the Pico Bluetooth key database is empty, the firmware automatically
  opens a five-minute local pairing window as soon as BTstack reaches
  `HCI_STATE_WORKING`.
- The Pico becomes discoverable, starts inquiry and accepts the first
  DualSense/DualSense Edge association without a WebHID command or a web page.
- A controller already remembered by BTstack keeps the direct key-based
  reconnect path.
- The HID-only USB descriptor keeps the MiraLink vendor bridge and the
  standard gamepad collection. Windows can enumerate the gamepad collection
  independently of the web interface; only validated Bluetooth input feeds it.

## Verification completed

- Pico 2 W / RP2350 ARM Secure target compiled locally with Pico SDK 2.3.0 and
  Arm GNU Toolchain 15.2.1.
- Native MiraLink core tests and application tests are recorded in the
  corresponding validation document.
- UF2 inspected locally with picotool: `MiraLink Pico 2 W`, version `0.35`,
  board `pico2_w`, target `RP2350 ARM Secure`.
- SHA-256 values are listed in `SHA256SUMS.txt`.

## Manual test boundary

No Pico 2 W, DualSense or Windows game-controller panel was connected during
this build session. The actual first-pair association, Windows enumeration,
input reports and persistence remain physical tests.

To test manually, put the Pico 2 W into BOOTSEL mode and copy **only**
`miralink_pico_firmware.uf2` to the `RPI-RP2` volume. After it reboots, the
status LED should blink while the local pairing window is open. Put the
DualSense into pairing mode with **PS + Create**; once connected, Windows
should expose the standard MiraLink gamepad collection. No automatic flashing
occurs.
