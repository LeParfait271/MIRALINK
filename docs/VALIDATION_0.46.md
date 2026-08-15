# MiraLink 0.46 — validation record

- Candidate date: `2026-08-15`
- Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure
- Protocol version: `1` (unchanged)
- Hardware status: **not yet flashed**

## Why this correction exists

The 0.45 manual run proved initial pairing and live Controller Lab input, but
the remembered DualSense blinked once and then went dark after power-off; PS-only
reconnection did not complete. No Bluetooth packet capture was available.

The official DS5Dongle `v0.7.2-hotfix` source explicitly restores connectability
at `HCI_EVENT_DISCONNECTION_COMPLETE`. MiraLink 0.46 keeps that lifecycle
boundary, but performs BTstack writes in the foreground poll. It additionally
retires a stale SDP/HID-host slot when ACL teardown is authoritative, so the
single BTstack HID slot cannot block the next inbound PS-only connection.

Reference source:
<https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp>

## Gates

| Gate | Result |
| --- | --- |
| Pico cross-build | PASS — Release, SDK 2.3.0, Arm GNU 15.2.1 |
| UF2 inspection | PASS — 0.46, rp2350-arm-s, 0x10000000..0x100acbbc |
| Native core-test executable | Compiled; not launched on Windows |
| Hardware flash | Not performed automatically |
| PS-only reconnect on 0.46 | **NOT PROVEN** |

## Manual test required

Keep the existing bond, flash the UF2 manually, verify Controller Lab input,
power off the controller, press PS once without opening pairing, and repeat once
after a Pico restart. Record the complete diagnostics summary if reconnect fails.

## DS5Dongle-relative score

| Axis | DS5Dongle | MiraLink 0.45 | MiraLink 0.46 | Evidence |
| --- | ---: | ---: | ---: | --- |
| Bluetooth pairing / reconnect | 100% | 55% | 55% | Firmware correction only; fresh hardware proof pending |
| Weighted proven score | 100% | 54.4% | 54.4% | No score increase before hardware validation |

Raw source coverage remains `76%`. Image size is reported separately and is
not a functional score.

## Artifact identity

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| BIN | 707,516 | `8EE870A090BE6A2F17C6EB35318A6FFE0CDBAC597A32A88625450463D02DB00E` |
| ELF | 4,512,560 | `5A4597B32439048A777D96BD8F0DE5539ADDD7CE53F88F9A22241B97BAA5C6C5` |
| HEX | 1,990,118 | `E18550BB285384915BFBE24DC47DB6E46636647223E70EE800B927EB1A9E5F31` |
| UF2 | 1,415,680 | `B1B9DDBF916E5C9EA48C2E99C848C62CF468B1D7DD6169749E73A9EC4D538826` |
