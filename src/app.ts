import * as THREE from 'three';
import {
  DEFAULT_WORLD_SEED,
  PHASE1_GRID_EXTENT,
  PHASE1_ISLAND_ANCHOR,
  ROTOR_MAX_ALTITUDE,
  SEA_LEVEL,
  SPRAY_ALTITUDE_THRESHOLD,
  WAVE_DIR_SPREAD,
  WAVE_LAMBDA_MAX,
  WAVE_LAMBDA_MIN,
  WAVE_LAMBDA_PEAK,
  WIND_DIRECTION,
  WIND_ROTATE_STEP,
} from '@/config';
import { createRenderer } from '@/rendering/renderer';
import { IsoCamera } from '@/rendering/camera';
import { Helicopter } from '@/entities/helicopter';
import { HelicopterControls } from '@/entities/helicopterControls';
import { HelicopterShadow } from '@/entities/helicopterShadow';
import { Hud } from '@/hud';
import { height, makeIsland, type Island } from '@/world/heightfield';
import { buildGrid, type Grid } from '@/world/grid';
import { ShadowField } from '@/world/shadowField';
import { sampleWaveY } from '@/world/waveSample';
import { Spray } from '@/rendering/spray';
import { WaveBlocksMesh } from '@/rendering/waveBlocksMesh';
import { makeSpectrum, type WaveSpectrum } from '@/rendering/waveSpectrum';
import { hashSeed } from '@/procgen/rng';

export class App {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: IsoCamera;
  private readonly heli = new Helicopter();
  private readonly controls = new HelicopterControls();
  private readonly hud: Hud;
  private readonly blocks: WaveBlocksMesh;
  private readonly grid: Grid;
  private readonly islands: readonly Island[];
  private readonly shadow: ShadowField;
  private readonly heliShadow: HelicopterShadow;
  private readonly spray: Spray;
  private readonly spectrum: WaveSpectrum;
  private windAngle: number;
  private elapsed = 0;
  private lastT = 0;
  private rafId = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = createRenderer(container);
    this.camera = new IsoCamera(container.clientWidth / container.clientHeight);
    this.hud = new Hud('hud');

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

    this.spectrum = makeSpectrum({
      seed: hashSeed(DEFAULT_WORLD_SEED, 'spectrum'),
      windDir: WIND_DIRECTION,
      dirSpread: WAVE_DIR_SPREAD,
      minWavelength: WAVE_LAMBDA_MIN,
      maxWavelength: WAVE_LAMBDA_MAX,
      peakWavelength: WAVE_LAMBDA_PEAK,
    });

    this.blocks = new WaveBlocksMesh(this.grid, this.spectrum, {
      lightDir: new THREE.Vector3(-0.5, -1.0, -0.3).normalize(),
      lightColor: new THREE.Vector3(1.1, 1.1, 1.1),
      ambient: new THREE.Vector3(0xb0 / 255, 0xd8 / 255, 1.0).multiplyScalar(0.45),
    });
    this.scene.add(this.blocks.mesh);

    const tShadowStart = performance.now();
    this.shadow = new ShadowField(
      this.islands,
      { minX: -half, maxX: half, minZ: -half, maxZ: half },
      WIND_DIRECTION,
    );
    this.windAngle = Math.atan2(WIND_DIRECTION[1], WIND_DIRECTION[0]);
    this.blocks.setShadowField(this.shadow.texture, this.shadow.boundsUniform);
    // eslint-disable-next-line no-console
    console.info(`[shadow] init=${(performance.now() - tShadowStart).toFixed(1)}ms`);

    this.heliShadow = new HelicopterShadow();
    this.scene.add(this.heliShadow.mesh);

    this.spray = new Spray(hashSeed(DEFAULT_WORLD_SEED, 'spray'));
    this.scene.add(this.spray.points);

    this.scene.add(this.heli.mesh);
  }

  start(): void {
    this.controls.attach(window);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
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
    window.removeEventListener('keydown', this.onKeyDown);
    this.blocks.dispose();
    this.shadow.dispose();
    this.heliShadow.dispose();
    this.spray.dispose();
    this.heli.dispose();
    this.renderer.dispose();
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.controls.update(this.heli, dt);
    this.camera.follow(this.heli.position);
    this.blocks.setTime(this.elapsed);

    // Phase 7 VFX:
    // - Surface Y under the heli (terrain or wave) for shadow placement.
    // - Rotor wash uniform drives wave-shader damping + radial ripple.
    // - Spray spawns when low + over water.
    const heliX = this.heli.position.x;
    const heliZ = this.heli.position.z;
    const heliY = this.heli.position.y;
    const terrainDepth = height(this.islands, heliX, heliZ);
    const overWater = terrainDepth <= 0;
    const surfaceY = overWater
      ? SEA_LEVEL + sampleWaveY(this.spectrum, heliX, heliZ, terrainDepth, this.elapsed)
      : terrainDepth;

    const altitude = heliY - surfaceY;
    this.heliShadow.setPosition(heliX, heliZ, surfaceY, altitude);

    const washIntensity = Math.max(0, 1 - altitude / ROTOR_MAX_ALTITUDE);
    this.blocks.setRotorWash(heliX, heliZ, washIntensity);

    const sprayActive = altitude < SPRAY_ALTITUDE_THRESHOLD && overWater;
    this.spray.update(dt, heliX, heliZ, sprayActive);

    this.hud.tick(dt);
    const headingDeg = ((this.heli.heading * 180) / Math.PI) % 360;
    this.hud.render(heliY, (headingDeg + 360) % 360);
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

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'KeyR') return;
    const delta = e.shiftKey ? -WIND_ROTATE_STEP : WIND_ROTATE_STEP;
    this.windAngle += delta;
    const t = performance.now();
    this.shadow.setWindAngle(this.windAngle);
    this.blocks.rotateWaveDirs(delta);
    // eslint-disable-next-line no-console
    console.info(
      `[wind] angle=${((this.windAngle * 180) / Math.PI).toFixed(0)}° ` +
      `rebuild=${(performance.now() - t).toFixed(1)}ms`,
    );
  };
}
