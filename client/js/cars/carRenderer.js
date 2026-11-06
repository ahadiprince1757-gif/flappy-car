import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { getCarConfig } from "./cars.js";
import { spawnCarModel, tintCarBody } from "./carModelLoader.js";

/*
  Car Renderer — FBX Primary with High-Fidelity Low-Poly Arcade Fallback.
  If FBX models are still downloading or parsing, an instant stylish proxy
  mesh is spawned, ensuring zero delay and no invisible vehicle glitches.
*/

export function createLowPolyFallbackCar(config) {
  const group = new THREE.Group();
  group.name = `proxy-car-${config.id}`;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.bodyColor || "#06b6d4"),
    metalness: 0.75,
    roughness: 0.25
  });

  const cabinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.cabinColor || "#0f172a"),
    metalness: 0.9,
    roughness: 0.1
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.8,
    metalness: 0.1
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.9,
    roughness: 0.2
  });

  // 1. Lower Chassis
  const chassisGeo = new THREE.BoxGeometry(1.7, 0.45, 3.8);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.y = 0.45;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Aerodynamic Cabin
  const cabinGeo = new THREE.BoxGeometry(1.35, 0.42, 2.0);
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.85, 0.15);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  group.add(cabin);

  // 3. Front Headlights
  const headGeo = new THREE.BoxGeometry(0.3, 0.12, 0.1);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffbe8,
    emissiveIntensity: 4.0
  });
  const hl = new THREE.Mesh(headGeo, headMat);
  hl.position.set(-0.6, 0.48, -1.86);
  const hr = new THREE.Mesh(headGeo, headMat);
  hr.position.set(0.6, 0.48, -1.86);
  group.add(hl, hr);

  // 4. Rear Taillight LED Bar
  const tailGeo = new THREE.BoxGeometry(1.4, 0.1, 0.08);
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1133,
    emissive: 0xff1133,
    emissiveIntensity: 3.0
  });
  const tailBar = new THREE.Mesh(tailGeo, tailMat);
  tailBar.name = "tail-led-bar";
  tailBar.position.set(0, 0.52, 1.86);
  group.add(tailBar);

  // 5. Wheels
  const wheels = [];
  const wheelPositions = [
    [-0.92, 0.32, -1.15],
    [0.92, 0.32, -1.15],
    [-0.92, 0.32, 1.15],
    [0.92, 0.32, 1.15]
  ];

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20);
  wheelGeo.rotateZ(Math.PI / 2);

  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 16);
  rimGeo.rotateZ(Math.PI / 2);

  for (const [wx, wy, wz] of wheelPositions) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);

    const tireMesh = new THREE.Mesh(wheelGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rimMesh);

    group.add(wheelGroup);
    wheels.push(wheelGroup);
  }

  const wrapper = new THREE.Group();
  wrapper.add(group);
  wrapper.userData.wheels = wheels;
  wrapper.userData.isPlaceholder = true;

  return wrapper;
}

/**
 * Build and return the real FBX car group for carId.
 * Falls back to high-grade low-poly arcade mesh if FBX is not yet cached.
 */
export function createCarModel(carId = "cyber") {
  const config = getCarConfig(carId);
  let model = spawnCarModel(carId, { bodyColor: config.bodyColor });

  if (!model) {
    // Generate instant low-poly arcade proxy mesh
    model = createLowPolyFallbackCar(config);
  }

  /* ── Neon underglow point light ── */
  const glow = new THREE.PointLight(config.accentColor || "#38bdf8", 1.5, 6.0);
  glow.position.set(0, 0.2, 0);
  model.add(glow);

  /* ── Rocket thruster VFX (hidden until jump / flight) ── */
  const thrusters = _buildThrusters(config.accentColor || "#ff5500");
  model.add(thrusters.group);

  model.userData.originalScale = model.scale.clone();
  model.userData.rocketThrusters = thrusters;
  model.userData.carId = config.id;
  model.userData.config = config;
  model.name = `car-${config.id}`;

  return model;
}

/* ── Rocket-thruster VFX ───────────────────────────────── */
function _buildThrusters(accentColor) {
  const g = new THREE.Group();
  g.name = "rocket-thrusters";
  g.visible = false;

  const plumeMat = new THREE.MeshStandardMaterial({
    color: "#ff3700",
    emissive: "#ff5500",
    emissiveIntensity: 5.5,
    roughness: 0.2,
    transparent: true,
    opacity: 0.9,
  });

  const flames = [];
  const positions = [
    [-0.42, 0.15, -0.45], [0.42, 0.15, -0.45],
    [-0.42, 0.15, 0.85], [0.42, 0.15, 0.85]
  ];

  for (const [tx, ty, tz] of positions) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.90, 8), plumeMat);
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
