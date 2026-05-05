import { Rng } from '@/procgen/rng';

// Bridson Poisson-disc with variable spacing. Returns a flat Float64Array
// of [x0, y0, x1, y1, ...] sorted in insertion order.
//
// `spacingFn(x, y)` returns the minimum distance allowed between this point
// and its neighbours. Points with smaller spacingFn pack denser. Per SPEC
// §Stålberg: spacing varies with water depth, finer near shore.

export interface PoissonOptions {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly spacingFn: (x: number, y: number) => number;
  readonly minSpacing: number; // for grid cell sizing
  readonly maxSpacing: number; // for neighbour-search radius
  readonly seedPoints?: Float64Array; // pre-seeded fixed points (e.g. shared chunk boundary)
  readonly k?: number; // candidate samples per active point
}

export function bridsonVariable(rng: Rng, opts: PoissonOptions): Float64Array {
  const k = opts.k ?? 30;
  const cellSize = opts.minSpacing / Math.SQRT2;
  const w = opts.maxX - opts.minX;
  const h = opts.maxY - opts.minY;
  const cols = Math.max(1, Math.ceil(w / cellSize));
  const rows = Math.max(1, Math.ceil(h / cellSize));
  const grid: Int32Array = new Int32Array(cols * rows).fill(-1);

  const points: number[] = [];
  const active: number[] = [];

  const inBounds = (x: number, y: number): boolean =>
    x >= opts.minX && x < opts.maxX && y >= opts.minY && y < opts.maxY;

  const cellIdx = (x: number, y: number): number => {
    const cx = Math.floor((x - opts.minX) / cellSize);
    const cy = Math.floor((y - opts.minY) / cellSize);
    return cy * cols + cx;
  };

  const farFromNeighbours = (x: number, y: number, r: number): boolean => {
    // Search radius uses the global max spacing because a far-away neighbour
    // with a larger spacing could still exclude us via the rEffective check.
    const search = Math.ceil(Math.max(r, opts.maxSpacing) / cellSize);
    const cx = Math.floor((x - opts.minX) / cellSize);
    const cy = Math.floor((y - opts.minY) / cellSize);
    const x0 = Math.max(0, cx - search);
    const x1 = Math.min(cols - 1, cx + search);
    const y0 = Math.max(0, cy - search);
    const y1 = Math.min(rows - 1, cy + search);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const id = grid[yy * cols + xx]!;
        if (id < 0) continue;
        const px = points[id * 2]!;
        const py = points[id * 2 + 1]!;
        const dx = px - x;
        const dy = py - y;
        // Use the larger of the two spacings as the conservative threshold.
        const rNeighbour = opts.spacingFn(px, py);
        const rEffective = Math.max(r, rNeighbour);
        if (dx * dx + dy * dy < rEffective * rEffective) return false;
      }
    }
    return true;
  };

  const insert = (x: number, y: number): number => {
    const id = points.length / 2;
    points.push(x, y);
    grid[cellIdx(x, y)] = id;
    return id;
  };

  // Seed with caller-provided fixed points first, then a single random point.
  if (opts.seedPoints) {
    for (let i = 0; i < opts.seedPoints.length; i += 2) {
      const x = opts.seedPoints[i]!;
      const y = opts.seedPoints[i + 1]!;
      if (inBounds(x, y)) {
        const id = insert(x, y);
        active.push(id);
      }
    }
  }

  if (points.length === 0) {
    const x = opts.minX + rng.next() * w;
    const y = opts.minY + rng.next() * h;
    active.push(insert(x, y));
  }

  while (active.length > 0) {
    const ai = (rng.next() * active.length) | 0;
    const idx = active[ai]!;
    const px = points[idx * 2]!;
    const py = points[idx * 2 + 1]!;
    const r = opts.spacingFn(px, py);

    let placed = false;
    for (let i = 0; i < k; i++) {
      const angle = rng.next() * Math.PI * 2;
      // Sample annulus [r, 2r].
      const dist = r * (1 + rng.next());
      const x = px + Math.cos(angle) * dist;
      const y = py + Math.sin(angle) * dist;
      if (!inBounds(x, y)) continue;
      const rLocal = opts.spacingFn(x, y);
      if (!farFromNeighbours(x, y, rLocal)) continue;
      active.push(insert(x, y));
      placed = true;
      break;
    }

    if (!placed) {
      // Pull-from-back trick to make removal O(1).
      active[ai] = active[active.length - 1]!;
      active.pop();
    }
  }

  return Float64Array.from(points);
}
