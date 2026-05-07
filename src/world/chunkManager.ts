import * as THREE from 'three';
import { CHUNK_SIZE, CHUNKS_AHEAD, CHUNKS_BEHIND } from '@/config';
import { Chunk } from '@/world/chunk';
import { gatherIslands } from '@/world/islands';
import type { Island } from '@/world/heightfield';
import type { LightingUniforms } from '@/rendering/waveBlocksMesh';
import type { WaveSpectrum } from '@/rendering/waveSpectrum';

// Streaming controller: keeps a window of Chunks loaded around the helicopter,
// disposes those that fall outside the window, and forwards per-frame
// uniform updates (time, rotor wash) and runtime wind changes to all loaded
// chunks.
//
// Per SPEC §Streaming: chunks within `CHUNKS_AHEAD` of the heli's chunk are
// kept loaded; those outside `CHUNKS_AHEAD + CHUNKS_BEHIND` are disposed.

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export class ChunkManager {
  private readonly chunks = new Map<string, Chunk>();
  private readonly worldSeed: number;
  private readonly spectrum: WaveSpectrum;
  private readonly lighting: LightingUniforms;
  private readonly scene: THREE.Scene;
  private windDir: [number, number];

  constructor(
    scene: THREE.Scene,
    worldSeed: number,
    spectrum: WaveSpectrum,
    lighting: LightingUniforms,
    initialWind: readonly [number, number],
  ) {
    this.scene = scene;
    this.worldSeed = worldSeed;
    this.spectrum = spectrum;
    this.lighting = lighting;
    this.windDir = [initialWind[0], initialWind[1]];
  }

  // Ensure the chunks within CHUNKS_AHEAD of the heli are loaded; dispose
  // chunks outside CHUNKS_AHEAD + CHUNKS_BEHIND.
  update(heliX: number, heliZ: number): void {
    const cx = Math.floor(heliX / CHUNK_SIZE);
    const cz = Math.floor(heliZ / CHUNK_SIZE);

    for (let dz = -CHUNKS_AHEAD; dz <= CHUNKS_AHEAD; dz++) {
      for (let dx = -CHUNKS_AHEAD; dx <= CHUNKS_AHEAD; dx++) {
        const k = chunkKey(cx + dx, cz + dz);
        if (!this.chunks.has(k)) {
          this.loadChunk(cx + dx, cz + dz);
        }
      }
    }

    const keepRadius = CHUNKS_AHEAD + CHUNKS_BEHIND;
    for (const [k, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - cx) > keepRadius || Math.abs(chunk.cz - cz) > keepRadius) {
        this.scene.remove(chunk.mesh.mesh);
        this.scene.remove(chunk.scatter.group);
        chunk.dispose();
        this.chunks.delete(k);
      }
    }
  }

  setTime(t: number): void {
    for (const c of this.chunks.values()) c.mesh.setTime(t);
  }

  setRotorWash(x: number, z: number, intensity: number): void {
    for (const c of this.chunks.values()) c.mesh.setRotorWash(x, z, intensity);
  }

  // Apply a wind rotation to every loaded chunk: rebuild each chunk's shadow
  // and rotate its wave-direction uniforms in place by the same delta. The
  // canonical spectrum.directions is also rotated so newly-loaded chunks
  // come up wind-aligned.
  rotateWind(deltaAngle: number): void {
    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);
    const dirs = this.spectrum.directions;
    for (let i = 0; i < dirs.length; i += 2) {
      const x = dirs[i]!;
      const y = dirs[i + 1]!;
      dirs[i] = x * cos - y * sin;
      dirs[i + 1] = x * sin + y * cos;
    }
    const wx = this.windDir[0];
    const wz = this.windDir[1];
    this.windDir = [wx * cos - wz * sin, wx * sin + wz * cos];

    for (const c of this.chunks.values()) {
      c.mesh.rotateWaveDirs(deltaAngle);
      c.shadow.setWind(this.windDir[0], this.windDir[1]);
    }
  }

  islandsNear(x: number, z: number): Island[] {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return gatherIslands(this.worldSeed, cx, cz);
  }

  loadedCount(): number {
    return this.chunks.size;
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      this.scene.remove(chunk.mesh.mesh);
      this.scene.remove(chunk.scatter.group);
      chunk.dispose();
    }
    this.chunks.clear();
  }

  private loadChunk(cx: number, cz: number): void {
    try {
      const chunk = new Chunk(
        this.worldSeed,
        cx,
        cz,
        this.spectrum,
        this.lighting,
        this.windDir,
      );
      this.chunks.set(chunkKey(cx, cz), chunk);
      this.scene.add(chunk.mesh.mesh);
      this.scene.add(chunk.scatter.group);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[chunks] failed to load (${cx}, ${cz}):`, err);
      throw err;
    }
  }
}
