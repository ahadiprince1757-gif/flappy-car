import { gameState } from "./gameState.js";
import { PerformanceMonitor } from "./perfMonitor.js";

/* ================================================================
   ADAPTIVE GRAPHICS QUALITY MANAGER
   Automatically protects 60 FPS on mobile & low-end devices without
   mutating active road geometry:
   - Presets: high | medium | low (plus auto mode)
   - Controls: internal pixel resolution scale, shadows, traffic cap,
     and 4-tier LOD distance.
================================================================ */

export const QUALITY_PRESETS = {
  high:   { name: "high",   resScale: 1.0, shadows: true,  trafficCap: 24, lodFar: 170 },
  medium: { name: "medium", resScale: 0.8, shadows: false, trafficCap: 14, lodFar: 130 },
  low:    { name: "low",    resScale: 0.6, shadows: false, trafficCap: 8,  lodFar: 98  }
};

class QualityManagerClass {
  constructor() {
    this.mode = "auto"; // "auto" | "high" | "medium" | "low"
    const isMobile = typeof window !== "undefined" && (
      window.innerWidth <= 1024 ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
    );
    this.activeTier = isMobile ? "medium" : "high";
    this.lowFpsTimer = 0;
    this.highFpsTimer = 0;
  }

  getPreset() {
    return QUALITY_PRESETS[this.activeTier] || QUALITY_PRESETS.medium;
  }

  setMode(mode) {
    if (mode === "auto") {
      this.mode = "auto";
      return;
    }
    if (QUALITY_PRESETS[mode]) {
      this.mode = mode;
      this.applyTier(mode);
    }
  }

  applyTier(tierName) {
    const preset = QUALITY_PRESETS[tierName];
    if (!preset) return;
    this.activeTier = tierName;

    const renderer = gameState.renderer;
    if (renderer) {
      const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(Math.max(0.6, baseDpr * preset.resScale));
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = preset.shadows;
      }
    }

    gameState.qualityPreset = preset;
  }

  update(deltaTime) {
    if (this.mode !== "auto" || gameState.status !== "playing") return;

    const fps = PerformanceMonitor.fps || 60;

    // Step down smoothly if FPS stays below 50 for 3 seconds
    if (fps < 50) {
      this.lowFpsTimer += deltaTime;
      this.highFpsTimer = 0;
      if (this.lowFpsTimer >= 3.0) {
        this.lowFpsTimer = 0;
        if (this.activeTier === "high") this.applyTier("medium");
        else if (this.activeTier === "medium") this.applyTier("low");
      }
    } else if (fps >= 58) {
      // Gently step back up if device sustains smooth 58+ FPS for 8 seconds
      this.highFpsTimer += deltaTime;
      this.lowFpsTimer = 0;
      if (this.highFpsTimer >= 8.0) {
        this.highFpsTimer = 0;
        if (this.activeTier === "low") this.applyTier("medium");
      }
    } else {
      this.lowFpsTimer = Math.max(0, this.lowFpsTimer - deltaTime * 0.5);
    }
  }
}

export const QualityManager = new QualityManagerClass();
