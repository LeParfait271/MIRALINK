# MiraLink 0.32 firmware validation record

Date: 2026-08-13<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: local manual-test candidate only

## Scope

The firmware release is version-aligned with the public MiraLink site at
`0.32`. It contains the existing safe runtime wiring for persisted speaker and
headset-monitor volume, bounded speaker gain, trigger reduction, inactivity
suspension, optional USB serial exposure and status GPIO. All settings remain
in Pico flash and no data leaves the Pico or host computer.

## Static and automated validation

| Check | Result |
| --- | --- |
| Native core build | Passed |
| Native core test | Passed (`1/1`, assertions active) |
| Pico 2 W firmware build | Passed |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W, `0.32`, RP2350 ARM Secure |
| UF2 SHA-256 | Recorded locally |

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.32/miralink_pico_firmware.uf2` | 1,417,728 | `92778631FDCB2283792AEA8ACF0EE24A2EB956BD1FCC28F0C30C4A0827A12A06` |
| `firmware/releases/0.32/miralink_pico_firmware.elf` | 4,511,728 | `CA5645C64BA6B273636A5C55320DD4D30F3BA93B822F6B253B495905BD702E9A` |
| `firmware/releases/0.32/miralink_pico_firmware.bin` | 708,604 | `9AD7E3ED5358B3DBE0C2F590A4D8B30369119EE08D9AFA21E43FF66DB1ECA34D` |
| `firmware/releases/0.32/miralink_pico_firmware.hex` | 1,993,191 | `8C2EC96B0407BDA3ABB3C2CCC9EA264C69BBBAD74A04F12E5B6CBA6F6BA0D2FB` |

## Hardware validation still required

No Pico 2 W or DualSense was connected for this build session. The following
remain manual hardware checks: Windows HID/UAC2 enumeration, pairing and
reconnection, controller inputs, audio, haptics, adaptive triggers, remote
wake and any external status-GPIO circuit. The UAC2 capture source is a local
playback monitor, not controller microphone transport.
