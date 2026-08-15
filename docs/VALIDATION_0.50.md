# MiraLink 0.50 validation

## Scope

Version 0.50 replaces the single Bluetooth output slot with a fixed four-
packet FIFO: one packet can be in flight and three can remain queued. Haptic,
lightbar, trigger and audio-output requests remain ordered until BTstack accepts
each report. The implementation uses static storage and remains bounded.

The behavior was compared against the official DS5Dongle v0.7.2-hotfix source
as the mandatory reference. Its firmware uses a bounded `send_fifo`; no
DS5Dongle code or binary was copied.

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
| Firmware metadata | 0.50 / RP2350 ARM Secure / `0x10000000..0x100ad4e4` |
| Hardware test | Not performed |

## Release artifact

The four release files are bit-identical to the final Pico build. UF2 size is
1,420,288 bytes and its SHA-256 is
`04D5AA36F4D4B30B2976599DD1BD1D896794364570B3A7097238F00A638A8408`.

No physical Pico 2 W was flashed for 0.50. Bluetooth reconnect, output effects,
audio streaming and suspend/wake therefore remain unverified on hardware.

## DS5Dongle comparison

DS5Dongle is fixed at 100%. The FIFO improves the software output path but does
not claim additional parity before hardware evidence.

| Area | DS5Dongle | MiraLink 0.50 | Evidence |
| --- | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | descriptor and host tests; unchanged |
| Bluetooth pairing / reconnect | 100% | 55% | compiled/static only; reconnect still untested |
| Input / motion / touch | 100% | 77% | parser, builder and Controller Lab tests |
| Outputs | 100% | 48% | bounded four-packet FIFO and build evidence; hardware not tested |
| Audio / HD haptics / microphone | 100% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | unit and build evidence only |
| Configuration / diagnostics | 100% | 82% | protocol, UI and local tests |
| **Weighted proven score** | **100%** | **54.4%** | unchanged; no score inflation from a version bump |
