# MiraLink 1.9.0 validation record

Date: 2026-08-13  
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure (`rp2350-arm-s`)  
Status: software candidate; physical hardware test pending

## Evidence

- Pico firmware target rebuilt successfully with Pico SDK 2.3.0 and Arm GNU
  Toolchain 15.2.1.
- Host C++ core tests: 1/1 passed through CTest, including the fixed DualSense
  output-body mapping and Bluetooth CRC check.
- Application protocol tests: passed locally; the 1.9.0 additions cover
  diagnostics schema 3, audio status schema 1 and the bounded output request.
- MiraLink UF2 parser: 2,737 valid program blocks, 1,401,856 bytes.
- Local `picotool 2.3.0 info` identifies the package as MiraLink Pico 2 W,
  version `1.9.0`, RP2350 ARM Secure, with binary end `0x100ab034`.
- UF2 target metadata: `pico2_w`, `rp2350-arm-s`; first-block family metadata is
  present and the build platform is recorded by CMake.
- `git diff --check`: passed before the final commit gate.
- No flash, cloud operation, telemetry, push or public release was performed.

## 1.9.0 software changes

- Added a UAC2 four-channel 48 kHz/16-bit audio ingress. Samples are buffered
  only in a bounded RAM ring and dropped-frame counters are local.
- Added a fixed DualSense audio HID report (`0x36`, 398 bytes). The first two
  USB audio channels are encoded as Opus stereo speaker data; the latter two
  are reduced to 3 kHz haptic channels. The application distinguishes the
  local USB stream, a validated HID output link and reports actually accepted
  by BTstack. No A2DP/SBC path is used.
- Added a fixed 47-byte DualSense USB output-body path. MiraLink owns the
  Bluetooth header, sequence and CRC; arbitrary HID buffers are rejected.
- Added `SET_CONTROLLER_OUTPUT`, `GET_AUDIO_STATUS` and diagnostics schema 3.
- Updated local application diagnostics to read the typed audio status.
- Vendored the unmodified Xiph Opus 1.5.2 source under
  `firmware/third_party/opus` so the build remains local and reproducible.

## What remains unproven

The automatic checks do not prove composite USB enumeration on Windows,
UAC2 host playback, Bluetooth discovery, DualSense pairing, reconnection after
power cycling, real input relay, audio acceptance by a DualSense, haptics,
adaptive-trigger rendering, lightbar/LED behavior, microphone mute or flash
recovery. Those require a real Pico 2 W and a real controller. This workspace
has not made that physical test.

## Artifact hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/1.9.0/miralink_pico_firmware.uf2` | 1401856 | `6E7FFD183DBD838C9215B4799058D0687C592783F9801075BDBD0F7B16BDC9CB` |
| `firmware/releases/1.9.0/miralink_pico_firmware.elf` | 4360384 | `B7860D7F627674FECC679B5CAC9F9F827937B3ECBFF239726C56DE22EDEC936C` |
| `firmware/releases/1.9.0/miralink_pico_firmware.bin` | 700468 | `C410377340E6ACECCB659450E357E3657D050F558BF7C328EF356D2698CB3465` |
| `firmware/releases/1.9.0/miralink_pico_firmware.hex` | 1970302 | `79132106A14BE82F384F4D2A79B767438426AD490A72BCC86F77144BF14F4DD8` |
