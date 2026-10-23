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

  element.addEventListener("click", callback);
  element.dataset.menuBound = "true";
}

export function showHomeScreen() {
  stopCarSelectViewer();
  show(byId("homeScreen"));
  hide(byId("carSelectScreen"));
  hide(byId("trackSelectScreen"));
  hide(byId("leaderboardScreen"));
  hide(byId("pauseMenu"));
  hide(byId("settingsModal"));
}

export function showCarSelectScreen() {
  hide(byId("homeScreen"));
  hide(byId("trackSelectScreen"));
  hide(byId("leaderboardScreen"));
  hide(byId("pauseMenu"));
  hide(byId("settingsModal"));
  show(byId("carSelectScreen"));

  renderCarSelectionScreen();
  // Small delay to allow element dimensions to settle before initializing Three.js canvas
  requestAnimationFrame(() => {
    initCarSelectViewer();
  });
}

export function showTrackSelectScreen() {
  stopCarSelectViewer();
  hide(byId("homeScreen"));
  hide(byId("carSelectScreen"));
  hide(byId("leaderboardScreen"));
  hide(byId("pauseMenu"));
  hide(byId("settingsModal"));
  show(byId("trackSelectScreen"));

  renderTrackSelectionScreen();
}

export function showLeaderboardScreen() {
  stopCarSelectViewer();
  hide(byId("homeScreen"));
  hide(byId("carSelectScreen"));
  hide(byId("trackSelectScreen"));
  hide(byId("pauseMenu"));
  hide(byId("settingsModal"));
  show(byId("leaderboardScreen"));

  renderLeaderboard();
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
