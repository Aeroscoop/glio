// Voxelgroei vanaf het midden onderin (6-connected, willekeurige volgorde uit de wachtrij) + symmetrie.
// Overgenomen uit isofusion-studio (MIT), met één aanpassing: het groeidoel telt ná symmetrie (zie hieronder).

export const SYMMETRIES = ['none', 'mirror-x', 'mirror-xy', 'rotational'];

export function makeGrid(N, fill) {
  return Array.from({ length: N }, () => Array.from({ length: N }, () => Array(N).fill(fill)));
}

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function generateVoxels(N, density, symmetry, rng) {
  if (!SYMMETRIES.includes(symmetry)) throw new Error(`Onbekende symmetrie: ${symmetry}`);
  // Afwijking van isofusion: daar groeit eerst het volle doel en komt de symmetrie erbovenop,
  // waardoor een gespiegelde vorm bijna de hele kubus vult. Hier telt het doel ná symmetrie,
  // zodat de vuldichtheid ongeveer `density` blijft.
  const target = Math.max(3, Math.floor(N * N * N * density));
  const center = Math.floor(N / 2);
  const queue = [[center, center, 0]];
  const visited = new Set([`${center},${center},0`]);
  const grid = makeGrid(N, false);
  let grown = 0;
  let filled = 0;
  const set = (x, y, z) => {
    if (!grid[x][y][z]) { grid[x][y][z] = true; filled++; }
  };
  const m = N - 1;

  while (queue.length > 0 && filled < target) {
    const [x, y, z] = queue.splice(Math.floor(rng() * queue.length), 1)[0];
    if (rng() < 0.85 || grown < 3) {
      grown++;
      set(x, y, z);
      if (symmetry === 'mirror-x') {
        set(m - x, y, z);
      } else if (symmetry === 'mirror-xy') {
        set(m - x, y, z); set(x, m - y, z); set(m - x, m - y, z);
      } else if (symmetry === 'rotational') {
        set(m - y, x, z); set(m - x, m - y, z); set(y, m - x, z);
      }
      const dirs = DIRS.map((d) => d.slice());
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
      for (const [dx, dy, dz] of dirs) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < 0 || nx >= N || ny < 0 || ny >= N || nz < 0 || nz >= N) continue;
        const key = `${nx},${ny},${nz}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny, nz]);
        }
      }
    }
  }
  return grid;
}

export function activeVoxels(grid) {
  const N = grid.length;
  const out = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (grid[x][y][z]) out.push([x, y, z]);
  }
  return out;
}
