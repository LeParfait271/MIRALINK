#include "miralink_dualsense.h"

#include <array>

namespace miralink::dualsense {

namespace {
constexpr std::uint8_t kBluetoothHidInputHeader = 0xa1;
constexpr std::size_t kBluetoothCommonOffset = 2;
constexpr std::size_t kBluetoothCrcBytes = 4;

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
    if (report == nullptr || length < offset + 9) {
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
    result.state.dpad_face = report[offset + 6];
    result.state.shoulder = report[offset + 7];
    result.state.system = report[offset + 8];
    return result;
}
} // namespace

bool is_dualsense_usb(const std::uint16_t vendor_id, const std::uint16_t product_id) {
    return vendor_id == kSonyVendorId && product_id == kDualSenseProductId;
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

} // namespace miralink::dualsense
