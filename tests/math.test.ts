import { describe, expect, it } from 'vitest';
import { clamp, lerp, smoothstep, degToRad } from '@/utils/math';

describe('utils/math', () => {
  it('clamp bounds value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('smoothstep at edges and midpoint', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('degToRad converts', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 6);
  });
});
