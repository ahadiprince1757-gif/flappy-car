import { gameState } from "../core/gameState.js";
import { createObstacleModel } from "./obstacleRenderer.js";
import { getRoadPoint } from "../stages/stageRenderer.js";
import { ObjectPool, ObjectManager } from "../core/objectPool.js";

const PLAYER_Z_DEFAULT = 4;
// Despawn boundary behind player
const CLEANUP_DISTANCE = 10;
const MAX_OBSTACLES_PER_TYPE = 8; // Max 40 total obstacles simultaneously (way above screen need of 5-8)

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

/* ── Typed Object Pools ────────────────────────────────────────── */
const obstaclePools = {};

function getPoolForType(type) {
  if (!obstaclePools[type]) {
    obstaclePools[type] = new ObjectPool({
      name: `ObstaclePool_${type}`,
      maxSize: MAX_OBSTACLES_PER_TYPE,
      createFactory: () => {
        const config = getObstacleData(type);
        const model = createObstacleModel(type);
        model.visible = false;
        if (gameState.scene) {
          gameState.scene.add(model);
        }

        const obstacle = {
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          lane: 2,
          laneOffset: 0,
          config,
          model,
          group: model,
          roadZ: -85,
          active: false,
          passed: false
        };
        model.userData.obstacleId = obstacle.id;
        return obstacle;
      },
      resetFn: (obstacle) => {
        obstacle.active = false;
        obstacle.passed = false;
        if (obstacle.model) {
          obstacle.model.visible = false;
        }
      }
    });

    ObjectManager.registerPool(`obstacle_${type}`, obstaclePools[type]);
  }
  return obstaclePools[type];
}

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

  const laneOffset = getLaneOffset(safeLane);
  const pool = getPoolForType(type);
  const obstacle = pool.get();

  if (!obstacle) return null;

  // If newly created mesh was not yet added to scene
  if (obstacle.model && obstacle.model.parent !== gameState.scene) {
    gameState.scene.add(obstacle.model);
  }

  obstacle.lane = safeLane;
  obstacle.laneOffset = laneOffset;
  obstacle.roadZ = z;
  obstacle.active = true;
  obstacle.passed = false;
  obstacle.model.visible = true;

  positionObstacle(obstacle, z);

  // Sync with gameState.obstacles list for collision system
  if (!gameState.obstacles.includes(obstacle)) {
    gameState.obstacles.push(obstacle);
  }

  return obstacle;
}

export function updateObstacles(deltaTime) {
  if (gameState.status !== "playing") return;

  const speed = Math.max(0, gameState.speed);
  const playerZ = gameState.player?.group.position.z ?? PLAYER_Z_DEFAULT;

  for (let i = gameState.obstacles.length - 1; i >= 0; i--) {
    const obstacle = gameState.obstacles[i];
    if (!obstacle.active) {
      gameState.obstacles.splice(i, 1);
      continue;
    }

    obstacle.roadZ += speed * deltaTime;
    positionObstacle(obstacle, obstacle.roadZ);

    if (!obstacle.passed && obstacle.roadZ > playerZ) {
      obstacle.passed = true;
      gameState.score += obstacle.config.score;
    }

    // Offscreen boundary check
    if (obstacle.roadZ > playerZ + CLEANUP_DISTANCE) {
      removeObstacle(obstacle);
    }
  }
}

export function removeObstacle(obstacle) {
  if (!obstacle) return;

  const pool = getPoolForType(obstacle.type);
  pool.release(obstacle);

  const index = gameState.obstacles.indexOf(obstacle);
  if (index !== -1) {
    gameState.obstacles.splice(index, 1);
  }
}

export function cleanupObstacles() {
  const playerZ = gameState.player?.group.position.z ?? PLAYER_Z_DEFAULT;

  for (let i = gameState.obstacles.length - 1; i >= 0; i--) {
    const obstacle = gameState.obstacles[i];
    if (!obstacle.active || obstacle.roadZ > playerZ + CLEANUP_DISTANCE) {
      removeObstacle(obstacle);
    }
  }
}

export function clearObstacles() {
  for (const type of Object.keys(OBSTACLE_DATA)) {
    const pool = getPoolForType(type);
    pool.releaseAll();
  }
  gameState.obstacles.length = 0;
}
