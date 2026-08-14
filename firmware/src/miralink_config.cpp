#include "miralink_config.h"

#include <algorithm>
#include <cmath>

namespace miralink {

Config default_config() { return Config{}; }

ValidationResult validate_config(const Config& config) {
    if (config.schema != kConfigSchema) return {false, "unsupported configuration schema"};
    if (!std::isfinite(config.haptics_gain) || config.haptics_gain < 1.0f || config.haptics_gain > 2.0f) return {false, "haptics_gain is outside 1.0..2.0"};
    if (config.speaker_volume > 127 || config.headset_volume > 127) return {false, "volume is outside 0..127"};
    if (config.speaker_gain > 7) return {false, "speaker_gain is outside 0..7"};
    if (config.inactive_minutes > 60) return {false, "inactive_minutes is outside 0..60"};
    if (config.polling_mode > 2) return {false, "polling_mode is unsupported"};
    if (config.audio_buffer_length < 16 || config.audio_buffer_length > 127) return {false, "audio_buffer_length is outside 16..127"};
    if (config.controller_mode > 2) return {false, "controller_mode is unsupported"};
    if (config.trigger_reduce > 10) return {false, "trigger_reduce is outside 0..10"};
    // GPIO 0..22 are the normal user-facing digital pins on Pico 2 W. Keep
    // CYW43, flash and other board-reserved pins outside this optional status
    // output so a stored setting cannot alter a board-internal signal.
    if (config.status_gpio_pin != 0xff && config.status_gpio_pin > 22) return {false, "status_gpio_pin must be disabled or within 0..22"};
    if (config.status_gpio_mode > 1) return {false, "status_gpio_mode is unsupported"};
    return {true, {}};
}

std::array<std::uint8_t, kConfigEncodedBytes> encode_config(const Config& config) {
    std::array<std::uint8_t, kConfigEncodedBytes> bytes{};
    bytes[0] = config.schema;
    const auto gain = static_cast<std::uint16_t>(std::lround(config.haptics_gain * 100.0f));
    bytes[1] = static_cast<std::uint8_t>(gain & 0xff); bytes[2] = static_cast<std::uint8_t>((gain >> 8) & 0xff);
    bytes[3] = config.speaker_volume; bytes[4] = config.headset_volume; bytes[5] = config.speaker_gain;
    bytes[6] = config.inactive_minutes; bytes[7] = config.polling_mode; bytes[8] = config.audio_buffer_length; bytes[9] = config.controller_mode;
    std::uint16_t flags = 0;
    if (config.disable_led) flags |= kFlagDisableLed; if (config.enable_usb_serial) flags |= kFlagEnableUsbSerial; if (config.ps_shortcut) flags |= kFlagPsShortcut;
    if (config.disable_mic) flags |= kFlagDisableMic; if (config.disable_speaker) flags |= kFlagDisableSpeaker; if (config.enable_wake) flags |= kFlagEnableWake; if (config.lock_volume) flags |= kFlagLockVolume;
    bytes[10] = static_cast<std::uint8_t>(flags & 0xff); bytes[11] = static_cast<std::uint8_t>((flags >> 8) & 0xff);
    bytes[12] = config.trigger_reduce; bytes[13] = config.status_gpio_pin; bytes[14] = config.status_gpio_mode;
    return bytes;
}

ValidationResult decode_config(const std::vector<std::uint8_t>& bytes, Config& output) {
    if (bytes.size() != kConfigEncodedBytes) {
        return {false, "configuration payload must be exactly 24 bytes"};
    }
    const auto flags = static_cast<std::uint16_t>(bytes[10])
        | static_cast<std::uint16_t>(bytes[11]) << 8;
    if ((flags & static_cast<std::uint16_t>(~kConfigFeatureFlagsMask)) != 0) {
        return {false, "configuration payload has unsupported feature flags"};
    }
    if (std::any_of(bytes.begin() + static_cast<std::ptrdiff_t>(kConfigReservedOffset),
            bytes.end(), [](const std::uint8_t byte) { return byte != 0; })) {
        return {false, "configuration payload reserved bytes must be zero"};
    }
    output = default_config();
    output.schema = bytes[0];
    const auto gain = static_cast<std::uint16_t>(bytes[1]) | static_cast<std::uint16_t>(bytes[2]) << 8;
    output.haptics_gain = static_cast<float>(gain) / 100.0f;
    output.speaker_volume = bytes[3]; output.headset_volume = bytes[4]; output.speaker_gain = bytes[5]; output.inactive_minutes = bytes[6];
    output.polling_mode = bytes[7]; output.audio_buffer_length = bytes[8]; output.controller_mode = bytes[9];
    output.disable_led = (flags & kFlagDisableLed) != 0; output.enable_usb_serial = (flags & kFlagEnableUsbSerial) != 0; output.ps_shortcut = (flags & kFlagPsShortcut) != 0;
    output.disable_mic = (flags & kFlagDisableMic) != 0; output.disable_speaker = (flags & kFlagDisableSpeaker) != 0; output.enable_wake = (flags & kFlagEnableWake) != 0; output.lock_volume = (flags & kFlagLockVolume) != 0;
    output.trigger_reduce = bytes[12]; output.status_gpio_pin = bytes[13]; output.status_gpio_mode = bytes[14];
    return validate_config(output);
}

} // namespace miralink
