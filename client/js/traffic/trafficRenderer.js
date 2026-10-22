import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { spawnCarModel } from "../cars/carModelLoader.js";

/*
 * TRAFFIC CAR RENDERER — FBX ONLY
 *
 * Uses the same real FBX models as the player car.
 * All 7 car types cycle through as traffic:
 *   Cop, Taxi, SUV, NormalCar1 (sedan), NormalCar2 (hatchback),
 *   SportsCar, SportsCar2
 *
 * Returns null if FBX cache isn't ready yet — caller handles retry.
 */

// Model keys from carModelLoader.js + their accent/glow colours
const TRAFFIC_VARIANTS = [
  { key: "taxi",      glow: "#eab308" },   // NYC cab — yellow
  { key: "cop",       glow: "#2563eb" },   // Police — blue
  { key: "suv",       glow: "#38bdf8" },   // SUV     — sky
  { key: "sedan",     glow: "#60a5fa" },   // Sedan   — blue
  { key: "hatchback", glow: "#c084fc" },   // Hatch   — purple
  { key: "sport",     glow: "#34d399" },   // Sports  — green
  { key: "sport2",    glow: "#f87171" },   // Muscle  — red
];

let _variantIdx = 0;

/**
 * Build one traffic car from the FBX cache.
 * @returns {THREE.Group|null} The car group, or null if FBX not ready yet.
 */
export function buildTrafficCar() {
  const variant  = TRAFFIC_VARIANTS[_variantIdx % TRAFFIC_VARIANTS.length];
  _variantIdx++;

  const model = spawnCarModel(variant.key);
  if (!model) return null;  // FBX not ready — caller must retry

  // Neon underglow light
  const glow = new THREE.PointLight(variant.glow, 0.9, 5.0);
  glow.position.set(0, 0.15, 0);
  model.add(glow);

  model.userData.trafficCar  = true;
  model.userData.bodyType    = variant.key;
  model.userData.glowColor   = variant.glow;
  model.userData.bodyLength  = 4.2;   // used by collision system

  return model;
}
