# MiraLink validation log

Date: `2026-08-12`
Version: `0.2.0`
Developer: `MaruChiwa`
Scope: local software and firmware build only

## Passed

- JavaScript protocol tests: 6 passed.
- JavaScript UF2 tests: 4 passed.
- JavaScript syntax checks: `app.js`, `protocol.js`, `storage.js`, `i18n.js` passed.
- Local application build: `MiraLink 0.2.0 built`.
- Local browser check: 7 tabs visible, Bridge controls present, Firmware panel
  present, backup file input present, no console errors.
- Pico 2 W configure/build: ARM GCC 15.2.1, SDK 2.3.0, board `pico2_w`,
  RP2350 ARM Secure target; build completed.
- `picotool` inspection: firmware name `MiraLink Pico 2 W`, version `0.2.0`,
  target `RP2350`, board `pico2_w`, SDK `2.3.0`.
- MiraLink UF2 parser: `338` program blocks, `173568` bytes, accepted.
- ARM toolchain archive: MD5 verified before extraction.

## Generated artifacts

The verified `firmware/releases/0.2.0/` directory contains the copied release
artifacts from the local Pico build:

- `miralink_pico_firmware.elf` — `994620` bytes;
- `miralink_pico_firmware.bin` — `86412` bytes;
- `miralink_pico_firmware.hex` — `243110` bytes;
- `miralink_pico_firmware.uf2` — `173568` bytes.

## Boundaries

- No Pico 2 W was connected during this validation.
- No controller was connected.
- No UF2 was flashed.
- No production USB VID/PID has been assigned; the current identity is
  development-only.
- Bluetooth, audio, controller adapters, recovery UX and full hardware
  diagnostics are not yet validated.
- The C++ host test executable was not run because no native Windows C++
  compiler is installed; the same core sources were compiled as part of the
  real ARM firmware build.
