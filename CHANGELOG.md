# Changelog

## 1.0.28 / map card v100 — 2026-07-15

### Fixed

- Mobilon kétujjas csippentéssel nagyítható és kicsinyíthető a nagy térkép.
- A kétujjas nagyítás a gesztus középpontját követi, és közben a térkép mozgatható is.
- A robot alapmérete nem fix képpontérték, hanem a megjelenített térkép szélességének 5,5%-a.
- A mobilos főnézetben és nagy térképnézetben így azonos marad a robot térképhez viszonyított aránya.
- A `robot_map_ratio` YAML-opcióval az arány egyedileg állítható; az alapérték `0.055`.
- A nagy térkép bezárásakor a zoom és az eltolás visszaáll alaphelyzetbe.
- A `+ / −` gombok nagyítási lépése 15%-ról 30%-ra nőtt.

## 1.0.26 / map card v98 — 2026-07-14

### Fixed

- Lejárt Anthbot bearer tokennél az integráció automatikusan újra bejelentkezik.
- Sikertelen AWS IoT STS-frissítés után új hitelesítéssel ismét lekéri az ideiglenes hozzáférést.
- Az AWS lejárati idő másodperc, ezredmásodperc, számszöveg és ISO dátum formátumban is helyesen értelmezhető.
- Hiányzó lejárati időnél az AWS-adatok legfeljebb 45 percig maradnak gyorsítótárazva.

## 1.0.25 / map card v97 — 2026-07-14

### Fixed

- A nyelvválasztó szövege és lenyíló listája saját sötét megjelenésben ismét jól olvasható.
- A Home Assistant beviteli mezőszíneit csak bekapcsolt „HA téma használata” mellett veszi át.

## 1.0.24 / map card v96 — 2026-07-14

### Added

- Új `theme_background: true` kapcsoló a Felület beállítások fülön.

### Changed

- A kártya alapból ismét a saját eredeti sötét színeit használja.
- A Home Assistant theme színeit csak a „HA téma használata” kapcsoló bekapcsolásakor veszi át.

## 1.0.23 / map card v95 — 2026-07-14

### Fixed

- Üvegháttér mellett a nagy térkép ismét valódi teljes képernyős nézetben nyílik meg.
- Nagy nézetben ideiglenesen kikapcsol a `backdrop-filter`, így nem korlátozza a fix pozicionálást.
- Az üvegháttér és a belső panelek erősebben áttetszőek.

## 1.0.22 / map card v94 — 2026-07-14

### Added

- Új, külön kapcsolható `glass_background: true` üvegháttér-opció a Felület beállítások fülön.

### Changed

- Alapállapotban a háttér ismét normál, nem áttetsző theme-háttér.
- Az üvegháttér és a teljesen átlátszó háttér kölcsönösen kizárja egymást.

## 1.0.21 / map card v93 — 2026-07-14

### Fixed

- Az üveghatás közvetlenül bekerült a kártya Shadow DOM-jába, mert a külső theme `ha-card` CSS-szabályai oda nem jutnak be.
- A kártya és a másodlagos panelek áttetsző témahátteret, elmosást és színtelítést kapnak.

## 1.0.20 / map card v92 — 2026-07-14

### Fixed

- A kártya elsődlegesen a Home Assistant `card-background-color` témahátterét használja a fekete `ha-card-background` helyett.
- A `transparent_background` most már az egész kártyát átlátszóvá teszi, beleértve a fejlécet, a paneleket és a kalibrációs részt is.

## 1.0.19 / map card v91 — 2026-07-14

### Changed

- A kártya háttere, szövegei, panelei, elválasztói, kiemelőszíne, lekerekítése és árnyéka követi az aktív Home Assistant témát.
- A Start, Stop és Töltő műveleti gombok saját állapotszínei megmaradnak.

## 1.0.18 / map card v90 — 2026-07-14

### Fixed

- Három egymást követő átmeneti cloud hiba alatt megmarad az utolsó érvényes állapot.
- Az indítási parancsok között késleltetés van, így nem írják felül egymást az AWS shadow-ban.
- Az integráció ellenőrzi a tényleges nyírási állapotot, és sikertelen indulásnál egyszer újrapróbálja.

## 1.0.17 / map card v89 — 2026-07-14

### Changed

- A Beállítások külön „Robot beállítások” és „Felület beállítások” fülre vált szét.
- A `map_only` és `transparent_background` kapcsolható a felületről, és böngészőnként megmarad.
- Csak térkép módban dupla kattintással vagy dupla koppintással visszaállítható a teljes kezelőfelület.

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
