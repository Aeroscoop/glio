import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderManifest, renderBlock } from '../src/iso/index.js';
import { renderVoxels } from '../src/iso/render.js';
import { generateVoxels, activeVoxels } from '../src/iso/voxels.js';
import { assignRadialBands } from '../src/iso/colors.js';
import { labelClusters } from '../src/iso/ccl.js';
import { createRng } from '../src/iso/prng.js';
import { THEMES, STROKE_WIDTH_ERROR } from '../src/iso/palette.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../manifest/${p}`, import.meta.url)));
const digest = read('examples/digest.json');
const m = (extra) => ({ ...digest, ...extra });

test('zelfde manifest geeft exact dezelfde SVG', () => {
  for (const f of ['examples/digest.json', 'examples/google-agenda.json', 'demo/demo-uptime-wacht.json']) {
    const a = renderManifest(read(f));
    const b = renderManifest(JSON.parse(JSON.stringify(read(f))));
    assert.equal(a.svg, b.svg, f);
    assert.deepEqual(a.stats, b.stats);
  }
});

test('renderer gebruikt geen toeval en geen DOM', () => {
  for (const f of fs.readdirSync(new URL('../src/iso/', import.meta.url))) {
    const src = fs.readFileSync(new URL(`../src/iso/${f}`, import.meta.url), 'utf8');
    assert.ok(!/Math\.random|document\.|window\./.test(src), f);
  }
});

test('ander id geeft andere details, zelfde grootte en kleuren', () => {
  const a = renderManifest(digest), b = renderManifest(m({ id: 'digest-2' }));
  assert.notEqual(a.svg, b.svg);
  assert.equal(a.stats.gridSize, b.stats.gridSize);
  assert.deepEqual(a.params.bandColors, b.params.bandColors);
});

test('SVG is netjes: één root, unieke id\'s, geldige getallen', () => {
  const { svg } = renderManifest(read('demo/demo-huis-brug.json'));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[-\d. ]+">/);
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(!/NaN|Infinity|undefined/.test(svg));
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((x) => x[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), ref);
  assert.ok(ids.every((id) => id.startsWith('iso-demo-huis-brug-')));
});

test('status bepaalt weergave en lijnen', () => {
  const stable = renderManifest(m({ status: 'stable' }));
  const dev = renderManifest(m({ status: 'dev' }));
  const error = renderManifest(m({ status: 'error' }));
  const shape = (r) => r.svg.slice(r.svg.indexOf('<g class="iso-shape">'));
  assert.ok(!/stroke=/.test(shape(stable)), 'stable: geen lijnen');
  assert.ok(shape(dev).includes(`stroke="${THEMES.dark.bg}"`), 'dev: naden in achtergrondkleur');
  assert.ok(shape(error).includes(`stroke="${THEMES.dark.err}"`), 'error: foutkleur');
  assert.ok(shape(error).includes(`stroke-width="${STROKE_WIDTH_ERROR}"`));
  assert.equal(STROKE_WIDTH_ERROR, 1.2);
  // Versmolten = minder paden dan losse blokjes; per vlak in grid-mode precies één pad.
  assert.ok(stable.stats.paths < dev.stats.paths);
  assert.equal(dev.stats.paths, dev.stats.faces);
});

function model(N, symmetry, seed, bands = 3) {
  const grid = generateVoxels(N, 0.55, symmetry, createRng(seed));
  const { colorGrid } = assignRadialBands(grid, bands);
  return { grid, colorGrid, ...labelClusters(grid, colorGrid) };
}

test('symmetrie klopt in het raster', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    for (const N of [3, 4, 5, 6, 7]) {
      const k = N - 1;
      const mx = model(N, 'mirror-x', seed).grid;
      const mxy = model(N, 'mirror-xy', seed).grid;
      const rot = model(N, 'rotational', seed).grid;
      for (const [x, y, z] of activeVoxels(mx)) assert.ok(mx[k - x][y][z]);
      for (const [x, y, z] of activeVoxels(mxy)) assert.ok(mxy[k - x][y][z] && mxy[x][k - y][z]);
      for (const [x, y, z] of activeVoxels(rot)) assert.ok(rot[k - y][x][z]);
    }
  }
});

test('vuldichtheid blijft ongeveer 0.55, ook met symmetrie', () => {
  for (const sym of ['none', 'mirror-x', 'mirror-xy', 'rotational']) {
    let sum = 0;
    for (let i = 0; i < 20; i++) sum += activeVoxels(model(6, sym, `s${i}`).grid).length / 216;
    const avg = sum / 20;
    assert.ok(avg > 0.5 && avg < 0.65, `${sym}: ${avg.toFixed(2)}`);
  }
});

test('elke band heeft minstens één voxel, gelijke afstand blijft samen', () => {
  for (const seed of ['p', 'q', 'r']) {
    const { grid, colorGrid } = model(5, 'mirror-x', seed, 5);
    const counts = [0, 0, 0, 0, 0];
    for (const [x, y, z] of activeVoxels(grid)) {
      counts[colorGrid[x][y][z]]++;
      assert.equal(colorGrid[x][y][z], colorGrid[4 - x][y][z], 'spiegelbeeld in dezelfde band');
    }
    assert.ok(counts.every((c) => c > 0), counts.join('/'));
  }
});

test('elke band is zichtbaar in de echte en demomodules', () => {
  const files = ['examples/digest.json', 'examples/google-agenda.json',
    ...read('demo/index.json').files.map((f) => `demo/${f}`)];
  for (const f of files) {
    const r = renderManifest(read(f));
    assert.equal(r.stats.bands, r.params.bands, f);
    const shown = new Set([...r.svg.matchAll(/id="[^"]+-c(\d+)[tlr]"/g)].map((x) => Number(x[1])));
    assert.ok(shown.size >= r.stats.bands, f);
  }
});

test('tegel aan/uit en vaste lijst', () => {
  assert.ok(renderManifest(digest).svg.includes('class="iso-tile"'));
  assert.ok(!renderManifest(digest, { tile: false }).svg.includes('class="iso-tile"'));
  const small = renderManifest(m({ size: { lines: 10, files: 1 } }));
  const big = renderManifest(m({ size: { lines: 9000, files: 9 } }));
  assert.deepEqual(small.viewBox.slice(2), big.viewBox.slice(2), 'vaste lijst: zelfde maat, zodat grootte vergelijkbaar is');
  const fit = renderManifest(m({ size: { lines: 10, files: 1 } }), { frame: 'fit' });
  assert.ok(fit.viewBox[2] < small.viewBox[2]);
});

test('één losse kubus: drie vlakken, drie lussen', () => {
  const r = renderBlock(2);
  assert.equal(r.stats.faces, 3);
  assert.equal(r.stats.loops, 3);
});

test('twee kubussen naast elkaar in één cluster smelten tot drie vlakken', () => {
  const N = 2;
  const grid = [[[true, false], [true, false]], [[false, false], [false, false]]]; // (0,0,0) en (0,1,0)
  const colorGrid = grid.map((p) => p.map((r) => r.map((v) => (v ? 0 : -1))));
  const { clusterGrid, clusters } = labelClusters(grid, colorGrid);
  assert.equal(clusters.length, 1);
  const fused = renderVoxels({ grid, colorGrid, clusterGrid, clusters }, { tile: false, glow: false, mode: 'fused' });
  const loose = renderVoxels({ grid, colorGrid, clusterGrid, clusters }, { tile: false, glow: false, mode: 'grid' });
  assert.equal(fused.stats.paths, 3, 'boven, links en rechts elk één vorm');
  assert.equal(loose.stats.paths, 5);
  assert.equal(N, grid.length);
});
