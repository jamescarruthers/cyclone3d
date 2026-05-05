import {
  DROPOFF_DEPTH,
  NUM_GERSTNER_WAVES,
  WAVE_AMPLITUDE_DEEP,
  WAVE_AMPLITUDE_SHORE,
} from '@/config';
import { lerp, smoothstep } from '@/utils/math';
import type { WaveSpectrum } from '@/rendering/waveSpectrum';

// JS mirror of waveBlock.vert's `waveHeight()` for use outside the GPU
// (helicopter shadow placement, ground-truth tests). Skips Nyquist gating
// (the heli isn't a cell), shadow attenuation, cliff chop, and quantisation —
// caller can multiply by shadow attenuation themselves if they care.
export function sampleWaveY(
  spectrum: WaveSpectrum,
  x: number,
  z: number,
  depth: number, // signed metres relative to sea level (negative under water)
  time: number,
): number {
  const ampMod = lerp(
    WAVE_AMPLITUDE_SHORE,
    WAVE_AMPLITUDE_DEEP,
    smoothstep(0, Math.abs(DROPOFF_DEPTH), -depth),
  );
  let h = 0;
  for (let i = 0; i < NUM_GERSTNER_WAVES; i++) {
    const lambda = spectrum.wavelengths[i]!;
    const k = (2 * Math.PI) / lambda;
    const omega = Math.sqrt(9.81 * k);
    const dx = spectrum.directions[i * 2]!;
    const dz = spectrum.directions[i * 2 + 1]!;
    const phase = spectrum.phases[i]!;
    h += spectrum.amplitudes[i]! * Math.sin((dx * x + dz * z) * k - omega * time + phase);
  }
  return h * ampMod;
}
