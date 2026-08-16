cmake_minimum_required(VERSION 3.20)

if (NOT PICO_SDK_PATH)
    message(FATAL_ERROR "PICO_SDK_PATH must point to the official Raspberry Pi Pico SDK")
endif()

include(${PICO_SDK_PATH}/external/pico_sdk_import.cmake)

project(miralink_pico_firmware VERSION 0.60.0 LANGUAGES C CXX ASM)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)
set(CMAKE_CXX_EXTENSIONS ON)

pico_sdk_init()

# BTstack 075a078 queues HID interrupt reports asynchronously while retaining
# the caller's buffer pointer. Its public API otherwise accepts another report
# while the first one is still waiting for L2CAP_EVENT_CAN_SEND_NOW, which can
# replace that pointer before it is consumed. Keep the SDK checkout pristine
# and replace only hid_host.c in the interface target with a verified build-dir
# copy whose send-report entry point accepts the established state exclusively.
set(MIRALINK_BTSTACK_HID_HOST_SOURCE
    "${PICO_BTSTACK_PATH}/src/classic/hid_host.c")
set(MIRALINK_BTSTACK_HID_HOST_SHA256
    "696d1481221359d42f71e57910409f5a646458e5f8a84b104f6cbbff4a78af7c")
file(READ "${MIRALINK_BTSTACK_HID_HOST_SOURCE}"
    MIRALINK_BTSTACK_HID_HOST_CONTENT)
# Hash normalized LF content so the same upstream Git blob is accepted on
# Windows and Unix checkouts without weakening the source-version lock.
string(REPLACE "\r\n" "\n" MIRALINK_BTSTACK_HID_HOST_CONTENT
    "${MIRALINK_BTSTACK_HID_HOST_CONTENT}")
string(SHA256 MIRALINK_BTSTACK_HID_HOST_ACTUAL_SHA256
    "${MIRALINK_BTSTACK_HID_HOST_CONTENT}")
if (NOT MIRALINK_BTSTACK_HID_HOST_ACTUAL_SHA256 STREQUAL
    MIRALINK_BTSTACK_HID_HOST_SHA256)
    message(FATAL_ERROR
        "Unsupported BTstack hid_host.c SHA-256: "
        "${MIRALINK_BTSTACK_HID_HOST_ACTUAL_SHA256}; expected Pico SDK 2.3.0 "
        "BTstack 075a078 source ${MIRALINK_BTSTACK_HID_HOST_SHA256}")
endif()
set(MIRALINK_BTSTACK_SEND_GUARD_OLD
    "connection->state < HID_HOST_CONNECTION_ESTABLISHED")
set(MIRALINK_BTSTACK_SEND_GUARD_NEW
    "connection->state != HID_HOST_CONNECTION_ESTABLISHED")
string(REGEX MATCHALL "${MIRALINK_BTSTACK_SEND_GUARD_OLD}"
    MIRALINK_BTSTACK_SEND_GUARD_MATCHES
    "${MIRALINK_BTSTACK_HID_HOST_CONTENT}")
list(LENGTH MIRALINK_BTSTACK_SEND_GUARD_MATCHES
    MIRALINK_BTSTACK_SEND_GUARD_MATCH_COUNT)
if (NOT MIRALINK_BTSTACK_SEND_GUARD_MATCH_COUNT EQUAL 1)
    message(FATAL_ERROR
        "Unsupported BTstack hid_host.c: expected exactly one asynchronous "
        "send-report state guard, found ${MIRALINK_BTSTACK_SEND_GUARD_MATCH_COUNT}")
endif()
string(REPLACE "${MIRALINK_BTSTACK_SEND_GUARD_OLD}"
    "${MIRALINK_BTSTACK_SEND_GUARD_NEW}"
    MIRALINK_BTSTACK_HID_HOST_PATCHED
    "${MIRALINK_BTSTACK_HID_HOST_CONTENT}")
string(APPEND MIRALINK_BTSTACK_HID_HOST_PATCHED [=[

/* MiraLink extension for recovering a bounded GET_REPORT timeout. */
uint8_t miralink_btstack_hid_host_abort_get_report(uint16_t hid_cid){
    hid_host_connection_t * connection = hid_host_get_connection_for_hid_cid(hid_cid);
    if (!connection || !connection->control_cid){
        return ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER;
    }
    if (connection->state != HID_HOST_W2_SEND_GET_REPORT
        && connection->state != HID_HOST_W4_GET_REPORT_RESPONSE){
        return ERROR_CODE_COMMAND_DISALLOWED;
    }
    connection->state = HID_HOST_CONNECTION_ESTABLISHED;
    return ERROR_CODE_SUCCESS;
}

/* MiraLink extension for retiring an HID host slot after ACL teardown. */
uint8_t miralink_btstack_hid_host_abort_connection(uint16_t hid_cid){
    hid_host_connection_t * connection = hid_host_get_connection_for_hid_cid(hid_cid);
    if (!connection) {
        return ERROR_CODE_UNKNOWN_CONNECTION_IDENTIFIER;
    }
    if (hid_host_sdp_context_control_cid == hid_cid) {
        hid_host_sdp_context_control_cid = 0;
    }
    // HCI has already confirmed that the ACL is gone. Finalize regardless of
    // whether L2CAP delivered its close event; hid_host_finalize_connection()
    // disconnects any still-recorded channels before releasing the slot.
    hid_host_finalize_connection(connection);
    return ERROR_CODE_SUCCESS;
}
]=])
set(MIRALINK_BTSTACK_PATCH_DIR
    "${CMAKE_CURRENT_BINARY_DIR}/generated/btstack")
set(MIRALINK_BTSTACK_HID_HOST_PATCHED_SOURCE
    "${MIRALINK_BTSTACK_PATCH_DIR}/hid_host.c")
file(MAKE_DIRECTORY "${MIRALINK_BTSTACK_PATCH_DIR}")
file(WRITE "${MIRALINK_BTSTACK_HID_HOST_PATCHED_SOURCE}"
    "${MIRALINK_BTSTACK_HID_HOST_PATCHED}")

get_target_property(MIRALINK_BTSTACK_CLASSIC_SOURCES
    pico_btstack_classic INTERFACE_SOURCES)
list(LENGTH MIRALINK_BTSTACK_CLASSIC_SOURCES
    MIRALINK_BTSTACK_CLASSIC_SOURCE_COUNT_BEFORE)
list(REMOVE_ITEM MIRALINK_BTSTACK_CLASSIC_SOURCES
    "${MIRALINK_BTSTACK_HID_HOST_SOURCE}")
list(LENGTH MIRALINK_BTSTACK_CLASSIC_SOURCES
    MIRALINK_BTSTACK_CLASSIC_SOURCE_COUNT_AFTER)
math(EXPR MIRALINK_BTSTACK_HID_HOST_REMOVED_COUNT
    "${MIRALINK_BTSTACK_CLASSIC_SOURCE_COUNT_BEFORE} - ${MIRALINK_BTSTACK_CLASSIC_SOURCE_COUNT_AFTER}")
if (NOT MIRALINK_BTSTACK_HID_HOST_REMOVED_COUNT EQUAL 1)
    message(FATAL_ERROR
        "Unable to replace BTstack hid_host.c in pico_btstack_classic; "
        "removed ${MIRALINK_BTSTACK_HID_HOST_REMOVED_COUNT} source entries")
endif()
set_property(TARGET pico_btstack_classic PROPERTY INTERFACE_SOURCES
    "${MIRALINK_BTSTACK_CLASSIC_SOURCES}")
target_sources(pico_btstack_classic INTERFACE
    "${MIRALINK_BTSTACK_HID_HOST_PATCHED_SOURCE}")

# USB Audio is disabled in the shipped persona until its UAC descriptors and
# host behavior are validated on real hardware. Keeping the codec backend as
# a separate explicit option makes the cost visible: the default image does
# not compile/link dormant Opus code, while codec-only experiments can opt in
# without pretending that a UAC descriptor is ready.
option(MIRALINK_AUDIO_BACKEND_ENABLED "Build the experimental Opus backend (USB Audio remains disabled)" OFF)

# MiraLink uses the standard Opus encoder for the DualSense audio HID packet
# only when the experimental USB Audio path is enabled. The codec is vendored
# under firmware/third_party so a clean local checkout does not need a network
# fetch during the build.
set(OPUS_BUILD_SHARED_LIBRARY OFF CACHE BOOL "" FORCE)
set(OPUS_BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(OPUS_BUILD_PROGRAMS OFF CACHE BOOL "" FORCE)
set(OPUS_CUSTOM_MODES OFF CACHE BOOL "" FORCE)
set(OPUS_DISABLE_INTRINSICS ON CACHE BOOL "" FORCE)
set(OPUS_FIXED_POINT OFF CACHE BOOL "" FORCE)
set(OPUS_ENABLE_FLOAT_API ON CACHE BOOL "" FORCE)
set(OPUS_HARDENING OFF CACHE BOOL "" FORCE)
set(OPUS_FORTIFY_SOURCE OFF CACHE BOOL "" FORCE)
set(OPUS_STACK_PROTECTOR OFF CACHE BOOL "" FORCE)
set(OPUS_VAR_ARRAYS ON CACHE BOOL "" FORCE)
set(OPUS_INSTALL_PKG_CONFIG_MODULE OFF CACHE BOOL "" FORCE)
set(OPUS_INSTALL_CMAKE_CONFIG_MODULE OFF CACHE BOOL "" FORCE)
if(MIRALINK_AUDIO_BACKEND_ENABLED)
    add_subdirectory(../third_party/opus opus-build EXCLUDE_FROM_ALL)
endif()

add_executable(miralink_pico_firmware
    src/main.cpp
    src/miralink_bootsel.cpp
    src/usb_descriptors.cpp
    src/miralink_audio.cpp
    src/miralink_bluetooth.cpp
    ../src/miralink_protocol.cpp
    ../src/miralink_config.cpp
    ../src/miralink_config_store.cpp
    ../src/miralink_dualsense.cpp
)

target_include_directories(miralink_pico_firmware PRIVATE
    ../include
    include
)

target_compile_definitions(miralink_pico_firmware PRIVATE
    CFG_TUD_HID=1
    CFG_TUD_AUDIO=0
    MIRALINK_AUDIO_BACKEND_ENABLED=$<BOOL:${MIRALINK_AUDIO_BACKEND_ENABLED}>
    CFG_TUD_HID_EP_BUFSIZE=65
    CFG_TUD_ENDPOINT0_SIZE=64
    MIRALINK_VERSION_MAJOR=${PROJECT_VERSION_MAJOR}
    MIRALINK_VERSION_MINOR=${PROJECT_VERSION_MINOR}
    MIRALINK_VERSION_PATCH=${PROJECT_VERSION_PATCH}
    CYW43_LWIP=0
    ENABLE_CLASSIC=1
)

target_compile_options(miralink_pico_firmware PRIVATE -Wall -Wextra -Wpedantic)

target_link_libraries(miralink_pico_firmware PRIVATE
    pico_stdlib
    pico_unique_id
    pico_rand
    pico_flash
    tinyusb_device
    tinyusb_board
    pico_cyw43_arch_poll
    pico_btstack_cyw43
    pico_btstack_classic
)

if(MIRALINK_AUDIO_BACKEND_ENABLED)
    target_link_libraries(miralink_pico_firmware PRIVATE opus)
endif()

pico_set_program_name(miralink_pico_firmware "MiraLink Pico 2 W")
pico_set_program_version(miralink_pico_firmware "0.60")
pico_enable_stdio_uart(miralink_pico_firmware 0)
pico_enable_stdio_usb(miralink_pico_firmware 0)
pico_add_extra_outputs(miralink_pico_firmware)
