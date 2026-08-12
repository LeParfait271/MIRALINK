# MiraLink Pico 2 W firmware - 1.5.0

This is a locally built, manually installable test candidate for the Raspberry
Pi Pico 2 W. It comes from the independent MiraLink source tree and does not
reuse the supplied reference firmware.

## Changes in this candidate

- Corrects the DualSense full-report offsets for buttons, motion, touch and
  battery status over Bluetooth.
- Adds schema-2 controller state and explicit capability negotiation.
- Adds bounded compatible rumble, RGB lightbar/player LEDs and microphone mute
  output commands through a local Bluetooth queue with output CRC validation.
- Stops a requested rumble pulse automatically after at most 3000 ms.
- Keeps audio streaming and adaptive-trigger effects explicitly unavailable.

## Manual installation

1. Keep the Pico 2 W connected by USB.
2. Enter BOOTSEL mode manually.
3. Copy `miralink_pico_firmware.uf2` to the mounted Pico drive.
4. Wait for the drive to disappear and the Pico to restart.
5. Open MiraLink locally, connect the bridge and confirm its pairing window.
6. Put the DualSense into pairing mode with **PS + Create** until its light
   bar flashes, then wait for the bridge to report live input.

No flash is automatic. A successful build and a stored Bluetooth link key are
not proof that a real controller is connected. This candidate has not been
flashed or physically validated in this workspace.

## Build identity

- Board: Raspberry Pi Pico 2 W
- Target: RP2350 ARM Secure (`rp2350-arm-s`)
- Version: 1.5.0
- UF2 size: 874496 bytes
- SHA-256: `EFFDED512D0A8DF5EF74EF047F9148D5C26DA52DE8DE4E854B5E0580906879F5`

The USB VID/PID remains the MiraLink development identity and is not a public
production identity. MiraLink never flashes the board automatically.
