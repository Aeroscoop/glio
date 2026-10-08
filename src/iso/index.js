// Ingang: manifest in → { svg, stats } uit. Puur, zonder DOM.

import { createRng, seedHash } from './prng.js';
import { generateVoxels } from './voxels.js';
import { assignRadialBands } from './colors.js';
import { labelClusters } from './ccl.js';
import { renderVoxels, visibleVoxelKeys } from './render.js';
import { manifestToParams } from './mapping.js';

// Maakt een veilig id-voorvoegsel, zodat meerdere kubussen in één pagina elkaars gradients niet raken.
export const idPrefixFor = (id) => `iso-${String(id).replace(/[^a-zA-Z0-9-]/g, '_')}-`;

export function renderManifest(manifest, options = {}) {
  const params = manifestToParams(manifest);
  const rng = createRng(params.seed);
  const grid = generateVoxels(params.gridSize, params.density, params.symmetry, rng);
  const { colorGrid, bands } = assignRadialBands(grid, params.bands, visibleVoxelKeys(grid));
  const { clusterGrid, clusters } = labelClusters(grid, colorGrid);
  const result = renderVoxels(
    { grid, colorGrid, clusterGrid, clusters },
    {
      idPrefix: idPrefixFor(manifest.id),
      ...options,
      bandColors: params.bandColors,
      mode: params.mode,
      stroke: params.stroke,
    },
  );
  if (bands < params.bands) {
    params.warnings.push(`vorm te klein voor ${params.bands} banden: ${bands} zichtbaar`);
  }
  return {
    ...result,
    params,
    stats: {
      ...result.stats,
      bands,
      gridSize: params.gridSize,
      symmetry: params.symmetry,
      mode: params.mode,
      seedHash: seedHash(params.seed),
    },
  };
}

export { manifestToParams } from './mapping.js';
export { renderBlock } from './render.js';
