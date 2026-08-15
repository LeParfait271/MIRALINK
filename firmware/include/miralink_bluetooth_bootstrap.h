#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace miralink::bluetooth::bootstrap {

constexpr std::uint8_t kHidInputHeader = 0xa1;
constexpr std::uint8_t kSimpleInputReportId = 0x01;
constexpr std::uint8_t kEnhancedInputReportId = 0x31;
constexpr std::size_t kSimpleInputReportBytes = 10;
constexpr std::size_t kEnhancedInputReportBytes = 78;

// Reading any of these Sony feature reports is known to switch a Bluetooth
// DualSense from its compact 0x01 reports to full 0x31 reports. Calibration is
// the conventional first request; pairing and firmware information cover
// controller revisions which do not switch after the calibration request.
constexpr std::array<std::uint8_t, 3> kFeatureReportIds{0x05, 0x09, 0x20};
constexpr std::array<std::size_t, 3> kFeatureReportBytes{41, 20, 64};

constexpr std::size_t feature_report_bytes(const std::uint8_t report_id) {
    for (std::size_t index = 0; index < kFeatureReportIds.size(); ++index) {
        if (kFeatureReportIds[index] == report_id) return kFeatureReportBytes[index];
    }
    return 0;
}

constexpr bool valid_feature_response(const std::uint8_t report_id,
    const std::uint8_t* report, const std::size_t length) {
    const auto expected_length = feature_report_bytes(report_id);
    return report != nullptr && expected_length != 0
        && length == expected_length && report[0] == report_id;
}

enum class InputReportKind : std::uint8_t {
    Other,
    Simple,
    Enhanced
};

constexpr InputReportKind classify_input_report(
    const std::uint8_t* report, const std::size_t length) {
    if (report == nullptr || length == 0) return InputReportKind::Other;
    const std::size_t report_id_offset = report[0] == kHidInputHeader ? 1 : 0;
    if (report_id_offset >= length) return InputReportKind::Other;
    const auto report_id = report[report_id_offset];
    if (report_id == kSimpleInputReportId
        && length == kSimpleInputReportBytes + report_id_offset) {
        return InputReportKind::Simple;
    }
    if (report_id == kEnhancedInputReportId
        && length == kEnhancedInputReportBytes + report_id_offset) {
        return InputReportKind::Enhanced;
    }
    return InputReportKind::Other;
}

enum class Phase : std::uint8_t {
    Inactive,
    FeatureRequestReady,
    FeatureResponsePending,
    WaitingForEnhancedInput,
    FallbackOutputReady,
    Failed,
    Complete
};

struct State {
    Phase phase = Phase::Inactive;
    std::size_t feature_index = 0;
    std::uint8_t pending_report_id = 0;
    bool enhanced_input_seen = false;
    bool fallback_output_sent = false;
};

constexpr void reset(State& state) {
    state = {};
}

constexpr void begin(State& state) {
    if (state.enhanced_input_seen) {
        state.phase = Phase::Complete;
        return;
    }
    state.feature_index = 0;
    state.pending_report_id = 0;
    state.fallback_output_sent = false;
    state.phase = Phase::FeatureRequestReady;
}

constexpr bool feature_request_ready(const State& state) {
    return state.phase == Phase::FeatureRequestReady
        && state.feature_index < kFeatureReportIds.size();
}

constexpr std::uint8_t feature_report_id(const State& state) {
    return feature_request_ready(state) ? kFeatureReportIds[state.feature_index] : 0;
}

constexpr bool feature_request_sent(State& state, const std::uint8_t report_id) {
    if (!feature_request_ready(state) || feature_report_id(state) != report_id) return false;
    state.pending_report_id = report_id;
    state.phase = Phase::FeatureResponsePending;
    return true;
}

constexpr void advance_feature(State& state) {
    state.pending_report_id = 0;
    ++state.feature_index;
    state.phase = state.feature_index < kFeatureReportIds.size()
        ? Phase::FeatureRequestReady
        : Phase::FallbackOutputReady;
}

constexpr bool feature_request_failed(State& state, const std::uint8_t report_id) {
    if (!feature_request_ready(state) || feature_report_id(state) != report_id) return false;
    advance_feature(state);
    return true;
}

constexpr bool feature_response_received(State& state, const std::uint8_t report_id,
    const bool successful) {
    if (state.phase != Phase::FeatureResponsePending
        || state.pending_report_id != report_id) return false;
    state.pending_report_id = 0;
    if (state.enhanced_input_seen) {
        state.phase = Phase::Complete;
    } else if (successful) {
        state.fallback_output_sent = false;
        state.phase = Phase::WaitingForEnhancedInput;
    } else {
        advance_feature(state);
    }
    return true;
}

constexpr bool retry_feature_request(State& state, const std::uint8_t report_id) {
    if (state.phase != Phase::FeatureResponsePending
        || state.pending_report_id != report_id) return false;
    state.pending_report_id = 0;
    state.phase = Phase::FeatureRequestReady;
    return true;
}

constexpr bool fallback_output_ready(const State& state) {
    return state.phase == Phase::FallbackOutputReady;
}

constexpr bool fallback_output_sent(State& state) {
    if (!fallback_output_ready(state)) return false;
    state.fallback_output_sent = true;
    state.phase = Phase::WaitingForEnhancedInput;
    return true;
}

constexpr bool fallback_output_failed(State& state) {
    if (!fallback_output_ready(state)) return false;
    state.phase = Phase::Failed;
    return true;
}

constexpr bool enhanced_input_timed_out(State& state) {
    if (state.phase != Phase::WaitingForEnhancedInput) return false;
    if (state.fallback_output_sent) {
        state.phase = Phase::Failed;
    } else {
        advance_feature(state);
    }
    return true;
}

constexpr void enhanced_input_received(State& state) {
    state.enhanced_input_seen = true;
    // Keep a control request pending until its response arrives. BTstack owns
    // a single HID control transaction and an interrupt output must not
    // replace it merely because the first full input report arrived quickly.
    if (state.phase != Phase::FeatureResponsePending) {
        state.pending_report_id = 0;
        state.phase = Phase::Complete;
    }
}

constexpr bool output_safe(const State& state) {
    return state.phase == Phase::Complete;
}

// The native state packet shares BTstack's HID transport with the Feature
// bootstrap. It is safe only after a Feature response has returned (or after
// the bootstrap has completed); never spend output retries while a GET_REPORT
// transaction still owns the HID host state.
constexpr bool initial_state_output_safe(const State& state) {
    return state.phase == Phase::WaitingForEnhancedInput
        || state.phase == Phase::Complete;
}

} // namespace miralink::bluetooth::bootstrap
