import * as THREE from 'three';
import {
  HELI_SHADOW_MAX_ALTITUDE,
  HELI_SHADOW_OPACITY_MAX,
  HELI_SHADOW_RADIUS,
} from '@/config';
import { clamp } from '@/utils/math';

// Soft-edged dark disc that sits just above whatever surface is below the
// helicopter. Caller is responsible for sampling that surface (terrain or
// wave Y) and passing it to setPosition().
//
// Per SPEC §Helicopter shadow: scale grows slightly with altitude, alpha
// fades out as the heli climbs.
export class HelicopterShadow {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;

  constructor() {
    const geom = new THREE.CircleGeometry(HELI_SHADOW_RADIUS, 32);
    geom.rotateX(-Math.PI / 2);

    const tex = makeRadialFalloffTexture(64);
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: HELI_SHADOW_OPACITY_MAX,
      depthWrite: false,
      alphaMap: tex,
    });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.renderOrder = 5; // on top of water but under spray
  }

  setPosition(heliX: number, heliZ: number, surfaceY: number, altitude: number): void {
    // Slight Y bias so the disc sits above the surface and doesn't z-fight.
    this.mesh.position.set(heliX, surfaceY + 0.05, heliZ);
    const t = clamp(altitude / HELI_SHADOW_MAX_ALTITUDE, 0, 1);
    // Scale grows ~30% over the altitude range; opacity fades to 0.
    const scale = 1 + t * 0.3;
    this.mesh.scale.set(scale, 1, scale);
    this.material.opacity = HELI_SHADOW_OPACITY_MAX * (1 - t);
    this.mesh.visible = this.material.opacity > 0.01;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.alphaMap?.dispose();
    this.material.dispose();
  }
}

function makeRadialFalloffTexture(size: number): THREE.DataTexture {
  // Smooth radial alpha — opaque centre, soft fade to 0 at edge.
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) * 0.5;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (i - c) / c;
      const dy = (j - c) / c;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const t = 1 - r;
      const alpha = Math.round(255 * t * t * (3 - 2 * t)); // smoothstep
      const o = (j * size + i) * 4;
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      data[o + 3] = alpha;
    }
  }
  const tex = new THREE.DataTexture(
    data as unknown as Uint8Array<ArrayBuffer>,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
