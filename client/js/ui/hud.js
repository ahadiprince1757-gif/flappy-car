import { gameState } from "../core/gameState.js";

let hudRoot = null;
let lastHudUpdate = 0;
let _nearMissTimeout = null;

// Cached DOM element references (eliminates per-tick querySelector calls)
let _elNitroBtn = null;
let _elNearMiss = null;
let _elNearMissCombo = null;
let _elNearMissBonus = null;
let _elMessage = null;

// Dirty-check state to skip redundant DOM style/text writes
let _lastNitroPercent = -1;
let _lastNitroDraining = null;

export function initializeHUD() {
  hudRoot = document.getElementById("ui");
  if (!hudRoot) {
    console.error('HUD initialization failed: missing element "#ui".');
    return;
  }

  // Ultra-clean unobstructed viewport HUD — no top stats bar & no nitro percentage bar
  hudRoot.innerHTML = `
    <!-- Near Miss Stunt Combo Popup -->
    <div id="hudNearMiss" class="hud-near-miss-card" hidden>
      <span class="near-miss-glow">⚡</span>
      <span class="near-miss-title">NEAR MISS!</span>
      <strong class="near-miss-combo" id="hudNearMissCombo">x2</strong>
      <span class="near-miss-bonus" id="hudNearMissBonus">+150</span>
    </div>

    <div id="hudMessage" class="hud-message" role="status" aria-live="polite" hidden></div>
  `;

  // Cache live DOM references once (including the self-filling cockpit NITRO button)
  _elNitroBtn = document.getElementById("nitroBtn");
  _elNearMiss = hudRoot.querySelector("#hudNearMiss");
  _elNearMissCombo = hudRoot.querySelector("#hudNearMissCombo");
  _elNearMissBonus = hudRoot.querySelector("#hudNearMissBonus");
  _elMessage = hudRoot.querySelector("#hudMessage");
  _lastNitroPercent = -1;
  _lastNitroDraining = null;

  window.addEventListener("flappycar:near-miss", handleNearMissEvent);

  lastHudUpdate = 0;
  updateHUD(true);
}

function handleNearMissEvent(event) {
  const popup = _elNearMiss;
  if (!popup) return;

  const { bonus, multiplier } = event.detail || {};

  if (_elNearMissCombo) _elNearMissCombo.textContent = multiplier > 1 ? `x${multiplier}` : `STUNT!`;
  if (_elNearMissBonus) _elNearMissBonus.textContent = `+${bonus || 75}`;

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
  if (!force && now - lastHudUpdate < 50) return;

  lastHudUpdate = now;

  // Auto-calibrating self-filling gauge directly inside the NITRO button
  if (!_elNitroBtn) {
    _elNitroBtn = document.getElementById("nitroBtn");
  }

  if (_elNitroBtn) {
    const nitroRatio = Math.max(0, Math.min(1, gameState.nitro ?? 1));
    const nitroPercent = Math.round(nitroRatio * 100);
    const isDraining = Boolean(gameState.nitroDraining);

    if (force || nitroPercent !== _lastNitroPercent) {
      _lastNitroPercent = nitroPercent;
      _elNitroBtn.style.setProperty("--nitro-fill", `${nitroPercent}%`);
      _elNitroBtn.classList.toggle("nitro-ready", nitroPercent >= 98 && !isDraining);
      _elNitroBtn.classList.toggle("nitro-empty", nitroPercent <= 2);
    }

    if (force || isDraining !== _lastNitroDraining) {
      _lastNitroDraining = isDraining;
      _elNitroBtn.classList.toggle("nitro-draining", isDraining);
    }
  }
}

let _msgTimer = null;

export function showHUDMessage(message) {
  if (!_elMessage) return;

  if (_msgTimer) { clearTimeout(_msgTimer); _msgTimer = null; }

  _elMessage.textContent = String(message);
  _elMessage.hidden = false;

  // Auto-hide after 1.5 seconds
  _msgTimer = setTimeout(() => {
    if (_elMessage) {
      _elMessage.hidden = true;
      _elMessage.textContent = "";
    }
    _msgTimer = null;
  }, 1500);
}

export function hideHUDMessage() {
  if (_msgTimer) { clearTimeout(_msgTimer); _msgTimer = null; }
  if (_elMessage) {
    _elMessage.hidden = true;
    _elMessage.textContent = "";
  }
}

export function destroyHUD() {
  window.removeEventListener("flappycar:near-miss", handleNearMissEvent);
  if (hudRoot) hudRoot.replaceChildren();
  hudRoot = null;
  _elNitroBtn = null;
  _elNearMiss = null;
  _elNearMissCombo = null;
  _elNearMissBonus = null;
  _elMessage = null;
  _lastNitroPercent = -1;
  _lastNitroDraining = null;
  lastHudUpdate = 0;
}
