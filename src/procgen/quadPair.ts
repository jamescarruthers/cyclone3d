// Greedy triangle → quad pairing for a Delaunay triangulation. Produces a list
// of quads (4 vertex indices, CCW) plus the leftover triangles that couldn't
// be paired without producing a degenerate shape.
//
// SPEC §Stålberg: pick the pairing that produces the best-shaped quad
// (closest to convex with corner angles near 90°).

export interface PairResult {
  readonly quads: Uint32Array; // 4 indices per quad
  readonly leftoverTriangles: Uint32Array; // 3 indices per triangle
}

interface EdgeCandidate {
  readonly halfedge: number;
  readonly score: number; // lower is better
}

export function pairTriangles(
  points: Float64Array,
  triangles: Uint32Array,
  halfedges: Int32Array,
): PairResult {
  const triCount = triangles.length / 3;
  const paired = new Uint8Array(triCount);

  const candidates: EdgeCandidate[] = [];
  const seen = new Uint8Array(halfedges.length);

  for (let e = 0; e < halfedges.length; e++) {
    if (seen[e]) continue;
    const opp = halfedges[e]!;
    if (opp < 0) continue; // hull edge
    seen[e] = 1;
    seen[opp] = 1;

    const t1 = (e / 3) | 0;
    const t2 = (opp / 3) | 0;
    const score = scorePairing(points, triangles, t1, t2, e, opp);
    if (Number.isFinite(score)) {
      candidates.push({ halfedge: e, score });
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  const quads: number[] = [];
  for (const cand of candidates) {
    const e = cand.halfedge;
    const opp = halfedges[e]!;
    const t1 = (e / 3) | 0;
    const t2 = (opp / 3) | 0;
    if (paired[t1] || paired[t2]) continue;

    // Build quad in CCW order. Edge e of t1 goes from a→b; the third vertex
    // of t1 is c (opposite the edge); the third vertex of t2 is d.
    const a = triangles[e]!;
    const b = triangles[nextHE(e)]!;
    const c = triangles[prevHE(e)]!;
    const d = triangles[prevHE(opp)]!;
    // Quad CCW: c, a, d, b (c → a along t1's prevHE; a → d into t2; d → b; b → c)
    quads.push(c, a, d, b);
    paired[t1] = 1;
    paired[t2] = 1;
  }

  const leftover: number[] = [];
  for (let t = 0; t < triCount; t++) {
    if (paired[t]) continue;
    leftover.push(triangles[t * 3]!, triangles[t * 3 + 1]!, triangles[t * 3 + 2]!);
  }

  return {
    quads: Uint32Array.from(quads),
    leftoverTriangles: Uint32Array.from(leftover),
  };
}

function nextHE(e: number): number {
  return e % 3 === 2 ? e - 2 : e + 1;
}

function prevHE(e: number): number {
  return e % 3 === 0 ? e + 2 : e - 1;
}

function scorePairing(
  points: Float64Array,
  triangles: Uint32Array,
  _t1: number,
  _t2: number,
  e: number,
  opp: number,
): number {
  const a = triangles[e]!;
  const b = triangles[nextHE(e)]!;
  const c = triangles[prevHE(e)]!;
  const d = triangles[prevHE(opp)]!;

  // Quad order (CCW): c, a, d, b.
  const px = [
    points[c * 2]!,
    points[a * 2]!,
    points[d * 2]!,
    points[b * 2]!,
  ];
  const py = [
    points[c * 2 + 1]!,
    points[a * 2 + 1]!,
    points[d * 2 + 1]!,
    points[b * 2 + 1]!,
  ];

  // Reject non-convex quads: cross product of consecutive edges must all
  // share a sign.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const x0 = px[i]!;
    const y0 = py[i]!;
    const x1 = px[(i + 1) % 4]!;
    const y1 = py[(i + 1) % 4]!;
    const x2 = px[(i + 2) % 4]!;
    const y2 = py[(i + 2) % 4]!;
    const cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
    if (sign === 0) sign = cross > 0 ? 1 : cross < 0 ? -1 : 0;
    else if (sign * cross < 0) return Number.POSITIVE_INFINITY;
  }

  // Score: sum of |angle - 90°|. Lower = squarer.
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const x0 = px[(i + 3) % 4]!;
    const y0 = py[(i + 3) % 4]!;
    const x1 = px[i]!;
    const y1 = py[i]!;
    const x2 = px[(i + 1) % 4]!;
    const y2 = py[(i + 1) % 4]!;
    const ux = x0 - x1;
    const uy = y0 - y1;
    const vx = x2 - x1;
    const vy = y2 - y1;
    const dot = ux * vx + uy * vy;
    const mag = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    if (mag === 0) return Number.POSITIVE_INFINITY;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot / mag)));
    total += Math.abs(angle - Math.PI / 2);
  }
  return total;
}
