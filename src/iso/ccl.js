// 3D connected component labeling: aangrenzende voxels (6-connected) met dezelfde kleur vormen één cluster.
// Overgenomen uit isofusion-studio (MIT).

import { makeGrid } from './voxels.js';

export function labelClusters(grid, colorGrid) {
  const N = grid.length;
  const clusterGrid = makeGrid(N, -1);
  const clusters = []; // { id, color, size }

  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (!grid[x][y][z] || clusterGrid[x][y][z] !== -1) continue;
    const color = colorGrid[x][y][z];
    const id = clusters.length;
    const cluster = { id, color, size: 0 };
    clusters.push(cluster);
    const queue = [[x, y, z]];
    clusterGrid[x][y][z] = id;
    for (let head = 0; head < queue.length; head++) {
      const [cx, cy, cz] = queue[head];
      cluster.size++;
      for (const [nx, ny, nz] of [
        [cx + 1, cy, cz], [cx - 1, cy, cz],
        [cx, cy + 1, cz], [cx, cy - 1, cz],
        [cx, cy, cz + 1], [cx, cy, cz - 1],
      ]) {
        if (nx < 0 || nx >= N || ny < 0 || ny >= N || nz < 0 || nz >= N) continue;
        if (grid[nx][ny][nz] && colorGrid[nx][ny][nz] === color && clusterGrid[nx][ny][nz] === -1) {
          clusterGrid[nx][ny][nz] = id;
          queue.push([nx, ny, nz]);
        }
      }
    }
  }
  return { clusterGrid, clusters };
}
