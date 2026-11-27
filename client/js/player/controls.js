import { gameState } from "../core/gameState.js";
import {
  moveLeft,
  moveRight,
  jump,
  slide
} from "./movement.js";
import { PerformanceMonitor } from "../core/perfMonitor.js";
import { playCarRevSound, stopCarRevSound, startIdleSound, stopIdleSound } from "../systems/audio.js";

let controlsAttached = false;

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  const controlledKeys = [
    "arrowleft",
    "arrowright",
    "arrowup",
    "arrowdown",
    " ",
    "a",
    "d",
    "w",
    "s",
    "shift",
    "n"
  ];

  if (controlledKeys.includes(key)) {
    event.preventDefault();
  }

  // F3 or P key toggles the developer performance budget HUD
  if (event.key === "F3" || key === "p") {
    PerformanceMonitor.toggle();
    return;
  }

  if (gameState.status === "gameOver") {
    if (key === " " || key === "enter" || key === "r") {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("flappycar:request-restart"));
    }
    return;
  }

  if (gameState.status !== "playing") return;

  stopIdleSound();

  switch (key) {
    case "arrowleft":
    case "a":
      if (!event.repeat) {
        gameState.input.left = true;
        moveLeft();
      }
      break;

    case "arrowright":
    case "d":
      if (!event.repeat) {
        gameState.input.right = true;
        moveRight();
      }
      break;

    // Up / W: Accelerate
    case "arrowup":
    case "w":
      if (!event.repeat && !gameState.input.accelerate) {
        playCarRevSound();
      }
      gameState.input.accelerate = true;
      break;

    // Down / S: Brake
    case "arrowdown":
    case "s":
      gameState.input.brake = true;
      break;

    // Space: Jump (ignites rocket fuel booster!)
    case " ":
      if (!event.repeat) {
        gameState.input.jump = true;
        jump();
      }
      break;

    // Shift / J: Slide
    case "shift":
    case "j":
      if (!event.repeat) {
        gameState.input.slide = true;
        slide();
      }
      break;

    // N: Nitro Boost
    case "n":
      gameState.input.nitro = true;
      break;
  }
}

function handleKeyUp(event) {
  switch (event.key.toLowerCase()) {
    case "arrowleft":
    case "a":
      gameState.input.left = false;
      break;

    case "arrowright":
    case "d":
      gameState.input.right = false;
      break;

    case "arrowup":
    case "w":
      gameState.input.accelerate = false;
      stopCarRevSound();
      break;

    case "arrowdown":
    case "s":
      gameState.input.brake = false;
      break;

    case " ":
      gameState.input.jump = false;
      break;

    case "shift":
    case "j":
      gameState.input.slide = false;
      break;

    case "n":
      gameState.input.nitro = false;
      break;
  }

  if (!isAnyInputActive() && gameState.status === "playing") {
    startIdleSound();
  }
}

function isAnyInputActive() {
  return Boolean(
    gameState.input.left ||
    gameState.input.right ||
    gameState.input.accelerate ||
    gameState.input.brake ||
    gameState.input.jump ||
    gameState.input.slide ||
    gameState.input.nitro
  );
}

function handleBlur() {
  gameState.input.left = false;
  gameState.input.right = false;
  gameState.input.jump = false;
  gameState.input.slide = false;
  gameState.input.accelerate = false;
  gameState.input.brake = false;
  gameState.input.nitro = false;
  stopCarRevSound();
  stopIdleSound();
}

export function startAccelerate() {
  if (gameState.status !== "playing") return;
  stopIdleSound();
  if (!gameState.input.accelerate) {
    playCarRevSound();
  }
  gameState.input.accelerate = true;
}

export function stopAccelerate() {
  gameState.input.accelerate = false;
  stopCarRevSound();
  if (!isAnyInputActive() && gameState.status === "playing") {
    startIdleSound();
  }
}

export function startBrake() {
  stopIdleSound();
  gameState.input.brake = true;
}

export function stopBrake() {
  gameState.input.brake = false;
  if (!isAnyInputActive() && gameState.status === "playing") {
    startIdleSound();
  }
}

export function startNitro() {
  stopIdleSound();
  gameState.input.nitro = true;
}

export function stopNitro() {
  gameState.input.nitro = false;
  stopCarRevSound();
  if (!isAnyInputActive() && gameState.status === "playing") {
    startIdleSound();
  }
}

export function initializeControls() {
  if (controlsAttached) return;

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);

  controlsAttached = true;
}

export function removeControls() {
  if (!controlsAttached) return;

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("blur", handleBlur);

  controlsAttached = false;
  handleBlur();
}

export const playerControls = {
  left: moveLeft,
  right: moveRight,
  jump,
  slide,
  startAccelerate,
  stopAccelerate,
  startBrake,
  stopBrake,
  startNitro,
  stopNitro
};
