import * as THREE from 'three';
import {
  BLOCK_BASE_DEPTH,
  CAUSTIC_INTENSITY,
  CAUSTIC_SCALE,
  CAUSTIC_SPEED,
  CLIFF_CHOP_AMPLITUDE,
  DEEP_TINT,
  DROPOFF_DEPTH,
  ROTOR_RADIUS,
  FOAM_AMP_THRESHOLD,
  FOAM_DEPTH_THRESHOLD,
  FOAM_TINT,
  MID_BAND,
  MID_TINT,
  NUM_GERSTNER_WAVES,
  SEA_LEVEL,
  SHALLOW_BAND,
  SHALLOW_TINT,
  SIDE_FACE_TINT,
  WAVE_AMPLITUDE_DEEP,
  WAVE_AMPLITUDE_SHORE,
  WAVE_STEP_RATIO,
} from '@/config';
import { BAND_COLOUR } from '@/world/biome';
import {
  cellVertex,
  cellVertexCount,
  type Grid,
} from '@/world/grid';
import type { WaveSpectrum } from '@/rendering/waveSpectrum';

import waveBlockVert from '@/shaders/waveBlock.vert?raw';
import waveBlockFrag from '@/shaders/waveBlock.frag?raw';

// Phase 4: prism mesh whose top vertices' Y is computed in the vertex shader
// from the wave function evaluated at the cell centre. Land cells (cellHeight
// > 0) use their static height; water cells oscillate around sea level.
//
// Wall-emission rule (different from Phase 3): the lower-indexed cell emits
// the wall on every interior shared edge. Water-water walls thus stay
// watertight as adjacent waves animate independently. Boundary walls drop
// to BLOCK_BASE_DEPTH via aIsBase.
export class WaveBlocksMesh {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(grid: Grid, spectrum: WaveSpectrum, lighting: LightingUniforms) {
    let topTris = 0;
    let sideTris = 0;
    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      topTris += n - 2;
      const start = grid.cellEdgeStart[c]!;
      for (let i = 0; i < n; i++) {
        const nb = grid.cellNeighbour[start + i]!;
        if (nb < 0 || c < nb) sideTris += 2;
      }
    }
    const totalTris = topTris + sideTris;

    const positions = new Float32Array(totalTris * 9);
    const colours = new Float32Array(totalTris * 9);
    const waveCentre = new Float32Array(totalTris * 6); // vec2 per vertex
    const waveSize = new Float32Array(totalTris * 3);
    const waveDepth = new Float32Array(totalTris * 3);
    const isBase = new Float32Array(totalTris * 3);
    const baseDepth = new Float32Array(totalTris * 3);
    const faceNormal = new Float32Array(totalTris * 9);

    let v = 0;
    const writeVertex = (
      px: number, py: number, pz: number,
      r: number, g: number, b: number,
      wcx: number, wcz: number,
      ws: number, wd: number,
      base: 0 | 1,
      nx: number, ny: number, nz: number,
    ): void => {
      positions[v * 3] = px;
      positions[v * 3 + 1] = py;
      positions[v * 3 + 2] = pz;
      colours[v * 3] = r;
      colours[v * 3 + 1] = g;
      colours[v * 3 + 2] = b;
      waveCentre[v * 2] = wcx;
      waveCentre[v * 2 + 1] = wcz;
      waveSize[v] = ws;
      waveDepth[v] = wd;
      isBase[v] = base;
      baseDepth[v] = BLOCK_BASE_DEPTH;
      faceNormal[v * 3] = nx;
      faceNormal[v * 3 + 1] = ny;
      faceNormal[v * 3 + 2] = nz;
      v++;
    };

    for (let c = 0; c < grid.cellCount; c++) {
      const n = cellVertexCount(grid, c);
      const cCentreX = grid.cellCentre[c * 2]!;
      const cCentreZ = grid.cellCentre[c * 2 + 1]!;
      const cSize = grid.cellSize[c]!;
      const cDepth = grid.cellHeight[c]!;
      const top = BAND_COLOUR[grid.cellTag[c] as 0 | 1 | 2 | 3 | 4 | 5 | 6];
      const tr = top[0], tg = top[1], tb = top[2];
      const sr = tr * SIDE_FACE_TINT;
      const sg = tg * SIDE_FACE_TINT;
      const sb = tb * SIDE_FACE_TINT;

      // Top face: fan from vertex 0. Normal is up.
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
        // y is overwritten in the shader; pass static h as a sensible fallback.
        const fallbackY = cDepth > SEA_LEVEL ? cDepth : SEA_LEVEL;
        writeVertex(x0, fallbackY, z0, tr, tg, tb, cCentreX, cCentreZ, cSize, cDepth, 0, 0, 1, 0);
        writeVertex(xa, fallbackY, za, tr, tg, tb, cCentreX, cCentreZ, cSize, cDepth, 0, 0, 1, 0);
        writeVertex(xb, fallbackY, zb, tr, tg, tb, cCentreX, cCentreZ, cSize, cDepth, 0, 0, 1, 0);
      }

      // Side walls: emitted by the lower-indexed cell, or always for boundary.
      const start = grid.cellEdgeStart[c]!;
      for (let i = 0; i < n; i++) {
        const nb = grid.cellNeighbour[start + i]!;
        if (nb >= 0 && c >= nb) continue;

        const va = cellVertex(grid, c, i);
        const vb = cellVertex(grid, c, (i + 1) % n);
        const xa = grid.points[va * 2]!;
        const za = grid.points[va * 2 + 1]!;
        const xb = grid.points[vb * 2]!;
        const zb = grid.points[vb * 2 + 1]!;

        // Outward-facing normal: edge direction × up, normalised.
        const ex = xb - xa;
        const ez = zb - za;
        const elen = Math.hypot(ex, ez) || 1;
        // Cell c is on the left of edge a→b (CCW vertex order). Outward normal
        // points to the right of a→b in XZ.
        const nx = ez / elen;
        const nz = -ex / elen;

        // Top edge: cell c's data.
        // Bottom edge: neighbour's data, or BASE if boundary.
        const bottomCellExists = nb >= 0;
        const nbCentreX = bottomCellExists ? grid.cellCentre[nb * 2]! : cCentreX;
        const nbCentreZ = bottomCellExists ? grid.cellCentre[nb * 2 + 1]! : cCentreZ;
        const nbSize = bottomCellExists ? grid.cellSize[nb]! : cSize;
        const nbDepth = bottomCellExists ? grid.cellHeight[nb]! : cDepth;
        const bottomBase: 0 | 1 = bottomCellExists ? 0 : 1;

        // First triangle: top-a, bottom-a, top-b
        writeVertex(xa, 0, za, sr, sg, sb, cCentreX, cCentreZ, cSize, cDepth, 0, nx, 0, nz);
        writeVertex(xa, 0, za, sr, sg, sb, nbCentreX, nbCentreZ, nbSize, nbDepth, bottomBase, nx, 0, nz);
        writeVertex(xb, 0, zb, sr, sg, sb, cCentreX, cCentreZ, cSize, cDepth, 0, nx, 0, nz);

        // Second triangle: top-b, bottom-a, bottom-b
        writeVertex(xb, 0, zb, sr, sg, sb, cCentreX, cCentreZ, cSize, cDepth, 0, nx, 0, nz);
        writeVertex(xa, 0, za, sr, sg, sb, nbCentreX, nbCentreZ, nbSize, nbDepth, bottomBase, nx, 0, nz);
        writeVertex(xb, 0, zb, sr, sg, sb, nbCentreX, nbCentreZ, nbSize, nbDepth, bottomBase, nx, 0, nz);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geom.setAttribute('aWaveCentre', new THREE.BufferAttribute(waveCentre, 2));
    geom.setAttribute('aWaveSize', new THREE.BufferAttribute(waveSize, 1));
    geom.setAttribute('aWaveDepth', new THREE.BufferAttribute(waveDepth, 1));
    geom.setAttribute('aIsBase', new THREE.BufferAttribute(isBase, 1));
    geom.setAttribute('aBaseDepth', new THREE.BufferAttribute(baseDepth, 1));
    geom.setAttribute('aFaceNormal', new THREE.BufferAttribute(faceNormal, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: waveBlockVert,
      fragmentShader: waveBlockFrag,
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWaveDir: { value: spectrumDirsAsVec2Array(spectrum) },
        uWavelength: { value: Array.from(spectrum.wavelengths) },
        uAmplitude: { value: Array.from(spectrum.amplitudes) },
        uPhase: { value: Array.from(spectrum.phases) },
        uWaveAmpDeep: { value: WAVE_AMPLITUDE_DEEP },
        uWaveAmpShore: { value: WAVE_AMPLITUDE_SHORE },
        uDropoffDepth: { value: DROPOFF_DEPTH },
        uSeaLevel: { value: SEA_LEVEL },
        uWaveStepRatio: { value: WAVE_STEP_RATIO },
        uLightDir: { value: lighting.lightDir.clone() },
        uLightColor: { value: lighting.lightColor.clone() },
        uAmbient: { value: lighting.ambient.clone() },
        uShallowTint: { value: tintVec3(SHALLOW_TINT) },
        uMidTint: { value: tintVec3(MID_TINT) },
        uDeepTint: { value: tintVec3(DEEP_TINT) },
        uFoamTint: { value: tintVec3(FOAM_TINT) },
        uShallowBand: { value: SHALLOW_BAND },
        uMidBand: { value: MID_BAND },
        uCausticScale: { value: CAUSTIC_SCALE },
        uCausticSpeed: { value: CAUSTIC_SPEED },
        uCausticIntensity: { value: CAUSTIC_INTENSITY },
        uFoamAmpThreshold: { value: FOAM_AMP_THRESHOLD },
        uFoamDepthThreshold: { value: FOAM_DEPTH_THRESHOLD },
        uShadowMap: { value: null as THREE.Texture | null },
        uShadowBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
        uCliffChopAmplitude: { value: CLIFF_CHOP_AMPLITUDE },
        uRotorWash: { value: new THREE.Vector3(0, 0, 0) },
        uRotorRadius: { value: ROTOR_RADIUS },
      },
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.frustumCulled = false; // wave displacement may exceed baked AABB
  }

  setTime(t: number): void {
    this.material.uniforms.uTime!.value = t;
  }

  setShadowField(texture: THREE.Texture, bounds: THREE.Vector4): void {
    this.material.uniforms.uShadowMap!.value = texture;
    (this.material.uniforms.uShadowBounds!.value as THREE.Vector4).copy(bounds);
  }

  setRotorWash(heliX: number, heliZ: number, intensity: number): void {
    const v = this.material.uniforms.uRotorWash!.value as THREE.Vector3;
    v.set(heliX, heliZ, intensity);
  }

  // Rotate the existing wave directions in place by `deltaAngle` radians.
  // Used when wind direction changes at runtime (Phase 6) — keeps the
  // amplitudes/wavelengths/phases stable so the wave field continues smoothly.
  rotateWaveDirs(deltaAngle: number): void {
    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);
    const arr = this.material.uniforms.uWaveDir!.value as THREE.Vector2[];
    for (const v of arr) {
      const x = v.x;
      const y = v.y;
      v.x = x * cos - y * sin;
      v.y = x * sin + y * cos;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

export interface LightingUniforms {
  readonly lightDir: THREE.Vector3;
  // Three.js's vec3 uniform setter reads .x/.y/.z, which Color objects don't
  // expose — passing a Color uploads zeros and gives black output. Use
  // Vector3 with rgb mapped to xyz.
  readonly lightColor: THREE.Vector3;
  readonly ambient: THREE.Vector3;
}

function spectrumDirsAsVec2Array(spectrum: WaveSpectrum): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < NUM_GERSTNER_WAVES; i++) {
    out.push(new THREE.Vector2(spectrum.directions[i * 2]!, spectrum.directions[i * 2 + 1]!));
  }
  return out;
}

function tintVec3(t: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(t[0], t[1], t[2]);
}
