#include "miralink_config.h"
#include "miralink_config_store.h"
#include "miralink_protocol.h"

#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

using namespace miralink;

class MemoryFlash final : public FlashBackend {
public:
    bool read(std::vector<std::uint8_t>& bytes) const override {
        bytes.clear(); bytes.insert(bytes.end(), slots[0].begin(), slots[0].end()); bytes.insert(bytes.end(), slots[1].begin(), slots[1].end()); return true;
    }
    bool write_slot(std::size_t slot, const std::vector<std::uint8_t>& record) override {
        if (slot >= slots.size() || record.size() != kConfigStorageSlotBytes) return false;
        slots[slot] = record; return true;
    }
    std::array<std::vector<std::uint8_t>, kConfigStorageSlots> slots;
};

void test_frame_round_trip() {
    Frame frame; frame.sequence = 12; frame.command = Command::Hello; frame.payload = {1, 2, 3};
    const auto encoded = encode_frame(frame); const auto decoded = decode_frame(encoded);
    assert(encoded.size() == kHidReportBytes); assert(decoded); assert(decoded.frame.sequence == 12); assert(decoded.frame.command == Command::Hello); assert(decoded.frame.payload == frame.payload);
}

void test_frame_rejects_non_zero_padding() {
    Frame frame; frame.command = Command::Hello; auto encoded = encode_frame(frame); encoded[kHidReportBytes - 1] = 1;
    assert(decode_frame(encoded).error == DecodeError::BadLength);
}

void test_frame_rejects_corruption() {
    Frame frame; frame.command = Command::GetInfo; auto encoded = encode_frame(frame); encoded[6] ^= 1;
    assert(decode_frame(encoded).error == DecodeError::BadCrc);
}

void test_config_round_trip() {
    auto config = default_config(); config.haptics_gain = 1.42f; config.enable_wake = true; config.lock_volume = true; config.status_gpio_pin = 8;
    const auto raw = encode_config(config); std::vector<std::uint8_t> encoded(raw.begin(), raw.end());
    Config decoded; const auto result = decode_config(encoded, decoded);
    assert(result.ok); assert(decoded.enable_wake); assert(decoded.lock_volume); assert(decoded.status_gpio_pin == 8); assert(decoded.haptics_gain == 1.42f);
}

void test_store_requires_validated_commit() {
    MemoryFlash flash; flash.slots[0] = std::vector<std::uint8_t>(kConfigStorageSlotBytes, 0xff); flash.slots[1] = flash.slots[0];
    ConfigStore store(flash); assert(!store.load());
    auto value = default_config(); value.audio_buffer_length = 2; assert(!store.stage(value).ok); assert(!store.has_draft());
    store.reset_to_defaults(); assert(store.has_draft()); assert(store.commit()); assert(!store.has_draft());
    ConfigStore restored(flash); assert(restored.load()); assert(restored.active().audio_buffer_length == 64);
}

int main() {
    test_frame_round_trip(); test_frame_rejects_corruption(); test_frame_rejects_non_zero_padding(); test_config_round_trip(); test_store_requires_validated_commit();
    std::cout << "MiraLink core tests passed\n";
}
