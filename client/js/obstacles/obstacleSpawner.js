import { gameState } from "../core/gameState.js";
import { createObstacle } from "./obstacles.js";

const SPAWNER_CONFIG = {
  initialInterval: 1.75,
  minimumInterval: 0.95,

  // Spawn cleanly down the road in front of player
  spawnDistance: -90,

  // Safe minimum distance between obstacles
  minimumGap: 20
};

let spawnTimer = 1.2;
let lastLane = -1;
let lastObstacleZ = -Infinity;

/**
 * Procedural lane selection ensuring alternating flow
 */
function selectProceduralLane() {
  const laneCount = gameState.lanePositions?.length || 3;
  if (laneCount <= 1) return 0;

  let lane = Math.floor(Math.random() * laneCount);
  let attempts = 0;

  // Prevent same lane being picked repeatedly
  while (lane === lastLane && attempts < 8) {
    lane = Math.floor(Math.random() * laneCount);
    attempts++;
  }

  lastLane = lane;
  return lane;
}

/**
 * Progressive Level Generation:
 * Tailors obstacle difficulty and types dynamically based on distance traveled.
 */
function getProgressiveObstacleType() {
  const dist = gameState.distance || 0;

  // Phase 1 (0 - 120m): Introductory highway drive with jumpable barriers and cones
  if (dist < 120) {
    const pool = ["cone", "barrier", "barrier", "cone"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Phase 2 (120m - 350m): Introduce sliding gates, crates, and oil slicks
  if (dist < 350) {
    const roll = Math.random();
    if (roll < 0.28) return "barrier";
    if (roll < 0.52) return "cone";
    if (roll < 0.74) return "crate";
    if (roll < 0.88) return "gate";
    return "oil";
  }

  // Phase 3 (350m+): Full high-speed arcade variety with varied timing challenges
  const roll = Math.random();
  if (roll < 0.22) return "barrier";
  if (roll < 0.42) return "gate";
  if (roll < 0.62) return "crate";
  if (roll < 0.82) return "cone";
  return "oil";
}

/**
 * Calculate dynamic spawn interval based on current speed and progression
 */
function getSpawnInterval() {
  const baseSpeed = Math.max(gameState.baseSpeed || 1, 1);
  const currentSpeed = Math.max(gameState.speed || baseSpeed, baseSpeed);
  const speedFactor = currentSpeed / baseSpeed;

  return Math.max(
    SPAWNER_CONFIG.minimumInterval,
    SPAWNER_CONFIG.initialInterval / Math.sqrt(speedFactor)
  );
}

/**
 * Spawn one obstacle ahead along the continuous road
 */
export function spawnObstacleNow(
  type = getProgressiveObstacleType(),
  lane = selectProceduralLane()
) {
  const laneCount = gameState.lanePositions?.length || 3;
  const safeLane = Math.max(0, Math.min(laneCount - 1, Math.floor(lane)));

  const spawnZ = SPAWNER_CONFIG.spawnDistance;

  if (Math.abs(spawnZ - lastObstacleZ) < SPAWNER_CONFIG.minimumGap) {
    return null;
  }

  const obstacle = createObstacle(type, safeLane, spawnZ);

  if (obstacle) {
    lastObstacleZ = spawnZ;
  }

  return obstacle;
}

/**
 * Called once per frame by the main game loop
 */
export function updateObstacleSpawner(dt) {
  if (gameState.status !== "playing") return;
  if (!Number.isFinite(dt) || dt <= 0) return;

  spawnTimer -= Math.min(dt, 0.05);

  if (spawnTimer > 0) return;

  spawnObstacleNow();
  spawnTimer = getSpawnInterval();
}

/**
 * Reset spawner state when starting or restarting
 */
export function resetObstacleSpawner() {
  spawnTimer = 1.2;
  lastLane = -1;
  lastObstacleZ = -Infinity;
}
