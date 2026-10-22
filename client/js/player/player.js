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
  const group  = createCarModel(carId);   // returns null until FBX is cached

  if (!group) {
    // FBX not ready — caller should retry after preloadCarModels completes
    console.warn(`[Player] FBX not ready for "${carId}". Player not created yet.`);
    return false;
  }

  // Remove old player if present
  if (gameState.player?.group) {
    gameState.scene.remove(gameState.player.group);
  }

  const initialZ          = 4;
  const initialLaneOffset = gameState.lanePositions[1];
  const pt                = getRoadPoint(initialZ, initialLaneOffset);

  group.position.set(pt.x, pt.y, pt.z);
  group.rotation.set(0, pt.heading, 0);

  gameState.scene.add(group);

  gameState.player = {
    group,
    carId,
    config,

    lane:              1,
    targetLaneOffset:  initialLaneOffset,
    currentLaneOffset: initialLaneOffset,
    baseZ:             initialZ,

    verticalVelocity: 0,
    jumpHeight:       0,
    groundY:          pt.y,

    isJumping:  false,
    isSliding:  false,
    slideTimer: 0,

    laneChangeSpeed: 14,
    invulnerable:    false,
  };

  gameState.selectedCar = carId;
  gameState.currentLane = 1;
  gameState.baseSpeed   = config.speed;
  gameState.speed       = config.speed;

  // Snap camera directly behind the car so it's visible immediately
  if (gameState.camera) {
    const pos = group.position;
    gameState.camera.position.set(pos.x, pos.y + 4.8, pos.z + 9.0);
    gameState.camera.lookAt(pos.x, pos.y + 1.2, pos.z - 10);
  }

  console.info(`[Player] FBX car "${carId}" spawned successfully.`);
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
