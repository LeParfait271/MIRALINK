# MiraLink Pico 2 W firmware - 1.6.0

This is a locally built, manually installable test candidate for the Raspberry
Pi Pico 2 W. It comes from the independent MiraLink source tree and does not
reuse the supplied reference firmware.

## Changes in this candidate

- Accepts the legacy DualSense Bluetooth PIN `0000` only during the explicit
  local pairing window or for a controller address already known to BTstack.
- Accepts MiraLink HID feature commands with or without the report ID in the
  TinyUSB callback buffer while still rejecting invalid sizes.
- Retains the validated DualSense input path, schema-2 state and bounded output
  commands from 1.5.0: rumble, lightbar/player LEDs and microphone mute.
- Keeps audio streaming and adaptive-trigger effects explicitly unavailable.

## Manual installation

1. Keep the Pico 2 W connected by USB.
2. Enter BOOTSEL mode manually.
3. Copy `miralink_pico_firmware.uf2` to the mounted Pico drive.
4. Wait for the drive to disappear and the Pico to restart.
5. Open MiraLink locally, connect the bridge and open the pairing window.
6. Put the DualSense into pairing mode with **PS + Create** until its light
   bar flashes, then wait for the bridge to report live input.

No flash is automatic. A successful build is not proof that a real controller
is connected. This candidate has not been flashed or physically validated in
this workspace.

## Build identity

- Board: Raspberry Pi Pico 2 W
- Target: RP2350 ARM Secure (`rp2350-arm-s`)
- Version: 1.6.0
- UF2 size: 874496 bytes
- UF2 SHA-256: `7E815731D10D445ED6E175E98575D824B5BF1C6A3CB0F5A2F0B44446754E0909`
- SDK: Pico SDK 2.3.0
- Arm toolchain: 15.2.1

The USB VID/PID remains the MiraLink development identity and is not a public
production identity. MiraLink never flashes the board automatically.
