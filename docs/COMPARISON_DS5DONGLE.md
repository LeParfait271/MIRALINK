# MiraLink / DS5Dongle firmware comparison

Reference baseline: official DS5Dongle `v0.7.2-hotfix` release from
[`awalol/DS5Dongle`](https://github.com/awalol/DS5Dongle/releases/tag/v0.7.2-hotfix),
asset `ds5-bridge-v0.7.2-hotfix.uf2`, SHA-256
`4E43FE427D9463B113B24518A9B35707B4963E6E1F94EA8148E2DF4104EA80DA`.
The reference is fixed at `100%` in every category.

## Repeatable scoring method

Raw coverage measures implemented capability relative to the observable
DS5Dongle baseline. The proven score discounts it according to the strongest
evidence: `1.00` full target-hardware/host validation, `0.85` partial hardware
matrix, `0.70` behavioral or descriptor tests, `0.50` compiled/static path,
`0.20` disabled skeleton, or `0` absent. A real failed test overrides a more
optimistic static estimate for the path it disproves.

The global result is the weighted mean. Version bumps, documentation and image
size do not increase functional scores. A later hardware validation may raise
the proven score without changing raw coverage.

## Mandatory diagnostic reference

For every firmware problem, the official DS5Dongle `v0.7.2-hotfix` UF2 and
source are consulted before MiraLink is changed. The fixed reference asset is
`ds5-bridge-v0.7.2-hotfix.uf2` with SHA-256
`4E43FE427D9463B113B24518A9B35707B4963E6E1F94EA8148E2DF4104EA80DA`.
The comparison is behavioral and clean-room: no DS5Dongle code, binary,
private protocol or internal structure is reused.

## Current comparison — MiraLink 0.51

| Capability | Weight | DS5Dongle | MiraLink 0.41 candidate | MiraLink 0.46 candidate | MiraLink 0.47 candidate | MiraLink 0.48 candidate | MiraLink 0.50 candidate | MiraLink 0.51 candidate | New evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 20% | 100% | 72% | 72% | 72% | 72% | 72% | 72% | No descriptor change or new host proof |
| Bluetooth pairing / reconnect | 20% | 100% | 55% | 55% | 55% | 55% | 55% | 55% | Immediate radio re-arm + native state bootstrap compiled; hardware remains untested |
| Input / motion / touch | 15% | 100% | 77% | 77% | 77% | 77% | 77% | 77% | No input-path change |
| Rumble / LEDs / triggers / mute | 15% | 100% | 48% | 48% | 48% | 48% | 48% | 48% | State bootstrap is neutral; physical effects remain unvalidated |
| USB audio / HD haptics / microphone | 15% | 100% | 5% | 5% | 5% | 5% | 5% | 5% | USB audio class remains disabled |
| Wake / recovery | 7.5% | 100% | 45% | 45% | 45% | 45% | 45% | 45% | No wake/recovery change |
| Configuration / diagnostics | 7.5% | 100% | 82% | 82% | 82% | 82% | 82% | 82% | No configuration change |
| **Weighted proven score** | **100%** | **100%** | **54.4%** | **54.4%** | **54.4%** | **54.4%** | **54.4%** | **54.4%** | **No score increase without a new hardware retest** |

MiraLink 0.51 keeps `76%` raw source coverage. The weighted total is computed
directly from the visible weights and equals `54.425%`, displayed as `54.4%`.
The 0.40 hardware run confirms bridge recovery and radio readiness but explicitly
fails remembered reconnect after controller power-off and Pico restart. The
0.47 run confirms initial pairing and live Controller Lab input, but three
PS-only reconnects and the Pico-restart reconnect still failed. It does not
validate motion, touch, controller outputs, wake or audio. The 0.48
discoverability correction remains discounted until a manual flash/test.

MiraLink's strongest work beyond the baseline remains its typed CRC-framed
management protocol, diagnostics/logs, local profiles/backups and UF2
inspection. Its largest parity gap remains active USB speaker, HD-haptics and
microphone support.

## Size indicator — not a quality score

| Image | Bytes | DS5Dongle-relative size |
| --- | ---: | ---: |
| DS5Dongle v0.7.2-hotfix UF2 | 1,525,248 | 100% |
| MiraLink 0.36 UF2 | 1,408,000 | 92.3% |
| MiraLink 0.37 UF2 | 1,407,488 | 92.3% |
| MiraLink 0.38 UF2 | 1,414,144 | 92.7% |
| MiraLink 0.39 UF2 | 1,415,168 | 92.8% |
| MiraLink 0.40 UF2 | 1,414,656 | 92.7% |
| MiraLink 0.41 UF2 | 1,415,168 | 92.8% |
| MiraLink 0.42 UF2 | 1,411,072 | 92.5% |
| MiraLink 0.45 UF2 | 1,415,168 | 92.8% |
| MiraLink 0.46 UF2 | 1,415,680 | 92.8% |
| MiraLink 0.47 UF2 | 1,417,728 | 93.0% |
| MiraLink 0.48 UF2 | 1,417,728 | 93.0% |
| MiraLink 0.49 UF2 | 1,417,728 | 93.0% |
| MiraLink 0.50 UF2 | 1,420,288 | 93.1% |
| MiraLink 0.51 UF2 | 1,422,848 | 93.3% |
| MiraLink 0.58 UF2 | 905,216 | 59.4% |
| MiraLink 0.59 UF2 | 905,216 | 59.4% |
| MiraLink 0.60 UF2 | 905,216 | 59.4% |

MiraLink 0.60 size is recorded from the frozen release build. Size alone says
nothing about compatibility, stability, latency or quality and is excluded from
the functional score.

## MiraLink 0.58 delta

The 0.58 source change removes the HID admission prerequisite that still
depended on the pairing window, remembered-address cache, or a pre-recorded
ACL flag. This follows the DS5Dongle sequence: accept the gamepad ACL first,
then let authenticated HID setup and the strict enhanced report decide whether
the controller becomes usable. No physical 0.58 run exists yet, so the proven
score is deliberately unchanged.

| Capability | DS5Dongle | MiraLink 0.57 | MiraLink 0.58 | New evidence |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | No USB descriptor change |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | ACL + HID admission gates aligned in source; hardware untested |
| Input / motion / touch | 100% | 77% | 77% | No input report change |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No new physical-output evidence |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | No new hardware evidence |
| Configuration / diagnostics | 100% | 82% | 82% | No configuration change |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | Score stays frozen until hardware validation |

For every later firmware modification, preserve the weights and publish the
compact form `Capability | DS5Dongle | MiraLink before | MiraLink after | New
evidence`, keeping DS5Dongle fixed at `100%`.

## MiraLink 0.59 delta

The 0.59 source change closes the remaining ACL lifecycle gaps found in the
side-by-side DS5Dongle comparison: the incoming gamepad page is tracked before
HID exists, SSP/PIN responses do not depend on the RAM cache, authentication
failure removes the active stale key, and the handshake deadline can terminate
an ACL with no HID CID. No physical 0.59 run exists, so the proven score stays
unchanged.

| Capability | DS5Dongle | MiraLink 0.58 | MiraLink 0.59 | New evidence |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | No USB descriptor change |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | ACL, SSP/PIN, stale-key and raw-ACL timeout paths aligned in source; hardware untested |
| Input / motion / touch | 100% | 77% | 77% | No input report change |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No new physical-output evidence |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | No new hardware evidence |
| Configuration / diagnostics | 100% | 82% | 82% | No configuration change |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | Score stays frozen until hardware validation |

## MiraLink 0.60 delta

The 0.60 source change removes a confirmed state-machine deadlock on the
incoming HID path. BTstack does not emit `SET_PROTOCOL` for an incoming
Report-mode connection; 0.59 nevertheless marked that response pending, which
blocked the native activation report and Feature bootstrap used to reach the
DualSense 0x31 stream. 0.60 clears the flag for that path and keeps the
bootstrap gated by descriptor/encryption/report validation. No physical 0.60
run has been performed, so the proven score remains unchanged.

| Capability | DS5Dongle | MiraLink 0.59 | MiraLink 0.60 | New evidence |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | No USB descriptor change |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | Incoming Report-mode handshake deadlock removed in source; hardware untested |
| Input / motion / touch | 100% | 77% | 77% | No input report change |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No new physical-output evidence |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | No new hardware evidence |
| Configuration / diagnostics | 100% | 82% | 82% | No configuration change |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | Score stays frozen until hardware validation |
