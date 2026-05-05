import * as THREE from 'three';
import {
  CLIFF_RADIUS,
  SHADOW_BLUR_RADIUS,
  SHADOW_LANDMASK_RESOLUTION,
  SHADOW_RAY_STEP,
  SHADOW_RECOVERY_LENGTH,
  SHADOW_RESOLUTION,
} from '@/config';
import { height, type Island } from '@/world/heightfield';
import type { GridBounds } from '@/world/grid';

// Per-chunk wave shadow field, per SPEC §Shadow field.
//
// At init: rasterise a land bitmap (Phase 6 single chunk) and compute a cliff
// proximity map that doesn't depend on wind. On every wind change, ray-cast
// upwind from each shadow texel against the land bitmap, then blur the result
// perpendicular to the wind direction (cheap diffraction approximation).
//
// Texture layout: RGBA32F. R = shadow attenuation in [0, 1] (1 = full waves,
// 0 = full lee), G = cliff proximity in [0, 1] (1 = right next to land,
// 0 = far). B and A unused — RGBA chosen because RGFloat isn't universally
// supported.
export class ShadowField {
  readonly texture: THREE.DataTexture;
  readonly bounds: GridBounds;
  readonly resolution: number;
  // (minX, minZ, sizeX, sizeZ) — uploaded as a vec4 uniform for UV mapping.
  readonly boundsUniform: THREE.Vector4;

  private readonly islands: readonly Island[];
  private readonly landMask: Uint8Array;
  private readonly landMaskRes: number;
  private readonly shadowRaw: Float32Array;
  private readonly shadowBlurred: Float32Array;
  private readonly textureData: Float32Array;
  private windAngle = 0;

  constructor(
    islands: readonly Island[],
    bounds: GridBounds,
    initialWind: readonly [number, number],
  ) {
    this.islands = islands;
    this.bounds = bounds;
    this.resolution = SHADOW_RESOLUTION;
    this.landMaskRes = SHADOW_LANDMASK_RESOLUTION;

    this.boundsUniform = new THREE.Vector4(
      bounds.minX,
      bounds.minZ,
      bounds.maxX - bounds.minX,
      bounds.maxZ - bounds.minZ,
    );

    // Pre-rasterise land bitmap. Heightfield is expensive (FBM + warp + ridged),
    // but this only runs once.
    this.landMask = new Uint8Array(this.landMaskRes * this.landMaskRes);
    const sizeX = bounds.maxX - bounds.minX;
    const sizeZ = bounds.maxZ - bounds.minZ;
    const dx = sizeX / this.landMaskRes;
    const dz = sizeZ / this.landMaskRes;
    for (let j = 0; j < this.landMaskRes; j++) {
      const z = bounds.minZ + (j + 0.5) * dz;
      for (let i = 0; i < this.landMaskRes; i++) {
        const x = bounds.minX + (i + 0.5) * dx;
        this.landMask[j * this.landMaskRes + i] = height(this.islands, x, z) > 0 ? 1 : 0;
      }
    }

    this.shadowRaw = new Float32Array(this.resolution * this.resolution);
    this.shadowBlurred = new Float32Array(this.resolution * this.resolution);
    this.textureData = new Float32Array(this.resolution * this.resolution * 4);

    this.texture = new THREE.DataTexture(
      this.textureData as unknown as Float32Array<ArrayBuffer>,
      this.resolution,
      this.resolution,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    this.computeCliff();
    this.setWind(initialWind[0], initialWind[1]);
  }

  setWind(windX: number, windZ: number): void {
    this.windAngle = Math.atan2(windZ, windX);
    const len = Math.hypot(windX, windZ) || 1;
    const wx = windX / len;
    const wz = windZ / len;
    this.computeShadow(wx, wz);
    this.blurPerpendicular(wx, wz);
    this.uploadShadow();
  }

  setWindAngle(angle: number): void {
    this.setWind(Math.cos(angle), Math.sin(angle));
  }

  getWindAngle(): number {
    return this.windAngle;
  }

  // World XZ → land or not, looked up against the rasterised bitmap.
  isLand(x: number, z: number): boolean {
    const u = (x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX);
    const v = (z - this.bounds.minZ) / (this.bounds.maxZ - this.bounds.minZ);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    const i = Math.min(this.landMaskRes - 1, Math.floor(u * this.landMaskRes));
    const j = Math.min(this.landMaskRes - 1, Math.floor(v * this.landMaskRes));
    return this.landMask[j * this.landMaskRes + i] === 1;
  }

  // Read back the shadow value at a world XZ (for tests / sanity checks).
  shadowAt(x: number, z: number): number {
    return this.sampleChannel(x, z, 0);
  }

  cliffAt(x: number, z: number): number {
    return this.sampleChannel(x, z, 1);
  }

  dispose(): void {
    this.texture.dispose();
  }

  private sampleChannel(x: number, z: number, channel: number): number {
    const u = (x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX);
    const v = (z - this.bounds.minZ) / (this.bounds.maxZ - this.bounds.minZ);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 1;
    const i = Math.min(this.resolution - 1, Math.floor(u * this.resolution));
    const j = Math.min(this.resolution - 1, Math.floor(v * this.resolution));
    return this.textureData[(j * this.resolution + i) * 4 + channel]!;
  }

  private computeShadow(windX: number, windZ: number): void {
    // Ray walks from each texel UPWIND, i.e., in direction -wind.
    const rx = -windX;
    const rz = -windZ;
    const sizeX = this.bounds.maxX - this.bounds.minX;
    const sizeZ = this.bounds.maxZ - this.bounds.minZ;
    const dx = sizeX / this.resolution;
    const dz = sizeZ / this.resolution;
    const maxSteps = Math.ceil(Math.hypot(sizeX, sizeZ) / SHADOW_RAY_STEP);

    for (let j = 0; j < this.resolution; j++) {
      const z0 = this.bounds.minZ + (j + 0.5) * dz;
      for (let i = 0; i < this.resolution; i++) {
        const x0 = this.bounds.minX + (i + 0.5) * dx;
        // Land texel: amplitude irrelevant (no waves on land).
        if (this.isLand(x0, z0)) {
          this.shadowRaw[j * this.resolution + i] = 0;
          continue;
        }
        let shadow = 1.0;
        for (let s = 1; s <= maxSteps; s++) {
          const x = x0 + rx * s * SHADOW_RAY_STEP;
          const z = z0 + rz * s * SHADOW_RAY_STEP;
          if (
            x < this.bounds.minX || x >= this.bounds.maxX ||
            z < this.bounds.minZ || z >= this.bounds.maxZ
          ) break;
          if (this.isLand(x, z)) {
            const d = s * SHADOW_RAY_STEP;
            shadow = 1.0 - Math.exp(-d / SHADOW_RECOVERY_LENGTH);
            break;
          }
        }
        this.shadowRaw[j * this.resolution + i] = shadow;
      }
    }
  }

  private blurPerpendicular(windX: number, windZ: number): void {
    // Diffraction approximation: 1D Gaussian blur perpendicular to wind.
    // SPEC §Shadow field calls for kernel size growing with downwind distance;
    // the fixed-radius blur captures the soft-fanning look at lower complexity.
    const px = -windZ;
    const pz = windX;
    const radius = SHADOW_BLUR_RADIUS;
    const sigma = Math.max(radius / 2, 0.5);
    const weights = new Float32Array(radius * 2 + 1);
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const w = Math.exp(-(k * k) / (2 * sigma * sigma));
      weights[k + radius] = w;
      sum += w;
    }
    for (let k = 0; k < weights.length; k++) weights[k] = weights[k]! / sum;

    for (let j = 0; j < this.resolution; j++) {
      for (let i = 0; i < this.resolution; i++) {
        let acc = 0;
        for (let k = -radius; k <= radius; k++) {
          const ix = Math.max(0, Math.min(this.resolution - 1, i + Math.round(px * k)));
          const iz = Math.max(0, Math.min(this.resolution - 1, j + Math.round(pz * k)));
          acc += this.shadowRaw[iz * this.resolution + ix]! * weights[k + radius]!;
        }
        this.shadowBlurred[j * this.resolution + i] = acc;
      }
    }
  }

  private computeCliff(): void {
    // For each water texel, find distance to the nearest land texel within
    // CLIFF_RADIUS. Cliff intensity falls off linearly with that distance.
    // Land texels themselves are tagged 0 (waves are blocked at land anyway).
    const sizeX = this.bounds.maxX - this.bounds.minX;
    const sizeZ = this.bounds.maxZ - this.bounds.minZ;
    const dx = sizeX / this.resolution;
    const dz = sizeZ / this.resolution;
    const radiusTexels = Math.ceil(CLIFF_RADIUS / Math.min(dx, dz));

    for (let j = 0; j < this.resolution; j++) {
      const z0 = this.bounds.minZ + (j + 0.5) * dz;
      for (let i = 0; i < this.resolution; i++) {
        const x0 = this.bounds.minX + (i + 0.5) * dx;
        let cliff = 0;
        if (!this.isLand(x0, z0)) {
          let minDist = CLIFF_RADIUS + 1;
          for (let dj = -radiusTexels; dj <= radiusTexels; dj++) {
            const z = z0 + dj * dz;
            for (let di = -radiusTexels; di <= radiusTexels; di++) {
              const x = x0 + di * dx;
              if (this.isLand(x, z)) {
                const d = Math.hypot(di * dx, dj * dz);
                if (d < minDist) minDist = d;
              }
            }
          }
          if (minDist < CLIFF_RADIUS) cliff = 1 - minDist / CLIFF_RADIUS;
        }
        this.textureData[(j * this.resolution + i) * 4 + 1] = cliff;
      }
    }
  }

  private uploadShadow(): void {
    // R channel = shadow. G already populated (cliff). B/A unused.
    for (let i = 0; i < this.shadowBlurred.length; i++) {
      this.textureData[i * 4] = this.shadowBlurred[i]!;
    }
    this.texture.needsUpdate = true;
  }
}
