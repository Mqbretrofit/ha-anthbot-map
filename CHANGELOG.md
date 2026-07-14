# Changelog

## 1.0.16 / map card v88 — 2026-07-14

### Added

- `transparent_background: true` opció floorplan rétegként történő megjelenítéshez.
- Átlátszó módban a háttérkép és az alap kitöltés eltűnik, de a geometriai illesztés változatlan marad.

## 1.0.15 / map card v87 — 2026-07-14

### Added

- `map_only: true` mód, amely kizárólag a térképet jeleníti meg floorplan használathoz.
- Gombonként beállítható `button_actions`, tetszőleges Home Assistant service vagy script meghívásával.

## 1.0.14 / map card v86 — 2026-07-14

### Changed

- A térkép magassága automatikusan követi a háttérkép valódi oldalarányát.
- A kártya átméretezésekor a háttérkép és a vászon együtt méreteződik.
- A kézi `height` beállítás továbbra is felülbírálja az automatikus méretezést.

## 1.0.13 / map card v85 — 2026-07-13

### Removed

- A nem támogatott no-go szegélynyírás és a hozzá tartozó pontgenerálás.
- A „Minden szegély” művelet, mert az a hibás no-go feladatot is elindította.

### Unchanged

- A gyári külső szegélynyírás és a töltőállomás körüli nyírás továbbra is elérhető.

## 1.0.12 / map card v84 — 2026-07-13

### Fixed

- A generált no-go pontokat nem egy nagy, firmware által elutasítható listában küldi.
- Minden pont külön `region_mow_start` feladatként indul.
- A következő pont csak az előző pontnyírás befejezése után kerül elküldésre.

## 1.0.11 / map card v83 — 2026-07-13

### Fixed

- A `nest_mow_start` helyesen töltő körüli nyírásként jelenik meg.
- A no-go szegélynyírás már nem indít töltő körüli feladatot.

### Added

- A felhőből lekért tényleges no-go határpontok követése.
- Az eredeti alakzattal párhuzamos, alapértelmezetten 30 cm-rel kifelé eltolt útvonal.
- Állítható biztonsági távolság és pontsűrűség a Home Assistant szolgáltatásban.

## 1.0.10 / map card v82 — 2026-07-13

### Added

- Külső szegélyvágás külön Home Assistant szolgáltatással és kártyagombbal.
- No-go zónák körbevágása a gyári `nest_mow_start` paranccsal.
- Minden szegély vágása egyetlen kártyagombbal.
- Külön Home Assistant gombentitások mindhárom szegélyvágási módhoz.

## 1.0.9 / map card v81 — 2026-07-13

- Az „Utolsó frissítés” időpontja a Home Assistant beállított helyi időzónájában jelenik meg.
- Ha nincs HA-időzóna, a böngésző helyi időzónája az alapértelmezés.
- A dátum és idő formátuma követi a kártyán kiválasztott nyelvet.

## 1.0.8 / map card v80 — 2026-07-12

### Added

- Turkish, Thai, Vietnamese, Korean, and Khmer translations.
- Automatic language detection for all five new languages.

## 1.0.7 / map card v79 — 2026-07-12

### Fixed

- Keep the language selector and other settings controls open while live mower
  data refreshes in the background.

## 1.0.6 / map card v78 — 2026-07-12

### Added

- Automatic Home Assistant language detection.
- Manual language selector in the card settings.
- 18 selectable languages, including simplified and traditional Chinese.
- English fallback for missing translations.

### Changed

- Map labels, controls, status values, settings, diagnostics, and calibration
  controls now use the card translation system.

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
