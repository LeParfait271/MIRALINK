# MiraLink Pico 2 W firmware - 1.4.0

This is a manually installable local test candidate for the Raspberry Pi Pico
2 W. It is built from the independent MiraLink source tree.

## Changes in this candidate

- Keeps the 65-byte HID control-transfer fix from 1.3.0.
- Reads locally stored BTstack link-key addresses after Bluetooth starts.
- Attempts a bounded reconnect to previously paired controllers.
- Accepts an incoming HID connection after the pairing window closes only when
  the controller address is already present in the local BTstack key database.
- Reports paired-controller knowledge in the MiraLink controller-state frame.
- Exposes a standard USB HID gamepad collection for validated live input and
  sends a neutral release report after a controller disconnects.

## Manual installation

1. Keep the Pico 2 W connected by USB.
2. Enter BOOTSEL mode manually.
3. Copy `miralink_pico_firmware.uf2` to the mounted Pico drive.
4. Wait for the drive to disappear and the Pico to restart.
5. Open MiraLink locally, connect the bridge and confirm the pairing window if
   a new DualSense must be paired.

No flash is automatic. A stored link key is not proof that a controller is
currently connected; the application must observe live controller counters.

## Build identity

- Board: Raspberry Pi Pico 2 W
- Target: RP2350 ARM Secure (`rp2350-arm-s`)
- Version: 1.4.0
- UF2 size: 867328 bytes
- SHA-256: `33F524019128FA2F17C1CB878CB257FC5023A5B20F077FAD3A7233568BB11219`

This candidate has not been flashed or validated on physical DualSense
hardware. Battery, audio, haptics and adaptive-trigger output remain explicitly
unavailable in this tranche.
