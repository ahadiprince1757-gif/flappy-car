import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { getStageConfig } from "./stages.js";
import { getRoadPoint } from "./stageRenderer.js";

/* ================================================================
   Ultra-premium background: layered city skyline, coastal ocean,
   mountain cliffs, detailed 3D trees, richly detailed shop buildings,
   modern street furniture, and atmospheric sky dome.
================================================================ */

const WORLD_LENGTH    = 260;
const RECYCLE_DIST    = 50;

/* ── Shared material factory ──────────────────────────────────── */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.12,
    emissive:  opts.emissive  ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity:   opts.opacity ?? 1,
    side:      opts.side ?? THREE.FrontSide,
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

/* ── Deterministic LCG RNG ───────────────────────────────────── */
function makeRNG(seed) {
  let v = (seed >>> 0) || 1;
  return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
}

/* ================================================================
   BUILDING — detailed glass-curtain-wall skyscraper / shop hybrid
================================================================ */
function createBuilding(stage, rng, sideSign) {
  const group = new THREE.Group();

  const w = 6  + rng() * 5;
  const h = 12 + rng() * 28;
  const d = 6  + rng() * 4;

  const palette = stage.buildingColors ?? ["#334155","#475569","#1e293b","#0f172a"];
  const wallCol = palette[Math.floor(rng() * palette.length)];

  /* Base slab */
  box(group, [w + 2.4, 0.5, d + 2.4], [0, 0.25, 0],
    mat("#4b5563", { roughness: 0.9 }), false);

  /* Main body */
  box(group, [w, h, d], [0, h / 2 + 0.5, 0],
    mat(wallCol, { roughness: 0.65, metalness: 0.25 }));

  /* Glass curtain wall — large panels front face */
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#bae6fd",
    emissive: "#38bdf8",
    emissiveIntensity: 0.28,
    roughness: 0.08,
    metalness: 0.55,
    transparent: true,
    opacity: 0.82,
  });
  const frontZ = d / 2 + 0.06;
  /* Full-height glass facade */
  box(group, [w * 0.78, h * 0.72, 0.15], [0, h * 0.55, frontZ], glassMat, false);

  /* Awning */
  const awningCols = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6"];
  const awCol = awningCols[Math.floor(rng() * awningCols.length)];
  const aw = box(group, [w * 0.9, 0.32, 1.6], [0, 3.9, frontZ + 0.75],
    mat(awCol, { roughness: 0.55 }));
  aw.rotation.x = 0.2;

  /* Shop sign board */
  box(group, [w * 0.70, 1.0, 0.22], [0, 4.8, frontZ + 0.12],
    mat("#0f172a", { emissive: awCol, emissiveIntensity: 0.7, roughness: 0.2 }), false);

  /* Window grid */
  const winMat = new THREE.MeshStandardMaterial({
    color: "#e0f2fe",
    emissive: "#38bdf8",
    emissiveIntensity: rng() > 0.5 ? 0.6 : 0.2,
    roughness: 0.1,
  });
  const floors = Math.floor((h - 6) / 3.0);
  const cols   = Math.floor(w / 2.1);
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + ((c + 0.5) / cols) * w;
      const wy = 6.5 + f * 2.95;
      box(group, [0.9, 1.5, 0.12], [wx, wy, frontZ + 0.02], winMat, false);
      // Side face windows too
      box(group, [0.12, 1.5, 0.9], [sideSign * (w / 2 + 0.04), wy, (rng() - 0.5) * d * 0.6],
        winMat, false);
    }
  }

  /* Roof details */
  box(group, [w * 0.5, 0.8, d * 0.5], [0, h + 0.9, 0],
    mat("#1e293b", { roughness: 0.5, metalness: 0.6 }));
  // AC unit
  box(group, [1.4, 1.0, 1.4], [w * 0.2, h + 1.3, 0],
    mat("#374151", { roughness: 0.5, metalness: 0.7 }));
  // Antenna
  cyl(group, 0.02, 0.04, 3.5, 6, [0, h + 3.2, 0],
    mat("#64748b", { roughness: 0.4, metalness: 0.9 }));

  return group;
}

/* ================================================================
   TREE — ultra-lush multi-tier foliage with visible trunk detail
================================================================ */
function createTree(stage, rng) {
  const group = new THREE.Group();

  const isJungle = stage.scenery === "jungle";
  const trunkH   = 2.8 + rng() * 1.6;

  /* Trunk with texture-like colour variation */
  const trunkMat = mat("#3b1a08", { roughness: 0.92, metalness: 0.0 });
  cyl(group, 0.16, 0.28, trunkH, 8, [0, trunkH / 2, 0], trunkMat);

  /* Bark groove ring near base */
  const barkMat = mat("#4e2910", { roughness: 0.95 });
  cyl(group, 0.30, 0.30, 0.12, 8, [0, 0.5, 0], barkMat);

  /* Foliage clusters */
  const palette = isJungle
    ? ["#14532d","#15803d","#166534","#16a34a","#4ade80"]
    : ["#1a4731","#2d6a4f","#40916c","#52b788","#74c69d"];

  const layers = isJungle ? 4 : 3;
  for (let l = 0; l < layers; l++) {
    const r     = 1.2 + (layers - l) * 0.45 + rng() * 0.5;
    const yOff  = trunkH + l * 0.9 - 0.3;
    const lMat  = mat(palette[Math.floor(rng() * palette.length)], { roughness: 0.75 });

    const seg  = 6 + l;
    // Central canopy sphere
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg - 1), lMat);
    canopy.position.set((rng() - 0.5) * 0.4, yOff, (rng() - 0.5) * 0.4);
    canopy.scale.set(1, 0.72 + rng() * 0.35, 1);
    canopy.castShadow = true;
    group.add(canopy);

    // Side clusters for density
    for (let s = 0; s < 3; s++) {
      const sr  = r * (0.55 + rng() * 0.35);
      const ang = (s / 3) * Math.PI * 2 + rng() * 0.8;
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(sr, Math.max(5, seg - 2), Math.max(4, seg - 2)),
        mat(palette[Math.floor(rng() * palette.length)], { roughness: 0.78 })
      );
      sph.position.set(
        Math.cos(ang) * r * 0.7,
        yOff - 0.2 + rng() * 0.6,
        Math.sin(ang) * r * 0.7
      );
      sph.castShadow = true;
      group.add(sph);
    }
  }

  return group;
}

/* ================================================================
   STREET LAMP — modern cobra-head style
================================================================ */
function createStreetLamp() {
  const group  = new THREE.Group();
  const pMat   = mat("#334155", { roughness: 0.35, metalness: 0.85 });

  // Tapered pole
  cyl(group, 0.06, 0.14, 6.0, 8, [0, 3.0, 0], pMat);

  // Curved arm
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), pMat);
  arm.rotation.z = Math.PI / 3.2;
  arm.position.set(0.72, 5.6, 0);
  group.add(arm);

  // Lamp housing
  box(group, [0.38, 0.14, 0.22], [1.25, 5.35, 0],
    mat("#1e293b", { roughness: 0.4, metalness: 0.7 }));

  // LED emitter
  box(group, [0.32, 0.04, 0.18], [1.25, 5.25, 0],
    new THREE.MeshStandardMaterial({
      color: "#fef9c3",
      emissive: "#fde68a",
      emissiveIntensity: 3.5,
      roughness: 0.1,
    }), false);

  return group;
}

/* ================================================================
   OCEAN / COASTAL PLANE
================================================================ */
function createOceanPlane(stage) {
  if (stage.scenery !== "city" && stage.scenery !== "beach") return null;

  const oceanMat = new THREE.MeshStandardMaterial({
    color:     "#0369a1",
    emissive:  "#0284c7",
    emissiveIntensity: 0.18,
    roughness: 0.15,
    metalness: 0.5,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(180, WORLD_LENGTH + 120, 8, 8),
    oceanMat
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-95, -1.0, -WORLD_LENGTH / 2);
  ocean.receiveShadow = true;
  return ocean;
}

/* ================================================================
   SKY DOME (gradient hemisphere)
================================================================ */
function createSkyDome(stage) {
  const skyGeo = new THREE.SphereGeometry(400, 16, 10);
  const skyMat = new THREE.MeshBasicMaterial({
    color: stage.skyColor,
    side:  THREE.BackSide,
  });
  return new THREE.Mesh(skyGeo, skyMat);
}

/* ================================================================
   DISTANT MOUNTAIN SILHOUETTE (on the cliff / far side)
================================================================ */
function createMountainRange(stage) {
  const group = new THREE.Group();
  const mMat  = mat("#1e3a5f", { roughness: 0.95 });

  const peaks = [
    { x: 55, h: 38, w: 22 },
    { x: 72, h: 52, w: 28 },
    { x: 90, h: 42, w: 20 },
    { x: 108, h: 60, w: 32 },
    { x: 125, h: 44, w: 24 },
  ];

  for (const p of peaks) {
    const geo = new THREE.ConeGeometry(p.w / 2, p.h, 6);
    const peak = new THREE.Mesh(geo, mMat);
    peak.position.set(p.x, p.h / 2 - 2, -WORLD_LENGTH / 2);
    peak.castShadow = true;
    group.add(peak);
  }

  return group;
}

/* ================================================================
   MAIN createBackground
================================================================ */
export function createBackground(stageId = "city") {
  const stage  = getStageConfig(stageId);
  const group  = new THREE.Group();
  const rng    = makeRNG(stageId.length * 937 + 41);
  const items  = [];   // recycling list

  /* Ground plane */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, WORLD_LENGTH + 140, 24, 40),
    mat(stage.groundColor, { roughness: 0.94, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.25, -WORLD_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  /* Sky dome */
  const sky = createSkyDome(stage);
  group.add(sky);

  /* Ocean on left side (coastal) */
  const ocean = createOceanPlane(stage);
  if (ocean) group.add(ocean);

  /* Mountain range on right distant background */
  const mountains = createMountainRange(stage);
  group.add(mountains);

  /* === Scenery strip along both sides of road === */
  for (let z = 20; z > -WORLD_LENGTH; z -= 12) {
    for (const side of [-1, 1]) {
      const isCity = stage.scenery === "city" || stage.scenery === "village";
      const isBuilding = isCity && rng() > 0.28;

      // Buildings set back generously so facades never infringe road/sidewalk
      const lateralDist = isBuilding
        ? side * (17.5 + rng() * 6.0)
        : side * (10.5 + rng() * 4.5);

      const pt = getRoadPoint(z, lateralDist);
      const rotOffset = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      const primaryObj = isBuilding
        ? createBuilding(stage, rng, side)
        : createTree(stage, rng);

      primaryObj.position.set(pt.x, pt.y, pt.z);
      primaryObj.rotation.y = pt.heading + rotOffset;
      group.add(primaryObj);
      items.push({
        object: primaryObj,
        lateralDist,
        side,
        rotationOffset: rotOffset,
        roadZ: z,
        yOffset: 0
      });

      /* Street lamp on sidewalk */
      if (rng() > 0.45) {
        const lamp = createStreetLamp();
        const lampLat = side * 7.0; // Cleanly positioned on sidewalk
        const lampPt = getRoadPoint(z - 2, lampLat);
        const lampRotOffset = side > 0 ? -Math.PI : 0;

        lamp.position.set(lampPt.x, lampPt.y + 0.12, lampPt.z);
        lamp.rotation.y = lampPt.heading + lampRotOffset;
        group.add(lamp);
        items.push({
          object: lamp,
          lateralDist: lampLat,
          side,
          rotationOffset: lampRotOffset,
          roadZ: z - 2,
          yOffset: 0.12
        });
      }

      /* Extra trees along sidewalk/verge */
      if (rng() > 0.5) {
        const t2 = createTree(stage, rng);
        const tLat = side * (12.0 + rng() * 6.0);
        const tZ = z + 5;
        const tPt = getRoadPoint(tZ, tLat);
        t2.position.set(tPt.x, tPt.y, tPt.z);
        group.add(t2);
        items.push({
          object: t2,
          lateralDist: tLat,
          side,
          rotationOffset: rotOffset,
          roadZ: tZ,
          yOffset: 0
        });
      }
    }
  }

  group.userData.sceneryObjects  = items;
  group.userData.worldLength     = WORLD_LENGTH;
  group.userData.recycleDistance = RECYCLE_DIST;
  return group;
}

/* ================================================================
   updateBackground — scroll and re-project along curve
================================================================ */
export function updateBackground(background, deltaTime, speed) {
  if (!background) return;

  const items       = background.userData.sceneryObjects ?? [];
  const worldLength = background.userData.worldLength ?? WORLD_LENGTH;
  const recycleDist = background.userData.recycleDistance ?? RECYCLE_DIST;
  const move        = speed * deltaTime;

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
