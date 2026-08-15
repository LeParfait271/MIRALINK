# MiraLink 0.45 — validation record

- Candidate date: `2026-08-15`
- Board target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
- Binary protocol: `1` (unchanged)
- Hardware status: **candidate not yet flashed**

## Evidence retained from the 0.42 material run

The `0.42` hardware run established that the bridge could enumerate and that a
DualSense could pair and produce input after the site opened the local pairing
window. When the controller was powered off and the Pico was restarted, the
controller blinked once but did not reconnect through the remembered key; a new
pairing was required. This is **OBSERVÉ** physical behavior for `0.42`, not a
software-only inference.

The same run showed isolated WebHID write/receive failures that recovered after
one bounded retry. Those messages are retained as a separate WebHID limitation;
they are not treated as proof of the Bluetooth cause.

## Mandatory DS5Dongle reference

Every firmware diagnosis in this project now compares the affected lifecycle
with the clean-room behavioral reference `DS5Dongle v0.7.2-hotfix`:

- reference UF2: `1,525,248` bytes;
- reference SHA-256:
  `4E43FE427D9463B113B24518A9B35707B4963E6E1F94EA8148E2DF4104EA80DA`;
- official source inspected:
  [DS5Dongle `bt.cpp` at v0.7.2-hotfix](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp).

The reference configures page scanning before radio operation and explicitly
restores connectability on `HCI_EVENT_DISCONNECTION_COMPLETE`. MiraLink uses
that lifecycle boundary as a behavioral reference only; it does not copy its
code, binary, protocol or internal data structures.

## Cause and correction

### OBSERVÉ — physical symptom

With `0.42`, the remembered DualSense did not passively reconnect after a
power-off/Pico-restart sequence. It flashed once, then remained offline until
pairing was opened again.

### INFÉRÉ — likely failure mode

MiraLink rearmed page scan mainly from the HID-close path. That request could be
issued before the controller's ACL/HCI teardown had completed, after which the
final Bluetooth transition could leave the page scan unavailable. This is a
source-supported hypothesis, not a packet capture.

### PROUVÉ — source-level difference

Before `0.45`, MiraLink had no explicit
`HCI_EVENT_DISCONNECTION_COMPLETE` handling in its Bluetooth event switch. The
DS5Dongle reference does handle that event and restores connectability there.

The `0.45` candidate therefore:

- requests page-scan recovery at the HCI disconnection-complete boundary;
- performs the BTstack writes only from the foreground polling path;
- reapplies the scan parameters and the forced connectable `0 -> 1` transition;
- keeps discoverability disabled outside the explicit five-minute pairing
  window and keeps incoming acceptance limited to remembered controllers.

## Software and hardware gates

| Gate | Result |
| --- | --- |
| Pico cross-build | PASS — Release, Pico SDK `2.3.0`, Arm GNU Toolchain `15.2.1` |
| Native core-test target compilation | PASS — compiled with LLVM-MinGW; executable not launched |
| UF2 family/version inspection | PASS — `0.45`, `rp2350-arm-s`, `0x10000000..0x100acaac` |
| Native Windows `miralink-core-tests.exe` | **NOT RUN — forbidden without the exact LLVM runtime** |
| Hardware flash | **NOT RUN — manual only** |
| Passive reconnect on a flashed `0.45` Pico | **NOT PROVEN** |
| WebHID/Controller Lab stability on `0.45` | **NOT PROVEN** |

The build, UF2 inspection and source comparison prove packaging and intended
control flow only. They do not prove a radio state on a physical Pico or a
controller reconnect on Windows.

## DS5Dongle-relative score before the 0.45 hardware retest

| Capability | DS5Dongle | MiraLink 0.42 | MiraLink 0.45 | Evidence change |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | No new material host proof |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | HCI-boundary correction is software-only |
| Input / motion / touch | 100% | 77% | 77% | Historical buttons/sticks and live Lab sample only; motion/touch untested |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No physical effect test |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | USB audio remains disabled |
| Wake / recovery | 100% | 45% | 45% | Restart and abrupt-loss recovery remain untested |
| Configuration / diagnostics | 100% | 82% | 82% | No new hardware capability proof |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | **No increase before a new material run** |

Raw source coverage remains `76%`. UF2 size is reported separately and is not a
quality score.

## Release artifact identity

Build identity, picotool inspection and SHA-256 do not prove behavior on the
Pico. No automatic flash is allowed.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | `707,244` | `A3D1997C9CFC42265D61D31A91743FBD476AAE689424079D32E40D5E885F9D1F` |
| `miralink_pico_firmware.elf` | `4,510,432` | `C1A0FCD2B0F8FAAA76A2A7441CEADF662F2E0EB4575B72367223698B0B33A8D8` |
| `miralink_pico_firmware.hex` | `1,989,353` | `A6F3877314C450A141D18E9E39BF166D40817FC79D3DB3B83A62FC04DEE3D2DC` |
| `miralink_pico_firmware.uf2` | `1,415,168` | `3FEA11515204D34E8167FF3F7FA80797499CB51358064B4405B829779CDA40B9` |

The UF2 is `92.8%` of the fixed DS5Dongle reference size, or `110,080` bytes
smaller. Size is not a quality score.

## Required manual validation

1. Flash `0.45` manually in BOOTSEL mode and keep the existing Bluetooth key.
2. Turn the DualSense off, then press `PS` once without opening pairing in
   MiraLink. Confirm reconnection, one Windows controller and resumed input.
3. Repeat after restarting the Pico and after an abrupt controller loss.
4. Run Controller Lab/WebHID for 30–60 minutes without opening a new pairing
   window; record any reconnect, duplicate-device, stale-input or WebHID error.

Do not increase the DS5Dongle score unless these material observations provide
new, reproducible evidence.
