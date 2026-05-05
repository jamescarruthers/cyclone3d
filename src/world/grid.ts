import { Delaunay } from 'd3-delaunay';
import {
  DROPOFF_DEPTH,
  WAVE_CELL_DEEP,
  WAVE_CELL_SHORE,
} from '@/config';
import { hashSeed, Rng } from '@/procgen/rng';
import { bridsonVariable } from '@/procgen/poisson';
import { laplacianSmooth } from '@/procgen/laplacian';
import { pairTriangles } from '@/procgen/quadPair';
import { height, type Island } from '@/world/heightfield';
import { lerp, smoothstep } from '@/utils/math';
import { bandFromHeight } from '@/world/biome';

export interface GridBounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

// Vertex count of cell `cellIdx`: 4 for a quad, 3 for a triangle.
export function cellVertexCount(grid: Grid, cellIdx: number): number {
  return cellIdx < grid.quads.length / 4 ? 4 : 3;
}

// i'th corner vertex index of cell `cellIdx` (CCW, 0..vertexCount-1).
export function cellVertex(grid: Grid, cellIdx: number, i: number): number {
  const numQuads = grid.quads.length / 4;
  if (cellIdx < numQuads) return grid.quads[cellIdx * 4 + i]!;
  return grid.triangles[(cellIdx - numQuads) * 3 + i]!;
}

// A cell is either a quad (4 indices) or a triangle (3 indices). Stored
// flat for cache friendliness; tags/centres are parallel arrays indexed
// by cell number.
export interface Grid {
  readonly points: Float64Array; // [x0, z0, x1, z1, ...]
  readonly quads: Uint32Array; // 4 indices per quad, CCW
  readonly triangles: Uint32Array; // 3 indices per leftover triangle, CCW
  readonly cellCount: number; // quads.length/4 + triangles.length/3
  readonly cellCentre: Float32Array; // [cx0, cz0, cx1, cz1, ...]
  readonly cellHeight: Float32Array; // sampled heightfield at centre
  readonly cellSize: Float32Array; // longest edge length, m
  readonly cellTag: Uint8Array; // Band enum per cell

  // Adjacency: parallel to cell vertices. `cellEdgeStart[c]` is the offset
  // into `cellNeighbour` for cell c's first edge. Edge i of cell c sits at
  // `cellEdgeStart[c] + i`. Value is the neighbour cell index across that
  // edge, or -1 for grid-boundary edges.
  readonly cellEdgeStart: Uint32Array; // length cellCount + 1
  readonly cellNeighbour: Int32Array; // total = sum of cell vertex counts
}

function spacingForDepth(depth: number): number {
  // depth here is signed: > 0 above water, < 0 below. SPEC formula:
  // spacing = lerp(SHORE, DEEP, smoothstep(0, |DROPOFF|, -depth))
  const t = smoothstep(0, Math.abs(DROPOFF_DEPTH), -depth);
  return lerp(WAVE_CELL_SHORE, WAVE_CELL_DEEP, t);
}

export function buildGrid(
  islands: readonly Island[],
  bounds: GridBounds,
  worldSeed: number,
): Grid {
  const seed = hashSeed(worldSeed, 'grid', bounds.minX, bounds.minZ);
  const rng = new Rng(seed);

  const spacingFn = (x: number, y: number): number =>
    spacingForDepth(height(islands, x, y));

  const rawPoints = bridsonVariable(rng, {
    minX: bounds.minX,
    minY: bounds.minZ,
    maxX: bounds.maxX,
    maxY: bounds.maxZ,
    spacingFn,
    minSpacing: WAVE_CELL_SHORE,
    maxSpacing: WAVE_CELL_DEEP,
  });

  const initialDelaunay = new Delaunay(rawPoints);
  const initialNeighbours = neighbourSetsFromDelaunay(initialDelaunay, rawPoints.length / 2);
  const pinned = pinnedFromHull(initialDelaunay.hull, rawPoints.length / 2);

  // Smoothing is applied to a mutable copy so the caller's input is preserved.
  const smoothPoints = new Float64Array(rawPoints);
  laplacianSmooth(smoothPoints, initialNeighbours, pinned, 4, 0.4);

  const delaunay = new Delaunay(smoothPoints);
  const triangles = new Uint32Array(delaunay.triangles);
  const halfedges = new Int32Array(delaunay.halfedges);

  const { quads, leftoverTriangles } = pairTriangles(smoothPoints, triangles, halfedges);

  const cellCount = quads.length / 4 + leftoverTriangles.length / 3;
  const cellCentre = new Float32Array(cellCount * 2);
  const cellHeight = new Float32Array(cellCount);
  const cellSize = new Float32Array(cellCount);
  const cellTag = new Uint8Array(cellCount);

  let ci = 0;
  for (let q = 0; q < quads.length; q += 4) {
    const ax = smoothPoints[quads[q]! * 2]!;
    const az = smoothPoints[quads[q]! * 2 + 1]!;
    const bx = smoothPoints[quads[q + 1]! * 2]!;
    const bz = smoothPoints[quads[q + 1]! * 2 + 1]!;
    const cx = smoothPoints[quads[q + 2]! * 2]!;
    const cz = smoothPoints[quads[q + 2]! * 2 + 1]!;
    const dx = smoothPoints[quads[q + 3]! * 2]!;
    const dz = smoothPoints[quads[q + 3]! * 2 + 1]!;
    const mx = (ax + bx + cx + dx) * 0.25;
    const mz = (az + bz + cz + dz) * 0.25;
    cellCentre[ci * 2] = mx;
    cellCentre[ci * 2 + 1] = mz;
    cellHeight[ci] = height(islands, mx, mz);
    cellSize[ci] = longestEdge4(ax, az, bx, bz, cx, cz, dx, dz);
    cellTag[ci] = bandFromHeight(cellHeight[ci]!);
    ci++;
  }
  for (let t = 0; t < leftoverTriangles.length; t += 3) {
    const ax = smoothPoints[leftoverTriangles[t]! * 2]!;
    const az = smoothPoints[leftoverTriangles[t]! * 2 + 1]!;
    const bx = smoothPoints[leftoverTriangles[t + 1]! * 2]!;
    const bz = smoothPoints[leftoverTriangles[t + 1]! * 2 + 1]!;
    const cx = smoothPoints[leftoverTriangles[t + 2]! * 2]!;
    const cz = smoothPoints[leftoverTriangles[t + 2]! * 2 + 1]!;
    const mx = (ax + bx + cx) / 3;
    const mz = (az + bz + cz) / 3;
    cellCentre[ci * 2] = mx;
    cellCentre[ci * 2 + 1] = mz;
    cellHeight[ci] = height(islands, mx, mz);
    cellSize[ci] = longestEdge3(ax, az, bx, bz, cx, cz);
    cellTag[ci] = bandFromHeight(cellHeight[ci]!);
    ci++;
  }

  // Adjacency: for each cell, build the parallel neighbour array.
  const numQuads = quads.length / 4;
  const totalEdges = numQuads * 4 + (leftoverTriangles.length / 3) * 3;
  const cellEdgeStart = new Uint32Array(cellCount + 1);
  const cellNeighbour = new Int32Array(totalEdges).fill(-1);

  let off = 0;
  for (let c = 0; c < cellCount; c++) {
    cellEdgeStart[c] = off;
    off += c < numQuads ? 4 : 3;
  }
  cellEdgeStart[cellCount] = off;

  // Edge map: vertex pair → first cell that claimed it. When a second cell
  // hits the same key, we link them in cellNeighbour at both edge slots.
  const edgeMap = new Map<number, { cell: number; slot: number }>();
  const KEY_SHIFT = 1 << 21; // supports up to 2M points per chunk

  const setEdge = (cellIdx: number): void => {
    const n = cellIdx < numQuads ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const va = cellIdx < numQuads
        ? quads[cellIdx * 4 + i]!
        : leftoverTriangles[(cellIdx - numQuads) * 3 + i]!;
      const vb = cellIdx < numQuads
        ? quads[cellIdx * 4 + ((i + 1) % 4)]!
        : leftoverTriangles[(cellIdx - numQuads) * 3 + ((i + 1) % 3)]!;
      const lo = va < vb ? va : vb;
      const hi = va < vb ? vb : va;
      const key = lo * KEY_SHIFT + hi;
      const slot = cellEdgeStart[cellIdx]! + i;
      const existing = edgeMap.get(key);
      if (existing) {
        cellNeighbour[slot] = existing.cell;
        cellNeighbour[existing.slot] = cellIdx;
        edgeMap.delete(key);
      } else {
        edgeMap.set(key, { cell: cellIdx, slot });
      }
    }
  };
  for (let c = 0; c < cellCount; c++) setEdge(c);

  return {
    points: smoothPoints,
    quads,
    triangles: leftoverTriangles,
    cellCount,
    cellCentre,
    cellHeight,
    cellSize,
    cellTag,
    cellEdgeStart,
    cellNeighbour,
  };
}

function neighbourSetsFromDelaunay(
  delaunay: Delaunay<ArrayLike<number>>,
  n: number,
): number[][] {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (const j of delaunay.neighbors(i)) out[i]!.push(j);
  }
  return out;
}

function pinnedFromHull(hull: Uint32Array, n: number): Uint8Array {
  const pinned = new Uint8Array(n);
  for (let i = 0; i < hull.length; i++) pinned[hull[i]!] = 1;
  return pinned;
}

function longestEdge3(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
): number {
  const d = (px: number, py: number, qx: number, qy: number): number => {
    const dx = qx - px;
    const dy = qy - py;
    return Math.sqrt(dx * dx + dy * dy);
  };
  return Math.max(d(ax, ay, bx, by), d(bx, by, cx, cy), d(cx, cy, ax, ay));
}

function longestEdge4(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  const d = (px: number, py: number, qx: number, qy: number): number => {
    const ex = qx - px;
    const ey = qy - py;
    return Math.sqrt(ex * ex + ey * ey);
  };
  return Math.max(
    d(ax, ay, bx, by),
    d(bx, by, cx, cy),
    d(cx, cy, dx, dy),
    d(dx, dy, ax, ay),
  );
}
