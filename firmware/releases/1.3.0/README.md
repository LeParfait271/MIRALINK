# MiraLink Pico 2 W firmware — 1.3.0

This is a manually installable test candidate for the Raspberry Pi Pico 2 W.

## USB connection fix

The HID interface uses 64 data bytes and a non-zero report identifier. The
control transfer therefore needs a 65-byte TinyUSB buffer. Version 1.3.0
contains that correction; the previous candidate could enumerate in Windows
but rejected the first feature report before MiraLink could identify it.

The application also accepts native WebHID responses both with and without the
report identifier, polls the controller-state feature command at a bounded
rate, and asks for confirmation before opening the five-minute Bluetooth
pairing window after a bridge is selected.

## Manual installation

1. Keep the Pico 2 W connected by USB.
2. Enter BOOTSEL mode manually.
3. Copy `miralink_pico_firmware.uf2` to the mounted Pico drive.
4. Wait for the drive to disappear and the MiraLink HID device to reappear.
5. Reopen MiraLink and use **Connect device**.
6. Confirm the local pairing-window prompt and put the DualSense in pairing mode.

MiraLink never flashes this file automatically. Keep the previous known-good
UF2 available for recovery.

## Verification

- Target: RP2350 ARM Secure / Pico 2 W
- UF2 size: 863232 bytes
- SHA-256: `0D554A8461F7345393608BF814C92614173A83746478FD99E9F1C3D336BD9F42`

The USB failure was reproduced locally against the currently connected older
Pico: Windows supplied a 65-byte report, while the previous firmware accepted
only 64 bytes and rejected `SET_FEATURE`. Version 1.3.0 contains the buffer
correction, but the new binary still requires a manual flash and a physical
retest. Bluetooth pairing, controller input, battery, audio, haptics and
adaptive triggers remain reported only when the firmware and connected
hardware provide evidence for them.
