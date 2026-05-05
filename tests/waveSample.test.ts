import { describe, expect, it } from 'vitest';
import {
  ABYSSAL_DEPTH,
  WAVE_AMPLITUDE_DEEP,
  WAVE_DIR_SPREAD,
  WAVE_LAMBDA_MAX,
  WAVE_LAMBDA_MIN,
  WAVE_LAMBDA_PEAK,
} from '@/config';
import { makeSpectrum } from '@/rendering/waveSpectrum';
import { sampleWaveY } from '@/world/waveSample';

const spectrum = makeSpectrum({
  seed: 1234,
  windDir: [1, 0],
  dirSpread: WAVE_DIR_SPREAD,
  minWavelength: WAVE_LAMBDA_MIN,
  maxWavelength: WAVE_LAMBDA_MAX,
  peakWavelength: WAVE_LAMBDA_PEAK,
});

describe('world/waveSample', () => {
  it('is deterministic for fixed inputs', () => {
    const a = sampleWaveY(spectrum, 12.3, -45.6, ABYSSAL_DEPTH, 7.89);
    const b = sampleWaveY(spectrum, 12.3, -45.6, ABYSSAL_DEPTH, 7.89);
    expect(a).toBe(b);
  });

  it('depth-modulates amplitude (deep > shore)', () => {
    // Sample many time/space points; track |max| so wave phase doesn't bias.
    let deepMax = 0;
    let shoreMax = 0;
    for (let t = 0; t < 30; t += 0.3) {
      for (let x = 0; x < 200; x += 7) {
        deepMax = Math.max(deepMax, Math.abs(sampleWaveY(spectrum, x, 0, ABYSSAL_DEPTH, t)));
        shoreMax = Math.max(shoreMax, Math.abs(sampleWaveY(spectrum, x, 0, -0.5, t)));
      }
    }
    expect(deepMax).toBeGreaterThan(shoreMax * 3);
  });

  it('returns a value within plausible amplitude bounds', () => {
    // |h| ≤ ampMod × sum(amp_i) where sum(amp_i) ≈ 1, ampMod ≤ WAVE_AMPLITUDE_DEEP.
    for (let t = 0; t < 5; t += 0.5) {
      const v = sampleWaveY(spectrum, 0, 0, ABYSSAL_DEPTH, t);
      expect(Math.abs(v)).toBeLessThanOrEqual(WAVE_AMPLITUDE_DEEP * 1.1);
    }
  });
});
