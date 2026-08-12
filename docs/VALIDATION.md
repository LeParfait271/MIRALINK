# MiraLink validation log

Date: `2026-08-12`
Version: `0.9.0` WebHID deployment compatibility; validated source and local firmware candidate `0.6.0`; historical firmware artifact `0.2.0`
Developer: `MaruChiwa`
Scope: local software checks and firmware source inspection

## 0.9.0 software checks

- WebHID availability now records whether the page is secure and whether the
  Permissions Policy reports `hid` as blocked.
- Cloudflare Pages headers explicitly allow WebHID for the MiraLink origin.
- The previous UF2 was inspected read-only as a behavioral reference; no source
  or firmware content was imported.

## 0.8.0 software checks

- WebHID feature-report command exchange now reads the response explicitly with
  `receiveFeatureReport(2)` instead of waiting for an `inputreport` event.
- The offline shell precaches both `dualsense.js` and `hid-transport.js`, so the
  controller and bridge paths remain available after the first local load.
- A regression fixture verifies delayed feature responses, sequence matching and
  typed device errors locally.
- No firmware binary, visual file, `app/dist/` artifact or hardware result was
  changed in this fix.

## 0.7.0 process checks

- The guardrail and workflow documents were updated before this commit.
- This process-only lot does not claim a new firmware build or hardware test.
- The previously validated 0.6.0 software and firmware results remain the active evidence.

## 0.6.0 software checks

- JavaScript tests: `50` passed.
- JavaScript syntax checks: application, protocol and DualSense adapter passed.
- DualSense parser fixture: wired report identity, sticks, triggers and button
  bits passed locally.
- Application and firmware source changes were kept outside the visual files
  and `app/dist/`.

## 0.6.0 boundaries

- The Pico 2 W firmware source was rebuilt locally with Pico SDK `2.3.0` and
  Arm GNU Toolchain `15.2.1`; the build produced ELF/BIN/HEX outputs.
- A local 0.6.0 UF2 was packaged with the official `picotool` 2.3.0; it was
  not flashed or published.
- No Pico 2 W or DualSense was connected, so no hardware result is claimed.
- The direct WebHID adapter and Pico-side Bluetooth HID host have software
  fixtures, but neither path has been validated with a real device in this
  session.

## Passed

- JavaScript protocol tests: 6 passed.
- JavaScript UF2 tests: 4 passed.
- JavaScript syntax checks: `app.js`, `protocol.js`, `storage.js`, `i18n.js` passed.
- Historical local application build: `MiraLink 0.2.0 built`.
- Local browser check: 7 tabs visible, Bridge controls present, Firmware panel
  present, backup file input present, no console errors.
- Pico 2 W configure/build: ARM GCC 15.2.1, SDK 2.3.0, board `pico2_w`,
  RP2350 ARM Secure target; build completed with the Classic HID host and
  confirmation-gated pairing command.
- Firmware source outputs were produced in the ignored `firmware/pico/build-btstack2/`
  directory. The C++ core test executable was built with LLVM-MinGW and passed
  `ctest` (1/1).
- The packaged candidate is `firmware/releases/0.6.0/miralink_pico_firmware.uf2`,
  852480 bytes, with SHA-256
  `BA7A89F0F759BEB1A53E806178FBF885F15843AEDA41B5BF6D5BC910F78C83A5`.
- SHA-256 of the local source outputs: ELF
  `2C948F0088CCD54AA19117A6F843D98C4812245EFAF379C2938043C581B3C9E4`, BIN
  `D85DF3D369788ADD02FC6AE87C313344A965AA6F39E86EE54B41AD6D0BF3B9B7`, HEX
  `68600F4D97CA34D494D99C8A22A0F58E466F93786F6D93537D44BE849895E8E0`.
- Historical `picotool` inspection: firmware name `MiraLink Pico 2 W`, version `0.2.0`,
  target `RP2350`, board `pico2_w`, SDK `2.3.0`.
- MiraLink UF2 parser: `338` program blocks, `173568` bytes, accepted.
- ARM toolchain archive: MD5 verified before extraction.

## Generated artifacts

The local 0.6.0 manual-test candidate contains:

- `firmware/releases/0.6.0/miralink_pico_firmware.uf2` — `852480` bytes;
- `firmware/releases/0.6.0/SHA256SUMS.txt` — checksum manifest.

The historical `firmware/releases/0.2.0/` directory contains the copied release
artifacts from the earlier local Pico build:

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
- Audio, recovery UX and full hardware diagnostics are not yet validated.
- Bluetooth host behavior, pairing, input reports and flash persistence still
  require a real Pico 2 W and DualSense test; the software build alone is not a
  hardware claim.
