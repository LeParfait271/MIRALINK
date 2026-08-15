# MiraLink firmware 0.51

Developer: MaruChiwa<br>
Target: Raspberry Pi Pico 2 W / RP2350 ARM Secure<br>
SDK: Pico SDK 2.3.0<br>
Build: Release

Firmware 0.51 addresses the remembered DualSense PS-only reconnect path using
the same clean-room lifecycle cues as the official DS5Dongle reference:

- the HCI disconnection boundary immediately reapplies interlaced page scan,
  connectability and discoverability, with the foreground re-arm retained as
  a bounded fallback;
- every HID connection schedules one neutral native Bluetooth state report
  (`0x32`, CRC-protected) after SET_PROTOCOL, which asks the controller to leave
  its compact Bluetooth input mode before the existing feature bootstrap;
- the report is static, bounded and sent at most three times if BTstack is
  temporarily busy; it never contains user haptics or light commands.

The behavior was compared against the official DS5Dongle v0.7.2-hotfix source
before implementation. No DS5Dongle code, binary, private protocol or internal
structure was copied. This is a locally built candidate: it has not yet been
flashed to a physical Pico 2 W, so PS-only reconnect remains the next manual
validation item.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `miralink_pico_firmware.bin` | 710,980 | `65600CD1D4FB24EDBAA0872A705B796D2CB22FEC692E539F756517958CF2E94B` |
| `miralink_pico_firmware.elf` | 4,558,692 | `A9374B99ADDE93B23342FEEF59B190278A665B02689EF09FCCC109C1AFF62F8C` |
| `miralink_pico_firmware.hex` | 1,999,880 | `F7030A1D8DEC698ECF460D7F37C67FD2921927CBCE44C858E911D71576784D30` |
| `miralink_pico_firmware.uf2` | 1,422,848 | `9041EA1FE9CEBE42A016B1AAB04E2C368D7F2D494A604A06E65EE39C8540B168` |

Do not flash until the SHA-256 values in `SHA256SUMS.txt` match the downloaded
files. Audio streaming remains disabled and no new hardware claim is made by
this release.
