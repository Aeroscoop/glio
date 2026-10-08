# Zo lees je een gliosoom

Elke module in Glio heet een gliosoom. Op het scherm is een gliosoom een kleine vorm van
kubusjes (voxels) op een isometrische tegel: de cel. Die vorm teken je nooit zelf. Glio maakt
hem uit het manifest van de module. Zelfde manifest, zelfde vorm, elke keer.

Het idee: net zoals een dubbele helix meteen "DNA" zegt, moet een gliosoom in één blik vertellen
wat voor module het is. Dat leer je met wat oefening lezen.

## Principes

- **Code wordt beeld.** De vorm volgt uit het manifest. Niets is met de hand ontworpen.
- **Vier dingen, niet meer.** Grootte, connecties, status en schema. Al het andere blijft weg,
  zodat er geen visuele ruis is.
- **Rustig als het goed gaat.** Een stabiele module is één gladde vorm. Hoe meer losse
  blokjes of lijnen je ziet, hoe meer aandacht de module nodig heeft.
- **Een bron heeft overal één kleur.** In de vorm, in de stippellijn en in het kubusje van de bron.
- **De metafoor is biologisch.** Glio is de cel, gliosomen zijn de onderdelen erin.

## De koppeltabel

| Wat je ziet | Komt uit | Regel |
|---|---|---|
| **Hoe groot** de vorm is (en de tegel eronder) | `size.lines`, regels code | < 100 → 3×3×3 · < 300 → 4 · < 1000 → 5 · < 3000 → 6 · anders 7. Vuldichtheid altijd ongeveer 55%. |
| **Hoeveel kleuren**, van binnen naar buiten | `connections` | Kern + één kleurband per connectie, maximaal 5 banden. |
| **Glad of blokjes** | `status` | `stable`: vlakken smelten samen tot één gladde vorm. `dev`: losse blokjes. `error`: losse blokjes met rode lijnen. |
| **Hoe regelmatig** de vorm is | `schedule` (cron) | 24× per dag of vaker: 4-voudig draaiend. 1× per dag of vaker: gespiegeld in twee richtingen. Minder dan dagelijks: gespiegeld in één richting. Handmatig: geen symmetrie, organisch. |

### Grootte

Meer code geeft een groter raster. Alle vormen staan op dezelfde vaste maat, dus een kleine
module ziet er naast een grote ook echt klein uit. De tegel eronder groeit mee.

### Kleurbanden

De kleur in het midden is de **kern**: de module zelf (turquoise). Elke connectie voegt een
band toe, van binnen naar buiten, in de volgorde van de lijst in het manifest. De eerste
connectie zit dus het dichtst bij de kern, de laatste aan de buitenkant.

De banden worden verdeeld over de voxels die je echt kunt zien. Elke band heeft minstens
één zichtbaar blokje. Blokjes die even ver van het midden liggen (bijvoorbeeld elkaars
spiegelbeeld) krijgen dezelfde band.

Bekende bronnen hebben een vaste kleur:

| Bron | Kleur |
|---|---|
| kern (de module zelf) | turquoise → cyaan |
| FreshRSS (`freshrss`) | amber → oranje |
| Orchestrator (`orchestrator`) | roze → koraal |
| Google Agenda (`gcal`) | blauw → indigo |
| Syncthing-LXC (`syncthing`) | lichtgroen → groen |
| onbekende bron | de eerstvolgende vrije kleur (eerst violet), in lijstvolgorde |

Het **type** van een connectie (`file`, `http`, `webhook`, `exec`, `other`) heeft nu nog geen
effect op het beeld. Alleen de volgorde in de lijst bepaalt de band.

Heeft een module meer dan 4 connecties, dan krijgen alleen de eerste 4 een band. Glio geeft
dan een waarschuwing.

### Status

- **Stabiel**: vlakken die in hetzelfde vlak liggen en dezelfde kleur hebben, smelten samen.
  Je ziet een strakke vorm zonder lijnen.
- **In ontwikkeling**: elk blokje staat los, met een smalle naad ertussen.
- **Fout**: losse blokjes met lijnen in de foutkleur (1,2 px). Dit valt als enige meteen op.

### Schema

Hoe vaker een module draait, hoe regelmatiger de vorm:

- elke minuut, elke 5 minuten, elk kwartier, elk uur → **draaiend**: de vorm is gelijk als je hem een kwartslag draait
- dagelijks → **gespiegeld in twee richtingen**
- wekelijks of maandelijks → **gespiegeld in één richting**
- handmatig (`schedule: null`) → **organisch**, zonder symmetrie

Het aantal runs per dag is een schatting uit de cron-string (`src/iso/cron.js`).

### Wat de seed doet

De `id` van de module is de seed. Die bepaalt alleen de **details** van de groei: welke
blokjes er precies zijn. Grootte, kleuren, status en symmetrie komen altijd uit het manifest.
Twee modules met dezelfde vier waarden lijken dus op elkaar, maar zijn niet gelijk.

## Een voorbeeld

`digest` heeft 240 regels code, praat met FreshRSS en Syncthing, is stabiel en draait elke 30 minuten.

- 240 regels → raster 4×4×4
- 2 connecties → drie banden: turquoise kern, amber (FreshRSS), groen (Syncthing) aan de buitenkant
- stabiel → gladde, samengesmolten vlakken
- 48 runs per dag → 4-voudig draaiend

## Hoe de vorm ontstaat (techniek, kort)

1. Blokjes groeien vanaf het midden onderin naar buren (boven, onder, links, rechts, voor, achter),
   tot ongeveer 55% van het raster gevuld is. De symmetrie wordt meteen toegepast.
2. Elk blokje krijgt een kleurband op basis van de afstand tot het midden.
3. Aangrenzende blokjes met dezelfde kleur vormen een cluster.
4. Per stukje scherm wint het vlak dat vooraan ligt. Bij een stabiele module smelten de vlakken
   van één cluster die in hetzelfde vlak liggen samen tot één vorm.
5. Elke cluster krijgt één kleurverloop. De bovenkant krijgt de volle kleur, links 80% en rechts 60%
   (gemengd met donker blauwgrijs).

Basis: [isofusion-studio](https://github.com/Aeroscoop/isofusion-studio) (MIT). Afwijkingen:
het groeidoel telt na symmetrie (anders worden gespiegelde vormen massieve blokken), banden worden
over de zichtbare blokjes verdeeld, en verborgen vlakken worden per driehoek van het
isometrische rooster bepaald in plaats van met een tekenvolgorde.
