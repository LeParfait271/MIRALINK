# MiraLink — Versioning rules

MiraLink starts at `0.1.0`.

For every commit that changes the project, increase the minor version by `0.1` and update the date in `VERSION.json`:

```text
0.1.0 → 0.2.0 → 0.3.0 → 0.4.0 → 0.5.0 → 0.6.0 → 0.7.0 → 0.8.0 → 0.9.0 → 1.0.0 → 1.1.0 → 1.2.0 → 1.3.0 → 1.4.0 → 1.5.0 → 1.6.0 → 1.7.0 → 1.8.0 → 1.9.0
```

The same version must be reflected in:

- `VERSION.json`;
- the application metadata;
- firmware metadata when a firmware build is involved;
- the changelog entry;
- the local delivery manifest.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

The current committed product version is `1.9.0`; the same value must be
reflected in the next local delivery manifest and firmware candidate.

Before every commit, read and update `MIRALINK_GARDE_FOU.md` and
`docs/WORKFLOW.md` when a rule, decision or limit changed. Every work prompt is
closed by one complete local commit containing all changes from that prompt;
never create a partial commit. Do not push automatically.
