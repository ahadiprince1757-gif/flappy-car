import { resizeRenderer } from "../core/game.js";

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

  // 1. Request physical orientation lock (supported on Android Chrome, Samsung Internet, PWAs)
  try {
    if (screen.orientation && typeof screen.orientation.lock === "function") {
      await screen.orientation.lock("landscape").catch(() => {});
    }
  } catch (_) {}

  // 2. Request fullscreen on mobile to permit orientation lock if browser requires it
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

  // 3. Auto-rotate view into landscape if upright
  checkAutoLandscape();
}

export function releaseOrientationLock() {
  isGameActive = false;
  document.body.classList.remove("in-game");

  checkAutoLandscape();
}

export function checkAutoLandscape() {
  const isMobile = window.innerWidth <= 1024 || isTouchDevice();
  const portrait = isPortrait();

  // ONLY auto-rotate into forced landscape when actually actively driving/playing in-game!
  // In the menus, garage, and stage selection screens, render naturally upright/responsive
  // so the player can select cars and stages without a 90-degree sideways rotated screen.
  if (isMobile && portrait && isGameActive) {
    document.body.classList.add("auto-landscape");
  } else {
    document.body.classList.remove("auto-landscape");
  }

  // Ensure rotate modal does not block the player
  const overlay = document.getElementById("rotateOverlay");
  if (overlay) {
    overlay.hidden = true;
    overlay.style.display = "none";
  }

  setTimeout(() => {
    resizeRenderer();
  }, 60);
}

export function initOrientation() {
  window.addEventListener("resize", checkAutoLandscape);
  window.addEventListener("orientationchange", () => {
    setTimeout(checkAutoLandscape, 100);
    setTimeout(checkAutoLandscape, 300);
  });

  if (screen.orientation) {
    screen.orientation.addEventListener("change", () => {
      setTimeout(checkAutoLandscape, 100);
      setTimeout(checkAutoLandscape, 300);
    });
  }

  checkAutoLandscape();
}
