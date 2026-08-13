#pragma once

#include <cstddef>
#include <cstdint>

namespace miralink::audio {

constexpr std::uint32_t kSampleRate = 48000;
constexpr std::size_t kChannelCount = 4;
constexpr std::size_t kBytesPerSample = 2;
constexpr std::size_t kAudioBlockFrames = 512;
constexpr std::size_t kSpeakerFrames = 480;
constexpr std::size_t kHapticFrames = 32;
constexpr std::size_t kHapticBytes = kHapticFrames * 2;

struct Snapshot {
    bool usb_streaming = false;
    bool encoder_ready = false;
    std::uint32_t usb_packet_count = 0;
    std::uint32_t dropped_frame_count = 0;
    std::uint32_t buffered_frame_count = 0;
    std::uint32_t audio_report_count = 0;
};

void init();
void poll();
void push_usb_pcm(const std::uint8_t* bytes, std::size_t length);
Snapshot snapshot();

} // namespace miralink::audio
