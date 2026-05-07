import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_SEED,
  PHASE1_ISLAND_ANCHOR,
} from '@/config';
import { makeIsland } from '@/world/heightfield';
import { ShadowField } from '@/world/shadowField';

// Chunk-scale bounds, matching Phase 8+ runtime. The shadow landmask
// resolution is sized for this scale, so cliff/shadow features still
// resolve at expected sample radii.
const half = 200;
const islands = [
  // Phase 9 picks an archetype per island deterministically; force volcanic
  // here so the shadow + cliff radii match this test's hard-coded sample
  // points.
  makeIsland(PHASE1_ISLAND_ANCHOR[0], PHASE1_ISLAND_ANCHOR[1], DEFAULT_WORLD_SEED, 'volcanic'),
];
const bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };

describe('world/shadowField', () => {
  // Wind direction: +X (blowing east). Lee = downwind = +X side of the island.
  const wind: readonly [number, number] = [1, 0];
  const field = new ShadowField(islands, bounds, wind);

  it('shadow approaches 1 far upwind of any island', () => {
    // West edge of the chunk; the upwind ray walks west and exits the chunk.
    const farUpwind = field.shadowAt(-180, 0);
    expect(farUpwind).toBeGreaterThan(0.9);
  });

  it('shadow drops noticeably immediately downwind of the island', () => {
    // Just east of the island anchor. Upwind ray (toward -X) hits the island
    // within a few metres → shadow ≈ 1 - exp(-small/60) → small.
    const lee = field.shadowAt(80, 0);
    expect(lee).toBeLessThan(0.5);
  });

  it('shadow recovers further downwind', () => {
    const near = field.shadowAt(120, 0);
    const far = field.shadowAt(180, 0);
    expect(far).toBeGreaterThan(near);
  });

  it('cliff intensity is non-zero near land', () => {
    // Sample many points around the island at varying radii; at least one
    // shore-adjacent water texel should register cliff > 0.
    let maxCliff = 0;
    for (let r = 60; r <= 120; r += 4) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const c = field.cliffAt(Math.cos(a) * r, Math.sin(a) * r);
        if (c > maxCliff) maxCliff = c;
      }
    }
    expect(maxCliff).toBeGreaterThan(0);
  });

  it('cliff intensity is zero deep in open ocean', () => {
    // In-bounds but well past the island's dropoff.
    expect(field.cliffAt(180, 180)).toBe(0);
  });

  it('rotating wind changes the lee location', () => {
    const eastLee = field.shadowAt(80, 0); // wind +X → lee at +X
    field.setWind(0, 1); // wind +Z → lee at +Z
    const eastNoLeeAnymore = field.shadowAt(80, 0);
    const newLee = field.shadowAt(0, 80);
    expect(eastNoLeeAnymore).toBeGreaterThan(eastLee);
    expect(newLee).toBeLessThan(eastNoLeeAnymore);
    field.setWind(1, 0); // restore
  });
});
