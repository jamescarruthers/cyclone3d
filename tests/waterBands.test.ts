import { describe, expect, it } from 'vitest';
import {
  DEEP_TINT,
  MID_BAND,
  MID_TINT,
  SHALLOW_BAND,
  SHALLOW_TINT,
} from '@/config';
import { waterTintSmooth } from '@/world/biome';

describe('water depth bands', () => {
  it('returns SHALLOW_TINT at the surface', () => {
    const c = waterTintSmooth(0);
    expect(c[0]).toBeCloseTo(SHALLOW_TINT[0], 4);
    expect(c[1]).toBeCloseTo(SHALLOW_TINT[1], 4);
    expect(c[2]).toBeCloseTo(SHALLOW_TINT[2], 4);
  });

  it('returns DEEP_TINT well past the mid band', () => {
    const c = waterTintSmooth(MID_BAND + 50);
    expect(c[0]).toBeCloseTo(DEEP_TINT[0], 4);
    expect(c[1]).toBeCloseTo(DEEP_TINT[1], 4);
    expect(c[2]).toBeCloseTo(DEEP_TINT[2], 4);
  });

  it('returns MID_TINT in the middle of the mid band', () => {
    const midOfMid = (SHALLOW_BAND + MID_BAND) / 2;
    const c = waterTintSmooth(midOfMid);
    expect(c[0]).toBeCloseTo(MID_TINT[0], 2);
    expect(c[1]).toBeCloseTo(MID_TINT[1], 2);
    expect(c[2]).toBeCloseTo(MID_TINT[2], 2);
  });

  it('transitions monotonically toward deep with depth', () => {
    const samples = [0, 3, 6, 12, 25, 40, 80].map(waterTintSmooth);
    // Blue channel should fall: shallow turquoise b≈0.78 → deep b≈0.42
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]![2]).toBeLessThanOrEqual(samples[i - 1]![2] + 1e-6);
    }
  });
});
