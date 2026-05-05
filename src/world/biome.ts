import { DROPOFF_DEPTH, SHELF_DEPTH } from '@/config';

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

// Stylised palette for Phase 1. Phase 5 replaces water bands with a proper
// shader; these are placeholders to verify the heightfield reads correctly.
export const BAND_COLOUR: Readonly<Record<Band, readonly [number, number, number]>> = {
  [Band.Peak]: [0.55, 0.5, 0.45],
  [Band.Land]: [0.36, 0.6, 0.32],
  [Band.Beach]: [0.93, 0.88, 0.66],
  [Band.ShelfShallow]: [0.45, 0.85, 0.78],
  [Band.ShelfMid]: [0.18, 0.55, 0.66],
  [Band.Dropoff]: [0.1, 0.32, 0.5],
  [Band.Deep]: [0.05, 0.18, 0.36],
};
