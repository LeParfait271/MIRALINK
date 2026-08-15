# MiraLink — Versioning rules

MiraLink starts at `0.1.0`. The public site uses a compact two-decimal version
(`0.10` is the display form of the initial `0.1.0`).

For every commit that changes the site or application, increase the public
version by `0.01` and update the date in `VERSION.json`:

```text
0.10 → 0.11 → 0.12 → … → 0.39 → 0.40 → 0.41 → 0.42 → 0.43 → 0.44 → 0.46 → 0.47 → 0.48
```

The current sequence continues through public version `0.48`.

The public site version must be reflected in:

- `VERSION.json`;
- the application metadata;
- the changelog entry;
- the local delivery manifest.

`app/package.json` uses the valid npm semver representation `0.48.0`; this is
packaging metadata for the public site version `0.48`, not a separate product
release.

The firmware and public site share one displayed version. A firmware build is
released with the exact current public-site version, so the source, embedded
UF2 metadata, release folder and manifest use `0.48`. CMake uses the technical
form `0.48.0` only because it requires three numeric segments; the firmware
reported by the device remains exactly `0.48`.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

The current site and firmware version is `0.48`. It contains the clean-room,
experimental DualSense-family USB persona with one HID interface, one root
Gamepad Application collection and nested MiraLink Feature management. A
manual `0.38` Windows test confirmed one bridge-owned controller and working
buttons/sticks in `joy.cpl`. The `0.39` run confirmed initial pairing, a live
quick-test sample, Controller Lab, diagnostics and configuration read, then
showed that remembered reconnect failed after controller power-off. The manual
`0.40` run confirmed the bridge and radio transport after a Pico restart but
showed the known controller offline without a new pairing window. Version
`0.41` kept the passive incoming policy and forced a deferred page-scan rearm
when BTstack's cached connectable state would otherwise suppress the HCI write.
`0.42` routes the same scan recovery through the foreground poll when a
configuration commit resumes local idle suspension. The `0.46` correction
compares MiraLink directly with DS5Dongle `v0.7.2-hotfix` and waits for
`HCI_EVENT_DISCONNECTION_COMPLETE` before requesting the foreground page-scan
rearm. All reconnect corrections remain software-validated until the manual
hardware test. Version `0.48` adds DS5Dongle-aligned discoverability recovery after
ACL/HID teardown; it is also software-validated only.
The binary protocol remains version `1`; a product version does not imply a
protocol-version increment. Sony VID/PID compatibility does not imply Sony
firmware, endorsement or affiliation. USB audio remains source-only.

Before every commit, read and update `MIRALINK_GARDE_FOU.md` and
`docs/WORKFLOW.md` when a rule, decision or limit changed. Every work prompt is
closed by one complete local commit containing all changes from that prompt;
never create a partial commit. The permanent authorization recorded on
2026-08-14 requires that complete commit to be pushed immediately to the
configured remote after a modifying prompt; it does not authorize a flash or
an application publication.

For every firmware problem, the official DS5Dongle `v0.7.2-hotfix` UF2 and
source are a mandatory read-only behavioral reference before diagnosis. The
comparison must identify the observed, inferred and proven facts, state a
probable cause and define a discriminating test before code is changed. The
DS5Dongle score remains `54.4%` until new physical evidence exists.
