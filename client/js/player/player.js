import { gameState } from "../core/gameState.js";
import { createCarModel } from "../cars/carRenderer.js";
import { getCarConfig } from "../cars/cars.js";
import { getRoadPoint } from "../stages/stageRenderer.js";

/**
 * Create the player using the real FBX car model.
 * Returns true on success, false if the FBX isn't ready yet.
 */
export function createPlayer(carId = gameState.selectedCar) {
  if (!gameState.scene) {
    throw new Error("Initialize the 3D scene before creating the player.");
  }

  const config = getCarConfig(carId);
  const group = createCarModel(carId);

  // Preserve existing runtime state if replacing an active player (e.g. proxy -> FBX upgrade)
  const existing = gameState.player;
  const currentLane = existing ? existing.lane : 1;
  const currentLaneOffset = existing ? existing.currentLaneOffset : gameState.lanePositions[currentLane];
  const targetLaneOffset = existing ? existing.targetLaneOffset : currentLaneOffset;
  const baseZ = existing ? existing.baseZ : 4;
  const jumpHeight = existing ? existing.jumpHeight : 0;
  const isJumping = existing ? existing.isJumping : false;
  const isSliding = existing ? existing.isSliding : false;
  const verticalVelocity = existing ? existing.verticalVelocity : 0;
  const currentY = existing && existing.group ? existing.group.position.y : null;

  if (existing?.group) {
    gameState.scene.remove(existing.group);
  }

  const pt = getRoadPoint(baseZ, currentLaneOffset);
  group.position.set(pt.x, currentY ?? pt.y, pt.z);
  group.rotation.set(0, pt.heading, 0);

  gameState.scene.add(group);

  gameState.player = {
    group,
    carId,
    config,
    lane: currentLane,
    targetLaneOffset,
    currentLaneOffset,
    baseZ,
    verticalVelocity,
    jumpHeight,
    groundY: pt.y,
    isJumping,
    isSliding,
    slideTimer: existing ? existing.slideTimer : 0,
    laneChangeSpeed: 14,
    invulnerable: existing ? existing.invulnerable : false,
  };

  gameState.selectedCar = carId;
  gameState.currentLane = currentLane;
  gameState.baseSpeed = config.speed;
  if (!existing) {
    gameState.speed = config.speed;
  }

  // Snap camera directly behind the car on first spawn
  if (!existing && gameState.camera) {
    const pos = group.position;
    gameState.camera.position.set(pos.x, pos.y + 4.8, pos.z + 9.0);
    gameState.camera.lookAt(pos.x, pos.y + 1.2, pos.z - 10);
  }

  console.info(`[Player] Car "${carId}" (${group.userData.isPlaceholder ? "proxy" : "FBX"}) spawned.`);
  return true;
}

export function changePlayerCar(carId) {
  return createPlayer(carId);
}

export function removePlayer() {
  if (gameState.player?.group && gameState.scene) {
    gameState.scene.remove(gameState.player.group);
  }
  gameState.player = null;
}
