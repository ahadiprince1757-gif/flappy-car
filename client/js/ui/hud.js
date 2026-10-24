import { gameState } from "../core/gameState.js";
import { getCurrentDifficulty } from "../systems/checkpoints.js";

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

      <div class="hud-stat hud-tier-badge">
        <span class="hud-label">ZONE</span>
        <strong id="hudTierName">CRUISING</strong>
      </div>

      <div class="hud-stat">
        <span class="hud-label">SPEED</span>
        <strong id="hudSpeed">0 MPH</strong>
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
  const tierName = getElement("hudTierName");

  if (score) score.textContent = formatNumber(gameState.score);
  if (speed) speed.textContent = `${formatNumber(gameState.speed)} MPH`;

  const diff = getCurrentDifficulty();
  if (tierName) tierName.textContent = diff.name;
}

let _msgTimer = null;

export function showHUDMessage(message) {
  if (!hudRoot) return;

  const messageElement = getElement("hudMessage");
  if (!messageElement) return;

  // Clear any existing auto-hide timer
  if (_msgTimer) { clearTimeout(_msgTimer); _msgTimer = null; }

  messageElement.textContent = String(message);
  messageElement.hidden = false;

  // Auto-hide after 100ms (0.1 second)
  _msgTimer = setTimeout(() => {
    messageElement.hidden = true;
    messageElement.textContent = "";
    _msgTimer = null;
  }, 100);
}

export function hideHUDMessage() {
  if (_msgTimer) { clearTimeout(_msgTimer); _msgTimer = null; }
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
