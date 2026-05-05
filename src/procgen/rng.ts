// Deterministic seeded RNG. Per CLAUDE.md §1: never call Math.random() — all
// randomness goes through this module. mulberry32 is fast, has a small state,
// and is good enough for procgen.

export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid the degenerate seed = 0 state.
    this.state = (seed | 0) || 1;
  }

  // Returns a uint32.
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  // Float in [0, 1).
  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  // Float in [min, max).
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

// xmur3 string hash used to derive integer seeds from labelled inputs.
export function hashSeed(...parts: readonly (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const s = typeof part === 'string' ? part : part.toString();
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    }
  }
  // Avalanche.
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
