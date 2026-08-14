# MiraLink 0.40 — validation record

- Candidate date: `2026-08-14`
- Board target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
- Binary protocol: `1` (unchanged)
- Hardware status: **not yet validated on 0.40**

## Evidence inherited from the 0.38 and 0.39 hardware runs

The manual Windows run with firmware `0.38` established one bridge-owned
controller entry, working buttons and sticks in `joy.cpl`, and a material
configuration commit. That commit also exposed the implicit USB re-enumeration
problem fixed in `0.39`.

The later `0.39` run established these bounded facts:

- initial Bluetooth pairing succeeded;
- a live input sample reached the quick controller test and Controller Lab;
- diagnostics and configuration read reached the Pico;
- isolated WebHID Feature write and receive failures occurred during the
  session;
- after the controller was turned off, it did not reconnect from its remembered
  key and had to be paired again.

No Bluetooth packet capture was taken during that run. It did not separately
revalidate `joy.cpl` input or a configuration commit on `0.39`.

This run did not validate motion, touch, controller outputs, suspend/wake,
audio, abrupt-link-loss recovery or the `0.40` correction.

## 0.40 correction under validation

Firmware `0.40` changes the remembered-controller lifecycle without changing
the wire protocol:

- remembered controllers reconnect passively; automatic remembered-key
  `hid_host_connect` attempts no longer reserve BTstack's single HID-host slot;
- outgoing HID connects are limited to supported devices found during an
  active pairing inquiry, automatically opened only when no key exists and
  otherwise opened by the user;
- page scan is configured only after `HCI_STATE_WORKING`;
- connectability is rearmed after close and discoverability remains disabled
  outside pairing;
- the pairing window closes on the first complete CRC-valid enhanced `0x31`
  input;
- response report `0x71` stays readable until the next MiraLink command report
  produces a success or error response, while a deferred USB reconnect action
  is consumed only once.

The application adds a cancellable per-device FIFO, strict identity/lifecycle
checks, bounded receive-only retries, a recursive 100 ms controller poll with
250/500 ms backoff, and actual USB-disappearance observation for
`RECONNECT_USB`. An ambiguously written `SET_REPORT` is never resent.

## Final software evidence

| Gate | Result |
| --- | --- |
| Application unit tests | PASS — `109/109` |
| Desktop end-to-end scenarios | PASS — `15/15` |
| Dependency audit | PASS — `npm audit --audit-level=low`, 0 known vulnerabilities |
| Static application bundle | PASS — 29 files / 313 178 bytes |
| Core-test source syntax | PASS — ARM compiler syntax-only; assertions were not executed on Windows |
| Pico 2 W release cross-build | PASS |
| Binary protocol compatibility | PASS — report table and `protocolVersion` remain `1` |

The Windows host-test executable was deliberately not launched because its
LLVM runtime DLLs are not self-contained. No dialog involving missing
`libc++.dll` or `libunwind.dll` is a test result.

## Firmware artifact identity

| Property | Value |
| --- | --- |
| UF2 size | `1,414,656` bytes |
| SHA-256 | `A3BB4FF3A67D9EB293D8499033D0FADFA2BCD59365A711B60C9D8754A7DBA677` |
| Address range | `0x10000000..0x100ac9e4` |
| DS5Dongle-relative size | `92.7%` |

The UF2 is 110,592 bytes (`7.2508%`) smaller than the fixed 1,525,248-byte
DS5Dongle reference. Size is not a quality score. A successful build, hash and
UF2 inspection do not prove behavior on a flashed board.

## Required manual validation

Use the released `0.40` UF2 on a Pico 2 W and keep each observation separate
from the software evidence above.

### 1. Clean enumeration and initial input

1. Flash `0.40` manually and restart the Pico normally.
2. Confirm that Windows shows exactly one bridge-owned controller in
   `joy.cpl`.
3. Pair the DualSense once if the Pico has no remembered key.
4. Confirm a ready bridge, a validated input stream, buttons/sticks and
   Controller Lab.

### 2. Remembered reconnect — release gate

Repeat at least 20 times without reopening pairing:

1. start with the controller connected and inputs active;
2. turn the controller off and confirm neutral/disconnected state;
3. turn it on with the PS button, without using pairing mode;
4. confirm that it reconnects from the remembered key and inputs resume;
5. record reconnect duration, failure stage/status and reconnect-attempt
   counters when available.

Acceptance requires 20/20 passive reconnects with no re-pairing, no duplicate
Windows controller and no stale non-neutral input after disconnect.

### 3. Restart and abrupt-loss recovery

- Restart the Pico while the key remains stored, then power the controller on
  normally and confirm passive reconnect.
- Repeat after abrupt controller power loss and after leaving/re-entering radio
  range.
- Confirm that connectability returns after each close and that an unknown
  controller is not accepted outside an active pairing window.

### 4. WebHID and Controller Lab soak

Run for 30 to 60 minutes while alternating Controller Lab, configuration read,
configuration commit and diagnostics. Confirm:

- no overlapping or duplicated command side effect;
- isolated receive failures recover without replaying the command;
- disconnect cancels stale work and a controlled reopen requires a new strict
  `HELLO`;
- 10 Hz Controller Lab polling remains visually usable;
- game input in `joy.cpl` remains independent of management polling.

### 5. Explicit USB reconnect

Test both observable paths after a configuration change that requires
re-enumeration:

- ACK decoded, then actual USB disappearance and reappearance;
- ACK read becomes ambiguous, then actual USB disappearance and reappearance.

In both cases, confirm one reconnect only. If no disappearance occurs within
the bounded observation window, the application must report failure, clear its
expected-disconnect state and resume polling without resending
`RECONNECT_USB`.

## Release score before hardware retest

| Capability | DS5Dongle | MiraLink 0.39 | MiraLink 0.40 | Evidence change |
| --- | ---: | ---: | ---: | --- |
| USB persona / host compatibility | 100% | 72% | 72% | No descriptor change or new hardware proof |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | Passive reconnect corrected in software only |
| Input / motion / touch | 100% | 77% | 77% | 0.38 `joy.cpl` buttons/sticks and 0.39 live Lab sample proven; motion/touch untested |
| Rumble / LEDs / triggers / mute | 100% | 48% | 48% | No physical output test |
| USB audio / HD haptics / microphone | 100% | 5% | 5% | Active USB audio remains unavailable |
| Wake / recovery | 100% | 45% | 45% | No physical wake or brutal-loss test |
| Configuration / diagnostics | 100% | 82% | 82% | WebHID lifecycle hardened in software only |
| **Weighted proven score** | **100%** | **54.4%** | **54.4%** | **No increase before the 0.40 material run** |

Raw source coverage remains `76%`. The hardware result must be appended to a
later validation record; this file must not be retroactively rewritten to turn
the current candidate status into a passed material claim.
