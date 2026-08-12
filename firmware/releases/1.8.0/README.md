# MiraLink Pico 2 W firmware 1.8.0

Manual-test candidate compiled locally for the Raspberry Pi Pico 2 W (RP2350
ARM Secure / `rp2350-arm-s`). This is independent MiraLink firmware created
from zero. It does not reuse the supplied reference firmware, its binary, its
private protocol or its internal structures.

## What changed

- Added DualSense Edge USB identity support.
- Accepted bounded Bluetooth inquiry name hints when a controller exposes
  incomplete device metadata, while keeping the final HID report validation
  strict.
- Cleared stale HID connection identifiers after a failed handshake so a new
  pairing or remembered-controller retry can proceed.
- Increased HID descriptor storage for complete DualSense revisions.
- Removed the unsupported audio-status capability advertisement. Audio
  streaming and adaptive-trigger effects remain unavailable on this build.

## Supported path in this candidate

- DualSense and DualSense Edge Bluetooth input to the Pico 2 W.
- MiraLink vendor HID configuration and diagnostics.
- Standard USB gamepad relay after a validated controller report.
- Local configuration persistence, recovery, haptics, lightbar, player LEDs
  and microphone mute commands, subject to real-hardware validation.

## Manual installation and pairing

1. Hold the Pico 2 W `BOOTSEL` button while connecting it by USB.
2. Copy `miralink_pico_firmware.uf2` to the `RPI-RP2` drive.
3. Wait for the drive to disappear and the Pico to reboot.
4. Open MiraLink in desktop Chrome or Edge with WebHID enabled.
5. Connect the MiraLink bridge and confirm the local Bluetooth pairing window.
6. Hold `PS + Create` on the DualSense until it is discoverable.
7. Wait for the controller state to show a validated input report before using
   output features.

There is no automatic flash or automatic firmware rollback. Keep the previous
candidate available for manual recovery. This workspace has not tested this
candidate on physical hardware.

## Files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 876544 | `E31515DC209437115D1344103B19DB4C166BB5369A1AA23791C36517B79F030E` |
| `miralink_pico_firmware.elf` | 2729880 | `98103B8B4838709F0D05CF7B4228CE6BFB09E3A1852B801831CD60F2C0DCD74F` |
| `miralink_pico_firmware.bin` | 437836 | `1A6B09E3166211F41CBBBE11A4D03031B6ABB0497DD1E8A75AAC8CA55552674E` |
| `miralink_pico_firmware.hex` | 1231588 | `7A70BE79CA18BD0079450DEFD0F356C6D27754F2B7FF4817D3346C1BFBDB8DD5` |

Software validation passed locally. Hardware status: **not tested**.
