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
