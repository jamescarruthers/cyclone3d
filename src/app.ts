import * as THREE from 'three';
import {
  DEFAULT_WORLD_SEED,
  OCEAN_PLACEHOLDER_COLOUR,
  PHASE1_GRID_EXTENT,
  PHASE1_GRID_RESOLUTION,
  PHASE1_ISLAND_ANCHOR,
} from '@/config';
import { createRenderer } from '@/rendering/renderer';
import { IsoCamera } from '@/rendering/camera';
import { Helicopter } from '@/entities/helicopter';
import { HelicopterControls } from '@/entities/helicopterControls';
import { Hud } from '@/hud';
import { LandMesh } from '@/rendering/landMesh';
import { makeIsland, type Island } from '@/world/heightfield';

// Far-field placeholder ocean. The island mesh covers PHASE1_GRID_EXTENT
// around the origin; this plane fills the rest of the visible area until
// chunked streaming arrives in Phase 8.
const FAR_OCEAN_SIZE = 8192;

export class App {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: IsoCamera;
  private readonly heli = new Helicopter();
  private readonly controls = new HelicopterControls();
  private readonly hud: Hud;
  private readonly farOcean: THREE.Mesh;
  private readonly land: LandMesh;
  private readonly islands: readonly Island[];
  private lastT = 0;
  private rafId = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = createRenderer(container);
    this.camera = new IsoCamera(container.clientWidth / container.clientHeight);
    this.hud = new Hud('hud');

    const farGeom = new THREE.PlaneGeometry(FAR_OCEAN_SIZE, FAR_OCEAN_SIZE);
    const farMat = new THREE.MeshStandardMaterial({
      color: OCEAN_PLACEHOLDER_COLOUR,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.farOcean = new THREE.Mesh(farGeom, farMat);
    this.farOcean.rotation.x = -Math.PI / 2;
    this.farOcean.position.y = -0.05; // sit just under the island mesh to avoid z-fight
    this.scene.add(this.farOcean);

    this.islands = [
      makeIsland(PHASE1_ISLAND_ANCHOR[0], PHASE1_ISLAND_ANCHOR[1], DEFAULT_WORLD_SEED),
    ];
    this.land = new LandMesh(this.islands, {
      extent: PHASE1_GRID_EXTENT,
      resolution: PHASE1_GRID_RESOLUTION,
    });
    this.scene.add(this.land.mesh);

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
    this.land.dispose();
    this.heli.dispose();
    this.farOcean.geometry.dispose();
    (this.farOcean.material as THREE.Material).dispose();
    this.renderer.dispose();
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
