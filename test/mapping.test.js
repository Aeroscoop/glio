import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  gridSizeFor, bandsFor, displayFor, symmetryFor, connectionColors,
  manifestToParams, validateManifest, STATUSES, CONNECTION_TYPES,
} from '../src/iso/mapping.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../manifest/${p}`, import.meta.url)));
const base = (extra = {}) => ({
  id: 'test', name: 'Test', version: '0.1.0', status: 'stable', schedule: null, connections: [], ...extra,
});

test('grootte → raster', () => {
  assert.deepEqual([0, 99, 100, 299, 300, 999, 1000, 2999, 3000, 99999].map(gridSizeFor), [3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
});

test('connecties → banden, max 5', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(bandsFor), [1, 2, 3, 4, 5, 5, 5]);
});

test('status → weergave', () => {
  assert.deepEqual(displayFor('stable'), { mode: 'fused', stroke: null });
  assert.deepEqual(displayFor('dev'), { mode: 'grid', stroke: 'seam' });
  assert.deepEqual(displayFor('error'), { mode: 'grid', stroke: 'error' });
});

test('draaifrequentie → symmetrie', () => {
  assert.equal(symmetryFor(null), 'none');
  assert.equal(symmetryFor(1440), 'rotational');
  assert.equal(symmetryFor(24), 'rotational');
  assert.equal(symmetryFor(23.9), 'mirror-xy');
  assert.equal(symmetryFor(1), 'mirror-xy');
  assert.equal(symmetryFor(1 / 7), 'mirror-x');
  assert.equal(symmetryFor(0), 'mirror-x');
});

test('bekende bronnen houden hun kleur, onbekende krijgen de volgende vrije', () => {
  const c = (names) => connectionColors(names.map((name) => ({ name, type: 'http' })));
  assert.deepEqual(c(['freshrss', 'syncthing']), [2, 5]);
  assert.deepEqual(c(['gcal', 'syncthing']), [4, 5]);
  assert.deepEqual(c(['orchestrator']), [3]);
  assert.deepEqual(c(['weer-api', 'syncthing']), [1, 5]);
  assert.deepEqual(c(['a', 'freshrss', 'b', 'c']), [1, 2, 3, 4]);
  assert.deepEqual(c(['FreshRSS']), [2]);
});

test('manifest → parameters (digest)', () => {
  const p = manifestToParams(read('examples/digest.json'));
  assert.equal(p.seed, 'digest');
  assert.equal(p.gridSize, 4);
  assert.equal(p.density, 0.55);
  assert.equal(p.bands, 3);
  assert.deepEqual(p.bandColors, [0, 2, 5]);
  assert.equal(p.mode, 'fused');
  assert.equal(p.runsPerDay, 48);
  assert.equal(p.symmetry, 'rotational');
  assert.deepEqual(p.warnings, []);
});

test('band-volgorde volgt de lijst, niet de kleur', () => {
  const p = manifestToParams(base({ connections: [{ name: 'syncthing', type: 'file' }, { name: 'freshrss', type: 'http' }] }));
  assert.deepEqual(p.bandColors, [0, 5, 2]);
});

test('meer dan 4 connecties: alleen de eerste 4 krijgen een band', () => {
  const conns = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name, type: 'other' }));
  const p = manifestToParams(base({ connections: conns, size: { lines: 10, files: 1 } }));
  assert.equal(p.bands, 5);
  assert.equal(p.bandColors.length, 5);
  assert.equal(p.warnings.length, 1);
});

test('ontbrekende size en kapot schema geven een waarschuwing, geen crash', () => {
  const p = manifestToParams(base({ schedule: 'kapot' }));
  assert.equal(p.gridSize, 3);
  assert.equal(p.symmetry, 'none');
  assert.equal(p.warnings.length, 2);
});

test('alle manifesten in de repo zijn geldig', () => {
  const demo = read('demo/index.json').files.map((f) => `demo/${f}`);
  for (const f of ['examples/digest.json', 'examples/google-agenda.json', ...demo]) {
    assert.deepEqual(validateManifest(read(f)), [], f);
  }
  assert.ok(demo.length >= 6 && demo.length <= 8);
  for (const f of demo) assert.equal(read(f).demo, true, `${f} moet demo: true hebben`);
});

test('schema en code gebruiken dezelfde waarden', () => {
  const schema = read('gliosoom.schema.json');
  assert.deepEqual(schema.properties.status.enum, STATUSES);
  assert.deepEqual(schema.properties.connections.items.properties.type.enum, CONNECTION_TYPES);
  assert.deepEqual(Object.keys(schema.properties).sort(),
    ['connections', 'demo', 'description', 'id', 'name', 'output', 'runtime', 'schedule', 'size', 'status', 'version']);
});

test('validateManifest vindt fouten', () => {
  const errs = validateManifest(base({ id: 'Fout ID', status: 'kapot', connections: [{ name: 'x', type: 'ftp' }], extra: 1 }));
  assert.equal(errs.length, 4);
});
