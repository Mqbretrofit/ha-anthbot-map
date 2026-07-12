# Changelog

## 1.0.5 / map card v77 — 2026-07-12

### Added

- Photo-backed Anthbot map card for Home Assistant.
- Live robot position, mowing trail, zones, no-go areas, charger, and controls.
- Full-screen map mode with zoom, pan, calibration, and YAML export.
- Visible position and heading badges in the upper-left corner.
- Correct heading conversion matching the official app: `pose.yaw` is stored
  in milliradians and converted with `yaw * 180 / (pi * 1000)`.
- HACS metadata and public installation documentation.

### Changed

- Repository links and code owner now point to `Mqbretrofit/ha-anthbot-map`.
- Removed embedded vendor AWS keys; IoT access now requires temporary STS
  credentials returned by the Anthbot cloud.

## Earlier integration work

The integration is based on the upstream projects listed in [NOTICE.md](NOTICE.md).
See their histories for changes made before this combined map release.
