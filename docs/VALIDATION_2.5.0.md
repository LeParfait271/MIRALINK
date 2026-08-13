# MiraLink 2.5.0 validation record

Date: 2026-08-13<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: local manual-test candidate only

## Scope

Firmware 2.5.0 closes the remaining safe runtime gaps in the local persisted
configuration: speaker and headset-monitor volume, speaker gain, trigger
reduction, inactivity suspension, unique USB serial opt-in and external status
GPIO. All settings remain in Pico flash and no data leaves the Pico or host
computer.

The new runtime limits are intentional:

- status GPIO is disabled by default and restricted to Pico 2 W pins `0..22`;
- inactivity suspension keeps paired keys and does not erase configuration;
- USB serial exposure remains off unless the saved setting enables it, then
  needs a manual USB reconnect;
- trigger reduction operates only inside the fixed, bounded controller-output
  body and never accepts arbitrary raw HID buffers.

## Static and automated validation

| Check | Result |
| --- | --- |
| Native core build | Passed |
| Native core test | Passed (`1/1`, assertions active) |
| Pico 2 W firmware build | Passed |
| Configuration validation for reserved GPIO | Passed |
| Trigger reduction behaviour | Passed |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W, `2.5.0`, RP2350 ARM Secure |

The first test run exposed that Release-mode `NDEBUG` disabled C++ `assert`
checks. The test translation unit now undefines `NDEBUG` before including
`<cassert>`, and the succeeding run therefore executed the assertions.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/2.5.0/miralink_pico_firmware.uf2` | 1,417,728 | `454CB86F42786BCBD21B57BBD365528F40D3CE2E0DE763C254E338C2E243232B` |
| `firmware/releases/2.5.0/miralink_pico_firmware.elf` | 4,511,728 | `E497EDA0E7E8D60793EA33F7A6203D5708F4DD9D93237163B906ECFAAA885498` |
| `firmware/releases/2.5.0/miralink_pico_firmware.bin` | 708,604 | `C9132F8DFBEBD2762EF05BE4088858808ED01FF0BDF0B8A9ECE6A877E651D22C` |
| `firmware/releases/2.5.0/miralink_pico_firmware.hex` | 1,993,191 | `31967D7185AEDB1E07D890472D484AEE2A2F798005EDCC7B4C321201B55EB522` |

## Hardware validation still required

No Pico 2 W or DualSense was connected for this build session. The following
manual tests remain necessary before any physical feature can be declared
working:

1. Windows starts HID and UAC2 interfaces without Code 10.
2. The saved serial privacy option changes only after a manual reconnect.
3. DualSense pairs, reconnects, forwards inputs and resumes from local idle.
4. UAC2 playback/capture endpoints stream correctly.
5. Haptics, adaptive triggers, lightbar and microphone-mute output produce the
   expected physical result.
6. A configured status GPIO is electrically safe with the user's external
   circuit.

The UAC2 capture source is a local playback monitor, not controller microphone
transport. That distinction remains visible until a separate controller-side
audio capture route has been implemented and tested on real hardware.
