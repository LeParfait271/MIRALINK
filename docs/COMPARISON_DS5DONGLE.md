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

## Current comparison — MiraLink 0.37

| Capability | Weight | DS5Dongle | MiraLink 0.36 observed | MiraLink 0.37 candidate | New evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 20% | 100% | 30% | 43% | 0.36 produced two Pico-owned Windows children; 0.37 has one root Gamepad plus a statically checked nested vendor collection, not yet retested |
| Bluetooth pairing / reconnect | 20% | 100% | 30% | 40% | 0.36 pairing expired; 0.37 delays trust until valid input and removes only a failed new key, compiled but not hardware-tested |
| Input / motion / touch | 15% | 100% | 63% | 63% | Automated parsing/report proof unchanged; no physical input reached the bridge |
| Rumble / LEDs / triggers / mute | 15% | 100% | 48% | 48% | Output normalization remains tested statically; no physical effect validated |
| USB audio / HD haptics / microphone | 15% | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 7.5% | 100% | 45% | 45% | Unit/static evidence only |
| Configuration / diagnostics | 7.5% | 100% | 77% | 77% | Typed Feature protocol and application tests pass; device exchange still untested |
| **Weighted proven score** | **100%** | **100%** | **39%** | **43%** | **0.37 is a compiled test candidate, not a hardware success** |

MiraLink 0.37 keeps `76%` raw source coverage. The earlier 0.36 estimate of
`46%` proven was superseded by the real Windows failure, which established
duplicate enumeration and no validated Bluetooth link. The 0.37 score recovers
only compiled/static evidence until the corrected image is manually tested.

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

MiraLink 0.37 is 117,760 bytes (`7.7%`) smaller than the reference. Size alone
says nothing about compatibility, stability, latency or quality and is
excluded from the functional score.

For every later firmware modification, preserve the weights and publish the
compact form `Capability | DS5Dongle | MiraLink before | MiraLink after | New
evidence`, keeping DS5Dongle fixed at `100%`.
