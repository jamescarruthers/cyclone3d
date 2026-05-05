import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { Rng } from '@/procgen/rng';

// Wrap simplex-noise with a seeded factory so noise fields are reproducible
// from a world/island seed. Per CLAUDE.md §1: deterministic procgen.
export function makeNoise2D(seed: number): NoiseFunction2D {
  const rng = new Rng(seed);
  return createNoise2D(() => rng.next());
}

// Fractional Brownian motion: stack octaves of simplex.
export function fbm2(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm; // ~[-1, 1]
}

// Ridged multifractal: produces sharp ridges suitable for island peaks.
// Output in approximately [0, 1].
export function ridged2(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * freq, y * freq));
    sum += amp * n * n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// 2-octave domain warp. Output is an offset (dx, dy) added to the input
// position before sampling further noise. Mutates and returns `out` to avoid
// allocating per call.
export function domainWarp2(
  warpNoiseX: NoiseFunction2D,
  warpNoiseY: NoiseFunction2D,
  x: number,
  y: number,
  scale: number,
  amplitude: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const wx = fbm2(warpNoiseX, x * scale, y * scale, 2, 2, 0.5);
  const wy = fbm2(warpNoiseY, x * scale, y * scale, 2, 2, 0.5);
  out.x = wx * amplitude;
  out.y = wy * amplitude;
  return out;
}
