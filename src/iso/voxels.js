// Voxelgroei vanaf het midden onderin (6-connected, willekeurige volgorde uit de wachtrij) + symmetrie.
// Overgenomen uit isofusion-studio (MIT), met één aanpassing in het groeidoel (zie hieronder).

export const SYMMETRIES = ['none', 'mirror-x', 'mirror-xy', 'rotational'];

// Hoeveel kopieën de symmetrie van elke voxel maakt.
const COPIES = { none: 1, 'mirror-x': 2, 'mirror-xy': 4, rotational: 4 };

export function makeGrid(N, fill) {
  return Array.from({ length: N }, () => Array.from({ length: N }, () => Array(N).fill(fill)));
}

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function generateVoxels(N, density, symmetry, rng) {
  if (!SYMMETRIES.includes(symmetry)) throw new Error(`Onbekende symmetrie: ${symmetry}`);
  // Afwijking van isofusion: daar groeit eerst het volle doel en komt de symmetrie erbovenop,
  // waardoor een gespiegelde vorm bijna de hele kubus vult. Hier groeit alleen het eigen deel,
  // zodat de vuldichtheid na symmetrie ongeveer `density` blijft.
  const target = Math.max(3, Math.floor((N * N * N * density) / COPIES[symmetry]));
  const center = Math.floor(N / 2);
  const queue = [[center, center, 0]];
  const visited = new Set([`${center},${center},0`]);
  const active = [];

  while (queue.length > 0 && active.length < target) {
    const [x, y, z] = queue.splice(Math.floor(rng() * queue.length), 1)[0];
    if (rng() < 0.85 || active.length < 3) {
      active.push([x, y, z]);
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

  const grid = makeGrid(N, false);
  const m = N - 1;
  for (const [x, y, z] of active) {
    grid[x][y][z] = true;
    if (symmetry === 'mirror-x') {
      grid[m - x][y][z] = true;
    } else if (symmetry === 'mirror-xy') {
      grid[m - x][y][z] = true;
      grid[x][m - y][z] = true;
      grid[m - x][m - y][z] = true;
    } else if (symmetry === 'rotational') {
      grid[m - y][x][z] = true;
      grid[m - x][m - y][z] = true;
      grid[y][m - x][z] = true;
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
