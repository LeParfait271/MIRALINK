# MiraLink 0.51 validation

## Scope

Version 0.51 targets the remembered-controller reconnect failure observed in
the 0.47/0.50 test history. The implementation was compared with the official
DS5Dongle v0.7.2-hotfix source before editing MiraLink. It adds an immediate
post-disconnection radio re-arm and a bounded neutral Bluetooth state-report
bootstrap (`0x32`) before the existing feature requests. No DS5Dongle code or
binary was copied.

## Automated evidence

| Check | Result |
| --- | --- |
| Host core build | PASS |
| Host core test | 1/1 PASS |
| Pico 2 W Release cross-build | PASS |
| Application syntax/check | PASS |
| Application unit tests | 109/109 PASS |
| Desktop Playwright scenarios | 16/16 PASS |
| Dependency audit | 0 vulnerabilities |
| Firmware metadata | 0.51 / RP2350 ARM Secure / `0x10000000..0x100ad944` |
| Hardware test | Not performed |

## Release artifact

The four release files are bit-identical to the final Pico build. The UF2 is
1,422,848 bytes and its SHA-256 is
`9041EA1FE9CEBE42A016B1AAB04E2C368D7F2D494A604A06E65EE39C8540B168`.

No physical Pico 2 W was flashed for 0.51. The PS-only reconnect, output
effects, audio streaming and suspend/wake therefore remain unverified on
hardware.

## DS5Dongle comparison

DS5Dongle remains fixed at 100%. The new radio/state bootstrap is a stronger
software path, but no functional score is raised until the manual reconnect
matrix passes on a real Pico and DualSense.

| Area | DS5Dongle | MiraLink 0.50 | MiraLink 0.51 | Evidence |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | unchanged descriptors and host tests |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | new path compiled and unit-covered; hardware not tested |
| Input / motion / touch | 100% | 77% | 77% | unchanged parser and Controller Lab tests |
| Outputs | 100% | 48% | 48% | state bootstrap is neutral; physical effects not tested |
| Audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | no hardware suspend test |
| Configuration / diagnostics | 100% | 82% | 82% | unchanged protocol/UI tests |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | no score increase without hardware evidence |
