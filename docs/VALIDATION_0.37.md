# MiraLink 0.37 firmware validation record

Date: 2026-08-14<br>
Target: Raspberry Pi Pico 2 W (`pico2_w`), RP2350 ARM Secure<br>
Delivery: GitHub manual-test candidate; no automatic flash

## Change verified in source

Firmware 0.37 corrects the failed Windows topology observed after flashing
0.36. The single HID interface now contains exactly one top-level
Application/Gamepad collection, with MiraLink's vendor Application collection
nested inside it. The native `0x01`/`0x02` controller path and the
`0x05`/`0x09`/`0x20` host-probe Features are unchanged; management continues
through Feature reports `0x70` and `0x71`.

Bluetooth association is also hardened. A previously unknown address is not
added to the runtime remembered-controller list until a valid DualSense input
report arrives. A failed new attempt may drop only its newly created,
unvalidated link key. Keys known before the attempt are never removed by this
cleanup. When an explicit pairing action tears down a stale HID CID, all late
events from that exact CID are ignored until its close event, or a finalized
failed open event, consumes the tombstone. A disconnect is retried outside the
BTstack callback every 250 ms, at most 40 times and for at most 10 seconds.
Events from a different new CID continue normally.

The Pico target now uses the SDK polling async context instead of the
`threadsafe_background` IRQ worker. `tud_task()` runs first, then
`cyw43_arch_poll()`, then the audio and Bluetooth state machines. BTstack
callbacks and foreground Bluetooth operations therefore execute serially on
the main loop; that loop remains non-blocking.

## Static and automated validation

| Check | Result |
| --- | --- |
| Application JavaScript syntax | Passed |
| Application tests | Passed (`68/68`) |
| Application production build | Passed |
| Native MiraLink core test | Passed (`1/1`) |
| HID descriptor compile-time checks | Passed: one root collection, one root Application/Gamepad, one nested vendor Application, balanced collections, Features `0x70`/`0x71` each exactly once |
| Existing report-size checks | Passed: Input `0x01`, Output `0x02`, Features `0x05`/`0x09`/`0x20`, no Input `0x72` |
| CYW43/BTstack execution context | Passed at build inspection: `PICO_CYW43_ARCH_POLL=1`, `LIB_PICO_ASYNC_CONTEXT_POLL=1`, no `PICO_CYW43_ARCH_THREADSAFE_BACKGROUND` |
| Pico 2 W Release build | Passed with Arm GNU 15.2.1 and Pico SDK 2.3.0 |
| UF2 metadata inspection | Passed: MiraLink Pico 2 W `0.37`, `pico2_w`, RP2350 ARM Secure, SDK 2.3.0 |
| UF2 family | Passed: `rp2350-arm-s` |
| Flash or 0.37 hardware test | Not performed |

Picotool reports binary range `0x10000000..0x100abbb4` and `extra security:
not enabled`. `ARM Secure` therefore does not claim that the image is signed
or encrypted.

## Artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `firmware/releases/0.37/miralink_pico_firmware.uf2` | 1,407,488 | `3FC7119F4513B2AE75CA4D57286C6C36F729C63D8C1ADF94DA3F2ABE1E5B9E30` |
| `firmware/releases/0.37/miralink_pico_firmware.elf` | 4,454,976 | `3900DF390D451E331F2E024C20D78CFF9653C8D692F66E13E6B5D5AD96949282` |
| `firmware/releases/0.37/miralink_pico_firmware.bin` | 703,412 | `1FD35D7D4717DC2D59FF118EA4912FB3126F4C24733E4C41753136BFA31D7988` |
| `firmware/releases/0.37/miralink_pico_firmware.hex` | 1,978,595 | `F9D944CFEB52E25880F93ECE6E85CFA6D589FB895626EB92BD3CB8AF96881AEC` |

## Hardware validation still required

The 0.37 descriptor statically prevents the two-root topology that produced
two Windows controller children in 0.36. This correction is not considered
validated until a manual 0.37 flash shows exactly one entry in `joy.cpl`.
Then test WebHID `0x70`/`0x71`, first Bluetooth pairing, remembered reconnect,
inputs, motion, rumble, adaptive triggers, standard/Edge mode and
suspend/explicit wake. USB audio remains disabled and is outside this lot.

An old partial link key created by 0.36 cannot be distinguished safely from a
valid stored key. Version 0.37 deliberately preserves such pre-existing keys;
if pairing still fails, collect MiraLink diagnostics before considering any
manual bond reset.

## DS5Dongle baseline

| Indicator | DS5Dongle v0.7.2-hotfix | MiraLink 0.36 observed | MiraLink 0.37 candidate |
| --- | ---: | ---: | ---: |
| Functional coverage before proof penalty | 100% | 76% | 76% |
| **Weighted proven score** | **100%** | **39%** | **43%** |
| UF2 relative size, not a quality score | 100% | 92.3% | 92.3% |

The score was revised downward after the 0.36 hardware failure; a compiled
fix does not restore hardware proof. Full weights and evidence are in
`docs/COMPARISON_DS5DONGLE.md`.
