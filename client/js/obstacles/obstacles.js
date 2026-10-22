import { gameState } from "../core/gameState.js";
import { createObstacleModel } from "./obstacleRenderer.js";
import { getRoadPoint } from "../stages/stageRenderer.js";

const PLAYER_Z_DEFAULT = 4;
// Despawn cleanly right behind camera view
const CLEANUP_DISTANCE = 10;

const OBSTACLE_DATA = {
  barrier: {
    width: 2.2,
    height: 0.95,
    depth: 0.65,
    canJump: true,
    requiresSlide: false,
    score: 10
  },
  crate: {
    width: 1.3,
    height: 1.3,
    depth: 1.3,
    canJump: true,
    requiresSlide: false,
    score: 15
  },
  cone: {
    width: 0.9,
    height: 1.05,
    depth: 0.9,
    canJump: true,
    requiresSlide: false,
    score: 5
  },
  gate: {
    width: 2.2,
    height: 2.8,
    depth: 0.32,
    canJump: false,
    requiresSlide: true,
    score: 20
  },
  oil: {
    width: 1.6,
    height: 0.1,
    depth: 1.5,
    canJump: true,
    requiresSlide: false,
    score: 10
  }
};

/* ── High-Performance Object Pool ────────────────────────────── */
const obstaclePool = {
  barrier: [],
  crate: [],
  cone: [],
  gate: [],
  oil: []
};

export function getObstacleData(type) {
  return OBSTACLE_DATA[type] ?? OBSTACLE_DATA.barrier;
}

function getLaneOffset(lane) {
  const lanes = gameState.lanePositions;
  const safeLane = Math.max(0, Math.min(lanes.length - 1, lane));
  return lanes[safeLane] ?? 0;
}

function positionObstacle(obstacle, z) {
  const point = getRoadPoint(z, obstacle.laneOffset);

  obstacle.model.position.set(
    point.x,
    point.y + 0.04,
    point.z
  );

  obstacle.model.rotation.set(
    Math.atan(point.slope),
    point.heading,
    0
  );

  obstacle.model.userData.roadZ = z;
}

export function createObstacle(type, lane, z = -85) {
  if (!gameState.scene) {
    throw new Error("Initialize the 3D scene before creating obstacles.");
  }

  const safeLane = Math.max(
    0,
    Math.min(gameState.lanePositions.length - 1, lane)
  );

  const config = getObstacleData(type);
  const laneOffset = getLaneOffset(safeLane);

  // Reuse from object pool if available to eliminate GC hitching
  const pool = obstaclePool[type];
  if (pool && pool.length > 0) {
    const pooled = pool.pop();
    pooled.lane = safeLane;
    pooled.laneOffset = laneOffset;
    pooled.roadZ = z;
    pooled.active = true;
    pooled.passed = false;
    pooled.model.visible = true;

    positionObstacle(pooled, z);
    gameState.obstacles.push(pooled);
    return pooled;
  }

  // Create new model once and add to scene
  const model = createObstacleModel(type);

  const obstacle = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    lane: safeLane,
    laneOffset,
    config,
    model,
    group: model,
    roadZ: z,
    active: true,
    passed: false
  };

  model.userData.obstacleId = obstacle.id;

  positionObstacle(obstacle, z);
  gameState.scene.add(model);
  gameState.obstacles.push(obstacle);

  return obstacle;
}

export function updateObstacles(deltaTime) {
  if (gameState.status !== "playing") return;

  const speed = Math.max(0, gameState.speed);
  const playerZ = gameState.player?.group.position.z ?? PLAYER_Z_DEFAULT;

  for (const obstacle of gameState.obstacles) {
    if (!obstacle.active) continue;

    obstacle.roadZ += speed * deltaTime;
    positionObstacle(obstacle, obstacle.roadZ);

    if (!obstacle.passed && obstacle.roadZ > playerZ) {
      obstacle.passed = true;
      gameState.score += obstacle.config.score;
    }
  }

  cleanupObstacles();
}

export function removeObstacle(obstacle) {
  if (!obstacle) return;

  obstacle.active = false;
  if (obstacle.model) {
    obstacle.model.visible = false;
  }

  const index = gameState.obstacles.indexOf(obstacle);
  if (index !== -1) {
    gameState.obstacles.splice(index, 1);
  }

  // Return to pool for zero-garbage recycling
  if (obstaclePool[obstacle.type]) {
    obstaclePool[obstacle.type].push(obstacle);
  }
}

export function cleanupObstacles() {
  const playerZ = gameState.player?.group.position.z ?? PLAYER_Z_DEFAULT;

  for (const obstacle of [...gameState.obstacles]) {
    if (!obstacle.active || obstacle.roadZ > playerZ + CLEANUP_DISTANCE) {
      removeObstacle(obstacle);
    }
  }
}

export function clearObstacles() {
  for (const obstacle of [...gameState.obstacles]) {
    removeObstacle(obstacle);
  }
}