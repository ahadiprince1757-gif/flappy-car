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
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.frameTimeMs = 16.6;
    this.maxFrameTimeMs = 0;
    this.enabled = false; // Disabled by default, press F3 or P to toggle
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
    const frameNow = performance.now();
    const frameDelta = frameNow - this.lastFrameTime;
    this.lastFrameTime = frameNow;
    this.frameTimeMs = frameDelta;
    if (frameDelta > this.maxFrameTimeMs && this.frameCount > 10) {
      this.maxFrameTimeMs = Math.round(frameDelta * 10) / 10;
    }

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

      const obstacles = gameState.obstacles?.length || 0;
      const coins = gameState.collectibles?.length || 0;
      const effects = gameState.effects?.length || 0;
      const traffic = gameState.opponents?.length || 0;
      const activeTotal = obstacles + coins + effects + traffic;

      // Three.js renderer stats
      const renderInfo = gameState.renderer?.info?.render;
      const drawCalls = renderInfo?.calls ?? 0;
      const triangles = renderInfo?.triangles ?? 0;

      // JS Heap if supported by browser
      const memory = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      const memText = memory !== null ? ` | Heap: ${memory}MB` : "";

      // Color code FPS
      const fpsColor = this.fps >= 55 ? "#4ade80" : this.fps >= 35 ? "#facc15" : "#f87171";
      this.fpsText.innerHTML = `FPS: <span style="color:${fpsColor}">${this.fps}</span> (${this.frameTimeMs.toFixed(1)}ms | Peak: ${this.maxFrameTimeMs}ms)`;
      this.objText.innerHTML = `Calls: <b>${drawCalls}</b> | Tris: <b>${triangles}</b>${memText}`;
      this.detailText.innerHTML = `Traffic: ${traffic} | Entities: ${activeTotal}`;
    }
  }

  getBaselineSnapshot() {
    const renderInfo = gameState.renderer?.info?.render;
    const memory = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return {
      fps: this.fps,
      frameTimeMs: this.frameTimeMs,
      maxFrameTimeMs: this.maxFrameTimeMs,
      drawCalls: renderInfo?.calls ?? 0,
      triangles: renderInfo?.triangles ?? 0,
      heapMB: memory,
      activeEntities: (gameState.obstacles?.length || 0) + (gameState.collectibles?.length || 0) + (gameState.effects?.length || 0) + (gameState.opponents?.length || 0)
    };
  }
}

export const PerformanceMonitor = new PerformanceMonitorClass();
