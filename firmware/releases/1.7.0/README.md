# MiraLink Pico 2 W firmware 1.7.0

Candidate firmware built locally for the Raspberry Pi Pico 2 W (RP2350 ARM
Secure / `rp2350-arm-s`). This release is independent MiraLink firmware and
does not reuse the reference firmware or its protocol.

## What changed

- Bluetooth link keys use the Pico SDK's local BTstack database; MiraLink does
  not create a second storage instance.
- Reconnection rotates through remembered controllers with bounded delays.
- SSP confirmation accepts the local pairing window and known paired addresses.
- A HID connection that produces no valid DualSense report is closed after a
  bounded ten-second handshake timeout and returned to local reconnection.
- Compile-time assertions prevent MiraLink configuration sectors from
  overlapping BTstack link-key storage.

## Supported path in this candidate

- DualSense Bluetooth input to the Pico 2 W.
- MiraLink vendor HID configuration and diagnostics.
- Standard USB gamepad relay after a validated controller report.
- Local configuration persistence, recovery, haptics, lightbar, player LEDs
  and microphone mute commands, subject to real-hardware validation.

Audio streaming and adaptive-trigger effects remain explicitly unavailable in
this hardware/protocol implementation. The application must show them as
unsupported; they are not silently simulated.

## Manual installation and pairing

1. Hold the Pico 2 W `BOOTSEL` button while connecting it by USB.
2. Copy `miralink_pico_firmware.uf2` to the `RPI-RP2` drive.
3. Wait for the drive to disappear and the Pico to reboot.
4. Open MiraLink in a desktop Chrome/Edge context with WebHID enabled.
5. Connect the MiraLink bridge, open the local Bluetooth pairing window, then
   hold `PS + Create` on the DualSense until it is discoverable.
6. Wait for the controller to connect and validate input before using output
   features.

There is no automatic flash or automatic firmware rollback. Keep the previous
release available for manual recovery. A release copied to the Pico must be
tested on a real Pico 2 W and a real DualSense; this workspace has not made
that physical test.

## Files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 876544 | `4368CAE89F0A56DC4E1AC9FE66BC9CA4259D36A1458CA0C3CE7A2E84A4964ADD` |
| `miralink_pico_firmware.elf` | 2729392 | `B84509A8AB080B702D1B8E07A935957AFDB0A7ADF44FE80B3E61AFB635B015A5` |
| `miralink_pico_firmware.bin` | 437788 | `903EEBD85AF610154F1BA9F3819E9290D854C7E8F1741B930D40C60581736BA2` |
| `miralink_pico_firmware.hex` | 1231453 | `8BBEC2D9C43E922DE3F679C731262FE1B7FB6E66F72881FA3B86BA6690ADABF4` |

Build and software tests passed locally. Hardware status: **not tested**.
