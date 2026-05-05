import { NUM_GERSTNER_WAVES } from '@/config';
import { Rng } from '@/procgen/rng';

// Deterministic 8-wave spectrum. Wavelengths are log-spaced; amplitudes
// follow a Bretschneider-style peak around `peakWavelength` and are
// normalised so their sum is 1 (per-cell `ampMod` from depth scales the
// result). Directions cluster around the wind vector with ±dirSpread.

export interface WaveSpectrum {
  readonly wavelengths: Float32Array;
  readonly amplitudes: Float32Array;
  readonly directions: Float32Array; // 2 * NUM
  readonly phases: Float32Array;
}

export interface SpectrumOptions {
  readonly minWavelength: number;
  readonly maxWavelength: number;
  readonly peakWavelength: number;
  readonly windDir: readonly [number, number]; // unit vector
  readonly dirSpread: number; // radians
  readonly seed: number;
}

export function makeSpectrum(opts: SpectrumOptions): WaveSpectrum {
  const N = NUM_GERSTNER_WAVES;
  const wavelengths = new Float32Array(N);
  const amplitudes = new Float32Array(N);
  const directions = new Float32Array(N * 2);
  const phases = new Float32Array(N);

  const rng = new Rng(opts.seed);

  let totalAmp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const lambda = opts.minWavelength * Math.pow(opts.maxWavelength / opts.minWavelength, t);
    wavelengths[i] = lambda;

    // Gaussian-in-log-space peak around peakWavelength.
    const lr = Math.log(lambda / opts.peakWavelength);
    const a = Math.exp(-(lr * lr) * 1.5);
    amplitudes[i] = a;
    totalAmp += a;
  }
  if (totalAmp > 0) {
    for (let i = 0; i < N; i++) amplitudes[i] = amplitudes[i]! / totalAmp;
  }

  const windAng = Math.atan2(opts.windDir[1], opts.windDir[0]);
  for (let i = 0; i < N; i++) {
    const ang = windAng + rng.range(-opts.dirSpread, opts.dirSpread);
    directions[i * 2] = Math.cos(ang);
    directions[i * 2 + 1] = Math.sin(ang);
    phases[i] = rng.next() * Math.PI * 2;
  }

  return { wavelengths, amplitudes, directions, phases };
}
