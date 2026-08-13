#pragma once

#include <cstddef>
#include <cstdint>
#include <array>
#include <vector>

namespace miralink::dualsense {

constexpr std::uint16_t kSonyVendorId = 0x054c;
constexpr std::uint16_t kDualSenseProductId = 0x0ce6;
constexpr std::uint16_t kDualSenseEdgeProductId = 0x0df2;
constexpr std::uint8_t kUsbInputReportId = 0x01;
constexpr std::size_t kUsbInputReportBytes = 64;
constexpr std::uint8_t kUsbOutputReportId = 0x02;
constexpr std::size_t kUsbOutputReportBytes = 48;
constexpr std::size_t kUsbOutputPayloadBytes = kUsbOutputReportBytes - 1;
constexpr std::uint8_t kBluetoothInputReportId = 0x31;
constexpr std::size_t kBluetoothInputReportBytes = 78;
constexpr std::uint8_t kBluetoothOutputReportId = 0x31;
constexpr std::size_t kBluetoothOutputReportBytes = 78;
constexpr std::uint8_t kBluetoothAudioReportId = 0x36;
constexpr std::size_t kBluetoothAudioReportBytes = 398;
constexpr std::size_t kBluetoothAudioHapticHeaderOffset = 76;
constexpr std::size_t kBluetoothAudioHapticLengthOffset = 77;
constexpr std::size_t kBluetoothAudioHapticDataOffset = 78;
constexpr std::size_t kBluetoothAudioHapticBytes = 64;
constexpr std::size_t kBluetoothAudioOpusHeaderOffset = 142;
constexpr std::size_t kBluetoothAudioOpusLengthOffset = 143;
constexpr std::size_t kBluetoothAudioOpusDataOffset = 144;
constexpr std::size_t kBluetoothAudioOpusBytes = 200;

enum class BatteryState : std::uint8_t {
    Unknown = 0,
    Discharging = 1,
    Charging = 2,
    Full = 3,
    Error = 4
};

struct TouchPoint {
    bool active = false;
    std::uint16_t x = 0;
    std::uint16_t y = 0;
};

enum class InputReportError {
    None,
    Empty,
    UnsupportedReportId,
    TooShort,
    InvalidCrc
};

struct InputState {
    std::uint8_t report_id = kUsbInputReportId;
    std::uint8_t left_x = 0x80;
    std::uint8_t left_y = 0x80;
    std::uint8_t right_x = 0x80;
    std::uint8_t right_y = 0x80;
    std::uint8_t left_trigger = 0;
    std::uint8_t right_trigger = 0;
    std::uint8_t dpad_face = 0;
    std::uint8_t shoulder = 0;
    std::uint8_t system = 0;
    std::uint8_t input_sequence = 0;
    std::int16_t gyro_x = 0;
    std::int16_t gyro_y = 0;
    std::int16_t gyro_z = 0;
    std::int16_t accel_x = 0;
    std::int16_t accel_y = 0;
    std::int16_t accel_z = 0;
    std::uint32_t sensor_timestamp = 0;
    std::array<TouchPoint, 2> touch{};
    std::uint8_t battery_percent = 0xff;
    BatteryState battery_state = BatteryState::Unknown;
    bool battery_valid = false;
    bool headphone_connected = false;
    bool microphone_connected = false;
    bool microphone_muted = false;
    bool touchpad_pressed = false;
};

struct InputReportResult {
    InputReportError error = InputReportError::None;
    InputState state{};

    explicit operator bool() const { return error == InputReportError::None; }
};

bool is_dualsense_usb(std::uint16_t vendor_id, std::uint16_t product_id);
InputReportResult parse_usb_input_report(const std::uint8_t* report, std::size_t length);
InputReportResult parse_usb_input_report(const std::vector<std::uint8_t>& report);
InputReportResult parse_bluetooth_input_report(const std::uint8_t* report, std::size_t length);
InputReportResult parse_bluetooth_input_report(const std::vector<std::uint8_t>& report);
std::uint32_t bluetooth_input_crc32(const std::uint8_t* report, std::size_t length);
std::uint32_t bluetooth_input_crc32(const std::vector<std::uint8_t>& report);

struct OutputRequest {
    bool haptics = false;
    std::uint8_t left_motor = 0;
    std::uint8_t right_motor = 0;
    bool lightbar = false;
    std::uint8_t lightbar_red = 0;
    std::uint8_t lightbar_green = 0;
    std::uint8_t lightbar_blue = 0;
    bool player_leds = false;
    std::uint8_t player_leds_mask = 0;
    bool microphone_mute = false;
    bool microphone_muted = false;
    // A controller output received from a host game is normalized to the
    // bounded USB DualSense body before it is wrapped in the Bluetooth
    // transport header. MiraLink commands use the same fixed-size typed
    // payload; no arbitrary HID buffer is accepted.
    bool usb_output = false;
    std::array<std::uint8_t, kUsbOutputPayloadBytes> usb_output_payload{};
};

std::array<std::uint8_t, kBluetoothOutputReportBytes> build_bluetooth_output_report(const OutputRequest& request, std::uint8_t sequence);
std::uint32_t bluetooth_output_crc32(const std::uint8_t* report, std::size_t length);
std::uint32_t bluetooth_output_crc32(const std::vector<std::uint8_t>& report);

enum class AudioReportError : std::uint8_t {
    None,
    Empty,
    BadLength,
    UnsupportedReportId,
    InvalidLayout
};

struct AudioReportValidation {
    AudioReportError error = AudioReportError::None;

    explicit operator bool() const { return error == AudioReportError::None; }
};

AudioReportValidation validate_bluetooth_audio_report(const std::uint8_t* report, std::size_t length);
AudioReportValidation validate_bluetooth_audio_report(const std::vector<std::uint8_t>& report);

} // namespace miralink::dualsense
