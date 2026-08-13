# MiraLink 2.1.0 validation record

Date: 2026-08-13
Scope: application WebHID discovery hotfix; compatible firmware remains 2.0.0
Status: software validation passed; controller pairing remains pending

## Evidence

- Windows local Plug and Play enumeration found the connected bridge as
  `USB\\VID_CAFE&PID_4D4C`, with a MiraLink product interface and HID interface
  `MI_02` present.
- The application now includes the exact MiraLink VID/PID in the WebHID chooser
  filters in addition to the vendor usage-page filter.
- The existing `2.0.0` firmware is not changed and does not require reflashing
  for this application-only correction.
- No controller pairing, input relay, haptic effect or audio rendering is
  declared tested by this record.

## Automated checks

- Application syntax and protocol tests: run before commit.
- Visual files and `app/dist` were not modified.
- No telemetry, cloud data path or automatic flash was added.
