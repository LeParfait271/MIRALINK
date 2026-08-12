#include "miralink_usb_identity.h"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

#include "pico/unique_id.h"
#include "tusb.h"

namespace {
constexpr std::uint8_t kReportCommand = 0x01;
constexpr std::uint8_t kReportResponse = 0x02;
constexpr std::uint8_t kReportEvent = 0x03;
constexpr std::uint8_t kInterfaceNumber = 0;
constexpr std::uint8_t kEndpointIn = 0x81;

#define MIRALINK_FEATURE_REPORT(_id, _usage) \
    HID_REPORT_ID(_id) \
    HID_USAGE(_usage), \
    HID_LOGICAL_MIN(0x00), \
    HID_LOGICAL_MAX_N(0xff, 2), \
    HID_REPORT_SIZE(8), \
    HID_REPORT_COUNT(64), \
    HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

constexpr std::uint8_t kReportDescriptor[] = {
    HID_USAGE_PAGE_N(HID_USAGE_PAGE_VENDOR, 2),
    HID_USAGE(0x01),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
    MIRALINK_FEATURE_REPORT(kReportCommand, 0x02)
    MIRALINK_FEATURE_REPORT(kReportResponse, 0x03)
    MIRALINK_FEATURE_REPORT(kReportEvent, 0x04)
    HID_COLLECTION_END
};

#undef MIRALINK_FEATURE_REPORT
} // namespace

extern "C" {

tusb_desc_device_t const desc_device = {
    .bLength = sizeof(tusb_desc_device_t),
    .bDescriptorType = TUSB_DESC_DEVICE,
    .bcdUSB = 0x0200,
    .bDeviceClass = 0x00,
    .bDeviceSubClass = 0x00,
    .bDeviceProtocol = 0x00,
    .bMaxPacketSize0 = CFG_TUD_ENDPOINT0_SIZE,
    .idVendor = kMiraLinkUsbVendorId,
    .idProduct = kMiraLinkUsbProductId,
    .bcdDevice = 0x0100,
    .iManufacturer = 0x01,
    .iProduct = 0x02,
    .iSerialNumber = 0x03,
    .bNumConfigurations = 0x01
};

uint8_t const* tud_descriptor_device_cb(void) {
    return reinterpret_cast<uint8_t const*>(&desc_device);
}

uint8_t const* tud_hid_descriptor_report_cb(uint8_t instance) {
    (void)instance;
    return kReportDescriptor;
}

enum {
    kStringLanguage = 0,
    kStringManufacturer = 1,
    kStringProduct = 2,
    kStringSerial = 3
};

#define MIRALINK_CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_HID_DESC_LEN)

uint8_t const desc_configuration[] = {
    TUD_CONFIG_DESCRIPTOR(1, 1, 0, MIRALINK_CONFIG_TOTAL_LEN, 0x00, 100),
    TUD_HID_DESCRIPTOR(kInterfaceNumber, 0, HID_ITF_PROTOCOL_NONE, sizeof(kReportDescriptor), kEndpointIn, 64, 5)
};

uint8_t const* tud_descriptor_configuration_cb(uint8_t index) {
    (void)index;
    return desc_configuration;
}

char const* const kStringDescriptors[] = {
    "\x09\x04",
    "MaruChiwa",
    "MiraLink Pico 2 W",
    nullptr
};

static uint16_t kStringBuffer[32 + 1];

uint16_t const* tud_descriptor_string_cb(uint8_t index, uint16_t langid) {
    (void)langid;
    std::size_t count = 0;
    if (index == kStringLanguage) {
        std::memcpy(&kStringBuffer[1], kStringDescriptors[0], 2);
        count = 1;
    } else if (index == kStringSerial) {
        char serial[33] = {};
        pico_get_unique_board_id_string(serial, sizeof(serial));
        count = std::min<std::size_t>(std::strlen(serial), 32);
        for (std::size_t i = 0; i < count; ++i) kStringBuffer[i + 1] = static_cast<uint16_t>(serial[i]);
    } else {
        if (index >= (sizeof(kStringDescriptors) / sizeof(kStringDescriptors[0])) || kStringDescriptors[index] == nullptr) return nullptr;
        const char* source = kStringDescriptors[index];
        count = std::min<std::size_t>(std::strlen(source), 32);
        for (std::size_t i = 0; i < count; ++i) kStringBuffer[i + 1] = static_cast<uint16_t>(source[i]);
    }
    kStringBuffer[0] = static_cast<uint16_t>((TUSB_DESC_STRING << 8) | (2 * count + 2));
    return kStringBuffer;
}

}
