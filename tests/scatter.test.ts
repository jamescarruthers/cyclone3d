import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, DEFAULT_WORLD_SEED } from '@/config';
import { makeIsland, type IslandArchetype } from '@/world/heightfield';
import { buildGrid } from '@/world/grid';
import { scatterForChunk, ScatterKind } from '@/world/scatter';

describe('Phase 9 polish', () => {
  it('island archetype is deterministic from anchor', () => {
    const a = makeIsland(123.4, -56.7, DEFAULT_WORLD_SEED);
    const b = makeIsland(123.4, -56.7, DEFAULT_WORLD_SEED);
    expect(a.archetype).toBe(b.archetype);
  });

  it('all three archetypes appear across enough samples', () => {
    const seen: Record<IslandArchetype, number> = { volcanic: 0, atoll: 0, cay: 0 };
    for (let i = 0; i < 200; i++) {
      const island = makeIsland(i * 137.0, i * 53.0, DEFAULT_WORLD_SEED);
      seen[island.archetype]++;
    }
    expect(seen.volcanic).toBeGreaterThan(0);
    expect(seen.atoll).toBeGreaterThan(0);
    expect(seen.cay).toBeGreaterThan(0);
  });

  it('archetype override is respected', () => {
    const island = makeIsland(0, 0, DEFAULT_WORLD_SEED, 'cay');
    expect(island.archetype).toBe('cay');
  });

  // Build a small grid centred on a single volcanic island so the test runs
  // quickly (the full chunk-scale grid is ~thousands of cells).
  const islands = [makeIsland(0, 0, DEFAULT_WORLD_SEED, 'volcanic')];
  const bounds = { minX: -CHUNK_SIZE / 2, maxX: CHUNK_SIZE / 2, minZ: -CHUNK_SIZE / 2, maxZ: CHUNK_SIZE / 2 };
  const grid = buildGrid(islands, bounds, DEFAULT_WORLD_SEED);

  it('scatter is deterministic for fixed chunk inputs', () => {
    const a = scatterForChunk(grid, DEFAULT_WORLD_SEED, 0, 0);
    const b = scatterForChunk(grid, DEFAULT_WORLD_SEED, 0, 0);
    expect(a.length).toBe(b.length);
    if (a.length > 0) {
      expect(a[0]!.x).toBe(b[0]!.x);
      expect(a[0]!.kind).toBe(b[0]!.kind);
    }
  });

  it('scatter kinds match the cell bands', () => {
    const insts = scatterForChunk(grid, DEFAULT_WORLD_SEED, 0, 0);
    expect(insts.length).toBeGreaterThan(0);
    for (const inst of insts) {
      if (inst.kind === ScatterKind.Palm) {
        expect(inst.y).toBeGreaterThan(-1);
      } else if (inst.kind === ScatterKind.Rock) {
        expect(inst.y).toBeGreaterThan(50);
      } else if (inst.kind === ScatterKind.Coral) {
        expect(inst.y).toBeLessThanOrEqual(-1);
      }
    }
  });
});
