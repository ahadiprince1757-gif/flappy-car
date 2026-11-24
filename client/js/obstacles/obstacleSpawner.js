import { gameState } from "../core/gameState.js";
import { createObstacle } from "./obstacles.js";
import { getCurrentDifficulty } from "../systems/checkpoints.js";

const SPAWNER_CONFIG = {
  // Spawn cleanly down the road in front of player
  spawnDistance: -90,
  // Base distance in meters traveled between spawns
  baseDistanceInterval: 32,
  minDistanceInterval: 18
};

let distanceSinceLastSpawn = 0;
let lastLane = -1;

/**
 * Procedural lane selection ensuring alternating flow
 */
function selectProceduralLane() {
  const laneCount = gameState.lanePositions?.length || 3;
  if (laneCount <= 1) return 0;

  let lane = Math.floor(Math.random() * laneCount);
  let attempts = 0;

  while (lane === lastLane && attempts < 8) {
    lane = Math.floor(Math.random() * laneCount);
    attempts++;
  }

  lastLane = lane;
  return lane;
}

/**
 * Progressive Level Generation based on distance & tier
 */
function getProgressiveObstacleType() {
  const diff = getCurrentDifficulty();
  const tier = diff.tier;

  if (tier === 1) {
    const pool = ["cone", "barrier", "barrier", "cone"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  if (tier === 2) {
    const roll = Math.random();
    if (roll < 0.35) return "barrier";
    if (roll < 0.60) return "cone";
    if (roll < 0.85) return "crate";
    return "gate";
  }

  if (tier === 3) {
    const roll = Math.random();
    if (roll < 0.25) return "barrier";
    if (roll < 0.50) return "gate";
    if (roll < 0.72) return "crate";
    if (roll < 0.88) return "cone";
    return "oil";
  }

  const roll = Math.random();
  if (roll < 0.28) return "gate";
  if (roll < 0.52) return "barrier";
  if (roll < 0.74) return "crate";
  if (roll < 0.88) return "oil";
  return "cone";
}

/**
 * Distance required between obstacle spawns based on difficulty
 */
function getRequiredSpawnDistance() {
  const diff = getCurrentDifficulty();
  const minGap = diff.minGap || 22;
  const randVariation = Math.random() * 12;
  return Math.max(SPAWNER_CONFIG.minDistanceInterval, minGap + randVariation);
}

let currentSpawnDistanceTarget = 24;

export function spawnObstacleNow(
  type = getProgressiveObstacleType(),
  lane = selectProceduralLane()
) {
  const laneCount = gameState.lanePositions?.length || 3;
  const safeLane = Math.max(0, Math.min(laneCount - 1, Math.floor(lane)));
  const spawnZ = SPAWNER_CONFIG.spawnDistance;

  const obstacle = createObstacle(type, safeLane, spawnZ);

  if (obstacle) {
    // Slalom challenge on multi-lane highways
    if (laneCount >= 5 && Math.random() < 0.35) {
      const secondLane = (safeLane + (Math.random() < 0.5 ? 2 : 3)) % laneCount;
      const secondType = getProgressiveObstacleType();
      createObstacle(secondType, secondLane, spawnZ);
    }
  }

  return obstacle;
}

/**
 * Distance-based Spawner Update
 * Independent of browser timer throttling and variable FPS
 */
export function updateObstacleSpawner(dt) {
  if (gameState.status !== "playing") return;
  if (!Number.isFinite(dt) || dt <= 0) return;

  const currentSpeed = Math.max(gameState.speed || 1, 1);
  const distanceTraveled = currentSpeed * dt;
  distanceSinceLastSpawn += distanceTraveled;

  if (distanceSinceLastSpawn >= currentSpawnDistanceTarget) {
    spawnObstacleNow();
    distanceSinceLastSpawn = 0;
    currentSpawnDistanceTarget = getRequiredSpawnDistance();
  }
}

export function resetObstacleSpawner() {
  distanceSinceLastSpawn = 0;
  currentSpawnDistanceTarget = 24;
  lastLane = -1;
}
