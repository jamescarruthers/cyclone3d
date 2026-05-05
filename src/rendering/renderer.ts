import * as THREE from 'three';
import { SKY_COLOUR } from '@/config';

export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(SKY_COLOUR, 1);
  container.appendChild(renderer.domElement);
  return renderer;
}
