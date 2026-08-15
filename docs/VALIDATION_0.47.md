# MiraLink 0.47 validation

Date: 2026-08-15
Developer: MaruChiwa
Status: software candidate; not flashed or physically tested

## Reference-driven firmware change

The official [DS5Dongle v0.7.2-hotfix source](https://raw.githubusercontent.com/awalol/DS5Dongle/v0.7.2-hotfix/src/bt.cpp)
was consulted before the change. Its authentication-complete path drops a
stored link key after an authentication failure. MiraLink 0.47 implements a
clean-room, narrower equivalent: the HCI handle and address must match the
active controller, the address must have been known before the attempt, and no
valid enhanced `0x31` input may have crossed the trust boundary.

Observed: the 0.39/0.40 manual runs required re-pairing after controller
power-off. Inferred: a stale bond or passive-reconnect lifecycle can prevent a
known controller from returning. Proven in this candidate: the new policy is
purely tested, the source compiles and the Pico image contains the 0.47
metadata. No Bluetooth packet capture or 0.47 hardware observation exists.

## Software gates

| Gate | Result |
| --- | --- |
| Pico 2 W Release cross-build | PASS |
| Core test with the provisioned LLVM-MinGW runtime | PASS, 1/1 |
| npm syntax check | PASS |
| Application unit tests | PASS, 109/109 |
| Desktop Playwright scenarios | PASS, 16/16 |
| npm dependency audit | PASS, 0 vulnerabilities |
| Pico metadata | PASS, 0.47 / RP2350 ARM Secure / `0x10000000..0x100acf44` |
| UF2 SHA-256 and package files | PASS |

## Physical validation still required

Flash manually, pair once, turn the DualSense off and back on with PS only,
then repeat after a Pico reboot. To exercise stale-key recovery, reproduce an
authentication failure or replace the controller bond, open the explicit
pairing window and verify that only the failed remembered address is removed.
Record the complete diagnostics line and whether Controller Lab receives a
new enhanced input sample. Do not treat this build as hardware-proven until
that matrix passes.

## Firmware comparison score

DS5Dongle remains the 100% reference. MiraLink stays at 76% raw source
coverage and 54.4% proven weighted coverage; no score increase is justified
without new physical evidence.
