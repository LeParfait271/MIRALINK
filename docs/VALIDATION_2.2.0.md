# MiraLink 2.2.0 validation record

Date: 2026-08-13
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure (`rp2350-arm-s`)
Status: local HID recovery candidate; physical hardware test pending

## Why this candidate exists

While the 2.0.0 firmware was installed, Windows detected the MiraLink USB
parent but refused to start both child interfaces:

- `MI_00` audio child: `usbaudio2.inf`, Code 10 (`CM_PROB_FAILED_START`);
- `MI_02` HID child: `input.inf`, Code 10 (`CM_PROB_FAILED_START`).

That failure happens before Chrome can offer a usable WebHID device. The 2.2.0
candidate therefore removes the unvalidated UAC2 composite interface and
returns to one HID interface so the bridge can be tested independently of USB
audio.

## Build evidence

- Source build directory: `firmware/pico/build-btstack-4/`.
- Pico SDK: `2.3.0`; Arm GNU Toolchain: `15.2.1`; local picotool: `2.3.0`.
- `picotool info` identifies `MiraLink Pico 2 W`, version `2.2.0`, target
  `RP2350`, image type `ARM Secure`, binary end `0x100aaa04`.
- MiraLink UF2 parser: `2,731` valid program blocks, `1,398,784` bytes.
- The active descriptor declares one HID interface (`bNumInterfaces=1`,
  `wTotalLength=34`) and `CFG_TUD_AUDIO=0`; the static descriptor bytes were
  inspected from the generated ELF.
- No flash, automatic recovery, cloud operation, telemetry or publication was
  performed during this validation.

## Automated checks

- Firmware compilation completed successfully for `miralink_pico_firmware.elf`.
- Firmware core tests passed: `MiraLink core tests passed`.
- Application syntax and protocol/feature tests: `62/62` passed.
- ELF, BIN, HEX and UF2 were copied from that same build into the 2.2.0
  release directory.
- JSON metadata parsing, source syntax checks and `git diff --check` are part
  of the final delivery gate.

## What remains unproven

The candidate has not been flashed. Windows re-enumeration without Code 10,
Chrome WebHID selection, feature-report exchange, Bluetooth discovery, PS +
Create pairing, reconnection, input relay, haptics, adaptive triggers,
lightbar, microphone mute and flash recovery still require a real Pico 2 W and
a real DualSense. USB audio is intentionally unavailable and is not a test
target for this candidate.

## Artifact hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/2.2.0/miralink_pico_firmware.uf2` | 1398784 | `1027599BC3E81F352BC4C6DEBE738B5287211EB41EC1E206EA37FE2D1699BC54` |
| `firmware/releases/2.2.0/miralink_pico_firmware.elf` | 4376384 | `5555D8587694BE5997E9E6FA62EC738E328526044457A34B7DCA5766B06030B4` |
| `firmware/releases/2.2.0/miralink_pico_firmware.bin` | 698884 | `771A6A238AD3AF927A09C52521FB3BD6DB70BC5B620617E68A29ADFFDBE493D7` |
| `firmware/releases/2.2.0/miralink_pico_firmware.hex` | 1965860 | `036C784F91DB7791C39628A0CF63E7D07C2CD56319DE9DEC040925226CDAC6E6` |
