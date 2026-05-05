import * as THREE from 'three';
import {
  CAMERA_DISTANCE,
  CAMERA_FAR,
  CAMERA_NEAR,
  CAMERA_PITCH_DEG,
  CAMERA_VIEW_WIDTH,
  CAMERA_YAW_DEG,
} from '@/config';
import { degToRad } from '@/utils/math';

// Orthographic isometric camera. Fixed pitch/yaw, follows a focal point in
// world XZ (and Y, per SPEC). The world flies past beneath; camera does not
// rotate with the helicopter heading.
export class IsoCamera {
  readonly camera: THREE.OrthographicCamera;
  private readonly offset: THREE.Vector3;
  private readonly tmp = new THREE.Vector3();

  constructor(aspect: number) {
    const halfW = CAMERA_VIEW_WIDTH / 2;
    const halfH = halfW / aspect;
    this.camera = new THREE.OrthographicCamera(
      -halfW,
      halfW,
      halfH,
      -halfH,
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    const pitch = degToRad(CAMERA_PITCH_DEG);
    const yaw = degToRad(CAMERA_YAW_DEG);
    // Direction from focal point to camera. Pitch is angle above horizon.
    this.offset = new THREE.Vector3(
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
      Math.cos(pitch) * Math.cos(yaw),
    ).multiplyScalar(CAMERA_DISTANCE);
  }

  follow(target: THREE.Vector3): void {
    this.tmp.copy(target).add(this.offset);
    this.camera.position.copy(this.tmp);
    this.camera.lookAt(target);
  }

  setAspect(aspect: number): void {
    const halfW = CAMERA_VIEW_WIDTH / 2;
    const halfH = halfW / aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }
}
