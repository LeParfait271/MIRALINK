#include "miralink_usb_identity.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

#include "miralink_dualsense.h"
#include "pico/rand.h"
#include "pico/unique_id.h"
#include "tusb.h"

#ifndef MIRALINK_VERSION_MAJOR
#define MIRALINK_VERSION_MAJOR 0
#endif
#ifndef MIRALINK_VERSION_MINOR
#define MIRALINK_VERSION_MINOR 0
#endif
#ifndef MIRALINK_VERSION_PATCH
#define MIRALINK_VERSION_PATCH 0
#endif

namespace miralink::usb_identity {
namespace {
bool g_unique_serial_enabled = false;
std::uint16_t g_selected_product_id = kDualSenseProductId;
std::array<std::uint8_t, 6> g_ephemeral_pairing_address{};
bool g_ephemeral_pairing_address_ready = false;

void write_u32(std::uint8_t* bytes, const std::size_t offset, const std::uint32_t value) {
    for (std::size_t index = 0; index < 4; ++index) {
        bytes[offset + index] = static_cast<std::uint8_t>((value >> (index * 8u)) & 0xffu);
    }
}
}

void set_controller_mode(const std::uint8_t mode) {
    // Unknown and Auto values both fail safely to the broadly compatible
    // standard controller persona.
    g_selected_product_id = mode == kControllerModeEdge
        ? kDualSenseEdgeProductId
        : kDualSenseProductId;
}

void set_unique_serial_enabled(const bool enabled) {
    g_unique_serial_enabled = enabled;
}

bool unique_serial_enabled() {
    return g_unique_serial_enabled;
}

std::size_t copy_bridge_feature_report(const std::uint8_t report_id,
    std::uint8_t* buffer, const std::size_t capacity) {
    const std::size_t required = report_id == kCalibrationFeatureReport ? 40u
        : report_id == kPairingFeatureReport ? 19u
        : report_id == kFirmwareFeatureReport ? 63u
        : 0u;
    if (required == 0 || buffer == nullptr || capacity < required) return 0;
    std::fill(buffer, buffer + required, 0);

    if (report_id == kCalibrationFeatureReport) {
        const auto calibration = miralink::dualsense::build_synthetic_usb_calibration_feature();
        std::copy(calibration.begin(), calibration.end(), buffer);
    } else if (report_id == kPairingFeatureReport) {
        if (unique_serial_enabled()) {
            pico_unique_board_id_t board_id{};
            pico_get_unique_board_id(&board_id);
            constexpr std::uint8_t salt[6] = {0x4d, 0x69, 0x72, 0x61, 0x4c, 0x6b};
            for (std::size_t index = 0; index < 6; ++index) {
                buffer[index] = static_cast<std::uint8_t>(
                    board_id.id[index] ^ board_id.id[index + 2] ^ salt[index]);
            }
        } else {
            // Linux needs a non-duplicate address while this device is
            // registered, but persistence would defeat the serial privacy
            // setting. Generate it once per boot and keep it only in RAM.
            if (!g_ephemeral_pairing_address_ready) {
                const auto random = get_rand_64();
                for (std::size_t index = 0; index < g_ephemeral_pairing_address.size(); ++index) {
                    g_ephemeral_pairing_address[index] =
                        static_cast<std::uint8_t>(random >> (index * 8u));
                }
                g_ephemeral_pairing_address_ready = true;
            }
            std::copy(g_ephemeral_pairing_address.begin(),
                g_ephemeral_pairing_address.end(), buffer);
        }
        // hid-playstation stores this address little-endian and prints it in
        // reverse order, so byte 5 is the conventional first MAC octet.
        buffer[5] = static_cast<std::uint8_t>((buffer[5] & 0xfcu) | 0x02u);
    } else {
        // Linux only exposes these words as diagnostics. The ML prefix makes
        // clear that they are MiraLink persona revisions, not Sony firmware.
        write_u32(buffer, 23, 0x4d4c0001u);
        const auto firmware_revision = 0x4d000000u
            | (static_cast<std::uint32_t>(MIRALINK_VERSION_MAJOR & 0xffu) << 16u)
            | (static_cast<std::uint32_t>(MIRALINK_VERSION_MINOR & 0xffu) << 8u)
            | static_cast<std::uint32_t>(MIRALINK_VERSION_PATCH & 0xffu);
        write_u32(buffer, 27, firmware_revision);
        // update_version remains zero: the standard persona requests the
        // broadly supported legacy compatible-vibration flag. Edge is forced
        // to v2 by hid-playstation based on its PID.
    }
    return required;
}
} // namespace miralink::usb_identity

namespace {
constexpr auto kBridgeHidInstance = miralink::usb_identity::kBridgeHidInstance;
constexpr auto kControlHidInstance = miralink::usb_identity::kControlHidInstance;
constexpr std::uint8_t kInterfaceNumber = 0;
constexpr std::uint8_t kBridgeEndpointOut = 0x01;
constexpr std::uint8_t kBridgeEndpointIn = 0x81;
constexpr auto kControlReportCommand = miralink::usb_identity::kControlReportCommand;
constexpr auto kControlReportResponse = miralink::usb_identity::kControlReportResponse;
constexpr std::size_t kBridgeInputPayloadBytes = miralink::dualsense::kUsbInputReportBytes - 1;
constexpr std::uint8_t kBridgeOutputPayloadBytes = miralink::dualsense::kUsbOutputReportBytes - 1;
constexpr std::size_t kBridgeNamedInputBytes = 11;
constexpr std::size_t kBridgeOpaqueInputBytes = kBridgeInputPayloadBytes - kBridgeNamedInputBytes;
constexpr auto kCalibrationFeaturePayloadBytes =
    miralink::dualsense::kUsbCalibrationFeaturePayloadBytes;
constexpr std::uint8_t kPairingFeaturePayloadBytes = 19;
constexpr std::uint8_t kFirmwareFeaturePayloadBytes = 63;

static_assert(CFG_TUD_HID == 1, "The Sony Bridge persona must expose exactly one HID instance");
static_assert(kBridgeHidInstance == kControlHidInstance);
static_assert(CFG_TUD_HID_EP_BUFSIZE >= 65,
    "The MiraLink control reports require a 65-byte TinyUSB staging buffer");
static_assert(miralink::dualsense::kUsbInputReportId == 0x01);
static_assert(miralink::dualsense::kUsbInputReportBytes == 64);
static_assert(miralink::dualsense::kUsbOutputReportId == 0x02);
static_assert(miralink::dualsense::kUsbOutputReportBytes == 48);
static_assert(kBridgeOutputPayloadBytes + 1 == miralink::dualsense::kUsbOutputReportBytes);
static_assert(kCalibrationFeaturePayloadBytes + 1 == 41);
static_assert(kPairingFeaturePayloadBytes + 1 == 20);
static_assert(kFirmwareFeaturePayloadBytes + 1 == 64);
static_assert(kBridgeNamedInputBytes + kBridgeOpaqueInputBytes == kBridgeInputPayloadBytes);
static_assert(miralink::usb_identity::kSonyVendorId == miralink::dualsense::kSonyVendorId);
static_assert(miralink::usb_identity::kDualSenseProductId == miralink::dualsense::kDualSenseProductId);
static_assert(miralink::usb_identity::kDualSenseEdgeProductId == miralink::dualsense::kDualSenseEdgeProductId);

#define MIRALINK_FEATURE_REPORT(_id, _usage) \
    HID_REPORT_ID(_id) \
    HID_USAGE(_usage), \
    HID_LOGICAL_MIN(0x00), \
    HID_LOGICAL_MAX_N(0xff, 2), \
    HID_REPORT_SIZE(8), \
    HID_REPORT_COUNT(64), \
    HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

// The Bridge report descriptor is an original description of MiraLink's
// existing 63-byte common input body. The first eleven bytes retain useful HID
// semantics (sticks, triggers, sequence, hat, buttons and reserved bits); the sensor, touch,
// status and reserved tail remains an opaque, fixed-size vendor block. This
// preserves every byte without importing another project's descriptor.
constexpr std::uint8_t kBridgeReportDescriptor[] = {
    HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
    HID_USAGE(HID_USAGE_DESKTOP_GAMEPAD),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
    HID_REPORT_ID(miralink::dualsense::kUsbInputReportId)

    // Match the native DualSense generic-HID axis order exactly. The common
    // body remains LX, LY, RX, RY, L2, R2 in bytes 0..5; Sony's descriptor
    // labels those positions X, Y, Z, Rz, Rx and Ry respectively.
    HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
    HID_USAGE(HID_USAGE_DESKTOP_X),
    HID_USAGE(HID_USAGE_DESKTOP_Y),
    HID_USAGE(HID_USAGE_DESKTOP_Z),
    HID_USAGE(HID_USAGE_DESKTOP_RZ),
    HID_USAGE(HID_USAGE_DESKTOP_RX),
    HID_USAGE(HID_USAGE_DESKTOP_RY),
    HID_LOGICAL_MIN(0x00),
    HID_LOGICAL_MAX_N(0xff, 2),
    HID_REPORT_SIZE(8),
    HID_REPORT_COUNT(6),
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // Input sequence: common-body byte 6.
    HID_USAGE_PAGE_N(HID_USAGE_PAGE_VENDOR, 2),
    HID_USAGE(0x20),
    HID_LOGICAL_MIN(0x00),
    HID_LOGICAL_MAX_N(0xff, 2),
    HID_REPORT_SIZE(8),
    HID_REPORT_COUNT(1),
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // Hat plus 15 native buttons: common-body byte 7 through the low three
    // bits of byte 9. Values 0..7 are directions and 8 is the HID
    // null/centred state.
    HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
    HID_USAGE(HID_USAGE_DESKTOP_HAT_SWITCH),
    HID_LOGICAL_MIN(0),
    HID_LOGICAL_MAX(7),
    HID_PHYSICAL_MIN(0),
    HID_PHYSICAL_MAX_N(315, 2),
    HID_REPORT_SIZE(4),
    HID_REPORT_COUNT(1),
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE | HID_NULL_STATE),
    HID_USAGE_PAGE(HID_USAGE_PAGE_BUTTON),
    HID_USAGE_MIN(1),
    HID_USAGE_MAX(15),
    HID_LOGICAL_MIN(0),
    HID_LOGICAL_MAX(1),
    HID_PHYSICAL_MIN(0),
    HID_PHYSICAL_MAX(1),
    HID_REPORT_SIZE(1),
    HID_REPORT_COUNT(15),
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // The high five bits of byte 9 and byte 10 are Sony's 13-bit vendor
    // field. Keeping it distinct prevents five phantom generic-HID buttons.
    HID_USAGE_PAGE_N(HID_USAGE_PAGE_VENDOR, 2),
    HID_USAGE(0x21),
    HID_REPORT_SIZE(1),
    HID_REPORT_COUNT(13),
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // Common-body bytes 11..62, including sensors, touch and status.
    HID_USAGE(0x22),
    HID_LOGICAL_MIN(0x00),
    HID_LOGICAL_MAX_N(0xff, 2),
    HID_PHYSICAL_MIN(0x00),
    HID_PHYSICAL_MAX_N(0xff, 2),
    HID_REPORT_SIZE(8),
    HID_REPORT_COUNT(kBridgeOpaqueInputBytes),
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // Fixed 47-byte controller output body on the dedicated OUT endpoint.
    HID_REPORT_ID(miralink::dualsense::kUsbOutputReportId)
    HID_USAGE(0x23),
    HID_REPORT_SIZE(8),
    HID_REPORT_COUNT(kBridgeOutputPayloadBytes),
    HID_OUTPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // Reports required by the Linux hid-playstation probe. Counts exclude
    // the report ID: wire lengths are respectively 41, 20 and 64 bytes.
    HID_REPORT_ID(miralink::usb_identity::kCalibrationFeatureReport)
    HID_USAGE(0x33),
    HID_REPORT_COUNT(kCalibrationFeaturePayloadBytes),
    HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
    HID_REPORT_ID(miralink::usb_identity::kPairingFeatureReport)
    HID_USAGE(0x24),
    HID_REPORT_COUNT(kPairingFeaturePayloadBytes),
    HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
    HID_REPORT_ID(miralink::usb_identity::kFirmwareFeatureReport)
    HID_USAGE(0x26),
    HID_REPORT_COUNT(kFirmwareFeaturePayloadBytes),
    HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

    // Keep MiraLink maintenance traffic inside the Gamepad application
    // collection. Windows creates one game-controller device per top-level
    // application collection, so making this a sibling of Gamepad would
    // expose a second, inert DualSense in joy.cpl. Report IDs keep the nested
    // vendor traffic unambiguous on the shared interface and endpoints.
    HID_USAGE_PAGE_N(HID_USAGE_PAGE_VENDOR, 2),
    HID_USAGE(0x01),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
    MIRALINK_FEATURE_REPORT(kControlReportCommand, 0x02)
    MIRALINK_FEATURE_REPORT(kControlReportResponse, 0x03)
    HID_COLLECTION_END,
    HID_COLLECTION_END
};

// Parse the generated short-item stream at compile time. This keeps the
// TinyUSB-facing descriptor contract under test even though the descriptor
// source is built only for the Pico target.
constexpr std::size_t hid_short_item_size(const std::uint8_t prefix) {
    const auto encoded = static_cast<std::size_t>(prefix & 0x03u);
    return encoded == 3 ? 4 : encoded;
}

constexpr std::uint32_t hid_item_value(const std::size_t offset,
    const std::size_t size) {
    std::uint32_t value = 0;
    for (std::size_t index = 0; index < size; ++index) {
        value |= static_cast<std::uint32_t>(kBridgeReportDescriptor[offset + index])
            << (index * 8u);
    }
    return value;
}

constexpr std::uint32_t hid_report_bits(const std::uint8_t wanted_report_id,
    const std::uint8_t wanted_main_tag) {
    std::uint32_t report_size = 0;
    std::uint32_t report_count = 0;
    std::uint8_t report_id = 0;
    std::uint32_t bits = 0;
    for (std::size_t offset = 0; offset < sizeof(kBridgeReportDescriptor);) {
        const auto prefix = kBridgeReportDescriptor[offset++];
        if (prefix == 0xfeu) {
            if (offset + 1 >= sizeof(kBridgeReportDescriptor)) return 0;
            const auto long_size = kBridgeReportDescriptor[offset];
            offset += 2 + long_size;
            continue;
        }
        const auto data_size = hid_short_item_size(prefix);
        if (offset + data_size > sizeof(kBridgeReportDescriptor)) return 0;
        const auto value = hid_item_value(offset, data_size);
        const auto type = static_cast<std::uint8_t>((prefix >> 2u) & 0x03u);
        const auto tag = static_cast<std::uint8_t>((prefix >> 4u) & 0x0fu);
        if (type == 1u && tag == 7u) report_size = value;
        else if (type == 1u && tag == 8u) report_id = static_cast<std::uint8_t>(value);
        else if (type == 1u && tag == 9u) report_count = value;
        else if (type == 0u && tag == wanted_main_tag && report_id == wanted_report_id) {
            bits += report_size * report_count;
        }
        offset += data_size;
    }
    return bits;
}

struct HidCollectionSummary {
    std::size_t top_level_collections = 0;
    std::size_t top_level_application_collections = 0;
    std::size_t top_level_gamepad_collections = 0;
    std::size_t nested_vendor_application_collections = 0;
    std::size_t vendor_command_features = 0;
    std::size_t vendor_response_features = 0;
    bool balanced = true;
};

// Windows enumerates each root Application collection as a separate HID
// top-level collection. Parse the generated byte stream so a later descriptor
// edit cannot silently bring back the duplicate controller seen with 0.36.
constexpr HidCollectionSummary hid_collection_summary() {
    constexpr std::uint8_t kMainType = 0;
    constexpr std::uint8_t kGlobalType = 1;
    constexpr std::uint8_t kLocalType = 2;
    constexpr std::uint8_t kUsageTag = 0;
    constexpr std::uint8_t kUsagePageTag = 0;
    constexpr std::uint8_t kReportIdTag = 8;
    constexpr std::uint8_t kCollectionTag = 10;
    constexpr std::uint8_t kFeatureTag = 11;
    constexpr std::uint8_t kEndCollectionTag = 12;

    HidCollectionSummary summary{};
    std::uint32_t usage_page = 0;
    std::uint32_t local_usage = 0;
    std::uint8_t report_id = 0;
    std::size_t collection_depth = 0;
    std::size_t nested_vendor_depth = 0;

    for (std::size_t offset = 0; offset < sizeof(kBridgeReportDescriptor);) {
        const auto prefix = kBridgeReportDescriptor[offset++];
        if (prefix == 0xfeu) {
            if (offset + 1 >= sizeof(kBridgeReportDescriptor)) {
                summary.balanced = false;
                return summary;
            }
            const auto long_size = kBridgeReportDescriptor[offset];
            offset += 2 + long_size;
            if (offset > sizeof(kBridgeReportDescriptor)) {
                summary.balanced = false;
                return summary;
            }
            continue;
        }

        const auto data_size = hid_short_item_size(prefix);
        if (offset + data_size > sizeof(kBridgeReportDescriptor)) {
            summary.balanced = false;
            return summary;
        }
        const auto value = hid_item_value(offset, data_size);
        const auto type = static_cast<std::uint8_t>((prefix >> 2u) & 0x03u);
        const auto tag = static_cast<std::uint8_t>((prefix >> 4u) & 0x0fu);

        if (type == kGlobalType && tag == kUsagePageTag) {
            usage_page = value;
        } else if (type == kGlobalType && tag == kReportIdTag) {
            report_id = static_cast<std::uint8_t>(value);
        } else if (type == kLocalType && tag == kUsageTag) {
            local_usage = value;
        } else if (type == kMainType && tag == kCollectionTag) {
            if (collection_depth == 0) {
                ++summary.top_level_collections;
                if (value == HID_COLLECTION_APPLICATION) {
                    ++summary.top_level_application_collections;
                    if (usage_page == HID_USAGE_PAGE_DESKTOP
                        && local_usage == HID_USAGE_DESKTOP_GAMEPAD) {
                        ++summary.top_level_gamepad_collections;
                    }
                }
            } else if (collection_depth == 1
                && value == HID_COLLECTION_APPLICATION
                && usage_page == HID_USAGE_PAGE_VENDOR
                && local_usage == 0x01u) {
                ++summary.nested_vendor_application_collections;
                nested_vendor_depth = collection_depth + 1;
            }
            ++collection_depth;
        } else if (type == kMainType && tag == kFeatureTag
            && collection_depth == nested_vendor_depth) {
            if (report_id == kControlReportCommand) {
                ++summary.vendor_command_features;
            } else if (report_id == kControlReportResponse) {
                ++summary.vendor_response_features;
            }
        } else if (type == kMainType && tag == kEndCollectionTag) {
            if (collection_depth == 0) {
                summary.balanced = false;
                return summary;
            }
            if (collection_depth == nested_vendor_depth) nested_vendor_depth = 0;
            --collection_depth;
        }

        // Local HID state is cleared after every main item.
        if (type == kMainType) local_usage = 0;
        offset += data_size;
    }

    summary.balanced = summary.balanced && collection_depth == 0;
    return summary;
}

constexpr std::uint8_t kHidInputItemTag = 8;
constexpr std::uint8_t kHidOutputItemTag = 9;
constexpr std::uint8_t kHidFeatureItemTag = 11;
constexpr auto kHidCollections = hid_collection_summary();
static_assert(kHidCollections.balanced);
static_assert(kHidCollections.top_level_collections == 1);
static_assert(kHidCollections.top_level_application_collections == 1);
static_assert(kHidCollections.top_level_gamepad_collections == 1);
static_assert(kHidCollections.nested_vendor_application_collections == 1);
static_assert(kHidCollections.vendor_command_features == 1);
static_assert(kHidCollections.vendor_response_features == 1);
static_assert(hid_report_bits(miralink::dualsense::kUsbInputReportId, kHidInputItemTag)
    == kBridgeInputPayloadBytes * 8u);
static_assert(hid_report_bits(miralink::dualsense::kUsbOutputReportId, kHidOutputItemTag)
    == kBridgeOutputPayloadBytes * 8u);
static_assert(hid_report_bits(miralink::usb_identity::kCalibrationFeatureReport, kHidFeatureItemTag)
    == kCalibrationFeaturePayloadBytes * 8u);
static_assert(hid_report_bits(miralink::usb_identity::kPairingFeatureReport, kHidFeatureItemTag)
    == kPairingFeaturePayloadBytes * 8u);
static_assert(hid_report_bits(miralink::usb_identity::kFirmwareFeatureReport, kHidFeatureItemTag)
    == kFirmwareFeaturePayloadBytes * 8u);
static_assert(hid_report_bits(kControlReportCommand, kHidFeatureItemTag) == 64u * 8u);
static_assert(hid_report_bits(kControlReportResponse, kHidFeatureItemTag) == 64u * 8u);
static_assert(hid_report_bits(miralink::usb_identity::kControlReportEvent, kHidInputItemTag) == 0);

#undef MIRALINK_FEATURE_REPORT
} // namespace

extern "C" {

tusb_desc_device_t desc_device = {
    .bLength = sizeof(tusb_desc_device_t),
    .bDescriptorType = TUSB_DESC_DEVICE,
    .bcdUSB = 0x0200,
    .bDeviceClass = 0x00,
    .bDeviceSubClass = 0x00,
    .bDeviceProtocol = 0x00,
    .bMaxPacketSize0 = CFG_TUD_ENDPOINT0_SIZE,
    .idVendor = miralink::usb_identity::kSonyVendorId,
    .idProduct = miralink::usb_identity::kDualSenseProductId,
    .bcdDevice = static_cast<std::uint16_t>(
        ((MIRALINK_VERSION_MAJOR % 10) << 8)
        | ((MIRALINK_VERSION_MINOR / 10) << 4)
        | (MIRALINK_VERSION_MINOR % 10)),
    .iManufacturer = 0x01,
    .iProduct = 0x02,
    .iSerialNumber = 0x00,
    .bNumConfigurations = 0x01
};

uint8_t const* tud_descriptor_device_cb(void) {
    desc_device.idProduct = miralink::usb_identity::g_selected_product_id;
    desc_device.iSerialNumber = miralink::usb_identity::unique_serial_enabled() ? 0x03 : 0x00;
    return reinterpret_cast<uint8_t const*>(&desc_device);
}

uint8_t const* tud_hid_descriptor_report_cb(uint8_t instance) {
    return instance == kBridgeHidInstance ? kBridgeReportDescriptor : nullptr;
}

enum {
    kStringLanguage = 0,
    kStringManufacturer = 1,
    kStringProduct = 2,
    kStringSerial = 3,
    kStringControlInterface = 4
};

#define MIRALINK_CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_HID_INOUT_DESC_LEN)

uint8_t const desc_configuration[] = {
    TUD_CONFIG_DESCRIPTOR(1, 1, 0, MIRALINK_CONFIG_TOTAL_LEN, TUSB_DESC_CONFIG_ATT_REMOTE_WAKEUP, 100),
    TUD_HID_INOUT_DESCRIPTOR(kInterfaceNumber, kStringControlInterface, HID_ITF_PROTOCOL_NONE,
        sizeof(kBridgeReportDescriptor), kBridgeEndpointOut, kBridgeEndpointIn, 64, 1)
};

static_assert(sizeof(desc_configuration) == MIRALINK_CONFIG_TOTAL_LEN,
    "MiraLink single-interface HID configuration descriptor length must remain exact");
static_assert(kInterfaceNumber + 1 == CFG_TUD_HID);

#undef MIRALINK_CONFIG_TOTAL_LEN

uint8_t const* tud_descriptor_configuration_cb(uint8_t index) {
    (void)index;
    return desc_configuration;
}

char const* const kStringDescriptors[] = {
    "\x09\x04",
    "Sony Interactive Entertainment",
    nullptr,
    nullptr,
    "MiraLink Control"
};

static uint16_t kStringBuffer[63 + 1];

uint16_t const* tud_descriptor_string_cb(uint8_t index, uint16_t langid) {
    (void)langid;
    std::size_t count = 0;
    if (index == kStringLanguage) {
        std::memcpy(&kStringBuffer[1], kStringDescriptors[0], 2);
        count = 1;
    } else if (index == kStringProduct) {
        const char* source = miralink::usb_identity::g_selected_product_id
                == miralink::usb_identity::kDualSenseEdgeProductId
            ? "DualSense Edge Wireless Controller"
            : "DualSense Wireless Controller";
        count = std::min<std::size_t>(std::strlen(source), 63);
        for (std::size_t i = 0; i < count; ++i) kStringBuffer[i + 1] = static_cast<uint16_t>(source[i]);
    } else if (index == kStringSerial) {
        if (!miralink::usb_identity::unique_serial_enabled()) return nullptr;
        char serial[33] = {};
        pico_get_unique_board_id_string(serial, sizeof(serial));
        count = std::min<std::size_t>(std::strlen(serial), 32);
        for (std::size_t i = 0; i < count; ++i) kStringBuffer[i + 1] = static_cast<uint16_t>(serial[i]);
    } else {
        if (index >= (sizeof(kStringDescriptors) / sizeof(kStringDescriptors[0])) || kStringDescriptors[index] == nullptr) return nullptr;
        const char* source = kStringDescriptors[index];
        count = std::min<std::size_t>(std::strlen(source), 63);
        for (std::size_t i = 0; i < count; ++i) kStringBuffer[i + 1] = static_cast<uint16_t>(source[i]);
    }
    kStringBuffer[0] = static_cast<uint16_t>((TUSB_DESC_STRING << 8) | (2 * count + 2));
    return kStringBuffer;
}

}
