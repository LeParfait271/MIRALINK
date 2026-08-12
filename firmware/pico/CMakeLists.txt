cmake_minimum_required(VERSION 3.20)

if (NOT PICO_SDK_PATH)
    message(FATAL_ERROR "PICO_SDK_PATH must point to the official Raspberry Pi Pico SDK")
endif()

include(${PICO_SDK_PATH}/external/pico_sdk_import.cmake)

project(miralink_pico_firmware VERSION 1.1.0 LANGUAGES C CXX ASM)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)
set(CMAKE_CXX_EXTENSIONS ON)

pico_sdk_init()

add_executable(miralink_pico_firmware
    src/main.cpp
    src/usb_descriptors.cpp
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
    CFG_TUD_HID_EP_BUFSIZE=64
    CFG_TUD_ENDPOINT0_SIZE=64
    ENABLE_CLASSIC=1
)

target_compile_options(miralink_pico_firmware PRIVATE -Wall -Wextra -Wpedantic)

target_link_libraries(miralink_pico_firmware PRIVATE
    pico_stdlib
    pico_unique_id
    tinyusb_device
    tinyusb_board
    pico_cyw43_arch_none
    pico_btstack_cyw43
    pico_btstack_classic
)

pico_set_program_name(miralink_pico_firmware "MiraLink Pico 2 W")
pico_set_program_version(miralink_pico_firmware "1.1.0")
pico_enable_stdio_uart(miralink_pico_firmware 0)
pico_enable_stdio_usb(miralink_pico_firmware 0)
pico_add_extra_outputs(miralink_pico_firmware)
