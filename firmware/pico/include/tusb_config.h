#pragma once

// MiraLink exposes a vendor HID bridge and a standard HID gamepad collection.
// The audio pipeline remains compiled for future descriptor work, but USB
// audio is deliberately not exposed until its Windows composite descriptor is
// validated on a real Pico 2 W.
#ifndef CFG_TUSB_MCU
#define CFG_TUSB_MCU OPT_MCU_RP2040
#endif
#ifndef CFG_TUSB_OS
#define CFG_TUSB_OS OPT_OS_PICO
#endif

#define CFG_TUD_ENABLED 1
#define CFG_TUD_HID 1
#define CFG_TUD_AUDIO 0
#define CFG_TUD_ENDPOINT0_SIZE 64
// Feature and input reports carry 64 data bytes plus one non-zero report ID.
// TinyUSB uses this value for the control-transfer buffer as well as the
// endpoint staging buffer, so 64 would make SET_REPORT(65 bytes) stall.
#define CFG_TUD_HID_EP_BUFSIZE 65
#define CFG_TUD_MAX_SPEED OPT_MODE_FULL_SPEED
