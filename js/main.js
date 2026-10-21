import { initializeGame, renderGame } from "./core/game.js";
import { gameState } from "./core/gameState.js";
import { startGameLoop } from "./core/gameLoop.js";
import { loadData } from "./core/storage.js";

import { getCarConfig } from "./cars/cars.js";
import { createPlayer } from "./player/player.js";
import { updatePlayerMovement } from "./player/movement.js";
import { initializeControls } from "./player/controls.js";

import {
  createStage,
  updateStage
} from "./stages/stageRenderer.js";

import {
  updateObstacles,
  clearObstacles
} from "./obstacles/obstacles.js";

import {
  updateObstacleSpawner,
  resetObstacleSpawner
} from "./obstacles/obstacleSpawner.js";

import { checkCollisions } from "./systems/collision.js";

import {
  updateCoins,
  resetCoins
} from "./systems/coins.js";

import {
  updatePowerUps,
  resetPowerUps
} from "./systems/powerups.js";

import {
  updateEffects,
  clearEffects
} from "./systems/effects.js";

import { updateRacing } from "./racing/racing.js";

import {
  updateEngineSound,
  stopEngineSound
} from "./systems/audio.js";

import { initializeUI, updateUI } from "./ui/ui.js";

function loadSavedSelections() {
  const data = loadData();

  gameState.selectedCar = data.selectedCar || "cyber";
  gameState.selectedStage = data.selectedStage || "city";

  const carConfig = getCarConfig(gameState.selectedCar);
  if (carConfig) {
    gameState.baseSpeed = carConfig.speed;
    gameState.speed = carConfig.speed;
  }

  gameState.coins = Math.max(0, Number(data.coins) || 0);
}

function updateGame(deltaTime) {
  if (gameState.status === "playing") {
    gameState.elapsedTime += deltaTime;

    updatePlayerMovement(deltaTime);
    updateStage(deltaTime);

    updateObstacleSpawner(deltaTime);
    updateObstacles(deltaTime);

    updateCoins(deltaTime);
    updatePowerUps(deltaTime);

    checkCollisions();
    updateRacing(deltaTime);

    if (gameState.status === "playing") {
      updateEngineSound(
        gameState.speed,
        gameState.baseSpeed
      );
    } else {
      stopEngineSound();
    }
  } else {
    stopEngineSound();
  }

  updateEffects(deltaTime);
  updateUI();
}

function start() {
  const canvas = document.getElementById("game");

  if (!canvas) {
    console.error(
      'Flappy Car could not start: no canvas with id="game" found.'
    );
    return;
  }

  try {
    loadSavedSelections();

    // 1. Initialize 3D Engine & Viewport
    initializeGame(canvas);

    // 2. Build 3D Stage Environment & Backgrounds
    createStage(gameState.selectedStage);

    // 3. Construct 3D Player Car Model
    createPlayer(gameState.selectedCar);

    // 4. Bind Keyboard & Touch Controls
    initializeControls();

    // 5. Clear runtime entities
    clearObstacles();
    resetObstacleSpawner();
    resetCoins();
    resetPowerUps();
    clearEffects();

    // 6. Initialize UI & Menus
    initializeUI();

    // 7. Launch Animation & Physics Game Loop
    startGameLoop({
      update: updateGame,
      render: renderGame
    });

    console.info("Flappy Car 3D successfully initialized.");
  } catch (error) {
    stopEngineSound();
    console.error("Flappy Car initialization failed:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
