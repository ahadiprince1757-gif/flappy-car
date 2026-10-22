import { gameState } from "../core/gameState.js";

let hudRoot = null;
let lastHudUpdate = 0;

function formatNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();
}

function getElement(id) {
  return hudRoot?.querySelector(`#${id}`) ?? null;
}

export function initializeHUD() {
  hudRoot = document.getElementById("ui");
  if (!hudRoot) {
    console.error('HUD initialization failed: missing element "#ui".');
    return;
  }

  hudRoot.innerHTML = `
    <div class="hud-top">
      <div class="hud-stat">
        <span class="hud-label">SCORE</span>
        <strong id="hudScore">0</strong>
      </div>

      <div class="hud-stat">
        <span class="hud-label">SPEED</span>
        <strong id="hudSpeed">0 MPH</strong>
      </div>
    </div>

    <div class="hud-progress">
      <div class="hud-progress-heading">
        <span id="hudMode">ADVENTURE</span>
        <span id="hudDistance">0 m</span>
      </div>

      <div class="hud-progress-track">
        <div id="hudProgressFill" class="hud-progress-fill"></div>
      </div>

      <div id="hudRaceDetails" class="hud-race-details" hidden>
        <span id="hudLives">❤️ 3</span>
        <span id="hudRaceObjective">0%</span>
        <span id="hudRaceTime">0s</span>
      </div>
    </div>

    <div id="hudMessage" class="hud-message" role="status" aria-live="polite" hidden></div>
  `;

  lastHudUpdate = 0;
  updateHUD(true);
}

export function updateHUD(force = false) {
  if (!hudRoot || !hudRoot.isConnected) return;

  const now = performance.now();
  if (!force && now - lastHudUpdate < 80) return;

  lastHudUpdate = now;

  const score = getElement("hudScore");
  const speed = getElement("hudSpeed");
  const distance = getElement("hudDistance");
  const mode = getElement("hudMode");
  const progressFill = getElement("hudProgressFill");
  const raceDetails = getElement("hudRaceDetails");
  const lives = getElement("hudLives");
  const objective = getElement("hudRaceObjective");
  const raceTime = getElement("hudRaceTime");

  if (score) score.textContent = formatNumber(gameState.score);
  if (speed) speed.textContent = `${formatNumber(gameState.speed)} MPH`;
  if (distance) distance.textContent = `${formatNumber(gameState.distance)} m`;

  const isRacing = gameState.gameMode === "racing";
  const race = gameState.race;

  if (mode) {
    mode.textContent = isRacing
      ? `RACING · LEVEL ${gameState.currentLevel}`
      : "ADVENTURE";
  }

  if (raceDetails) {
    raceDetails.hidden = !isRacing || !race;
  }

  if (isRacing && race) {
    const distanceTarget = Number(race.level?.distance) || 1;
    const distancePercent = Math.min(
      100,
      (gameState.distance / distanceTarget) * 100
    );

    if (progressFill) {
      progressFill.style.width = `${distancePercent}%`;
    }

    if (lives) {
      lives.textContent = `❤️ ${Math.max(0, race.lives || 0)}`;
    }

    if (objective) {
      objective.textContent = `${Math.floor(distancePercent)}% REACHED`;
    }

    if (raceTime) {
      const limit = Number(race.level?.timeLimit) || 0;
      const remaining = Math.max(0, Math.ceil(limit - (race.elapsedTime || 0)));
      raceTime.textContent = `⏱️ ${remaining}s`;
    }
  } else {
    if (progressFill) progressFill.style.width = "0%";
  }
}

export function showHUDMessage(message) {
  if (!hudRoot) return;

  const messageElement = getElement("hudMessage");
  if (!messageElement) return;

  messageElement.textContent = String(message);
  messageElement.hidden = false;
}

export function hideHUDMessage() {
  const messageElement = getElement("hudMessage");
  if (messageElement) {
    messageElement.hidden = true;
    messageElement.textContent = "";
  }
}

export function destroyHUD() {
  if (hudRoot) hudRoot.replaceChildren();
  hudRoot = null;
  lastHudUpdate = 0;
}
