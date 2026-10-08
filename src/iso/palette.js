// Het Glio-palet. Alle kleuren van de renderer en van iso.html staan hier, nergens anders.

export const THEMES = {
  dark: {
    bg: '#1c2430',
    cell: '#232d3b',
    cell2: '#2a3546',
    line: '#3a4759',
    ink: '#e3e9f1',
    mute: '#8d9bb0',
    err: '#ee8b97',
    focus: '#9cc4ee',
  },
  light: {
    bg: '#f3f5f8',
    cell: '#ffffff',
    cell2: '#ffffff',
    line: '#ccd4df',
    ink: '#233044',
    mute: '#6a788c',
    err: '#d9606f',
    focus: '#6a9fdc',
  },
};

export const DEFAULT_THEME = 'dark';

// Gradients (stop1 → stop2). Index 0 is de kern (de module zelf).
export const GRADIENTS = [
  { name: 'kern', stop1: '#2dd4bf', stop2: '#22d3ee' },
  { name: 'connectie 1', stop1: '#a78bfa', stop2: '#c084fc' },
  { name: 'connectie 2', stop1: '#fbbf24', stop2: '#fb923c' },
  { name: 'connectie 3', stop1: '#f472b6', stop2: '#fb7185' },
  { name: 'connectie 4', stop1: '#60a5fa', stop2: '#818cf8' },
  { name: 'reserve', stop1: '#86efac', stop2: '#4ade80' },
];

export const CORE_COLOR = 0;
export const CONNECTION_COLORS = [1, 2, 3, 4, 5];

// Bekende bronnen houden overal dezelfde kleur (vorm, lijnen, bronkubusje).
export const KNOWN_SOURCE_COLORS = {
  freshrss: 2,
  gcal: 4,
  syncthing: 5,
  orchestrator: 3,
};

// Vlakschaduw: menging met deze donkere basis. Boven 100%, links 80%, rechts 60% eigen kleur.
export const SHADE_BASE = '#0b1220';
export const SHADE = { TOP: 1, LEFT: 0.8, RIGHT: 0.6 };

// Zachte gloed onder de vorm, in de kernkleur.
export const GLOW_OPACITY = 0.18;

export const STROKE_WIDTH_ERROR = 1.2;
export const STROKE_WIDTH_SEAM = 0.9;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// Zelfde als CSS color-mix(in srgb, hex amount, base), maar als vaste hex,
// zodat de SVG ook buiten de browser (Node, export) klopt.
export function mix(hex, amount, base = SHADE_BASE) {
  if (amount >= 1) return hex.toLowerCase();
  const a = hexToRgb(hex);
  const b = hexToRgb(base);
  return rgbToHex(a.map((v, i) => v * amount + b[i] * (1 - amount)));
}

// CSS-variabelen per thema, voor iso.html.
export function themeCss() {
  const vars = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
  const grads = GRADIENTS.map((g, i) => `--g${i}a:${g.stop1};--g${i}b:${g.stop2}`).join(';');
  return [
    `:root{${vars(THEMES[DEFAULT_THEME])};${grads};--shade:${SHADE_BASE}}`,
    ...Object.keys(THEMES).map((k) => `:root[data-theme="${k}"]{${vars(THEMES[k])}}`),
  ].join('\n');
}

// Fallbacks in de SVG verwijzen naar CSS-variabelen van de pagina, met het donkere thema als standaard.
export function themeVar(key) {
  return `var(--${key},${THEMES[DEFAULT_THEME][key]})`;
}
