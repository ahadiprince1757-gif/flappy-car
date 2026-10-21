import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { getStageConfig } from "./stages.js";
import { getRoadPoint } from "./stageRenderer.js";

/* ================================================================
   3D CITY ARCHITECTURE & HIGHWAY SCENERY
   - Rich 3D buildings (skyscrapers, neon storefronts, civic towers)
     lining both sides of the highway.
   - Seamlessly blends into atmospheric horizon depth fog.
   - Rock-solid 60 FPS with zero lag or stutter.
================================================================ */

const WORLD_LENGTH = 160;
const RECYCLE_DIST = 35;

/* ── Shared Material Cache ───────────────────────────────────── */
const _matCache = new Map();
function getMat(color, opts = {}) {
  const key = `${color}_${opts.roughness ?? 0.7}_${opts.metalness ?? 0.2}_${opts.emissive ?? ""}_${opts.opacity ?? 1}`;
  if (_matCache.has(key)) return _matCache.get(key);

  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0.2,
    emissive:  opts.emissive  ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide
  });
  _matCache.set(key, m);
  return m;
}

function box(parent, size, pos, material, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...pos);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent, rTop, rBot, h, segs, pos, material, cast = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  m.position.set(...pos);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ── Deterministic LCG RNG ───────────────────────────────────── */
function makeRNG(seed) {
  let v = (seed >>> 0) || 1;
  return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
}

/* ================================================================
   3D BUILDING STYLES
================================================================ */

// Style 1: Modern Skyscraper Tower
function buildSkyscraper(parent, stage, rng, side) {
  const w = 7.5 + rng() * 3.0;
  const h = 22 + rng() * 18;
  const d = 7.5 + rng() * 2.5;

  const wallColors = stage.buildingColors || ["#1e293b", "#334155", "#0f172a", "#1e3a5f"];
  const wallCol = wallColors[Math.floor(rng() * wallColors.length)];
  const wallMat = getMat(wallCol, { roughness: 0.55, metalness: 0.35 });

  // Concrete foundation base
  box(parent, [w + 1.2, 0.6, d + 1.2], [0, 0.3, 0], getMat("#475569", { roughness: 0.9 }), false);

  // Main high-rise tower body
  box(parent, [w, h, d], [0, h / 2 + 0.6, 0], wallMat);

  // Recessed penthouse tier
  const topH = 4.5;
  box(parent, [w * 0.75, topH, d * 0.75], [0, h + topH / 2 + 0.6, 0], getMat("#0f172a", { roughness: 0.4, metalness: 0.6 }));

  // Roof communication spire with red beacon
  cyl(parent, 0.04, 0.08, 5.0, 6, [0, h + topH + 3.1, 0], getMat("#94a3b8", { roughness: 0.3, metalness: 0.8 }), false);
  const beacon = box(parent, [0.25, 0.25, 0.25], [0, h + topH + 5.7, 0],
    getMat("#ef4444", { emissive: "#ef4444", emissiveIntensity: 3.5 }), false);

  // Glass Window Columns
  const winMat = getMat("#38bdf8", {
    emissive: "#0284c7",
    emissiveIntensity: 0.55,
    roughness: 0.1,
    metalness: 0.8
  });

  const frontZ = d / 2 + 0.08;
  const floors = Math.floor((h - 4) / 3.2);
  const cols = Math.floor(w / 2.2);

  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + ((c + 0.5) / cols) * w;
      const wy = 4.0 + f * 3.2;
      box(parent, [0.95, 1.6, 0.12], [wx, wy, frontZ], winMat, false);
    }
  }
}

// Style 2: Illuminated Neon Boutique & Storefront
function buildStorefront(parent, stage, rng, side) {
  const w = 8.5 + rng() * 2.0;
  const h = 10 + rng() * 4.0;
  const d = 7.0 + rng() * 1.5;

  const wallMat = getMat("#1e293b", { roughness: 0.65, metalness: 0.2 });

  // Foundation
  box(parent, [w + 0.8, 0.5, d + 0.8], [0, 0.25, 0], getMat("#334155"), false);

  // Building core
  box(parent, [w, h, d], [0, h / 2 + 0.5, 0], wallMat);

  const frontZ = d / 2 + 0.06;

  // Ground-floor wide shop display window
  const shopGlassMat = getMat("#e0f2fe", {
    emissive: "#38bdf8",
    emissiveIntensity: 0.85,
    roughness: 0.05
  });
  box(parent, [w * 0.8, 3.2, 0.15], [0, 2.2, frontZ], shopGlassMat, false);

  // Awning Canopy
  const awningCols = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
  const awCol = awningCols[Math.floor(rng() * awningCols.length)];
  const awning = box(parent, [w * 0.88, 0.2, 1.2], [0, 3.9, frontZ + 0.55], getMat(awCol, { roughness: 0.6 }));
  awning.rotation.x = 0.22;

  // Glowing Marquee Signboard
  box(parent, [w * 0.72, 1.1, 0.22], [0, 4.8, frontZ + 0.15],
    getMat("#0f172a", { emissive: awCol, emissiveIntensity: 1.4 }), false);

  // Upper floor windows
  const winMat = getMat("#fef08a", {
    emissive: "#fde047",
    emissiveIntensity: 0.7,
    roughness: 0.1
  });
  for (let c = 0; c < 3; c++) {
    const wx = -w / 3 + c * (w / 3);
    box(parent, [1.1, 1.6, 0.12], [wx, h * 0.75, frontZ], winMat, false);
  }

  // Rooftop AC units
  box(parent, [1.6, 1.1, 1.4], [w * 0.2, h + 1.1, 0], getMat("#475569", { roughness: 0.6, metalness: 0.7 }));
}

// Style 3: Modern Civic Commercial Complex
function buildCivicBlock(parent, stage, rng, side) {
  const w = 9.0 + rng() * 2.5;
  const h = 14 + rng() * 6.0;
  const d = 8.0 + rng() * 2.0;

  const wallMat = getMat("#334155", { roughness: 0.5, metalness: 0.4 });
  box(parent, [w, h, d], [0, h / 2 + 0.5, 0], wallMat);

  const frontZ = d / 2 + 0.08;

  // Entrance Columns
  const colMat = getMat("#cbd5e1", { roughness: 0.3, metalness: 0.6 });
  for (let c = -1; c <= 1; c++) {
    cyl(parent, 0.22, 0.26, 4.0, 8, [c * 2.2, 2.5, frontZ + 0.5], colMat, false);
  }

  // Architectural Pediment Roof Portico
  const portico = box(parent, [w * 0.65, 0.5, 1.4], [0, 4.6, frontZ + 0.5], colMat, false);

  // Vertical Glass Curtain Wall
  const glassMat = getMat("#bae6fd", {
    emissive: "#0284c7",
    emissiveIntensity: 0.65,
    roughness: 0.08
  });
  box(parent, [w * 0.7, h * 0.52, 0.15], [0, h * 0.68, frontZ], glassMat, false);

  // Rooftop Parapet
  box(parent, [w + 0.3, 0.8, d + 0.3], [0, h + 0.9, 0], getMat("#1e293b", { roughness: 0.5, metalness: 0.5 }));
}

/* ── 3D Building Factory ─────────────────────────────────────── */
function create3DBuilding(stage, rng, side) {
  const group = new THREE.Group();
  const styleChoice = rng();

  if (styleChoice < 0.45) {
    buildSkyscraper(group, stage, rng, side);
  } else if (styleChoice < 0.80) {
    buildStorefront(group, stage, rng, side);
  } else {
    buildCivicBlock(group, stage, rng, side);
  }

  return group;
}

/* ── Street Lamp ─────────────────────────────────────────────── */
function createStreetLamp() {
  const group = new THREE.Group();
  const poleMat = getMat("#334155", { roughness: 0.35, metalness: 0.8 });

  cyl(group, 0.06, 0.11, 5.2, 6, [0, 2.6, 0], poleMat, false);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 5), poleMat);
  arm.rotation.z = Math.PI / 3.2;
  arm.position.set(0.42, 5.0, 0);
  group.add(arm);

  box(group, [0.32, 0.10, 0.16], [0.80, 4.88, 0],
    getMat("#1e293b", { roughness: 0.5, metalness: 0.6 }), false);
  box(group, [0.24, 0.04, 0.12], [0.80, 4.82, 0],
    getMat("#fef08a", { emissive: "#fef08a", emissiveIntensity: 2.5 }), false);

  return group;
}

/* ── Roadside Palm / Pine Tree ────────────────────────────────── */
function createTree(stage, side) {
  const group = new THREE.Group();
  const trunkMat = getMat("#3d2212", { roughness: 0.9 });
  cyl(group, 0.12, 0.20, 2.8, 6, [0, 1.4, 0], trunkMat, false);

  const foliageColor = stage.scenery === "jungle" ? "#15803d" : "#2d6a4f";
  const foliageMat = getMat(foliageColor, { roughness: 0.8 });

  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 6), foliageMat);
  c1.position.set(0, 3.6, 0);
  c1.castShadow = true;
  group.add(c1);

  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 6), foliageMat);
  c2.position.set(0, 4.8, 0);
  c2.castShadow = true;
  group.add(c2);

  return group;
}

/* ── Procedural Panoramic Horizon Backdrop ───────────────────── */
function createHorizonTexture(stage) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const skyColor = stage.skyColor || "#38bdf8";
  const fogColor = stage.fogColor || "#bae6fd";

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0.0, skyColor);
  skyGrad.addColorStop(0.55, fogColor);
  skyGrad.addColorStop(1.0, fogColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distant mountain ridge
  ctx.fillStyle = stage.scenery === "beach" ? "rgba(180, 83, 9, 0.28)" :
                  stage.scenery === "desert" ? "rgba(180, 83, 9, 0.35)" :
                  "rgba(30, 58, 138, 0.22)";
  ctx.beginPath();
  ctx.moveTo(0, 360);
  for (let x = 0; x <= canvas.width; x += 32) {
    const y = 260 + Math.sin(x * 0.006) * 45 + Math.cos(x * 0.014) * 28;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  // Distant skyline silhouettes
  ctx.fillStyle = "rgba(15, 23, 42, 0.50)";
  let bx = 16;
  while (bx < canvas.width) {
    const bw = 26 + (Math.sin(bx * 0.12) * 0.5 + 0.5) * 48;
    const bh = 80 + (Math.cos(bx * 0.08) * 0.5 + 0.5) * 160;
    const by = 370 - bh;

    ctx.fillRect(bx, by, bw, bh);

    if (Math.sin(bx * 0.3) > 0.2) {
      ctx.fillRect(bx + bw / 2 - 1.5, by - 24, 3, 24);
    }

    ctx.fillStyle = "rgba(254, 240, 138, 0.65)";
    for (let wy = by + 10; wy < 360; wy += 13) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 9) {
        if (Math.sin(wx * 11 + wy * 7) > 0.05) {
          ctx.fillRect(wx, wy, 2.5, 4.5);
        }
      }
    }
    ctx.fillStyle = "rgba(15, 23, 42, 0.50)";
    bx += bw + 8 + (Math.sin(bx) * 0.5 + 0.5) * 18;
  }

  // Horizon Fog Mist Gradient (blends the base seamlessly into ground and road)
  const fogGrad = ctx.createLinearGradient(0, 240, 0, canvas.height);
  fogGrad.addColorStop(0.0, "rgba(255, 255, 255, 0)");
  fogGrad.addColorStop(0.55, hexToRgba(fogColor, 0.75));
  fogGrad.addColorStop(1.0, hexToRgba(fogColor, 1.0));
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 240, canvas.width, canvas.height - 240);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function hexToRgba(hex, alpha) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createHorizonBackdrop(stage) {
  const texture = createHorizonTexture(stage);
  const geo = new THREE.PlaneGeometry(420, 100, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    depthWrite: false,
    fog: false
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(0, 36, -125);
  return mesh;
}

/* ================================================================
   MAIN createBackground
================================================================ */
export function createBackground(stageId = "city") {
  const stage = getStageConfig(stageId);
  const group = new THREE.Group();
  const rng = makeRNG(stageId.length * 777 + 23);
  const items = [];

  // 1. Ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, WORLD_LENGTH + 60, 4, 16),
    getMat(stage.groundColor || "#475569", { roughness: 0.95, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -WORLD_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // 2. Horizon panoramic skyline backdrop
  const horizon = createHorizonBackdrop(stage);
  group.add(horizon);

  // 3. 3D City Buildings along both sides of the highway (every 22m)
  for (let z = 16; z > -WORLD_LENGTH; z -= 22) {
    for (const side of [-1, 1]) {
      // 3D Building
      const bldg = create3DBuilding(stage, rng, side);

      // Position just past sidewalk (+17m on right, -17m on left)
      const lateralDist = side * (16.5 + rng() * 2.0);
      const pt = getRoadPoint(z, lateralDist);

      // Face the road: right side turns left (-PI/2), left side turns right (+PI/2)
      const rotOffset = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      bldg.position.set(pt.x, pt.y, pt.z);
      bldg.rotation.y = pt.heading + rotOffset;
      group.add(bldg);

      items.push({ object: bldg, lateralDist, side, rotationOffset: rotOffset, roadZ: z, yOffset: 0 });

      // Roadside street tree between buildings
      if (rng() > 0.3) {
        const tree = createTree(stage, side);
        const treeDist = side * 11.8;
        const treePt = getRoadPoint(z - 11, treeDist);
        tree.position.set(treePt.x, treePt.y, treePt.z);
        tree.rotation.y = treePt.heading;
        group.add(tree);
        items.push({ object: tree, lateralDist: treeDist, side, rotationOffset: 0, roadZ: z - 11, yOffset: 0 });
      }
    }
  }

  // 4. Street Lamps (every 36m)
  for (let z = 10; z > -WORLD_LENGTH; z -= 36) {
    for (const side of [-1, 1]) {
      const lamp = createStreetLamp();
      const lateralDist = side * 8.6;
      const pt = getRoadPoint(z, lateralDist);
      const rotOffset = side > 0 ? -Math.PI : 0;
      lamp.position.set(pt.x, pt.y + 0.05, pt.z);
      lamp.rotation.y = pt.heading + rotOffset;
      group.add(lamp);
      items.push({ object: lamp, lateralDist, side, rotationOffset: rotOffset, roadZ: z, yOffset: 0.05 });
    }
  }

  group.userData.sceneryObjects = items;
  group.userData.worldLength = WORLD_LENGTH;
  group.userData.recycleDistance = RECYCLE_DIST;
  group.userData.stageId = stageId;

  return group;
}

/* ================================================================
   updateBackground
================================================================ */
export function updateBackground(background, deltaTime, speed) {
  if (!background) return;

  const items = background.userData.sceneryObjects ?? [];
  const worldLength = background.userData.worldLength ?? WORLD_LENGTH;
  const recycleDist = background.userData.recycleDistance ?? RECYCLE_DIST;
  const move = speed * deltaTime;

  for (const entry of items) {
    const obj = entry.object;
    entry.roadZ = (entry.roadZ ?? obj.position.z) + move;

    if (entry.roadZ > recycleDist) {
      entry.roadZ -= worldLength;
    }

    const pt = getRoadPoint(entry.roadZ, entry.lateralDist);
    obj.position.set(pt.x, pt.y + (entry.yOffset || 0), pt.z);
    obj.rotation.y = pt.heading + entry.rotationOffset;
  }
}

export function preloadBuildingModels() {
  // No-op
}
