import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Simple object pools for hot-path math, per CLAUDE.md §5.
class Pool<T> {
  private readonly items: T[] = [];
  private cursor = 0;
  constructor(private readonly factory: () => T, prewarm: number) {
    for (let i = 0; i < prewarm; i++) this.items.push(factory());
  }
  acquire(): T {
    if (this.cursor < this.items.length) {
      const item = this.items[this.cursor++]!;
      return item;
    }
    const item = this.factory();
    this.items.push(item);
    this.cursor++;
    return item;
  }
  reset(): void {
    this.cursor = 0;
  }
}

export const vec3Pool = new Pool<THREE.Vector3>(() => new THREE.Vector3(), 16);
export const vec2Pool = new Pool<THREE.Vector2>(() => new THREE.Vector2(), 16);

export function resetMathPools(): void {
  vec3Pool.reset();
  vec2Pool.reset();
}
