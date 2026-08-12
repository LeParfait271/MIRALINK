#include "miralink_config_store.h"

#include "miralink_protocol.h"

#include <array>
#include <cstdint>

namespace miralink {

namespace {
constexpr std::array<std::uint8_t, 4> kRecordMagic = {'M', 'L', 'C', 'F'};
constexpr std::size_t kRecordCrcOffset = 4 + 4 + kConfigEncodedBytes;

void write_u32(std::array<std::uint8_t, kConfigStorageSlotBytes>& bytes, std::size_t offset, std::uint32_t value) {
    for (std::size_t index = 0; index < 4; ++index) bytes[offset + index] = static_cast<std::uint8_t>((value >> (index * 8)) & 0xffu);
}

std::uint32_t read_u32(const std::vector<std::uint8_t>& bytes, std::size_t offset) {
    std::uint32_t value = 0;
    for (std::size_t index = 0; index < 4; ++index) value |= static_cast<std::uint32_t>(bytes[offset + index]) << (index * 8);
    return value;
}

std::array<std::uint8_t, kConfigStorageSlotBytes> encode_record(std::uint32_t generation, const Config& config) {
    std::array<std::uint8_t, kConfigStorageSlotBytes> record{};
    record[0] = kRecordMagic[0]; record[1] = kRecordMagic[1]; record[2] = kRecordMagic[2]; record[3] = kRecordMagic[3];
    write_u32(record, 4, generation);
    const auto encoded = encode_config(config);
    for (std::size_t index = 0; index < encoded.size(); ++index) record[8 + index] = encoded[index];
    const std::vector<std::uint8_t> crc_input(record.begin(), record.begin() + kRecordCrcOffset);
    write_u32(record, kRecordCrcOffset, crc32(crc_input));
    return record;
}

bool decode_record(const std::vector<std::uint8_t>& record, std::uint32_t& generation, Config& config) {
    if (record.size() < kConfigStorageSlotBytes) return false;
    for (std::size_t index = 0; index < kRecordMagic.size(); ++index) if (record[index] != kRecordMagic[index]) return false;
    const std::vector<std::uint8_t> crc_input(record.begin(), record.begin() + kRecordCrcOffset);
    if (read_u32(record, kRecordCrcOffset) != crc32(crc_input)) return false;
    for (std::size_t index = kRecordCrcOffset + 4; index < kConfigStorageSlotBytes; ++index) if (record[index] != 0) return false;
    std::vector<std::uint8_t> encoded(record.begin() + 8, record.begin() + 8 + kConfigEncodedBytes);
    const auto result = decode_config(encoded, config);
    if (!result.ok) return false;
    generation = read_u32(record, 4);
    return true;
}
} // namespace

ConfigStore::ConfigStore(FlashBackend& backend) : backend_(backend) {}

bool ConfigStore::load() {
    std::vector<std::uint8_t> raw;
    if (!backend_.read(raw) || raw.size() < kConfigStorageBytes) {
        active_ = default_config();
        draft_ = active_;
        draft_pending_ = false;
        return false;
    }
    bool found = false;
    std::uint32_t selected_generation = 0;
    Config selected = default_config();
    for (std::size_t slot = 0; slot < kConfigStorageSlots; ++slot) {
        const auto begin = raw.begin() + static_cast<std::ptrdiff_t>(slot * kConfigStorageSlotBytes);
        const auto end = begin + static_cast<std::ptrdiff_t>(kConfigStorageSlotBytes);
        const std::vector<std::uint8_t> candidate(begin, end);
        std::uint32_t generation = 0;
        Config loaded;
        if (decode_record(candidate, generation, loaded) && (!found || generation > selected_generation)) {
            found = true; selected_generation = generation; selected = loaded; active_slot_ = slot;
        }
    }
    if (!found) {
        active_ = default_config(); draft_ = active_; draft_pending_ = false; generation_ = 0; active_slot_ = 0; return false;
    }
    active_ = selected; draft_ = selected; draft_pending_ = false; generation_ = selected_generation; return true;
}

ValidationResult ConfigStore::stage(const Config& value) {
    const auto result = validate_config(value);
    if (!result.ok) return result;
    draft_ = value; draft_pending_ = true; return result;
}

bool ConfigStore::commit() {
    if (!draft_pending_) return true;
    const auto result = validate_config(draft_);
    if (!result.ok) return false;
    const auto record = encode_record(generation_ + 1, draft_);
    const std::size_t next_slot = (active_slot_ + 1) % kConfigStorageSlots;
    const std::vector<std::uint8_t> bytes(record.begin(), record.end());
    if (!backend_.write_slot(next_slot, bytes)) return false;
    std::vector<std::uint8_t> verify;
    if (!backend_.read(verify) || verify.size() < kConfigStorageBytes) return false;
    const auto begin = verify.begin() + static_cast<std::ptrdiff_t>(next_slot * kConfigStorageSlotBytes);
    const auto end = begin + static_cast<std::ptrdiff_t>(kConfigStorageSlotBytes);
    const std::vector<std::uint8_t> verified_bytes(begin, end);
    Config verified;
    std::uint32_t verified_generation = 0;
    if (!decode_record(verified_bytes, verified_generation, verified) || verified_generation != generation_ + 1) return false;
    active_ = verified; draft_ = verified; draft_pending_ = false; active_slot_ = next_slot; generation_ = verified_generation; return true;
}

void ConfigStore::discard() { draft_ = active_; draft_pending_ = false; }

void ConfigStore::reset_to_defaults() { draft_ = default_config(); draft_pending_ = true; }

} // namespace miralink
