#pragma once

// MiraLink exposes one HID interface and exactly one root Gamepad Application
// collection. Vendor-defined management is nested under that root: a second
// top-level collection creates a duplicate controller child on Windows, while
// a second interface is probed as another Sony controller on Linux. The audio
// pipeline remains compiled for future descriptor work, but USB audio is not
// exposed until it is validated on real hardware.
#ifndef CFG_TUSB_MCU
#define CFG_TUSB_MCU OPT_MCU_RP2040
#endif
#ifndef CFG_TUSB_OS
#define CFG_TUSB_OS OPT_OS_PICO
#endif

#define CFG_TUD_ENABLED 1
#define CFG_TUD_HID 1
#ifndef CFG_TUD_AUDIO
#define CFG_TUD_AUDIO 0
#endif
#define CFG_TUD_ENDPOINT0_SIZE 64
// MiraLink control Feature reports carry 64 data bytes plus one non-zero
// report ID. TinyUSB uses this value for the control-transfer buffer as well as
// the endpoint staging buffer, so 64 would make SET_REPORT(65 bytes) stall.
#define CFG_TUD_HID_EP_BUFSIZE 65
#define CFG_TUD_MAX_SPEED OPT_MODE_FULL_SPEED
