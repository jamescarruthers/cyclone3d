import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '@/procgen/rng';

describe('procgen/rng', () => {
  it('produces deterministic output for a given seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() output is in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashSeed is stable and order-sensitive', () => {
    expect(hashSeed('a', 1, 2)).toBe(hashSeed('a', 1, 2));
    expect(hashSeed('a', 1, 2)).not.toBe(hashSeed('a', 2, 1));
  });
});
