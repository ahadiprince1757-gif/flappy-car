import { getAllRacingLevels } from "../racing/racingLevels.js";
import { getUnlockedRacingLevels } from "../racing/racing.js";
import {
  renderCarSelectionScreen,
  renderTrackSelectionScreen,
  initCarSelectViewer,
  stopCarSelectViewer
} from "../cars/garage.js";
import { toggleMute, isMuted, updateMusicUI } from "../systems/audio.js";
import { showHUDMessage } from "./hud.js";
import { fetchLeaderboard } from "../services/api.js";

let callbacks = {};
let bound = false;

function byId(id) {
  return document.getElementById(id);
}

function show(element) {
  if (element) {
    element.hidden = false;
    element.style.display = "";
  }
}

function hide(element) {
  if (element) {
    element.hidden = true;
    element.style.display = "none";
  }
}

function bindClick(id, callback) {
  const element = byId(id);
  if (!element || element.dataset.menuBound === "true") return;

  // touchstart fires immediately (no 300ms delay).
  // We set a flag so the browser-generated 'click' event that follows is ignored,
  // preventing the callback from running twice.
  let wasTouched = false;

  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    wasTouched = true;
    callback();
  }, { passive: false });

  element.addEventListener("click", () => {
    if (wasTouched) {
      wasTouched = false;
      return; // already handled by touchstart
    }
    callback();
  });

  element.dataset.menuBound = "true";
}

let isTransitioning = false;

function transitionToScreen(targetScreenId, prepareFn) {
  const target = byId(targetScreenId);
  if (!target) return;

  const screens = [
    byId("homeScreen"),
    byId("carSelectScreen"),
    byId("trackSelectScreen"),
    byId("leaderboardScreen"),
    byId("levelSelectScreen")
  ].filter(Boolean);

  // Always close modal overlays
  hide(byId("pauseMenu"));
  hide(byId("settingsModal"));

  const current = screens.find(el => !el.hidden && el.style.display !== "none" && el.id !== targetScreenId);

  if (current && !isTransitioning) {
    isTransitioning = true;
    current.classList.add("screen-fade-out");

    setTimeout(() => {
      screens.forEach(s => {
        if (s !== target) {
          hide(s);
          s.classList.remove("screen-fade-out");
        }
      });
      show(target);
      if (prepareFn) prepareFn();
      isTransitioning = false;
    }, 150);
  } else {
    screens.forEach(s => {
      if (s !== target) hide(s);
    });
    show(target);
    if (prepareFn) prepareFn();
  }
}

export function showHomeScreen() {
  stopCarSelectViewer();
  transitionToScreen("homeScreen");
}

export function showCarSelectScreen() {
  transitionToScreen("carSelectScreen", () => {
    renderCarSelectionScreen();
    // Small delay to allow element dimensions to settle before initializing Three.js canvas
    requestAnimationFrame(() => {
      initCarSelectViewer();
    });
  });
}

export function showTrackSelectScreen() {
  stopCarSelectViewer();
  transitionToScreen("trackSelectScreen", () => {
    renderTrackSelectionScreen();
  });
}

export function showLeaderboardScreen() {
  stopCarSelectViewer();
  transitionToScreen("leaderboardScreen", () => {
    renderLeaderboard();
  });
}

export function showPauseMenu() {
  show(byId("pauseMenu"));
}

export function hidePauseMenu() {
  hide(byId("pauseMenu"));
}

export function showSettingsModal() {
  updateMusicUI();
  show(byId("settingsModal"));
}

export function hideSettingsModal() {
  hide(byId("settingsModal"));
}

export async function renderLeaderboard() {
  const container = byId("leaderboardList");
  if (!container) return;

  container.innerHTML = `<div class="leaderboard-loading">Loading top racers...</div>`;

  const scores = await fetchLeaderboard();

  if (!scores || scores.length === 0) {
    container.innerHTML = `<div class="leaderboard-empty">No scores recorded yet. Be the first to conquer the highway!</div>`;
    return;
  }

  container.innerHTML = "";
  scores.forEach((entry, idx) => {
    const row = document.createElement("div");
    row.className = `leaderboard-row ${idx < 3 ? `top-${idx + 1}` : ""}`;

    const rankBadge = idx === 0 ? "🥇 1ST" : idx === 1 ? "🥈 2ND" : idx === 2 ? "🥉 3RD" : `#${idx + 1}`;

    row.innerHTML = `
      <div class="lb-rank">${rankBadge}</div>
      <div class="lb-player">
        <span class="lb-name">${entry.playerName || "Driver"}</span>
        <span class="lb-car">${(entry.carId || "cyber").toUpperCase()}</span>
      </div>
      <div class="lb-dist">${Math.floor(entry.distance || 0)}m</div>
      <div class="lb-score">${Number(entry.score || 0).toLocaleString()} PTS</div>
    `;
    container.append(row);
  });
}

export function initializeMenus(options = {}) {
  callbacks = options;

  if (bound) return;
  bound = true;

  // Home Screen: PLAY -> Goes to Car Select Screen (Step 1)
  bindClick("adventureBtn", () => {
    showCarSelectScreen();
  });

  // Home Screen: LEADERBOARD -> Goes to Hall of Fame
  bindClick("leaderboardBtn", () => {
    showLeaderboardScreen();
  });

  // Step 1: Car Select Screen -> Back to Home
  bindClick("backFromCarSelectBtn", () => {
    showHomeScreen();
  });

  // Step 1: Car Select Screen -> Confirm & Proceed to Track Select (Step 2)
  bindClick("confirmCarBtn", () => {
    showTrackSelectScreen();
  });

  // Step 2: Track Select Screen -> Back to Car Select
  bindClick("backFromTrackSelectBtn", () => {
    showCarSelectScreen();
  });

  // Step 2: Track Select Screen -> Start Race with chosen car & track!
  bindClick("startRaceWithTrackBtn", () => {
    stopCarSelectViewer();
    callbacks.onStartAdventure?.();
  });

  // Hall of Fame: Back to Home
  bindClick("backFromLeaderboardBtn", () => {
    showHomeScreen();
  });

  // In-Game Settings Button & Pause Menu Settings
  bindClick("inGameSettingsBtn", () => {
    callbacks.onOpenInGameSettings?.();
  });

  bindClick("pauseSettingsBtn", () => {
    showSettingsModal();
  });

  bindClick("closeSettingsBtn", () => {
    hideSettingsModal();
  });

  bindClick("mixerMuteToggle", () => {
    toggleMute();
    updateMusicUI();
    const muted = isMuted();
    const muteBtn = byId("muteBtn");
    if (muteBtn) {
      muteBtn.style.opacity = muted ? "0.5" : "1";
    }
    showHUDMessage(muted ? "Sound Muted" : "Sound Enabled");
  });
}
