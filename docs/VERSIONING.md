# MiraLink — Versioning rules

MiraLink starts at `0.1.0`. The public site uses a compact two-decimal version
(`0.10` is the display form of the initial `0.1.0`).

For every commit that changes the site or application, increase the public
version by `0.01` and update the date in `VERSION.json`:

```text
0.10 → 0.11 → 0.12 → … → 0.26 → 0.27
```

The public site version must be reflected in:

- `VERSION.json`;
- the application metadata;
- the changelog entry;
- the local delivery manifest.

`app/package.json` uses the valid npm semver representation `0.27.0`; this is
packaging metadata for the public site version `0.27`, not a separate product
release.

Firmware versions are independent. The current firmware source and release
artifact are `2.3.0` and must not be renamed when only the site changes.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

The current committed site version is `0.27`. The current firmware version is
`2.3.0`, containing the HID-only USB recovery candidate. USB audio is
intentionally not exposed until the composite descriptor is independently
validated on Windows hardware.

Before every commit, read and update `MIRALINK_GARDE_FOU.md` and
`docs/WORKFLOW.md` when a rule, decision or limit changed. Every work prompt is
closed by one complete local commit containing all changes from that prompt;
never create a partial commit. Do not push automatically.
