// Isometrische SVG-renderer. Puur: geen DOM, geen toeval, zelfde invoer = exact dezelfde string.
//
// Basis uit isofusion-studio (MIT): projectie met cos30/sin30, zichtbare vlakken TOP/LEFT/RIGHT,
// fusie per cluster + vlaktype + vlakdiepte (coplanar) met randen die tegen elkaar wegvallen,
// één linearGradient per cluster over de bounding box van die cluster.
//
// Verschil met de referentie: in plaats van painter's sort bepalen we per driehoek van het
// isometrische rooster welk vlak vooraan ligt. Elk vlak bestaat uit twee van zulke driehoeken.
// Zo overlappen samengesmolten vlakken nooit, en randen matchen exact (gehele roostercoördinaten).

import {
  GRADIENTS, THEMES, DEFAULT_THEME, SHADE, SHADE_BASE, mix, themeVar,
  GLOW_OPACITY, STROKE_WIDTH_ERROR, STROKE_WIDTH_SEAM,
} from './palette.js';
import { makeGrid } from './voxels.js';

const COS30 = 0.8660254037844386;
export const MAX_GRID = 7;

const TILE_MARGIN = 1;      // lege rand op de tegel rond het raster, in voxels
const TILE_DEPTH = 0.35;    // dikte van het membraan (zijkant van de tegel)
const PAD = 12;             // ruimte rond de vorm in de viewBox, in px

// Roostercoördinaten: u = x - y, v = x + y - 2z (altijd gehele getallen).
// Scherm: px = u * T * cos30, py = v * T / 2.
const toUV = ([x, y, z]) => [x - y, x + y - 2 * z];

function faceCorners(type, x, y, z) {
  if (type === 'TOP') return [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]];
  if (type === 'LEFT') return [[x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z], [x, y + 1, z]];
  return [[x + 1, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1]];
}

// Splits een vlak langs de korte diagonaal; dat is een lijn van het driehoeksrooster.
function faceTriangles(v3) {
  const uv = v3.map(toUV);
  const len = (a, b) => 3 * (uv[a][0] - uv[b][0]) ** 2 + (uv[a][1] - uv[b][1]) ** 2;
  const idx = len(0, 2) <= len(1, 3) ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
  return idx.map((t) => {
    let pts = t.map((i) => uv[i]);
    const cross = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
    if (cross < 0) pts = [pts[0], pts[2], pts[1]]; // altijd dezelfde draairichting
    return {
      pts,
      key: `${pts[0][0] + pts[1][0] + pts[2][0]},${pts[0][1] + pts[1][1] + pts[2][1]}`,
      depth: t.reduce((s, i) => s + v3[i][0] + v3[i][1] + v3[i][2], 0),
    };
  });
}

// Randen van driehoeken in één groep: gedeelde randen vallen weg, de rest wordt contourlussen.
function contours(triangles) {
  const edges = new Map();
  for (const t of triangles) {
    for (let i = 0; i < 3; i++) {
      const a = t.pts[i], b = t.pts[(i + 1) % 3];
      const ka = a.join(','), kb = b.join(',');
      const reverse = `${kb}>${ka}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${ka}>${kb}`, { a, b, ka, kb });
    }
  }
  const outgoing = new Map();
  for (const e of edges.values()) {
    if (!outgoing.has(e.ka)) outgoing.set(e.ka, []);
    outgoing.get(e.ka).push(e);
  }
  const used = new Set();
  const loops = [];
  for (const start of edges.values()) {
    if (used.has(start)) continue;
    used.add(start);
    const loop = [start.a];
    let cur = start;
    while (cur.kb !== start.ka) {
      const next = (outgoing.get(cur.kb) || []).find((e) => !used.has(e));
      if (!next) break;
      used.add(next);
      loop.push(next.a);
      cur = next;
    }
    loops.push(simplify(loop));
  }
  return loops.filter((l) => l.length >= 3);
}

// Haal punten weg die op een rechte lijn liggen.
function simplify(loop) {
  let pts = loop;
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[(i - 1 + pts.length) % pts.length], q = pts[i], r = pts[(i + 1) % pts.length];
      if ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) === 0) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

const fmt = (n) => {
  const s = n.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
};

function makeProjector(tileSize) {
  const H = tileSize * COS30, V = tileSize / 2;
  return ([u, v]) => [u * H, v * V];
}

function pathD(loops, project) {
  return loops.map((l) => 'M' + l.map((p) => project(p).map(fmt).join(',')).join('L') + 'Z').join('');
}

// fill/stroke met vaste hex (werkt overal) én een CSS-variabele (volgt het thema in de pagina).
function themed(prop, key) {
  return `${prop}="${THEMES[DEFAULT_THEME][key]}" style="${prop}:${themeVar(key)}"`;
}

function renderTile(N, project, idPrefix) {
  const lo = -TILE_MARGIN, hi = N + TILE_MARGIN;
  const P = (x, y, z) => project(toUV([x, y, z])).map(fmt).join(',');
  const top = `M${P(lo, lo, 0)}L${P(hi, lo, 0)}L${P(hi, hi, 0)}L${P(lo, hi, 0)}Z`;
  const d = -TILE_DEPTH;
  const left = `M${P(lo, hi, 0)}L${P(hi, hi, 0)}L${P(hi, hi, d)}L${P(lo, hi, d)}Z`;
  const right = `M${P(hi, lo, 0)}L${P(hi, hi, 0)}L${P(hi, hi, d)}L${P(hi, lo, d)}Z`;
  let grid = '';
  for (let i = lo + 1; i < hi; i++) {
    grid += `M${P(i, lo, 0)}L${P(i, hi, 0)}M${P(lo, i, 0)}L${P(hi, i, 0)}`;
  }
  const dark = THEMES[DEFAULT_THEME];
  const sideL = mix(dark.line, 0.7, dark.bg);
  const sideR = mix(dark.line, 0.9);
  return `<g class="iso-tile" id="${idPrefix}tile">`
    + `<path d="${left}" fill="${sideL}" style="fill:color-mix(in srgb,${themeVar('line')} 70%,${themeVar('bg')})"/>`
    + `<path d="${right}" fill="${sideR}" style="fill:color-mix(in srgb,${themeVar('line')} 90%,${SHADE_BASE})"/>`
    + `<path d="${top}" fill="${dark.cell}" stroke="${dark.line}" stroke-width="1" style="fill:${themeVar('cell')};stroke:${themeVar('line')}"/>`
    + `<path d="${grid}" fill="none" stroke="${dark.line}" stroke-width="0.7" opacity="0.7" style="stroke:${themeVar('line')}"/>`
    + '</g>';
}

function frameBox(N, frameN, tileSize, project, bounds) {
  if (bounds) {
    return [bounds.minX - PAD, bounds.minY - PAD, bounds.maxX - bounds.minX + 2 * PAD, bounds.maxY - bounds.minY + 2 * PAD];
  }
  // Vaste lijst: groot genoeg voor het grootste raster, gecentreerd op het midden van deze tegel.
  // Zo zie je het verschil in grootte tussen modules.
  const F = frameN, m = TILE_MARGIN;
  const uMax = F + 2 * m;
  const vTop = N - 3 * F - 2 * m;
  const vBottom = N + F + 2 * m + 2 * TILE_DEPTH;
  const [x0, y0] = project([-uMax, vTop]);
  const [x1, y1] = project([uMax, vBottom]);
  return [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD];
}

// Zichtbare vlakken: eerst vlakken met een lege buur, dan per roosterdriehoek het vlak
// dat het dichtst bij de kijker ligt (grootste x+y+z).
function visibleFaces(grid, clusterGrid = null) {
  const N = grid.length;
  const solid = (x, y, z) => x < N && y < N && z < N && grid[x][y][z];
  const faces = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (!grid[x][y][z]) continue;
    const cluster = clusterGrid ? clusterGrid[x][y][z] : -1;
    if (!solid(x, y, z + 1)) faces.push({ type: 'TOP', plane: z + 1, x, y, z, cluster });
    if (!solid(x, y + 1, z)) faces.push({ type: 'LEFT', plane: y + 1, x, y, z, cluster });
    if (!solid(x + 1, y, z)) faces.push({ type: 'RIGHT', plane: x + 1, x, y, z, cluster });
  }
  const front = new Map();
  faces.forEach((f, fi) => {
    for (const t of faceTriangles(faceCorners(f.type, f.x, f.y, f.z))) {
      const cur = front.get(t.key);
      if (!cur || t.depth > cur.depth) front.set(t.key, { ...t, face: fi });
    }
  });
  return { faces, front };
}

// Voxels waarvan minstens een stukje te zien is, als "x,y,z".
export function visibleVoxelKeys(grid) {
  const { faces, front } = visibleFaces(grid);
  const keys = new Set();
  for (const t of front.values()) {
    const f = faces[t.face];
    keys.add(`${f.x},${f.y},${f.z}`);
  }
  return keys;
}

/**
 * @param {object} model   { grid, colorGrid, clusterGrid, clusters }
 * @param {object} options
 *   bandColors  paletindex per band (band 0 = kern)
 *   mode        'fused' | 'grid'
 *   stroke      null | 'seam' | 'error'
 *   tile        isometrische tegel (cel) eronder, standaard true
 *   glow        zachte gloed in de kernkleur, standaard true
 *   frame       'fixed' (vaste maat, grootte vergelijkbaar) | 'fit' (strak om de vorm)
 *   idPrefix    voorvoegsel voor id's in de SVG (uniek per module in één pagina)
 *   tileSize    px per voxel
 */
export function renderVoxels(model, options = {}) {
  const {
    bandColors = [0], mode = 'fused', stroke = null, tile = true, glow = true,
    frame = 'fixed', idPrefix = 'iso-', tileSize = 24,
  } = options;
  const { grid, colorGrid, clusterGrid, clusters } = model;
  const N = grid.length;
  const project = makeProjector(tileSize);

  const { faces, front } = visibleFaces(grid, clusterGrid);

  // 3. Groeperen: fused = cluster + vlaktype + vlakdiepte; grid = elk vlak apart.
  const groups = new Map();
  const shownFaces = new Set();
  for (const t of front.values()) {
    const f = faces[t.face];
    shownFaces.add(t.face);
    const key = mode === 'fused' ? `${f.cluster}|${f.type}|${f.plane}` : `f${t.face}`;
    if (!groups.has(key)) groups.set(key, { cluster: f.cluster, type: f.type, depth: -Infinity, tris: [] });
    const g = groups.get(key);
    g.tris.push(t);
    g.depth = Math.max(g.depth, t.depth);
  }

  // 4. Bounding box per cluster (voor de gradient) en van de hele vorm.
  const cb = new Map();
  const all = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = (b, [px, py]) => {
    b.minX = Math.min(b.minX, px); b.maxX = Math.max(b.maxX, px);
    b.minY = Math.min(b.minY, py); b.maxY = Math.max(b.maxY, py);
  };
  for (const g of groups.values()) {
    if (!cb.has(g.cluster)) cb.set(g.cluster, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    for (const t of g.tris) for (const p of t.pts) {
      const s = project(p);
      grow(cb.get(g.cluster), s);
      grow(all, s);
    }
  }

  // 5. Gradients: per cluster één richting, in drie tinten (boven, links, rechts).
  const shadeKey = { TOP: 't', LEFT: 'l', RIGHT: 'r' };
  const usedGrads = new Set();
  for (const g of groups.values()) usedGrads.add(`${g.cluster}|${g.type}`);
  let defs = '';
  for (const k of [...usedGrads].sort((a, b) => {
    const [ca, ta] = a.split('|'), [cb2, tb] = b.split('|');
    return Number(ca) - Number(cb2) || ta.localeCompare(tb);
  })) {
    const [cid, type] = k.split('|');
    const cluster = clusters[Number(cid)];
    const pal = GRADIENTS[bandColors[cluster.color] ?? 0];
    const b = cb.get(Number(cid));
    const amt = SHADE[type];
    defs += `<linearGradient id="${idPrefix}c${cid}${shadeKey[type]}" gradientUnits="userSpaceOnUse"`
      + ` x1="${fmt(b.minX)}" y1="${fmt(b.minY)}" x2="${fmt(b.maxX)}" y2="${fmt(b.maxY)}">`
      + `<stop offset="0" stop-color="${mix(pal.stop1, amt)}"/><stop offset="1" stop-color="${mix(pal.stop2, amt)}"/>`
      + '</linearGradient>';
  }

  // 6. Paden, van achter naar voor (alleen van belang voor lijnen).
  const ordered = [...groups.values()].sort((a, b) => a.depth - b.depth);
  let strokeAttr = '';
  if (stroke === 'error') {
    strokeAttr = ` ${themed('stroke', 'err')} stroke-width="${STROKE_WIDTH_ERROR}" stroke-linejoin="round"`;
  } else if (stroke === 'seam') {
    strokeAttr = ` ${themed('stroke', 'bg')} stroke-width="${STROKE_WIDTH_SEAM}" stroke-linejoin="round"`;
  }
  let body = '';
  let loopCount = 0;
  for (const g of ordered) {
    const loops = contours(g.tris);
    loopCount += loops.length;
    body += `<path d="${pathD(loops, project)}" fill="url(#${idPrefix}c${g.cluster}${shadeKey[g.type]})" fill-rule="evenodd"${strokeAttr}/>`;
  }

  // 7. Gloed en tegel.
  let under = '';
  if (tile) under += renderTile(N, project, idPrefix);
  if (glow && faces.length) {
    const core = GRADIENTS[bandColors[0] ?? 0].stop1;
    const [cx, cy] = project(toUV([N / 2, N / 2, 0]));
    const rx = (N + TILE_MARGIN) * tileSize * COS30;
    defs += `<radialGradient id="${idPrefix}glow"><stop offset="0" stop-color="${core}" stop-opacity="${GLOW_OPACITY}"/>`
      + `<stop offset="1" stop-color="${core}" stop-opacity="0"/></radialGradient>`;
    under += `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(rx * 0.58)}" fill="url(#${idPrefix}glow)"/>`;
  }

  const viewBox = frame === 'fit' && isFinite(all.minX)
    ? frameBox(N, N, tileSize, project, all)
    : frameBox(N, frame === 'fit' ? N : MAX_GRID, tileSize, project, null);
  const vb = viewBox.map(fmt).join(' ');
  const inner = `<defs>${defs}</defs>${under}<g class="iso-shape">${body}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;

  let voxelCount = 0;
  for (const c of clusters) voxelCount += c.size;
  return {
    svg,
    inner,
    viewBox,
    stats: {
      voxels: voxelCount,
      clusters: clusters.length,
      faces: shownFaces.size,
      loops: loopCount,
      paths: groups.size,
    },
  };
}

// Eén los kubusje in één kleur, bijv. voor een bron buiten de module.
export function renderBlock(colorIndex, options = {}) {
  const grid = makeGrid(1, true);
  const colorGrid = makeGrid(1, 0);
  const clusterGrid = makeGrid(1, 0);
  return renderVoxels(
    { grid, colorGrid, clusterGrid, clusters: [{ id: 0, color: 0, size: 1 }] },
    { tile: false, glow: false, frame: 'fit', ...options, bandColors: [colorIndex] },
  );
}
