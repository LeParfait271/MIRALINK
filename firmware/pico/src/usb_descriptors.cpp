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
constexpr std::uint8_t kReportGamepad = 0x10;
constexpr std::uint8_t kReportControllerOutput = 0x02;
constexpr std::uint8_t kAudioControlInterface = 0;
constexpr std::uint8_t kAudioStreamingInterface = 1;
constexpr std::uint8_t kInterfaceNumber = 2;
constexpr std::uint8_t kEndpointIn = 0x81;
constexpr std::uint8_t kAudioEndpointOut = 0x02;
constexpr std::size_t kAudioDescriptorBytes = 144;

#define MIRALINK_FEATURE_REPORT(_id, _usage) \
    HID_REPORT_ID(_id) \
    HID_USAGE(_usage), \
    HID_LOGICAL_MIN(0x00), \
    HID_LOGICAL_MAX_N(0xff, 2), \
    HID_REPORT_SIZE(8), \
    HID_REPORT_COUNT(64), \
    HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

#define MIRALINK_INPUT_REPORT(_id, _usage) \
    HID_REPORT_ID(_id) \
    HID_USAGE(_usage), \
    HID_LOGICAL_MIN(0x00), \
    HID_LOGICAL_MAX_N(0xff, 2), \
    HID_REPORT_SIZE(8), \
    HID_REPORT_COUNT(64), \
    HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

#define MIRALINK_OUTPUT_REPORT(_id, _usage, _count) \
    HID_REPORT_ID(_id) \
    HID_USAGE(_usage), \
    HID_LOGICAL_MIN(0x00), \
    HID_LOGICAL_MAX_N(0xff, 2), \
    HID_REPORT_SIZE(8), \
    HID_REPORT_COUNT(_count), \
    HID_OUTPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),

#define MIRALINK_AUDIO_DESCRIPTOR \
    TUD_AUDIO_DESC_IAD(kAudioControlInterface, 0x02, 0x00), \
    TUD_AUDIO_DESC_STD_AC(kAudioControlInterface, 0x00, 0x00), \
    TUD_AUDIO_DESC_CS_AC(0x0200, AUDIO_FUNC_DESKTOP_SPEAKER, TUD_AUDIO_DESC_CLK_SRC_LEN + TUD_AUDIO_DESC_INPUT_TERM_LEN + TUD_AUDIO_DESC_FEATURE_UNIT_FOUR_CHANNEL_LEN + TUD_AUDIO_DESC_OUTPUT_TERM_LEN, AUDIO_CS_AS_INTERFACE_CTRL_LATENCY_POS), \
    TUD_AUDIO_DESC_CLK_SRC(0x04, AUDIO_CLOCK_SOURCE_ATT_INT_PRO_CLK, (AUDIO_CTRL_RW << AUDIO_CLOCK_SOURCE_CTRL_CLK_FRQ_POS), 0x00, 0x00), \
    TUD_AUDIO_DESC_INPUT_TERM(0x01, AUDIO_TERM_TYPE_USB_STREAMING, 0x00, 0x04, 0x04, AUDIO_CHANNEL_CONFIG_NON_PREDEFINED, 0x00, 0x0000, 0x00), \
    TUD_AUDIO_DESC_FEATURE_UNIT_FOUR_CHANNEL(0x02, 0x01, (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_MUTE_POS) | (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_VOLUME_POS), (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_MUTE_POS) | (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_VOLUME_POS), (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_MUTE_POS) | (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_VOLUME_POS), (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_MUTE_POS) | (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_VOLUME_POS), (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_MUTE_POS) | (AUDIO_CTRL_RW << AUDIO_FEATURE_UNIT_CTRL_VOLUME_POS), 0x00), \
    TUD_AUDIO_DESC_OUTPUT_TERM(0x03, AUDIO_TERM_TYPE_OUT_DESKTOP_SPEAKER, 0x00, 0x02, 0x04, 0x0000, 0x00), \
    TUD_AUDIO_DESC_STD_AS_INT(kAudioStreamingInterface, 0x00, 0x00, 0x00), \
    TUD_AUDIO_DESC_STD_AS_INT(kAudioStreamingInterface, 0x01, 0x01, 0x00), \
    TUD_AUDIO_DESC_CS_AS_INT(0x01, AUDIO_CTRL_NONE, AUDIO_FORMAT_TYPE_I, AUDIO_DATA_FORMAT_TYPE_I_PCM, 0x04, AUDIO_CHANNEL_CONFIG_NON_PREDEFINED, 0x00), \
    TUD_AUDIO_DESC_TYPE_I_FORMAT(CFG_TUD_AUDIO_FUNC_1_N_BYTES_PER_SAMPLE_RX, CFG_TUD_AUDIO_FUNC_1_RESOLUTION_RX), \
    TUD_AUDIO_DESC_STD_AS_ISO_EP(kAudioEndpointOut, (std::uint8_t)(TUSB_XFER_ISOCHRONOUS | TUSB_ISO_EP_ATT_ADAPTIVE | TUSB_ISO_EP_ATT_DATA), CFG_TUD_AUDIO_FUNC_1_EP_OUT_SZ_MAX, 0x01), \
    TUD_AUDIO_DESC_CS_AS_ISO_EP(AUDIO_CS_AS_ISO_DATA_EP_ATT_NON_MAX_PACKETS_OK, AUDIO_CTRL_NONE, AUDIO_CS_AS_ISO_DATA_EP_LOCK_DELAY_UNIT_MILLISEC, 0x0001)

constexpr std::uint8_t kReportDescriptor[] = {
    HID_USAGE_PAGE_N(HID_USAGE_PAGE_VENDOR, 2),
    HID_USAGE(0x01),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
    MIRALINK_FEATURE_REPORT(kReportCommand, 0x02)
    MIRALINK_FEATURE_REPORT(kReportResponse, 0x03)
    MIRALINK_FEATURE_REPORT(kReportEvent, 0x04)
    MIRALINK_INPUT_REPORT(kReportEvent, 0x05)
    HID_COLLECTION_END,
    HID_USAGE_PAGE_N(HID_USAGE_PAGE_VENDOR, 2),
    HID_USAGE(0x06),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
    MIRALINK_OUTPUT_REPORT(kReportControllerOutput, 0x06, 47)
    HID_COLLECTION_END,
    TUD_HID_REPORT_DESC_GAMEPAD(HID_REPORT_ID(kReportGamepad))
};

#undef MIRALINK_FEATURE_REPORT
#undef MIRALINK_INPUT_REPORT
#undef MIRALINK_OUTPUT_REPORT
} // namespace

extern "C" {

tusb_desc_device_t const desc_device = {
    .bLength = sizeof(tusb_desc_device_t),
    .bDescriptorType = TUSB_DESC_DEVICE,
    .bcdUSB = 0x0200,
    .bDeviceClass = TUSB_CLASS_MISC,
    .bDeviceSubClass = MISC_SUBCLASS_COMMON,
    .bDeviceProtocol = MISC_PROTOCOL_IAD,
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

#define MIRALINK_CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + kAudioDescriptorBytes + TUD_HID_DESC_LEN)

uint8_t const desc_configuration[] = {
    TUD_CONFIG_DESCRIPTOR(1, 3, 0, MIRALINK_CONFIG_TOTAL_LEN, 0x00, 100),
    MIRALINK_AUDIO_DESCRIPTOR,
    TUD_HID_DESCRIPTOR(kInterfaceNumber, 0, HID_ITF_PROTOCOL_NONE, sizeof(kReportDescriptor), kEndpointIn, 64, 5)
};

#undef MIRALINK_AUDIO_DESCRIPTOR

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
