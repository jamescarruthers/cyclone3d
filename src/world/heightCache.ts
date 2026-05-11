import { height, type Island } from '@/world/heightfield';
import type { GridBounds } from '@/world/grid';

// Per-chunk bilinear height cache. The grid-build inner loop calls
// `spacingFn(x, y)` ~hundreds of thousands of times per chunk; sampling the
// raw heightfield (with its FBM + ridged + domain-warp noise stack) on every
// call dominates init time.
//
// Build the cache once at chunk start (one heightfield call per cache
// texel, bounded), then use the bilinear `sample()` from Bridson and
// cell-tagging — a 4-tap lookup with no noise.
export class HeightCache {
  private readonly grid: Float32Array;
  private readonly resolution: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly invSizeX: number;
  private readonly invSizeZ: number;

  constructor(
    islands: readonly Island[],
    bounds: GridBounds,
    resolution: number,
  ) {
    this.resolution = resolution;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    const sizeX = bounds.maxX - bounds.minX;
    const sizeZ = bounds.maxZ - bounds.minZ;
    this.invSizeX = 1 / sizeX;
    this.invSizeZ = 1 / sizeZ;
    this.grid = new Float32Array(resolution * resolution);

    for (let j = 0; j < resolution; j++) {
      const z = bounds.minZ + (j / (resolution - 1)) * sizeZ;
      for (let i = 0; i < resolution; i++) {
        const x = bounds.minX + (i / (resolution - 1)) * sizeX;
        this.grid[j * resolution + i] = height(islands, x, z);
      }
    }
  }

  sample(x: number, z: number): number {
    let u = (x - this.minX) * this.invSizeX;
    let v = (z - this.minZ) * this.invSizeZ;
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    if (v < 0) v = 0;
    else if (v > 1) v = 1;

    const r = this.resolution;
    const fi = u * (r - 1);
    const fj = v * (r - 1);
    const i = Math.min(r - 2, Math.floor(fi));
    const j = Math.min(r - 2, Math.floor(fj));
    const ti = fi - i;
    const tj = fj - j;
    const a = this.grid[j * r + i]!;
    const b = this.grid[j * r + (i + 1)]!;
    const c = this.grid[(j + 1) * r + i]!;
    const d = this.grid[(j + 1) * r + (i + 1)]!;
    return (
      a * (1 - ti) * (1 - tj) +
      b * ti * (1 - tj) +
      c * (1 - ti) * tj +
      d * ti * tj
    );
  }
}
