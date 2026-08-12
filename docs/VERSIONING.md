# MiraLink — Versioning rules

MiraLink starts at `0.1.0`.

For every commit that changes the project, increase the minor version by `0.1` and update the date in `VERSION.json`:

```text
0.1.0 → 0.2.0 → 0.3.0 → 0.4.0
```

The same version must be reflected in:

- `VERSION.json`;
- the application metadata;
- firmware metadata when a firmware build is involved;
- the changelog entry;
- the local delivery manifest.

The current local delivery manifest is `docs/DELIVERY_MANIFEST.json`.

Do not create a commit before the relevant checks pass. Do not push automatically.
