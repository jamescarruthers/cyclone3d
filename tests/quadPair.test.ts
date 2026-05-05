import { describe, expect, it } from 'vitest';
import { Delaunay } from 'd3-delaunay';
import { pairTriangles } from '@/procgen/quadPair';
import { bridsonVariable } from '@/procgen/poisson';
import { Rng } from '@/procgen/rng';

describe('procgen/quadPair', () => {
  it('every input triangle is either in a quad or in leftovers', () => {
    const rng = new Rng(11);
    const points = bridsonVariable(rng, {
      minX: 0, minY: 0, maxX: 200, maxY: 200,
      spacingFn: () => 8, minSpacing: 8, maxSpacing: 8,
    });

    const d = new Delaunay(points);
    const tris = new Uint32Array(d.triangles);
    const halfedges = new Int32Array(d.halfedges);

    const { quads, leftoverTriangles } = pairTriangles(points, tris, halfedges);
    const triCount = tris.length / 3;

    // Each quad consumed two triangles.
    const accounted = quads.length / 4 * 2 + leftoverTriangles.length / 3;
    expect(accounted).toBe(triCount);

    // Most triangles should pair (interior of a uniform mesh).
    const pairedFraction = (quads.length / 4 * 2) / triCount;
    expect(pairedFraction).toBeGreaterThan(0.7);
  });

  it('emits convex quads with non-zero area', () => {
    const rng = new Rng(31);
    const points = bridsonVariable(rng, {
      minX: 0, minY: 0, maxX: 100, maxY: 100,
      spacingFn: () => 6, minSpacing: 6, maxSpacing: 6,
    });
    const d = new Delaunay(points);
    const { quads } = pairTriangles(
      points,
      new Uint32Array(d.triangles),
      new Int32Array(d.halfedges),
    );

    for (let q = 0; q < quads.length; q += 4) {
      const px: number[] = [];
      const py: number[] = [];
      for (let i = 0; i < 4; i++) {
        px.push(points[quads[q + i]! * 2]!);
        py.push(points[quads[q + i]! * 2 + 1]!);
      }
      // Shoelace area; absolute value > 0.
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        area += px[i]! * py[j]! - px[j]! * py[i]!;
      }
      expect(Math.abs(area) * 0.5).toBeGreaterThan(0);

      // Convex: all cross products same sign.
      let sign = 0;
      let convex = true;
      for (let i = 0; i < 4; i++) {
        const a = i, b = (i + 1) % 4, c = (i + 2) % 4;
        const cross = (px[b]! - px[a]!) * (py[c]! - py[b]!)
                    - (py[b]! - py[a]!) * (px[c]! - px[b]!);
        if (sign === 0) sign = cross > 0 ? 1 : cross < 0 ? -1 : 0;
        else if (sign * cross < 0) { convex = false; break; }
      }
      expect(convex).toBe(true);
    }
  });
});
