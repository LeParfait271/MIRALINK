# MiraLink Pico 2 W firmware 2.0.0

Local manual-test candidate compiled from the independent MiraLink source for
the Raspberry Pi Pico 2 W (`pico2_w`, RP2350 ARM Secure / `rp2350-arm-s`).

## Included in this candidate

- DualSense and DualSense Edge Bluetooth HID input with strict report checks;
- local UAC2 audio input with a bounded RAM pipeline and fixed DualSense audio
  report validation;
- bounded Bluetooth output queue with haptic, lightbar, microphone and fixed
  controller-output routes;
- local diagnostics schema 4 with the last Bluetooth failure stage and bounded
  connection/reconnect counters;
- existing local configuration persistence, recovery and pairing behavior.

The candidate has not been flashed or tested on a physical Pico 2 W or
DualSense. No physical hardware behavior is claimed.

## Manual installation

1. Hold `BOOTSEL` while connecting the Pico 2 W by USB.
2. Copy `miralink_pico_firmware.uf2` to the `RPI-RP2` drive.
3. Wait for the drive to disappear and the Pico to reboot.
4. Open MiraLink in desktop Chrome or Edge and connect the bridge.
5. Open the local pairing window from MiraLink, then hold `PS + Create` on the
   DualSense until it is discoverable.

No automatic flash, rollback, push or publication is performed.

## Files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1404416 | `FDCCB5E7F40F0A0EB7220ADA8620E61BCAAB51B23B28EF1412662A88B2496C3E` |
| `miralink_pico_firmware.elf` | 4418664 | `BDED10F6A58A3A1D7386C3CEA2366BD4EFDA41CE0911E738690CBFDBBB43E800` |
| `miralink_pico_firmware.bin` | 702204 | `ADCF631F84E132D4E55F110AA2FCCDFFEE406AC5A23A2BEEAA2038BCFF214885` |
| `miralink_pico_firmware.hex` | 1975191 | `0B6FD04BEE96186355E67ADE5C62B75EAE44CF80F0F6C750F0045FC8D87AC0CB` |
