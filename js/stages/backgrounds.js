import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { getStageConfig } from "./stages.js";
import { getRoadPoint } from "./stageRenderer.js";

/* ================================================================
   HIGH-PERFORMANCE HORIZON FOG & LIGHTWEIGHT SCENERY
   - Replaces heavy 3D building OBJ models with a smooth panoramic
     skyline horizon backdrop + realistic depth fog.
   - Buttery smooth 60 FPS on any hardware.
   - Roadside props: lightweight low-poly street lamps & trees.
================================================================ */

const WORLD_LENGTH = 140;
const RECYCLE_DIST = 30;

/* ── Material helper ─────────────────────────────────────────── */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.1,
    emissive:  opts.emissive  ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide
  });
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

/* ── Procedural Horizon Panorama Image Canvas ────────────────── */
function createHorizonTexture(stage) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const skyColor = stage.skyColor || "#38bdf8";
  const fogColor = stage.fogColor || "#bae6fd";

  // 1. Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0.0, skyColor);
  skyGrad.addColorStop(0.55, fogColor);
  skyGrad.addColorStop(1.0, fogColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Distant mountain ridge
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

  // 3. City Skyscraper Silhouettes with glowing windows
  const isCity = stage.scenery === "city" || stage.scenery === "beach";
  if (isCity) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
    let bx = 16;
    while (bx < canvas.width) {
      const bw = 26 + (Math.sin(bx * 0.12) * 0.5 + 0.5) * 48;
      const bh = 80 + (Math.cos(bx * 0.08) * 0.5 + 0.5) * 160;
      const by = 370 - bh;

      ctx.fillRect(bx, by, bw, bh);

      // Antenna / Spire
      if (Math.sin(bx * 0.3) > 0.2) {
        ctx.fillRect(bx + bw / 2 - 1.5, by - 24, 3, 24);
      }

      // Windows
      ctx.fillStyle = "rgba(254, 240, 138, 0.65)";
      for (let wy = by + 10; wy < 360; wy += 13) {
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 9) {
          if (Math.sin(wx * 11 + wy * 7) > 0.05) {
            ctx.fillRect(wx, wy, 2.5, 4.5);
          }
        }
      }
      ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
      bx += bw + 8 + (Math.sin(bx) * 0.5 + 0.5) * 18;
    }
  }

  // 4. Horizon Fog Mist Gradient (blends the base seamlessly into ground and road)
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

/* ── Lightweight Horizon Backdrop Plane ──────────────────────── */
function createHorizonBackdrop(stage) {
  const texture = createHorizonTexture(stage);
  const geo = new THREE.PlaneGeometry(360, 90, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    depthWrite: false,
    fog: false // The backdrop ITSELF displays the horizon fog and sky
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(0, 32, -120);
  return mesh;
}

/* ── Ultra-lightweight Street Lamp ───────────────────────────── */
function createFastStreetLamp() {
  const group = new THREE.Group();
  const poleMat = mat("#334155", { roughness: 0.4, metalness: 0.7 });

  cyl(group, 0.06, 0.10, 5.2, 6, [0, 2.6, 0], poleMat, false);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5), poleMat);
  arm.rotation.z = Math.PI / 3.2;
  arm.position.set(0.42, 5.0, 0);
  group.add(arm);

  box(group, [0.32, 0.10, 0.16], [0.80, 4.88, 0],
    mat("#1e293b", { roughness: 0.5, metalness: 0.6 }), false);
  box(group, [0.24, 0.04, 0.12], [0.80, 4.82, 0],
    new THREE.MeshBasicMaterial({ color: "#fef08a" }), false);

  return group;
}

/* ── Ultra-lightweight Roadside Tree ─────────────────────────── */
function createFastTree(stage, side) {
  const group = new THREE.Group();
  const trunkMat = mat("#3d2212", { roughness: 0.9 });
  cyl(group, 0.12, 0.18, 2.8, 6, [0, 1.4, 0], trunkMat, false);

  const foliageColor = stage.scenery === "jungle" ? "#15803d" : "#2d6a4f";
  const foliageMat = mat(foliageColor, { roughness: 0.8 });

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

/* ================================================================
   MAIN createBackground
================================================================ */
export function createBackground(stageId = "city") {
  const stage = getStageConfig(stageId);
  const group = new THREE.Group();
  const items = [];

  // 1. Smooth ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, WORLD_LENGTH + 60, 4, 16),
    mat(stage.groundColor || "#475569", { roughness: 0.95, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -WORLD_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // 2. Panoramic Horizon Backdrop Image
  const horizon = createHorizonBackdrop(stage);
  group.add(horizon);

  // 3. Lightweight Street Lamps (spaced every 36m)
  for (let z = 10; z > -WORLD_LENGTH; z -= 36) {
    for (const side of [-1, 1]) {
      const lamp = createFastStreetLamp();
      const lateralDist = side * 8.6;
      const pt = getRoadPoint(z, lateralDist);
      const rotOffset = side > 0 ? -Math.PI : 0;
      lamp.position.set(pt.x, pt.y + 0.05, pt.z);
      lamp.rotation.y = pt.heading + rotOffset;
      group.add(lamp);
      items.push({ object: lamp, lateralDist, side, rotationOffset: rotOffset, roadZ: z, yOffset: 0.05 });
    }
  }

  // 4. Lightweight Roadside Trees (spaced every 28m)
  for (let z = 22; z > -WORLD_LENGTH; z -= 28) {
    for (const side of [-1, 1]) {
      const tree = createFastTree(stage, side);
      const lateralDist = side * 13.5;
      const pt = getRoadPoint(z, lateralDist);
      tree.position.set(pt.x, pt.y, pt.z);
      tree.rotation.y = pt.heading;
      group.add(tree);
      items.push({ object: tree, lateralDist, side, rotationOffset: 0, roadZ: z, yOffset: 0 });
    }
  }

  group.userData.sceneryObjects = items;
  group.userData.worldLength = WORLD_LENGTH;
  group.userData.recycleDistance = RECYCLE_DIST;
  group.userData.stageId = stageId;
  group.userData.horizonMesh = horizon;

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

// Clean export stub so main.js imports without breaking
export function preloadBuildingModels() {
  // No-op: heavy OBJ buildings removed for 60 FPS performance!
}
