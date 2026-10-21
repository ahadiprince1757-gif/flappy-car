import { getAllRacingLevels } from "../racing/racingLevels.js";
import { getUnlockedRacingLevels } from "../racing/racing.js";
import { renderGarage } from "../cars/garage.js";
import { toggleMute, isMuted } from "../systems/audio.js";
import { showHUDMessage } from "./hud.js";

let callbacks = {};
let bound = false;

function byId(id) {
  return document.getElementById(id);
}

function show(element) {
  if (element) element.hidden = false;
}

function hide(element) {
  if (element) element.hidden = true;
}

function bindClick(id, callback) {
  const element = byId(id);
  if (!element || element.dataset.menuBound === "true") return;

  // pointerdown fires ~300ms before click — instant feel
  element.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    callback(e);
  });
  element.dataset.menuBound = "true";
}

export function showHomeScreen() {
  show(byId("homeScreen"));
  hide(byId("garageScreen"));
  hide(byId("levelSelectScreen"));
  hide(byId("pauseMenu"));
}

export function showLevelSelect() {
  hide(byId("homeScreen"));
  hide(byId("garageScreen"));
  hide(byId("pauseMenu"));
  show(byId("levelSelectScreen"));

  renderRacingLevels();
}

export function showGarageScreen() {
  hide(byId("homeScreen"));
  hide(byId("levelSelectScreen"));
  hide(byId("pauseMenu"));
  show(byId("garageScreen"));

  renderGarage();
}

export function showPauseMenu() {
  show(byId("pauseMenu"));
}

export function hidePauseMenu() {
  hide(byId("pauseMenu"));
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

  bindClick("settingsBtn", () => {
    toggleMute();
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

  renderRacingLevels();
}
