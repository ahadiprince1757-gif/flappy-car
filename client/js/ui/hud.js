import { gameState } from "../core/gameState.js";
import { getCurrentDifficulty } from "../systems/checkpoints.js";

let hudRoot = null;
let lastHudUpdate = 0;
let _nearMissTimeout = null;

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

      <div class="hud-stat hud-coins-stat">
        <span class="hud-label">COINS</span>
        <strong id="hudCoins"><span class="hud-coin-icon">$</span> 0</strong>
      </div>

      <div class="hud-stat">
        <span class="hud-label">SPEED</span>
        <strong id="hudSpeed">0 MPH</strong>
      </div>
    </div>

    <!-- Dynamic Nitro Boost Gauge -->
    <div class="hud-nitro-container" id="hudNitroContainer">
      <div class="hud-nitro-labels">
        <span class="hud-nitro-title">NITRO BOOST</span>
        <span class="hud-nitro-pct" id="hudNitroPct">100%</span>
      </div>
      <div class="hud-nitro-track">
        <div class="hud-nitro-bar" id="hudNitroBar" style="width: 100%;"></div>
      </div>
    </div>

    <!-- Near Miss Stunt Combo Popup -->
    <div id="hudNearMiss" class="hud-near-miss-card" hidden>
      <span class="near-miss-glow">⚡</span>
      <span class="near-miss-title">NEAR MISS!</span>
      <strong class="near-miss-combo" id="hudNearMissCombo">x2</strong>
      <span class="near-miss-bonus" id="hudNearMissBonus">+150</span>
    </div>

    <div id="hudMessage" class="hud-message" role="status" aria-live="polite" hidden></div>
  `;

  window.addEventListener("flappycar:near-miss", handleNearMissEvent);

  lastHudUpdate = 0;
  updateHUD(true);
}

function handleNearMissEvent(event) {
  const popup = getElement("hudNearMiss");
  if (!popup) return;

  const { combo, bonus, multiplier } = event.detail || {};
  const comboEl = getElement("hudNearMissCombo");
  const bonusEl = getElement("hudNearMissBonus");

  if (comboEl) comboEl.textContent = multiplier > 1 ? `x${multiplier}` : `STUNT!`;
  if (bonusEl) bonusEl.textContent = `+${bonus || 75}`;

  popup.hidden = false;
  popup.classList.remove("pop-anim");
  void popup.offsetWidth; // trigger reflow for css anim restart
  popup.classList.add("pop-anim");

  if (_nearMissTimeout) clearTimeout(_nearMissTimeout);
  _nearMissTimeout = setTimeout(() => {
    popup.hidden = true;
    popup.classList.remove("pop-anim");
    _nearMissTimeout = null;
  }, 1200);
}

export function updateHUD(force = false) {
  if (!hudRoot || !hudRoot.isConnected) return;

  const now = performance.now();
  if (!force && now - lastHudUpdate < 60) return;

  lastHudUpdate = now;

  const score = getElement("hudScore");
  const speed = getElement("hudSpeed");
  const tierName = getElement("hudTierName");
  const coins = getElement("hudCoins");
  const nitroBar = getElement("hudNitroBar");
  const nitroPct = getElement("hudNitroPct");

  if (score) score.textContent = formatNumber(gameState.score);
  if (speed) speed.textContent = `${formatNumber(gameState.speed * 2.237)} MPH`; // m/s to mph

  const diff = getCurrentDifficulty();
  if (tierName) tierName.textContent = diff.name;

  if (coins) {
    const runCoins = gameState.runCoins || 0;
    coins.innerHTML = `<span class="hud-coin-icon">$</span> ${formatNumber(runCoins)}`;
  }

  // Nitro bar update (0 to 1)
  const nitroRatio = Math.max(0, Math.min(1, gameState.nitro ?? 1));
  const nitroPercent = Math.round(nitroRatio * 100);
  if (nitroBar) {
    nitroBar.style.width = `${nitroPercent}%`;
    nitroBar.classList.toggle("nitro-draining", Boolean(gameState.nitroDraining));
  }
  if (nitroPct) {
    nitroPct.textContent = `${nitroPercent}%`;
  }
}

let _msgTimer = null;

export function showHUDMessage(message) {
  if (!hudRoot) return;

  const messageElement = getElement("hudMessage");
  if (!messageElement) return;

  if (_msgTimer) { clearTimeout(_msgTimer); _msgTimer = null; }

  messageElement.textContent = String(message);
  messageElement.hidden = false;

  // Auto-hide after 1.5 seconds
  _msgTimer = setTimeout(() => {
    messageElement.hidden = true;
    messageElement.textContent = "";
    _msgTimer = null;
  }, 1500);
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
  window.removeEventListener("flappycar:near-miss", handleNearMissEvent);
  if (hudRoot) hudRoot.replaceChildren();
  hudRoot = null;
  lastHudUpdate = 0;
}

