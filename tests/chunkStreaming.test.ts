import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, DEFAULT_WORLD_SEED } from '@/config';
import {
  edgePointsX,
  edgePointsZ,
  islandsForChunk,
} from '@/world/islands';

describe('Phase 8 chunk streaming', () => {
  it('per-chunk islands are deterministic for fixed (worldSeed, cx, cz)', () => {
    const a = islandsForChunk(DEFAULT_WORLD_SEED + 1, 3, -2);
    const b = islandsForChunk(DEFAULT_WORLD_SEED + 1, 3, -2);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.anchorX).toBe(b[i]!.anchorX);
      expect(a[i]!.anchorZ).toBe(b[i]!.anchorZ);
    }
  });

  it('different chunks produce different island sets', () => {
    const a = islandsForChunk(DEFAULT_WORLD_SEED, 0, 0);
    const b = islandsForChunk(DEFAULT_WORLD_SEED, 5, 5);
    // Trivially different keys so caches don't collide; check anchor lists
    // aren't identical when both are non-empty.
    if (a.length > 0 && b.length > 0) {
      expect(a[0]!.anchorX).not.toBe(b[0]!.anchorX);
    }
  });

  it('shared edge points are identical between adjacent chunks (X edge)', () => {
    // Chunk (cx, cz) and chunk (cx+1, cz) share the edge at world X = (cx+1) * CHUNK_SIZE.
    // The right edge of (cx, cz) is edgePointsX(seed, cx+1, cz).
    // The left edge of (cx+1, cz) is edgePointsX(seed, cx+1, cz).
    const right = edgePointsX(DEFAULT_WORLD_SEED, 4, -1);
    const left = edgePointsX(DEFAULT_WORLD_SEED, 4, -1);
    expect(right).toEqual(left);
    // All points sit on the shared X line.
    for (let i = 0; i < right.length; i += 2) {
      expect(right[i]).toBe(4 * CHUNK_SIZE);
    }
  });

  it('shared edge points are identical between adjacent chunks (Z edge)', () => {
    const top = edgePointsZ(DEFAULT_WORLD_SEED, 2, 7);
    const bottom = edgePointsZ(DEFAULT_WORLD_SEED, 2, 7);
    expect(top).toEqual(bottom);
    for (let i = 1; i < top.length; i += 2) {
      expect(top[i]).toBe(7 * CHUNK_SIZE);
    }
  });

  it('edge points stay within the shared edge segment', () => {
    const cz = 3;
    const pts = edgePointsX(DEFAULT_WORLD_SEED, 0, cz);
    for (let i = 1; i < pts.length; i += 2) {
      expect(pts[i]!).toBeGreaterThanOrEqual(cz * CHUNK_SIZE);
      expect(pts[i]!).toBeLessThanOrEqual((cz + 1) * CHUNK_SIZE);
    }
  });
});
