#pragma once

#include <cstddef>
#include <cstdint>

namespace miralink { struct Config; }

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
    bool usb_playback_endpoint_active = false;
    bool usb_capture_endpoint_active = false;
    bool playback_muted = false;
    bool encoder_ready = false;
    std::uint32_t usb_packet_count = 0;
    std::uint32_t dropped_frame_count = 0;
    std::uint32_t buffered_frame_count = 0;
    std::uint32_t audio_report_count = 0;
    std::uint32_t usb_capture_packet_count = 0;
    std::uint32_t capture_underflow_frame_count = 0;
};

void init();
void poll();
void push_usb_pcm(const std::uint8_t* bytes, std::size_t length);
void set_usb_playback_endpoint_active(bool active);
void set_usb_capture_endpoint_active(bool active);
void set_usb_playback_mute(bool muted);
void set_usb_playback_volume_q8_8(std::int16_t volume);
void apply_config(const Config& config);
bool usb_volume_locked();
std::size_t pull_usb_capture_pcm(std::uint8_t* bytes, std::size_t capacity);
Snapshot snapshot();

} // namespace miralink::audio
