# MiraLink Pico 2 W firmware 1.9.0

Local manual-test candidate compiled from the independent MiraLink source for
the Raspberry Pi Pico 2 W (`pico2_w`, RP2350 ARM Secure / `rp2350-arm-s`). It
does not reuse the supplied reference firmware, its binary, private protocol
or internal structures.

## Included in this candidate

- DualSense and DualSense Edge Bluetooth HID input with strict report checks;
- local UAC2 audio input: four channels, 48 kHz, 16-bit PCM, RAM-only;
- fixed DualSense audio HID report `0x36` (398 bytes), with Opus stereo
  speaker data and 3 kHz haptic channels;
- fixed-size DualSense output body forwarding for haptics and adaptive-trigger
  compatible game output, with MiraLink-owned Bluetooth header and CRC;
- diagnostics schema 3 and `GET_AUDIO_STATUS`;
- existing local configuration persistence, recovery, pairing and output queue.

The audio path is only marked as linked after a valid DualSense HID report
makes the output route ready, and only marked as streaming after an audio HID
report is accepted by BTstack. A successful send still does not prove that a
particular DualSense accepts or renders the payload. Adaptive-trigger output
is routed but has not been physically validated.

## Manual installation

1. Hold `BOOTSEL` while connecting the Pico 2 W by USB.
2. Copy `miralink_pico_firmware.uf2` to the `RPI-RP2` drive.
3. Wait for the drive to disappear and the Pico to reboot.
4. Open MiraLink in desktop Chrome or Edge and connect the bridge.
5. Open the local pairing window from MiraLink, then hold `PS + Create` on the
   DualSense until it is discoverable.

No automatic flash, rollback, push or publication is performed. Keep the
previous candidate available for manual recovery. This workspace has not
tested 1.9.0 on a physical Pico 2 W or controller.

## Files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.uf2` | 1401856 | `6E7FFD183DBD838C9215B4799058D0687C592783F9801075BDBD0F7B16BDC9CB` |
| `miralink_pico_firmware.elf` | 4360384 | `B7860D7F627674FECC679B5CAC9F9F827937B3ECBFF239726C56DE22EDEC936C` |
| `miralink_pico_firmware.bin` | 700468 | `C410377340E6ACECCB659450E357E3657D050F558BF7C328EF356D2698CB3465` |
| `miralink_pico_firmware.hex` | 1970302 | `79132106A14BE82F384F4D2A79B767438426AD490A72BCC86F77144BF14F4DD8` |

Software build and parsing checks passed locally. Hardware status:
**not tested**.
