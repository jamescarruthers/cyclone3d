import type { NoiseFunction2D } from 'simplex-noise';
import {
  ABYSSAL_DEPTH,
  DROPOFF_DEPTH,
  ISLAND_DOMAIN_WARP_AMPLITUDE,
  ISLAND_DOMAIN_WARP_SCALE,
  ISLAND_PEAK_HEIGHT,
  ISLAND_PEAK_NOISE_SCALE,
  ISLAND_R_BEACH,
  ISLAND_R_DROPOFF,
  ISLAND_R_PEAK,
  ISLAND_R_SHELF,
  ISLAND_SANDBAR_AMPLITUDE,
  ISLAND_SANDBAR_NOISE_SCALE,
  SHELF_DEPTH,
} from '@/config';
import { hashSeed } from '@/procgen/rng';
import { domainWarp2, fbm2, ridged2, makeNoise2D } from '@/procgen/noise';
import { lerp, smoothstep } from '@/utils/math';

// Per-island profile parameters. Phase 9 picks one of three archetype
// presets per island for visual variety.
export interface IslandProfile {
  readonly rPeak: number;
  readonly rBeach: number;
  readonly rShelf: number;
  readonly rDropoff: number;
  readonly peakHeight: number;
}

export type IslandArchetype = 'volcanic' | 'atoll' | 'cay';

export const DEFAULT_PROFILE: IslandProfile = {
  rPeak: ISLAND_R_PEAK,
  rBeach: ISLAND_R_BEACH,
  rShelf: ISLAND_R_SHELF,
  rDropoff: ISLAND_R_DROPOFF,
  peakHeight: ISLAND_PEAK_HEIGHT,
};

const ARCHETYPE_PROFILES: Readonly<Record<IslandArchetype, IslandProfile>> = {
  // Tall, ridged. Standard SPEC profile.
  volcanic: DEFAULT_PROFILE,
  // Wide, very low — barely above sea level. Dominant beach band.
  atoll: { rPeak: 18, rBeach: 95, rShelf: 145, rDropoff: 200, peakHeight: 6 },
  // Tiny, flat sand cay.
  cay: { rPeak: 6, rBeach: 28, rShelf: 90, rDropoff: 150, peakHeight: 3 },
};

function pickArchetype(seed: number): IslandArchetype {
  // mulberry32-style mix; 50% volcanic, 30% cay, 20% atoll.
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  const r = ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  if (r < 0.5) return 'volcanic';
  if (r < 0.8) return 'cay';
  return 'atoll';
}

export interface Island {
  readonly anchorX: number;
  readonly anchorZ: number;
  readonly seed: number;
  readonly archetype: IslandArchetype;
  readonly profile: IslandProfile;
  readonly peakNoise: NoiseFunction2D;
  readonly warpNoiseX: NoiseFunction2D;
  readonly warpNoiseY: NoiseFunction2D;
  readonly sandbarNoise: NoiseFunction2D;
}

export function makeIsland(
  anchorX: number,
  anchorZ: number,
  worldSeed: number,
  archetypeOverride?: IslandArchetype,
): Island {
  const baseSeed = hashSeed(worldSeed, 'island', anchorX, anchorZ);
  const archetype = archetypeOverride ?? pickArchetype(hashSeed(baseSeed, 'archetype'));
  const profile = ARCHETYPE_PROFILES[archetype];
  return {
    anchorX,
    anchorZ,
    seed: baseSeed,
    archetype,
    profile,
    peakNoise: makeNoise2D(hashSeed(baseSeed, 'peak')),
    warpNoiseX: makeNoise2D(hashSeed(baseSeed, 'warpX')),
    warpNoiseY: makeNoise2D(hashSeed(baseSeed, 'warpY')),
    sandbarNoise: makeNoise2D(hashSeed(baseSeed, 'sandbar')),
  };
}

const warpOut = { x: 0, y: 0 };

// Per-island contribution at world (x, z). Returns a height in metres relative
// to sea level. Outside the island's influence radius this returns ABYSSAL_DEPTH;
// caller combines via max() across overlapping islands per SPEC §heightfield.
export function islandHeight(island: Island, x: number, z: number): number {
  const dx = x - island.anchorX;
  const dz = z - island.anchorZ;
  const dRaw = Math.sqrt(dx * dx + dz * dz);

  domainWarp2(
    island.warpNoiseX,
    island.warpNoiseY,
    x,
    z,
    ISLAND_DOMAIN_WARP_SCALE,
    ISLAND_DOMAIN_WARP_AMPLITUDE,
    warpOut,
  );
  const d = Math.max(0, dRaw + warpOut.x * 0.5 + warpOut.y * 0.5);

  const { rPeak, rBeach, rShelf, rDropoff, peakHeight } = island.profile;

  if (d < rPeak) {
    // Peak: ridged multifractal scaled to peakHeight, with central plateau bias.
    const r = ridged2(island.peakNoise, x * ISLAND_PEAK_NOISE_SCALE, z * ISLAND_PEAK_NOISE_SCALE, 4, 2, 0.5);
    const centreBias = 1 - smoothstep(0, rPeak, d) * 0.4;
    return peakHeight * r * centreBias;
  }

  if (d < rBeach) {
    // Flank: ease from peak edge down to beach line.
    const t = smoothstep(rPeak, rBeach, d);
    const peakEdge = peakHeight * 0.6;
    return lerp(peakEdge, 0.5, t);
  }

  if (d < rShelf) {
    // Shelf: gentle ramp 0 → SHELF_DEPTH with sandbar wobble.
    const t = smoothstep(rBeach, rShelf, d);
    const base = lerp(0, SHELF_DEPTH, t);
    const sandbar = fbm2(island.sandbarNoise, x * ISLAND_SANDBAR_NOISE_SCALE, z * ISLAND_SANDBAR_NOISE_SCALE, 3, 2, 0.5);
    return base + sandbar * ISLAND_SANDBAR_AMPLITUDE * (1 - t);
  }

  if (d < rDropoff) {
    const t = smoothstep(rShelf, rDropoff, d);
    return lerp(SHELF_DEPTH, DROPOFF_DEPTH, t);
  }

  return ABYSSAL_DEPTH;
}

// Combined heightfield: max() across all islands. Determinism property:
// height(x, z, islands) is purely a function of inputs.
export function height(islands: readonly Island[], x: number, z: number): number {
  let h = ABYSSAL_DEPTH;
  for (let i = 0; i < islands.length; i++) {
    const island = islands[i]!;
    const hi = islandHeight(island, x, z);
    if (hi > h) h = hi;
  }
  return h;
}
