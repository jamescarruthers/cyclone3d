import {
  CHUNK_SIZE,
  SCATTER_MAX_SPACING,
  SCATTER_MIN_SPACING,
  SHELF_DEPTH,
} from '@/config';
import { hashSeed, Rng } from '@/procgen/rng';
import { bridsonVariable } from '@/procgen/poisson';
import { height, type Island } from '@/world/heightfield';
import { lerp, smoothstep } from '@/utils/math';

// Scatter classification per generated point. Drives which InstancedMesh
// pool the point ends up in.
export const enum ScatterKind {
  None = 0,
  Palm = 1,
  Rock = 2,
  Coral = 3,
}

export interface ScatterInstance {
  readonly x: number;
  readonly y: number; // sampled heightfield value at (x, z)
  readonly z: number;
  readonly kind: ScatterKind;
  readonly scale: number;
  readonly rotationY: number;
}

// Density-by-tag spacing. Smaller spacing = denser. Returns 0 to skip.
function spacingForHeight(h: number): number {
  if (h > 50) return SCATTER_MIN_SPACING * 2.5; // peaks: sparse rocks
  if (h > 1) return SCATTER_MIN_SPACING;          // land: dense palms
  if (h > -1) return SCATTER_MIN_SPACING * 1.5;   // beach: moderate palms
  if (h > SHELF_DEPTH) return SCATTER_MIN_SPACING * 1.2; // shelf: dense coral
  if (h > -15) return SCATTER_MAX_SPACING;        // dropoff: sparse coral
  return 0; // deep water: nothing
}

function classifyHeight(h: number): ScatterKind {
  if (h > 50) return ScatterKind.Rock;
  if (h > -1) return ScatterKind.Palm;
  if (h > -15) return ScatterKind.Coral;
  return ScatterKind.None;
}

// Generate scatter instances for one chunk. Density modulated by local
// heightfield value via spacingForHeight; classification via classifyHeight.
// Deterministic from `(worldSeed, cx, cz)`.
export function scatterForChunk(
  islands: readonly Island[],
  worldSeed: number,
  cx: number,
  cz: number,
): ScatterInstance[] {
  const seed = hashSeed(worldSeed, 'scatter', cx, cz);
  const rng = new Rng(seed);
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;

  const points = bridsonVariable(rng, {
    minX,
    minY: minZ,
    maxX: minX + CHUNK_SIZE,
    maxY: minZ + CHUNK_SIZE,
    spacingFn: (x, y) => {
      const s = spacingForHeight(height(islands, x, y));
      return s > 0 ? s : SCATTER_MAX_SPACING;
    },
    minSpacing: SCATTER_MIN_SPACING,
    maxSpacing: SCATTER_MAX_SPACING,
    k: 12,
  });

  const out: ScatterInstance[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!;
    const z = points[i + 1]!;
    const h = height(islands, x, z);
    const kind = classifyHeight(h);
    if (kind === ScatterKind.None) continue;

    let scale: number;
    if (kind === ScatterKind.Palm) {
      // Smaller palms in beach band, taller on flat land.
      const t = smoothstep(0, 5, h);
      scale = lerp(0.7, 1.2, t) * (0.85 + rng.next() * 0.3);
    } else if (kind === ScatterKind.Rock) {
      scale = 0.6 + rng.next() * 1.0;
    } else {
      // Coral: smaller in deeper water.
      const t = 1 - smoothstep(SHELF_DEPTH, -15, h);
      scale = lerp(0.5, 1.0, t) * (0.8 + rng.next() * 0.4);
    }

    out.push({
      x,
      y: h,
      z,
      kind,
      scale,
      rotationY: rng.next() * Math.PI * 2,
    });
  }
  return out;
}
