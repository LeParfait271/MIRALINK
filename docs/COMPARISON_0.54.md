# MiraLink 0.54 / DS5Dongle comparison

DS5Dongle is fixed at 100%. The proven MiraLink score does not increase until
the new UF2 is tested on the Pico 2 W with the PS-only reconnect matrix.

| Axis | DS5Dongle | MiraLink 0.53 | MiraLink 0.54 | Evidence |
| --- | ---: | ---: | ---: | --- |
| Passive Bluetooth reconnect | 100% | 55% | 55% | Authenticated inbound ACL plus explicit stale-CID rearm built; physical result pending |
| Bluetooth bootstrap | 100% | 55% | 55% | `0x32` now precedes Feature GET retries, matching the reference lifecycle |
| Input / motion / touch | 100% | 77% | 77% | No input parser change |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | Neutral bootstrap only; hardware effects unvalidated |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | No new physical wake evidence |
| Configuration / diagnostics | 100% | 82% | 82% | No configuration change |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | No score increase without hardware evidence |

The 0.54 UF2 is 904,704 bytes versus 1,525,248 bytes for the DS5Dongle
reference (59.3%). Size is informational only and is not part of the score.
