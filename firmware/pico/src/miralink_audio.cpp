#include "miralink_audio.h"

#include "miralink_bluetooth.h"
#include "miralink_config.h"

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
constexpr std::size_t kOpusBytes = dualsense::kBluetoothAudioOpusBytes;

std::array<std::int16_t, kRingFrames * kChannelCount> g_pcm_ring{};
std::size_t g_read_frame = 0;
std::size_t g_write_frame = 0;
std::size_t g_buffered_frames = 0;
std::array<std::int16_t, kRingFrames> g_capture_ring{};
std::size_t g_capture_read_frame = 0;
std::size_t g_capture_write_frame = 0;
std::size_t g_capture_buffered_frames = 0;
std::uint32_t g_usb_packet_count = 0;
std::uint32_t g_dropped_frame_count = 0;
std::uint32_t g_audio_report_count = 0;
std::uint32_t g_usb_capture_packet_count = 0;
std::uint32_t g_capture_underflow_frame_count = 0;
std::uint64_t g_last_packet_us = 0;
bool g_usb_streaming = false;
bool g_usb_playback_endpoint_active = false;
bool g_usb_capture_endpoint_active = false;
bool g_host_playback_muted = false;
bool g_config_speaker_disabled = false;
bool g_config_microphone_disabled = false;
bool g_volume_locked = false;
std::uint16_t g_host_playback_gain_q15 = 32767;
std::uint16_t g_config_playback_gain_q15 = 32767;
std::uint16_t g_haptics_gain_q8_8 = 256;
std::size_t g_prebuffer_frames = kAudioBlockFrames;
OpusEncoder* g_opus_encoder = nullptr;
std::uint8_t g_report_sequence = 0;
std::uint8_t g_audio_packet_sequence = 0;
std::array<std::int16_t, kAudioBlockFrames * kChannelCount> g_pending_block{};
std::array<std::uint8_t, dualsense::kBluetoothAudioReportBytes> g_pending_report{};
bool g_pending_report_ready = false;

std::size_t next_frame(const std::size_t frame) {
    return (frame + 1) % kRingFrames;
}

std::int16_t scale_playback_sample(const std::int16_t sample) {
    if (g_host_playback_muted || g_config_speaker_disabled) return 0;
    const auto scaled = static_cast<std::int64_t>(sample) * g_host_playback_gain_q15 * g_config_playback_gain_q15;
    return static_cast<std::int16_t>(scaled / (32767ll * 32767ll));
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

void push_capture_frame(const std::int16_t sample) {
    if (g_capture_buffered_frames == kRingFrames) {
        g_capture_read_frame = next_frame(g_capture_read_frame);
        --g_capture_buffered_frames;
    }
    g_capture_ring[g_capture_write_frame] = sample;
    g_capture_write_frame = next_frame(g_capture_write_frame);
    ++g_capture_buffered_frames;
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
    const auto amplified = (sum * g_haptics_gain_q8_8) / 256;
    const auto scaled = std::clamp<std::int64_t>(amplified / 4096, -128, 127);
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
    report[dualsense::kBluetoothAudioHapticHeaderOffset] = 0x92;
    report[dualsense::kBluetoothAudioHapticLengthOffset] = static_cast<std::uint8_t>(kHapticBytes);
    std::copy(haptic.begin(), haptic.end(), report.begin() + dualsense::kBluetoothAudioHapticDataOffset);
    report[dualsense::kBluetoothAudioOpusHeaderOffset] = 0x13;
    report[dualsense::kBluetoothAudioOpusLengthOffset] = static_cast<std::uint8_t>(encoded);
    std::copy(opus_packet.begin(), opus_packet.begin() + encoded,
        report.begin() + dualsense::kBluetoothAudioOpusDataOffset);
    return static_cast<bool>(dualsense::validate_bluetooth_audio_report(report.data(), report.size()));
}

void process_audio_block() {
    if (g_opus_encoder == nullptr) return;

    const auto link = miralink::bluetooth::snapshot();
    if (g_pending_report_ready && !link.audio_link_available) {
        g_pending_report_ready = false;
        g_dropped_frame_count += static_cast<std::uint32_t>(kAudioBlockFrames);
    }
    if (!g_pending_report_ready) {
        if (g_buffered_frames < g_prebuffer_frames || !link.audio_link_available) return;
        read_quad_block(g_pending_block.data());
        if (!build_audio_report(g_pending_block.data(), g_pending_report)) {
            g_dropped_frame_count += static_cast<std::uint32_t>(kAudioBlockFrames);
            return;
        }
        g_pending_report_ready = true;
    }
    if (miralink::bluetooth::send_audio_haptics_report(g_pending_report.data(), g_pending_report.size())) {
        g_pending_report_ready = false;
        ++g_audio_report_count;
    }
}

} // namespace

void init() {
    g_pcm_ring.fill(0);
    g_read_frame = 0;
    g_write_frame = 0;
    g_buffered_frames = 0;
    g_capture_ring.fill(0);
    g_capture_read_frame = 0;
    g_capture_write_frame = 0;
    g_capture_buffered_frames = 0;
    g_usb_packet_count = 0;
    g_dropped_frame_count = 0;
    g_audio_report_count = 0;
    g_usb_capture_packet_count = 0;
    g_capture_underflow_frame_count = 0;
    g_last_packet_us = 0;
    g_usb_streaming = false;
    g_usb_playback_endpoint_active = false;
    g_usb_capture_endpoint_active = false;
    g_host_playback_muted = false;
    g_config_speaker_disabled = false;
    g_config_microphone_disabled = false;
    g_volume_locked = false;
    g_host_playback_gain_q15 = 32767;
    g_config_playback_gain_q15 = 32767;
    g_haptics_gain_q8_8 = 256;
    g_prebuffer_frames = kAudioBlockFrames;
    g_report_sequence = 0;
    g_audio_packet_sequence = 0;
    g_pending_block.fill(0);
    g_pending_report.fill(0);
    g_pending_report_ready = false;
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
        // UAC2 feature-unit controls apply only to the speaker pair. Haptic
        // channels stay independent so a host volume change cannot amplify a
        // motor waveform unexpectedly.
        frame[0] = scale_playback_sample(frame[0]);
        frame[1] = scale_playback_sample(frame[1]);
        push_frame(frame.data());
        const auto monitor = (static_cast<std::int32_t>(frame[0]) + static_cast<std::int32_t>(frame[1])) / 2;
        push_capture_frame(static_cast<std::int16_t>(monitor));
    }
    ++g_usb_packet_count;
    g_last_packet_us = time_us_64();
    g_usb_streaming = true;
}

void set_usb_playback_endpoint_active(const bool active) {
    g_usb_playback_endpoint_active = active;
    if (!active) {
        g_usb_streaming = false;
        g_buffered_frames = 0;
        g_read_frame = g_write_frame;
    }
}

void set_usb_capture_endpoint_active(const bool active) {
    g_usb_capture_endpoint_active = active;
    if (!active) {
        g_capture_buffered_frames = 0;
        g_capture_read_frame = g_capture_write_frame;
    }
}

void set_usb_playback_mute(const bool muted) {
    g_host_playback_muted = muted;
}

void set_usb_playback_volume_q8_8(const std::int16_t volume) {
    // UAC2 volume is expressed in signed 8.8 dB units. A linear attenuation
    // keeps this fixed-point audio path deterministic on the Pico while the
    // host still owns its global mixer policy.
    constexpr std::int32_t kMinimumVolumeQ8_8 = -90 * 256;
    const auto clamped = std::clamp<std::int32_t>(volume, kMinimumVolumeQ8_8, 0);
    g_host_playback_gain_q15 = static_cast<std::uint16_t>(
        ((clamped - kMinimumVolumeQ8_8) * 32767) / -kMinimumVolumeQ8_8);
}

void apply_config(const Config& config) {
    g_config_speaker_disabled = config.disable_speaker;
    g_config_microphone_disabled = config.disable_mic;
    g_volume_locked = config.lock_volume;
    g_config_playback_gain_q15 = static_cast<std::uint16_t>(
        (static_cast<std::uint32_t>(config.speaker_volume) * 32767u) / 127u);
    g_haptics_gain_q8_8 = static_cast<std::uint16_t>(std::clamp<std::int32_t>(
        static_cast<std::int32_t>(config.haptics_gain * 256.0f), 256, 512));
    constexpr std::size_t kMinimumBufferLength = 16;
    constexpr std::size_t kMaximumBufferLength = 127;
    const auto bounded_buffer = std::clamp<std::size_t>(config.audio_buffer_length,
        kMinimumBufferLength, kMaximumBufferLength);
    g_prebuffer_frames = kAudioBlockFrames + ((bounded_buffer - kMinimumBufferLength)
        * (kRingFrames - kAudioBlockFrames)) / (kMaximumBufferLength - kMinimumBufferLength);
}

bool usb_volume_locked() {
    return g_volume_locked;
}

std::size_t pull_usb_capture_pcm(std::uint8_t* bytes, const std::size_t capacity) {
    if (bytes == nullptr || capacity < kBytesPerSample || !g_usb_capture_endpoint_active) return 0;
    const auto samples = capacity / kBytesPerSample;
    for (std::size_t index = 0; index < samples; ++index) {
        std::int16_t sample = 0;
        if (g_capture_buffered_frames == 0 || g_config_microphone_disabled) {
            ++g_capture_underflow_frame_count;
        } else {
            sample = g_capture_ring[g_capture_read_frame];
            g_capture_read_frame = next_frame(g_capture_read_frame);
            --g_capture_buffered_frames;
        }
        const auto encoded = static_cast<std::uint16_t>(sample);
        bytes[index * kBytesPerSample] = static_cast<std::uint8_t>(encoded & 0xffu);
        bytes[index * kBytesPerSample + 1] = static_cast<std::uint8_t>((encoded >> 8u) & 0xffu);
    }
    ++g_usb_capture_packet_count;
    return samples * kBytesPerSample;
}

Snapshot snapshot() {
    return Snapshot{
        g_usb_streaming,
        g_usb_playback_endpoint_active,
        g_usb_capture_endpoint_active,
        g_host_playback_muted || g_config_speaker_disabled,
        g_opus_encoder != nullptr,
        g_usb_packet_count,
        g_dropped_frame_count,
        static_cast<std::uint32_t>(g_buffered_frames),
        g_audio_report_count,
        g_usb_capture_packet_count,
        g_capture_underflow_frame_count
    };
}

} // namespace miralink::audio
