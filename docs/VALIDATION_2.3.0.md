# MiraLink 2.3.0 validation record

Date: 2026-08-13
Scope: local source build and static artifact validation only.

## Trigger

Windows enumerated the previously flashed MiraLink HID bridge as
`USB\\VID_CAFE&PID_4D4C` but returned `CM_PROB_FAILED_START` / Code 10. Chrome
could open its WebHID chooser but could not offer a compatible device. This
was a host-side descriptor-start failure, not proof of a Bluetooth pairing
failure.

## Correction

The descriptor used overlapping report identifiers across distinct HID report
types. Version 2.3.0 uses globally unique top-level IDs:

| Purpose | HID report ID |
| --- | --- |
| MiraLink command feature | `0x01` |
| MiraLink response feature | `0x02` |
| MiraLink event input | `0x03` |
| Standard gamepad input | `0x10` |
| Raw fixed controller-output envelope | `0x11` |

The controller-output payload remains exactly 47 validated bytes. The change
does not add a network service, telemetry, automatic flash, or an audio USB
interface.

## Checks completed

- Firmware build completed successfully for `pico2_w` with target `RP2350 ARM
  Secure`.
- Native core test executable completed: `MiraLink core tests passed`.
- Static ELF descriptor dump contains one occurrence of each report ID above.
- `picotool info` identifies the UF2 as `MiraLink Pico 2 W`, version `2.3.0`,
  target `RP2350`, image type `ARM Secure`, SDK `2.3.0`.

## Artifact hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/2.3.0/miralink_pico_firmware.uf2` | 1,397,760 | `8A235D81079277900AEF81002C3C1353175F6F6D35BE21A9B01E27A1E731D8EF` |
| `firmware/releases/2.3.0/miralink_pico_firmware.elf` | 4,376,376 | `D30F7DE1059B55BC643E9959123F6705A5431143E48D5B821EF0454AD0317EEC` |
| `firmware/releases/2.3.0/miralink_pico_firmware.bin` | 698,860 | `A934B048A9E641E156BC3E12B05C8C81D41CACF90C23546B20990325AC390354` |
| `firmware/releases/2.3.0/miralink_pico_firmware.hex` | 1,965,799 | `E1FE3E0B66CF5C687E0BDC6F6754323269C8F40FC11855E24F83BE8D8DF66F2C` |

## Not validated

No physical Pico 2 W or DualSense was connected for this validation. This
record does not claim that Windows starts the new descriptor, that WebHID can
open it, or that Bluetooth pairing/reconnection, haptics, adaptive triggers or
audio work. Those require a manual flash followed by separate hardware tests.
