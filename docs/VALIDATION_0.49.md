# MiraLink 0.49 validation

## Scope

Version 0.49 fixes the inactivity timer. A DualSense emits enhanced reports
continuously while idle; those unchanged telemetry reports no longer reset the
timer. Button, stick, trigger and touch transitions still count as activity.
Bluetooth reconnect behavior is unchanged and remains unverified on hardware.

The behavior was compared against the official DS5Dongle v0.7.2-hotfix source
as the mandatory reference. No DS5Dongle code or binary was copied.

## Automated evidence

| Check | Result |
| --- | --- |
| Host core build | PASS |
| Host core test | 1/1 PASS |
| Pico 2 W Release cross-build | PASS |
| Application syntax/check | PASS |
| Application unit tests | 109/109 PASS |
| Desktop Playwright scenarios | 16/16 PASS |
| Firmware metadata | 0.49 / RP2350 ARM Secure / `0x10000000..0x100acfcc` |
| Hardware test | Not performed |

## Release artifact

The four release files are bit-identical to the final Pico build. UF2 size is
1,417,728 bytes and its SHA-256 is
`60B2B7A12AAC31FE08802B252E677CCAD0AADC6B2B45ED369C8E4D07FBC284AE`.

The configured inactivity timeout still requires a physical test with an idle
controller followed by a real button/stick/touch transition.

## DS5Dongle comparison

DS5Dongle is fixed at 100%. This firmware-only correction improves correctness
but does not claim additional parity before hardware evidence.

| Area | DS5Dongle | MiraLink 0.49 | Evidence |
| --- | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | descriptor and host tests |
| Bluetooth pairing / reconnect | 100% | 55% | compiled/static only; reconnect still untested |
| Input / motion / touch | 100% | 77% | parser, builder and Controller Lab tests |
| Outputs | 100% | 48% | bounded output tests; hardware not tested |
| Audio / HD haptics / microphone | 100% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | unit and build evidence only |
| Configuration / diagnostics | 100% | 82% | protocol, UI and local tests |
| **Weighted proven score** | **100%** | **54.4%** | unchanged; no score inflation from a version bump |
