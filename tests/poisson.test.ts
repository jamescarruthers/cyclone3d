import { describe, expect, it } from 'vitest';
import { bridsonVariable } from '@/procgen/poisson';
import { Rng } from '@/procgen/rng';

describe('procgen/poisson', () => {
  it('respects minimum distance for uniform spacing', () => {
    const rng = new Rng(123);
    const r = 5;
    const pts = bridsonVariable(rng, {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      spacingFn: () => r,
      minSpacing: r,
      maxSpacing: r,
    });

    let minDist = Infinity;
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pts[i * 2]! - pts[j * 2]!;
        const dy = pts[i * 2 + 1]! - pts[j * 2 + 1]!;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
    }
    expect(minDist).toBeGreaterThanOrEqual(r * 0.999);
    expect(n).toBeGreaterThan(50);
  });

  it('packs more densely where spacing is smaller', () => {
    const rng = new Rng(7);
    // Half the area uses spacing 2, half uses spacing 8.
    const pts = bridsonVariable(rng, {
      minX: 0,
      minY: 0,
      maxX: 200,
      maxY: 100,
      spacingFn: (x) => (x < 100 ? 2 : 8),
      minSpacing: 2,
      maxSpacing: 8,
    });

    let dense = 0;
    let sparse = 0;
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i]! < 100) dense++;
      else sparse++;
    }
    // Areas equal; dense side should have many more points.
    expect(dense).toBeGreaterThan(sparse * 3);
  });

  it('is deterministic for a given rng seed', () => {
    const a = bridsonVariable(new Rng(99), {
      minX: 0, minY: 0, maxX: 50, maxY: 50,
      spacingFn: () => 3, minSpacing: 3, maxSpacing: 3,
    });
    const b = bridsonVariable(new Rng(99), {
      minX: 0, minY: 0, maxX: 50, maxY: 50,
      spacingFn: () => 3, minSpacing: 3, maxSpacing: 3,
    });
    expect(a).toEqual(b);
  });
});
