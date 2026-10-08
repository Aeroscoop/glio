import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { measure, writeSize } from '../tools/measure.js';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'glio-measure-'));
}

test('telt code in een map, slaat node_modules, .git en lege regels over', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'main.py'), 'import os\n\n\nprint(1)\n   \n');
  fs.mkdirSync(path.join(dir, 'lib'));
  fs.writeFileSync(path.join(dir, 'lib', 'util.js'), 'export const a = 1;\nexport const b = 2;\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# geen code\n');
  fs.writeFileSync(path.join(dir, 'data.json'), '{"a": 1}\n');
  for (const skip of ['node_modules', '.git', '__pycache__']) {
    fs.mkdirSync(path.join(dir, skip));
    fs.writeFileSync(path.join(dir, skip, 'x.js'), 'a\nb\nc\n');
  }
  assert.deepEqual(measure(dir), { lines: 4, files: 2 });
});

test('werkt op één los script zonder extensie (check_digest)', () => {
  const dir = tmpdir();
  const file = path.join(dir, 'check_digest');
  fs.writeFileSync(file, '#!/usr/bin/env python3\n\nprint("hoi")\n');
  assert.deepEqual(measure(file), { lines: 2, files: 1 });
  assert.deepEqual(measure(dir), { lines: 2, files: 1 });
});

test('bestand zonder extensie en zonder #! telt niet mee in een map', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n');
  assert.deepEqual(measure(dir), { lines: 0, files: 0 });
});

test('writeSize zet size in het manifest en houdt de volgorde', () => {
  const dir = tmpdir();
  const p = path.join(dir, 'm.json');
  fs.writeFileSync(p, JSON.stringify({ id: 'x', status: 'dev', size: { lines: 1, files: 1 }, demo: false }));
  writeSize(p, { lines: 42, files: 3 });
  const out = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(Object.keys(out), ['id', 'status', 'size', 'demo']);
  assert.deepEqual(out.size, { lines: 42, files: 3 });
  fs.writeFileSync(p, JSON.stringify({ id: 'x', demo: false }));
  writeSize(p, { lines: 5, files: 1 });
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(p, 'utf8'))), ['id', 'size', 'demo']);
});
