import { gameState } from "../core/gameState.js";
import { createObstacle } from "./obstacles.js";
import { getCurrentDifficulty } from "../systems/checkpoints.js";

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
 * Tailors obstacle difficulty and types dynamically based on distance & tier.
 */
function getProgressiveObstacleType() {
  const diff = getCurrentDifficulty();
  const tier = diff.tier;

  // Tier 1 (Cruising): Only clean jumpable barriers and cones
  if (tier === 1) {
    const pool = ["cone", "barrier", "barrier", "cone"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Tier 2 (Highway): Introduce crates and occasional sliding gates
  if (tier === 2) {
    const roll = Math.random();
    if (roll < 0.35) return "barrier";
    if (roll < 0.60) return "cone";
    if (roll < 0.85) return "crate";
    return "gate";
  }

  // Tier 3 (Speedway): Crate stacks, sliding gates, and oil slicks
  if (tier === 3) {
    const roll = Math.random();
    if (roll < 0.25) return "barrier";
    if (roll < 0.50) return "gate";
    if (roll < 0.72) return "crate";
    if (roll < 0.88) return "cone";
    return "oil";
  }

  // Tier 4 (Hyperdrive): Fast dynamic arcade hazards
  const roll = Math.random();
  if (roll < 0.28) return "gate";
  if (roll < 0.52) return "barrier";
  if (roll < 0.74) return "crate";
  if (roll < 0.88) return "oil";
  return "cone";
}

/**
 * Calculate dynamic spawn interval based on current difficulty tier and speed
 */
function getSpawnInterval() {
  const diff = getCurrentDifficulty();
  const [minInt, maxInt] = diff.interval;
  const baseSpeed = Math.max(gameState.baseSpeed || 1, 1);
  const currentSpeed = Math.max(gameState.speed || baseSpeed, baseSpeed);
  const speedRatio = Math.min(1.5, currentSpeed / baseSpeed);

  // Scaled randomized interval within the tier's curated boundaries
  const randFraction = Math.random();
  const target = minInt + randFraction * (maxInt - minInt);
  return Math.max(0.75, target / Math.sqrt(speedRatio));
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
  const minGap = getCurrentDifficulty().minGap;

  if (Math.abs(spawnZ - lastObstacleZ) < minGap) {
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
