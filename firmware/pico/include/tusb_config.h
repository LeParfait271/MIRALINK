#pragma once

// MiraLink exposes a vendor HID bridge, a standard HID gamepad collection and
// a self-contained UAC2 headset function. Audio is kept in bounded RAM and
// never persisted. The composite descriptor remains subject to a separate
// manual Pico 2 W validation before it can be described as hardware-proven.
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

// One UAC2 headset function: a four-channel playback stream (stereo speaker
// plus two haptic channels) and a mono local capture/monitor stream. The
// 48 kHz format is fixed so the clock source cannot be reconfigured into an
// unsupported mode by a host.
#define CFG_TUD_AUDIO_FUNC_1_DESC_LEN 228
#define CFG_TUD_AUDIO_FUNC_1_N_FORMATS 1
#define CFG_TUD_AUDIO_FUNC_1_MAX_SAMPLE_RATE 48000
#define CFG_TUD_AUDIO_FUNC_1_N_CHANNELS_RX 4
#define CFG_TUD_AUDIO_FUNC_1_N_CHANNELS_TX 1
#define CFG_TUD_AUDIO_FUNC_1_FORMAT_1_N_BYTES_PER_SAMPLE_RX 2
#define CFG_TUD_AUDIO_FUNC_1_FORMAT_1_RESOLUTION_RX 16
#define CFG_TUD_AUDIO_FUNC_1_FORMAT_1_N_BYTES_PER_SAMPLE_TX 2
#define CFG_TUD_AUDIO_FUNC_1_FORMAT_1_RESOLUTION_TX 16

#define CFG_TUD_AUDIO_ENABLE_EP_OUT 1
#define CFG_TUD_AUDIO_ENABLE_EP_IN 1
#define CFG_TUD_AUDIO_ENABLE_FEEDBACK_EP 0
#define CFG_TUD_AUDIO_ENABLE_INTERRUPT_EP 0

// Full-speed UAC2 packets normally contain 384 bytes (48 frames x 4 x 2) for
// playback and 96 bytes for capture. TinyUSB requires one frame of headroom.
#define CFG_TUD_AUDIO_FUNC_1_EP_OUT_SZ_MAX 392
#define CFG_TUD_AUDIO_FUNC_1_EP_IN_SZ_MAX 98
#define CFG_TUD_AUDIO_FUNC_1_EP_OUT_SW_BUF_SZ (CFG_TUD_AUDIO_FUNC_1_EP_OUT_SZ_MAX * 4)
#define CFG_TUD_AUDIO_FUNC_1_EP_IN_SW_BUF_SZ (CFG_TUD_AUDIO_FUNC_1_EP_IN_SZ_MAX * 4)
#define CFG_TUD_AUDIO_FUNC_1_N_AS_INT 2
#define CFG_TUD_AUDIO_FUNC_1_CTRL_BUF_SZ 64
