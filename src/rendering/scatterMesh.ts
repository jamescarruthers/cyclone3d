import * as THREE from 'three';
import { ScatterKind, type ScatterInstance } from '@/world/scatter';

// Three InstancedMesh pools (palm / rock / coral) drawn per chunk. Geometries
// and materials are SHARED across chunks via lazy module-level singletons —
// only the per-chunk instance count + transform matrices are unique.

let palmGeom: THREE.BufferGeometry | null = null;
let rockGeom: THREE.BufferGeometry | null = null;
let coralGeom: THREE.BufferGeometry | null = null;
let scatterMaterial: THREE.MeshStandardMaterial | null = null;

function getMaterial(): THREE.MeshStandardMaterial {
  if (!scatterMaterial) {
    scatterMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: true,
    });
  }
  return scatterMaterial;
}

function getPalmGeom(): THREE.BufferGeometry {
  if (palmGeom) return palmGeom;
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6);
  trunk.translate(0, 1.6, 0);
  paint(trunk, 0.42, 0.27, 0.16);
  const fronds = new THREE.ConeGeometry(1.1, 1.6, 6);
  fronds.translate(0, 3.6, 0);
  paint(fronds, 0.28, 0.55, 0.18);
  palmGeom = mergeColoured([trunk, fronds]);
  return palmGeom;
}

function getRockGeom(): THREE.BufferGeometry {
  if (rockGeom) return rockGeom;
  const r = new THREE.IcosahedronGeometry(1.0, 0);
  paint(r, 0.45, 0.42, 0.4);
  r.computeVertexNormals();
  rockGeom = r;
  return r;
}

function getCoralGeom(): THREE.BufferGeometry {
  if (coralGeom) return coralGeom;
  const stem = new THREE.CylinderGeometry(0.15, 0.25, 0.6, 6);
  stem.translate(0, 0.3, 0);
  paint(stem, 0.85, 0.55, 0.55);
  const top = new THREE.IcosahedronGeometry(0.45, 0);
  top.translate(0, 0.7, 0);
  paint(top, 0.96, 0.65, 0.65);
  coralGeom = mergeColoured([stem, top]);
  return coralGeom;
}

function paint(geom: THREE.BufferGeometry, r: number, g: number, b: number): void {
  const count = geom.attributes.position!.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = r;
    colours[i * 3 + 1] = g;
    colours[i * 3 + 2] = b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

// Manual merge of position + color + index. Avoids the BufferGeometryUtils
// addon import for this small case.
function mergeColoured(pieces: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const p of pieces) {
    totalVerts += p.attributes.position!.count;
    const idx = p.index;
    totalIdx += idx ? idx.count : p.attributes.position!.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const colours = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIdx);
  let vOff = 0;
  let iOff = 0;
  for (const p of pieces) {
    const ps = p.attributes.position!;
    const cs = p.attributes.color;
    if (!cs) throw new Error('mergeColoured: piece missing color attribute');
    positions.set(ps.array as Float32Array, vOff * 3);
    colours.set(cs.array as Float32Array, vOff * 3);
    const pIdx = p.index;
    if (pIdx) {
      const arr = pIdx.array as ArrayLike<number>;
      for (let i = 0; i < arr.length; i++) indices[iOff + i] = arr[i]! + vOff;
      iOff += pIdx.count;
    } else {
      for (let i = 0; i < ps.count; i++) indices[iOff + i] = vOff + i;
      iOff += ps.count;
    }
    vOff += ps.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  out.computeVertexNormals();
  return out;
}

export class ScatterMesh {
  readonly group: THREE.Group;
  readonly palms: THREE.InstancedMesh | null;
  readonly rocks: THREE.InstancedMesh | null;
  readonly corals: THREE.InstancedMesh | null;

  constructor(instances: readonly ScatterInstance[]) {
    this.group = new THREE.Group();

    let palmN = 0, rockN = 0, coralN = 0;
    for (const inst of instances) {
      if (inst.kind === ScatterKind.Palm) palmN++;
      else if (inst.kind === ScatterKind.Rock) rockN++;
      else if (inst.kind === ScatterKind.Coral) coralN++;
    }

    this.palms = palmN > 0 ? this.makeMesh(getPalmGeom(), palmN) : null;
    this.rocks = rockN > 0 ? this.makeMesh(getRockGeom(), rockN) : null;
    this.corals = coralN > 0 ? this.makeMesh(getCoralGeom(), coralN) : null;

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3();
    const pos = new THREE.Vector3();

    let pi = 0, ri = 0, ci = 0;
    for (const inst of instances) {
      pos.set(inst.x, inst.y, inst.z);
      quat.setFromAxisAngle(_UP, inst.rotationY);
      scaleVec.setScalar(inst.scale);
      matrix.compose(pos, quat, scaleVec);
      if (inst.kind === ScatterKind.Palm) this.palms!.setMatrixAt(pi++, matrix);
      else if (inst.kind === ScatterKind.Rock) this.rocks!.setMatrixAt(ri++, matrix);
      else if (inst.kind === ScatterKind.Coral) this.corals!.setMatrixAt(ci++, matrix);
    }
    if (this.palms) this.palms.instanceMatrix.needsUpdate = true;
    if (this.rocks) this.rocks.instanceMatrix.needsUpdate = true;
    if (this.corals) this.corals.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    // Geometries + material are shared module-level singletons; only the
    // InstancedMesh wrappers themselves need clearing here.
    this.palms?.dispose();
    this.rocks?.dispose();
    this.corals?.dispose();
  }

  private makeMesh(geom: THREE.BufferGeometry, count: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geom, getMaterial(), count);
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    return mesh;
  }
}

const _UP = new THREE.Vector3(0, 1, 0);
