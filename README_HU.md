# Anthbot Genie Plus térkép Home Assistanthoz

[English](README.md) | [Magyar](README_HU.md)

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)
[![Licenc: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Nem hivatalos Home Assistant-integráció és fényképalapú térképkártya az
Anthbot Genie robotfűnyírókhoz. A robotot, a zónákat, a tiltott területeket,
a töltőt és a megtett útvonalat a kert saját felülnézeti fényképén jeleníti meg.

> Ez a projekt nem áll kapcsolatban az Anthbottal. A forrásokról és a
> védjegyekről a [NOTICE.md](NOTICE.md) fájlban olvashatsz.

## Funkciók

- Anthbot-felhő bejelentkezés a Home Assistant felületén
- több fűnyíró támogatása egy Anthbot-fiókkal
- akkumulátor-, állapot-, töltés-, RTK-, hálózat-, firmware-, karbantartási-,
  térkép-, zóna-, hiba- és diagnosztikai entitások
- teljes terület, kézi zóna és automatikus zóna nyírása
- szüneteltetés, leállítás és visszaküldés a töltőre
- saját légi vagy drónfelvétel használata háttérképként
- zónák, tiltott területek és nyírási útvonal megjelenítése
- teljes képernyő, nagyítás, mozgatás, forgatás és kalibrálás
- látható pozíció- és iránykijelzés
- a hivatalos alkalmazással megegyező milliradiános irányszámítás
- a kalibrálópanelen elkészített YAML közvetlenül kimásolható
- a Home Assistant nyelvének automatikus felismerése és kézi nyelvválasztás
- 23 választható nyelv, köztük az egyszerűsített és hagyományos kínai,
  a török, thai, vietnámi, koreai és khmer

Elsősorban Genie sorozatú fűnyírókkal tesztelve. Az elérhető adatok és
parancsok modellenként és firmware-verziónként eltérhetnek.

## A repository felépítése

```text
custom_components/anthbot_genie_plus/   Home Assistant-integráció
www/anthbot-map/                        Lovelace térképkártya
tools/anthbot_dump.py                   Opcionális diagnosztikai segédprogram
```

## Telepítés HACS használatával

1. Nyisd meg a **HACS → Integrációk** oldalt.
2. A jobb felső hárompontos menüben válaszd az **Egyéni tárolók / Custom
   repositories** lehetőséget.
3. Add hozzá ezt a címet:

   ```text
   https://github.com/Mqbretrofit/ha-anthbot-map
   ```

4. Kategóriának válaszd az **Integration** lehetőséget.
5. Telepítsd az **Anthbot Genie Plus Map** integrációt.
6. Indítsd újra a Home Assistantot.
7. Nyisd meg a **Beállítások → Eszközök és szolgáltatások → Integráció
   hozzáadása** oldalt.
8. Keresd meg az **Anthbot Genie Plus** integrációt, majd add meg az
   Anthbot-fiókod adatait.

A HACS az integrációt telepíti. A térképkártya fájljait jelenleg külön kell
bemásolni.

## A térképkártya telepítése

Másold a repository `www/anthbot-map/` mappáját ide:

```text
/config/www/anthbot-map/
```

A fő fájl végleges helye:

```text
/config/www/anthbot-map/anthbot-map-card.js
```

Add hozzá ezt a Lovelace JavaScript-erőforrást:

```text
/local/anthbot-map/anthbot-map-card.js?v=92
```

Az erőforrás típusa: **JavaScript module**. Az erőforráskezelő általában a
**Beállítások → Irányítópultok → jobb felső hárompontos menü → Erőforrások**
oldalon található. Ezután indítsd újra a Home Assistantot, majd nyomj
`Ctrl+Shift+R`-t a böngészőben.

## Kézi integrációtelepítés

Másold a `custom_components/anthbot_genie_plus/` mappát ide:

```text
/config/custom_components/anthbot_genie_plus/
```

Ezután indítsd újra a Home Assistantot, és add hozzá az integrációt az
**Eszközök és szolgáltatások** oldalon.

## Minimális kártyabeállítás

A **Fejlesztői eszközök → Állapotok** oldalon keresd meg a térkép entitását.
Az entitásazonosító általában `_map` végződésű.

```yaml
type: custom:anthbot-map-card
entity: sensor.YOUR_MOWER_map
name: Anthbot Map
image: /local/garden.jpg
height: 720
fit: cover
robot_heading_source: cloud
refresh_interval: 2
show_zones: true
show_mowed_path: true
show_decoded_boundary: true
```

A `sensor.YOUR_MOWER_map` helyére írd a saját entitásazonosítódat. A háttérkép
nem kötelező. Ha használod, másold például a `/config/www/garden.jpg` helyre,
majd a kártyán `/local/garden.jpg` néven hivatkozz rá.

## A térkép kalibrálása

1. Nyisd meg a kártyát, majd válts teljes térképes nézetre.
2. Nyisd meg a **Beállítások** panelt.
3. Igazítsd a térképet, a robotot és a dekódolt határvonalat a fényképhez.
4. Másold ki az elkészített YAML-konfigurációt.
5. Cseréld le vele a kártya jelenlegi beállítását.

A kalibráció minden kertnél egyedi. Példa:

```yaml
calibration:
  offsetX: 0
  offsetY: 0
  scaleX: 1
  scaleY: 1
  rotation: 0
robotCalibration:
  offsetX: 0
  offsetY: 0
  scaleX: 1
  rotation: 0
decodedBoundaryCalibration:
  offsetX: 0
  offsetY: 0
  scaleX: 1
  scaleY: 1
  rotation: 0
```

A kalibrációs blokkokban a forgatás értéke radiánban értendő.

## A robot iránya

Ajánlott beállítás:

```yaml
robot_heading_source: cloud
```

A hivatalos Anthbot alkalmazás a `pose.yaw` értéket milliradiánként kezeli.
A kártya ugyanazt az átváltást használja:

```text
fok = yaw * 180 / (pi * 1000)
```

Választható irányforrások:

- `cloud` – a hivatalos alkalmazással megegyező `pose.yaw`; ajánlott
- `movement` – az irány kiszámítása az egymást követő pozíciókból
- `auto` – elsődlegesen a mozgás iránya, tartalékként a felhőből érkező irány

Ha a robot képe fix szögeltéréssel jelenik meg:

```yaml
robot_heading_offset: 0
robot_image_rotation: 90
```

Mindkét érték fokban értendő.

## Nyelv kiválasztása

Alapértelmezésben a kártya a Home Assistant kezelőfelületének nyelvét követi.
A kártya **Beállítások** paneljén ettől eltérő nyelv is választható. A választás
a böngészőben megmarad, és a kimásolt YAML-ba is bekerül.

```yaml
language: auto
```

Elérhető nyelvek: angol, magyar, német, francia, spanyol, olasz, portugál,
holland, lengyel, cseh, szlovák, román, dán, svéd, norvég, finn, egyszerűsített
kínai és hagyományos kínai. Nem támogatott nyelvnél a kártya angolra vált.

## Frissítés

### Csak térkép mód

Floorplan fölötti megjelenítéshez a kártya minden kezelőeleme elrejthető:

```yaml
map_only: true
transparent_background: true
```

A `transparent_background` eltávolítja a háttérképet és a vászon kitöltését,
de a háttérkép oldalarányát és kalibrációját továbbra is felhasználja a pontos
floorplan-illesztéshez.

Mindkét opció kapcsolható a **Felület beállítások** fülön. A választás az adott
böngészőben megmarad. Csak térkép módban dupla kattintással vagy dupla
koppintással visszahozható a teljes kezelőfelület.

### Egyedi gombműveletek

A `start`, `stop`, `dock`, `outer-edge`, `dock-edge` és `connect` gombokhoz
tetszőleges Home Assistant service vagy script rendelhető. Például zárt
fűnyíróház felnyitását és ellenőrzését végző script indításához:

```yaml
button_actions:
  start:
    service: script.anthbot_biztonsagos_inditas
  dock:
    service: script.anthbot_biztonsagos_toltes
```

A nem felülírt gombok továbbra is a gyári Anthbot műveletet használják.

A kártyafájlok frissítése után módosítsd a Lovelace-erőforrás címének végén a
verziószámot, hogy a böngésző ne a régi fájlt használja, majd indítsd újra a
Home Assistantot és nyomj `Ctrl+Shift+R`-t.

## Hibaelhárítás

### A kártya nem található

- ellenőrizd, hogy az erőforrás típusa JavaScript module
- ellenőrizd a `/config/www/anthbot-map/anthbot-map-card.js` fájlt
- nyisd meg közvetlenül a `/local/anthbot-map/anthbot-map-card.js?v=92` címet
- frissítsd az oldalt `Ctrl+Shift+R` használatával

### Nem látható a térkép vagy a robot

- ellenőrizd, hogy a térképentitás állapota `ready`
- nézd meg, hogy az attribútumok között van-e `pose` és `area_definition`
- várd meg a következő felhőfrissítést
- ellenőrizd a Home Assistant naplójában az `anthbot_genie_plus` bejegyzéseket

### Az irány csak körülbelül −40° és +40° között változik

A böngésző valószínűleg régebbi kártyaverziót használ. A 79-es verzió már
helyesen váltja át a milliradiánt. Frissítsd az erőforrás címét, majd nyomj
`Ctrl+Shift+R`-t.

## Hibabejelentés

Hibát itt jelenthetsz:
[github.com/Mqbretrofit/ha-anthbot-map/issues](https://github.com/Mqbretrofit/ha-anthbot-map/issues).

Soha ne tegyél közzé jelszót, tokent, robot-sorozatszámot, PIN-kódot,
GPS-koordinátát, kertfotót vagy kitakarás nélküli diagnosztikai fájlt.

## Köszönet és felhasznált projektek

- [vincentjanv/anthbot_genie_ha](https://github.com/vincentjanv/anthbot_genie_ha)
- [AdrianTIonut/anthbot_genie_ha](https://github.com/AdrianTIonut/anthbot_genie_ha)
- [reloxx13/ioBroker.anthbot-genie](https://github.com/reloxx13/ioBroker.anthbot-genie)

## Licenc

MIT – lásd a [LICENSE](LICENSE) fájlt.
