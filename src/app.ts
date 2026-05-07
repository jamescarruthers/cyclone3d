import * as THREE from 'three';
import {
  DEFAULT_WORLD_SEED,
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
import { height } from '@/world/heightfield';
import { ChunkManager } from '@/world/chunkManager';
import { sampleWaveY } from '@/world/waveSample';
import { Spray } from '@/rendering/spray';
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
  private readonly chunks: ChunkManager;
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

    this.spectrum = makeSpectrum({
      seed: hashSeed(DEFAULT_WORLD_SEED, 'spectrum'),
      windDir: WIND_DIRECTION,
      dirSpread: WAVE_DIR_SPREAD,
      minWavelength: WAVE_LAMBDA_MIN,
      maxWavelength: WAVE_LAMBDA_MAX,
      peakWavelength: WAVE_LAMBDA_PEAK,
    });

    this.chunks = new ChunkManager(
      this.scene,
      DEFAULT_WORLD_SEED,
      this.spectrum,
      {
        lightDir: new THREE.Vector3(-0.5, -1.0, -0.3).normalize(),
        lightColor: new THREE.Vector3(1.1, 1.1, 1.1),
        ambient: new THREE.Vector3(0xb0 / 255, 0xd8 / 255, 1.0).multiplyScalar(0.45),
      },
      WIND_DIRECTION,
    );
    this.windAngle = Math.atan2(WIND_DIRECTION[1], WIND_DIRECTION[0]);

    const tStart = performance.now();
    this.chunks.update(this.heli.position.x, this.heli.position.z);
    // eslint-disable-next-line no-console
    console.info(
      `[chunks] initial=${this.chunks.loadedCount()} ` +
      `gen=${(performance.now() - tStart).toFixed(1)}ms`,
    );

    this.heliShadow = new HelicopterShadow();
    this.scene.add(this.heliShadow.mesh);

    this.spray = new Spray(hashSeed(DEFAULT_WORLD_SEED, 'spray'));
    this.scene.add(this.spray.points);

    // Scene lights for the helicopter and the per-chunk vegetation /
    // coral InstancedMeshes (the wave-blocks shader has its own custom
    // light uniforms and ignores the scene lights).
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(60, 120, 40);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xb0d8ff, 0.55));

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
    this.chunks.dispose();
    this.heliShadow.dispose();
    this.spray.dispose();
    this.heli.dispose();
    this.renderer.dispose();
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.controls.update(this.heli, dt);
    this.camera.follow(this.heli.position);

    const heliX = this.heli.position.x;
    const heliZ = this.heli.position.z;
    const heliY = this.heli.position.y;

    this.chunks.update(heliX, heliZ);
    this.chunks.setTime(this.elapsed);

    const islands = this.chunks.islandsNear(heliX, heliZ);
    const terrainDepth = height(islands, heliX, heliZ);
    const overWater = terrainDepth <= 0;
    const surfaceY = overWater
      ? SEA_LEVEL + sampleWaveY(this.spectrum, heliX, heliZ, terrainDepth, this.elapsed)
      : terrainDepth;

    const altitude = heliY - surfaceY;
    this.heliShadow.setPosition(heliX, heliZ, surfaceY, altitude);

    const washIntensity = Math.max(0, 1 - altitude / ROTOR_MAX_ALTITUDE);
    this.chunks.setRotorWash(heliX, heliZ, washIntensity);

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
    this.chunks.rotateWind(delta);
    // eslint-disable-next-line no-console
    console.info(
      `[wind] angle=${((this.windAngle * 180) / Math.PI).toFixed(0)}° ` +
      `rebuild=${(performance.now() - t).toFixed(1)}ms`,
    );
  };
}
