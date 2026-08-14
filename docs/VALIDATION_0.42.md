# MiraLink 0.42 — validation record

- Candidate date: `2026-08-14`
- Board target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
- Binary protocol: `1` (unchanged)
- Hardware status: **candidate not yet flashed**

## 0.40 and 0.41 evidence retained

The manual `0.40` run proved bridge recovery and radio readiness after a Pico
restart, but the remembered DualSense remained offline after controller power-
off and Pico restart. A new pairing was required. Source inspection then found
that BTstack can skip `gap_connectable_control(1)` when its cached flag is
already true; the `0.41` candidate moved that close-rearm to the foreground
poll and forced a fresh `0 -> 1` transition. The 0.41 correction has not yet
been flashed or retested.

## 0.42 cause and correction

### OBSERVÉ — source path

When local inactivity suspension had closed the HID link, `apply_config()` could
resume the radio by calling `gap_connectable_control(1)` and
`gap_discoverable_control(0)` directly. Configuration commands are dispatched
while TinyUSB handles a USB report, so this path bypassed the foreground-only
BTstack execution boundary used by 0.41.

### INFÉRÉ — likely failure mode

The same BTstack cached-connectable condition that motivated 0.41 could make
the idle-resume call a no-op after the controller had disabled page scan. A
radio command issued during USB dispatch would also be outside the serialized
polling path. This is a source-supported hypothesis, not a packet capture or a
physical observation.

### PROUVÉ — software scope only

The 0.42 source removes those direct radio calls from the idle-resume branch,
queues a page-scan rearm, and lets `service_page_scan_rearm()` reapply scan
parameters plus the forced connectable transition from `bluetooth::poll()`.
Pure policy assertions cover the HCI-working/resume combination. None of this
proves a flashed Pico or a real controller reconnect.

## Discriminating hardware test

1. Flash `0.42` manually and pair the DualSense once if necessary.
2. Configure a short local inactivity timeout and wait until the HID link is
   idle-suspended; do not open a new pairing window.
3. While the remembered key remains stored, commit a configuration with the
   inactivity timeout disabled.
4. Press `PS` only. Confirm that the controller reconnects without re-pairing,
   that there is one Windows controller, and that input resumes.
5. Repeat after a Pico restart and once after abrupt controller power loss.

Success separates the idle-resume correction from ordinary pairing: the same
remembered key must recover through the passive page-scan path. Record any
failure stage, reconnect count, duplicate controller, stale non-neutral input
or pairing-window log. Do not raise the DS5Dongle score from a build alone.

## Software and hardware gates

| Gate | Result |
| --- | --- |
| Native Windows `miralink-core-tests.exe` | **NOT RUN — forbidden without the exact LLVM runtime** |
| Hardware flash | **NOT RUN — manual only** |
| Pico cross-build | PASS — Release, Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1` |
| UF2 family/version/hash inspection | PASS — `0.42`, `rp2350-arm-s`, `0x10000000..0x100ac294`, SHA-256 recorded below |
| Hardware idle-resume reconnect | **NOT PROVEN** |
| Passive reconnect after power-off/Pico restart | **NOT PROVEN for 0.41 or 0.42** |

## DS5Dongle-relative score before 0.42 hardware retest

| Capability | DS5Dongle | MiraLink 0.41 candidate | MiraLink 0.42 candidate | Evidence change |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | No descriptor change or new host proof |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | 0.42 idle-resume rearm is software-only |
| Input / motion / touch | 100% | 77% | 77% | Historical buttons/sticks and live Lab sample only; motion/touch untested |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No physical effect test |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | Idle resume and brutal-loss recovery remain untested |
| Configuration / diagnostics | 100% | 82% | 82% | No new hardware capability proof |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | **No increase before a new material run** |

Raw source coverage remains `76%`. UF2 size is reported separately and is not
a quality score.

## Release artifact identity

The final 0.42 release values are recorded below, in
`firmware/releases/0.42/README.md` and `docs/DELIVERY_MANIFEST.json`. Build identity,
picotool inspection and SHA-256 do not prove behavior on the Pico. No automatic
flash is allowed.

| Property | Value |
| --- | --- |
| UF2 size | `1,411,072` bytes |
| SHA-256 | `AB734548F183B85EA3ED91AD1E7AF24F1203DADFACFCB2E66F2AB3B4044EE060` |
| Address range | `0x10000000..0x100ac294` |
| DS5Dongle-relative size | `92.5%` (`114,176` bytes smaller) |
