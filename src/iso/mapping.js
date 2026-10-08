// Manifest → renderparameters. Vast besluit: vier parameters (grootte, connecties, status, schema).
// Elke parameter is een losse regel in RULES. Latere parameters (versies, dependencies,
// complexiteit, systeembelasting) komen er als nieuwe regel bij, zonder de bestaande te raken.

import { runsPerDay } from './cron.js';
import { CORE_COLOR, CONNECTION_COLORS, KNOWN_SOURCE_COLORS } from './palette.js';

export const STATUSES = ['stable', 'dev', 'error'];
export const CONNECTION_TYPES = ['file', 'http', 'webhook', 'exec', 'other'];
export const DENSITY = 0.55;
export const MAX_BANDS = 5;

// Leesbare namen van bekende bronnen (de kleur staat in palette.js).
export const KNOWN_SOURCES = {
  freshrss: 'FreshRSS API',
  gcal: 'Google Agenda iCal',
  syncthing: 'Syncthing-LXC',
  orchestrator: 'Orchestrator',
};

export const sourceLabel = (name) => KNOWN_SOURCES[name.toLowerCase()] ?? name;

// 1. Grootte (size.lines) → rastergrootte.
export function gridSizeFor(lines) {
  if (lines < 100) return 3;
  if (lines < 300) return 4;
  if (lines < 1000) return 5;
  if (lines < 3000) return 6;
  return 7;
}

// 2. Connecties → aantal kleurbanden (kern + één per connectie, max 5).
export function bandsFor(connectionCount) {
  return Math.min(MAX_BANDS, 1 + connectionCount);
}

// Kleur per connectie: bekende bronnen vast, onbekende de volgende vrije kleur in lijstvolgorde.
export function connectionColors(connections) {
  const taken = new Set();
  const colors = connections.map((c) => {
    const known = KNOWN_SOURCE_COLORS[c.name.toLowerCase()];
    if (known !== undefined) taken.add(known);
    return known;
  });
  let rr = 0; // als alle kleuren op zijn: rondgaan
  return colors.map((known) => {
    if (known !== undefined) return known;
    const free = CONNECTION_COLORS.find((i) => !taken.has(i));
    const pick = free ?? CONNECTION_COLORS[rr++ % CONNECTION_COLORS.length];
    taken.add(pick);
    return pick;
  });
}

// 3. Status → weergave.
export function displayFor(status) {
  if (status === 'stable') return { mode: 'fused', stroke: null };
  if (status === 'dev') return { mode: 'grid', stroke: 'seam' };
  return { mode: 'grid', stroke: 'error' };
}

// 4. Draaifrequentie → symmetrie.
export function symmetryFor(perDay) {
  if (perDay === null) return 'none';
  if (perDay >= 24) return 'rotational';
  if (perDay >= 1) return 'mirror-xy';
  return 'mirror-x';
}

export const RULES = [
  function size(m, p) {
    const lines = m.size?.lines;
    if (typeof lines !== 'number') p.warnings.push('size ontbreekt: kleinste raster gebruikt');
    p.lines = typeof lines === 'number' ? lines : 0;
    p.gridSize = gridSizeFor(p.lines);
    p.density = DENSITY;
  },
  function connections(m, p) {
    const conns = m.connections ?? [];
    p.connections = conns.length;
    p.bands = bandsFor(conns.length);
    p.connectionColors = connectionColors(conns);
    p.bandColors = [CORE_COLOR, ...p.connectionColors.slice(0, p.bands - 1)];
    if (conns.length > MAX_BANDS - 1) {
      p.warnings.push(`${conns.length} connecties: alleen de eerste ${MAX_BANDS - 1} krijgen een band`);
    }
  },
  function status(m, p) {
    p.status = STATUSES.includes(m.status) ? m.status : 'error';
    if (p.status !== m.status) p.warnings.push(`onbekende status "${m.status}": als error getoond`);
    Object.assign(p, displayFor(p.status));
  },
  function schedule(m, p) {
    p.schedule = m.schedule ?? null;
    p.runsPerDay = null;
    if (p.schedule !== null) {
      try {
        p.runsPerDay = runsPerDay(p.schedule);
      } catch (e) {
        p.warnings.push(`schema niet te lezen (${e.message}): als handmatig getoond`);
      }
    }
    p.symmetry = symmetryFor(p.runsPerDay);
  },
];

export function manifestToParams(manifest) {
  const params = { seed: manifest.id, warnings: [] };
  for (const rule of RULES) rule(manifest, params);
  return params;
}

// Lichte controle zonder dependencies. Het volledige schema staat in manifest/gliosoom.schema.json.
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object') return ['manifest is geen object'];
  const allowed = ['id', 'name', 'version', 'description', 'runtime', 'status', 'schedule', 'connections', 'output', 'size', 'demo'];
  for (const k of Object.keys(m)) if (!allowed.includes(k)) errors.push(`onbekend veld: ${k}`);
  if (typeof m.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(m.id)) errors.push('id: kleine letters, cijfers, streepjes');
  if (typeof m.name !== 'string' || !m.name) errors.push('name ontbreekt');
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(m.version)) errors.push('version: x.y.z');
  if (!STATUSES.includes(m.status)) errors.push(`status: ${STATUSES.join(' | ')}`);
  if (m.schedule !== null && typeof m.schedule !== 'string') errors.push('schedule: cron-string of null');
  if (typeof m.schedule === 'string') {
    try { runsPerDay(m.schedule); } catch (e) { errors.push(`schedule: ${e.message}`); }
  }
  if (!Array.isArray(m.connections)) errors.push('connections: lijst');
  else m.connections.forEach((c, i) => {
    if (!c || typeof c.name !== 'string' || !c.name) errors.push(`connections[${i}].name ontbreekt`);
    if (!c || !CONNECTION_TYPES.includes(c.type)) errors.push(`connections[${i}].type: ${CONNECTION_TYPES.join(' | ')}`);
  });
  if (m.size !== undefined) {
    if (!Number.isInteger(m.size?.lines) || m.size.lines < 0) errors.push('size.lines: geheel getal ≥ 0');
    if (!Number.isInteger(m.size?.files) || m.size.files < 0) errors.push('size.files: geheel getal ≥ 0');
  }
  if (m.demo !== undefined && typeof m.demo !== 'boolean') errors.push('demo: true of false');
  return errors;
}
