# MiraLink 0.39 firmware validation record

Date: 2026-08-14<br>
Developer: MaruChiwa<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Build type: Release<br>
Delivery: GitHub manual-test candidate; no automatic flash

## Change verified in source

Firmware `0.39` separates a persistent configuration commit from the
disruptive USB identity change that followed it in `0.38`. A successful
`COMMIT_CONFIG` returns a two-byte, versioned payload: byte `0` is schema `1`
and bit `0` of byte `1` reports whether the effective PID or USB serial policy
requires re-enumeration. Standard and Auto both resolve to PID `0x0ce6`, so a
change between those modes does not request a needless USB cycle. Edge resolves
to PID `0x0df2`.

`COMMIT_CONFIG` never schedules a disconnect. Only the separate,
payload-free `RECONNECT_USB` command can request one. Its intent is attached to
the response occupying the single MiraLink response slot, is invalidated if a
new response or error replaces that slot, and becomes a 250 ms deferred USB
cycle only after TinyUSB has served the matching response report `0x71` to the
host.

The configuration wire contract is strict on both sides of the bridge. A
configuration payload contains exactly 24 bytes; only Feature-flag bits `0..6`
are accepted, and reserved bytes `15..23` must all be zero. Invalid length,
unknown flags or non-zero reserved bytes are rejected before staging.

The configured mode now selects the USB persona only. During a pairing window,
Bluetooth discovery accepts the recognized standard and Edge identities
independently of that persona. A fresh bridge with no remembered controller
still opens its bounded five-minute pairing window automatically. Successful
descriptor acquisition and a complete, strict-length, CRC-valid enhanced input
report `0x31` remain required before input is exposed or a new address is
trusted. These structural checks are not cryptographic controller
authentication.

## Static and automated validation

| Check | Result |
| --- | --- |
| Application JavaScript syntax | Passed (`npm run check`) |
| Application unit tests | Passed (`105/105`) |
| Application dependency audit | Passed at release time (`npm audit`: 0 known vulnerabilities) |
| Browser journeys | Passed (`11/11`, desktop only) |
| Application production build | Passed; 29 files, 302,822 bytes in the final local `app/dist` build |
| Pico 2 W Release cross-build | Passed with Arm GNU 15.2.1 and Pico SDK 2.3.0 |
| Commit/re-enumeration source invariant | Passed: `COMMIT_CONFIG` has no reconnect assignment; only the explicit command can attach the deferred action to response `0x71` |
| Pure ACK and USB-identity assertions | Present in the native core-test source; the Windows test executable was not run during this 0.39 pass |
| Release artifact integrity | Passed: packaged BIN, ELF, HEX and UF2 sizes and SHA-256 values match the frozen build outputs |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W `0.39`, `pico2_w`, RP2350 ARM Secure, SDK 2.3.0, Release |
| UF2 family | Passed: `rp2350-arm-s` |
| Flash or 0.39 hardware test | Not performed |

Picotool reports binary range `0x10000000..0x100aca64` and `extra security:
not enabled`. `ARM Secure` names the RP2350 image architecture; it does not
claim that this UF2 is signed or encrypted.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.39/miralink_pico_firmware.uf2` | 1,415,168 | `4133C3792562AA99D835D41E322B629C1D8FB741C5B56F1168D9FF6E31EBBBBE` |
| `firmware/releases/0.39/miralink_pico_firmware.elf` | 4,506,684 | `F960F8696230AC89C1569D1366D907AA3076FB1E5596EEC5157C2266C7CC46DF` |
| `firmware/releases/0.39/miralink_pico_firmware.bin` | 707,172 | `C50071FE58910015979CC3724FBE78CA2E014CA8C983E7770D7208FDDA6E3B98` |
| `firmware/releases/0.39/miralink_pico_firmware.hex` | 1,989,170 | `0B768AA7C50A508986F415089E3D4075B60468C2EC202554583376E946AF4598` |

## Hardware validation still required

No result from the real `0.38` Pico 2 W/DualSense run is promoted into a
`0.39` hardware claim. After manually flashing the `0.39` UF2 on the other
Windows computer, verify all of the following in order:

1. Windows exposes exactly one Pico-owned controller and the site reports
   firmware `0.39`.
2. Initial and remembered DualSense pairing reach a rising validated-input
   sample count, with working buttons, sticks and triggers.
3. A non-identity configuration commit completes without disconnecting USB or
   the controller.
4. A standard/Auto-to-Edge, Edge-to-standard/Auto, or serial-policy change
   returns the re-enumeration-required flag while leaving USB connected.
5. Only a separately confirmed explicit reconnect, or a physical unplug/replug,
   applies the new identity; the bridge and controller can then reconnect or
   re-pair normally.
6. Motion, touch, outputs, suspend/wake and the reported audio-link state are
   tested separately. USB Audio remains disabled and no audio stream is
   claimed.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.38 observed | MiraLink 0.39 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** |
| UF2 relative size, not a quality score | 100% | 92.7% | 92.8% |

Firmware `0.39` receives no score increase before its own hardware retest.
Full weights and evidence are in `docs/COMPARISON_DS5DONGLE.md`.
