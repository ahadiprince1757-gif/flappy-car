import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { getCarConfig } from "./cars.js";
import { spawnCarModel, tintCarBody } from "./carModelLoader.js";

/*
  Car Renderer — FBX models ONLY.
  No procedural / box-car fallback exists here.
  If the FBX hasn't loaded yet, createCarModel returns null.
*/

/**
 * Build and return the real FBX car group for carId.
 * Returns null if the model isn't cached yet (call again after preloadCarModels finishes).
 */
export function createCarModel(carId = "cyber") {
  const config = getCarConfig(carId);
  const model = spawnCarModel(carId, { bodyColor: config.bodyColor });

  if (!model) {
    console.warn(`[CarRenderer] FBX model not ready for "${carId}" — will retry after load.`);
    return null;
  }

  /* ── Neon underglow point light ── */
  const glow = new THREE.PointLight(config.accentColor || "#38bdf8", 1.4, 6.0);
  glow.position.set(0, 0.15, 0);
  model.add(glow);

  /* ── Rocket thruster VFX (hidden until jump) ── */
  const thrusters = _buildThrusters(config.accentColor || "#ff5500");
  model.add(thrusters.group);

  model.userData.originalScale  = model.scale.clone();
  model.userData.rocketThrusters = thrusters;
  model.userData.carId  = config.id;
  model.userData.config = config;
  model.name = `car-${config.id}`;

  return model;
}

/* ── Simple rocket-thruster VFX ───────────────────────────────── */
function _buildThrusters(accentColor) {
  const g = new THREE.Group();
  g.name    = "rocket-thrusters";
  g.visible = false;

  const plumeMat = new THREE.MeshStandardMaterial({
    color: "#ff3700",
    emissive: "#ff5500",
    emissiveIntensity: 4.8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.88,
  });

  const flames = [];
  const positions = [[-0.42, 0.15, -0.45], [0.42, 0.15, -0.45],
                     [-0.42, 0.15,  0.75], [0.42, 0.15,  0.75]];

  for (const [tx, ty, tz] of positions) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.80, 8), plumeMat);
    plume.rotation.x = Math.PI;
    plume.position.set(tx, ty - 0.40, tz);
    g.add(plume);
    flames.push(plume);
  }

  const light = new THREE.PointLight("#ff6600", 0, 7.5, 2);
  light.position.set(0, 0.05, 0.15);
  g.add(light);

  return { group: g, light, flames };
}

/* ── Re-colour car body (used by garage) ─────────────────────── */
export function setCarColor(car, color) {
  if (!car) return;
  tintCarBody(car, color);
}
