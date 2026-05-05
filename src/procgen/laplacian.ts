// In-place Laplacian smoothing for a 2D point set with adjacency. Boundary
// points (passed in `pinned`) stay fixed. SPEC §Stålberg: 3–5 iterations.

export function laplacianSmooth(
  points: Float64Array,
  neighbours: ReadonlyArray<ReadonlyArray<number>>,
  pinned: Uint8Array,
  iterations: number,
  relaxation = 0.5,
): void {
  const n = points.length / 2;
  const tmp = new Float64Array(points.length);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      if (pinned[i]) {
        tmp[i * 2] = points[i * 2]!;
        tmp[i * 2 + 1] = points[i * 2 + 1]!;
        continue;
      }
      const adj = neighbours[i];
      if (!adj || adj.length === 0) {
        tmp[i * 2] = points[i * 2]!;
        tmp[i * 2 + 1] = points[i * 2 + 1]!;
        continue;
      }
      let sx = 0;
      let sy = 0;
      for (let j = 0; j < adj.length; j++) {
        const k = adj[j]!;
        sx += points[k * 2]!;
        sy += points[k * 2 + 1]!;
      }
      const cx = sx / adj.length;
      const cy = sy / adj.length;
      const px = points[i * 2]!;
      const py = points[i * 2 + 1]!;
      tmp[i * 2] = px + (cx - px) * relaxation;
      tmp[i * 2 + 1] = py + (cy - py) * relaxation;
    }
    points.set(tmp);
  }
}
