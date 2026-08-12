#pragma once

#include "miralink_config.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace miralink {

constexpr std::size_t kConfigStorageSlotBytes = 64;
constexpr std::size_t kConfigStorageSlots = 2;
constexpr std::size_t kConfigStorageBytes = kConfigStorageSlotBytes * kConfigStorageSlots;

class FlashBackend {
public:
    virtual ~FlashBackend() = default;
    virtual bool read(std::vector<std::uint8_t>& bytes) const = 0;
    virtual bool write_slot(std::size_t slot, const std::vector<std::uint8_t>& record) = 0;
};

class ConfigStore {
public:
    explicit ConfigStore(FlashBackend& backend);

    bool load();
    const Config& active() const { return active_; }
    const Config& draft() const { return draft_; }
    bool has_draft() const { return draft_pending_; }
    ValidationResult stage(const Config& value);
    bool commit();
    void discard();
    void reset_to_defaults();

private:
    FlashBackend& backend_;
    Config active_ = default_config();
    Config draft_ = default_config();
    bool draft_pending_ = false;
    std::size_t active_slot_ = 0;
    std::uint32_t generation_ = 0;
};

} // namespace miralink
