import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/*
 * TRAFFIC CAR RENDERER
 *
 * Builds visually distinct AI traffic cars that populate the road.
 * Each car is a compact Three.js Group composed of:
 *  - Chamfered body shell + roof panel
 *  - Tinted windshield + rear glass
 *  - Emissive headlights (white DRL) and taillights (red LED)
 *  - Side mirrors
 *  - Four rubber tires with chrome-ish rims
 *  - Subtle neon underglow (colour-coded per car type)
 */

// ── Helper materials ──────────────────────────────────────────────
function pmat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.3,
    metalness: opts.metalness ?? 0.55,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

function addBox(parent, w, h, d, px, py, pz, mat, name = "") {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(px, py, pz);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

// ── Wheel ─────────────────────────────────────────────────────────
function makeWheel(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0.28, z);

  const tireMat = pmat("#1c1c1c", { roughness: 0.9, metalness: 0.1 });
  const rimMat  = pmat("#b0b8c1", { roughness: 0.25, metalness: 0.8 });

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 20), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.225, 8), rimMat);
  rim.rotation.z = Math.PI / 2;
  group.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.23, 8),
    pmat("#222", { roughness: 0.5, metalness: 0.7 }));
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  return group;
}

// ── Traffic car archetypes palette ───────────────────────────────
const ARCHETYPE_PALETTE = [
  ["#e63946", "#ff1a2e", "sedan"],
  ["#457b9d", "#00b4d8", "suv"],
  ["#2d6a4f", "#52b788", "pickup"],
  ["#f4a261", "#ff6b35", "hatchback"],
  ["#6d6875", "#c77dff", "sedan"],
  ["#1d3557", "#4fc3f7", "suv"],
  ["#e9c46a", "#ffd60a", "hatchback"],
  ["#264653", "#2a9d8f", "pickup"],
  ["#f1faee", "#a8dadc", "sedan"],
  ["#3d405b", "#818cf8", "suv"],
];

function nextArchetype() {
  return ARCHETYPE_PALETTE[Math.floor(Math.random() * ARCHETYPE_PALETTE.length)];
}

// ── Build a single traffic car Group ─────────────────────────────
export function buildTrafficCar(archetypeOverride = null) {
  const [bodyColor, glowColor, type] = archetypeOverride || nextArchetype();

  const group = new THREE.Group();
  const bodyMat = pmat(bodyColor, { roughness: 0.28, metalness: 0.55 });

  let bodyW, bodyH, bodyD, roofW, roofH, roofD, roofOffY, roofOffZ;

  if (type === "suv") {
    bodyW = 1.85; bodyH = 0.68; bodyD = 4.0;
    roofW = 1.72; roofH = 0.62; roofD = 2.5;
    roofOffY = 0.65; roofOffZ = 0.1;
  } else if (type === "pickup") {
    bodyW = 1.9; bodyH = 0.6; bodyD = 4.4;
    roofW = 1.78; roofH = 0.5; roofD = 1.8;
    roofOffY = 0.6; roofOffZ = 0.8;
  } else if (type === "hatchback") {
    bodyW = 1.7; bodyH = 0.58; bodyD = 3.4;
    roofW = 1.6; roofH = 0.52; roofD = 2.1;
    roofOffY = 0.6; roofOffZ = 0.05;
  } else {
    bodyW = 1.75; bodyH = 0.58; bodyD = 3.8;
    roofW = 1.62; roofH = 0.5; roofD = 1.9;
    roofOffY = 0.6; roofOffZ = 0.1;
  }

  // Body shell
  addBox(group, bodyW, bodyH, bodyD, 0, 0.56, 0, bodyMat);

  // Roof cabin
  const roofMat = pmat(bodyColor, { roughness: 0.3, metalness: 0.5 });
  addBox(group, roofW, roofH, roofD, 0, roofOffY + bodyH / 2, roofOffZ, roofMat);

  // Glass
  const glassMat = pmat("#93c5fd", {
    roughness: 0.05, metalness: 0.15,
    transparent: true, opacity: 0.55,
    emissive: "#60a5fa", emissiveIntensity: 0.06
  });
  const wsH = roofH * 0.78;
  const frontWS = addBox(group, roofW * 0.88, wsH, 0.06,
    0, roofOffY + bodyH / 2 - wsH * 0.05, -(roofD / 2), glassMat);
  frontWS.rotation.x = 0.32;

  const rearWS = addBox(group, roofW * 0.82, wsH * 0.9, 0.06,
    0, roofOffY + bodyH / 2 - wsH * 0.08, roofD / 2, glassMat);
  rearWS.rotation.x = -0.28;

  addBox(group, 0.06, wsH * 0.88, roofD * 0.7,
    -(roofW / 2), roofOffY + bodyH / 2 - 0.02, roofOffZ, glassMat);
  addBox(group, 0.06, wsH * 0.88, roofD * 0.7,
     (roofW / 2), roofOffY + bodyH / 2 - 0.02, roofOffZ, glassMat);

  // Headlights
  const headMat = pmat("#ffffff", {
    roughness: 0.1, metalness: 0.1,
    emissive: "#ffffff", emissiveIntensity: 2.2
  });
  addBox(group, 0.3, 0.1, 0.06,  bodyW * 0.36, 0.72, -(bodyD / 2), headMat);
  addBox(group, 0.3, 0.1, 0.06, -bodyW * 0.36, 0.72, -(bodyD / 2), headMat);

  // Taillights
  const tailMat = pmat("#ff1a2e", {
    roughness: 0.1, metalness: 0.1,
    emissive: "#ff1a2e", emissiveIntensity: 2.8
  });
  addBox(group, 0.38, 0.1, 0.06,  bodyW * 0.36, 0.72, bodyD / 2, tailMat);
  addBox(group, 0.38, 0.1, 0.06, -bodyW * 0.36, 0.72, bodyD / 2, tailMat);

  // Bumpers
  const bumperMat = pmat("#333", { roughness: 0.8, metalness: 0.3 });
  addBox(group, bodyW * 0.92, 0.12, 0.12, 0, 0.32, -(bodyD / 2) - 0.04, bumperMat);
  addBox(group, bodyW * 0.92, 0.12, 0.12, 0, 0.32,  (bodyD / 2) + 0.04, bumperMat);

  // Side mirrors
  const mirrorMat = pmat(bodyColor, { roughness: 0.35, metalness: 0.5 });
  addBox(group, 0.18, 0.08, 0.22, -(bodyW / 2) - 0.12, 0.92, -(roofD * 0.3), mirrorMat);
  addBox(group, 0.18, 0.08, 0.22,  (bodyW / 2) + 0.12, 0.92, -(roofD * 0.3), mirrorMat);

  // Wheels
  const wheels = [
    makeWheel(-(bodyW / 2) - 0.06, -(bodyD * 0.34)),
    makeWheel( (bodyW / 2) + 0.06, -(bodyD * 0.34)),
    makeWheel(-(bodyW / 2) - 0.06,  (bodyD * 0.34)),
    makeWheel( (bodyW / 2) + 0.06,  (bodyD * 0.34)),
  ];
  for (const w of wheels) group.add(w);

  // Neon underglow
  const glowLight = new THREE.PointLight(glowColor, 0.9, 4.5);
  glowLight.position.set(0, 0.1, 0);
  group.add(glowLight);

  group.castShadow = true;
  group.receiveShadow = true;
  group.userData.trafficCar = true;
  group.userData.bodyType = type;
  group.userData.glowColor = glowColor;
  group.userData.wheels = wheels;
  group.userData.bodyLength = bodyD;

  return group;
}
