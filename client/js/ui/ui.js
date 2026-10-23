import { gameState } from "../core/gameState.js";
import {
  initializeHUD,
  updateHUD,
  showHUDMessage,
  hideHUDMessage
} from "./hud.js";
import {
  initializeMenus,
  showHomeScreen,
  showPauseMenu,
  hidePauseMenu,
  showSettingsModal
} from "./menus.js";
import { initializeGarage } from "../cars/garage.js";
import { playerControls } from "../player/controls.js";
import { clearObstacles } from "../obstacles/obstacles.js";
import { resetObstacleSpawner } from "../obstacles/obstacleSpawner.js";
import { resetCoins } from "../systems/coins.js";
import { resetPowerUps } from "../systems/powerups.js";
import { clearEffects, createBurst } from "../systems/effects.js";
import { startRace, abandonRace } from "../racing/racing.js";
import { resetTraffic } from "../traffic/trafficCars.js";
import {
  startEngineSound,
  stopEngineSound,
  initializeAudio,
  toggleMute,
  isMuted,
  updateMusicUI,
  playCrashSound,
  playRaceCompleteSound,
  playRaceFailedSound
} from "../systems/audio.js";
import { preloadCarModels } from "../cars/carModelLoader.js";
import { submitScore, recordLevelComplete } from "../services/api.js";
import {
  initOrientation,
  requestLandscapeOrientation,
  releaseOrientationLock
} from "../systems/orientation.js";

let initialized = false;
let resultOverlay = null;

function byId(id) {
  return document.getElementById(id);
}

function setHidden(id, hidden) {
  const element = byId(id);
  if (element) {
    element.hidden = hidden;
    element.style.display = hidden ? "none" : "";
  }
}

function setGameplayVisible(visible) {
  setHidden("controls", !visible);
  setHidden("inGameTopActions", !visible);
  setHidden("pauseBtn", !visible);
  setHidden("ui", !visible);

  if (visible) {
    requestLandscapeOrientation();
  } else {
    releaseOrientationLock();
  }
}

function resetRunSystems() {
  clearObstacles();
  resetObstacleSpawner();
  resetCoins();
  resetPowerUps();
  clearEffects();
  resetTraffic();

  gameState.score = 0;
  gameState.distance = 0;
  gameState.elapsedTime = 0;
  gameState.runCoins = 0;
  gameState.speed = gameState.baseSpeed || 18;

  gameState.shieldActive = false;
  gameState.boostActive = false;
  gameState.isJumping = false;
  gameState.isSliding = false;

  gameState.input = {
    left: false,
    right: false,
    jump: false,
    slide: false,
    accelerate: false,
    brake: false
  };

  if (gameState.player) {
    const player = gameState.player;
    player.lane = 1;
    player.targetLaneOffset = gameState.lanePositions[1];
    player.currentLaneOffset = gameState.lanePositions[1];
    player.verticalVelocity = 0;
    player.jumpHeight = 0;
    player.isJumping = false;
    player.isSliding = false;
    player.slideTimer = 0;
    player.invulnerable = false;

    if (player.group) {
      player.group.rotation.set(0, 0, 0);
      if (player.group.userData.originalScale) {
        player.group.scale.copy(player.group.userData.originalScale);
      }
    }
  }
}

function removeResultOverlay() {
  if (resultOverlay) {
    resultOverlay.remove();
    resultOverlay = null;
  }
  document.querySelectorAll(".modal-overlay:not(#pauseMenu), .result-card").forEach(el => el.remove());
}

function showResultOverlay(title, isWin, stats = [], actions = []) {
  removeResultOverlay();

  const container = byId("gameContainer");
  if (!container) return;

  resultOverlay = document.createElement("section");
  resultOverlay.className = "menu-screen modal-overlay";
  resultOverlay.setAttribute("role", "dialog");
  resultOverlay.setAttribute("aria-modal", "true");
  resultOverlay.setAttribute("aria-label", title);

  const card = document.createElement("div");
  card.className = "result-card";

  const heading = document.createElement("h2");
  heading.className = `result-title ${isWin ? "win" : "failed"}`;
  heading.textContent = title;

  const statsBox = document.createElement("div");
  statsBox.className = "result-stats-box";

  for (const stat of stats) {
    const line = document.createElement("div");
    line.className = "result-stat-line";
    line.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong>`;
    statsBox.append(line);
  }

  const actionsContainer = document.createElement("div");
  actionsContainer.className = "modal-actions";

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `menuBtn ${action.primary ? "primary-action-btn" : "secondary-action-btn"}`;
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    actionsContainer.append(button);
  }

  card.append(heading, statsBox, actionsContainer);
  resultOverlay.append(card);
  container.append(resultOverlay);
}

function finishRun(title, isWin, stats) {
  gameState.status = "gameOver";
  stopEngineSound();
  setGameplayVisible(false);
  hidePauseMenu();

  // Submit high score to backend API
  submitScore({
    playerName: "Player",
    score: gameState.score,
    distance: Math.floor(gameState.distance),
    carId: gameState.selectedCar || "cyber"
  }).catch(() => {});

  // If completing a racing circuit, save level progress to backend API
  if (gameState.gameMode === "racing" && isWin && gameState.currentLevel) {
    recordLevelComplete(gameState.currentLevel, gameState.score).catch(() => {});
  }

  showResultOverlay(title, isWin, stats, [
    {
      label: "RESTART",
      primary: true,
      onClick: () => {
        removeResultOverlay();
        restartRun();
      }
    },
    {
      label: "MAIN MENU",
      primary: false,
      onClick: () => {
        removeResultOverlay();
        returnHome();
      }
    }
  ]);
}

function startAdventure() {
  removeResultOverlay();

  // Ensure current selected car and stage are created in 3D scene
  if (gameState.scene) {
    createStage(gameState.selectedStage || "city");
    createPlayer(gameState.selectedCar || "cyber");
  }

  if (!gameState.player?.group) {
    showHUDMessage("Loading vehicle...");
    preloadCarModels(() => {
      startAdventure();
    });
    return;
  }

  initializeAudio();

  gameState.gameMode = "adventure";
  gameState.currentLevel = 1;

  resetRunSystems();
  gameState.status = "playing";

  setHidden("homeScreen", true);
  setHidden("carSelectScreen", true);
  setHidden("trackSelectScreen", true);
  setHidden("levelSelectScreen", true);
  hidePauseMenu();

  setGameplayVisible(true);
  hideHUDMessage();
  updateHUD(true);

  startEngineSound();
}

function startSelectedRace(levelId) {
  removeResultOverlay();

  if (!gameState.player?.group) {
    showHUDMessage("Loading vehicle...");
    preloadCarModels(() => {
      startSelectedRace(levelId);
    });
    return;
  }

  initializeAudio();

  resetRunSystems();

  const result = startRace(levelId);
  if (!result.success) {
    showHUDMessage("That racing circuit is locked.");
    return;
  }

  setHidden("homeScreen", true);
  setHidden("garageScreen", true);
  setHidden("levelSelectScreen", true);
  hidePauseMenu();

  setGameplayVisible(true);
  updateHUD(true);

  startEngineSound();
}

function restartRun() {
  removeResultOverlay();
  hidePauseMenu();

  if (gameState.gameMode === "racing") {
    startSelectedRace(gameState.currentLevel || 1);
  } else {
    startAdventure();
  }
}

function pauseGame() {
  if (gameState.status !== "playing") return;

  gameState.status = "paused";
  stopEngineSound();
  showPauseMenu();
}

function resumeGame() {
  hidePauseMenu();
  removeResultOverlay();

  if (gameState.status !== "paused") return;

  gameState.status = "playing";
  setGameplayVisible(true);

  initializeAudio();
  startEngineSound();
}

function returnHome() {
  removeResultOverlay();
  hidePauseMenu();
  stopEngineSound();

  if (gameState.gameMode === "racing") {
    abandonRace();
  }

  gameState.status = "menu";
  gameState.gameMode = "adventure";

  setGameplayVisible(false);
  showHomeScreen();
  hideHUDMessage();
}

function bindButton(id, handler) {
  const button = byId(id);
  if (!button || button.dataset.uiBound === "true") return;

  // touch-action:manipulation in CSS removes 300ms tap delay — click is instant and safe
  button.addEventListener("click", handler);
  button.dataset.uiBound = "true";
}

function bindTouchControl(id, actionName) {
  const button = byId(id);
  if (!button || button.dataset.touchBound === "true") return;

  const action = playerControls[actionName];
  if (typeof action !== "function") return;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (gameState.status !== "playing") return;

    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }

    action();
  });

  button.dataset.touchBound = "true";
}

function bindContinuousTouchControl(id, startActionName, stopActionName) {
  const button = byId(id);
  if (!button || button.dataset.touchBound === "true") return;

  const startAction = playerControls[startActionName];
  const stopAction = playerControls[stopActionName];

  const handleStart = (event) => {
    event.preventDefault();
    if (gameState.status !== "playing") return;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
    if (typeof startAction === "function") startAction();
  };

  const handleEnd = (event) => {
    event.preventDefault();
    try {
      button.releasePointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
    if (typeof stopAction === "function") stopAction();
  };

  button.addEventListener("pointerdown", handleStart);
  button.addEventListener("pointerup", handleEnd);
  button.addEventListener("pointercancel", handleEnd);
  button.addEventListener("pointerleave", handleEnd);

  button.dataset.touchBound = "true";
}

function bindGameEvents() {
  window.addEventListener("flappycar:gameover", () => {
    playCrashSound();
    if (gameState.player?.group) {
      createBurst(gameState.player.group.position, 0xff3366, 20);
    }

    if (gameState.gameMode !== "racing") {
      finishRun("FAILED", false, [
        { label: "DISTANCE", value: `${Math.floor(gameState.distance)} m` },
        { label: "SCORE", value: `${gameState.score}` },
        { label: "COINS EARNED", value: `+${gameState.runCoins || 0}` }
      ]);
    }
  });

  window.addEventListener("flappycar:race-life-lost", () => {
    playCrashSound();
    if (gameState.player?.group) {
      createBurst(gameState.player.group.position, 0xff7a36, 16);
    }
  });

  window.addEventListener("flappycar:race-completed", (event) => {
    playRaceCompleteSound();
    if (gameState.player?.group) {
      createBurst(gameState.player.group.position, 0x10b981, 24);
    }

    finishRun("CIRCUIT COMPLETED", true, [
      { label: "STAGE", value: `Level ${gameState.currentLevel}` },
      { label: "DISTANCE", value: `${Math.floor(gameState.distance)} m` },
      { label: "SCORE", value: `${gameState.score}` }
    ]);
  });

  window.addEventListener("flappycar:race-failed", () => {
    playRaceFailedSound();
    finishRun("FAILED", false, [
      { label: "STAGE", value: `Level ${gameState.currentLevel}` },
      { label: "DISTANCE", value: `${Math.floor(gameState.distance)} m` }
    ]);
  });

  window.addEventListener("flappycar:request-restart", () => {
    if (gameState.status === "gameOver") {
      removeResultOverlay();
      restartRun();
    }
  });
}

export function initializeUI() {
  if (initialized) return;

  initializeHUD();
  initializeGarage();
  initOrientation();

  initializeMenus({
    onStartAdventure: startAdventure,
    onOpenInGameSettings: () => {
      pauseGame();
      showSettingsModal();
    },
    onStartRace: startSelectedRace
  });

  bindButton("pauseBtn", pauseGame);
  bindButton("resumeBtn", resumeGame);
  bindButton("restartBtn", restartRun);
  bindButton("homeBtn", returnHome);

  bindTouchControl("leftBtn", "left");
  bindTouchControl("rightBtn", "right");
  bindTouchControl("jumpBtn", "jump");
  bindContinuousTouchControl("gasBtn", "startAccelerate", "stopAccelerate");
  bindContinuousTouchControl("brakeBtn", "startBrake", "stopBrake");

  bindButton("muteBtn", () => {
    toggleMute();
    updateMusicUI();
    const muteBtn = byId("muteBtn");
    if (muteBtn) {
      muteBtn.style.opacity = isMuted() ? "0.5" : "1";
    }
  });

  bindGameEvents();

  gameState.status = "menu";
  setGameplayVisible(false);
  showHomeScreen();

  initialized = true;
}

export function updateUI() {
  updateHUD();
}
