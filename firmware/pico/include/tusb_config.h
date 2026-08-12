#pragma once

// MiraLink uses one vendor-defined HID interface with control feature reports.
#ifndef CFG_TUSB_MCU
#define CFG_TUSB_MCU OPT_MCU_RP2040
#endif
#ifndef CFG_TUSB_OS
#define CFG_TUSB_OS OPT_OS_PICO
#endif

#define CFG_TUD_ENABLED 1
#define CFG_TUD_HID 1
#define CFG_TUD_ENDPOINT0_SIZE 64
#define CFG_TUD_HID_EP_BUFSIZE 64
#define CFG_TUD_MAX_SPEED OPT_MODE_FULL_SPEED
