/**
 * Screen orientation manager for Flappy Car 3D
 * - Landing screen in Portrait mode for mobile phones
 * - Seamless Landscape mode for gameplay with auto-lock & rotate prompts
 */

let userDismissedRotate = false;
let isGameActive = false;

export function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

export async function requestLandscapeOrientation() {
  userDismissedRotate = false;
  isGameActive = true;
  document.body.classList.add("in-game");

  // Keep orientation handling non-intrusive: let the player tilt naturally
  // without jarring forced locks or fullscreen jumps
  checkOrientationPrompt();
}

export function releaseOrientationLock() {
  isGameActive = false;
  document.body.classList.remove("in-game");

  checkOrientationPrompt();
}

export function checkOrientationPrompt() {
  const overlay = document.getElementById("rotateOverlay");
  if (!overlay) return;

  // Never block the user with a forced rotate overlay
  overlay.hidden = true;
  overlay.style.display = "none";
}

export function initOrientation() {
  const dismissBtn = document.getElementById("dismissRotateBtn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      userDismissedRotate = true;
      checkOrientationPrompt();
    });
  }

  window.addEventListener("resize", checkOrientationPrompt);
  window.addEventListener("orientationchange", () => {
    setTimeout(checkOrientationPrompt, 150);
    setTimeout(checkOrientationPrompt, 400);
  });

  if (screen.orientation) {
    screen.orientation.addEventListener("change", checkOrientationPrompt);
  }

  checkOrientationPrompt();
}
