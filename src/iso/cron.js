// Schatting van het aantal runs per dag uit een cron-string, plus volgende run en een korte omschrijving.
// Ondersteunt per veld: *, */n, a-b, a-b/n, n/m, lijsten (1,2,3). Geen namen (mon, jan).

const FIELDS = [
  { name: 'minuut', min: 0, max: 59 },
  { name: 'uur', min: 0, max: 23 },
  { name: 'dag', min: 1, max: 31 },
  { name: 'maand', min: 1, max: 12 },
  { name: 'weekdag', min: 0, max: 7 },
];

const MACROS = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

function parseNumber(s, f) {
  if (!/^\d+$/.test(s)) throw new Error(`Ongeldig getal "${s}" in ${f.name}`);
  const n = Number(s);
  if (n < f.min || n > f.max) throw new Error(`${s} valt buiten ${f.min}-${f.max} in ${f.name}`);
  return n;
}

function parseField(text, f) {
  const values = new Set();
  for (const part of text.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : parseNumber(stepText, { ...f, min: 1, max: 999 });
    let lo, hi;
    if (range === '*') {
      lo = f.min; hi = f.max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-');
      lo = parseNumber(a, f); hi = parseNumber(b, f);
      if (lo > hi) throw new Error(`Bereik ${range} loopt achteruit in ${f.name}`);
    } else {
      lo = parseNumber(range, f);
      hi = stepText === undefined ? lo : f.max;
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

export function parseCron(cron) {
  const expanded = MACROS[cron.trim().toLowerCase()] ?? cron.trim();
  const parts = expanded.split(/\s+/);
  if (parts.length !== 5) throw new Error(`Cron heeft 5 velden nodig, kreeg ${parts.length}: "${cron}"`);
  const [minute, hour, dom, month, dowRaw] = parts.map((p, i) => parseField(p, FIELDS[i]));
  const dow = new Set([...dowRaw].map((d) => d % 7)); // 7 = zondag = 0
  return {
    minute, hour, dom, month, dow,
    domAny: parts[2] === '*', dowAny: parts[4] === '*',
  };
}

// Schatting, geen exacte telling: dagen per maand en weekdagen worden gemiddeld.
export function runsPerDay(cron) {
  if (cron === null || cron === undefined) return 0;
  const c = parseCron(cron);
  const domFrac = c.domAny ? 1 : Math.min(1, c.dom.size / 30.44);
  const dowFrac = c.dowAny ? 1 : c.dow.size / 7;
  // Cron-regel: zijn dag én weekdag allebei beperkt, dan geldt "of".
  const dayFrac = !c.domAny && !c.dowAny ? domFrac + dowFrac - domFrac * dowFrac : domFrac * dowFrac;
  const monthFrac = c.month.size / 12;
  return c.minute.size * c.hour.size * dayFrac * monthFrac;
}

function dayMatches(c, d) {
  const domOk = c.dom.has(d.getDate());
  const dowOk = c.dow.has(d.getDay());
  if (c.domAny && c.dowAny) return true;
  if (c.domAny) return dowOk;
  if (c.dowAny) return domOk;
  return domOk || dowOk;
}

// Volgende run na `from` (lokale tijd), of null als er binnen een jaar geen is.
export function nextRun(cron, from = new Date()) {
  if (cron === null || cron === undefined) return null;
  const c = parseCron(cron);
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = from.getTime() + 366 * 24 * 3600 * 1000;
  while (d.getTime() <= limit) {
    if (!c.month.has(d.getMonth() + 1) || !dayMatches(c, d)) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!c.hour.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!c.minute.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1);
      continue;
    }
    return d;
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

// Korte omschrijving in gewone taal.
export function describeSchedule(cron) {
  if (cron === null || cron === undefined) return 'handmatig';
  const parts = (MACROS[cron.trim().toLowerCase()] ?? cron.trim()).split(/\s+/);
  const [mi, h, dom, mo, dow] = parts;
  const rest = (...xs) => xs.every((x) => x === '*');
  let m;
  if (mi === '*' && rest(h, dom, mo, dow)) return 'elke minuut';
  if ((m = mi.match(/^\*\/(\d+)$/)) && rest(h, dom, mo, dow)) return `elke ${m[1]} minuten`;
  if (/^\d+$/.test(mi) && h === '*' && rest(dom, mo, dow)) return 'elk uur';
  if (/^\d+$/.test(mi) && (m = h.match(/^\*\/(\d+)$/)) && rest(dom, mo, dow)) return `elke ${m[1]} uur`;
  if (/^\d+$/.test(mi) && /^\d+$/.test(h) && rest(dom, mo, dow)) return `dagelijks om ${pad(h)}:${pad(mi)}`;
  if (/^\d+$/.test(mi) && /^\d+$/.test(h) && rest(dom, mo) && /^\d$/.test(dow)) {
    return `wekelijks, ${DAYS[Number(dow) % 7]} ${pad(h)}:${pad(mi)}`;
  }
  const n = runsPerDay(cron);
  return n >= 1 ? `ongeveer ${Math.round(n)}× per dag` : `ongeveer ${Math.round(n * 30)}× per maand`;
}
