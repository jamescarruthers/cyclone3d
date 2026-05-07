import { CHUNK_SIZE } from '@/config';
import { buildGrid, type Grid, type GridBounds } from '@/world/grid';
import {
  chunkSeedPoints,
  gatherIslands,
} from '@/world/islands';
import { scatterForChunk } from '@/world/scatter';
import { ShadowField } from '@/world/shadowField';
import type { Island } from '@/world/heightfield';
import {
  WaveBlocksMesh,
  type LightingUniforms,
} from '@/rendering/waveBlocksMesh';
import { ScatterMesh } from '@/rendering/scatterMesh';
import type { WaveSpectrum } from '@/rendering/waveSpectrum';

// One streamable world tile. Holds its own grid, prism mesh, and shadow
// field — all derived deterministically from `(worldSeed, cx, cz)`.
//
// Per CLAUDE.md §4: every GPU resource allocated here is disposed in
// `dispose()`.
export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly bounds: GridBounds;
  readonly grid: Grid;
  readonly islands: readonly Island[];
  readonly mesh: WaveBlocksMesh;
  readonly shadow: ShadowField;
  readonly scatter: ScatterMesh;

  constructor(
    worldSeed: number,
    cx: number,
    cz: number,
    spectrum: WaveSpectrum,
    lighting: LightingUniforms,
    initialWind: readonly [number, number],
  ) {
    this.cx = cx;
    this.cz = cz;
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    this.bounds = {
      minX,
      maxX: minX + CHUNK_SIZE,
      minZ,
      maxZ: minZ + CHUNK_SIZE,
    };

    const t0 = performance.now();
    this.islands = gatherIslands(worldSeed, cx, cz);
    const t1 = performance.now();

    const seedPoints = chunkSeedPoints(worldSeed, cx, cz);
    this.grid = buildGrid(this.islands, this.bounds, worldSeed, seedPoints);
    const t2 = performance.now();

    this.mesh = new WaveBlocksMesh(this.grid, spectrum, lighting);
    const t3 = performance.now();

    this.shadow = new ShadowField(this.islands, this.bounds, initialWind);
    this.mesh.setShadowField(this.shadow.texture, this.shadow.boundsUniform);
    const t4 = performance.now();

    const instances = scatterForChunk(this.grid, worldSeed, cx, cz);
    this.scatter = new ScatterMesh(instances);
    const t5 = performance.now();

    // eslint-disable-next-line no-console
    console.info(
      `[chunk ${cx},${cz}] ` +
      `islands=${(t1 - t0).toFixed(0)} ` +
      `grid=${(t2 - t1).toFixed(0)} (${this.grid.cellCount}) ` +
      `mesh=${(t3 - t2).toFixed(0)} ` +
      `shadow=${(t4 - t3).toFixed(0)} ` +
      `scatter=${(t5 - t4).toFixed(0)} (${instances.length}) ` +
      `total=${(t5 - t0).toFixed(0)}ms`,
    );
  }

  dispose(): void {
    this.mesh.dispose();
    this.shadow.dispose();
    this.scatter.dispose();
  }
}
