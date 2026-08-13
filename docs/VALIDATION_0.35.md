# MiraLink 0.35 firmware validation record

Date: 2026-08-14<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: local manual-test candidate only

## Change verified in source

When BTstack reaches `HCI_STATE_WORKING`, the firmware loads the local key
database. If it is empty, it calls the existing pairing-window path itself:
the Pico becomes discoverable, starts inquiry, blinks its status LED and accepts
the first matching DualSense HID connection. A controller with a remembered
key keeps the direct reconnect path. No WebHID request is needed to start the
first association.

The active USB descriptor remains HID-only and contains the MiraLink vendor
collections plus the separate standard gamepad collection (`report ID 0x10`).
The gamepad now emits a neutral report on USB mount and a bounded heartbeat
while Bluetooth input is unavailable; validated DualSense input replaces that
neutral state when it arrives. The Pico 2 W LED is driven through CYW43 GPIO.

## Static and automated validation

| Check | Result |
| --- | --- |
| Application tests | Passed (`64/64`) |
| Application JavaScript syntax checks | Passed |
| Native MiraLink core test | Passed (`1/1`) |
| Pico 2 W firmware build | Passed with ARM GNU 15.2.1 and Pico SDK 2.3.0 |
| Firmware source regression checks | Passed: boot pairing, discoverability, CYW43 LED path, neutral gamepad heartbeat, signed axes, HID-only policy and version metadata |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W, `0.35`, `pico2_w`, RP2350 ARM Secure |
| UF2 family | Passed: `rp2350-arm-s` |

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.35/miralink_pico_firmware.uf2` | 1,405,952 | `1DB6D29EFAE650E4B9E05C2783E89EEAD99079B6D7EA9FB1BE180124E2EA68E1` |
| `firmware/releases/0.35/miralink_pico_firmware.elf` | 4,433,968 | `03A13D4BAF0883339E3A2C31EC1E77D75CC99AE6013377D350EA69E4995824FB` |
| `firmware/releases/0.35/miralink_pico_firmware.bin` | 702,516 | `C59AF3A3FADAFCF5F88F5F79424813A113519519776720CB8D659B2624B44C9E` |
| `firmware/releases/0.35/miralink_pico_firmware.hex` | 1,976,062 | `07D77F856CE89C509E0E0F52190DA9B78AC77791657BD6317534B24ECD3D8A1C` |

## Hardware validation still required

The first 0.35 UF2 was flashed and checked by the user. Windows enumerated
`MiraLink Pico 2 W` with status `OK`, but opening Properties produced the
Windows error that the controller was not connected correctly; no status-LED
blink was observed. This is a real failure report, not a successful hardware
validation. The corrected UF2 above has not yet been flashed again. The
remaining manual checks are the corrected Properties test, live input reports,
the LED pairing window, first Bluetooth association, reconnection after a
reboot and BTstack key persistence.
