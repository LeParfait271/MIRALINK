#pragma once

#include <cstddef>
#include <cstdint>

// Shared, MiraLink-owned identifiers for the standard USB Audio Class 2
// function. These values are local to the MiraLink descriptor; they are not
// derived from a controller protocol or from the reference firmware.
namespace miralink::usb_audio {

constexpr std::uint8_t kControlInterface = 0;
constexpr std::uint8_t kPlaybackInterface = 1;
constexpr std::uint8_t kCaptureInterface = 2;
constexpr std::uint8_t kHidInterface = 3;

constexpr std::uint8_t kPlaybackEndpointOut = 0x02;
constexpr std::uint8_t kCaptureEndpointIn = 0x83;
constexpr std::uint8_t kHidEndpointIn = 0x81;

constexpr std::uint8_t kClockSourceEntity = 0x04;
constexpr std::uint8_t kPlaybackInputTerminal = 0x01;
constexpr std::uint8_t kPlaybackFeatureUnit = 0x02;
constexpr std::uint8_t kPlaybackOutputTerminal = 0x03;
constexpr std::uint8_t kCaptureInputTerminal = 0x11;
constexpr std::uint8_t kCaptureOutputTerminal = 0x13;

constexpr std::uint32_t kSampleRate = 48000;
constexpr std::uint8_t kPlaybackChannels = 4;
constexpr std::uint8_t kCaptureChannels = 1;
constexpr std::uint8_t kBytesPerSample = 2;
constexpr std::size_t kPlaybackNominalPacketBytes = (kSampleRate / 1000) * kPlaybackChannels * kBytesPerSample;
constexpr std::size_t kCaptureNominalPacketBytes = (kSampleRate / 1000) * kCaptureChannels * kBytesPerSample;

} // namespace miralink::usb_audio
