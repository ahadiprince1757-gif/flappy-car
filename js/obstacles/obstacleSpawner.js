import { gameState } from "../core/gameState.js";
import { createObstacle } from "./obstacles.js";

const SPAWNER_CONFIG = {
  initialInterval: 1.65,
  minimumInterval: 0.95,

  // Obstacles appear ahead of the player.
  spawnDistance: -85,

  // Keep consecutive obstacles from appearing too close together.
  minimumGap: 18,

  // Prevent the same lane being chosen repeatedly.
  avoidSameLane: true,

  // Avoid making every obstacle a difficult one.
  obstacleWeights: {
    barrier: 28,
    cone: 24,
    crate: 22,
    oil: 16,
    gate: 10
  }
};

let spawnTimer = 1.0;
let lastLane = -1;
let lastObstacleZ = -Infinity;

/**
 * Select a random lane from the available lanes.
 * Lane indices are 0, 1 and 2 for a three-lane road.
 */
function randomLane() {
  const laneCount = gameState.lanePositions?.length || 3;

  if (laneCount <= 1) return 0;

  let lane = Math.floor(Math.random() * laneCount);

  if (SPAWNER_CONFIG.avoidSameLane && laneCount > 1) {
    let attempts = 0;

    while (lane === lastLane && attempts < 8) {
      lane = Math.floor(Math.random() * laneCount);
      attempts++;
    }
  }

  lastLane = lane;
  return lane;
}

/**
 * Choose an obstacle using weighted probabilities.
 * Gates are less common because they require precise timing.
 */
function randomObstacleType() {
  const weights = SPAWNER_CONFIG.obstacleWeights;

  const entries = Object.entries(weights);
  const totalWeight = entries.reduce(
    (sum, [, weight]) => sum + weight,
    0
  );

  let roll = Math.random() * totalWeight;

  for (const [type, weight] of entries) {
    roll -= weight;

    if (roll <= 0) {
      return type;
    }
  }

  return "barrier";
}

/**
 * Calculate the time between spawns.
 * Higher speed produces a shorter interval, with a safe minimum.
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
 * Spawn one obstacle.
 *
 * Optional arguments allow specific obstacles or lanes to be spawned.
 */
export function spawnObstacleNow(
  type = randomObstacleType(),
  lane = randomLane()
) {
  const laneCount = gameState.lanePositions?.length || 3;

  const safeLane = Math.max(
    0,
    Math.min(laneCount - 1, Math.floor(lane))
  );

  // Don't create a second obstacle at almost the same distance.
  const spawnZ = SPAWNER_CONFIG.spawnDistance;

  if (
    Math.abs(spawnZ - lastObstacleZ) <
    SPAWNER_CONFIG.minimumGap
  ) {
    return null;
  }

  const obstacle = createObstacle(type, safeLane, spawnZ);

  if (obstacle) {
    lastObstacleZ = spawnZ;
  }

  return obstacle;
}

/**
 * Called once per frame by the main game loop.
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
 * Reset the spawner when starting or restarting a run.
 */
export function resetObstacleSpawner() {
  spawnTimer = 1.0;
  lastLane = -1;
  lastObstacleZ = -Infinity;
}
