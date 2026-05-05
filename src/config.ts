// Single source of truth for tunable constants.
// See SPEC.md §config.ts. Do not inline magic numbers in implementation files.

export const SEA_LEVEL = 0;

// World streaming
export const CHUNK_SIZE = 256;
export const CHUNKS_AHEAD = 3;
export const CHUNKS_BEHIND = 1;

// Wave grid
export const WAVE_CELL_DEEP = 6;
export const WAVE_CELL_SHORE = 1.5;
export const WAVE_AMPLITUDE_DEEP = 2.0;
export const WAVE_AMPLITUDE_SHORE = 0.25;
// Quantisation: cellSize × WAVE_STEP_RATIO. Set to 0 to disable — each cell
// then takes its continuous wave-function value at its centre, giving smooth
// stepped swell rather than discrete plateaus. Set to ~0.07 (deep step ~0.42 m,
// shore step ~0.105 m) for the original "blocky waves" aesthetic.
export const WAVE_STEP_RATIO = 0;
export const NUM_GERSTNER_WAVES = 8;
export const WIND_DIRECTION = [1, 0] as const;

// Wave spectrum (Phase 4)
export const WAVE_LAMBDA_MIN = 6;
export const WAVE_LAMBDA_MAX = 80;
export const WAVE_LAMBDA_PEAK = 20;
export const WAVE_DIR_SPREAD = Math.PI / 6; // ±30°

// Depth profile
export const SHELF_DEPTH = -6;
export const DROPOFF_DEPTH = -30;
export const ABYSSAL_DEPTH = -60;

// Water colour bands (positive depths in metres below sea level)
export const SHALLOW_BAND = 5;
export const MID_BAND = 25;

// Phase 5 tints (linear-ish srgb)
export const SHALLOW_TINT = [0.45, 0.85, 0.78] as const; // bright turquoise
export const MID_TINT = [0.18, 0.55, 0.66] as const;     // teal
export const DEEP_TINT = [0.06, 0.20, 0.42] as const;    // dark blue
export const FOAM_TINT = [0.92, 0.97, 1.00] as const;    // off-white

// Caustic projection on the shallow band (Phase 5)
export const CAUSTIC_SCALE = 0.06;       // 1/m, lower = larger caustic cells
export const CAUSTIC_SPEED = 0.6;        // animation speed multiplier
export const CAUSTIC_INTENSITY = 0.45;   // peak additive whitening
export const FOAM_AMP_THRESHOLD = 0.05;  // metres above sea level for foam onset
export const FOAM_DEPTH_THRESHOLD = 1.5; // metres below sea level beyond which foam vanishes

// Island distribution
export const ISLAND_SPACING_MIN = 200;
export const ISLAND_SPACING_AVG = 600;

// Per-island profile radii (metres from anchor), used by world/heightfield.ts.
// These are defaults; later phases will let archetypes override per-island.
export const ISLAND_R_PEAK = 35;
export const ISLAND_R_BEACH = 75;
export const ISLAND_R_SHELF = 130;
export const ISLAND_R_DROPOFF = 195;
export const ISLAND_PEAK_HEIGHT = 70;
export const ISLAND_DOMAIN_WARP_SCALE = 0.012;
export const ISLAND_DOMAIN_WARP_AMPLITUDE = 28;
export const ISLAND_PEAK_NOISE_SCALE = 0.04;
export const ISLAND_SANDBAR_NOISE_SCALE = 0.025;
export const ISLAND_SANDBAR_AMPLITUDE = 1.2;

// World seed (Phase 8 will key chunks off this; for Phase 1 it seeds the one
// hand-placed island).
export const DEFAULT_WORLD_SEED = 0x5a17e1;

// Phase 1+ single-island test mesh extent
export const PHASE1_GRID_EXTENT = 1024; // metres covered by the test mesh
export const PHASE1_ISLAND_ANCHOR = [0, 0] as const;

// Phase 3 block extrusion: depth at which boundary side walls terminate.
// Sits below ABYSSAL_DEPTH so the seabed reads as a thick slab from any angle.
export const BLOCK_BASE_DEPTH = -65;
// Side faces are tinted darker than the cell's top face for visual depth cue.
export const SIDE_FACE_TINT = 0.7;

// Phase 6 wave shadow / wave–island interaction
export const SHADOW_RESOLUTION = 128;       // texels per side
export const SHADOW_LANDMASK_RESOLUTION = 256; // pre-rasterised land bitmap
export const SHADOW_RAY_STEP = 4;           // metres per ray-cast step
export const SHADOW_RECOVERY_LENGTH = 60;   // metres; e^(-d/L) recovery
export const SHADOW_BLUR_RADIUS = 4;        // texels, perpendicular to wind
export const CLIFF_RADIUS = 16;             // metres; cliff influence falloff
export const CLIFF_CHOP_AMPLITUDE = 0.6;    // metres of standing-wave at peak
export const WIND_ROTATE_STEP = Math.PI / 8; // 22.5° per keypress

// Phase 7 helicopter VFX
export const ROTOR_RADIUS = 8;              // metres; wash effect falloff
export const ROTOR_MAX_ALTITUDE = 12;       // metres; intensity 1 at 0, 0 at this altitude
export const HELI_SHADOW_RADIUS = 5;        // metres at sea-level reference
export const HELI_SHADOW_MAX_ALTITUDE = 80; // metres above which shadow vanishes
export const HELI_SHADOW_OPACITY_MAX = 0.5; // opacity at altitude 0
export const SPRAY_PARTICLE_COUNT = 240;
export const SPRAY_ALTITUDE_THRESHOLD = 5;  // metres; spray spawns below this over water
export const SPRAY_SPAWN_RATE = 200;        // particles per second when active
export const SPRAY_PARTICLE_SIZE = 0.45;    // metres
export const SPRAY_PARTICLE_LIFE = 1.0;     // seconds, ±0.3 jitter

// Helicopter
export const HELI_CRUISE_SPEED = 30;
export const HELI_MAX_ALTITUDE = 100;
export const HELI_MIN_ALTITUDE = 2;
export const HELI_TYPICAL_ALTITUDE = 30;
export const HELI_VERTICAL_SPEED = 12;
export const HELI_YAW_RATE = 1.6; // rad/s
export const HELI_BANK_MAX = 0.5; // rad

// Camera (orthographic isometric)
export const CAMERA_PITCH_DEG = 30;
export const CAMERA_YAW_DEG = 45;
export const CAMERA_VIEW_WIDTH = 400; // metres visible across screen width
export const CAMERA_DISTANCE = 300; // distance from focal point along view ray
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 2000;

// World colours (placeholder ocean for Phase 0)
export const SKY_COLOUR = 0x87ceeb;
export const OCEAN_PLACEHOLDER_COLOUR = 0x1d6fa5;
export const HELICOPTER_PLACEHOLDER_COLOUR = 0xff5e3a;
