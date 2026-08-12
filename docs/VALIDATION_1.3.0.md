# MiraLink 1.3.0 validation

## Verified locally

- Native application tests: 56/56 passed.
- Pico 2 W firmware build completed for RP2350 ARM Secure.
- `picotool info` identifies the UF2 as `MiraLink Pico 2 W`, version `1.3.0`.
- Current Windows device enumerates as MiraLink HID with usage page `0xff00`.
- Before the fix, direct Windows `SET_FEATURE` failed with error 31 because
  TinyUSB accepted only 64 bytes while Windows supplied report ID + 64 data
  bytes. The response path returned a 65-byte feature report.
- The 1.3.0 UF2 is packaged with a SHA-256 manifest.
- UF2 SHA-256: `0D554A8461F7345393608BF814C92614173A83746478FD99E9F1C3D336BD9F42`.

## Not yet verified

- The 1.3.0 UF2 has not been flashed automatically or silently.
- The new UF2 must be installed manually before its USB exchange can be
  declared tested on the physical board.
- DualSense pairing, Bluetooth HID descriptor negotiation and live input have
  not been declared successful until a real controller is connected and the
  diagnostic counters change.
- Audio, battery telemetry, haptics and adaptive triggers remain unavailable
  unless a separately implemented and tested MiraLink capability reports them.
