#pragma once

// MiraLink exposes a vendor HID bridge plus a local UAC2 four-channel speaker
// endpoint. The host audio stream is kept in RAM and is never persisted.
#ifndef CFG_TUSB_MCU
#define CFG_TUSB_MCU OPT_MCU_RP2040
#endif
#ifndef CFG_TUSB_OS
#define CFG_TUSB_OS OPT_OS_PICO
#endif

#define CFG_TUD_ENABLED 1
#define CFG_TUD_HID 1
#define CFG_TUD_AUDIO 1
#define CFG_TUD_ENDPOINT0_SIZE 64
// Feature and input reports carry 64 data bytes plus one non-zero report ID.
// TinyUSB uses this value for the control-transfer buffer as well as the
// endpoint staging buffer, so 64 would make SET_REPORT(65 bytes) stall.
#define CFG_TUD_HID_EP_BUFSIZE 65
#define CFG_TUD_MAX_SPEED OPT_MODE_FULL_SPEED

// The descriptor below contains one UAC2 control interface and one streaming
// interface: 8+9+9+8+17+26+12+9+9+16+6+7+8 = 144 bytes.
#define CFG_TUD_AUDIO_FUNC_1_DESC_LEN 144
#define CFG_TUD_AUDIO_FUNC_1_MAX_SAMPLE_RATE 48000
#define CFG_TUD_AUDIO_FUNC_1_N_CHANNELS_RX 4
#define CFG_TUD_AUDIO_FUNC_1_N_BYTES_PER_SAMPLE_RX 2
#define CFG_TUD_AUDIO_FUNC_1_RESOLUTION_RX 16
#define CFG_TUD_AUDIO_ENABLE_EP_OUT 1
#define CFG_TUD_AUDIO_ENABLE_FEEDBACK_EP 0
#define CFG_TUD_AUDIO_FUNC_1_EP_OUT_SZ_MAX TUD_AUDIO_EP_SIZE(CFG_TUD_AUDIO_FUNC_1_MAX_SAMPLE_RATE, CFG_TUD_AUDIO_FUNC_1_N_BYTES_PER_SAMPLE_RX, CFG_TUD_AUDIO_FUNC_1_N_CHANNELS_RX)
#define CFG_TUD_AUDIO_FUNC_1_EP_OUT_SW_BUF_SZ (CFG_TUD_AUDIO_FUNC_1_EP_OUT_SZ_MAX * 4)
#define CFG_TUD_AUDIO_FUNC_1_N_AS_INT 1
#define CFG_TUD_AUDIO_FUNC_1_CTRL_BUF_SZ 64
