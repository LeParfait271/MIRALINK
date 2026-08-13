#pragma once

// MiraLink's local BTstack configuration for the Pico 2 W Classic HID host.
// It is intentionally limited to one controller and no network services.
#define ENABLE_LOG_INFO
#define ENABLE_LOG_ERROR
#define ENABLE_PRINTF_HEXDUMP
#define ENABLE_L2CAP_ENHANCED_RETRANSMISSION_MODE

#define HCI_OUTGOING_PRE_BUFFER_SIZE 4
#define HCI_ACL_PAYLOAD_SIZE (1691 + 4)
#define HCI_ACL_CHUNK_SIZE_ALIGNMENT 4
#define MAX_NR_HCI_CONNECTIONS 2
#define MAX_NR_HID_HOST_CONNECTIONS 1
#define MAX_NR_L2CAP_CHANNELS 8
#define MAX_NR_L2CAP_SERVICES 6
#define MAX_NR_SERVICE_RECORD_ITEMS 12
#define MAX_NR_BTSTACK_LINK_KEY_DB_MEMORY_ENTRIES 2

// Keep the radio buffers bounded for the Pico 2 W shared CYW43 transport.
#define MAX_NR_CONTROLLER_ACL_BUFFERS 3
#define ENABLE_HCI_CONTROLLER_TO_HOST_FLOW_CONTROL
#define HCI_HOST_ACL_PACKET_LEN 1024
#define HCI_HOST_ACL_PACKET_NUM 3
#define HCI_HOST_SCO_PACKET_LEN 120
#define HCI_HOST_SCO_PACKET_NUM 3

// Keep the controller key budget bounded. The Pico SDK's BTstack CYW43
// integration stores these keys locally in its own flash bank; MiraLink never
// exports or synchronizes them. MiraLink configuration uses separate sectors.
#define NVM_NUM_LINK_KEYS 4

#define HAVE_EMBEDDED_TIME_MS
#define HAVE_ASSERT
#define ENABLE_SOFTWARE_AES128
