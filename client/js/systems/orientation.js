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

  // Attempt screen orientation lock (supported in Android Chrome, Samsung, Capacitor/Cordova, PWAs)
  try {
    if (screen.orientation && typeof screen.orientation.lock === "function") {
      await screen.orientation.lock("landscape").catch(() => {});
    }
  } catch (_) {}

  // On mobile touch devices, attempt fullscreen to permit landscape locking and remove browser URL chrome
  try {
    const isMobile = window.innerWidth <= 1024 || isTouchDevice();
    if (isMobile && !document.fullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen().catch(() => {});
      }
      if (screen.orientation && typeof screen.orientation.lock === "function") {
        await screen.orientation.lock("landscape").catch(() => {});
      }
    }
  } catch (_) {}

  checkOrientationPrompt();
}

export function releaseOrientationLock() {
  isGameActive = false;
  document.body.classList.remove("in-game");

  try {
    if (screen.orientation && typeof screen.orientation.unlock === "function") {
      screen.orientation.unlock().catch(() => {});
    }
  } catch (_) {}

  checkOrientationPrompt();
}

export function checkOrientationPrompt() {
  const overlay = document.getElementById("rotateOverlay");
  if (!overlay) return;

  if (!isGameActive) {
    overlay.hidden = true;
    overlay.style.display = "none";
    return;
  }

  const portrait = isPortrait();
  const isMobile = window.innerWidth <= 960 || isTouchDevice();

  if (!portrait || !isMobile || userDismissedRotate) {
    overlay.hidden = true;
    overlay.style.display = "none";
  } else {
    overlay.hidden = false;
    overlay.style.display = "flex";
  }
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
