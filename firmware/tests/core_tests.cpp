#include "miralink_config.h"
#include "miralink_bluetooth_bootstrap.h"
#include "miralink_bluetooth_reconnect.h"
#include "miralink_config_store.h"
#include "miralink_dualsense.h"
#include "miralink_protocol.h"
#include "../pico/include/miralink_usb_identity.h"

#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <array>
#include <cstdint>
#include <cstdlib>
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
    assert(encoded.size() == kConfigEncodedBytes);
    for (std::size_t index = kConfigReservedOffset; index < encoded.size(); ++index) assert(encoded[index] == 0);
    Config decoded; const auto result = decode_config(encoded, decoded);
    assert(result.ok); assert(decoded.enable_wake); assert(decoded.lock_volume); assert(decoded.status_gpio_pin == 8); assert(decoded.haptics_gain == 1.42f);
}

void test_config_rejects_noncanonical_wire_payloads() {
    const auto raw = encode_config(default_config());
    const std::vector<std::uint8_t> canonical(raw.begin(), raw.end());
    Config decoded{};

    auto short_payload = canonical;
    short_payload.pop_back();
    assert(!decode_config(short_payload, decoded).ok);

    auto long_payload = canonical;
    long_payload.push_back(0);
    assert(!decode_config(long_payload, decoded).ok);

    auto unknown_flag = canonical;
    unknown_flag[10] |= 1u << 7;
    assert(!decode_config(unknown_flag, decoded).ok);

    auto non_zero_reserved = canonical;
    non_zero_reserved[kConfigReservedOffset] = 1;
    assert(!decode_config(non_zero_reserved, decoded).ok);
}

void test_store_requires_validated_commit() {
    MemoryFlash flash; flash.slots[0] = std::vector<std::uint8_t>(kConfigStorageSlotBytes, 0xff); flash.slots[1] = flash.slots[0];
    ConfigStore store(flash); assert(!store.load());
    auto value = default_config(); value.audio_buffer_length = 2; assert(!store.stage(value).ok); assert(!store.has_draft());
    store.reset_to_defaults(); assert(store.has_draft()); assert(store.commit()); assert(!store.has_draft());
    ConfigStore restored(flash); assert(restored.load()); assert(restored.active().audio_buffer_length == 64);
}

void test_config_rejects_reserved_status_gpio() {
    auto config = default_config();
    config.status_gpio_pin = 23;
    assert(!validate_config(config).ok);
    config.status_gpio_pin = 22;
    assert(validate_config(config).ok);
    config.status_gpio_pin = 0xff;
    assert(validate_config(config).ok);
}

void test_dualsense_usb_report_parser() {
    std::vector<std::uint8_t> report(miralink::dualsense::kUsbInputReportBytes, 0);
    report[0] = miralink::dualsense::kUsbInputReportId;
    report[1] = 128;
    report[2] = 255;
    report[3] = 0;
    report[4] = 64;
    report[5] = 64;
    report[6] = 255;
    report[7] = 0x2a;
    report[8] = 0x30;
    report[9] = 0x03;
    report[10] = 0x07;
    report[53] = 0x11;
    report[54] = 0x07;
    const auto parsed = miralink::dualsense::parse_usb_input_report(report);
    assert(parsed);
    (void)parsed;
    assert(parsed.state.left_x == 128);
    assert(parsed.state.right_x == 0);
    assert(parsed.state.left_trigger == 64);
    assert(parsed.state.dpad_face == 0x30);
    assert(parsed.state.input_sequence == 0x2a);
    assert(parsed.state.battery_valid);
    assert(parsed.state.battery_percent == 15);
    assert(parsed.state.battery_state == miralink::dualsense::BatteryState::Charging);
    assert(parsed.state.headphone_connected);
    assert(parsed.state.microphone_connected);
    assert(parsed.state.microphone_muted);
    assert(miralink::dualsense::is_dualsense_usb(miralink::dualsense::kSonyVendorId, miralink::dualsense::kDualSenseProductId));
    assert(miralink::dualsense::is_dualsense_usb(miralink::dualsense::kSonyVendorId, miralink::dualsense::kDualSenseEdgeProductId));
    assert(!miralink::dualsense::is_dualsense_usb(miralink::dualsense::kSonyVendorId, 0x0001));
}

void test_dualsense_usb_input_builder_neutral() {
    const miralink::dualsense::InputState neutral{};
    const auto report = miralink::dualsense::build_usb_input_report(neutral);
    assert(report.size() == miralink::dualsense::kUsbInputReportBytes);
    assert(report[0] == miralink::dualsense::kUsbInputReportId);
    assert(report[1] == 0x80);
    assert(report[2] == 0x80);
    assert(report[3] == 0x80);
    assert(report[4] == 0x80);
    assert(report[8] == 0x08);
    assert(report[33] == 0x80);
    assert(report[37] == 0x80);

    const auto parsed = miralink::dualsense::parse_usb_input_report(report.data(), report.size());
    assert(parsed);
    assert(parsed.state.report_id == miralink::dualsense::kUsbInputReportId);
    assert(parsed.state.left_x == 0x80);
    assert(parsed.state.left_y == 0x80);
    assert(parsed.state.right_x == 0x80);
    assert(parsed.state.right_y == 0x80);
    assert(parsed.state.left_trigger == 0);
    assert(parsed.state.right_trigger == 0);
    assert(parsed.state.dpad_face == 0x08);
    assert(!parsed.state.touch[0].active);
    assert(!parsed.state.touch[1].active);
    assert(!parsed.state.battery_valid);
    assert(parsed.state.battery_percent == 0xff);
    assert(parsed.state.battery_state == miralink::dualsense::BatteryState::Unknown);
    assert(!parsed.state.headphone_connected);
    assert(!parsed.state.microphone_connected);
    assert(!parsed.state.microphone_muted);
}

void test_dualsense_usb_input_builder_round_trip() {
    miralink::dualsense::InputState input{};
    input.left_x = 1;
    input.left_y = 254;
    input.right_x = 17;
    input.right_y = 239;
    input.left_trigger = 63;
    input.right_trigger = 192;
    input.input_sequence = 0xa7;
    input.dpad_face = 0xb6;
    input.shoulder = 0xd5;
    input.system = 0x0f;
    input.touchpad_pressed = true;
    input.gyro_x = -32768;
    input.gyro_y = -1234;
    input.gyro_z = 32767;
    input.accel_x = 2345;
    input.accel_y = -1;
    input.accel_z = 0x1234;
    input.sensor_timestamp = 0x89abcdefu;
    input.touch[0] = {true, 0x0abc, 0x0123};
    input.touch[1] = {false, 0x0456, 0x0def};
    input.battery_valid = true;
    input.battery_percent = 65;
    input.battery_state = miralink::dualsense::BatteryState::Charging;
    input.headphone_connected = true;
    input.microphone_connected = true;
    input.microphone_muted = true;

    const auto report = miralink::dualsense::build_usb_input_report(input);
    assert((report[1 + 53] & 0x08u) != 0);
    const auto parsed = miralink::dualsense::parse_usb_input_report(report.data(), report.size());
    assert(parsed);
    assert(parsed.state.left_x == input.left_x);
    assert(parsed.state.left_y == input.left_y);
    assert(parsed.state.right_x == input.right_x);
    assert(parsed.state.right_y == input.right_y);
    assert(parsed.state.left_trigger == input.left_trigger);
    assert(parsed.state.right_trigger == input.right_trigger);
    assert(parsed.state.input_sequence == input.input_sequence);
    assert(parsed.state.dpad_face == input.dpad_face);
    assert(parsed.state.shoulder == input.shoulder);
    assert(parsed.state.system == input.system);
    assert(parsed.state.touchpad_pressed == input.touchpad_pressed);
    assert(parsed.state.gyro_x == input.gyro_x);
    assert(parsed.state.gyro_y == input.gyro_y);
    assert(parsed.state.gyro_z == input.gyro_z);
    assert(parsed.state.accel_x == input.accel_x);
    assert(parsed.state.accel_y == input.accel_y);
    assert(parsed.state.accel_z == input.accel_z);
    assert(parsed.state.sensor_timestamp == input.sensor_timestamp);
    for (std::size_t index = 0; index < input.touch.size(); ++index) {
        assert(parsed.state.touch[index].active == input.touch[index].active);
        assert(parsed.state.touch[index].x == input.touch[index].x);
        assert(parsed.state.touch[index].y == input.touch[index].y);
    }
    assert(parsed.state.battery_valid);
    assert(parsed.state.battery_percent == input.battery_percent);
    assert(parsed.state.battery_state == input.battery_state);
    assert(parsed.state.headphone_connected == input.headphone_connected);
    assert(parsed.state.microphone_connected == input.microphone_connected);
    assert(parsed.state.microphone_muted == input.microphone_muted);
}

void test_dualsense_usb_input_builder_battery_states() {
    miralink::dualsense::InputState input{};
    input.battery_valid = true;

    input.battery_percent = 35;
    input.battery_state = miralink::dualsense::BatteryState::Discharging;
    auto parsed = miralink::dualsense::parse_usb_input_report(miralink::dualsense::build_usb_input_report(input).data(), miralink::dualsense::kUsbInputReportBytes);
    assert(parsed);
    assert(parsed.state.battery_percent == 35);
    assert(parsed.state.battery_state == miralink::dualsense::BatteryState::Discharging);

    input.battery_percent = 100;
    input.battery_state = miralink::dualsense::BatteryState::Full;
    const auto full_report = miralink::dualsense::build_usb_input_report(input);
    parsed = miralink::dualsense::parse_usb_input_report(full_report.data(), full_report.size());
    assert(parsed);
    assert(parsed.state.battery_percent == 100);
    assert(parsed.state.battery_state == miralink::dualsense::BatteryState::Full);

    input.battery_percent = 77;
    input.battery_state = miralink::dualsense::BatteryState::Error;
    const auto error_report = miralink::dualsense::build_usb_input_report(input);
    parsed = miralink::dualsense::parse_usb_input_report(error_report.data(), error_report.size());
    assert(parsed);
    assert(parsed.state.battery_percent == 0);
    assert(parsed.state.battery_state == miralink::dualsense::BatteryState::Error);
}

void test_dualsense_explicit_usb_wake_activity() {
    miralink::dualsense::InputState before{};
    auto after = before;
    after.input_sequence = 42;
    after.sensor_timestamp = 123456;
    after.gyro_x = 900;
    after.battery_valid = true;
    after.battery_percent = 50;
    assert(!miralink::dualsense::has_explicit_usb_wake_activity(before, after));

    after = before;
    after.system = 1;
    assert(miralink::dualsense::has_explicit_usb_wake_activity(before, after));
    after = before;
    after.left_x = static_cast<std::uint8_t>(before.left_x + 15);
    assert(!miralink::dualsense::has_explicit_usb_wake_activity(before, after));
    after.left_x = static_cast<std::uint8_t>(before.left_x + 16);
    assert(miralink::dualsense::has_explicit_usb_wake_activity(before, after));
    after = before;
    after.right_trigger = 8;
    assert(miralink::dualsense::has_explicit_usb_wake_activity(before, after));
    after = before;
    after.touch[0] = {true, 100, 100};
    assert(miralink::dualsense::has_explicit_usb_wake_activity(before, after));
}

void test_dualsense_user_controller_activity() {
    miralink::dualsense::InputState before{};
    auto after = before;
    after.input_sequence = 42;
    after.sensor_timestamp = 123456;
    after.gyro_x = 900;
    after.battery_valid = true;
    assert(!miralink::dualsense::has_user_controller_activity(before, after));

    after = before;
    after.left_x = 0x80 + 7;
    assert(!miralink::dualsense::has_user_controller_activity(before, after));
    after.left_x = 0x80 + 8;
    assert(miralink::dualsense::has_user_controller_activity(before, after));

    after = before;
    after.left_x = 0x80 + 24;
    assert(miralink::dualsense::has_user_controller_activity(after, after));

    after = before;
    after.right_trigger = 9;
    assert(miralink::dualsense::has_user_controller_activity(before, after));

    after = before;
    after.touch[0] = {true, 1, 1};
    assert(miralink::dualsense::has_user_controller_activity(before, after));
}

void test_dualsense_bluetooth_report_parser() {
    std::vector<std::uint8_t> report(miralink::dualsense::kBluetoothInputReportBytes, 0);
    report[0] = miralink::dualsense::kBluetoothInputReportId;
    report[2] = 128;
    report[3] = 255;
    report[4] = 0;
    report[5] = 64;
    report[6] = 64;
    report[7] = 255;
    report[8] = 0x2a;
    report[9] = 0x30;
    report[10] = 0x03;
    report[11] = 0x07;
    report[54] = 0x22;
    report[55] = 0x00;
    const auto crc = miralink::dualsense::bluetooth_input_crc32(report);
    report[74] = static_cast<std::uint8_t>(crc & 0xff);
    report[75] = static_cast<std::uint8_t>((crc >> 8u) & 0xff);
    report[76] = static_cast<std::uint8_t>((crc >> 16u) & 0xff);
    report[77] = static_cast<std::uint8_t>((crc >> 24u) & 0xff);
    const auto parsed = miralink::dualsense::parse_bluetooth_input_report(report);
    assert(parsed);
    (void)parsed;
    assert(parsed.state.left_x == 128);
    assert(parsed.state.right_x == 0);
    assert(parsed.state.dpad_face == 0x30);
    assert(parsed.state.input_sequence == 0x2a);
    assert(parsed.state.battery_valid);
    assert(parsed.state.battery_percent == 100);
    assert(parsed.state.battery_state == miralink::dualsense::BatteryState::Full);
    report[12] ^= 1;
    assert(miralink::dualsense::parse_bluetooth_input_report(report).error == miralink::dualsense::InputReportError::InvalidCrc);
}

void test_commit_config_ack_contract() {
    const auto unchanged = commit_config_ack(false);
    assert(unchanged.size() == kCommitConfigAckBytes);
    assert(unchanged[0] == kCommitConfigAckSchema);
    assert(unchanged[1] == 0);

    const auto changed = commit_config_ack(true);
    assert(changed[0] == kCommitConfigAckSchema);
    assert(changed[1] == kCommitConfigAckUsbReenumerationRequired);
}

void test_usb_identity_mode_mapping() {
    using namespace miralink::usb_identity;
    static_assert(product_id_for_mode(kControllerModeStandard) == kDualSenseProductId);
    static_assert(product_id_for_mode(kControllerModeAuto) == kDualSenseProductId);
    static_assert(product_id_for_mode(kControllerModeEdge) == kDualSenseEdgeProductId);
    static_assert(product_id_for_mode(0xff) == kDualSenseProductId);

    assert(!requires_reenumeration(kControllerModeStandard, false,
        kControllerModeAuto, false));
    assert(requires_reenumeration(kControllerModeStandard, false,
        kControllerModeEdge, false));
    assert(requires_reenumeration(kControllerModeEdge, false,
        kControllerModeAuto, false));
    assert(requires_reenumeration(kControllerModeAuto, false,
        kControllerModeAuto, true));
}

void test_dualsense_bluetooth_bootstrap_report_classification() {
    using miralink::bluetooth::bootstrap::InputReportKind;
    using miralink::bluetooth::bootstrap::classify_input_report;

    const std::array<std::uint8_t, 10> simple{0x01};
    const std::array<std::uint8_t, 11> simple_hidp{0xa1, 0x01};
    const std::array<std::uint8_t, 78> enhanced{0x31};
    const std::array<std::uint8_t, 79> enhanced_hidp{0xa1, 0x31};
    const std::array<std::uint8_t, 2> other{0xa1, 0x02};
    const std::array<std::uint8_t, 1> truncated_hidp{0xa1};
    const std::array<std::uint8_t, 1> truncated_simple{0x01};
    const std::array<std::uint8_t, 11> oversized_simple{0x01};
    const std::array<std::uint8_t, 10> truncated_simple_hidp{0xa1, 0x01};
    const std::array<std::uint8_t, 77> truncated_enhanced{0x31};
    const std::array<std::uint8_t, 78> truncated_enhanced_hidp{0xa1, 0x31};

    assert(classify_input_report(simple.data(), simple.size()) == InputReportKind::Simple);
    assert(classify_input_report(simple_hidp.data(), simple_hidp.size()) == InputReportKind::Simple);
    assert(classify_input_report(enhanced.data(), enhanced.size()) == InputReportKind::Enhanced);
    assert(classify_input_report(enhanced_hidp.data(), enhanced_hidp.size()) == InputReportKind::Enhanced);
    assert(classify_input_report(other.data(), other.size()) == InputReportKind::Other);
    assert(classify_input_report(truncated_hidp.data(), truncated_hidp.size()) == InputReportKind::Other);
    assert(classify_input_report(truncated_simple.data(), truncated_simple.size()) == InputReportKind::Other);
    assert(classify_input_report(oversized_simple.data(), oversized_simple.size()) == InputReportKind::Other);
    assert(classify_input_report(truncated_simple_hidp.data(), truncated_simple_hidp.size()) == InputReportKind::Other);
    assert(classify_input_report(truncated_enhanced.data(), truncated_enhanced.size()) == InputReportKind::Other);
    assert(classify_input_report(truncated_enhanced_hidp.data(), truncated_enhanced_hidp.size()) == InputReportKind::Other);
    assert(classify_input_report(nullptr, 0) == InputReportKind::Other);
}

void test_dualsense_bluetooth_reconnect_policy() {
    namespace reconnect = miralink::bluetooth::reconnect;
    using reconnect::RadioAction;

    assert(reconnect::radio_action(false, false, 1) == RadioAction::None);
    assert(reconnect::radio_action(true, false, 0) == RadioAction::None);
    assert(reconnect::radio_action(true, true, 0) == RadioAction::ExplicitPairingInquiry);
    assert(reconnect::radio_action(true, true, 1) == RadioAction::ExplicitPairingInquiry);
    assert(reconnect::radio_action(true, false, 1) == RadioAction::PassiveReconnect);

    // Remembered controllers must retain BTstack's only HID-host slot for the
    // controller-initiated reconnect generated by a PS-button press.
    assert(!reconnect::allows_outgoing_hid_connect(RadioAction::None));
    assert(!reconnect::allows_outgoing_hid_connect(RadioAction::PassiveReconnect));
    assert(reconnect::allows_outgoing_hid_connect(RadioAction::ExplicitPairingInquiry));

    assert(reconnect::should_rearm_page_scan(true, false, false));
    assert(!reconnect::should_rearm_page_scan(false, false, false));
    assert(!reconnect::should_rearm_page_scan(true, true, false));
    assert(!reconnect::should_rearm_page_scan(true, false, true));

    assert(reconnect::should_rearm_after_idle_resume(true, true));
    assert(!reconnect::should_rearm_after_idle_resume(false, true));
    assert(!reconnect::should_rearm_after_idle_resume(true, false));

    // The passive reconnect rearm is triggered by the completed HCI teardown,
    // not merely by the earlier HID channel-close callback.
    assert(reconnect::should_rearm_after_hci_disconnection(true, false));
    assert(!reconnect::should_rearm_after_hci_disconnection(false, false));
    assert(!reconnect::should_rearm_after_hci_disconnection(true, true));
    assert(reconnect::should_restore_discoverable(true, false));
    assert(!reconnect::should_restore_discoverable(false, false));
    assert(!reconnect::should_restore_discoverable(true, true));
    assert(reconnect::should_recover_after_hci_disconnection(true, false, true));
    assert(!reconnect::should_recover_after_hci_disconnection(true, false, false));
    assert(!reconnect::should_recover_after_hci_disconnection(true, true, true));
    assert(reconnect::should_recover_after_acl_failure(true, false, true));
    assert(!reconnect::should_recover_after_acl_failure(true, false, false));
    assert(!reconnect::should_recover_after_acl_failure(true, true, true));
    assert(reconnect::matches_active_acl_disconnection(true, 0x0042, 0x0042, true));
    assert(!reconnect::matches_active_acl_disconnection(true, 0x0042, 0x0043, true));
    assert(reconnect::matches_active_acl_disconnection(false, 0xffff, 0x0043, true));
    assert(!reconnect::matches_active_acl_disconnection(false, 0xffff, 0x0043, false));
    assert(reconnect::should_drop_key_after_auth_failure(true, true, false));
    assert(!reconnect::should_drop_key_after_auth_failure(false, true, false));
    assert(!reconnect::should_drop_key_after_auth_failure(true, false, false));
    assert(!reconnect::should_drop_key_after_auth_failure(true, true, true));

    // Authentication persists the Bluetooth bond independently from the
    // enhanced-input trust gate.  A bootstrap failure must not force a new
    // web pairing after a successful bond.
    assert(reconnect::should_drop_unvalidated_key(false, false, false));
    assert(!reconnect::should_drop_unvalidated_key(true, false, false));
    assert(!reconnect::should_drop_unvalidated_key(false, true, false));
    assert(!reconnect::should_drop_unvalidated_key(false, false, true));

    assert(reconnect::completes_pairing_window(true, true));
    assert(!reconnect::completes_pairing_window(true, false));
    assert(!reconnect::completes_pairing_window(false, true));
}

void test_dualsense_bluetooth_feature_bootstrap_sequence() {
    namespace bootstrap = miralink::bluetooth::bootstrap;
    const std::array<std::uint8_t, 41> calibration{0x05};
    const std::array<std::uint8_t, 20> pairing{0x09};
    const std::array<std::uint8_t, 64> firmware{0x20};
    const std::array<std::uint8_t, 40> short_calibration{0x05};
    const std::array<std::uint8_t, 41> wrong_calibration_id{0x09};

    assert(bootstrap::valid_feature_response(0x05, calibration.data(), calibration.size()));
    assert(bootstrap::valid_feature_response(0x09, pairing.data(), pairing.size()));
    assert(bootstrap::valid_feature_response(0x20, firmware.data(), firmware.size()));
    assert(!bootstrap::valid_feature_response(0x05, short_calibration.data(), short_calibration.size()));
    assert(!bootstrap::valid_feature_response(0x05, wrong_calibration_id.data(), wrong_calibration_id.size()));
    assert(!bootstrap::valid_feature_response(0x06, calibration.data(), calibration.size()));

    bootstrap::State state{};
    bootstrap::begin(state);
    assert(state.phase == bootstrap::Phase::FeatureRequestReady);
    assert(bootstrap::feature_report_id(state) == 0x05);
    assert(bootstrap::initial_state_output_safe(state));

    assert(bootstrap::feature_request_sent(state, 0x05));
    assert(state.phase == bootstrap::Phase::FeatureResponsePending);
    assert(!bootstrap::initial_state_output_safe(state));
    assert(bootstrap::feature_response_received(state, 0x05, true));
    assert(state.phase == bootstrap::Phase::WaitingForEnhancedInput);
    assert(bootstrap::initial_state_output_safe(state));
    assert(!bootstrap::output_safe(state));

    // A controller which acknowledges a feature request but stays in compact
    // mode is tried with the next public Sony feature report.
    assert(bootstrap::enhanced_input_timed_out(state));
    assert(bootstrap::feature_report_id(state) == 0x09);
    assert(bootstrap::feature_request_sent(state, 0x09));
    assert(bootstrap::feature_response_received(state, 0x09, false));
    assert(bootstrap::feature_report_id(state) == 0x20);
    assert(bootstrap::feature_request_sent(state, 0x20));
    assert(bootstrap::feature_response_received(state, 0x20, false));
    assert(bootstrap::fallback_output_ready(state));
    assert(!bootstrap::initial_state_output_safe(state));
    assert(bootstrap::fallback_output_sent(state));
    assert(state.phase == bootstrap::Phase::WaitingForEnhancedInput);
    assert(bootstrap::initial_state_output_safe(state));
    assert(bootstrap::enhanced_input_timed_out(state));
    assert(state.phase == bootstrap::Phase::Failed);
}

void test_dualsense_bluetooth_feature_bootstrap_races() {
    namespace bootstrap = miralink::bluetooth::bootstrap;
    bootstrap::State state{};
    bootstrap::begin(state);
    assert(bootstrap::feature_request_sent(state, 0x05));

    // Full input may race the GET_REPORT response. It proves the controller is
    // usable, but output stays gated until BTstack finishes its one control
    // transaction.
    bootstrap::enhanced_input_received(state);
    assert(state.phase == bootstrap::Phase::FeatureResponsePending);
    assert(!bootstrap::output_safe(state));
    assert(bootstrap::feature_response_received(state, 0x05, false));
    assert(state.phase == bootstrap::Phase::Complete);
    assert(bootstrap::output_safe(state));

    bootstrap::reset(state);
    bootstrap::begin(state);
    assert(bootstrap::feature_request_sent(state, 0x05));
    assert(bootstrap::retry_feature_request(state, 0x05));
    assert(state.phase == bootstrap::Phase::FeatureRequestReady);
    assert(bootstrap::feature_report_id(state) == 0x05);

    // A transport timeout is mapped to an unsuccessful response after the
    // build-time BTstack helper releases its single GET_REPORT transaction.
    assert(bootstrap::feature_request_sent(state, 0x05));
    assert(bootstrap::feature_response_received(state, 0x05, false));
    assert(state.phase == bootstrap::Phase::FeatureRequestReady);
    assert(bootstrap::feature_report_id(state) == 0x09);
}

void test_dualsense_bluetooth_output_builder() {
    miralink::dualsense::OutputRequest request{};
    request.haptics = true;
    request.left_motor = 0x22;
    request.right_motor = 0x44;
    request.lightbar = true;
    request.lightbar_red = 0x10;
    request.lightbar_green = 0x20;
    request.lightbar_blue = 0x30;
    request.player_leds = true;
    request.player_leds_mask = 0x12;
    const auto report = miralink::dualsense::build_bluetooth_output_report(request, 3);
    assert(report[0] == miralink::dualsense::kBluetoothOutputReportId);
    assert(report[1] == 0x30);
    assert(report[2] == 0x10);
    assert((report[3] & 0x03) == 0x03);
    assert(report[5] == 0x44);
    assert(report[6] == 0x22);
    assert(report[47] == 0x10);
    assert(report[48] == 0x20);
    assert(report[49] == 0x30);
    const auto crc = static_cast<std::uint32_t>(report[74])
        | (static_cast<std::uint32_t>(report[75]) << 8u)
        | (static_cast<std::uint32_t>(report[76]) << 16u)
        | (static_cast<std::uint32_t>(report[77]) << 24u);
    assert(crc == miralink::dualsense::bluetooth_output_crc32(report.data(), report.size()));
}

void test_dualsense_bluetooth_state_output_builder() {
    const auto report = miralink::dualsense::build_bluetooth_state_output_report();
    assert(report.size() == miralink::dualsense::kBluetoothStateOutputReportBytes);
    assert(report[0] == miralink::dualsense::kBluetoothStateOutputReportId);
    assert(report[1] == 0x10);
    assert(report[2] == 0x90);
    assert(report[3] == 0x3f);
    // State body starts after the four-byte native report header.
    assert(report[4] == 0xfd);
    assert(report[5] == 0xf7);
    assert(report[11] == 0x09);
    const auto crc = static_cast<std::uint32_t>(report[138])
        | (static_cast<std::uint32_t>(report[139]) << 8u)
        | (static_cast<std::uint32_t>(report[140]) << 16u)
        | (static_cast<std::uint32_t>(report[141]) << 24u);
    assert(crc == miralink::dualsense::bluetooth_output_crc32(report.data(), report.size()));
}

void test_dualsense_controller_output_mapping() {
    miralink::dualsense::OutputRequest request{};
    request.usb_output = true;
    for (std::size_t index = 0; index < request.usb_output_payload.size(); ++index) {
        request.usb_output_payload[index] = static_cast<std::uint8_t>(index + 1);
    }
    const auto report = miralink::dualsense::build_bluetooth_output_report(request, 9);
    assert(report[0] == miralink::dualsense::kBluetoothOutputReportId);
    assert(report[1] == 0x90);
    assert(report[2] == 0x10);
    assert(report[3] == 1);
    assert(report[13] == 11);
    assert(report[49] == 47);
    const auto crc = static_cast<std::uint32_t>(report[74])
        | (static_cast<std::uint32_t>(report[75]) << 8u)
        | (static_cast<std::uint32_t>(report[76]) << 16u)
        | (static_cast<std::uint32_t>(report[77]) << 24u);
    assert(crc == miralink::dualsense::bluetooth_output_crc32(report.data(), report.size()));
}

void test_dualsense_usb_output_normalization() {
    std::array<std::uint8_t, miralink::dualsense::kUsbOutputReportBytes> compact{};
    compact[0] = miralink::dualsense::kUsbOutputReportId;
    for (std::size_t index = 1; index < compact.size(); ++index) {
        compact[index] = static_cast<std::uint8_t>(index);
    }
    auto normalized = miralink::dualsense::normalize_usb_output_report(
        0, compact.data(), compact.size());
    assert(normalized.valid);
    assert(normalized.payload.front() == 1);
    assert(normalized.payload.back() == 47);

    std::array<std::uint8_t, miralink::dualsense::kUsbStandardOutputReportBytes> linux_wire{};
    std::copy(compact.begin(), compact.end(), linux_wire.begin());
    std::fill(linux_wire.begin() + compact.size(), linux_wire.end(), 0xee);
    normalized = miralink::dualsense::normalize_usb_output_report(
        0, linux_wire.data(), linux_wire.size());
    assert(normalized.valid);
    assert(normalized.payload.back() == 47);

    normalized = miralink::dualsense::normalize_usb_output_report(
        miralink::dualsense::kUsbOutputReportId,
        compact.data() + 1, compact.size() - 1);
    assert(normalized.valid);
    normalized = miralink::dualsense::normalize_usb_output_report(
        miralink::dualsense::kUsbOutputReportId,
        linux_wire.data() + 1, linux_wire.size() - 1);
    assert(normalized.valid);
    assert(normalized.payload.back() == 47);

    assert(!miralink::dualsense::normalize_usb_output_report(
        0, compact.data() + 1, compact.size() - 1).valid);
    assert(!miralink::dualsense::normalize_usb_output_report(
        3, compact.data(), compact.size()).valid);
    assert(!miralink::dualsense::normalize_usb_output_report(
        0, nullptr, compact.size()).valid);
}

void test_dualsense_synthetic_usb_calibration() {
    const auto payload = miralink::dualsense::build_synthetic_usb_calibration_feature();
    const auto read_i16 = [&](const std::size_t offset) {
        return static_cast<std::int16_t>(static_cast<std::uint16_t>(payload[offset])
            | (static_cast<std::uint16_t>(payload[offset + 1]) << 8u));
    };
    const auto speed_plus = static_cast<std::int32_t>(read_i16(18));
    const auto speed_minus = static_cast<std::int32_t>(read_i16(20));
    for (const std::size_t offset : {std::size_t{6}, std::size_t{10}, std::size_t{14}}) {
        const auto positive = static_cast<std::int32_t>(read_i16(offset));
        const auto negative = static_cast<std::int32_t>(read_i16(offset + 2));
        assert(positive == 1024);
        assert(negative == -1024);
        const auto sensitivity = (speed_plus + speed_minus) * 1024
            / (std::abs(positive) + std::abs(negative));
        assert(sensitivity == 64);
    }
    for (const std::size_t offset : {std::size_t{22}, std::size_t{26}, std::size_t{30}}) {
        const auto positive = static_cast<std::int32_t>(read_i16(offset));
        const auto negative = static_cast<std::int32_t>(read_i16(offset + 2));
        assert(positive == 8192);
        assert(negative == -8192);
        assert((2 * 8192) / (std::abs(positive) + std::abs(negative)) == 1);
    }
}

void test_dualsense_trigger_reduction() {
    std::array<std::uint8_t, miralink::dualsense::kUsbOutputPayloadBytes> payload{};
    payload[miralink::dualsense::kUsbOutputRightTriggerOffset] = 0x02;
    payload[miralink::dualsense::kUsbOutputRightTriggerOffset + 1] = 100;
    payload[miralink::dualsense::kUsbOutputRightTriggerOffset + 2] = 255;
    payload[miralink::dualsense::kUsbOutputLeftTriggerOffset] = 0x05;
    payload[miralink::dualsense::kUsbOutputLeftTriggerOffset + 1] = 80;
    const auto original = payload;

    miralink::dualsense::apply_usb_output_trigger_reduction(payload, 0);
    assert(payload == original);

    miralink::dualsense::apply_usb_output_trigger_reduction(payload, 5);
    assert(payload[miralink::dualsense::kUsbOutputRightTriggerOffset] == 0x02);
    assert(payload[miralink::dualsense::kUsbOutputRightTriggerOffset + 1] == 50);
    assert(payload[miralink::dualsense::kUsbOutputRightTriggerOffset + 2] == 128);
    assert(payload[miralink::dualsense::kUsbOutputLeftTriggerOffset] == 0x05);
    assert(payload[miralink::dualsense::kUsbOutputLeftTriggerOffset + 1] == 40);

    miralink::dualsense::apply_usb_output_trigger_reduction(payload, 10);
    for (std::size_t index = 0; index < miralink::dualsense::kUsbOutputTriggerEffectBytes; ++index) {
        assert(payload[miralink::dualsense::kUsbOutputRightTriggerOffset + index] == 0);
        assert(payload[miralink::dualsense::kUsbOutputLeftTriggerOffset + index] == 0);
    }
}

void test_dualsense_audio_report_validation() {
    std::vector<std::uint8_t> report(miralink::dualsense::kBluetoothAudioReportBytes, 0);
    report[0] = miralink::dualsense::kBluetoothAudioReportId;
    report[miralink::dualsense::kBluetoothAudioHapticHeaderOffset] = 0x92;
    report[miralink::dualsense::kBluetoothAudioHapticLengthOffset] = static_cast<std::uint8_t>(miralink::dualsense::kBluetoothAudioHapticBytes);
    report[miralink::dualsense::kBluetoothAudioOpusHeaderOffset] = 0x13;
    report[miralink::dualsense::kBluetoothAudioOpusLengthOffset] = 10;
    assert(miralink::dualsense::validate_bluetooth_audio_report(report));

    report[miralink::dualsense::kBluetoothAudioOpusLengthOffset] = 0;
    assert(miralink::dualsense::validate_bluetooth_audio_report(report).error
        == miralink::dualsense::AudioReportError::InvalidLayout);
    report[miralink::dualsense::kBluetoothAudioOpusLengthOffset] = 10;
    report[0] = 0;
    assert(miralink::dualsense::validate_bluetooth_audio_report(report).error
        == miralink::dualsense::AudioReportError::UnsupportedReportId);
    report[0] = miralink::dualsense::kBluetoothAudioReportId;
    report.resize(miralink::dualsense::kBluetoothAudioReportBytes - 1);
    assert(miralink::dualsense::validate_bluetooth_audio_report(report).error
        == miralink::dualsense::AudioReportError::BadLength);
}

int main() {
    test_frame_round_trip(); test_frame_rejects_corruption(); test_frame_rejects_non_zero_padding(); test_commit_config_ack_contract(); test_usb_identity_mode_mapping(); test_config_round_trip(); test_config_rejects_noncanonical_wire_payloads(); test_config_rejects_reserved_status_gpio(); test_store_requires_validated_commit(); test_dualsense_usb_report_parser(); test_dualsense_usb_input_builder_neutral(); test_dualsense_usb_input_builder_round_trip(); test_dualsense_usb_input_builder_battery_states(); test_dualsense_explicit_usb_wake_activity(); test_dualsense_user_controller_activity(); test_dualsense_bluetooth_report_parser(); test_dualsense_bluetooth_bootstrap_report_classification(); test_dualsense_bluetooth_reconnect_policy(); test_dualsense_bluetooth_feature_bootstrap_sequence(); test_dualsense_bluetooth_feature_bootstrap_races(); test_dualsense_bluetooth_output_builder(); test_dualsense_bluetooth_state_output_builder(); test_dualsense_controller_output_mapping(); test_dualsense_usb_output_normalization(); test_dualsense_synthetic_usb_calibration(); test_dualsense_trigger_reduction(); test_dualsense_audio_report_validation();
    std::cout << "MiraLink core tests passed\n";
}
