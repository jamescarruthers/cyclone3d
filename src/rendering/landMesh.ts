import * as THREE from 'three';
import { BAND_COLOUR, bandFromHeight } from '@/world/biome';
import { height, type Island } from '@/world/heightfield';
import { SEA_LEVEL } from '@/config';

// Phase 1: a single regular-grid mesh. NOT Stålberg — that lands in Phase 2.
// Vertex Y comes from the heightfield (clamped to sea level for underwater
// portions so the surface still reads, with depth encoded into vertex colour).
//
// Per CLAUDE.md §4: this mesh owns its geometry and material, and dispose()
// must be called when it leaves the scene.
export interface LandMeshOptions {
  readonly extent: number; // world-space side length
  readonly resolution: number; // metres per quad
  readonly centreX?: number;
  readonly centreZ?: number;
}

export class LandMesh {
  readonly mesh: THREE.Mesh;

  constructor(islands: readonly Island[], opts: LandMeshOptions) {
    const centreX = opts.centreX ?? 0;
    const centreZ = opts.centreZ ?? 0;
    const half = opts.extent / 2;
    const cells = Math.max(1, Math.round(opts.extent / opts.resolution));
    const verts = cells + 1;

    const positions = new Float32Array(verts * verts * 3);
    const colours = new Float32Array(verts * verts * 3);
    const indices = new Uint32Array(cells * cells * 6);

    for (let j = 0; j < verts; j++) {
      for (let i = 0; i < verts; i++) {
        const x = centreX - half + (i / cells) * opts.extent;
        const z = centreZ - half + (j / cells) * opts.extent;
        const h = height(islands, x, z);

        const vi = (j * verts + i) * 3;
        // Underwater geometry sits at sea level; depth is conveyed by colour.
        // The seafloor is rendered visually via vertex colour bands (shore,
        // shelf, dropoff, deep). Phase 4+ animates the water surface.
        positions[vi] = x;
        positions[vi + 1] = h > SEA_LEVEL ? h : SEA_LEVEL;
        positions[vi + 2] = z;

        const col = BAND_COLOUR[bandFromHeight(h)];
        colours[vi] = col[0];
        colours[vi + 1] = col[1];
        colours[vi + 2] = col[2];
      }
    }

    let idx = 0;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const a = j * verts + i;
        const b = a + 1;
        const c = a + verts;
        const d = c + 1;
        indices[idx++] = a;
        indices[idx++] = c;
        indices[idx++] = b;
        indices[idx++] = b;
        indices[idx++] = c;
        indices[idx++] = d;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(geom, mat);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
