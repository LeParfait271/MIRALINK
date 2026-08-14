# MiraLink 0.36 firmware validation record

Date: 2026-08-14<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: local manual-test candidate only

## Change verified in source

Firmware 0.36 replaces the generic gamepad USB identity with an original,
clean-room DualSense-family persona. It exposes one HID interface containing
native Gamepad and MiraLink vendor top-level collections. No DS5Dongle source
or binary content was imported into MiraLink; observable compatibility
requirements were independently implemented and bounded by MiraLink's typed
protocol.

The persona uses Sony VID `0x054c`, standard/Auto PID `0x0ce6` or Edge PID
`0x0df2`. This experimental identity is a compatibility choice, not a claim of
Sony firmware, certification, endorsement or affiliation.

## Static and automated validation

| Check | Result |
| --- | --- |
| Application JavaScript syntax | Passed |
| Application tests | Passed (`68/68`) |
| Application production build | Passed |
| Native MiraLink core test | Passed (`1/1`) |
| USB output normalization | Passed for interrupt/control forms and compact 48-byte/Linux 63-byte wire sizes |
| Synthetic IMU calibration | Passed: gyro host sensitivity `64`, accelerometer sensitivity `1`, non-zero denominators |
| HID descriptor compile-time checks | Passed: `0x01` 63-byte payload, `0x02` 47-byte payload, exact Feature sizes, no Input `0x72` |
| Pico 2 W Release build | Passed with Arm GNU 15.2.1 and Pico SDK 2.3.0 |
| ELF descriptor inspection | Passed: one 41-byte configuration, one HID interface, report descriptor 190 bytes, IN `0x81` and OUT `0x01`, 64-byte packets, 1 ms |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W `0.36`, `pico2_w`, RP2350 ARM Secure, SDK 2.3.0 |
| UF2 family | Passed: `rp2350-arm-s` |
| Flash or hardware test | Not performed |

Picotool reports binary range `0x10000000..0x100abce4` and `extra security:
not enabled`. The `ARM Secure` image type therefore does not constitute a
signed- or encrypted-firmware claim.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.36/miralink_pico_firmware.uf2` | 1,408,000 | `E0BCE0C6D4E0C531E9C334FC54348B143215E1A53BACEB83B20CD48EFB303284` |
| `firmware/releases/0.36/miralink_pico_firmware.elf` | 4,459,312 | `5A59C58C822C3B517FF7ABEA428AF9F052AE0638875DE768EAD2D78502005CB6` |
| `firmware/releases/0.36/miralink_pico_firmware.bin` | 703,716 | `505CA3D82B8AE531E6EA0DA58C23A77043209DA8631E58C33C526A2AFA0FF03C` |
| `firmware/releases/0.36/miralink_pico_firmware.hex` | 1,979,437 | `8D25329F7A0F420B6D2DBBB41395CD433DE8E8A34729CB962A6852EA31003AB3` |

## Hardware validation still required

The candidate has not been flashed. Required physical checks are Windows and
Linux enumeration, one-controller visibility, WebHID `0x70`/`0x71` Feature
exchange, first Bluetooth association, remembered reconnect, native inputs,
motion scaling, rumble, adaptive triggers, configuration-driven PID/serial
re-enumeration, and suspend/explicit remote wake. USB audio remains disabled
and is outside this candidate.

## DS5Dongle baseline

The full scoring method and evidence are recorded in
`docs/COMPARISON_DS5DONGLE.md`.

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.36 |
| --- | ---: | ---: |
| Functional coverage, before proof penalty | 100% | 76% |
| **Proven weighted score** | **100%** | **46%** |
| UF2 relative size, not a quality score | 100% | 92.3% |
