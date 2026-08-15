# MiraLink firmware 0.48

Developer: MaruChiwa
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
SDK: Pico SDK 2.3.0
Build: Release

This candidate compares MiraLink's Bluetooth reconnect and authentication
lifecycle with the official DS5Dongle v0.7.2-hotfix reference. It restores
discoverability together with page scan after ACL teardown for bonded PS-only
reconnects, while admitting only remembered addresses outside an explicit
pairing window. It also tracks the active ACL handle and drops a remembered key
only when that exact controller fails authentication before a valid enhanced
`0x31` input report. New associations, validated links and ordinary power-off
disconnects do not erase keys.

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
SHA-256: `6CA9DF891E01DAE4DB049EA4BB7FCE92CC44B4B9CB3E6398E5AE6D2D643A45C9`
Binary range: `0x10000000..0x100acf4c`
Extra security: not enabled
