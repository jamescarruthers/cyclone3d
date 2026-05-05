import * as THREE from 'three';
import { OCEAN_PLACEHOLDER_COLOUR } from '@/config';
import { createRenderer } from '@/rendering/renderer';
import { IsoCamera } from '@/rendering/camera';
import { Helicopter } from '@/entities/helicopter';
import { HelicopterControls } from '@/entities/helicopterControls';
import { Hud } from '@/hud';

const PLANE_SIZE = 4096;

export class App {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: IsoCamera;
  private readonly heli = new Helicopter();
  private readonly controls = new HelicopterControls();
  private readonly hud: Hud;
  private readonly plane: THREE.Mesh;
  private lastT = 0;
  private rafId = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = createRenderer(container);
    this.camera = new IsoCamera(container.clientWidth / container.clientHeight);
    this.hud = new Hud('hud');

    const planeGeom = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const planeMat = new THREE.MeshStandardMaterial({
      color: OCEAN_PLACEHOLDER_COLOUR,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.plane = new THREE.Mesh(planeGeom, planeMat);
    this.plane.rotation.x = -Math.PI / 2;
    this.scene.add(this.plane);

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(60, 120, 40);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xb0d8ff, 0.45));

    this.scene.add(this.heli.mesh);
  }

  start(): void {
    this.controls.attach(window);
    window.addEventListener('resize', this.onResize);
    this.lastT = performance.now();
    const loop = (t: number): void => {
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.controls.detach(window);
    window.removeEventListener('resize', this.onResize);
  }

  private update(dt: number): void {
    this.controls.update(this.heli, dt);
    this.camera.follow(this.heli.position);
    this.hud.tick(dt);
    const headingDeg = ((this.heli.heading * 180) / Math.PI) % 360;
    this.hud.render(this.heli.position.y, (headingDeg + 360) % 360);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera.camera);
  }

  private readonly onResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.setAspect(w / h);
  };
}
