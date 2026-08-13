# MiraLink 2.4.0 validation record

Date: 2026-08-13
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure
Delivery: local manual-test candidate only

## Scope

Firmware 2.4.0 restores the independent MiraLink USB Audio Class 2 headset
function beside its vendor HID and standard HID gamepad interfaces. It keeps
all configuration, audio buffers, diagnostics and Bluetooth state local to the
Pico/host computer.

The audio function is deliberately explicit:

- playback: 48 kHz, PCM 16-bit, 4 channels;
- capture: 48 kHz, PCM 16-bit, 1 local monitor channel;
- UAC2 fixed clock, mute and volume controls;
- separate endpoint addresses for HID (`0x81`), playback (`0x02`) and capture
  (`0x83`).

The capture endpoint is a local monitor of playback. It is not a DualSense
microphone implementation and must not be reported as one.

## Build and static validation

| Check | Result |
| --- | --- |
| Pico firmware build | Passed |
| Native MiraLink core tests | Passed (1/1) |
| UAC2 configuration-descriptor size assertion | Passed at compile time |
| USB remote-wake descriptor and opt-in input gate | Passed at compile time |
| HID report-ID separation | Retained: `0x01`, `0x02`, `0x03`, `0x10`, `0x11` |
| `picotool info` | Passed: MiraLink Pico 2 W, 2.4.0, RP2350 ARM Secure, `pico2_w` |

The prior build directory was configured with `PICO_NO_PICOTOOL=1`, so its old
UF2 was not a byproduct of the fresh ELF. The candidate UF2 was therefore
explicitly regenerated from the newly linked ELF with local picotool before
inspection. Future release preparation must always inspect the UF2's embedded
version and not rely on the presence of an older `.uf2` file.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/2.4.0/miralink_pico_firmware.uf2` | 1,413,632 | `D1F9C30CECEDEB4B31CDE43CEB415F144469C47B30D128D0CB753BFCB252121E` |
| `firmware/releases/2.4.0/miralink_pico_firmware.elf` | 4,488,200 | `F6261E269BB21ADDCACD2CE8848168BDE6F75DA0B464130C24D16A34EFFD6856` |
| `firmware/releases/2.4.0/miralink_pico_firmware.bin` | 706,492 | `6B518810A82BC1A642C8C31E2085449C24C7733B43ACE52D62E17549E9103861` |
| `firmware/releases/2.4.0/miralink_pico_firmware.hex` | 1,987,251 | `F106175E799F4DAA81DB6B4E9F38FFCF0BB545D3944D5E333F1A4063A6A360FF` |

## Hardware validation still required

No Pico 2 W or DualSense was connected for this build session. The following
must be tested manually before 2.4.0 can be described as hardware-complete:

1. Windows starts every HID/UAC2 interface without Code 10.
2. Chrome WebHID opens the MiraLink feature interface and reads a response.
3. DualSense pairs, reconnects and forwards inputs after a power cycle.
4. Windows can select the UAC2 playback and capture interfaces.
5. Speaker, haptic, rumble, lightbar and adaptive-trigger effects produce the
   expected physical result.
6. USB remote wake occurs only after a controller input when both Windows and
   the saved MiraLink configuration have enabled it.

No flash, publication, telemetry or automatic update was performed.
