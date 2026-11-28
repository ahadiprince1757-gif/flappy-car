import { initializeGame, renderGame } from "./core/game.js";
import { gameState } from "./core/gameState.js";
import { startGameLoop } from "./core/gameLoop.js";
import { loadData, syncWithBackend } from "./core/storage.js";

import { getCarConfig } from "./cars/cars.js";
import { createPlayer } from "./player/player.js";
import { updatePlayerMovement } from "./player/movement.js";
import { initializeControls } from "./player/controls.js";

import {
  createStage,
  updateStage
} from "./stages/stageRenderer.js";

import { preloadBuildingModels, preloadTreeModels, upgradeBackgroundToFBX } from "./stages/backgrounds.js";
import { preloadCarModels } from "./cars/carModelLoader.js";

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
  initTraffic,
  updateTraffic,
  resetTraffic
} from "./traffic/trafficCars.js";

import {
  updateEngineSound,
  stopEngineSound,
  preloadGameAudioBuffers
} from "./systems/audio.js";

import {
  updateCheckpoints,
  resetCheckpoints
} from "./systems/checkpoints.js";

import { initializeUI, updateUI } from "./ui/ui.js";
import { PerformanceMonitor } from "./core/perfMonitor.js";

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

    if (gameState.config?.obstaclesEnabled) {
      updateObstacleSpawner(deltaTime);
      updateObstacles(deltaTime);
    }

    updateCoins(deltaTime);
    updatePowerUps(deltaTime);

    updateTraffic(deltaTime);
    updateCheckpoints(deltaTime);

    checkCollisions();
    updateRacing(deltaTime);

    if (gameState.status === "playing") {
      const isAnyButtonPressed = Boolean(
        gameState.input && (
          gameState.input.accelerate ||
          gameState.input.brake ||
          gameState.input.nitro ||
          gameState.input.left ||
          gameState.input.right ||
          gameState.input.jump ||
          gameState.input.slide
        )
      );

      updateEngineSound(
        gameState.speed,
        gameState.baseSpeed,
        isAnyButtonPressed
      );
    } else {
      stopEngineSound();
    }
  } else {
    stopEngineSound();
  }

  updateEffects(deltaTime);
  updateUI();
  PerformanceMonitor.update();
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

    // 3. Bind Keyboard & Touch Controls
    initializeControls();

    // 4. Clear runtime entities
    clearObstacles();
    resetObstacleSpawner();
    resetCoins();
    resetPowerUps();
    clearEffects();
    resetTraffic();
    resetCheckpoints();

    // 5. Initialise traffic manager (safe for async model caching)
    initTraffic(gameState.scene);

    // 6. Initialize UI & Menus
    initializeUI();

    // 6b. Asynchronously synchronize saved progress with backend
    syncWithBackend().then((synced) => {
      if (synced && typeof synced.coins === 'number') {
        gameState.coins = synced.coins;
        updateUI();
      }
    }).catch(() => {});

    // 7. Launch Animation & Physics Game Loop
    startGameLoop({
      update: updateGame,
      render: renderGame
    });

    // 8. Preload pure 3D FBX models & audio buffers in background (upgrading scene immediately when ready!)
    preloadBuildingModels(() => {
      upgradeBackgroundToFBX(gameState.road?.background);
    });
    preloadTreeModels(() => {
      upgradeBackgroundToFBX(gameState.road?.background);
    });
    preloadGameAudioBuffers();

    preloadCarModels(() => {
      if (gameState.scene && !gameState.player?.group) {
        createPlayer(gameState.selectedCar);
      }
      console.info("Pure 3D FBX car models ready.");
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
