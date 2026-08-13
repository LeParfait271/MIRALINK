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
Only validated Bluetooth input is published into that gamepad report.

## Static and automated validation

| Check | Result |
| --- | --- |
| Application tests | Passed (`64/64`) |
| Application JavaScript syntax checks | Passed |
| Native MiraLink core test | Passed (`1/1`) |
| Pico 2 W firmware build | Passed with ARM GNU 15.2.1 and Pico SDK 2.3.0 |
| Firmware source regression checks | Passed: boot pairing, discoverability, HID gamepad, HID-only policy and version metadata |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W, `0.35`, `pico2_w`, RP2350 ARM Secure |
| UF2 family | Passed: `rp2350-arm-s` |

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.35/miralink_pico_firmware.uf2` | 1,404,928 | `F582A42B5DE51FACCFC79340A68024DB64E0F3188B92F61EAE26B7D3BD582E00` |
| `firmware/releases/0.35/miralink_pico_firmware.elf` | 4,431,736 | `678FFC0CD88D552853B71C8424BE3BF792233F5EEFF87466EDE868028CC744C6` |
| `firmware/releases/0.35/miralink_pico_firmware.bin` | 701,996 | `8215C308EE427B048778AAE040C90A0802ECEB657EF92697900834A6E851844D` |
| `firmware/releases/0.35/miralink_pico_firmware.hex` | 1,974,606 | `DFC4E2476F3DAF70CE4656926C8E8FDC60E9AAF800CFE5FFB2B073B964BFFF12` |

## Hardware validation still required

No Pico 2 W, DualSense or Windows game-controller panel was connected for
this build session, and no UF2 was flashed. The following remain manual
hardware checks: the LED pairing window, first Bluetooth association,
Windows gamepad enumeration without Code 10, actual input reports,
reconnection after a reboot and BTstack key persistence. The build and the
source checks do not claim those physical results.
