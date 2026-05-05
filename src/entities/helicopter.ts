import * as THREE from 'three';
import {
  HELICOPTER_PLACEHOLDER_COLOUR,
  HELI_TYPICAL_ALTITUDE,
} from '@/config';

// Phase 0 placeholder: a coloured box. Replaced by a proper model in a later phase.
export class Helicopter {
  readonly mesh: THREE.Mesh;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  heading = 0; // yaw radians
  bank = 0; // visual roll radians

  constructor() {
    const geom = new THREE.BoxGeometry(4, 1.5, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: HELICOPTER_PLACEHOLDER_COLOUR,
      roughness: 0.7,
      metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(0, HELI_TYPICAL_ALTITUDE, 0);
    this.position = this.mesh.position;
  }

  applyTransform(): void {
    this.mesh.rotation.set(0, this.heading, this.bank, 'YXZ');
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
