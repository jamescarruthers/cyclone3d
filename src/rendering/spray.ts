import * as THREE from 'three';
import {
  ROTOR_RADIUS,
  SEA_LEVEL,
  SPRAY_PARTICLE_COUNT,
  SPRAY_PARTICLE_LIFE,
  SPRAY_PARTICLE_SIZE,
  SPRAY_SPAWN_RATE,
} from '@/config';
import { Rng } from '@/procgen/rng';

// Pool-backed point particle system. When the heli is low + over water, new
// particles spawn at the heli XZ within the rotor radius with an outward +
// upward initial velocity. Gravity pulls them back down; expired particles
// get hidden far below until they're respawned.
//
// Deterministic from a seed so screenshot tests don't drift.
export class Spray {
  readonly points: THREE.Points;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly maxAges: Float32Array;
  private readonly count: number;
  private readonly rng: Rng;
  private spawnAccumulator = 0;

  constructor(seed = 0xc1c10ee) {
    this.count = SPRAY_PARTICLE_COUNT;
    this.rng = new Rng(seed);
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.ages = new Float32Array(this.count);
    this.maxAges = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.ages[i] = Number.POSITIVE_INFINITY;
      this.positions[i * 3 + 1] = -1000; // hide
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      size: SPRAY_PARTICLE_SIZE,
      color: 0xf2faff,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geom, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  update(
    dt: number,
    heliX: number,
    heliZ: number,
    spawning: boolean,
  ): void {
    this.spawnAccumulator += spawning ? dt * SPRAY_SPAWN_RATE : 0;
    let toSpawn = Math.floor(this.spawnAccumulator);
    this.spawnAccumulator -= toSpawn;

    for (let i = 0; i < this.count; i++) {
      this.ages[i]! += dt;
      if (this.ages[i]! >= this.maxAges[i]!) {
        if (toSpawn > 0) {
          this.spawn(i, heliX, heliZ);
          toSpawn--;
        } else {
          this.positions[i * 3 + 1] = -1000;
        }
        continue;
      }
      const o = i * 3;
      this.positions[o] = this.positions[o]! + this.velocities[o]! * dt;
      this.positions[o + 1] = this.positions[o + 1]! + this.velocities[o + 1]! * dt;
      this.positions[o + 2] = this.positions[o + 2]! + this.velocities[o + 2]! * dt;
      this.velocities[o + 1] = this.velocities[o + 1]! - 9.8 * dt;
    }

    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private spawn(i: number, heliX: number, heliZ: number): void {
    const angle = this.rng.next() * Math.PI * 2;
    const r = Math.sqrt(this.rng.next()) * ROTOR_RADIUS;
    const o = i * 3;
    this.positions[o] = heliX + Math.cos(angle) * r;
    this.positions[o + 1] = SEA_LEVEL + 0.1;
    this.positions[o + 2] = heliZ + Math.sin(angle) * r;
    const horizSpeed = 3 + this.rng.next() * 5;
    this.velocities[o] = Math.cos(angle) * horizSpeed;
    this.velocities[o + 1] = 2 + this.rng.next() * 3;
    this.velocities[o + 2] = Math.sin(angle) * horizSpeed;
    this.ages[i] = 0;
    this.maxAges[i] = SPRAY_PARTICLE_LIFE * (0.7 + this.rng.next() * 0.6);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
