# MiraLink 0.41 — validation record

- Candidate date: `2026-08-14`
- Board target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
- Binary protocol: `1` (unchanged)
- Hardware status: **candidate not yet flashed**

## 0.40 hardware evidence that gates this correction

The manual `0.40` run reproduced the remembered-controller failure after
controller power-off and after a Pico restart. After the restart, the site was
manually reconnected to the bridge and reported:

- bridge `READY`, firmware `0.40`;
- USB transport `PASS`;
- radio transport `PASS`;
- flash storage `PASS`;
- `DualSense connue · non connectée`;
- no new pairing window in the post-restart log.

This proves that the WebHID bridge can be recovered and that the radio stack is
ready, but it does not prove a passive controller link. The known controller
remained offline, so `0.40` did not pass the passive reconnect gate.

## Cause hypothesis and discriminating test

The BTstack 2.3.0 source used by the build returns early from
`gap_connectable_control(1)` when its cached `connectable` flag is already true.
An ACL close can nevertheless leave the controller's page scan disabled. The
`0.40` code called that API from the HID close callback, so the cached-state
no-op is a plausible cause of the observed failure. This is a source-supported
hypothesis, not a physical packet trace.

The discriminating hardware test for `0.41` is:

1. Start with a remembered DualSense and a normally connected bridge.
2. Turn the DualSense off, then press `PS` only; do not use pairing mode.
3. Repeat after restarting the Pico, reconnecting WebHID manually, and not
   opening a new pairing window.
4. Confirm `Manette` becomes online, input resumes and no re-pairing is used.

If this succeeds while the same controller still pairs through an explicit
window, the passive page-scan path is corrected. Acceptance requires 20/20
power-off/passive reconnects, no duplicate Windows controller and no stale
non-neutral input after disconnect, plus at least one successful Pico restart
cycle.

## 0.41 correction

The candidate keeps the passive incoming policy and does not restore automatic
remembered-key `hid_host_connect`. It instead:

- defers scan rearming from the HID close callback to the foreground poll;
- reapplies the configured page-scan interval and interlaced scan type;
- forces a fresh connectable `0` → `1` transition so BTstack emits a new page
  scan enable command;
- skips the rearm while idle-suspended or while a new HID link is active;
- reapplies the same guard after HCI startup to cover a cached BTstack state.

The firmware source and syntax-only policy assertions are the only software
evidence until a new manual flash. The Windows native host-test executable is
not launched.

## Software gates

| Gate | Result |
| --- | --- |
| Application unit tests | PASS — `109/109` |
| Desktop end-to-end scenarios | inherited PASS — `15/15` on 0.40; not rerun because app dependencies are not installed in this checkout and no desktop behavior changed |
| Dependency audit | inherited PASS — 0 known vulnerabilities on 0.40; dependency manifests unchanged |
| Static application bundle | PASS — 29 files / 317,718 bytes; `28/28` source-to-distribution files match |
| Core-test source syntax | PASS — LLVM-MinGW `clang++ -fsyntax-only`; assertions not executed on Windows |
| Pico 2 W release cross-build | PASS — Release, Pico SDK `2.3.0`, LLVM runtime supplied for local generators |
| Binary protocol compatibility | PASS by source scope — report table and `protocolVersion` remain `1` |

## Release artifact identity

| Property | Value |
| --- | --- |
| UF2 size | `1,415,168` bytes |
| SHA-256 | `0EAE9C8BE83A817C1E5E2365834F08B4DA284D3464CDC4C169CA4BAF159F4873` |
| Address range | `0x10000000..0x100aca74` |
| DS5Dongle-relative size | `92.8%` (`110,080` bytes smaller) |

Build identity, UF2 inspection and SHA-256 do not prove behavior on the Pico.
No automatic flash is allowed.

## DS5Dongle-relative score before 0.41 hardware retest

| Capability | DS5Dongle | MiraLink 0.40 observed | MiraLink 0.41 candidate | Evidence change |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | 0.40 bridge recovered after restart; no new descriptor proof |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | 0.40 passive reconnect failed; 0.41 page-scan rearm is software-only |
| Input / motion / touch | 100% | 77% | 77% | Historical buttons/sticks and live Lab sample only; motion/touch untested |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No physical output test |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | No physical wake or brutal-loss proof |
| Configuration / diagnostics | 100% | 82% | 82% | Diagnostics completed after restart; no new hardware capability proof |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | **No increase before the 0.41 hardware run** |

Raw source coverage remains `76%`. The reference baseline is fixed at `100%`;
UF2 size is reported separately and is not a quality score.
