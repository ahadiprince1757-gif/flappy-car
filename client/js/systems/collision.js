import { gameState } from "../core/gameState.js";
import { removeObstacle } from "../obstacles/obstacles.js";
import { handleRaceCollision } from "../racing/racing.js";
import { getTrafficPool } from "../traffic/trafficCars.js";
import { registerNearMiss } from "../player/movement.js";
import { playNearMissSound } from "../systems/audio.js";

const COLLISION_FORWARD_DISTANCE = 1.4;
const COLLISION_LANE_DISTANCE = 1.25;
const JUMP_CLEARANCE = 0.75;

// Near-miss zone: closer than this but NOT an actual hit
const NEAR_MISS_FORWARD_MIN = 0.6;
const NEAR_MISS_FORWARD_MAX = 2.4;
const NEAR_MISS_LATERAL_MIN = COLLISION_LANE_DISTANCE;
const NEAR_MISS_LATERAL_MAX = 1.9;

// Throttle near-miss events so we don't spam per-frame
let _lastNearMissTime = 0;
const NEAR_MISS_COOLDOWN_MS = 500;

function tryNearMiss() {
  const now = performance.now();
  if (now - _lastNearMissTime < NEAR_MISS_COOLDOWN_MS) return;
  _lastNearMissTime = now;
  registerNearMiss();
  playNearMissSound();
}

export function checkCollisions() {
  const player = gameState.player;

  if (!player?.group) return false;

  const playerZ = player.group.position.z;

  // Use the car's position across the lanes, not world X.
  // World X changes as the road curves.
  const playerLaneOffset =
    player.currentLaneOffset ??
    player.targetLaneOffset ??
    gameState.lanePositions[player.lane ?? gameState.currentLane] ??
    0;

  for (const obstacle of [...gameState.obstacles]) {
    if (!obstacle.active) continue;

    const model = obstacle.model || obstacle.group;
    if (!model) continue;

    const obstacleZ = obstacle.roadZ ?? model.position.z;
    const forwardDistance = Math.abs(obstacleZ - playerZ);

    if (forwardDistance >= COLLISION_FORWARD_DISTANCE) continue;

    const obstacleLaneOffset =
      obstacle.laneOffset ??
      gameState.lanePositions[obstacle.lane] ??
      0;

    const lateralDistance = Math.abs(obstacleLaneOffset - playerLaneOffset);

    if (lateralDistance >= COLLISION_LANE_DISTANCE) continue;

    const canJump = obstacle.config?.canJump ?? true;
    const requiresSlide = obstacle.config?.requiresSlide ?? false;

    const jumpingOver =
      canJump &&
      player.isJumping &&
      (player.jumpHeight || 0) > JUMP_CLEARANCE;

    const slidingUnder =
      requiresSlide &&
      player.isSliding;

    if (jumpingOver || slidingUnder) continue;

    if (gameState.shieldActive) {
      gameState.shieldActive = false;
      removeObstacle(obstacle);
      continue;
    }

    removeObstacle(obstacle);
    handleRaceCollision({ type: obstacle.type });
    return true;
  }

  // ── Traffic car collisions & near-miss detection ────────────────────
  const trafficPool = getTrafficPool();
  for (const entry of trafficPool) {
    if (!entry.active) continue;

    const forwardDist = Math.abs(entry.roadZ - playerZ);
    const lateralDist = Math.abs(entry.laneOffset - playerLaneOffset);

    // ── Full collision ──
    if (
      forwardDist < COLLISION_FORWARD_DISTANCE + 0.6 &&
      lateralDist < COLLISION_LANE_DISTANCE + 0.2
    ) {
      // Can jump over traffic cars
      if (player.isJumping && (player.jumpHeight || 0) > JUMP_CLEARANCE) {
        // Near-miss for jumping very close over a traffic car
        if (player.jumpHeight < JUMP_CLEARANCE * 1.6) tryNearMiss();
        continue;
      }

      if (gameState.shieldActive) {
        gameState.shieldActive = false;
        continue;
      }

      entry.active = false;
      entry.group.visible = false;
      handleRaceCollision({ type: "traffic" });
      return true;
    }

    // ── Near-miss zone (passed close but no crash) ──
    if (
      forwardDist >= NEAR_MISS_FORWARD_MIN &&
      forwardDist < NEAR_MISS_FORWARD_MAX &&
      lateralDist >= NEAR_MISS_LATERAL_MIN &&
      lateralDist < NEAR_MISS_LATERAL_MAX
    ) {
      tryNearMiss();
    }
  }

  return false;
}
