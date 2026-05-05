import {
  HELI_BANK_MAX,
  HELI_CRUISE_SPEED,
  HELI_MAX_ALTITUDE,
  HELI_MIN_ALTITUDE,
  HELI_VERTICAL_SPEED,
  HELI_YAW_RATE,
} from '@/config';
import { clamp, lerp } from '@/utils/math';
import type { Helicopter } from '@/entities/helicopter';

type Key =
  | 'KeyW'
  | 'KeyS'
  | 'KeyA'
  | 'KeyD'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Space'
  | 'ShiftLeft';

const TRACKED: ReadonlySet<string> = new Set<Key>([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
]);

export class HelicopterControls {
  private readonly down = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (TRACKED.has(e.code)) {
      this.down.add(e.code);
      e.preventDefault();
    }
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  attach(target: Window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  detach(target: Window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    this.down.clear();
  }

  update(heli: Helicopter, dt: number): void {
    const forward = (this.down.has('KeyW') || this.down.has('ArrowUp')) ? 1 : 0;
    const back = (this.down.has('KeyS') || this.down.has('ArrowDown')) ? 1 : 0;
    const left = (this.down.has('KeyA') || this.down.has('ArrowLeft')) ? 1 : 0;
    const right = (this.down.has('KeyD') || this.down.has('ArrowRight')) ? 1 : 0;
    const climb = this.down.has('Space') ? 1 : 0;
    const descend = this.down.has('ShiftLeft') ? 1 : 0;

    const yawInput = right - left;
    heli.heading -= yawInput * HELI_YAW_RATE * dt;

    const targetBank = -yawInput * HELI_BANK_MAX;
    heli.bank = lerp(heli.bank, targetBank, clamp(dt * 6, 0, 1));

    const throttle = forward - back;
    const speed = throttle * HELI_CRUISE_SPEED;
    heli.velocity.x = Math.sin(heli.heading) * speed;
    heli.velocity.z = Math.cos(heli.heading) * speed;
    heli.velocity.y = (climb - descend) * HELI_VERTICAL_SPEED;

    heli.position.x += heli.velocity.x * dt;
    heli.position.y += heli.velocity.y * dt;
    heli.position.z += heli.velocity.z * dt;

    heli.position.y = clamp(heli.position.y, HELI_MIN_ALTITUDE, HELI_MAX_ALTITUDE);

    heli.applyTransform();
  }
}
