#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace miralink {

constexpr std::uint8_t kConfigSchema = 1;
constexpr std::size_t kConfigEncodedBytes = 24;
constexpr std::uint16_t kFlagDisableLed = 1u << 0;
constexpr std::uint16_t kFlagEnableUsbSerial = 1u << 1;
constexpr std::uint16_t kFlagPsShortcut = 1u << 2;
constexpr std::uint16_t kFlagDisableMic = 1u << 3;
constexpr std::uint16_t kFlagDisableSpeaker = 1u << 4;
constexpr std::uint16_t kFlagEnableWake = 1u << 5;
constexpr std::uint16_t kFlagLockVolume = 1u << 6;

struct Config {
    std::uint8_t schema = kConfigSchema;
    float haptics_gain = 1.0f;
    std::uint8_t speaker_volume = 100;
    std::uint8_t headset_volume = 100;
    std::uint8_t speaker_gain = 0;
    std::uint8_t inactive_minutes = 0;
    std::uint8_t polling_mode = 1;
    std::uint8_t audio_buffer_length = 64;
    std::uint8_t controller_mode = 2;
    bool disable_led = false;
    bool enable_usb_serial = false;
    bool ps_shortcut = false;
    bool disable_mic = false;
    bool disable_speaker = false;
    bool enable_wake = false;
    std::uint8_t trigger_reduce = 0;
    bool lock_volume = false;
    std::uint8_t status_gpio_pin = 0xff;
    std::uint8_t status_gpio_mode = 0;
};

struct ValidationResult {
    bool ok = false;
    std::string message;
};

Config default_config();
ValidationResult validate_config(const Config& config);
std::array<std::uint8_t, kConfigEncodedBytes> encode_config(const Config& config);
ValidationResult decode_config(const std::vector<std::uint8_t>& bytes, Config& output);

} // namespace miralink
