import {
  CHUNK_SIZE,
  ISLAND_SPACING_AVG,
  ISLAND_SPACING_MIN,
  WAVE_CELL_DEEP,
} from '@/config';
import { hashSeed, Rng } from '@/procgen/rng';
import { bridsonVariable } from '@/procgen/poisson';
import { makeIsland, type Island } from '@/world/heightfield';

// Phase 8 chunk-keyed island generation.
//
// Each chunk gets its own deterministic set of island anchors via a small
// Bridson Poisson over its bounds. Neighbouring chunks contribute islands
// to a query because island influence radius (~r_dropoff = 195 m) is larger
// than the chunk size (256 m); a 3x3 neighbourhood is enough.

const islandCache = new Map<string, readonly Island[]>();

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function islandsForChunk(
  worldSeed: number,
  cx: number,
  cz: number,
): readonly Island[] {
  const key = `${worldSeed},${chunkKey(cx, cz)}`;
  const hit = islandCache.get(key);
  if (hit) return hit;

  const seed = hashSeed(worldSeed, 'islands', cx, cz);
  const rng = new Rng(seed);
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;

  const anchors = bridsonVariable(rng, {
    minX,
    minY: minZ,
    maxX: minX + CHUNK_SIZE,
    maxY: minZ + CHUNK_SIZE,
    spacingFn: () => ISLAND_SPACING_AVG,
    minSpacing: ISLAND_SPACING_MIN,
    maxSpacing: ISLAND_SPACING_AVG,
    k: 8,
  });

  const out: Island[] = [];
  for (let i = 0; i < anchors.length; i += 2) {
    out.push(makeIsland(anchors[i]!, anchors[i + 1]!, worldSeed));
  }
  const frozen: readonly Island[] = out;
  islandCache.set(key, frozen);
  return frozen;
}

// All islands within a 3x3 chunk neighbourhood — enough for heightfield
// evaluation anywhere in the centre chunk.
export function gatherIslands(
  worldSeed: number,
  cx: number,
  cz: number,
): Island[] {
  const out: Island[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const islands = islandsForChunk(worldSeed, cx + dx, cz + dz);
      for (const island of islands) out.push(island);
    }
  }
  return out;
}

export function islandsNear(worldSeed: number, x: number, z: number): Island[] {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  return gatherIslands(worldSeed, cx, cz);
}

// Shared boundary points along the edge between two chunks. Both adjacent
// chunks call this with the same arguments and get the same point set, so
// triangulation on either side meets at identical vertices.

const EDGE_SPACING = WAVE_CELL_DEEP * 1.5;
const EDGE_JITTER = EDGE_SPACING * 0.3;

// X edge: fixed X coordinate, points spread along Z.
// `edgeCx` is the chunk-X index; the edge sits at world X = edgeCx * CHUNK_SIZE
// and is shared by chunk (edgeCx-1, cz) and chunk (edgeCx, cz).
export function edgePointsX(
  worldSeed: number,
  edgeCx: number,
  cz: number,
): Float64Array {
  const seed = hashSeed(worldSeed, 'edgeX', edgeCx, cz);
  const rng = new Rng(seed);
  const x = edgeCx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;
  const maxZ = minZ + CHUNK_SIZE;
  const out: number[] = [];
  for (let pos = minZ + EDGE_SPACING * 0.5; pos < maxZ; pos += EDGE_SPACING) {
    out.push(x);
    out.push(pos + (rng.next() - 0.5) * 2 * EDGE_JITTER);
  }
  return Float64Array.from(out);
}

export function edgePointsZ(
  worldSeed: number,
  cx: number,
  edgeCz: number,
): Float64Array {
  const seed = hashSeed(worldSeed, 'edgeZ', cx, edgeCz);
  const rng = new Rng(seed);
  const z = edgeCz * CHUNK_SIZE;
  const minX = cx * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE;
  const out: number[] = [];
  for (let pos = minX + EDGE_SPACING * 0.5; pos < maxX; pos += EDGE_SPACING) {
    out.push(pos + (rng.next() - 0.5) * 2 * EDGE_JITTER);
    out.push(z);
  }
  return Float64Array.from(out);
}

// All four edge-point sets for a chunk concatenated. Used as `seedPoints`
// for the chunk's interior Poisson generation.
export function chunkSeedPoints(
  worldSeed: number,
  cx: number,
  cz: number,
): Float64Array {
  const left = edgePointsX(worldSeed, cx, cz);
  const right = edgePointsX(worldSeed, cx + 1, cz);
  const bottom = edgePointsZ(worldSeed, cx, cz);
  const top = edgePointsZ(worldSeed, cx, cz + 1);
  const total = left.length + right.length + bottom.length + top.length;
  const out = new Float64Array(total);
  let off = 0;
  out.set(left, off); off += left.length;
  out.set(right, off); off += right.length;
  out.set(bottom, off); off += bottom.length;
  out.set(top, off);
  return out;
}
