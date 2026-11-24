import { ObjectManager } from "./objectPool.js";
import { gameState } from "./gameState.js";

class PerformanceMonitorClass {
  constructor() {
    this.container = null;
    this.fpsText = null;
    this.objText = null;
    this.detailText = null;

    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fps = 60;
    this.enabled = false; // Disabled by default so no overlay shows on top
  }

  init() {
    if (this.container || typeof document === "undefined") return;

    this.container = document.createElement("div");
    this.container.id = "perfMonitor";
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      z-index: 9999;
      pointer-events: none;
      line-height: 1.4;
      display: ${this.enabled ? "block" : "none"};
      min-width: 170px;
    `;

    this.fpsText = document.createElement("div");
    this.fpsText.style.fontWeight = "bold";

    this.objText = document.createElement("div");
    this.objText.style.marginTop = "4px";

    this.detailText = document.createElement("div");
    this.detailText.style.fontSize = "10px";
    this.detailText.style.color = "#94a3b8";
    this.detailText.style.marginTop = "4px";

    this.container.appendChild(this.fpsText);
    this.container.appendChild(this.objText);
    this.container.appendChild(this.detailText);

    document.body.appendChild(this.container);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.container) {
      this.container.style.display = this.enabled ? "block" : "none";
    }
  }

  update() {
    if (!this.enabled) return;

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      if (!this.container) {
        this.init();
      }

      const stats = ObjectManager.getStats();
      const obstacles = gameState.obstacles?.length || 0;
      const coins = gameState.collectibles?.length || 0;
      const effects = gameState.effects?.length || 0;
      const traffic = gameState.opponents?.length || 0;

      const activeTotal = obstacles + coins + effects + traffic;

      // Color code FPS
      const fpsColor = this.fps >= 55 ? "#4ade80" : this.fps >= 35 ? "#facc15" : "#f87171";
      this.fpsText.innerHTML = `FPS: <span style="color:${fpsColor}">${this.fps}</span> (Target: 60)`;
      this.objText.innerHTML = `Active Entities: <b>${activeTotal}</b>`;
      this.detailText.innerHTML = `Obs: ${obstacles} | Coins: ${coins}<br>FX: ${effects} | Traffic: ${traffic}`;
    }
  }
}

export const PerformanceMonitor = new PerformanceMonitorClass();
