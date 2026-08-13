#pragma once

#include "miralink_dualsense.h"

#include <cstddef>
#include <cstdint>

namespace miralink { struct Config; }

namespace miralink::bluetooth {

enum class LinkState : std::uint8_t {
    Unavailable,
    Starting,
    PairingWindow,
    Connected,
    Disconnected
};

enum class ConnectionError : std::uint8_t {
    None,
    Inquiry,
    HidConnect,
    HidAccept,
    ConnectionOpen,
    ProtocolHandshake,
    Descriptor,
    Timeout,
    Closed
};

struct Snapshot {
    LinkState state = LinkState::Unavailable;
    bool bluetooth_available = false;
    bool pairing_window_open = false;
    bool inquiry_active = false;
    bool connection_pending = false;
    bool descriptor_available = false;
    bool input_available = false;
    bool paired_controller_known = false;
    bool audio_link_available = false;
    bool audio_streaming = false;
    std::uint32_t audio_packet_count = 0;
    dualsense::InputState input{};
    std::uint32_t sample_count = 0;
    std::uint32_t rejected_report_count = 0;
    ConnectionError last_connection_error = ConnectionError::None;
    std::uint8_t last_connection_status = 0;
    std::uint32_t connection_attempt_count = 0;
    std::uint32_t connection_failure_count = 0;
    std::uint32_t reconnect_attempt_count = 0;
};

void init();
void apply_config(const Config& config);
bool open_pairing_window();
bool send_haptic(std::uint8_t left_motor, std::uint8_t right_motor, std::uint16_t duration_ms);
bool set_lightbar(std::uint8_t red, std::uint8_t green, std::uint8_t blue, std::uint8_t player_leds_mask);
bool set_microphone_mute(bool muted);
bool send_controller_output(const std::uint8_t* payload, std::size_t length);
bool send_audio_haptics_report(const std::uint8_t* report, std::size_t length);
void poll();
Snapshot snapshot();

} // namespace miralink::bluetooth
