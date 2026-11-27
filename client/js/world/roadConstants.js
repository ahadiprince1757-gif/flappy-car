/* ================================================================
   FLAPPY CAR 3D — MODULAR ROAD NETWORK CONSTANTS
   Defines elevation layers, highway dimensions, and streaming bounds.
================================================================ */

export const RoadLayer = Object.freeze({
  UNDERGROUND: -1,
  GROUND: 0,
  FLYOVER: 1
});

export const ROAD_WIDTH = 18.0; // 5 lanes of 3.6m each
export const LANE_WIDTH = 3.6;
export const LANE_CENTERS = [-7.2, -3.6, 0, 3.6, 7.2];
export const MARKING_OFFSETS = [-5.4, -1.8, 1.8, 5.4];

export const SEGMENT_LENGTH = 40; // Standard modular segment length (meters)

// Active sliding world window around player (player sits near local Z = +4)
export const STREAM_BEHIND_Z = 36;    // Despawn / recycle segments once far edge passes +36m
export const STREAM_AHEAD_Z = -300;   // Keep active segments populated out to -300m

// Curve weaving bounds (keeps procedural curves gracefully inside horizon & ground plane)
export const MAX_ROAD_LATERAL_DRIFT = 7.5;
export const CURVE_DELTA_X = 4.6;
