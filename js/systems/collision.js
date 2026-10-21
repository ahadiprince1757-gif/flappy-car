
import { gameState } from "../core/gameState.js";
import { removeObstacle } from "../obstacles/obstacles.js";
import { handleRaceCollision } from "../racing/racing.js";

const COLLISION_FORWARD_DISTANCE = 1.4;
const COLLISION_LANE_DISTANCE = 1.25;
const JUMP_CLEARANCE = 0.75;

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

    // roadZ tracks progress along the road in the obstacle module.
    const obstacleZ = obstacle.roadZ ?? model.position.z;

    const forwardDistance = Math.abs(obstacleZ - playerZ);

    if (forwardDistance >= COLLISION_FORWARD_DISTANCE) continue;

    const obstacleLaneOffset =
      obstacle.laneOffset ??
      gameState.lanePositions[obstacle.lane] ??
      0;

    const lateralDistance = Math.abs(
      obstacleLaneOffset - playerLaneOffset
    );

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

    handleRaceCollision({
      type: obstacle.type
    });

    return true;
  }

  return false;
}