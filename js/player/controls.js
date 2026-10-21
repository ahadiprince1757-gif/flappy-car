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
    "s"
  ];

  if (controlledKeys.includes(key)) {
    event.preventDefault();
  }

  if (event.repeat) return;
  if (gameState.status !== "playing") return;

  switch (key) {
    case "arrowleft":
    case "a":
      gameState.input.left = true;
      moveLeft();
      break;

    case "arrowright":
    case "d":
      gameState.input.right = true;
      moveRight();
      break;

    case "arrowup":
    case "w":
    case " ":
      gameState.input.jump = true;
      jump();
      break;

    case "arrowdown":
    case "s":
      gameState.input.slide = true;
      slide();
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
    case " ":
      gameState.input.jump = false;
      break;

    case "arrowdown":
    case "s":
      gameState.input.slide = false;
      break;
  }
}

function handleBlur() {
  gameState.input.left = false;
  gameState.input.right = false;
  gameState.input.jump = false;
  gameState.input.slide = false;
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
  slide
};
