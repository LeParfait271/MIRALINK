/*
 * MiraLink BOOTSEL gesture adapter.
 *
 * The low-level RP2040/RP2350 BOOTSEL sampling and gesture timing are
 * adapted from awalol/DS5Dongle v0.7.2-hotfix, src/button_functions.cpp.
 * That repository is MIT-licensed; the required notice is recorded in
 * firmware/THIRD_PARTY_NOTICES.md. MiraLink-specific dispatch and pairing
 * state handling are original to this project.
 */

#include "miralink_bootsel.h"

#include "miralink_bluetooth.h"

#include <cstdint>
#include <cstdio>

#include "hardware/gpio.h"
#include "hardware/structs/ioqspi.h"
#include "hardware/structs/sio.h"
#include "hardware/sync.h"
#include "pico/bootrom.h"
#include "pico/flash.h"
#include "pico/time.h"

namespace miralink::bootsel {
namespace {

// The button is sampled at 10 Hz. A long press is intentionally longer than
// a normal click so that erasing bonds cannot happen accidentally.
constexpr int kHoldSamples = 15;
constexpr int kClickWindowSamples = 5;

enum class ButtonState : std::uint8_t {
    Idle,
    Pressing,
    Held,
    WaitingForNextClick,
};

ButtonState g_state = ButtonState::Idle;
int g_press_samples = 0;
int g_wait_samples = 0;
int g_click_count = 0;
std::uint32_t g_last_check_ms = 0;

// This callback follows the Pico SDK's BOOTSEL sampling contract: briefly
// override QSPI CSn, sample it, then restore the normal override. It must run
// under flash_safe_execute so no other core fetches XIP during the sample.
static void __no_inline_not_in_flash_func(read_bootsel_callback)(void* context) {
    auto* pressed = static_cast<bool*>(context);
    constexpr std::uint32_t kCsPinIndex = 1;

    hw_write_masked(&ioqspi_hw->io[kCsPinIndex].ctrl,
        GPIO_OVERRIDE_LOW << IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_LSB,
        IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_BITS);
    volatile std::uint32_t delay = 0;
    while (delay < 1000u) delay = delay + 1u;

#if PICO_RP2350
    *pressed = !(sio_hw->gpio_hi_in & SIO_GPIO_HI_IN_QSPI_CSN_BITS);
#else
    *pressed = !(sio_hw->gpio_hi_in & (1u << kCsPinIndex));
#endif

    hw_write_masked(&ioqspi_hw->io[kCsPinIndex].ctrl,
        GPIO_OVERRIDE_NORMAL << IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_LSB,
        IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_BITS);
}

bool read_bootsel() {
    bool pressed = false;
    // The timeout keeps a damaged/absent flash coordination path fail-safe:
    // a read failure is treated as "not pressed", never as an erase request.
    return flash_safe_execute(read_bootsel_callback, &pressed, 100) == PICO_OK
        && pressed;
}

void dispatch_clicks(const int clicks) {
    if (clicks <= 1) {
        // Single click is the offline equivalent of the web pairing action.
        const bool opened = miralink::bluetooth::open_pairing_window();
        printf("[BTN] BOOTSEL single click - pairing window %s\n",
            opened ? "opened" : "unavailable");
        return;
    }

    if (clicks == 2) {
        // A warm reset returns to the application. A watchdog reset can enter
        // the RP2350 bootrom unexpectedly, so use SYSRESETREQ for this gesture.
        printf("[BTN] BOOTSEL double click - reboot\n");
        *reinterpret_cast<volatile std::uint32_t*>(0xe000ed0c) = 0x05fa0004;
        __dsb();
        while (true) tight_loop_contents();
    }

    // Triple click is deliberately separate from long-press bond erasure:
    // it enters BOOTSEL mass-storage mode for reflashing.
    printf("[BTN] BOOTSEL triple click - reboot to BOOTSEL\n");
    reset_usb_boot(0, 0);
}

void dispatch_hold() {
    printf("[BTN] BOOTSEL held - clearing all pairings\n");
    if (!miralink::bluetooth::forget_all_pairings()) {
        printf("[BTN] Pairing store unavailable; nothing erased\n");
        return;
    }
    // Start a fresh local pairing window so the user does not need the web
    // application or an Internet connection after intentionally clearing it.
    (void)miralink::bluetooth::open_pairing_window();
}

} // namespace

void poll() {
    const auto now = to_ms_since_boot(get_absolute_time());
    if (now - g_last_check_ms < 100) return;
    g_last_check_ms = now;

    const bool pressed = read_bootsel();
    switch (g_state) {
        case ButtonState::Idle:
            if (pressed) {
                g_state = ButtonState::Pressing;
                g_press_samples = 1;
            }
            break;

        case ButtonState::Pressing:
            if (pressed) {
                if (++g_press_samples >= kHoldSamples) {
                    g_click_count = 0;
                    g_state = ButtonState::Held;
                    dispatch_hold();
                }
            } else {
                ++g_click_count;
                g_state = ButtonState::WaitingForNextClick;
                g_wait_samples = 0;
            }
            break;

        case ButtonState::Held:
            if (!pressed) {
                g_state = ButtonState::Idle;
                g_press_samples = 0;
            }
            break;

        case ButtonState::WaitingForNextClick:
            if (pressed) {
                g_state = ButtonState::Pressing;
                g_press_samples = 1;
            } else if (++g_wait_samples >= kClickWindowSamples) {
                const auto clicks = g_click_count;
                g_click_count = 0;
                g_state = ButtonState::Idle;
                g_press_samples = 0;
                dispatch_clicks(clicks);
            }
            break;
    }
}

} // namespace miralink::bootsel
