import * as THREE from 'three';
import type { Grid } from '@/world/grid';
import { BAND_COLOUR } from '@/world/biome';
import { SEA_LEVEL } from '@/config';

// Phase 2 visualisation of the Stålberg grid: each cell rendered as a flat
// polygon (triangulated as a fan) with a single per-cell colour. Cells are
// raised slightly above sea level for above-water tags so the surface
// reads, and sit at SEA_LEVEL otherwise. Phase 3 extrudes these cells
// into prisms.
export class CellMesh {
  readonly mesh: THREE.Mesh;

  constructor(grid: Grid) {
    const triCount =
      grid.quads.length / 4 * 2 + grid.triangles.length / 3;
    const positions = new Float32Array(triCount * 3 * 3);
    const colours = new Float32Array(triCount * 3 * 3);

    let v = 0;

    const addTri = (
      ax: number, az: number,
      bx: number, bz: number,
      cx: number, cz: number,
      cellIdx: number,
    ): void => {
      const h = grid.cellHeight[cellIdx]!;
      const y = h > SEA_LEVEL ? h : SEA_LEVEL;
      const col = BAND_COLOUR[grid.cellTag[cellIdx] as 0 | 1 | 2 | 3 | 4 | 5 | 6];

      positions[v * 9] = ax; positions[v * 9 + 1] = y; positions[v * 9 + 2] = az;
      positions[v * 9 + 3] = bx; positions[v * 9 + 4] = y; positions[v * 9 + 5] = bz;
      positions[v * 9 + 6] = cx; positions[v * 9 + 7] = y; positions[v * 9 + 8] = cz;

      for (let k = 0; k < 3; k++) {
        colours[v * 9 + k * 3] = col[0];
        colours[v * 9 + k * 3 + 1] = col[1];
        colours[v * 9 + k * 3 + 2] = col[2];
      }
      v++;
    };

    let cellIdx = 0;
    for (let q = 0; q < grid.quads.length; q += 4) {
      const i0 = grid.quads[q]!;
      const i1 = grid.quads[q + 1]!;
      const i2 = grid.quads[q + 2]!;
      const i3 = grid.quads[q + 3]!;
      const x0 = grid.points[i0 * 2]!, z0 = grid.points[i0 * 2 + 1]!;
      const x1 = grid.points[i1 * 2]!, z1 = grid.points[i1 * 2 + 1]!;
      const x2 = grid.points[i2 * 2]!, z2 = grid.points[i2 * 2 + 1]!;
      const x3 = grid.points[i3 * 2]!, z3 = grid.points[i3 * 2 + 1]!;
      addTri(x0, z0, x1, z1, x2, z2, cellIdx);
      addTri(x0, z0, x2, z2, x3, z3, cellIdx);
      cellIdx++;
    }
    for (let t = 0; t < grid.triangles.length; t += 3) {
      const i0 = grid.triangles[t]!;
      const i1 = grid.triangles[t + 1]!;
      const i2 = grid.triangles[t + 2]!;
      const x0 = grid.points[i0 * 2]!, z0 = grid.points[i0 * 2 + 1]!;
      const x1 = grid.points[i1 * 2]!, z1 = grid.points[i1 * 2 + 1]!;
      const x2 = grid.points[i2 * 2]!, z2 = grid.points[i2 * 2 + 1]!;
      addTri(x0, z0, x1, z1, x2, z2, cellIdx);
      cellIdx++;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geom, mat);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
