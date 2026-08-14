# MiraLink 0.38 firmware validation record

Date: 2026-08-14<br>
Developer: MaruChiwa<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: GitHub manual-test candidate; no automatic flash

## Change verified in source

The manual Windows test of firmware `0.37` showed exactly one controller child,
partially validating the corrected single-root USB topology, but its Properties
panel remained inert. Source analysis found a deterministic activation lock
consistent with that result: MiraLink accepted only enhanced Bluetooth input
`0x31`, while a DualSense begins with minimal input `0x01`, and the bridge did
not initiate the Feature traffic which enables the enhanced stream.

Firmware `0.38` starts a bounded, non-blocking Feature sequence after the HID
descriptor is available: `0x05`, then `0x09`, then `0x20`. Each response is
checked for the requested ID and exact report length. Timeouts release only the
active GET transaction and advance the sequence; a bounded neutral-output
fallback is attempted last. Report `0x01` is liveness-only. Trust, `Connected`
and input forwarding require a complete, strict-length, CRC-valid `0x31`.

BTstack retains caller-owned output buffers until an asynchronous
`L2CAP_EVENT_CAN_SEND_NOW`. The build therefore creates a SHA-locked copy of
the Pico SDK `hid_host.c`, changes the send guard to accept only the
`ESTABLISHED` state, and adds one CID-scoped GET-timeout helper. CMake removes
the original source from the interface target before compiling the generated
copy. The SDK checkout itself remains unchanged. MiraLink keeps old and queued
buffers occupied until a new send returns success.

Persistent configuration writes now run through the Pico SDK
`flash_safe_execute` guard, which prevents USB/CYW43/BTstack interrupts from
executing out of XIP flash during erase/program. Millisecond deadlines use the
64-bit boot clock, radio-off clears stale input state, and a failed CYW43 init
returns an unavailable snapshot without touching an uninitialized lock.

## Static and automated validation

| Check | Result |
| --- | --- |
| Application JavaScript syntax | Passed |
| Application unit tests | Passed (`98/98`) |
| Application dependency audit | Passed at release time (`npm audit`: 0 known vulnerabilities) |
| Browser journeys | Passed (`20/20`, 10 desktop and 10 mobile) |
| Browser coverage | Synthetic bridge HELLO/info/state/diagnostics, cold offline reload, keyboard tabs, responsive fold, no horizontal overflow, no serious/critical Axe violation |
| Application production build | Passed; 29 files, 257,709 bytes in the final local `app/dist` build |
| Final UF2 application inspection | Passed: 2,762 physical blocks, one load sequence and one exact Picotool RP2350-E10 sentinel; local SHA-256 matched the packaged UF2 |
| Native MiraLink core test | Passed (`1/1`) after runtime DLL colocation |
| Bluetooth bootstrap unit coverage | Passed: strict report classification, Feature ID/length checks, sequence, timeout advance and enhanced-input/control-response race |
| BTstack overlay source lock | Passed: normalized source SHA-256 `696D1481221359D42F71E57910409F5A646458E5F8A84B104F6CBBFF4A78AF7C` |
| BTstack overlay build inspection | Passed: generated `hid_host.c` compiled once; SDK original not compiled; helper symbol present in ELF |
| Pico flash-write safety | Passed statically: configuration backend calls `flash_safe_execute`; symbol present in ELF; physical power-loss/write test not performed |
| Pico 2 W Release build | Passed with Arm GNU 15.2.1 and Pico SDK 2.3.0 |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W `0.38`, `pico2_w`, RP2350 ARM Secure, SDK 2.3.0 |
| UF2 family | Passed: `rp2350-arm-s` |
| Flash or 0.38 hardware test | Not performed |

Picotool reports binary range `0x10000000..0x100ac8dc` and `extra security:
not enabled`. `ARM Secure` therefore does not claim that the image is signed
or encrypted.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.38/miralink_pico_firmware.uf2` | 1,414,144 | `6C99A87FB935EFC33F092FF9B49D8EB20F9F52AB06D8D7E73F54AFF4B6D1E969` |
| `firmware/releases/0.38/miralink_pico_firmware.elf` | 4,492,144 | `5C54447DDE5EB9850786F77FD032EB4665B23459425DFE2FA98F5DC347201925` |
| `firmware/releases/0.38/miralink_pico_firmware.bin` | 706,780 | `4ADEA2C4CBFF88198A0B3C608D92A09DC31CCDFA268A329A266B61CDE8F78010` |
| `firmware/releases/0.38/miralink_pico_firmware.hex` | 1,988,061 | `E9583F37E2113472FFF9C1200231152E21DE867D293400DEF6061DD2A2AAD254` |

## Hardware validation still required

Manually flash `0.38`, then verify on the other Windows PC: one `joy.cpl`
controller, WebHID HELLO and firmware `0.38`, diagnostic response, initial and
remembered Bluetooth pairing, a rising validated-input sample count, buttons,
sticks, motion and touch. Only after input works should rumble, LEDs, adaptive
triggers, standard/Edge modes, reconnect and suspend/explicit wake be tested.
USB audio remains disabled and is outside this candidate.

## Post-release manual Windows result

The user later flashed `0.38` on a Pico 2 W connected to a separate Windows
computer. This run confirmed exactly one Windows controller entry, a ready
MiraLink bridge, active Bluetooth input and working buttons and sticks in
`joy.cpl`. The site reported firmware `0.38`, USB `PASS`, radio `PASS`, flash
`PASS`, and an audio link with no stream. Motion, touch, outputs, suspend/wake
and audio rendering were not exercised.

The diagnostic retained `Last Bluetooth issue: connection opening (status
0x04)`. In BTstack this status is a page timeout: it records that one connection
opening attempt could not reach the controller. It is not evidence by itself of
an authentication failure or a corrupt stored key, and the successful active
input proves that the enhanced-report bootstrap worked during this run.

The user then changed polling mode, enabled the USB serial number and enabled
the persisted PS-shortcut flag. The flash commit completed, firmware `0.38`
automatically re-enumerated USB because the serial policy changed, and the user
reported that the controller light went out and that the controller could not
subsequently be reached or re-paired during the session. No Bluetooth packet
capture was made, so the exact radio failure is not asserted. Static review
confirmed that polling and the PS flag did not schedule USB re-enumeration;
the serial-policy change did.

This post-release result raises the proven Bluetooth/input evidence but also
invalidates implicit re-enumeration as a safe configuration workflow. Firmware
`0.39` therefore separates commit from the disruptive USB action and leaves
its recovery change unproven until another manual flash/test.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.37 observed | MiraLink 0.38 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **44.0%** | **50.3%** |
| UF2 relative size, not a quality score | 100% | 92.3% | 92.7% |

Full weights and evidence are in `docs/COMPARISON_DS5DONGLE.md`.
