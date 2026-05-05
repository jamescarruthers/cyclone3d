import { describe, expect, it } from 'vitest';
import {
  NUM_GERSTNER_WAVES,
  WAVE_DIR_SPREAD,
  WAVE_LAMBDA_MAX,
  WAVE_LAMBDA_MIN,
  WAVE_LAMBDA_PEAK,
} from '@/config';
import { makeSpectrum } from '@/rendering/waveSpectrum';

const opts = {
  seed: 42,
  windDir: [1, 0] as const,
  dirSpread: WAVE_DIR_SPREAD,
  minWavelength: WAVE_LAMBDA_MIN,
  maxWavelength: WAVE_LAMBDA_MAX,
  peakWavelength: WAVE_LAMBDA_PEAK,
};

describe('rendering/waveSpectrum', () => {
  it('returns NUM_GERSTNER_WAVES of every parameter', () => {
    const s = makeSpectrum(opts);
    expect(s.wavelengths.length).toBe(NUM_GERSTNER_WAVES);
    expect(s.amplitudes.length).toBe(NUM_GERSTNER_WAVES);
    expect(s.directions.length).toBe(NUM_GERSTNER_WAVES * 2);
    expect(s.phases.length).toBe(NUM_GERSTNER_WAVES);
  });

  it('wavelengths are within [min, max] and monotonically increasing', () => {
    const s = makeSpectrum(opts);
    expect(s.wavelengths[0]).toBeCloseTo(WAVE_LAMBDA_MIN, 4);
    expect(s.wavelengths[NUM_GERSTNER_WAVES - 1]).toBeCloseTo(WAVE_LAMBDA_MAX, 4);
    for (let i = 1; i < NUM_GERSTNER_WAVES; i++) {
      expect(s.wavelengths[i]!).toBeGreaterThan(s.wavelengths[i - 1]!);
    }
  });

  it('amplitudes sum to ~1 and peak nearer the peak wavelength', () => {
    const s = makeSpectrum(opts);
    let sum = 0;
    for (let i = 0; i < NUM_GERSTNER_WAVES; i++) sum += s.amplitudes[i]!;
    expect(sum).toBeCloseTo(1, 4);

    let bestIdx = 0;
    for (let i = 1; i < NUM_GERSTNER_WAVES; i++) {
      if (s.amplitudes[i]! > s.amplitudes[bestIdx]!) bestIdx = i;
    }
    const peakLambda = s.wavelengths[bestIdx]!;
    // The peak amp should be near WAVE_LAMBDA_PEAK; allow ±50% tolerance.
    expect(peakLambda / WAVE_LAMBDA_PEAK).toBeGreaterThan(0.5);
    expect(peakLambda / WAVE_LAMBDA_PEAK).toBeLessThan(2.0);
  });

  it('directions cluster near wind direction', () => {
    const s = makeSpectrum(opts);
    for (let i = 0; i < NUM_GERSTNER_WAVES; i++) {
      const dx = s.directions[i * 2]!;
      const dy = s.directions[i * 2 + 1]!;
      // Wind is +X; |angle| should be ≤ dirSpread.
      const angle = Math.atan2(dy, dx);
      expect(Math.abs(angle)).toBeLessThanOrEqual(opts.dirSpread + 1e-6);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = makeSpectrum(opts);
    const b = makeSpectrum(opts);
    expect(a.directions).toEqual(b.directions);
    expect(a.phases).toEqual(b.phases);
    expect(a.amplitudes).toEqual(b.amplitudes);
    expect(a.wavelengths).toEqual(b.wavelengths);
  });
});
