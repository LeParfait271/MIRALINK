#pragma once

namespace miralink::bootsel {

// Poll the physical BOOTSEL button and dispatch the offline gestures.
// The poller is internally rate-limited and is safe to call from the main
// foreground loop.
void poll();

} // namespace miralink::bootsel
