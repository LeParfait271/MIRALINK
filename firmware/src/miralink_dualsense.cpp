#include "miralink_dualsense.h"

#include <array>
#include <algorithm>

namespace miralink::dualsense {

namespace {
constexpr std::uint8_t kBluetoothHidInputHeader = 0xa1;
constexpr std::size_t kBluetoothCommonOffset = 2;
constexpr std::size_t kBluetoothCrcBytes = 4;
constexpr std::size_t kCommonInputBytes = 63;
constexpr std::size_t kStatusOffset = 52;
constexpr std::size_t kTouchOffset = 32;
constexpr std::size_t kBluetoothOutputCommonOffset = 3;
constexpr std::size_t kBluetoothOutputCrcOffset = kBluetoothOutputReportBytes - kBluetoothCrcBytes;

constexpr std::uint8_t kOutputCompatibleVibration = 1u << 0;
constexpr std::uint8_t kOutputHapticsSelect = 1u << 1;
constexpr std::uint8_t kOutputMicMuteControl = 1u << 0;
constexpr std::uint8_t kOutputPowerSaveControl = 1u << 1;
constexpr std::uint8_t kOutputLightbarControl = 1u << 2;
constexpr std::uint8_t kOutputPlayerLedControl = 1u << 4;
constexpr std::uint8_t kOutputMicMute = 1u << 4;

std::uint32_t crc32_update(std::uint32_t crc, const std::uint8_t* bytes, const std::size_t length) {
    for (std::size_t index = 0; index < length; ++index) {
        crc ^= bytes[index];
        for (std::size_t bit = 0; bit < 8; ++bit) {
            crc = (crc >> 1u) ^ ((crc & 1u) ? 0xedb88320u : 0u);
        }
    }
    return crc;
}

InputReportResult parse_common_input(const std::uint8_t* report, const std::size_t length, const std::size_t offset, const std::uint8_t report_id) {
    InputReportResult result{};
    if (report == nullptr || length < offset + kCommonInputBytes) {
        result.error = InputReportError::TooShort;
        return result;
    }

    result.state.report_id = report_id;
    result.state.left_x = report[offset + 0];
    result.state.left_y = report[offset + 1];
    result.state.right_x = report[offset + 2];
    result.state.right_y = report[offset + 3];
    result.state.left_trigger = report[offset + 4];
    result.state.right_trigger = report[offset + 5];
    result.state.input_sequence = report[offset + 6];
    result.state.dpad_face = report[offset + 7];
    result.state.shoulder = report[offset + 8];
    result.state.system = report[offset + 9];
    result.state.touchpad_pressed = (result.state.system & (1u << 1)) != 0;

    const auto read_i16 = [&](const std::size_t position) {
        return static_cast<std::int16_t>(static_cast<std::uint16_t>(report[offset + position])
            | (static_cast<std::uint16_t>(report[offset + position + 1]) << 8u));
    };
    result.state.gyro_x = read_i16(15);
    result.state.gyro_y = read_i16(17);
    result.state.gyro_z = read_i16(19);
    result.state.accel_x = read_i16(21);
    result.state.accel_y = read_i16(23);
    result.state.accel_z = read_i16(25);
    result.state.sensor_timestamp = static_cast<std::uint32_t>(report[offset + 27])
        | (static_cast<std::uint32_t>(report[offset + 28]) << 8u)
        | (static_cast<std::uint32_t>(report[offset + 29]) << 16u)
        | (static_cast<std::uint32_t>(report[offset + 30]) << 24u);

    for (std::size_t index = 0; index < result.state.touch.size(); ++index) {
        const auto touch_offset = offset + kTouchOffset + index * 4;
        const auto contact = report[touch_offset];
        auto& point = result.state.touch[index];
        point.active = (contact & 0x80u) == 0;
        point.x = static_cast<std::uint16_t>(report[touch_offset + 1]
            | ((report[touch_offset + 2] & 0x0fu) << 8u));
        point.y = static_cast<std::uint16_t>((report[touch_offset + 2] >> 4u)
            | (static_cast<std::uint16_t>(report[touch_offset + 3]) << 4u));
    }

    const auto status0 = report[offset + kStatusOffset];
    const auto status1 = report[offset + kStatusOffset + 1];
    const auto battery_data = static_cast<std::uint8_t>(status0 & 0x0fu);
    const auto charging_status = static_cast<std::uint8_t>(status0 >> 4u);
    if (charging_status == 0x0u || charging_status == 0x1u) {
        result.state.battery_percent = static_cast<std::uint8_t>(std::min<std::uint16_t>(battery_data * 10u + 5u, 100u));
        result.state.battery_state = charging_status == 0x1u ? BatteryState::Charging : BatteryState::Discharging;
        result.state.battery_valid = true;
    } else if (charging_status == 0x2u) {
        result.state.battery_percent = 100;
        result.state.battery_state = BatteryState::Full;
        result.state.battery_valid = true;
    } else if (charging_status == 0xau || charging_status == 0xbu) {
        result.state.battery_percent = 0;
        result.state.battery_state = BatteryState::Error;
        result.state.battery_valid = true;
    }
    result.state.headphone_connected = (status1 & (1u << 0)) != 0;
    result.state.microphone_connected = (status1 & (1u << 1)) != 0;
    result.state.microphone_muted = (status1 & (1u << 2)) != 0 || (result.state.system & (1u << 2)) != 0;
    return result;
}

std::uint32_t output_crc32(const std::uint8_t* report, const std::size_t length) {
    if (report == nullptr || length != kBluetoothOutputReportBytes) return 0;
    const std::array<std::uint8_t, 1> seed{0xa2};
    std::uint32_t crc = crc32_update(0xffffffffu, seed.data(), seed.size());
    crc = crc32_update(crc, report, length - kBluetoothCrcBytes);
    return ~crc;
}

void reduce_trigger_effect(std::uint8_t* effect, const std::uint8_t reduction) {
    if (effect == nullptr || effect[0] == 0 || reduction == 0) return;
    if (reduction >= 10) {
        std::fill(effect, effect + kUsbOutputTriggerEffectBytes, 0);
        return;
    }

    // The command byte selects a controller-side effect. It must remain
    // intact. Every following byte is a bounded parameter in MiraLink's fixed
    // output body, so attenuating it cannot increase an effect's strength.
    const auto numerator = static_cast<std::uint16_t>(10u - reduction);
    for (std::size_t index = 1; index < kUsbOutputTriggerEffectBytes; ++index) {
        effect[index] = static_cast<std::uint8_t>((static_cast<std::uint16_t>(effect[index]) * numerator + 5u) / 10u);
    }
}
} // namespace

bool is_dualsense_usb(const std::uint16_t vendor_id, const std::uint16_t product_id) {
    return vendor_id == kSonyVendorId
        && (product_id == kDualSenseProductId || product_id == kDualSenseEdgeProductId);
}

InputReportResult parse_usb_input_report(const std::vector<std::uint8_t>& report) {
    InputReportResult result{};
    if (report.empty()) {
        result.error = InputReportError::Empty;
        return result;
    }

    std::size_t offset = 0;
    if (report.size() == kUsbInputReportBytes && report.front() == kUsbInputReportId) {
        result.state.report_id = report.front();
        offset = 1;
    } else if (report.size() != kUsbInputReportBytes - 1) {
        result.error = InputReportError::UnsupportedReportId;
        return result;
    }

    return parse_common_input(report.data(), report.size(), offset, kUsbInputReportId);
}

std::uint32_t bluetooth_input_crc32(const std::uint8_t* report, const std::size_t length) {
    if (report == nullptr || length < kBluetoothInputReportBytes) return 0;
    const std::size_t prefix = report[0] == kBluetoothHidInputHeader ? 1 : 0;
    if (length != kBluetoothInputReportBytes + prefix || report[prefix] != kBluetoothInputReportId) return 0;
    const std::array<std::uint8_t, 1> seed{0xa1};
    std::uint32_t crc = crc32_update(0xffffffffu, seed.data(), seed.size());
    crc = crc32_update(crc, report + prefix, kBluetoothInputReportBytes - kBluetoothCrcBytes);
    return ~crc;
}

std::uint32_t bluetooth_input_crc32(const std::vector<std::uint8_t>& report) {
    return bluetooth_input_crc32(report.data(), report.size());
}

InputReportResult parse_bluetooth_input_report(const std::uint8_t* report, const std::size_t length) {
    InputReportResult result{};
    if (report == nullptr || length == 0) {
        result.error = InputReportError::Empty;
        return result;
    }

    const std::size_t prefix = report[0] == kBluetoothHidInputHeader ? 1 : 0;
    if (length != kBluetoothInputReportBytes + prefix || report[prefix] != kBluetoothInputReportId) {
        result.error = InputReportError::UnsupportedReportId;
        return result;
    }

    const std::size_t base = prefix;
    const std::uint32_t expected = static_cast<std::uint32_t>(report[base + 74])
        | (static_cast<std::uint32_t>(report[base + 75]) << 8u)
        | (static_cast<std::uint32_t>(report[base + 76]) << 16u)
        | (static_cast<std::uint32_t>(report[base + 77]) << 24u);
    if (bluetooth_input_crc32(report, length) != expected) {
        result.error = InputReportError::InvalidCrc;
        return result;
    }

    return parse_common_input(report, length, base + kBluetoothCommonOffset, kBluetoothInputReportId);
}

InputReportResult parse_bluetooth_input_report(const std::vector<std::uint8_t>& report) {
    return parse_bluetooth_input_report(report.data(), report.size());
}

InputReportResult parse_usb_input_report(const std::uint8_t* report, const std::size_t length) {
    if (report == nullptr) return InputReportResult{InputReportError::Empty, {}};
    InputReportResult result{};
    if (length == 0) {
        result.error = InputReportError::Empty;
        return result;
    }
    std::size_t offset = 0;
    if (length == kUsbInputReportBytes && report[0] == kUsbInputReportId) {
        offset = 1;
    } else if (length != kUsbInputReportBytes - 1) {
        result.error = InputReportError::UnsupportedReportId;
        return result;
    }
    return parse_common_input(report, length, offset, kUsbInputReportId);
}

std::array<std::uint8_t, kBluetoothOutputReportBytes> build_bluetooth_output_report(const OutputRequest& request, const std::uint8_t sequence) {
    std::array<std::uint8_t, kBluetoothOutputReportBytes> report{};
    report[0] = kBluetoothOutputReportId;
    report[1] = static_cast<std::uint8_t>((sequence & 0x0fu) << 4u);
    report[2] = 0x10;
    auto* common = report.data() + kBluetoothOutputCommonOffset;

    if (request.usb_output) {
        // The Bluetooth report keeps the same controller output body after
        // its three-byte Bluetooth header. Copy only the fixed USB body and
        // leave the Bluetooth sequence and CRC under MiraLink's control.
        std::copy(request.usb_output_payload.begin(), request.usb_output_payload.end(), common);
    }

    if (request.haptics) {
        common[0] |= static_cast<std::uint8_t>(kOutputCompatibleVibration | kOutputHapticsSelect);
        common[2] = request.right_motor;
        common[3] = request.left_motor;
    }
    if (request.lightbar) {
        common[1] |= kOutputLightbarControl;
        common[44] = request.lightbar_red;
        common[45] = request.lightbar_green;
        common[46] = request.lightbar_blue;
    }
    if (request.player_leds) {
        common[1] |= kOutputPlayerLedControl;
        common[43] = static_cast<std::uint8_t>(request.player_leds_mask & 0x1fu);
    }
    if (request.microphone_mute) {
        common[1] |= static_cast<std::uint8_t>(kOutputMicMuteControl | kOutputPowerSaveControl);
        common[8] = request.microphone_muted ? 1u : 0u;
        if (request.microphone_muted) common[9] |= kOutputMicMute;
    }
    const auto crc = output_crc32(report.data(), report.size());
    report[kBluetoothOutputCrcOffset] = static_cast<std::uint8_t>(crc & 0xffu);
    report[kBluetoothOutputCrcOffset + 1] = static_cast<std::uint8_t>((crc >> 8u) & 0xffu);
    report[kBluetoothOutputCrcOffset + 2] = static_cast<std::uint8_t>((crc >> 16u) & 0xffu);
    report[kBluetoothOutputCrcOffset + 3] = static_cast<std::uint8_t>((crc >> 24u) & 0xffu);
    return report;
}

std::uint32_t bluetooth_output_crc32(const std::uint8_t* report, const std::size_t length) {
    return output_crc32(report, length);
}

std::uint32_t bluetooth_output_crc32(const std::vector<std::uint8_t>& report) {
    return output_crc32(report.data(), report.size());
}

void apply_usb_output_trigger_reduction(std::array<std::uint8_t, kUsbOutputPayloadBytes>& payload,
    const std::uint8_t reduction) {
    const auto bounded = static_cast<std::uint8_t>(std::min<std::uint8_t>(reduction, 10));
    if (bounded == 0) return;
    reduce_trigger_effect(payload.data() + kUsbOutputRightTriggerOffset, bounded);
    reduce_trigger_effect(payload.data() + kUsbOutputLeftTriggerOffset, bounded);
}

AudioReportValidation validate_bluetooth_audio_report(const std::uint8_t* report, const std::size_t length) {
    AudioReportValidation result{};
    if (report == nullptr || length == 0) {
        result.error = AudioReportError::Empty;
        return result;
    }
    if (length != kBluetoothAudioReportBytes) {
        result.error = AudioReportError::BadLength;
        return result;
    }
    if (report[0] != kBluetoothAudioReportId) {
        result.error = AudioReportError::UnsupportedReportId;
        return result;
    }
    if (report[kBluetoothAudioHapticHeaderOffset] != 0x92
        || report[kBluetoothAudioHapticLengthOffset] != kBluetoothAudioHapticBytes
        || report[kBluetoothAudioOpusHeaderOffset] != 0x13
        || report[kBluetoothAudioOpusLengthOffset] == 0
        || report[kBluetoothAudioOpusLengthOffset] > kBluetoothAudioOpusBytes) {
        result.error = AudioReportError::InvalidLayout;
        return result;
    }
    return result;
}

AudioReportValidation validate_bluetooth_audio_report(const std::vector<std::uint8_t>& report) {
    return validate_bluetooth_audio_report(report.data(), report.size());
}

} // namespace miralink::dualsense
