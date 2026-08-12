#include "miralink_protocol.h"

namespace miralink {

namespace {
void write_u16(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint16_t value) {
    bytes[offset] = static_cast<std::uint8_t>(value & 0xff);
    bytes[offset + 1] = static_cast<std::uint8_t>((value >> 8) & 0xff);
}

void write_u32(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint32_t value) {
    for (std::size_t i = 0; i < 4; ++i) bytes[offset + i] = static_cast<std::uint8_t>((value >> (i * 8)) & 0xff);
}

std::uint16_t read_u16(const std::vector<std::uint8_t>& bytes, std::size_t offset) {
    return static_cast<std::uint16_t>(bytes[offset]) | static_cast<std::uint16_t>(bytes[offset + 1]) << 8;
}

std::uint32_t read_u32(const std::vector<std::uint8_t>& bytes, std::size_t offset) {
    std::uint32_t value = 0;
    for (std::size_t i = 0; i < 4; ++i) value |= static_cast<std::uint32_t>(bytes[offset + i]) << (i * 8);
    return value;
}
} // namespace

std::uint32_t crc32(const std::vector<std::uint8_t>& bytes) {
    std::uint32_t crc = 0xffffffffu;
    for (const auto byte : bytes) {
        crc ^= byte;
        for (int bit = 0; bit < 8; ++bit) crc = (crc >> 1) ^ ((crc & 1u) ? 0xedb88320u : 0u);
    }
    return crc ^ 0xffffffffu;
}

std::vector<std::uint8_t> encode_frame(const Frame& frame) {
    if (frame.payload.size() > kMaxPayload) return {};
    std::vector<std::uint8_t> bytes(kHidReportBytes, 0);
    bytes[0] = kMagic0; bytes[1] = kMagic1; bytes[2] = frame.version; bytes[3] = frame.flags;
    write_u16(bytes, 4, frame.sequence);
    bytes[6] = static_cast<std::uint8_t>(frame.command);
    write_u16(bytes, 7, static_cast<std::uint16_t>(frame.payload.size()));
    for (std::size_t i = 0; i < frame.payload.size(); ++i) bytes[9 + i] = frame.payload[i];
    write_u32(bytes, 9 + frame.payload.size(), crc32(std::vector<std::uint8_t>(bytes.begin(), bytes.begin() + 9 + frame.payload.size())));
    return bytes;
}

DecodeResult decode_frame(const std::vector<std::uint8_t>& bytes) {
    DecodeResult result;
    if (bytes.size() < kHidReportBytes) { result.error = DecodeError::TooShort; return result; }
    if (bytes.size() != kHidReportBytes) { result.error = DecodeError::BadLength; return result; }
    if (bytes[0] != kMagic0 || bytes[1] != kMagic1) { result.error = DecodeError::BadMagic; return result; }
    if (bytes[2] != kProtocolVersion) { result.error = DecodeError::BadVersion; return result; }
    const auto payload_length = read_u16(bytes, 7);
    if (payload_length > kMaxPayload) { result.error = DecodeError::PayloadTooLarge; return result; }
    const auto expected_crc = read_u32(bytes, 9 + payload_length);
    const auto actual_crc = crc32(std::vector<std::uint8_t>(bytes.begin(), bytes.begin() + 9 + payload_length));
    if (expected_crc != actual_crc) { result.error = DecodeError::BadCrc; return result; }
    for (std::size_t index = 13 + payload_length; index < kHidReportBytes; ++index) {
        if (bytes[index] != 0) { result.error = DecodeError::BadLength; return result; }
    }
    result.frame.version = bytes[2]; result.frame.flags = bytes[3]; result.frame.sequence = read_u16(bytes, 4);
    result.frame.command = static_cast<Command>(bytes[6]);
    result.frame.payload.assign(bytes.begin() + 9, bytes.begin() + 9 + payload_length);
    return result;
}

} // namespace miralink
