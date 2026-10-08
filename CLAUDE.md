# Glio — context voor Claude-sessies

## Wat is Glio
- Eigenaar: Melroy, freelancer met een homelab op Proxmox (LXC-containers).
- Glio is een hub die losse modules beheert. Een module heet een **gliosoom**.
  Glio = de cel, gliosomen = de onderdelen. Denk aan een klein gedistribueerd eventsysteem / data-broker.
- Doel: overzicht. Hoe en wanneer draait een module, waar gaat de JSON-uitvoer heen, met wie praat hij.
- Frictie die Glio moet wegnemen: per module inloggen in Proxmox, LXC starten, file browser installeren,
  script uploaden, cron instellen, rsync naar de Syncthing-LXC.
- Eindbeeld (nog niet gebouwd): webui op ip:poort met file browser, script-beheer, cron, status-dashboard;
  per module zien hoe vaak hij draait en met wie hij praat; templates zodat een AI-agent (Jules) snel
  modules bouwt met hub-connectie; later ook buiten het LAN (Syncthing-achtige module). Inspiratie: Windmill.
- Infra: Glio draait in een eigen LXC en stuurt uitvoer met rsync naar een aparte Syncthing-LXC.
- Eerste echte modules: `digest` (script check_digest) en `google-agenda` (iCal-feeds van Google Calendar).

## Visualisatie (vaste besluiten)
- Een gliosoom = isometrische kubusvorm uit voxels, **automatisch** uit het manifest (code → beeld). Nooit handmatig ontwerpen.
- De vorm moet je in één oogopslag leren lezen. Geen visuele ruis.
- Metafoor blijft biologisch. **Geen** gebouwen, steden of architectuur-vergelijkingen, ook niet in teksten.
- Blokken zonder lijnen ertussen; vlakken in hetzelfde vlak smelten samen; een isometrische tegel als "cel" eronder.
- Afgevallen: eiwitstructuren 1-op-1, karyogrammen.
- Algoritme komt uit isofusion-studio (cyrb128+sfc32, voxelgroei, CCL, coplanar fusie, gradient per cluster).
  Bewuste afwijkingen: groeidoel telt ná symmetrie (dichtheid blijft ~0.55), banden over zichtbare voxels,
  verborgen vlakken per roosterdriehoek i.p.v. painter's sort. Status dev = losse blokjes met naad in achtergrondkleur.
  Het vorm-algoritme uit het ontwerpbestand (keten + zijblokken) wordt **niet** gebruikt.
- Stijlbron: `glio-ontwerp-demo.html` (Newsreader + DM Mono, kop met cursieve "Glio", tekstlinks als navigatie,
  zijpaneel 290px, cel met rasterlijnen en membraan, bronkubusjes met stromende stippellijnen,
  vlakschaduw via mix met #0b1220: boven 100%, links 80%, rechts 60%). Pastelkleuren daaruit niet gebruiken.
- `index.html` (canvas-demo) blijft ongemoeid. De kubus-demo is `iso.html`.

## Techniek
- Vanilla JS, ES modules. **Geen** framework, TypeScript, Vite, build-stap of dependencies. Geen ESLint/Prettier/CI (nog).
- De renderer is een pure functie: manifest in → `{ svg, stats }` uit. Geen DOM, zodat hij in Node en later in de webui draait.
- Alle kleuren staan alleen in `src/iso/palette.js`.
- Tests: `node --test` (ingebouwde node:test).
- Demo openen: `python3 -m http.server 8000` en dan `http://localhost:8000/iso.html` (file:// blokkeert ES modules).

## Manifest → vorm (vast besluit, 4 parameters, zie `src/iso/mapping.js`)
1. `size.lines` → rastergrootte: <100 → 3, <300 → 4, <1000 → 5, <3000 → 6, anders 7. Vuldichtheid vast 0.55.
2. `connections.length` → kleurbanden = 1 + aantal, max 5. Radiaal: binnenste band = kern (de module zelf),
   elke band naar buiten = volgende connectie in lijstvolgorde. Banden worden verdeeld over de echte voxels
   (gesorteerd op afstand tot het midden, bij gelijke afstand x,y,z), elke band minstens één voxel.
   Bekende bronnen hebben een vaste kleur: freshrss → connectie 2, gcal → connectie 4,
   syncthing → reserve, orchestrator → connectie 3. Onbekende krijgen de volgende vrije kleur.
   Het connectie-`type` heeft nu nog geen visueel effect.
3. `status` → weergave: stable = fused + coplanar; dev = grid (losse blokjes); error = grid + lijnen in foutkleur, 1.2px.
4. `schedule` (cron) → symmetrie: ≥24 runs/dag rotational (4-voudig); ≥1 mirror-xy; <1 mirror-x; null (handmatig) none.
- Seed = `id`. De seed bepaalt alleen details van de groei. Zelfde manifest = exact dezelfde SVG.
- Later mogelijk (nu niet bouwen): versies, dependencies, complexiteit, systeembelasting.

## Bestanden
- `manifest/` schema, echte voorbeelden (`examples/`), verzonnen demomodules (`demo/`, met `demo/index.json`).
- `src/iso/` renderer: prng, voxels, colors, ccl, render, palette, mapping, cron; `index.js` = `renderManifest()`.
- `tools/measure.js` telt code-regels en bestanden, schrijft `size` in een manifest.
- `docs/visual-principles.md` legt uit hoe je een gliosoom leest.
