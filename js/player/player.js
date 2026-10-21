import { gameState } from "../core/gameState.js";
import { createCarModel } from "../cars/carRenderer.js";
import { getCarConfig } from "../cars/cars.js";
import { getRoadPoint } from "../stages/stageRenderer.js";

export function createPlayer(carId = gameState.selectedCar) {
  if (!gameState.scene) {
    throw new Error("Initialize the 3D scene before creating the player.");
  }

  if (gameState.player?.group) {
    gameState.scene.remove(gameState.player.group);
  }

  const config = getCarConfig(carId);
  const group = createCarModel(carId);

  const initialZ = 4;
  const initialLaneOffset = gameState.lanePositions[1];
  const pt = getRoadPoint(initialZ, initialLaneOffset);

  group.position.set(pt.x, pt.y, pt.z);
  group.rotation.set(0, pt.heading, 0);

  gameState.scene.add(group);

  gameState.player = {
    group,
    carId,
    config,

    lane: 1,
    targetLaneOffset: initialLaneOffset,
    currentLaneOffset: initialLaneOffset,
    baseZ: initialZ,

    verticalVelocity: 0,
    jumpHeight: 0,
    groundY: pt.y,

    isJumping: false,
    isSliding: false,

    slideTimer: 0,
    laneChangeSpeed: 14,
    invulnerable: false
  };

  gameState.selectedCar = carId;
  gameState.currentLane = 1;
  gameState.baseSpeed = config.speed;
  gameState.speed = config.speed;

  return gameState.player;
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
