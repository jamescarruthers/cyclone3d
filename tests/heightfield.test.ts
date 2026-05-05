import { describe, expect, it } from 'vitest';
import {
  ABYSSAL_DEPTH,
  DEFAULT_WORLD_SEED,
  ISLAND_R_DROPOFF,
} from '@/config';
import { height, makeIsland } from '@/world/heightfield';

describe('world/heightfield', () => {
  const islands = [makeIsland(0, 0, DEFAULT_WORLD_SEED)];

  it('produces deterministic output for fixed inputs', () => {
    const samples = [
      [0, 0],
      [50, 0],
      [120, 30],
      [400, -200],
    ] as const;
    const a = samples.map(([x, z]) => height(islands, x, z));
    const islandsB = [makeIsland(0, 0, DEFAULT_WORLD_SEED)];
    const b = samples.map(([x, z]) => height(islandsB, x, z));
    expect(a).toEqual(b);
  });

  it('peaks above sea level near the island anchor', () => {
    // Sample a small ring around the anchor; at least one should be above water.
    const ring = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const r = 8;
      return height(islands, Math.cos(a) * r, Math.sin(a) * r);
    });
    expect(Math.max(...ring)).toBeGreaterThan(0);
  });

  it('returns abyssal depth far from any island', () => {
    const farFromIsland = ISLAND_R_DROPOFF * 4;
    expect(height(islands, farFromIsland, farFromIsland)).toBe(ABYSSAL_DEPTH);
  });

  it('shows a shelf band between coast and dropoff', () => {
    // Sample radially outward; we should pass through above-sea, near-zero,
    // shallow shelf (~ -1 to -6), dropoff, abyss.
    const heights: number[] = [];
    for (let r = 0; r <= ISLAND_R_DROPOFF * 1.5; r += 5) {
      heights.push(height(islands, r, 0));
    }
    const max = Math.max(...heights);
    const min = Math.min(...heights);
    expect(max).toBeGreaterThan(0);
    expect(min).toBeLessThanOrEqual(ABYSSAL_DEPTH);
    // At least one sample sits in the shallow shelf band.
    expect(heights.some((h) => h <= -1 && h > -6.5)).toBe(true);
  });
});
