#!/usr/bin/env node
// Telt regels code en bestanden in een modulemap (of één los script) en schrijft `size` in een manifest.
//
//   node tools/measure.js <map-of-script>                  print { lines, files }
//   node tools/measure.js <map-of-script> <manifest.json>  schrijft size in het manifest
//
// Telt alleen code: bekende code-extensies, of bestanden zonder extensie met een #!-regel.
// Slaat node_modules, .git, __pycache__ en virtualenvs over, en lege regels.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.sh', '.bash', '.zsh',
  '.rb', '.go', '.rs', '.php', '.lua', '.pl', '.java', '.kt', '.c', '.h', '.cpp', '.cs', '.swift',
]);
export const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', '.mypy_cache', '.pytest_cache']);

function isCode(file) {
  const ext = path.extname(file).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return true;
  if (ext !== '') return false;
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(2);
    return fs.readSync(fd, buf, 0, 2, 0) === 2 && buf.toString() === '#!';
  } finally {
    fs.closeSync(fd);
  }
}

function countLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '').length;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.isFile() && isCode(full)) {
      out.push(full);
    }
  }
  return out;
}

export function measure(target) {
  const stat = fs.statSync(target);
  const files = stat.isDirectory() ? walk(target, []) : [target];
  let lines = 0;
  for (const f of files) lines += countLines(f);
  return { lines, files: files.length };
}

// Zet size in het manifest; behoudt de volgorde van de andere velden.
export function writeSize(manifestPath, size) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(manifest)) {
    if (k === 'size') { out.size = size; placed = true; continue; }
    if (k === 'demo' && !placed) { out.size = size; placed = true; }
    out[k] = v;
  }
  if (!placed) out.size = size;
  fs.writeFileSync(manifestPath, JSON.stringify(out, null, 2) + '\n');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [target, manifestPath] = process.argv.slice(2);
  if (!target) {
    console.error('Gebruik: node tools/measure.js <map-of-script> [manifest.json]');
    process.exit(1);
  }
  const size = measure(target);
  if (manifestPath) {
    writeSize(manifestPath, size);
    console.log(`${manifestPath}: size = ${JSON.stringify(size)}`);
  } else {
    console.log(JSON.stringify(size));
  }
}
