import { getAllRacingLevels } from "../racing/racingLevels.js";
import { getUnlockedRacingLevels } from "../racing/racing.js";
import { renderGarage } from "../cars/garage.js";
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

  // touch-action:manipulation in CSS removes 300ms tap delay,
  // so click is instant and safe — pointerdown + preventDefault breaks focus/capture
  element.addEventListener("click", callback);
  element.dataset.menuBound = "true";
}

export function showHomeScreen() {
  show(byId("homeScreen"));
  hide(byId("garageScreen"));
  hide(byId("levelSelectScreen"));
  hide(byId("leaderboardScreen"));
  hide(byId("pauseMenu"));
}

export function showLevelSelect() {
  hide(byId("homeScreen"));
  hide(byId("garageScreen"));
  hide(byId("leaderboardScreen"));
  hide(byId("pauseMenu"));
  show(byId("levelSelectScreen"));

  renderRacingLevels();
}

export function showGarageScreen() {
  hide(byId("homeScreen"));
  hide(byId("levelSelectScreen"));
  hide(byId("leaderboardScreen"));
  hide(byId("pauseMenu"));
  show(byId("garageScreen"));

  renderGarage();
}

export function showLeaderboardScreen() {
  hide(byId("homeScreen"));
  hide(byId("garageScreen"));
  hide(byId("levelSelectScreen"));
  hide(byId("pauseMenu"));
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

export function renderRacingLevels() {
  const container = byId("levelsContainer");
  if (!container) return;

  const levels = getAllRacingLevels();
  const unlockedInfo = getUnlockedRacingLevels();
  const unlockedLevels = new Set(unlockedInfo.unlockedLevels);
  const completedLevels = new Set(unlockedInfo.completedLevels);

  container.replaceChildren();

  for (const level of levels) {
    const unlocked = unlockedLevels.has(level.id);
    const completed = completedLevels.has(level.id);

    const card = document.createElement("article");
    card.className = `level-card ${completed ? "completed" : unlocked ? "unlocked" : "locked"}`;

    const topRow = document.createElement("div");
    topRow.className = "card-top-row";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = `${String(level.id).padStart(2, "0")} · ${level.name}`;

    const badge = document.createElement("span");
    badge.className = `badge-tag ${completed ? "equipped" : "owned"}`;
    badge.textContent = completed ? "COMPLETED ⭐" : unlocked ? "READY" : "LOCKED 🔒";

    topRow.append(title, badge);

    const desc = document.createElement("p");
    desc.className = "section-desc";
    desc.textContent = level.description;

    const infoRow = document.createElement("div");
    infoRow.className = "level-info-row";
    infoRow.innerHTML = `
      <div>🏁 ${level.distance}m</div>
      <div>⏱️ ${level.timeLimit}s</div>
      <div>❤️ ${level.lives} Lives</div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `menuBtn ${completed ? "secondary-action-btn" : "primary-action-btn"}`;
    button.textContent = completed ? "REPLAY STAGE" : "START CIRCUIT";
    button.disabled = !unlocked;

    if (unlocked) {
      button.addEventListener("click", () => {
        callbacks.onStartRace?.(level.id);
      });
    }

    card.append(topRow, desc, infoRow, button);
    container.append(card);
  }
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

  if (bound) {
    renderRacingLevels();
    return;
  }

  bound = true;

  bindClick("adventureBtn", () => {
    callbacks.onStartAdventure?.();
  });

  bindClick("racingBtn", () => {
    showLevelSelect();
  });

  bindClick("garageBtn", () => {
    showGarageScreen();
  });

  bindClick("leaderboardBtn", () => {
    showLeaderboardScreen();
  });



  bindClick("settingsBtn", () => {
    showSettingsModal();
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

  bindClick("backBtn", () => {
    showHomeScreen();
  });

  bindClick("backFromLevelsBtn", () => {
    showHomeScreen();
  });

  bindClick("backFromLeaderboardBtn", () => {
    showHomeScreen();
  });

  renderRacingLevels();
}
