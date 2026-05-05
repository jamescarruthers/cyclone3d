import * as THREE from 'three';
import { BLOCK_BASE_DEPTH, SIDE_FACE_TINT } from '@/config';
import { BAND_COLOUR } from '@/world/biome';
import {
  cellVertex,
  cellVertexCount,
  type Grid,
} from '@/world/grid';

// Phase 3: each Stålberg cell becomes a flat-topped prism. Side quads appear
// only on edges where this cell is strictly higher than its neighbour, so
// each visible step is built by exactly one cell (no z-fighting). Boundary
// edges drop to BLOCK_BASE_DEPTH.
//
// Heights are static (sampled from the heightfield in Phase 2). Phase 4
// replaces top-face Y with a vertex-shader wave evaluation; only this file
// needs to change at that point.
export class BlockMesh {
  readonly mesh: THREE.Mesh;

  constructor(grid: Grid) {
    // Pre-count triangles so we can size buffers exactly.
    let topTris = 0;
    let sideTris = 0;
    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      topTris += n - 2; // fan triangulation
      const h = grid.cellHeight[c]!;
      const start = grid.cellEdgeStart[c]!;
      for (let i = 0; i < n; i++) {
        const nb = grid.cellNeighbour[start + i]!;
        const bottom = nb < 0 ? BLOCK_BASE_DEPTH : grid.cellHeight[nb]!;
        if (h > bottom) sideTris += 2; // quad split
      }
    }

    const totalTris = topTris + sideTris;
    const positions = new Float32Array(totalTris * 9);
    const colours = new Float32Array(totalTris * 9);

    let v = 0;
    const writeVertex = (
      px: number, py: number, pz: number,
      r: number, g: number, b: number,
    ): void => {
      const o = v * 3;
      positions[o] = px;
      positions[o + 1] = py;
      positions[o + 2] = pz;
      colours[o] = r;
      colours[o + 1] = g;
      colours[o + 2] = b;
      v++;
    };

    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      const h = grid.cellHeight[c]!;
      const top = BAND_COLOUR[grid.cellTag[c] as 0 | 1 | 2 | 3 | 4 | 5 | 6];
      const tr = top[0], tg = top[1], tb = top[2];
      const sr = tr * SIDE_FACE_TINT;
      const sg = tg * SIDE_FACE_TINT;
      const sb = tb * SIDE_FACE_TINT;

      // Top face: fan from vertex 0.
      const v0 = cellVertex(grid, c, 0);
      const x0 = grid.points[v0 * 2]!;
      const z0 = grid.points[v0 * 2 + 1]!;
      for (let i = 1; i < n - 1; i++) {
        const va = cellVertex(grid, c, i);
        const vb = cellVertex(grid, c, i + 1);
        const xa = grid.points[va * 2]!;
        const za = grid.points[va * 2 + 1]!;
        const xb = grid.points[vb * 2]!;
        const zb = grid.points[vb * 2 + 1]!;
        writeVertex(x0, h, z0, tr, tg, tb);
        writeVertex(xa, h, za, tr, tg, tb);
        writeVertex(xb, h, zb, tr, tg, tb);
      }

      // Side walls.
      const start = grid.cellEdgeStart[c]!;
      for (let i = 0; i < n; i++) {
        const nb = grid.cellNeighbour[start + i]!;
        const bottom = nb < 0 ? BLOCK_BASE_DEPTH : grid.cellHeight[nb]!;
        if (h <= bottom) continue;

        const va = cellVertex(grid, c, i);
        const vb = cellVertex(grid, c, (i + 1) % n);
        const xa = grid.points[va * 2]!;
        const za = grid.points[va * 2 + 1]!;
        const xb = grid.points[vb * 2]!;
        const zb = grid.points[vb * 2 + 1]!;

        // CCW-from-outside ordering: top-a, bottom-a, top-b ; top-b, bottom-a, bottom-b.
        // The cell's CCW vertex order means edge a→b has the cell interior on
        // the left; the outside-facing normal points to the right of a→b.
        writeVertex(xa, h, za, sr, sg, sb);
        writeVertex(xa, bottom, za, sr, sg, sb);
        writeVertex(xb, h, zb, sr, sg, sb);

        writeVertex(xb, h, zb, sr, sg, sb);
        writeVertex(xa, bottom, za, sr, sg, sb);
        writeVertex(xb, bottom, zb, sr, sg, sb);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(geom, mat);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
