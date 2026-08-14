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

## Current comparison — MiraLink 0.39

| Capability | Weight | DS5Dongle | MiraLink 0.38 observed | MiraLink 0.39 candidate | New evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 20% | 100% | 72% | 72% | The 0.38 run showed exactly one Pico-owned Windows controller entry; the explicit-re-enumeration change in 0.39 is not yet physically retested |
| Bluetooth pairing / reconnect | 20% | 100% | 55% | 55% | Pairing and a valid enhanced input stream worked on 0.38, but reconnect/re-pair after a configuration-triggered USB cycle failed; 0.39 removes the implicit cycle and broadens supported-controller discovery, software-tested only |
| Input / motion / touch | 15% | 100% | 77% | 77% | Real buttons and sticks worked through the bridge; motion and touch were available in the report but not manually exercised |
| Rumble / LEDs / triggers / mute | 15% | 100% | 48% | 48% | Output normalization remains tested in software; no physical effect is validated |
| USB audio / HD haptics / microphone | 15% | 100% | 5% | 5% | Diagnostics saw an audio link without a stream; the USB Audio class remains disabled |
| Wake / recovery | 7.5% | 100% | 45% | 45% | Deadline and radio-failure paths are build/static evidence only; suspend/wake remains physically untested |
| Configuration / diagnostics | 7.5% | 100% | 82% | 82% | Real configuration commit and diagnostics worked, but the implicit USB lifecycle was unsafe; 0.39 adds a versioned ACK, explicit re-enumeration and a separate factory-default flow without new hardware proof |
| **Weighted proven score** | **100%** | **100%** | **54.4%** | **54.4%** | **0.39 fixes the observed lifecycle in software but receives no score increase before a hardware retest** |

MiraLink 0.39 keeps `76%` raw source coverage. The weighted total is computed
directly from the visible weights and equals `54.425%`, displayed as `54.4%`.
The 0.38 hardware run raises Bluetooth and input evidence because one native
controller and working buttons/sticks were observed. It does not validate
motion, touch, controller outputs, wake or audio, and the 0.39 recovery changes
remain discounted until the next manual flash/test.

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

MiraLink 0.39 is 110,080 bytes (`7.2%`) smaller than the reference. Size alone
says nothing about compatibility, stability, latency or quality and is
excluded from the functional score.

For every later firmware modification, preserve the weights and publish the
compact form `Capability | DS5Dongle | MiraLink before | MiraLink after | New
evidence`, keeping DS5Dongle fixed at `100%`.
