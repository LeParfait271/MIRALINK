#include "miralink_audio.h"
#include "miralink_usb_audio.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>

#include "tusb.h"

namespace {

constexpr std::int16_t kMinimumVolumeQ8_8 = static_cast<std::int16_t>(-90 * 256);
constexpr std::int16_t kMaximumVolumeQ8_8 = 0;

std::array<std::uint8_t, miralink::usb_audio::kPlaybackChannels + 1> g_playback_mute{};
std::array<std::int16_t, miralink::usb_audio::kPlaybackChannels + 1> g_playback_volume{};

bool valid_playback_channel(const std::uint8_t channel) {
    return channel < g_playback_mute.size();
}

void apply_playback_controls() {
    // A master control applies to the stereo speaker pair. Per-channel values
    // are retained for a standards-compliant UAC2 feature unit, while the
    // DSP remains deliberately simple and deterministic on the Pico.
    const bool muted = g_playback_mute[0] != 0 || g_playback_mute[1] != 0 || g_playback_mute[2] != 0;
    miralink::audio::set_usb_playback_mute(muted);
    miralink::audio::set_usb_playback_volume_q8_8(g_playback_volume[0]);
}

bool clock_get_request(const std::uint8_t rhport, const audio_control_request_t* request) {
    if (request == nullptr) return false;
    if (request->bControlSelector == AUDIO_CS_CTRL_SAM_FREQ) {
        if (request->bRequest == AUDIO_CS_REQ_CUR) {
            audio_control_cur_4_t current = {
                static_cast<std::int32_t>(tu_htole32(miralink::usb_audio::kSampleRate))
            };
            return tud_audio_buffer_and_schedule_control_xfer(rhport,
                reinterpret_cast<const tusb_control_request_t*>(request), &current, sizeof(current));
        }
        if (request->bRequest == AUDIO_CS_REQ_RANGE) {
            audio_control_range_4_n_t(1) range{};
            range.wNumSubRanges = tu_htole16(1);
            range.subrange[0].bMin = static_cast<std::int32_t>(tu_htole32(miralink::usb_audio::kSampleRate));
            range.subrange[0].bMax = static_cast<std::int32_t>(tu_htole32(miralink::usb_audio::kSampleRate));
            range.subrange[0].bRes = 0;
            return tud_audio_buffer_and_schedule_control_xfer(rhport,
                reinterpret_cast<const tusb_control_request_t*>(request), &range, sizeof(range));
        }
    }
    if (request->bControlSelector == AUDIO_CS_CTRL_CLK_VALID && request->bRequest == AUDIO_CS_REQ_CUR) {
        audio_control_cur_1_t valid = {1};
        return tud_audio_buffer_and_schedule_control_xfer(rhport,
            reinterpret_cast<const tusb_control_request_t*>(request), &valid, sizeof(valid));
    }
    return false;
}

bool playback_feature_get_request(const std::uint8_t rhport, const audio_control_request_t* request) {
    if (request == nullptr || !valid_playback_channel(request->bChannelNumber)) return false;
    const auto channel = request->bChannelNumber;
    if (request->bControlSelector == AUDIO_FU_CTRL_MUTE && request->bRequest == AUDIO_CS_REQ_CUR) {
        audio_control_cur_1_t current = {static_cast<std::int8_t>(g_playback_mute[channel])};
        return tud_audio_buffer_and_schedule_control_xfer(rhport,
            reinterpret_cast<const tusb_control_request_t*>(request), &current, sizeof(current));
    }
    if (request->bControlSelector == AUDIO_FU_CTRL_VOLUME) {
        if (request->bRequest == AUDIO_CS_REQ_CUR) {
            audio_control_cur_2_t current = {
                static_cast<std::int16_t>(tu_htole16(static_cast<std::uint16_t>(g_playback_volume[channel])))
            };
            return tud_audio_buffer_and_schedule_control_xfer(rhport,
                reinterpret_cast<const tusb_control_request_t*>(request), &current, sizeof(current));
        }
        if (request->bRequest == AUDIO_CS_REQ_RANGE) {
            audio_control_range_2_n_t(1) range{};
            range.wNumSubRanges = tu_htole16(1);
            range.subrange[0].bMin = static_cast<std::int16_t>(tu_htole16(static_cast<std::uint16_t>(kMinimumVolumeQ8_8)));
            range.subrange[0].bMax = static_cast<std::int16_t>(tu_htole16(static_cast<std::uint16_t>(kMaximumVolumeQ8_8)));
            range.subrange[0].bRes = static_cast<std::int16_t>(tu_htole16(256));
            return tud_audio_buffer_and_schedule_control_xfer(rhport,
                reinterpret_cast<const tusb_control_request_t*>(request), &range, sizeof(range));
        }
    }
    return false;
}

bool playback_feature_set_request(const audio_control_request_t* request, const std::uint8_t* buffer) {
    if (request == nullptr || buffer == nullptr || request->bRequest != AUDIO_CS_REQ_CUR
        || !valid_playback_channel(request->bChannelNumber)) return false;
    const auto channel = request->bChannelNumber;
    if (request->bControlSelector == AUDIO_FU_CTRL_MUTE) {
        if (request->wLength != sizeof(audio_control_cur_1_t)) return false;
        g_playback_mute[channel] = static_cast<const audio_control_cur_1_t*>(static_cast<const void*>(buffer))->bCur != 0 ? 1 : 0;
        apply_playback_controls();
        return true;
    }
    if (request->bControlSelector == AUDIO_FU_CTRL_VOLUME) {
        if (request->wLength != sizeof(audio_control_cur_2_t)) return false;
        // A saved MiraLink profile can lock the local volume. A host request
        // remains acknowledged so standard UAC2 enumeration is not disrupted,
        // but it cannot replace the user-confirmed Pico setting.
        if (miralink::audio::usb_volume_locked()) return true;
        const auto encoded = static_cast<const audio_control_cur_2_t*>(static_cast<const void*>(buffer))->bCur;
        const auto decoded = static_cast<std::int16_t>(tu_le16toh(static_cast<std::uint16_t>(encoded)));
        g_playback_volume[channel] = std::clamp(decoded, kMinimumVolumeQ8_8, kMaximumVolumeQ8_8);
        apply_playback_controls();
        return true;
    }
    return false;
}

std::uint8_t request_interface(const tusb_control_request_t* request) {
    return request == nullptr ? 0xffu : static_cast<std::uint8_t>(tu_le16toh(request->wIndex) & 0xffu);
}

std::uint8_t request_alternate_setting(const tusb_control_request_t* request) {
    return request == nullptr ? 0 : static_cast<std::uint8_t>(tu_le16toh(request->wValue) & 0xffu);
}

} // namespace

extern "C" bool tud_audio_get_req_entity_cb(const std::uint8_t rhport, const tusb_control_request_t* request) {
    const auto* audio_request = reinterpret_cast<const audio_control_request_t*>(request);
    if (audio_request == nullptr) return false;
    if (audio_request->bEntityID == miralink::usb_audio::kClockSourceEntity) {
        return clock_get_request(rhport, audio_request);
    }
    if (audio_request->bEntityID == miralink::usb_audio::kPlaybackFeatureUnit) {
        return playback_feature_get_request(rhport, audio_request);
    }
    return false;
}

extern "C" bool tud_audio_set_req_entity_cb(const std::uint8_t rhport, const tusb_control_request_t* request,
    std::uint8_t* buffer) {
    (void)rhport;
    const auto* audio_request = reinterpret_cast<const audio_control_request_t*>(request);
    if (audio_request == nullptr || audio_request->bEntityID != miralink::usb_audio::kPlaybackFeatureUnit) return false;
    return playback_feature_set_request(audio_request, buffer);
}

extern "C" bool tud_audio_set_itf_cb(const std::uint8_t rhport, const tusb_control_request_t* request) {
    (void)rhport;
    const auto interface_number = request_interface(request);
    const auto alternate_setting = request_alternate_setting(request);
    if (interface_number == miralink::usb_audio::kPlaybackInterface) {
        miralink::audio::set_usb_playback_endpoint_active(alternate_setting != 0);
    } else if (interface_number == miralink::usb_audio::kCaptureInterface) {
        miralink::audio::set_usb_capture_endpoint_active(alternate_setting != 0);
    }
    return true;
}

extern "C" bool tud_audio_set_itf_close_EP_cb(const std::uint8_t rhport, const tusb_control_request_t* request) {
    (void)rhport;
    const auto interface_number = request_interface(request);
    if (interface_number == miralink::usb_audio::kPlaybackInterface) {
        miralink::audio::set_usb_playback_endpoint_active(false);
    } else if (interface_number == miralink::usb_audio::kCaptureInterface) {
        miralink::audio::set_usb_capture_endpoint_active(false);
    }
    return true;
}

extern "C" bool tud_audio_rx_done_post_read_cb(const std::uint8_t rhport, const std::uint16_t received,
    const std::uint8_t function_id, const std::uint8_t endpoint, const std::uint8_t alternate_setting) {
    (void)rhport;
    (void)function_id;
    (void)endpoint;
    (void)alternate_setting;
    std::array<std::uint8_t, CFG_TUD_AUDIO_FUNC_1_EP_OUT_SZ_MAX> packet{};
    const auto requested = static_cast<std::uint16_t>(std::min<std::size_t>(received, packet.size()));
    const auto copied = tud_audio_read(packet.data(), requested);
    miralink::audio::push_usb_pcm(packet.data(), copied);
    return true;
}

extern "C" bool tud_audio_tx_done_pre_load_cb(const std::uint8_t rhport, const std::uint8_t function_id,
    const std::uint8_t endpoint, const std::uint8_t alternate_setting) {
    (void)rhport;
    (void)function_id;
    (void)endpoint;
    (void)alternate_setting;
    std::array<std::uint8_t, CFG_TUD_AUDIO_FUNC_1_EP_IN_SZ_MAX> packet{};
    const auto bytes = miralink::audio::pull_usb_capture_pcm(packet.data(), miralink::usb_audio::kCaptureNominalPacketBytes);
    if (bytes != 0) (void)tud_audio_write(packet.data(), static_cast<std::uint16_t>(bytes));
    return true;
}
