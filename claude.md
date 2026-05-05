# CLAUDE.md — project conventions

This file is project-wide guidance for working in this codebase. It complements `SPEC.md`:

- **`SPEC.md`** — *what* to build (concept, phases, system specs, constants).
- **`CLAUDE.md`** (this file) — *how* to work in this repo (conventions, perf budgets, gotchas, testing).

Read both before making changes. If they contradict, raise it explicitly rather than guessing.

---

## Dev workflow

```sh
npm install
npm run dev          # Vite dev server, hot reload
npm run build        # production build
npm run typecheck    # tsc --noEmit, strict
npm run test         # vitest, headless
```

Always run `npm run typecheck` before considering a change complete. The build does not implicitly run typecheck.

---

## Critical conventions

These are non-negotiable. Violating them creates bugs that are hard to diagnose.

### 1. Determinism

The world must be reproducible from a seed. The same `(worldSeed, chunkX, chunkZ)` must always produce identical terrain, identical wave parameters, identical scatter.

- **Never** call `Math.random()`. There is one place this is allowed: visual-only effects with no gameplay impact (e.g., particle jitter), and even there, prefer a seeded source.
- All randomness goes through the `Rng` class in `procgen/rng.ts` (mulberry32 or similar).
- Per-chunk RNG is seeded from `hash(worldSeed, chunkX, chunkZ)`. Don't share an RNG between chunks.
- Per-island sub-seeds are derived from chunk RNG, not from a global stream.
- Tests should assert determinism: same input seed → identical output structure.

### 2. Config is the single source of truth

All tunable numbers live in `src/config.ts`. Inline magic numbers in implementation files are a code-review reject.

- Adding a new tunable? Add it to `config.ts` first, then reference.
- Renaming a constant? Search the codebase, don't leave stale references.
- Per-island archetype variants live in `config.ts` as record literals, not scattered.

### 3. Phase isolation

Each phase in `SPEC.md` has a Definition of Done. Don't merge work across phases.

- Working on Phase 4? Don't start adding shadow fields. Phase 6 has a defined start point.
- If a Phase N change is needed to make Phase M work, document why in the PR/commit and update `SPEC.md`.
- Tempting cross-phase refactors should be resisted until the current phase is DoD-complete.

### 4. Three.js resource lifecycle

GPU resources don't garbage-collect. Disposal is manual.

- When a chunk unloads: dispose its `BufferGeometry`, `Material`, and any `Texture` it owns.
- Materials are typically shared per-chunk-class; geometries are per-chunk. Track ownership explicitly.
- A chunk's `dispose()` method is the single place this happens. If you allocate a GPU resource elsewhere, you've created a leak.
- Render loop: NEVER create new `BufferGeometry`/`Material`/`Texture` per frame. Pre-allocate and update uniforms.

### 5. No allocation in hot paths

The per-frame loop and wave-update path must not allocate.

- Pool `THREE.Vector3` / `THREE.Vector2` for temporary math. There's a small pool in `utils/math.ts`.
- Don't `.map()`/`.filter()` arrays in the render loop. Use indexed `for` loops with reused output arrays.
- No closures created per frame. Define handlers once.
- `Object.assign` and spread (`{...x}`) allocate. Avoid in hot paths.

---

## Code style

### TypeScript

- `strict: true`. No `any` ever. If you reach for `any`, the type model is wrong — fix it.
- `readonly` on everything that doesn't need to mutate.
- `as const` for literal config.
- Discriminated unions for biome tags, cell types, message types. Never strings-as-enums.

```ts
// Good
type CellTag = 
  | { kind: 'land'; height: number }
  | { kind: 'shelfCoral'; depth: number; coralDensity: number }
  | { kind: 'deep' };

// Bad
type CellTag = 'land' | 'shelf-coral' | 'deep';   // loses associated data
```

- Prefer small focused files. Anything over ~300 lines should probably split.
- Pure functions where possible. Mutation is fine but explicit (`updateChunk(chunk, ...)` not `chunk.update(...)` if it's not really an instance method).
- Procgen functions take RNG explicitly as a parameter. No hidden state.

### Naming

- Files: camelCase (`waveBlocksMesh.ts`).
- Types: PascalCase (`Chunk`, `BiomeTag`).
- Constants in `config.ts`: SCREAMING_SNAKE_CASE.
- Local variables: camelCase, descriptive (`cellSize` not `cs`).
- Shader uniforms: `uPrefixed` (`uTime`, `uWindDir`, `uRotorWash`).
- Vertex attributes: `aPrefixed` (`aCellCentre`).

### Imports

- Three.js: `import * as THREE from 'three'`.
- Internal imports use path aliases (configured in `vite.config.ts` and `tsconfig.json`):
  - `@/world/...`, `@/rendering/...`, `@/procgen/...`, etc.

---

## Performance budget

| Item | Target |
|---|---|
| Frame time | < 16.6 ms (60 FPS) on mid-range laptop GPU at 1080p |
| Chunk generation | < 50 ms per chunk on main thread (Phase 1–7); off main thread from Phase 8 |
| Wave shader | Vertex shader only. No texture lookups beyond shadow field. No loops over more than NUM_GERSTNER_WAVES (8). |
| Loaded chunks | Bounded — `(CHUNKS_AHEAD * 2 + 1)^2` typical, never grow unbounded |
| Heap | Stable across 10 minutes of flight. Profile and confirm. |

Profile with Chrome DevTools Performance tab. If a frame goes over budget, the agent should investigate before adding features. Don't optimise speculatively — measure first.

---

## Procgen patterns

### Adding a new biome tag

1. Extend the `CellTag` discriminated union in `world/biome.ts`.
2. Add the classification rule in `classifyCell()`.
3. Add render handling in the appropriate mesh builder (block colour, scatter behaviour).
4. Add a config entry for any tunables (densities, colours).
5. Verify visual result in Phase 5+.

### Adding a new wave component

Wave parameters live in a uniform array sized `NUM_GERSTNER_WAVES`. Don't add a 9th wave without updating the constant and the shader loop. Prefer redistributing the existing 8 across a different spectrum.

### Adding a per-chunk field

Per-chunk data (heightfield cache, shadow texture, etc.) is stored on the `Chunk` instance. To add a new one:

1. Add the field to `Chunk` with proper disposal in `Chunk.dispose()`.
2. Compute it in `ChunkManager.generate()`, after dependencies (e.g., shadow field needs the heightfield).
3. If it depends on neighbours' state (like Poisson boundary points), document the dependency and ensure neighbours are loaded first.

### Tuning parameters

When the agent is asked to "make waves bigger" or "more islands":

- Edit `config.ts`. Don't touch implementation files.
- If the parameter doesn't exist yet, add it and reference it.
- Don't re-tune as a side effect of unrelated work.

---

## Three.js gotchas (specific to this project)

### Vertex shader cell-centre lookups

Each block-mesh vertex carries `aCellCentre` (its cell's centre XZ) and, for side faces, `aNeighbourCentre`. The wave function is evaluated at these positions. Do not try to compute it per-vertex from world position — that breaks the flat-top property.

### Shadow texture sampling

Sampled in the wave vertex shader. Use `texture2DLod(uShadowMap, uv, 0.0)` (no mipmaps, no derivatives in vertex shader). Filtering is linear; that's the diffraction softness.

### Caustic projection

Caustics are projected from above using world XZ as UV (tiled). They should appear ONLY in the shallow band — gate by depth in the fragment shader.

### Avoiding shader recompilation

Adding/removing wave components by toggling a `#define` recompiles the shader (slow). Don't toggle features at runtime — set the flags once at startup. Per-frame changes go through uniforms only.

### Instancing for vegetation

Use `THREE.InstancedMesh` for palm trees, rocks, coral. Per-chunk instance buffers. Do NOT add individual meshes per scatter point — that destroys frame rate at any density.

### WebGL2 only

This project assumes WebGL2 (Three.js default). Don't add code paths for WebGL1.

### Camera frustum

Orthographic, fixed angle. Frustum culling per-chunk by AABB is sufficient. Don't bother with per-cell culling.

---

## Testing approach

A game like this resists traditional unit testing. The strategy is layered:

### Pure functions (unit tested with Vitest)

- `procgen/rng.ts` — deterministic output for a given seed
- `procgen/poisson.ts` — point count in expected range, minimum-distance respected
- `procgen/quadPair.ts` — output is valid quads, all triangles either paired or in the unpaired-leftovers set
- `procgen/noise.ts` — known-value tests at known coords
- `world/heightfield.ts` — sample at known positions returns expected band

### Determinism tests

- For each phase that produces structured output (grid, biome tags, scatter positions), assert: `generate(seed=X, chunk=(0,0))` produces deterministic bytes/structure across runs.

### Visual regression

- Manual. Take a screenshot at heli position `(0, 50, 0)` looking at a fixed seed. Compare against the previous version.
- Discord/notion the screenshot per phase.
- We don't currently use automated visual regression (could be added; not in scope).

### Performance regression

- The HUD (Phase 0+) shows FPS, ms/frame, chunk count, draw calls.
- Before/after any non-trivial change, fly the same loop and note the numbers.

---

## Definition of done for any change

Before considering work complete, the agent must verify:

1. ✅ `npm run typecheck` passes.
2. ✅ `npm run test` passes.
3. ✅ The dev server runs without console errors or warnings.
4. ✅ FPS at the test camera position is within 5% of the pre-change baseline (for non-feature changes), or budgeted (for feature additions).
5. ✅ No new `Math.random()` calls.
6. ✅ Any new GPU resource has a corresponding `dispose()`.
7. ✅ Any new tunable lives in `config.ts`.
8. ✅ The relevant Phase's DoD in `SPEC.md` is still satisfied (or, if completing a phase, now is).
9. ✅ Visual check at the same seed/position as before — nothing regressed unintentionally.

---

## Pitfalls — explicitly do NOT do these

- ❌ Use `Math.random()`.
- ❌ Add a new dependency without checking it's actually needed (Three.js + simplex-noise + d3-delaunay should cover almost everything).
- ❌ Refactor across phase boundaries while a phase is mid-flight.
- ❌ Edit shaders to add features at runtime via `#define` toggles.
- ❌ Allocate Three.js objects in the render loop.
- ❌ Skip `dispose()` because "the GC will handle it" — it won't, GPU resources are manual.
- ❌ Inline tunable numbers in implementation files.
- ❌ Use `any` to make a type error go away.
- ❌ Add visual polish before the phase's structural DoD is met.
- ❌ Optimise without profiling first.

---

## When to ask vs proceed

The agent should proceed without asking when:
- The task fits within the current phase's scope as defined in `SPEC.md`.
- Implementation choice is between two options that are both in the spec's "open decisions" with a recommended default.
- Style/structure decisions follow this file's conventions.

The agent should ask when:
- A change requires touching a phase the user hasn't started.
- A change requires a new dependency.
- The task contradicts something in `SPEC.md` or `CLAUDE.md`.
- A perf budget would be exceeded by the proposed approach.
- The user's request is ambiguous about which of the "open decisions" they want.

---

## Decisions log (extend as project evolves)

This is the place to record decisions and their rationale, so future work doesn't relitigate.

- **Three.js WebGL renderer over WebGPU** — chosen for r170 stability. Revisit at Phase 8+ if wave compute becomes a bottleneck.
- **Vertex-shader analytic Gerstner over compute-shader height texture** — simpler, fits the per-cell architecture cleanly.
- **Single Stålberg grid for terrain and waves** — unified system; revisit only if conflicts arise.
- **Greedy quad pairing** — optimal pairing not worth the complexity; small fraction of leftover triangles is acceptable.
- **Shore-calm wave amplitude** — stylistic choice over physically-realistic shoaling; gameplay-friendlier and matches tropical-peace mood.

(Add new entries with date and brief rationale.)
