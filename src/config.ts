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
export const WAVE_AMPLITUDE_DEEP = 1.5;
export const WAVE_AMPLITUDE_SHORE = 0.1;
export const WAVE_STEP_RATIO = 0.5;
export const NUM_GERSTNER_WAVES = 8;
export const WIND_DIRECTION = [1, 0] as const;

// Depth profile
export const SHELF_DEPTH = -6;
export const DROPOFF_DEPTH = -30;
export const ABYSSAL_DEPTH = -60;

// Water colour bands (positive depths in metres below sea level)
export const SHALLOW_BAND = 5;
export const MID_BAND = 25;

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
