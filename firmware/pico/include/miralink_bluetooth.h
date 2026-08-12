#pragma once

#include "miralink_dualsense.h"

#include <cstdint>

namespace miralink::bluetooth {

enum class LinkState : std::uint8_t {
    Unavailable,
    Starting,
    PairingWindow,
    Connected,
    Disconnected
};

struct Snapshot {
    LinkState state = LinkState::Unavailable;
    bool bluetooth_available = false;
    bool pairing_window_open = false;
    bool inquiry_active = false;
    bool connection_pending = false;
    bool descriptor_available = false;
    bool input_available = false;
    dualsense::InputState input{};
    std::uint32_t sample_count = 0;
    std::uint32_t rejected_report_count = 0;
};

void init();
bool open_pairing_window();
void poll();
Snapshot snapshot();

} // namespace miralink::bluetooth
