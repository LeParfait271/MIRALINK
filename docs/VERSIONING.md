# MiraLink — Versioning rules

MiraLink starts at `0.1.0`. The public site uses a compact two-decimal version
(`0.10` is the display form of the initial `0.1.0`).

For every commit that changes the site or application, increase the public
version by `0.01` and update the date in `VERSION.json`:

```text
0.10 → 0.11 → 0.12 → … → 0.33 → 0.34 → 0.35
```

The current sequence continues through public version `0.35`.

The public site version must be reflected in:

- `VERSION.json`;
- the application metadata;
- the changelog entry;
- the local delivery manifest.

`app/package.json` uses the valid npm semver representation `0.35.0`; this is
packaging metadata for the public site version `0.35`, not a separate product
release.

The firmware and public site share one displayed version. A firmware build is
released with the exact current public-site version, so the source, embedded
UF2 metadata, release folder and manifest currently use `0.35`. CMake uses
the technical form `0.35.0` only because it requires three numeric segments;
the firmware reported by the device remains exactly `0.35`.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

The current committed site and firmware version is `0.35`, containing the HID
bridge, standard gamepad path and automatic first-pair Bluetooth startup with
active persisted runtime settings. USB audio is kept source-only after the UAC2
composite connection path remained unvalidated on a real Pico 2 W.

Before every commit, read and update `MIRALINK_GARDE_FOU.md` and
`docs/WORKFLOW.md` when a rule, decision or limit changed. Every work prompt is
closed by one complete local commit containing all changes from that prompt;
never create a partial commit. Do not push automatically.
