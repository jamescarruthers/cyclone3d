# Tropical Archipelago Helicopter Game — Implementation Spec

## Concept

Isometric fixed-viewport helicopter game over a procedurally generated tropical archipelago. The player flies a helicopter over open ocean dotted with islands. Each island extends underwater into shallow shelves hosting coral, sandbars and reefs.

Aesthetic: stylised low-poly with **blocky animated waves** whose grid resolution scales with water depth — large slow swell in deep water, fine ripples near shore. Three discrete water depth bands (shallow / mid / deep) with distinct shading.

Target: web app, Three.js.

---

## Tech stack

- **Vite** + TypeScript (strict)
- **Three.js** r170+, WebGL renderer (WebGPU compute is a later optional path for waves)
- **No** game framework — direct Three.js for performance and control
- **simplex-noise** or equivalent for noise; otherwise no major deps
- Web workers for chunk generation (Phase 8+)

---

## World scale & units

All in metres. +Y up. Sea level at y = 0.

| Quantity | Value |
|---|---|
| Helicopter cruise speed | 30 m/s |
| Max altitude | 100 m |
| Typical altitude | 30 m |
| View extent (approx) | 400 m × 400 m on screen |
| Chunk size | 256 m × 256 m |
| Wave grid cell — deep ocean | 6 m |
| Wave grid cell — shore | 1.5 m |
| Wave height step (quantisation) | cell_size × 0.1 |
| Max island peak | 80 m |
| Beach band | 0 to +1 m |
| Shelf band (underwater extension) | 0 to −6 m |
| Drop-off | −6 to −30 m |
| Abyssal floor | −60 m |
| Average island spacing | ~600 m |

---

## Camera

Orthographic. 30° pitch, 45° yaw. Fixed angle, follows the helicopter horizontally only — Y position tracks heli but XZ rotation is locked. Camera does **not** rotate with helicopter heading; world flies past below.

Frustum sized so visible area is roughly 400 m wide.

---

## File structure

```
src/
  main.ts
  app.ts                  // game loop + scene
  config.ts               // ALL tunable constants live here

  world/
    chunk.ts              // Chunk class
    chunkManager.ts       // streaming around heli
    heightfield.ts        // island generation profile
    grid.ts               // Stålberg variable-density quad mesh
    biome.ts              // cell tagging (deep/shallow/beach/land/peak/coral/sand)
    shadowField.ts        // wave shadow per chunk

  rendering/
    renderer.ts
    camera.ts             // isometric ortho follow
    waveBlocksMesh.ts     // the per-chunk blocky wave geometry
    landMesh.ts
    waterShader.ts        // 3-band depth shader for non-block water
    helicopterShadow.ts
    rotorWash.ts          // wash field uniform

  entities/
    helicopter.ts
    helicopterControls.ts

  procgen/
    poisson.ts            // Bridson Poisson-disc, density-modulated
    delaunay.ts           // existing lib (e.g. d3-delaunay) is fine
    quadPair.ts           // Stålberg triangle→quad pairing
    noise.ts              // FBM, ridge, domain warp helpers
    rng.ts                // seedable PRNG (mulberry32 or similar)

  shaders/
    waveBlock.vert
    waveBlock.frag
    water.vert
    water.frag

  utils/
    math.ts
    fields.ts             // distance-to-coast, gradient sampling
```

---

## config.ts (tunables)

All magic numbers go here. Examples:

```ts
export const SEA_LEVEL = 0;
export const CHUNK_SIZE = 256;
export const CHUNKS_AHEAD = 3;
export const CHUNKS_BEHIND = 1;

export const WAVE_CELL_DEEP = 6;
export const WAVE_CELL_SHORE = 1.5;
export const WAVE_AMPLITUDE_DEEP = 2.0;
export const WAVE_AMPLITUDE_SHORE = 0.25;
export const WAVE_STEP_RATIO = 0.1;
export const NUM_GERSTNER_WAVES = 8;
export const WIND_DIRECTION = [1, 0]; // unit vector in XZ

export const SHELF_DEPTH = -6;
export const DROPOFF_DEPTH = -30;
export const ABYSSAL_DEPTH = -60;

export const SHALLOW_BAND = 5;   // 0..5 m
export const MID_BAND = 25;      // 5..25 m
// deep is anything beyond MID_BAND

export const ISLAND_SPACING_MIN = 200;
export const ISLAND_SPACING_AVG = 600;
```

---

## Build phases

Each phase has a Definition of Done before moving on. Don't combine phases.

### Phase 0 — Bootstrap

Vite + TS + Three.js. Orthographic isometric camera. Cube as placeholder helicopter. WASD/arrow controls move it across a flat textured plane.

**DoD**: cube flies over a flat blue plane, camera follows, FPS stable.

### Phase 1 — Single island heightfield

One hand-placed island. Heightfield function on a regular grid (not Stålberg yet) using radial falloff × ridged-multifractal noise, with the full profile: peak → flank → beach → shelf → drop-off → abyss. Render as a single mesh with vertex colours by depth band.

**DoD**: fly over an island that has visible underwater shelf extending out from the coast, with clear depth-banded colour transitions.

### Phase 2 — Stålberg grid generation

Implement Bridson Poisson-disc with **variable density** by depth, Delaunay triangulate, pair triangles into quads, Laplacian smooth. Visualise cells coloured by tag (deep / shallow / beach / land / peak).

**DoD**: variable-resolution irregular quad mesh covers the test area. Cells in deep water are large, cells near shore are small. Tag-based colouring matches the heightfield from Phase 1.

### Phase 3 — Block extrusion

Each cell renders as a flat-topped prism with visible vertical side faces between cells of different heights. Heights initially driven by the heightfield (static).

**DoD**: terrain reads as discrete blocks. Sides of land blocks are visible at the shore. No z-fighting.

### Phase 4 — Animated blocky waves

Gerstner sum (8 components, JONSWAP-weighted spectrum) + Nyquist gating per cell + depth-modulated amplitude (shore-calm) + per-cell quantisation. Wave heights driven from a vertex shader.

**DoD**: water blocks animate visibly. Deep ocean has large, slow swell. Shore has small, fast ripples. Wave height step sizes scale with cell size.

### Phase 5 — Three water bands

Discrete shallow / mid / deep colour bands, driven by computed depth at each cell. Caustic texture projected on shallow band only. Foam where waves intersect land cells.

**DoD**: water reads as three distinct depth zones. Shallow is bright turquoise. Mid is teal. Deep is dark blue. Visible caustics in shallows.

### Phase 6 — Wave–island interaction

Wave shadow field per chunk: rasterise islands viewed from upwind direction into a shadow map; sample at each wave cell to attenuate amplitude in the lee. Apply lateral Gaussian blur on the shadow that grows with downwind distance (diffraction approximation). Add reflected wave term near cliff cells.

**DoD**: lee sides of islands visibly calmer than windward. Shadow has soft fanning edges. Cliffs show standing-wave chop at their bases. Wind direction can be changed at runtime and shadows update.

### Phase 7 — Helicopter VFX

Heli shadow projected at heli XY, sampled against current cell heights (so shadow flickers on waves and sits on terrain). Rotor wash uniform fed to wave shader; cells within radius have damped amplitude + radial ripple added; same uniform drives a vegetation bend shader. Spray particles below 5 m altitude over water.

**DoD**: shadow visibly tracks heli over both terrain and waves. Hovering low over water flattens wave blocks and emits radial rings + spray.

### Phase 8 — Chunked streaming

Move from a single fixed test area to a chunked world. Deterministic per-chunk RNG seeded from `(worldSeed, chunkX, chunkZ)`. Generate chunks ahead of heli velocity, dispose chunks beyond a behind-distance. Boundary Poisson points shared between adjacent chunks so quad pairing crosses seams cleanly.

**DoD**: heli flies indefinitely in any direction, terrain streams in seamlessly, no visible chunk seams in the wave grid, revisiting an area produces identical terrain.

### Phase 9 — Polish

Vegetation scatter (Poisson within land cells, density by tag). Coral/sand/sandbar scatter on shelf cells. Per-island archetype variation (volcanic / atoll / cay). A handful of hand-placed landmark islands.

**DoD**: islands feel varied, navigation by landmarks possible, scene reads as a tropical archipelago not a noise field.

---

## System details

### Stålberg variable-resolution grid

Per chunk:

1. **Density field**: at each point, density depends on water depth from the heightfield function:
   ```
   spacing(x,z) = lerp(WAVE_CELL_SHORE, WAVE_CELL_DEEP, smoothstep(0, DROPOFF_DEPTH, -depth(x,z)))
   ```
2. **Bridson Poisson** with variable spacing. Seed from chunk coords for determinism. Include shared boundary points from neighbouring chunks (already-generated only) as fixed seeds.
3. **Delaunay triangulate** the points (use `d3-delaunay` or similar).
4. **Pair triangles into quads**: greedy is fine. For each unpaired triangle, look at adjacent triangles, pick the pairing that produces the best-shaped quad (closest to convex with corner angles near 90°). Skip stubborn triangles — leave a small fraction of triangles in the mesh. Acceptable.
5. **Laplacian smoothing**, 3–5 iterations, with cell-shape constraints to avoid degenerate quads. Boundary points pinned.
6. Build adjacency graph. Each cell knows its neighbours and its edges in a cell-local frame.

### Heightfield

Single function `height(x, z)` evaluated at any point, fully deterministic from world seed:

```
For each island in influence range:
  d = distance from (x,z) to island anchor
  warp = domainWarp(x, z, island.seed)        // 2-octave noise warp
  d_warped = d + warp
  
  // Profile: piecewise function of d_warped
  if d_warped < r_peak:        h_island = peakNoise(...)         // up to +80
  elif d_warped < r_beach:     h_island = lerp(peak_h, 0, ...)
  elif d_warped < r_shelf:     h_island = lerp(0, SHELF_DEPTH, ...) + sandbarNoise
  elif d_warped < r_dropoff:   h_island = lerp(SHELF_DEPTH, DROPOFF_DEPTH, smoothstep)
  else:                        h_island = ABYSSAL_DEPTH
  
Combine across overlapping islands with max() (so close islands share shoals).
```

Tag classification from height + slope + island masks gives biome:

| Tag | Condition |
|---|---|
| peak | h > 50 |
| land | h > 0 |
| beach | -1 < h ≤ 0 |
| shelf-coral | SHELF_DEPTH < h ≤ -1 AND high-slope OR within outer-shelf band |
| shelf-sand | SHELF_DEPTH < h ≤ -1 AND low-slope |
| dropoff | DROPOFF_DEPTH < h ≤ SHELF_DEPTH |
| deep | h ≤ DROPOFF_DEPTH |

### Block geometry

Per cell in a chunk, build a prism mesh:

- **Top quad**: 4 vertices at cell corners, all at the same Y (computed in vertex shader from cell-centre wave function).
- **Side quads**: between this cell and each neighbour. Top edge at this cell's Y; bottom edge at neighbour's Y (or further down to a base for boundary cells). Computed in vertex shader using neighbour cell-centre samples.

Pre-bake into BufferGeometry: per vertex, store cell-centre XZ, neighbour cell-centre XZ (for side faces), and a vertex role flag. Vertex shader looks up wave height for this cell and the neighbour cell using the same function and outputs the right Y.

For land cells, height is constant (not animated) but uses the same machinery; just skip wave function for tagged-as-land cells.

### Wave function

Per cell, in the vertex shader:

```glsl
float waveHeight(vec2 cellPos, float cellSize, float depth, float time) {
    float amp = mix(WAVE_AMPLITUDE_SHORE, WAVE_AMPLITUDE_DEEP,
                    smoothstep(0.0, abs(DROPOFF_DEPTH), -depth));
    
    float h = 0.0;
    for (int i = 0; i < NUM_WAVES; ++i) {
        // Skip waves below Nyquist for this cell
        if (uWavelength[i] < 2.0 * cellSize) continue;
        
        // Refract direction toward shore in shallows
        vec2 dir = mix(uWaveDir[i], toShore(cellPos),
                       refractionFactor(depth));
        
        float k = 2.0 * PI / uWavelength[i];
        float omega = sqrt(9.81 * k);  // deep-water dispersion
        h += uAmplitude[i] * sin(dot(dir, cellPos) * k - omega * time + uPhase[i]);
    }
    
    h *= amp;
    
    // Apply shadow from islands
    h *= sampleShadowField(cellPos);
    
    // Quantise
    float step = cellSize * WAVE_STEP_RATIO;
    return round(h / step) * step;
}
```

Wave parameters (`uWavelength[i]`, `uAmplitude[i]`, `uWaveDir[i]`, `uPhase[i]`) are uniforms set at chunk load. Distribute amplitudes by a JONSWAP-style spectrum: more energy in mid-wavelengths.

### Shadow field

Per chunk, 64×64 R8 texture (or whatever resolution looks acceptable), CPU-computed once per chunk and updated when wind direction changes:

```
for each texel at world pos p:
    Cast ray from p in -wind direction.
    Walk in steps until either:
      (a) leaving the chunk (and its loaded neighbours): shadow = 1.0
      (b) hitting a land cell at distance d: shadow = 1 - exp(-d / RECOVERY_LEN)
```

Then Gaussian-blur the result perpendicular to wind, with blur kernel size proportional to downwind distance from the nearest blocking edge (for diffraction).

Sampled in the wave vertex shader as `sampleShadowField(cellPos)`.

### Three water bands

Either render water as Stålberg blocks (preferred — already the wave grid) or as a separate flat plane shader for areas where you want smooth water. Either way the colour resolution comes from depth bands:

```glsl
vec3 waterColor(float depth) {
    if (depth < SHALLOW_BAND) return SHALLOW_TINT;
    if (depth < MID_BAND)     return MID_TINT;
    return DEEP_TINT;
}
```

For softer transitions, use `smoothstep` between bands. For full stylisation, hard cuts.

Caustics: project a tiled caustic texture from above (UV from world XZ), modulate by `(1 - depth/SHALLOW_BAND)` so it only appears in the shallow band.

### Helicopter shadow

Quad billboard at heli XZ, Y sampled from `terrainOrWaveHeight(heliXZ) + 0.05`. Soft circular alpha mask. Scale grows slightly with heli altitude.

### Rotor wash

Uniform fed into wave shader: `uRotorWash = vec3(heliX, heliZ, intensity)` where intensity decreases with altitude. In the wave function:

```glsl
float washMask = 1.0 - smoothstep(0.0, ROTOR_RADIUS, distance(cellPos, uRotorWash.xy));
washMask *= uRotorWash.z;

// Damp Gerstner sum, add radial ripple
h *= (1.0 - 0.7 * washMask);
h += washMask * sin(distance(cellPos, uRotorWash.xy) * 4.0 - time * 8.0) * 0.2;
```

Same uniform feeds vegetation bend shader.

### Helicopter controls

Simple arcade physics:
- Throttle (W/Up) → target altitude up
- S/Down → altitude down
- A/D → yaw + lateral drift (heli leans into turn)
- Forward speed scales with altitude or pitch input

No rotor blade physics. Just position + heading + visual lean (bank angle = lateral acceleration).

### Streaming

`ChunkManager` keeps a map of loaded chunks keyed by `(cx, cz)`. Each tick:

1. Compute heli's chunk and chunks within `CHUNKS_AHEAD` in velocity direction.
2. For any required chunk not loaded, queue generation (sync in Phase 8a, web worker in Phase 8b).
3. Dispose chunks beyond `CHUNKS_BEHIND`.

Chunk generation produces: heightfield function (already defined at any (x,z) but cached per chunk for perf), Stålberg grid, biome tags, BufferGeometry, shadow texture.

---

## Open decisions for the implementer

These should be settled early; they affect everything downstream:

1. **Same Stålberg grid for terrain and waves, or two grids?** Recommend unified for Phase 1–5; split if the single grid creates problems at Phase 8 (it shouldn't).
2. **Wave update — vertex shader analytic, or compute shader writing a height texture?** Recommend vertex shader analytic for now; revisit for WebGPU compute path if profiling shows issues.
3. **Helicopter physics — arcade or semi-realistic?** Recommend arcade; semi-realistic adds complexity disproportionate to fun for this view angle.
4. **Day/night cycle?** Out of scope unless added to Phase 9.

---

## What to skip

- Underwater rendering (camera never goes below). No volumetric rays, no underwater fog.
- View-dependent LOD (camera distance is constant).
- FFT ocean. Gerstner is enough.
- High-frequency wave detail (reads as noise from this angle).
- Detailed seafloor far from islands.
- Per-vertex shadows on water (the shadow projection at heli XZ is enough).
- Realistic shoaling amplitude growth; we're using shore-calm stylisation.

---

## Acceptance check (overall)

The game is "done with the spec" when:

- Heli flies seamlessly across an unbounded archipelago.
- Islands have visible underwater shelves with coral and sandbars.
- Three water bands are clearly distinguishable from above.
- Waves are blocky, animated, and grid resolution scales correctly with depth.
- Lee sides of islands are visibly calmer than windward sides.
- Heli shadow tracks position over both terrain and waves.
- Rotor wash visibly disturbs water and vegetation when low.
- World is deterministic from a seed.
- 60 FPS on a mid-range laptop GPU at 1080p.
