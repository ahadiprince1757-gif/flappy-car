import { gameState } from "../core/gameState.js";
import {
  moveLeft,
  moveRight,
  jump,
  slide
} from "./movement.js";

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
    "shift"
  ];

  if (controlledKeys.includes(key)) {
    event.preventDefault();
  }

  if (gameState.status === "gameOver") {
    if (key === " " || key === "enter" || key === "r") {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("flappycar:request-restart"));
    }
    return;
  }

  if (gameState.status !== "playing") return;

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

    // Shift: Slide
    case "shift":
      if (!event.repeat) {
        gameState.input.slide = true;
        slide();
      }
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
      break;

    case "arrowdown":
    case "s":
      gameState.input.brake = false;
      break;

    case " ":
      gameState.input.jump = false;
      break;

    case "shift":
      gameState.input.slide = false;
      break;
  }
}

function handleBlur() {
  gameState.input.left = false;
  gameState.input.right = false;
  gameState.input.jump = false;
  gameState.input.slide = false;
  gameState.input.accelerate = false;
  gameState.input.brake = false;
}

export function startAccelerate() {
  gameState.input.accelerate = true;
}

export function stopAccelerate() {
  gameState.input.accelerate = false;
}

export function startBrake() {
  gameState.input.brake = true;
}

export function stopBrake() {
  gameState.input.brake = false;
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
  stopBrake
};
