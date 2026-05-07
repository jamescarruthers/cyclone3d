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

    this.islands = gatherIslands(worldSeed, cx, cz);

    const seedPoints = chunkSeedPoints(worldSeed, cx, cz);
    this.grid = buildGrid(this.islands, this.bounds, worldSeed, seedPoints);

    this.mesh = new WaveBlocksMesh(this.grid, spectrum, lighting);
    this.shadow = new ShadowField(this.islands, this.bounds, initialWind);
    this.mesh.setShadowField(this.shadow.texture, this.shadow.boundsUniform);

    const instances = scatterForChunk(this.grid, worldSeed, cx, cz);
    this.scatter = new ScatterMesh(instances);
  }

  dispose(): void {
    this.mesh.dispose();
    this.shadow.dispose();
    this.scatter.dispose();
  }
}
