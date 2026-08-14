# MiraLink — Versioning rules

MiraLink starts at `0.1.0`. The public site uses a compact two-decimal version
(`0.10` is the display form of the initial `0.1.0`).

For every commit that changes the site or application, increase the public
version by `0.01` and update the date in `VERSION.json`:

```text
0.10 → 0.11 → 0.12 → … → 0.35 → 0.36 → 0.37
```

The current sequence continues through public version `0.37`.

The public site version must be reflected in:

- `VERSION.json`;
- the application metadata;
- the changelog entry;
- the local delivery manifest.

`app/package.json` uses the valid npm semver representation `0.37.0`; this is
packaging metadata for the public site version `0.37`, not a separate product
release.

The firmware and public site share one displayed version. A firmware build is
released with the exact current public-site version, so the source, embedded
UF2 metadata, release folder and manifest currently use `0.37`. CMake uses
the technical form `0.37.0` only because it requires three numeric segments;
the firmware reported by the device remains exactly `0.37`.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

The current site and firmware version is `0.37`. It contains the clean-room,
experimental DualSense-family USB persona with one HID interface, one root
Gamepad Application collection and nested MiraLink Feature management. The
topology corrects the duplicate Windows controller children observed during
the 0.36 hardware test. Sony VID/PID compatibility does not imply Sony
firmware, endorsement or affiliation. USB audio remains source-only and the
0.37 correction has not yet been flashed or validated on physical hardware.

Before every commit, read and update `MIRALINK_GARDE_FOU.md` and
`docs/WORKFLOW.md` when a rule, decision or limit changed. Every work prompt is
closed by one complete local commit containing all changes from that prompt;
never create a partial commit. The permanent authorization recorded on
2026-08-14 requires that complete commit to be pushed immediately to the
configured remote after a modifying prompt; it does not authorize a flash or
an application publication.
