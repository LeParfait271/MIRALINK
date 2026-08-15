# Validation 0.60

MiraLink 0.60 fixes a confirmed source-level deadlock in the passive
PS-only reconnect path. BTstack's incoming HID Report-mode path goes directly
to SDP/descriptor discovery and does not emit `SET_PROTOCOL`; 0.59 set a
pending flag anyway, so activation traffic stayed blocked. The flag is now
explicitly clear after a successful incoming Report-mode admission.

Evidence:

- Official DS5Dongle comparison: its incoming ACL/HID path proceeds directly
  to HID channel setup and sends the activation output; it does not wait for a
  Report-mode `SET_PROTOCOL` response.
- Pico Release cross-build: PASS.
- Host core test: 1/1 PASS.
- Physical Pico 2 W/DualSense test: not performed for 0.60 yet.

Firmware artifact:

- `firmware/releases/0.60/miralink_pico_firmware.uf2`
- 905,216 bytes
- SHA-256 `B83278628FB3F8646CFE3593AD0F2964C385F0EAB285D4C46F91748C1C771613`
- metadata version `0.60`, target `pico2_w`, `rp2350-arm-s`, range
  `0x10000000..0x1006e61c`

No Bluetooth key or configuration reset is performed by this build.
