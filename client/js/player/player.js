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
  if (!group) {
    // Pure FBX not yet in cache — caller will await preloadCarModels()
    return false;
  }

  // Preserve existing runtime state ONLY if replacing mid-race (e.g. proxy -> FBX upgrade)
  const existing = gameState.player;
  const isMidRunUpgrade = Boolean(existing && gameState.status === "playing");
  const currentLane = isMidRunUpgrade ? existing.lane : 2;
  const currentLaneOffset = isMidRunUpgrade ? existing.currentLaneOffset : (gameState.lanePositions[currentLane] || 0);
  const targetLaneOffset = isMidRunUpgrade ? existing.targetLaneOffset : currentLaneOffset;
  const baseZ = isMidRunUpgrade ? existing.baseZ : 4;
  const jumpHeight = isMidRunUpgrade ? existing.jumpHeight : 0;
  const isJumping = isMidRunUpgrade ? existing.isJumping : false;
  const isSliding = isMidRunUpgrade ? existing.isSliding : false;
  const verticalVelocity = isMidRunUpgrade ? existing.verticalVelocity : 0;
  const currentY = isMidRunUpgrade && existing.group ? existing.group.position.y : null;

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

  // Snap camera directly behind the car on first spawn or reset
  if (!isMidRunUpgrade && gameState.camera) {
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
