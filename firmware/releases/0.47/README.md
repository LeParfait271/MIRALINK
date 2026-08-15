# MiraLink firmware 0.47

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate compares MiraLink's Bluetooth authentication lifecycle with the
official DS5Dongle v0.7.2-hotfix reference. It tracks the active ACL handle
and drops a remembered key only when that exact controller fails
authentication before a valid enhanced `0x31` input report. New associations,
validated links and ordinary power-off disconnects do not erase keys.

The firmware also retains the 0.46 passive PS-button reconnect repair: stale
BTstack HID/SDP state is retired after ACL teardown and page scan is rearmed
from the foreground poll. The USB Audio class remains disabled and no audio
stream is claimed.

This release has not been flashed or physically validated. Flashing is manual:
enter BOOTSEL, copy only `miralink_pico_firmware.uf2` to `RPI-RP2`, then run the
PS-only reconnect and stale-bond matrix. The software gates passed: Pico
cross-build, host core test with the provisioned LLVM runtime, npm checks,
109 unit tests and 16 desktop Playwright scenarios.

UF2: 1,417,728 bytes
SHA-256: `E47FE18B8ADF903672B515048C995647E4D1F5BBD8BEB591D7B600E4C1D8EA8A`
Binary range: `0x10000000..0x100acf44`
Extra security: not enabled
