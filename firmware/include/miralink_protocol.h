#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace miralink {

constexpr std::uint8_t kProtocolVersion = 1;
constexpr std::uint8_t kMagic0 = 0x4d;
constexpr std::uint8_t kMagic1 = 0x4c;
constexpr std::size_t kHidReportBytes = 64;
constexpr std::size_t kFrameOverheadBytes = 13;
constexpr std::size_t kMaxPayload = kHidReportBytes - kFrameOverheadBytes - 3;
constexpr std::uint8_t kFeatureConfigPersistence = 1u << 0;
constexpr std::uint8_t kFeatureControllerInput = 1u << 1;
constexpr std::uint8_t kFeatureBluetoothPairing = 1u << 2;
constexpr std::uint8_t kFeatureUsbReconnect = 1u << 3;
constexpr std::uint8_t kFeatureRecovery = 1u << 4;
constexpr std::uint8_t kFeatureLocalLogs = 1u << 5;

enum class Command : std::uint8_t {
    Hello = 0x01,
    GetInfo = 0x02,
    GetConfig = 0x03,
    SetConfigDraft = 0x04,
    CommitConfig = 0x05,
    ResetConfig = 0x06,
    ReconnectUsb = 0x07,
    GetDiagnostics = 0x08,
    GetLogPage = 0x09,
    EnterRecovery = 0x0a,
    GetControllerState = 0x0b,
    OpenPairingWindow = 0x0c
};

struct Frame {
    std::uint8_t version = kProtocolVersion;
    std::uint8_t flags = 0;
    std::uint16_t sequence = 0;
    Command command = Command::Hello;
    std::vector<std::uint8_t> payload;
};

enum class DecodeError {
    None,
    TooShort,
    BadMagic,
    BadVersion,
    PayloadTooLarge,
    BadLength,
    BadCrc
};

struct DecodeResult {
    DecodeError error = DecodeError::None;
    Frame frame{};
    explicit operator bool() const { return error == DecodeError::None; }
};

std::uint32_t crc32(const std::vector<std::uint8_t>& bytes);
std::vector<std::uint8_t> encode_frame(const Frame& frame);
DecodeResult decode_frame(const std::vector<std::uint8_t>& bytes);

} // namespace miralink
