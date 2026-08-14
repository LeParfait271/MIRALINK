# MiraLink / DS5Dongle firmware comparison

Reference baseline: official DS5Dongle `v0.7.2-hotfix` release from
[`awalol/DS5Dongle`](https://github.com/awalol/DS5Dongle/releases/tag/v0.7.2-hotfix),
asset `ds5-bridge-v0.7.2-hotfix.uf2`, SHA-256
`4E43FE427D9463B113B24518A9B35707B4963E6E1F94EA8148E2DF4104EA80DA`.
The reference is fixed at `100 %` in every category.

## Repeatable scoring method

Each MiraLink category has two values:

- **raw coverage**: capability relative to the observable DS5Dongle baseline;
  it may exceed `100 %` only for a real additional capability;
- **proven score**: raw coverage multiplied by the strongest evidence
  coefficient: `1.00` validated on target hardware and hosts, `0.85` partial
  hardware matrix, `0.70` behavioral/descriptor automated tests, `0.50`
  compiled/static path, `0.20` disabled skeleton, or `0` absent.

The global result is the weighted mean. A version bump, documentation change
or smaller image never raises a functional score. A hardware validation may
raise the proven score without changing raw coverage.

## Current comparison — MiraLink 0.36

| Capability | Weight | DS5Dongle | MiraLink raw | Evidence | MiraLink proven |
| --- | ---: | ---: | ---: | ---: | ---: |
| USB persona / host compatibility | 20% | 100% | 85% | 0.70 | 60% |
| Bluetooth pairing / reconnect | 20% | 100% | 80% | 0.50 | 40% |
| Input / motion / touch | 15% | 100% | 90% | 0.70 | 63% |
| Rumble / LEDs / triggers / mute | 15% | 100% | 80% | 0.60 | 48% |
| USB audio / HD haptics / microphone | 15% | 100% | 25% | 0.20 | 5% |
| Wake / recovery | 7.5% | 100% | 75% | 0.60 | 45% |
| Configuration / diagnostics | 7.5% | 100% | 110% | 0.70 | 77% |
| **Weighted global** | **100%** | **100%** | **76%** | — | **46%** |

The strongest MiraLink 0.36 gains are its typed CRC-framed management
protocol, diagnostics/logs, local profiles/backups and UF2 inspection. The
largest parity gap remains the active USB speaker, HD-haptics and microphone
path. Every controller-facing path still lacks physical Pico 2 W validation,
which is why the proven score is substantially lower than raw coverage.

## Size indicator — not a quality score

| Image | Bytes | DS5Dongle-relative size |
| --- | ---: | ---: |
| DS5Dongle v0.7.2-hotfix UF2 | 1,525,248 | 100% |
| MiraLink 0.36 UF2 | 1,408,000 | 92.3% |

MiraLink is 117,248 bytes (`7.7 %`) smaller. This says nothing by itself about
compatibility, stability, latency or quality and is excluded from the global
score.

For future firmware lots, preserve the weights and report the compact form
`Capability | DS5Dongle | MiraLink before | MiraLink after | New evidence`.
