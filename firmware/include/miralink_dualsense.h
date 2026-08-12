#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace miralink::dualsense {

constexpr std::uint16_t kSonyVendorId = 0x054c;
constexpr std::uint16_t kDualSenseProductId = 0x0ce6;
constexpr std::uint8_t kUsbInputReportId = 0x01;
constexpr std::size_t kUsbInputReportBytes = 64;
constexpr std::uint8_t kBluetoothInputReportId = 0x31;
constexpr std::size_t kBluetoothInputReportBytes = 78;

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

} // namespace miralink::dualsense
