import * as THREE from 'three';
import {
  DEFAULT_WORLD_SEED,
  OCEAN_PLACEHOLDER_COLOUR,
  PHASE1_GRID_EXTENT,
  PHASE1_ISLAND_ANCHOR,
  WAVE_DIR_SPREAD,
  WAVE_LAMBDA_MAX,
  WAVE_LAMBDA_MIN,
  WAVE_LAMBDA_PEAK,
  WIND_DIRECTION,
} from '@/config';
import { createRenderer } from '@/rendering/renderer';
import { IsoCamera } from '@/rendering/camera';
import { Helicopter } from '@/entities/helicopter';
import { HelicopterControls } from '@/entities/helicopterControls';
import { Hud } from '@/hud';
import { makeIsland, type Island } from '@/world/heightfield';
import { buildGrid, type Grid } from '@/world/grid';
import { WaveBlocksMesh } from '@/rendering/waveBlocksMesh';
import { makeSpectrum } from '@/rendering/waveSpectrum';
import { hashSeed } from '@/procgen/rng';

// Far-field placeholder ocean for the area outside the test grid until
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
  private readonly blocks: WaveBlocksMesh;
  private readonly grid: Grid;
  private readonly islands: readonly Island[];
  private elapsed = 0;
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
    this.farOcean.position.y = -0.05;
    this.scene.add(this.farOcean);

    this.islands = [
      makeIsland(PHASE1_ISLAND_ANCHOR[0], PHASE1_ISLAND_ANCHOR[1], DEFAULT_WORLD_SEED),
    ];
    const half = PHASE1_GRID_EXTENT / 2;
    const tStart = performance.now();
    this.grid = buildGrid(
      this.islands,
      { minX: -half, maxX: half, minZ: -half, maxZ: half },
      DEFAULT_WORLD_SEED,
    );
    const genMs = performance.now() - tStart;
    // eslint-disable-next-line no-console
    console.info(
      `[grid] cells=${this.grid.cellCount} ` +
      `quads=${this.grid.quads.length / 4} ` +
      `tris=${this.grid.triangles.length / 3} ` +
      `gen=${genMs.toFixed(1)}ms`,
    );

    const spectrum = makeSpectrum({
      seed: hashSeed(DEFAULT_WORLD_SEED, 'spectrum'),
      windDir: WIND_DIRECTION,
      dirSpread: WAVE_DIR_SPREAD,
      minWavelength: WAVE_LAMBDA_MIN,
      maxWavelength: WAVE_LAMBDA_MAX,
      peakWavelength: WAVE_LAMBDA_PEAK,
    });

    this.blocks = new WaveBlocksMesh(this.grid, spectrum, {
      lightDir: new THREE.Vector3(-0.5, -1.0, -0.3).normalize(),
      lightColor: new THREE.Color(0xffffff).multiplyScalar(1.1),
      ambient: new THREE.Color(0xb0d8ff).multiplyScalar(0.45),
    });
    this.scene.add(this.blocks.mesh);

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
    this.blocks.dispose();
    this.heli.dispose();
    this.farOcean.geometry.dispose();
    (this.farOcean.material as THREE.Material).dispose();
    this.renderer.dispose();
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.controls.update(this.heli, dt);
    this.camera.follow(this.heli.position);
    this.blocks.setTime(this.elapsed);
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
