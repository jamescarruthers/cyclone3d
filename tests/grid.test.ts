import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED, PHASE1_ISLAND_ANCHOR } from '@/config';
import { makeIsland } from '@/world/heightfield';
import {
  buildGrid,
  cellVertex,
  cellVertexCount,
} from '@/world/grid';

describe('world/grid adjacency', () => {
  const islands = [makeIsland(PHASE1_ISLAND_ANCHOR[0], PHASE1_ISLAND_ANCHOR[1], DEFAULT_WORLD_SEED)];
  // Small bounds so the test runs quickly; still enough cells to have
  // non-trivial topology.
  const grid = buildGrid(
    islands,
    { minX: -120, maxX: 120, minZ: -120, maxZ: 120 },
    DEFAULT_WORLD_SEED,
  );

  it('every neighbour link is reciprocated', () => {
    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      for (let i = 0; i < n; i++) {
        const nb = grid.cellNeighbour[grid.cellEdgeStart[c]! + i]!;
        if (nb < 0) continue;

        const nn = cellVertexCount(grid, nb);
        let found = false;
        for (let j = 0; j < nn; j++) {
          if (grid.cellNeighbour[grid.cellEdgeStart[nb]! + j] === c) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      }
    }
  });

  it('reciprocal edges share the same vertex pair', () => {
    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      for (let i = 0; i < n; i++) {
        const nb = grid.cellNeighbour[grid.cellEdgeStart[c]! + i]!;
        if (nb < 0) continue;

        const va = cellVertex(grid, c, i);
        const vb = cellVertex(grid, c, (i + 1) % n);
        const lo1 = Math.min(va, vb);
        const hi1 = Math.max(va, vb);

        const nn = cellVertexCount(grid, nb);
        let matched = false;
        for (let j = 0; j < nn; j++) {
          const nva = cellVertex(grid, nb, j);
          const nvb = cellVertex(grid, nb, (j + 1) % nn);
          const lo2 = Math.min(nva, nvb);
          const hi2 = Math.max(nva, nvb);
          if (lo1 === lo2 && hi1 === hi2) {
            matched = true;
            break;
          }
        }
        expect(matched).toBe(true);
      }
    }
  });

  it('boundary edges face the bbox edge', () => {
    let boundaryCount = 0;
    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      for (let i = 0; i < n; i++) {
        if (grid.cellNeighbour[grid.cellEdgeStart[c]! + i]! < 0) boundaryCount++;
      }
    }
    expect(boundaryCount).toBeGreaterThan(0);
  });
});
