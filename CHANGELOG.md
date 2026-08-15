# Changelog

## 0.57 - 2026-08-16

- Match DS5Dongle's ACL admission policy: accept a Bluetooth gamepad request
  before relying on the RAM address cache; authentication and the strict HID
  descriptor/CRC boundary remain the security gates.
- Physical validation remains pending.

## 0.56 - 2026-08-16

- Reproduce the DS5Dongle passive reconnect boundary: explicitly accept a
  gamepad Classic ACL request, stop inquiry, and let authentication/encryption
  complete before the HID bootstrap.
- Keep non-gamepad/unknown ACL requests outside the active pairing policy and
  retain the strict enhanced-input trust boundary.
- Physical validation remains pending.

## 0.55 - 2026-08-15

- Gate the native Bluetooth activation report, Feature bootstrap and controller
  outputs until the active ACL reports encryption enabled.
- Handle encryption failure as a connection failure and return to the existing
  bounded passive-reconnect recovery path.
- Physical validation remains pending.

## 0.54 - 2026-08-15

- Re-arm a bounded tombstone teardown when the user explicitly opens pairing
  again after a stale HID/SDP connection outlives its first retry window.
- Keep the passive reconnect path unchanged; this is a recovery action, not a
  background reconnect loop. Physical validation remains pending.

## 0.53 - 2026-08-15

- Compared bonded inbound admission with the official DS5Dongle lifecycle.
- Request authentication for every completed ACL and admit an active inbound
  HID link while authentication and descriptor events are still in flight;
  the strict descriptor and CRC-valid `0x31` boundaries remain authoritative.
- This removes the reboot-time dependency on MiraLink's RAM address cache.
  Physical validation is intentionally still pending.

## 0.52 - 2026-08-15

- Compared the reconnect bootstrap against the official DS5Dongle
  `v0.7.2-hotfix` lifecycle.
- Send the neutral native Bluetooth state report `0x32` immediately after the
  HID report-mode handshake, before Feature GET requests, so a remembered
  DualSense can leave compact Bluetooth report mode after a PS-only wake.
- Keep Feature requests bounded and retry them after BTstack releases the
  interrupt send; no physical 0.52 validation is claimed yet.

## 0.51 - 2026-08-15

- Compared the failed PS-only reconnect with the official DS5Dongle
  `v0.7.2-hotfix` source before changing MiraLink.
- Re-arm interlaced page scan, connectability and discoverability immediately
  at `HCI_EVENT_DISCONNECTION_COMPLETE`, retaining the foreground re-arm as a
  bounded fallback for busy adapters.
- Send one neutral, CRC-protected native Bluetooth state report `0x32` after
  `SET_PROTOCOL` on every HID link, with three bounded attempts if BTstack is
  temporarily busy. This asks the controller to leave compact Bluetooth input
  mode before the existing Feature bootstrap.
- Keep the hardware score at `54.4%` until the physical PS-only reconnect
  matrix passes.

## 0.50 - 2026-08-15

- Replaced the single Bluetooth output slot with a bounded four-packet FIFO.
  Rapid haptic, lightbar, trigger and audio-output requests now remain ordered
  until BTstack accepts each packet, instead of silently dropping a replacement
  while the previous report is in flight.
- Compared the queueing boundary with DS5Dongle's bounded `send_fifo`; no
  physical Pico 2 W validation is claimed for 0.50.

## 0.49 - 2026-08-15

- Fixed the inactivity timer: continuous unchanged DualSense reports no longer
  keep an idle controller permanently active; button, stick, trigger and touch
  transitions still reset the timer.
- Bluetooth reconnect behavior is unchanged and remains pending fresh hardware
  evidence.

## 0.48 - 2026-08-15

- Re-enabled Bluetooth discoverability together with page scan after ACL/HID
  teardown, matching the official DS5Dongle reconnect lifecycle for bonded
  PS-only reconnection. The HID admission policy remains restricted to a
  remembered address outside an explicit pairing window.
- Compared the change against DS5Dongle v0.7.2-hotfix source. No board was
  flashed and no new physical validation is claimed for 0.48.

## 0.47 - 2026-08-15

- Compared DS5Dongle's authentication-failure path before changing MiraLink.
- Track the active ACL handle and address through HCI connection events.
- Drop a remembered Bluetooth key only when that exact controller fails
  authentication before a valid enhanced `0x31` input crosses the trust
  boundary; brand-new and already validated associations are preserved.
- Keep the hardware score at `54.4%` until a fresh manual reconnect and
  re-pair test passes.

## 0.46 - 2026-08-15

- Compared the failed 0.45 PS-only reconnect with the official DS5Dongle
  `v0.7.2-hotfix` lifecycle.
- Retire a stale BTstack HID/SDP host slot after authoritative ACL teardown,
  then rearm passive page scan from the foreground poll.
- Keep the hardware score at `54.4%` until a fresh manual reconnect test passes.

## 0.45 - 2026-08-15

- Made the official DS5Dongle `v0.7.2-hotfix` UF2 and source a mandatory
  read-only behavioral reference for every firmware diagnosis. Each firmware
  issue now records OBSERVED / INFERRED / PROVEN facts, a probable cause and a
  discriminating test before a correction is written.
- Compared the failed remembered reconnect with DS5Dongle and moved MiraLink's
  passive page-scan rearm trigger from the earlier HID close boundary to
  `HCI_EVENT_DISCONNECTION_COMPLETE`; BTstack writes still run only in the
  foreground poll.
- Kept discoverability disabled outside pairing, the binary protocol at `1`,
  the desktop-only scope, manual flashing and the DS5Dongle proven score at
  `54.4%` pending new physical evidence.
- Synchronized the public site, firmware metadata, documentation and release
  candidate to `0.45` / `0.45.0`.

## 0.42 - 2026-08-14

- Kept the passive remembered-controller policy and the 0.41 foreground
  page-scan rearm after a HID link closes.
- Fixed the local-idle resume path: a configuration commit no longer calls
  BTstack directly while TinyUSB dispatches the USB report. It now queues the
  same bounded page-scan rearm for the foreground Bluetooth poll.
- Added pure policy assertions for the HCI-working idle-resume transition.
- Kept the binary protocol at version `1`, the desktop-only scope, the manual
  flash boundary and the rule that no DS5Dongle score increases without new
  physical evidence. Firmware `0.42` remains a hardware-test candidate.

## 0.41 - 2026-08-14

- Recorded the manual `0.40` result: after a Pico restart, WebHID recovered
  the bridge and diagnostics reported USB and radio `PASS`, but the known
  DualSense remained offline without a new pairing window. Remembered passive
  reconnect therefore remains unproven and failed in the tested power-cycle
  and controller power-off paths.
- Identified a likely page-scan rearm hole in BTstack: its cached `connectable`
  flag can remain true after the controller disables page scan, making a later
  `gap_connectable_control(1)` call a no-op.
- Deferred passive page-scan rearming to the foreground poll, reapplied the
  configured page-scan parameters and forced a `0` to `1` connectable transition
  after HCI startup and HID link close.
- Added pure policy coverage for rearming only when HCI is working, the bridge
  is not idle-suspended and no HID link is active.
- Kept the binary protocol at version `1`, the desktop-only scope and the
  manual-flash boundary. Firmware `0.41` remains a hardware-test candidate.

## 0.40 - 2026-08-14

- Recorded the physical `0.39` result: initial pairing, a live quick-test
  sample, Controller Lab, diagnostics and configuration read worked, but a
  controller powered off could not reconnect from its remembered key without
  being paired again. The earlier `0.38` run remains the source of the
  `joy.cpl` buttons/sticks and configuration-commit evidence.
- Replaced automatic remembered-key `hid_host_connect` attempts with passive
  reconnect listening so BTstack's single HID-host slot remains available for
  the controller's incoming connection. Outgoing connects are now limited to
  an active pairing inquiry (automatically opened only when no key exists,
  otherwise opened by the user).
- Applied page scan only after `HCI_STATE_WORKING`, rearmed connectability after
  a link close, kept discoverability off outside pairing, and closed the
  pairing window after the first complete CRC-valid enhanced `0x31` report.
- Kept Feature response `0x71` readable until the next MiraLink command report
  produces a success or error response, while consuming a deferred USB reconnect action only
  once. This permits a bounded response-read retry without replaying a write.
- Added a cancellable FIFO for WebHID transactions, bridge identity checks
  before management commands, bounded receive-only retries, explicit stale
  operation cancellation and controlled transport recovery. An ambiguous
  `SET_REPORT` is never sent twice.
- Replaced the overlapping 25 Hz controller interval with controlled 100 ms
  polling and bounded 250/500 ms backoff after transient read/write failures.
- Made `RECONNECT_USB` wait for an observed USB disappearance whether its ACK
  was read or the response read became ambiguous; absence of a disconnect is
  reported as an error and never triggers a command resend.
- Kept the wire report table, command IDs and `protocolVersion` at `1`; this is
  a transport/lifecycle correction, not a binary protocol revision.
- Aligned active site, firmware and package metadata to `0.40` / `0.40.0`.
- Hardware validation of reconnect, outputs, wake and audio remains pending for
  this candidate.

## 0.39 - 2026-08-14

- Rebuilt `System / Configuration / Controllers / Diagnostics / Firmware /
  Backups / Logs` as a real desktop quick-access bar: every item now scrolls
  to its visible section, follows manual scrolling and exposes its active state
  instead of behaving like an inert tab control.
- Rebalanced the visual system around charcoal, soft ivory, muted sage,
  blue-grey and sparse amber status accents instead of an omnipresent neon
  green.
- Added original CSS-native depth, grid, scan, light and reveal effects while
  preserving reduced-motion behavior, keyboard access and the local/offline
  application boundary. MiraLink now documents and tests the web control center
  as a desktop-only product.
- Expanded Controller Lab with read-only live sticks, triggers, buttons,
  battery, headset/microphone state, motion, touch and local
  center/amplitude/circularity analysis. No controller calibration is written.
- Marked the persisted PS-shortcut flag and audio-buffer field unavailable in
  the interface because the current firmware has no PS-shortcut consumer and
  exposes no USB Audio class.
- Recorded the successful physical `0.38` input test: one Windows controller,
  active Bluetooth input and working buttons/sticks. Motion, touch, outputs,
  wake and audio remain untested or unavailable.
- Stopped `COMMIT_CONFIG` from implicitly disconnecting USB. Its versioned ACK
  now tells the application whether an identity change needs re-enumeration;
  the user performs that disruptive step separately and explicitly.
- Decoupled Bluetooth discovery from the selected USB persona so an explicit
  pairing window can find supported standard and Edge controllers while strict
  descriptor, enhanced-report and CRC checks remain required for input.
- Added a separately confirmed factory-default configuration action and kept
  local draft reset distinct from persistent reset.
- Used DualShock Tools and DS5 Bridge Config only as observable feature
  references. No third-party source, asset or product identity was copied;
  permanent calibration/NVS operations remain deliberately unavailable.
- Aligned the site, firmware, protocol and package metadata to `0.39` / `0.39.0`.

## 0.38 - 2026-08-14

- Recorded the manual `0.37` Windows result: exactly one `DualSense` entry
  remained after restart, partially validating the single-root USB topology,
  but buttons and sticks produced no input.
- Fixed the source-level Bluetooth activation lock found after that result.
  After the HID descriptor, the `0.38` candidate advances a bounded
  asynchronous Feature sequence `0x05` → `0x09` → `0x20`, with
  transient-state handling and a bounded neutral-output fallback.
- Treated minimal Bluetooth report `0x01` as liveness only. A controller becomes
  connected and a provisional address becomes trusted only after a complete,
  strict-length, CRC-valid enhanced report `0x31`.
- Kept CYW43/BTstack on the polling execution path and serialized the relevant
  output/BTstack calls in the compiled candidate through a build-generated
  source patch. Physical `0.38` behavior remains unvalidated.
- Routed persistent configuration erase/program through the Pico SDK flash-safe
  executor, moved uptime deadlines to the 64-bit boot clock, cleared stale
  input when HCI turns off and kept USB diagnostics safe if CYW43 init fails.
- Rebuilt the application as an original high-tech control deck with explicit
  WebHID availability and identity handling, actionable diagnostics, local
  profiles, local UF2 inspection and offline recovery.
- Made local UF2 inspection understand Picotool's exact RP2350-E10 sentinel
  while retaining strict per-family numbering, duplicate and completeness
  checks; the final `0.38` UF2 now validates against the same parser exposed in
  the site.
- Prevented an identified MiraLink bridge from silently falling back to direct
  controller mode after a failed HELLO exchange, and added reconnect/poll-error
  recovery with clear next actions.
- Added desktop and mobile browser automation, a synthetic full bridge
  exchange, offline reload coverage and automated accessibility checks. The
  final `0.38` baseline passes 98 unit tests and 20 end-to-end scenarios;
  these remain software-only evidence.
- Copied the required Clang runtime DLLs beside the Windows host-test binary at
  build time so native tests no longer launch with missing `libc++.dll` or
  `libunwind.dll` dialogs.
- Removed the unused legacy image pack from the generated static bundle while
  preserving source assets, reducing the deployed shell to a compact local
  control application.
- Aligned the site, firmware, protocol and package metadata to `0.38` / `0.38.0`.

## 0.37 - 2026-08-14

- Corrected the Windows duplicate-controller failure observed after the first
  0.36 hardware flash: both `DualSense` entries disappeared when the Pico was
  unplugged, proving that the Pico had exposed two HID top-level collections.
- Kept exactly one root Gamepad Application collection and nested MiraLink
  Feature reports `0x70`/`0x71` below it. Compile-time descriptor checks now
  enforce one root, one nested vendor collection, balanced collections and the
  expected management reports.
- Delayed trust of a newly observed Bluetooth address until its first complete
  DualSense input report. A failed new attempt drops only its unvalidated key;
  keys that existed before the attempt are preserved.
- Replaced the CYW43 `threadsafe_background` IRQ worker with explicit main-loop
  polling so BTstack callbacks and foreground Bluetooth calls cannot race.
- Filtered every handled HID subevent from a stale CID being torn down, not
  only its final close, so a late report cannot resurrect a false link state.
- Preserved all native input/output and host-probe report IDs and sizes. A
  subsequent manual Windows test showed one controller child, but no usable
  input: the USB topology correction was partially validated while Bluetooth
  activation and controller functionality were not.
- Aligned the site, firmware, protocol and package metadata to `0.37` / `0.37.0`.

## 0.36 - 2026-08-14

- Added an original, clean-room DualSense-family USB persona for the Pico 2 W
  bridge, using Sony VID `0x054c` with standard/Auto PID `0x0ce6` or Edge PID
  `0x0df2` for native host-stack compatibility. This experimental identity
  does not imply Sony firmware, endorsement or affiliation.
- Consolidated the native gamepad and MiraLink vendor collections on exactly
  one HID interface, avoiding a second incomplete controller probe on Linux.
- Added native report `0x01` input (64 wire bytes), bounded report `0x02`
  output (48-byte compact and 63-byte Linux forms), and Feature reports
  `0x05`, `0x09`, `0x20`, `0x70` and `0x71`. Reserved report `0x72` is not
  declared or emitted; controller management state is polled instead.
- Added host-compatible synthetic calibration and local bridge-identity
  Feature responses without exposing the attached controller Bluetooth
  address, plus explicit user-activity filtering for optional USB wake.
- Updated WebHID discovery to probe the MiraLink vendor collection before the
  direct-controller fallback, read the actual firmware version through
  `GET_INFO`, and make the versioned offline shell cache deterministic.
- Added a repeatable end-of-firmware comparison against DS5Dongle
  `v0.7.2-hotfix`, separating implementation coverage, proof strength and UF2
  size instead of presenting binary size as a quality score.
- Aligned the site, firmware and package metadata to `0.36` / `0.36.0`.
  Software builds and static checks do not constitute a flash, USB
  enumeration test or physical Pico 2 W / DualSense validation.

## 0.35 - 2026-08-14

- Opened the local Bluetooth pairing window automatically when a Pico 2 W has
  no remembered BTstack controller key, so first association starts after the
  firmware is flashed and does not depend on the web interface.
- Kept direct key-based reconnection for controllers already remembered by the
  Pico and kept the standard USB HID gamepad collection for Windows.
- Corrected the firmware version returned by `GET_INFO` and the USB device
  revision to `0.35`.
- Added a fresh local manual-test candidate; no Pico, DualSense or Windows
  hardware test is claimed by the build.

## 0.34 - 2026-08-13

- Restored the HID-only Pico USB configuration after the unvalidated UAC2
  composite caused the bridge to be enumerated but rejected by the WebHID
  handshake.
- Kept the MiraLink feature channel, standard gamepad collection, unique report
  IDs and 65-byte HID control buffer required by the connection path.
- Added a new local manual-test candidate; Windows enumeration, WebHID and
  DualSense pairing still require physical validation after manual flashing.

## 0.33 - 2026-08-13

- Kept the optional `app/assets` directory in the Git checkout so the
  Cloudflare Pages build can copy it from a clean clone instead of failing
  with `ENOENT`.
- Synchronized the site and firmware version to `0.33` and rebuilt the local
  Pico 2 W candidate metadata.

## 0.32 - 2026-08-13

- Synchronized the firmware source, embedded UF2 metadata and local release
  folder with the public MiraLink version `0.32`; firmware and site no longer
  use separate displayed version numbers.
- Activated the remaining safe persisted firmware settings: speaker and
  headset-monitor volume, bounded speaker gain, trigger-effect reduction,
  conservative local inactivity suspension, optional USB serial exposure and
  a disabled-by-default external status GPIO.
- Enforced core-test assertions under the native Release build and added test
  coverage for trigger reduction and reserved-GPIO validation.
- Rebuilt and locally inspected a fresh Pico 2 W / RP2350 ARM Secure UF2.
  No physical Windows, Pico or DualSense test is claimed.

## Firmware 2.4.0 - 2026-08-13

- Reintroduced a standards-based USB Audio Class 2 headset function beside the
  independent MiraLink HID and standard gamepad collections.
- Added fixed 48 kHz / PCM 16-bit four-channel playback, mono local-monitor
  capture, explicit UAC2 clock/mute/volume handling and separate endpoints.
- Applied saved controller mode, haptic gain, audio, reporting and LED
  preferences at firmware runtime rather than only persisting them in flash.
- Added opt-in standard USB remote wake from validated controller input only;
  the host must also explicitly allow that USB feature.
- Rebuilt and locally inspected a Pico 2 W / RP2350 ARM Secure UF2. Native core
  tests passed; no physical Windows, Pico or DualSense test is claimed.

- Removed the supplied decorative image layer from the desktop interface.
- Removed the decorative header, hero calls to action, scroll cue and UF2 drop
  zone so the desktop surface keeps only useful local controls.
- Kept device connection, refresh, system tabs and the GitHub release link.

## 0.30 - 2026-08-13

- Removed the supplied decorative image layer from the desktop interface.
- Kept the connection, system, diagnostics and firmware actions visible and
  focused the hero on the local control workflow.

# 0.29 - 2026-08-13

- Replaced the three legacy hero assets with the supplied desktop image pack.
- Added a five-scene connection carousel, the selected MiraLink mark, textured
  system cards and a textured footer while keeping the interface connection-first.
- Removed the old cinematic, hardware-bridge and signal-hub image files from the
  deployed application assets.

# 0.28 - 2026-08-13

- Wired the Manettes workspace actions that were previously inert.
- Added local Controller Lab calibration analysis from received samples,
  confirmation-gated local snapshot saving and per-controller history restore.
- Added a read-only quick test that reports live input separately from
  unsupported or untested vibration and audio output.

# 0.27 - 2026-08-13

- Simplified the desktop interface around the connection workflow: removed the
  editorial landing sections, kept only the functional system areas, forced a
  French-only UI and added the latest GitHub release link in Firmware.

# 0.26 - 2026-08-13

- Released firmware `2.3.0` as a local manual-test candidate after correcting
  the HID report-ID collision that could cause Windows to report Code 10 and
  hide the Pico from WebHID.
- Assigned unique descriptor IDs for commands (`0x01`), responses (`0x02`),
  events (`0x03`), gamepad input (`0x10`) and raw controller output (`0x11`).
- Kept USB audio unavailable and did not claim a physical hardware test.

## Firmware 2.3.0 - 2026-08-13

- Rebuilt and inspected a Pico 2 W / RP2350 ARM Secure UF2 from MiraLink
  source, with only HID interfaces exposed.
- Changed the raw controller-output envelope from `0x02` to `0x11`; the
  validated 47-byte DualSense body and its safety bounds are unchanged.
- Passed native core tests and static descriptor inspection. No Pico or
  DualSense hardware test is claimed.

# 0.25 - 2026-08-13

- Fixed the desktop edge-to-edge hero sizing so the cinematic scene and
  headline remain fully framed at wide viewport widths.

# 0.24 - 2026-08-13

- Rebuilt the desktop landing as a long-form editorial control-center story
  with a floating navigation, signal diagram, capability sequence, scroll
  reveals and direct links into the functional workspace.

# 0.23 - 2026-08-13

- Rebuilt the public desktop landing hero with cinematic local hardware scenes,
  crossfades, parallax, scroll choreography and magnetic calls to action while
  preserving the existing WebHID application underneath.

## 0.22 - 2026-08-13

- Corrected the public MiraLink site/application version to `0.22`, with a
  `0.01` increment policy for future site commits.
- Kept firmware version `2.2.0` independent; no firmware binary or hardware
  claim changed in this metadata-only update.

## Firmware 2.2.0 - 2026-08-13

- Replaced the failing USB composite descriptor with a HID-only Pico 2 W
  configuration after Windows reported Code 10 on both the audio and HID
  child interfaces of the 2.0.0 bridge.
- Kept the MiraLink feature channel and standard gamepad collection while
  removing the unvalidated UAC2 interface from the active descriptor.
- Kept audio USB explicitly unavailable; the audio pipeline remains isolated
  in source for a later descriptor-specific validation cycle.
- Built and inspected a new RP2350 ARM Secure UF2 locally. It has not been
  flashed or tested on physical hardware.

## 2.1.0 - 2026-08-13

- Added the MiraLink bridge VID/PID to the WebHID chooser filters so Chrome can
  select the enumerated Pico 2 W HID interface even when the vendor collection
  usage page is not exposed consistently by the host.
- Kept this as an application-only transport hotfix: the already installed
  firmware `2.0.0` remains compatible and does not require a reflash.
- Local Windows enumeration confirmed the connected bridge identity as
  `VID_CAFE/PID_4D4C`; this is not a claim that a controller has paired.

## 2.0.0 - 2026-08-13

- Added local Bluetooth failure diagnostics: last failing stage, controller
  attempt/failure counters and automatic-reconnect attempts, without exposing
  radio addresses or sending data away from the computer.
- Hardened the bounded Bluetooth output queue so a pending BTstack report is
  not overwritten by a concurrent haptic, trigger or audio report.
- Kept one validated audio report in local RAM while the output queue is busy,
  discarded stale audio after a link loss, and encoded the actual Opus payload
  length instead of advertising the full capacity as audio data.
- Added host coverage for fixed DualSense audio-report layout validation and
  application coverage for diagnostics schema 4.
- Rebuilt the local Pico 2 W manual-test candidate. Hardware behavior remains
  untested; no flash, push or public publication is claimed.

## 1.9.0 - 2026-08-13

- Added a local UAC2 audio input for four-channel, 48 kHz, 16-bit PCM. Audio
  samples stay in a bounded RAM ring and are never persisted or sent to a
  network service.
- Added a bounded DualSense audio HID report path (`0x36`, 398 bytes): the
  local four-channel USB PCM input is converted to Opus stereo speaker data
  plus 3 kHz haptic channels. The link is reported only after a valid HID
  controller route exists and streaming only after reports are accepted by
  BTstack; no standard A2DP/SBC route is advertised.
- Added a fixed-size DualSense output route for haptic/trigger-compatible game
  output: 47 validated USB body bytes are wrapped with a MiraLink-owned
  Bluetooth header, sequence and CRC.
- Added `SET_CONTROLLER_OUTPUT`, `GET_AUDIO_STATUS` and diagnostics schema 3;
  the application now displays local audio status instead of hard-coding it as
  unavailable.
- Rebuilt the local Pico 2 W candidate with the corrected 48 kHz endpoint,
  locally vendored Opus 1.5.2 and fresh ELF/BIN/HEX/UF2 artifacts.
  budget. Software checks pass; no physical flash, controller test, push or
  public release is claimed.

## 1.8.0 - 2026-08-13

- Extended the independent Pico 2 W DualSense path to recognize the DualSense
  Edge USB identity and Bluetooth inquiry variants.
- Made Bluetooth inquiry more tolerant of incomplete device metadata while
  keeping the final HID report validation strict.
- Fixed stale HID connection cleanup so a failed handshake cannot block the
  next local pairing or reconnection attempt.
- Increased local HID descriptor storage for complete DualSense revisions and
  kept unsupported audio streaming and adaptive-trigger effects explicitly
  unavailable instead of advertising them as firmware capabilities.
- Prepared a versioned 1.8.0 manual-test candidate with build evidence and
  SHA-256 manifests. No physical hardware test, flash, push or publication is
  claimed.

## 1.7.0 - 2026-08-13

- Corrected automatic DualSense reconnection so a failed controller does not
  exhaust the retry index permanently and multiple remembered controllers are
  retried in a bounded rotation.
- Kept Bluetooth link-key persistence on the Pico SDK's local BTstack store and
  added compile-time flash separation checks against MiraLink configuration.
- Added SSP reconnection for remembered controllers, a ten-second HID
  handshake timeout and recovery through the normal local reconnect path.
- Kept the bridge local, manual-flash-only and explicit about unsupported audio
  streaming and adaptive-trigger effects.

## 1.6.0 - 2026-08-12

- Accepted the legacy DualSense Bluetooth PIN `0000` only during the explicit
  local pairing window or for a controller address already known to BTstack.
- Normalized MiraLink HID feature commands when a host provides the report ID
  in the callback buffer, while retaining strict report-size validation.
- Kept the pairing and HID changes local, confirmation-gated and unvalidated
  on physical hardware until the new candidate is manually flashed.

## 1.5.0 - 2026-08-12

- Corrected the DualSense USB/Bluetooth input offsets for buttons, motion,
  touch and battery status instead of treating the sequence byte as buttons.
- Added schema-2 controller state data with local battery, headset, microphone,
  motion and touch fields, plus explicit capability negotiation.
- Added bounded Bluetooth-compatible rumble, lightbar/player LEDs and
  microphone mute output commands with CRC-protected reports and automatic
  haptic stop handling.
- Kept adaptive-trigger effects and audio streaming explicitly unavailable;
  no physical Pico 2 W or DualSense test is claimed until the candidate is
  manually flashed and observed on real hardware.

## 1.4.0 - 2026-08-12

- Added local BTstack link-key discovery and bounded automatic reconnection for
  previously paired DualSense controllers.
- Allowed incoming HID connections from locally known paired controllers after
  the pairing window closes, while keeping unknown devices confirmation-gated.
- Exposed paired-controller knowledge in the controller-state protocol and
  added the corresponding local protocol test.
- Physical DualSense pairing remains untested until the 1.4.0 candidate is
  manually flashed on a Pico 2 W.

## 1.3.0 — 2026-08-12

- Fixed the TinyUSB buffer size for MiraLink HID reports with a report ID:
  `SET_FEATURE` now accepts the identifier plus 64 data bytes.
- Added local normalization for WebHID responses with or without the report
  ID, bounded controller-state polling, and a confirmed pairing-window start
  after a bridge is connected.
- Added the Pico 2 W candidate in `firmware/releases/1.3.0/` with RP2350
  inspection and SHA-256 manifests.
- Flashing the candidate and connecting a DualSense remain manual physical
  hardware checks.

## 1.1.0 — 2026-08-12

- Ajouté la recherche locale de DualSense pendant la fenêtre d’appairage du Pico 2 W, avec filtrage d’identité, demande de nom et reconnexion après fermeture.
- Ajouté les diagnostics firmware structurés : radio, appairage, recherche, connexion, rapports validés et rapports rejetés.
- Ajouté les commandes locales bornées de reconnexion USB, journalisation en RAM et entrée recovery confirmation-gated ; aucune action n’est automatique.
- Ajouté le candidat firmware Pico 2 W `firmware/releases/1.1.0/` avec ELF, BIN, HEX, UF2 et manifestes SHA-256.
- Aucun flash, test matériel réel, push ou publication n’a été effectué ; les limites audio, batterie, haptique, gâchettes adaptatives et VID/PID de production restent explicites.

## 1.0.0 — 2026-08-12

- Rendu le build statique compatible avec les deux sorties Cloudflare Pages : `app/` et `app/dist/`.
- Conservation automatique de `_headers` dans `app/dist/` pour ne pas perdre l’autorisation WebHID pendant le build.
- Aucun firmware, fichier visuel ou test matériel réel n’a été modifié ou déclaré.

## 0.9.0 — 2026-08-12

- Ajouté l’autorisation de déploiement `Permissions-Policy: hid=(self)` pour Cloudflare Pages.
- Ajouté un diagnostic local distinguant contexte non sécurisé, politique de permissions et navigateur/contexte incompatible.
- Analysé l’ancien UF2 en lecture seule comme référence de comportement, sans réutiliser son code ni son firmware.

## 0.8.0 — 2026-08-12

- Corrigé l’échange WebHID du bridge : les réponses de commandes sont maintenant lues comme rapports HID de fonctionnalité avec `receiveFeatureReport(2)`.
- Ajouté une attente bornée et une vérification de séquence pour éviter qu’un Pico connecté soit classé à tort comme périphérique HID non supporté.
- Complété le cache hors ligne avec les modules DualSense et transport HID.
- Ajouté un test de régression local ; aucun firmware, fichier visuel ou test matériel n’a été modifié.

## 0.7.0 — 2026-08-12

- Renforcé le workflow obligatoire : lecture et mise à jour des garde-fous avant chaque commit.
- Imposé un commit local complet à la clôture de chaque prompt de travail, sans commit partiel ni push implicite.
- Aucun comportement firmware, test matériel ou fichier visuel n’a été modifié dans ce lot.

## 0.6.0 — 2026-08-12

- Ajouté un parseur indépendant des rapports d’entrée USB filaires DualSense dans le cœur firmware.
- Ajouté la détection et l’adaptateur WebHID local DualSense pour les rapports réels côté ordinateur.
- Ajoutée la publication locale des échantillons Controller Lab via un événement dédié, sans stockage permanent ni sortie réseau.
- Ajouté un hôte Bluetooth Classic HID Pico 2 W pour les rapports d’entrée DualSense `0x31`, avec vérification CRC.
- Ajouté la commande `OPEN_PAIRING_WINDOW`, fermée au démarrage et activable localement pendant cinq minutes après confirmation.
- Séparé les secteurs flash de configuration MiraLink et la banque locale de clés BTstack.
- Recompilé le firmware source 0.6.0 avec le SDK Pico officiel et validé les tests C++ du parseur/protocole.
- Ajouté le candidat UF2 local `firmware/releases/0.6.0/` avec SHA-256 ; aucun flash ni push n’a été effectué.
- Corrigé l’identification : un HID inconnu n’est plus présenté comme une manette MiraLink.
- Corrigé le décodage binaire de HELLO et des diagnostics ; les capacités radio et audio restent explicitement indisponibles.
- Aucun fichier visuel ni `app/dist/` n’a été modifié ; aucun flash ni test matériel réel n’a été effectué ou déclaré.

## 0.5.0 — 2026-08-12

- Ajouté le garde d’actions local pour le mode lecture seule, le verrouillage et les confirmations.
- Ajouté l’enregistrement temporaire de sessions avec rétention bornée et export contrôlé/anonymisé.
- Ajouté le benchmark local USB/radio/pertes avec score explicable et exclusion des mesures absentes.
- Ajoutée la détection locale de dérive et de batterie anormale, sans transformer une simulation en test matériel.
- Ajoutés 8 tests de fonctionnalités ; 44 tests logiciels passent au total.
- Aucun fichier visuel, firmware, build `dist/` ou test matériel n’a été modifié ou exécuté.

## 0.4.0 — 2026-08-12

- Ajouté le contrat local de remappage des boutons avec profils ciblés, diff, export/import et confirmation.
- Ajouté le mode urgence vers la configuration Basique, sans persistance implicite.
- Ajoutée la matrice locale de compatibilité firmware/manettes avec état `not-tested` par défaut.
- Ajouté le plan de diagnostics guidés et l'export de rapports anonymisés, avec séparation preuve/cause/solution.
- Ajouté 5 tests de fonctionnalités ; 36 tests logiciels passent au total.
- La structure visuelle et `dist/` restent volontairement inchangés pendant le travail visuel parallèle.

## 0.3.0 — 2026-08-12

- Added local simulation scenarios with an explicit `MODE SIMULATION` status and no hardware-test claims.
- Added the Competitive, Basic and Economy profile contracts with confirmation-gated previews.
- Added the Basic → Economy battery policy below 10 %, while protecting Competitive from automatic replacement.
- Added local profile storage, Controller Lab analysis and bounded calibration history.
- Added capability-aware live status metrics and a redacted computer → Pico 2 W → controller connection map model.
- Added 31 application and protocol tests covering the new local feature contracts.
- Documented the verified implementation state and the remaining UI integration roadmap.

## 0.2.0 — 2026-08-12

- Published a versioned Pico 2 W firmware delivery artifact with checksum and local release notes.
- Refined the application into an original blue/cyan crystalline HUD visual system inspired by the supplied mood references without copying game assets.
- Added service-worker cache rotation and synchronized application metadata with the release version.

## 0.1.0 — 2026-08-12

- Created the independent MiraLink project from zero.
- Added the mandatory guardrail document.
- Added the initial product brief, architecture and protocol direction.
- Set MaruChiwa as the displayed developer.
- Downloaded and documented the official local Pico SDK, ARM toolchain, CMake, Ninja and picotool.
- Implemented fixed 64-byte HID frames, CRC/padding checks and a two-sector flash configuration store.
- Compiled and inspected the first Pico 2 W ELF/BIN/HEX/UF2 firmware target.
- Strengthened local application protocol tests and UF2 validation.
