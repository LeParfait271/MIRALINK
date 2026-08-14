# MiraLink — Versioning rules

MiraLink starts at `0.1.0`. The public site uses a compact two-decimal version
(`0.10` is the display form of the initial `0.1.0`).

For every commit that changes the site or application, increase the public
version by `0.01` and update the date in `VERSION.json`:

```text
0.10 → 0.11 → 0.12 → … → 0.39 → 0.40 → 0.41 → 0.42
```

The current sequence continues through public version `0.42`.

The public site version must be reflected in:

- `VERSION.json`;
- the application metadata;
- the changelog entry;
- the local delivery manifest.

`app/package.json` uses the valid npm semver representation `0.42.0`; this is
packaging metadata for the public site version `0.42`, not a separate product
release.

The firmware and public site share one displayed version. A firmware build is
released with the exact current public-site version, so the source, embedded
UF2 metadata, release folder and manifest currently use `0.42`. CMake uses
the technical form `0.42.0` only because it requires three numeric segments;
the firmware reported by the device remains exactly `0.42`.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

The current site and firmware version is `0.42`. It contains the clean-room,
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
configuration commit resumes local idle suspension. Both corrections are
software-validated but not yet physically retested.
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
