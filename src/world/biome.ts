import {
  DEEP_TINT,
  DROPOFF_DEPTH,
  MID_BAND,
  MID_TINT,
  SHALLOW_BAND,
  SHALLOW_TINT,
  SHELF_DEPTH,
} from '@/config';
import { lerp, smoothstep } from '@/utils/math';

// Per SPEC §heightfield tag classification. Phase 1 only uses height to pick
// a colour band; later phases will incorporate slope and per-cell tags
// (shelf-coral vs shelf-sand etc.) once the Stålberg grid lands.
export const enum Band {
  Peak = 0,
  Land = 1,
  Beach = 2,
  ShelfShallow = 3,
  ShelfMid = 4,
  Dropoff = 5,
  Deep = 6,
}

export function bandFromHeight(h: number): Band {
  if (h > 50) return Band.Peak;
  if (h > 1) return Band.Land;
  if (h > -1) return Band.Beach;
  if (h > SHELF_DEPTH) return Band.ShelfShallow;
  if (h > -15) return Band.ShelfMid;
  if (h > DROPOFF_DEPTH) return Band.Dropoff;
  return Band.Deep;
}

// Land-side palette for Phase 5+. Water bands are computed in the fragment
// shader from depth (see waterTintSmooth). Underwater entries here are
// placeholders that the shader overrides.
export const BAND_COLOUR: Readonly<Record<Band, readonly [number, number, number]>> = {
  [Band.Peak]: [0.55, 0.5, 0.45],
  [Band.Land]: [0.36, 0.6, 0.32],
  [Band.Beach]: [0.93, 0.88, 0.66],
  [Band.ShelfShallow]: SHALLOW_TINT,
  [Band.ShelfMid]: MID_TINT,
  [Band.Dropoff]: DEEP_TINT,
  [Band.Deep]: DEEP_TINT,
};

// Pure-JS mirror of the fragment shader's water-band selection. Smoothsteps
// SHALLOW → MID across ±1 m of SHALLOW_BAND, then MID → DEEP across ±5 m of
// MID_BAND.
export function waterTintSmooth(depth: number): [number, number, number] {
  const t1 = smoothstep(SHALLOW_BAND - 1, SHALLOW_BAND + 1, depth);
  const t2 = smoothstep(MID_BAND - 5, MID_BAND + 5, depth);
  const r1 = lerp(SHALLOW_TINT[0], MID_TINT[0], t1);
  const g1 = lerp(SHALLOW_TINT[1], MID_TINT[1], t1);
  const b1 = lerp(SHALLOW_TINT[2], MID_TINT[2], t1);
  return [
    lerp(r1, DEEP_TINT[0], t2),
    lerp(g1, DEEP_TINT[1], t2),
    lerp(b1, DEEP_TINT[2], t2),
  ];
}
