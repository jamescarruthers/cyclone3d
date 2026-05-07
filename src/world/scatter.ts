import { Rng, hashSeed } from '@/procgen/rng';
import { type Grid } from '@/world/grid';
import { Band } from '@/world/biome';

export const enum ScatterKind {
  None = 0,
  Palm = 1,
  Rock = 2,
  Coral = 3,
}

export interface ScatterInstance {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly kind: ScatterKind;
  readonly scale: number;
  readonly rotationY: number;
}

// Phase 9 scatter, cell-driven. The Stalberg grid already tags every cell
// with its biome band; we pick a small number of jittered scatter points
// inside each cell and classify them by tag. This avoids the per-point
// heightfield evaluations the Poisson approach would otherwise run, which
// dominated chunk init.
//
// Per-tag counts roughly tune to "dense palms on land, sparse rocks on
// peaks, dense coral on shallow shelf, sparse coral on mid shelf".

interface TagSpec {
  readonly kind: ScatterKind;
  readonly minCount: number;
  readonly maxCount: number;
  readonly minScale: number;
  readonly maxScale: number;
}

const TAG_SPECS: Partial<Record<Band, TagSpec>> = {
  [Band.Peak]: { kind: ScatterKind.Rock, minCount: 0, maxCount: 2, minScale: 0.6, maxScale: 1.6 },
  [Band.Land]: { kind: ScatterKind.Palm, minCount: 1, maxCount: 3, minScale: 0.85, maxScale: 1.25 },
  [Band.Beach]: { kind: ScatterKind.Palm, minCount: 0, maxCount: 2, minScale: 0.7, maxScale: 1.05 },
  [Band.ShelfShallow]: { kind: ScatterKind.Coral, minCount: 1, maxCount: 3, minScale: 0.6, maxScale: 1.0 },
  [Band.ShelfMid]: { kind: ScatterKind.Coral, minCount: 0, maxCount: 1, minScale: 0.5, maxScale: 0.85 },
};

export function scatterForChunk(
  grid: Grid,
  worldSeed: number,
  cx: number,
  cz: number,
): ScatterInstance[] {
  const rng = new Rng(hashSeed(worldSeed, 'scatter', cx, cz));
  const out: ScatterInstance[] = [];

  for (let c = 0; c < grid.cellCount; c++) {
    const tag = grid.cellTag[c]! as Band;
    const spec = TAG_SPECS[tag];
    if (!spec) continue;

    const range = spec.maxCount - spec.minCount + 1;
    const count = spec.minCount + Math.floor(rng.next() * range);
    if (count === 0) continue;

    const centreX = grid.cellCentre[c * 2]!;
    const centreZ = grid.cellCentre[c * 2 + 1]!;
    const cellH = grid.cellHeight[c]!;
    // Stay inside the cell — radius slightly less than half the longest edge.
    const radius = grid.cellSize[c]! * 0.35;

    for (let i = 0; i < count; i++) {
      const angle = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * radius;
      out.push({
        x: centreX + Math.cos(angle) * r,
        y: cellH,
        z: centreZ + Math.sin(angle) * r,
        kind: spec.kind,
        scale:
          spec.minScale +
          rng.next() * (spec.maxScale - spec.minScale),
        rotationY: rng.next() * Math.PI * 2,
      });
    }
  }

  return out;
}
