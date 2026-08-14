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

## Current comparison — MiraLink 0.38

| Capability | Weight | DS5Dongle | MiraLink 0.37 observed | MiraLink 0.38 candidate | New evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 20% | 100% | 72% | 72% | The 0.37 manual test showed exactly one Pico-owned Windows controller entry; 0.38 does not claim additional USB hardware proof |
| Bluetooth pairing / reconnect | 20% | 100% | 25% | 45% | 0.37 delivered no validated input; source analysis found an activation lock consistent with the observation, without a packet capture. 0.38 adds the bounded Feature bootstrap and neutral fallback, software-tested only |
| Input / motion / touch | 15% | 100% | 50% | 63% | The real 0.37 Properties test stayed inert; 0.38 strictly gates input on a complete CRC-valid enhanced `0x31` report, not yet physically retested |
| Rumble / LEDs / triggers / mute | 15% | 100% | 48% | 48% | Output normalization remains tested statically; no physical effect is validated |
| USB audio / HD haptics / microphone | 15% | 100% | 5% | 5% | USB audio remains disabled and source-only |
| Wake / recovery | 7.5% | 100% | 45% | 45% | The 64-bit deadline and radio-failure degraded paths are build/static evidence only; suspend/wake remains physically untested |
| Configuration / diagnostics | 7.5% | 100% | 77% | 82% | The control deck, diff-gated writes, checksummed backups, typed Feature protocol, profiles, strengthened UF2 inspection and flash-safe firmware backend are software-tested; a real bridge exchange remains unconfirmed |
| **Weighted proven score** | **100%** | **100%** | **44.0%** | **50.3%** | **0.38 improves the compiled candidate but is not a physical Bluetooth/input success yet** |

MiraLink 0.38 keeps `76%` raw source coverage. The weighted totals are computed
directly from the visible weights: the observed `0.37` result is `44.0%`, and
the software-only `0.38` candidate is `50.325%`, displayed as `50.3%`. The
single Windows controller entry raises USB evidence, while the real lack of
input lowers the Bluetooth/input evidence that earlier static estimates had
overstated.

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

MiraLink 0.38 is 111,104 bytes (`7.3%`) smaller than the reference. Size alone
says nothing about compatibility, stability, latency or quality and is
excluded from the functional score.

For every later firmware modification, preserve the weights and publish the
compact form `Capability | DS5Dongle | MiraLink before | MiraLink after | New
evidence`, keeping DS5Dongle fixed at `100%`.
