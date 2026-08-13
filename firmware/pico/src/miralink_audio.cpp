#include "miralink_audio.h"

#include "miralink_bluetooth.h"

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstring>

#include <opus.h>

#include "pico/stdlib.h"

namespace miralink::audio {
namespace {

constexpr std::size_t kRingFrames = 2048;
constexpr std::uint64_t kStreamingTimeoutUs = 150000;
constexpr std::size_t kOpusBytes = 200;

std::array<std::int16_t, kRingFrames * kChannelCount> g_pcm_ring{};
std::size_t g_read_frame = 0;
std::size_t g_write_frame = 0;
std::size_t g_buffered_frames = 0;
std::uint32_t g_usb_packet_count = 0;
std::uint32_t g_dropped_frame_count = 0;
std::uint32_t g_audio_report_count = 0;
std::uint64_t g_last_packet_us = 0;
bool g_usb_streaming = false;
OpusEncoder* g_opus_encoder = nullptr;
std::uint8_t g_report_sequence = 0;
std::uint8_t g_audio_packet_sequence = 0;

std::size_t next_frame(const std::size_t frame) {
    return (frame + 1) % kRingFrames;
}

void push_frame(const std::int16_t* frame) {
    if (g_buffered_frames == kRingFrames) {
        g_read_frame = next_frame(g_read_frame);
        --g_buffered_frames;
        ++g_dropped_frame_count;
    }
    std::memcpy(g_pcm_ring.data() + g_write_frame * kChannelCount, frame,
        kChannelCount * sizeof(std::int16_t));
    g_write_frame = next_frame(g_write_frame);
    ++g_buffered_frames;
}

void read_quad_block(std::int16_t* destination) {
    for (std::size_t frame = 0; frame < kAudioBlockFrames; ++frame) {
        auto* output = destination + frame * kChannelCount;
        if (g_buffered_frames == 0) {
            std::fill(output, output + kChannelCount, 0);
            continue;
        }
        const auto* source = g_pcm_ring.data() + g_read_frame * kChannelCount;
        std::memcpy(output, source, kChannelCount * sizeof(std::int16_t));
        g_read_frame = next_frame(g_read_frame);
        --g_buffered_frames;
    }
}

std::int16_t interpolate(const std::int16_t first, const std::int16_t second, const std::uint32_t remainder) {
    const auto value = static_cast<std::int64_t>(first) * (479u - remainder)
        + static_cast<std::int64_t>(second) * remainder;
    return static_cast<std::int16_t>(value / 479u);
}

std::int8_t haptic_sample(const std::int16_t* block, const std::size_t first_frame, const std::size_t channel) {
    std::int64_t sum = 0;
    for (std::size_t offset = 0; offset < 16; ++offset) {
        sum += block[(first_frame + offset) * kChannelCount + channel];
    }
    const auto scaled = std::clamp<std::int64_t>(sum / 4096, -128, 127);
    return static_cast<std::int8_t>(scaled);
}

bool build_audio_report(const std::int16_t* block, std::array<std::uint8_t, dualsense::kBluetoothAudioReportBytes>& report) {
    if (g_opus_encoder == nullptr) return false;

    std::array<std::int16_t, kSpeakerFrames * 2> speaker_pcm{};
    for (std::size_t frame = 0; frame < kSpeakerFrames; ++frame) {
        const auto source_position = static_cast<std::uint32_t>(frame * 511u);
        const auto first_frame = source_position / 479u;
        const auto remainder = source_position % 479u;
        const auto second_frame = first_frame + 1u < kAudioBlockFrames
            ? first_frame + 1u
            : kAudioBlockFrames - 1u;
        speaker_pcm[frame * 2] = interpolate(
            block[first_frame * kChannelCount], block[second_frame * kChannelCount], remainder);
        speaker_pcm[frame * 2 + 1] = interpolate(
            block[first_frame * kChannelCount + 1], block[second_frame * kChannelCount + 1], remainder);
    }

    std::array<std::uint8_t, kOpusBytes> opus_packet{};
    const auto encoded = opus_encode(g_opus_encoder, speaker_pcm.data(),
        static_cast<int>(kSpeakerFrames), opus_packet.data(), static_cast<opus_int32>(opus_packet.size()));
    if (encoded < 0 || encoded > static_cast<int>(opus_packet.size())) return false;

    std::array<std::uint8_t, kHapticBytes> haptic{};
    for (std::size_t frame = 0; frame < kHapticFrames; ++frame) {
        haptic[frame * 2] = static_cast<std::uint8_t>(haptic_sample(block, frame * 16, 2));
        haptic[frame * 2 + 1] = static_cast<std::uint8_t>(haptic_sample(block, frame * 16, 3));
    }

    report.fill(0);
    report[0] = dualsense::kBluetoothAudioReportId;
    report[1] = static_cast<std::uint8_t>((g_report_sequence++ & 0x0fu) << 4u);
    report[10] = g_audio_packet_sequence++;
    report[11] = 0x90;
    report[12] = 63;
    report[76] = 0x92;
    report[77] = static_cast<std::uint8_t>(kHapticBytes);
    std::copy(haptic.begin(), haptic.end(), report.begin() + 78);
    report[142] = 0x13;
    report[143] = static_cast<std::uint8_t>(kOpusBytes);
    std::copy(opus_packet.begin(), opus_packet.end(), report.begin() + 144);
    return true;
}

void process_audio_block() {
    if (g_opus_encoder == nullptr || g_buffered_frames < kAudioBlockFrames) return;

    std::array<std::int16_t, kAudioBlockFrames * kChannelCount> block{};
    read_quad_block(block.data());
    std::array<std::uint8_t, dualsense::kBluetoothAudioReportBytes> report{};
    if (!build_audio_report(block.data(), report)) return;
    if (miralink::bluetooth::send_audio_haptics_report(report.data(), report.size())) {
        ++g_audio_report_count;
    }
}

} // namespace

void init() {
    g_pcm_ring.fill(0);
    g_read_frame = 0;
    g_write_frame = 0;
    g_buffered_frames = 0;
    g_usb_packet_count = 0;
    g_dropped_frame_count = 0;
    g_audio_report_count = 0;
    g_last_packet_us = 0;
    g_usb_streaming = false;
    g_report_sequence = 0;
    g_audio_packet_sequence = 0;
    int error = OPUS_OK;
    g_opus_encoder = opus_encoder_create(static_cast<opus_int32>(kSampleRate), 2,
        OPUS_APPLICATION_AUDIO, &error);
    if (g_opus_encoder == nullptr || error != OPUS_OK) {
        g_opus_encoder = nullptr;
        return;
    }
    (void)opus_encoder_ctl(g_opus_encoder, OPUS_SET_BITRATE(160000));
    (void)opus_encoder_ctl(g_opus_encoder, OPUS_SET_VBR(0));
    (void)opus_encoder_ctl(g_opus_encoder, OPUS_SET_COMPLEXITY(5));
    (void)opus_encoder_ctl(g_opus_encoder, OPUS_SET_SIGNAL(OPUS_SIGNAL_MUSIC));
    (void)opus_encoder_ctl(g_opus_encoder, OPUS_SET_LSB_DEPTH(16));
}

void poll() {
    if (g_usb_streaming && time_us_64() - g_last_packet_us > kStreamingTimeoutUs) {
        g_usb_streaming = false;
    }
    if (!g_usb_streaming) return;
    process_audio_block();
}

void push_usb_pcm(const std::uint8_t* bytes, const std::size_t length) {
    if (bytes == nullptr || length < kChannelCount * kBytesPerSample) return;
    const auto frame_bytes = kChannelCount * kBytesPerSample;
    const auto frames = length / frame_bytes;
    std::array<std::int16_t, kChannelCount> frame{};
    for (std::size_t index = 0; index < frames; ++index) {
        for (std::size_t channel = 0; channel < kChannelCount; ++channel) {
            const auto offset = index * frame_bytes + channel * kBytesPerSample;
            frame[channel] = static_cast<std::int16_t>(
                static_cast<std::uint16_t>(bytes[offset])
                | (static_cast<std::uint16_t>(bytes[offset + 1]) << 8u));
        }
        push_frame(frame.data());
    }
    ++g_usb_packet_count;
    g_last_packet_us = time_us_64();
    g_usb_streaming = true;
}

Snapshot snapshot() {
    return Snapshot{
        g_usb_streaming,
        g_opus_encoder != nullptr,
        g_usb_packet_count,
        g_dropped_frame_count,
        static_cast<std::uint32_t>(g_buffered_frames),
        g_audio_report_count
    };
}

} // namespace miralink::audio
