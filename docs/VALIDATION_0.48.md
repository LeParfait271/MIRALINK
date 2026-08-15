# MiraLink 0.48 validation

Date: 2026-08-15
Developer: MaruChiwa
Status: software candidate; not flashed or physically tested

## Reference-driven firmware change

The official [DS5Dongle v0.7.2-hotfix source](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp)
was consulted before the change. Its authentication-complete path drops a
stored link key after an authentication failure and restores connectable plus
discoverable state after ACL teardown. MiraLink 0.48 implements clean-room,
narrow equivalents: the HCI handle and address must match the active
controller for key recovery, and the radio lifecycle restores discoverability
without weakening the remembered-address admission policy.

Observed: the 0.39/0.40 manual runs required re-pairing after controller
power-off and after a Pico reboot, while the official DS5Dongle reconnects
without a new pairing window. Inferred: the missing discoverable radio state
was one plausible lifecycle divergence; no Bluetooth packet capture exists.
Proven in this candidate: the new policy is purely tested, the source compiles
and the Pico image contains the 0.48 metadata. No 0.48 hardware observation
exists.

## Software gates

| Gate | Result |
| --- | --- |
| Pico 2 W Release cross-build | PASS |
| Core test with the provisioned LLVM-MinGW runtime | PASS, 1/1 |
| npm syntax check | PASS |
| Application unit tests | PASS, 109/109 |
| Desktop Playwright scenarios | PASS, 16/16 |
| npm dependency audit | PASS, 0 vulnerabilities |
| Pico metadata | PASS, 0.48 / RP2350 ARM Secure / `0x10000000..0x100acf4c` |
| UF2 SHA-256 and package files | PASS |

## Physical validation still required

Flash manually, pair once, turn the DualSense off and back on with PS only,
then repeat after a Pico reboot. The expected result is automatic reconnect
without opening a new pairing window, matching DS5Dongle. Record the complete
diagnostics line and whether Controller Lab receives a new enhanced input
sample. Do not treat this build as hardware-proven until that matrix passes.

## Firmware comparison score

DS5Dongle remains the 100% reference. MiraLink stays at 76% raw source
coverage and 54.4% proven weighted coverage; no score increase is justified
without new physical evidence.
