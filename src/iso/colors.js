// Kleurbanden, radiaal: binnenste band (0) = kern, daarna één band per connectie naar buiten.
// De banden worden verdeeld over de echte voxels, niet over de lege kubus, zodat elke band zichtbaar is.

import { makeGrid, activeVoxels } from './voxels.js';

// Sorteer op afstand tot het midden van het raster; bij gelijke afstand vaste volgorde x, y, z.
// Met `visible` (Set van "x,y,z") worden de grenzen bepaald op de zichtbare voxels, zodat elke band
// ook echt te zien is. Verborgen voxels volgen dezelfde afstandsgrenzen.
// Grenzen tussen banden vallen bij voorkeur tussen twee afstanden in, zodat even ver liggende
// voxels (bijv. elkaars spiegelbeeld) dezelfde band krijgen. Alleen als dat niet kan
// (te weinig verschillende afstanden) wordt een groep gesplitst, in x, y, z-volgorde.
export function assignRadialBands(grid, bands, visible = null) {
  const N = grid.length;
  const c = N - 1; // midden ×2, zodat alles gehele getallen blijft
  const voxels = activeVoxels(grid).map(([x, y, z]) => ({
    x, y, z,
    d: (2 * x - c) ** 2 + (2 * y - c) ** 2 + (2 * z - c) ** 2,
  }));
  voxels.sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y || a.z - b.z);
  const ranked = visible ? voxels.filter((v) => visible.has(`${v.x},${v.y},${v.z}`)) : voxels;
  const hidden = visible ? voxels.filter((v) => !visible.has(`${v.x},${v.y},${v.z}`)) : [];

  const count = ranked.length;
  const B = Math.max(1, Math.min(bands, count));
  const boundaries = [];
  for (let i = 1; i < count; i++) if (ranked[i].d !== ranked[i - 1].d) boundaries.push(i);

  const cuts = [0];
  for (let k = 1; k < B; k++) {
    const ideal = Math.round((k * count) / B);
    const lo = cuts[k - 1] + 1;
    const hi = count - (B - k);
    let best = -1;
    for (const b of boundaries) {
      if (b < lo || b > hi) continue;
      if (best < 0 || Math.abs(b - ideal) < Math.abs(best - ideal)) best = b;
    }
    cuts.push(best >= 0 ? best : Math.min(hi, Math.max(lo, ideal)));
  }
  cuts.push(count);

  const colorGrid = makeGrid(N, -1);
  for (let band = 0; band < B; band++) {
    for (let i = cuts[band]; i < cuts[band + 1]; i++) {
      const v = ranked[i];
      colorGrid[v.x][v.y][v.z] = band;
    }
  }
  for (const v of hidden) {
    let band = 0;
    for (let k = 1; k < B; k++) if (v.d >= ranked[cuts[k]].d) band = k;
    colorGrid[v.x][v.y][v.z] = band;
  }
  return { colorGrid, bands: B };
}
