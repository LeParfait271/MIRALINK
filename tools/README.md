# Local MiraLink development tools

These tools are local build inputs and are excluded from the MiraLink source
history. They are not runtime dependencies of the desktop application.

Downloaded from official upstream distributors on 2026-08-12:

- Raspberry Pi Pico SDK `2.3.0`, with its official submodules;
- Arm GNU Toolchain `15.2.Rel1`, Windows x64 `arm-none-eabi`;
- CMake `3.31.4`, portable Windows x64;
- Ninja `1.13.2`, Windows;
- Raspberry Pi `picotool 2.3.0`, Windows x64.
- LLVM-MinGW `20260616`, used only for native build helpers and C++ tests, never in the firmware or application runtime.
- Raspberry Pi Pico examples are kept locally as an ignored API reference for
  the Bluetooth HID host integration; no example source is part of MiraLink's
  runtime or implementation.

The ARM archive was verified before extraction. Its MD5 was
`88CCE5F8C71445CF54DFA1667B3AE6AB`, matching the official download response.

No old MiraLink-audited project, old UF2, old site or old repository is stored
here or used as an implementation source.
