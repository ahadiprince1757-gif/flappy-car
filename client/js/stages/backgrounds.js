import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { FBXLoader } from "../core/FBXLoader.js";
import { getStageConfig } from "./stages.js";
import { getRoadPoint } from "./stageRenderer.js";

/* ================================================================
   3D FBX CITY BUILDINGS & HIGHWAY SCENERY
   - Loads real 3D building models from FBX with texture atlases
     (Texture_Blue.png, Texture_Dark.png, etc.).
   - Positions them along both sides of the highway facing the road.
   - Smooth atmospheric horizon depth fog.
   - High performance, silky smooth 60 FPS.
================================================================ */

const WORLD_LENGTH = 160;
const RECYCLE_DIST = 35;

const BUILDING_BASE = "./assets/models/buildings/";
const TEXTURE_BASE  = "./assets/textures/buildings/";

// Curated selection of FBX buildings
const FBX_BUILDINGS = [
  { file: "1Story",         stories: 1, type: "shop" },
  { file: "1Story_Sign",    stories: 1, type: "shop" },
  { file: "2Story",         stories: 2, type: "block" },
  { file: "2Story_Columns", stories: 2, type: "civic" },
  { file: "2Story_Balcony", stories: 2, type: "block" },
  { file: "3Story_Balcony", stories: 3, type: "block" },
  { file: "3Story_Small",   stories: 3, type: "block" },
  { file: "4Story",         stories: 4, type: "tower" },
  { file: "6Story_Stack",   stories: 6, type: "tower" },
];

const STAGE_TEXTURES = {
  city:    ["Texture_Blue", "Texture_Light", "Texture_Grey", "Texture_Signs", "Texture_Light2"],
  beach:   ["Texture_Yellow", "Texture_Light", "Texture_Red", "Texture_Light2"],
  jungle:  ["Texture_Green", "Texture_Light", "Texture_Grey", "Texture_Signs"],
  desert:  ["Texture_Yellow", "Texture_Red", "Texture_Light", "Texture_Light2"],
  _default:["Texture_Blue", "Texture_Light", "Texture_Grey", "Texture_Signs"],
};

// Texture cache
const _texLoader = new THREE.TextureLoader();
const _texCache  = new Map();

function getTexture(name) {
  if (_texCache.has(name)) return _texCache.get(name);
  const tex = _texLoader.load(`${TEXTURE_BASE}${name}.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(name, tex);
  return tex;
}

// FBX Model cache
const _buildingCache = new Map();
let _buildingsReady = false;
let _buildingsLoading = false;
const _readyCallbacks = [];

export function preloadBuildingModels(onComplete) {
  if (onComplete) _readyCallbacks.push(onComplete);
  if (_buildingsReady) {
    if (onComplete) onComplete();
    return;
  }
  if (_buildingsLoading) return;
  _buildingsLoading = true;

  const fbxLoader = new FBXLoader();
  fbxLoader.setPath(BUILDING_BASE);

  let pending = FBX_BUILDINGS.length;

  for (const item of FBX_BUILDINGS) {
    fbxLoader.load(
      `${item.file}.fbx`,
      (group) => {
        // Measure raw size and normalize scale so 1 story ≈ 4.5m
        const rawBox = new THREE.Box3().setFromObject(group);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);

        // Blender FBX unit check (if cm, 0.01x)
        if (rawSize.y > 50) {
          group.scale.setScalar(0.01);
        }

        const bbox = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        // Target height based on stories
        const targetH = item.stories * 4.6;
        const scaleF = targetH / (size.y || 1);

        const wrapper = new THREE.Group();
        group.position.set(-bbox.min.x - size.x / 2, -bbox.min.y, -bbox.min.z - size.z / 2);
        wrapper.add(group);
        wrapper.scale.setScalar(scaleF);

        // Shadows
        wrapper.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        _buildingCache.set(item.file, wrapper);
        checkDone();
      },
      undefined,
      (err) => {
        console.warn(`FBX Building load failed: ${item.file}.fbx`, err);
        checkDone();
      }
    );
  }

  function checkDone() {
    pending--;
    if (pending <= 0) {
      _buildingsReady = true;
      _buildingsLoading = false;
      for (const cb of _readyCallbacks) {
        try { cb(); } catch (e) { console.error(e); }
      }
      _readyCallbacks.length = 0;
    }
  }
}

/**
 * Spawn a textured FBX building clone
 */
function spawnFBXBuilding(file, textureName) {
  const proto = _buildingCache.get(file);
  if (!proto) return null;

  const clone = proto.clone(true);
  const tex = getTexture(textureName);

  clone.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.72,
      metalness: 0.18,
      envMapIntensity: 0.4,
    });
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  return clone;
}

/* ── Fallback 3D Building (used while FBX loads) ──────────────── */
const _matCache = new Map();
function getMat(color, opts = {}) {
  const key = `${color}_${opts.roughness ?? 0.7}_${opts.metalness ?? 0.2}_${opts.emissive ?? ""}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0.2,
    emissive:  opts.emissive  ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0
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

function makeRNG(seed) {
  let v = (seed >>> 0) || 1;
  return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
}

function buildFallbackBuilding(stage, rng) {
  const group = new THREE.Group();
  const w = 7.5 + rng() * 2.5;
  const h = 12 + rng() * 16;
  const d = 7.5 + rng() * 2.0;

  const wallColors = stage.buildingColors || ["#1e293b", "#334155", "#0f172a"];
  const wallCol = wallColors[Math.floor(rng() * wallColors.length)];
  box(group, [w, h, d], [0, h / 2, 0], getMat(wallCol, { roughness: 0.6, metalness: 0.3 }));

  const frontZ = d / 2 + 0.08;
  const winMat = getMat("#38bdf8", { emissive: "#0284c7", emissiveIntensity: 0.6 });
  const floors = Math.floor(h / 3.2);
  const cols = Math.floor(w / 2.2);
  for (let f = 1; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + ((c + 0.5) / cols) * w;
      box(group, [0.9, 1.5, 0.12], [wx, f * 3.2, frontZ], winMat, false);
    }
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

  box(group, [0.32, 0.10, 0.16], [0.80, 4.88, 0], getMat("#1e293b", { roughness: 0.5 }), false);
  box(group, [0.24, 0.04, 0.12], [0.80, 4.82, 0],
    getMat("#fef08a", { emissive: "#fef08a", emissiveIntensity: 2.5 }), false);

  return group;
}

/* ── Roadside Tree ───────────────────────────────────────────── */
function createTree(stage) {
  const group = new THREE.Group();
  cyl(group, 0.12, 0.20, 2.8, 6, [0, 1.4, 0], getMat("#3d2212", { roughness: 0.9 }), false);

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

/* ── Panoramic Horizon Backdrop ──────────────────────────────── */
function createHorizonTexture(stage) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const skyColor = stage.skyColor || "#38bdf8";
  const fogColor = stage.fogColor || "#bae6fd";

  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0.0, skyColor);
  skyGrad.addColorStop(0.55, fogColor);
  skyGrad.addColorStop(1.0, fogColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  // Ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, WORLD_LENGTH + 60, 4, 16),
    getMat(stage.groundColor || "#475569", { roughness: 0.95, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -WORLD_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Panoramic horizon backdrop
  const horizon = createHorizonBackdrop(stage);
  group.add(horizon);

  const textures = STAGE_TEXTURES[stageId] || STAGE_TEXTURES._default;

  // 3D Buildings along both sides of highway (every 22m)
  for (let z = 16; z > -WORLD_LENGTH; z -= 22) {
    for (const side of [-1, 1]) {
      const bldgItem = FBX_BUILDINGS[Math.floor(rng() * FBX_BUILDINGS.length)];
      const texName = textures[Math.floor(rng() * textures.length)];

      let bldgObj;
      let isFBX = false;

      if (_buildingsReady) {
        bldgObj = spawnFBXBuilding(bldgItem.file, texName);
        if (bldgObj) isFBX = true;
      }

      if (!bldgObj) {
        bldgObj = buildFallbackBuilding(stage, rng);
      }

      const lateralDist = side * (17.0 + rng() * 2.0);
      const pt = getRoadPoint(z, lateralDist);
      const rotOffset = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      bldgObj.position.set(pt.x, pt.y, pt.z);
      bldgObj.rotation.y = pt.heading + rotOffset;
      group.add(bldgObj);

      items.push({
        object: bldgObj,
        lateralDist,
        side,
        rotationOffset: rotOffset,
        roadZ: z,
        yOffset: 0,
        isBuilding: true,
        fbxFile: bldgItem.file,
        texName,
        isFBX
      });

      // Roadside tree
      if (rng() > 0.3) {
        const tree = createTree(stage);
        const treeDist = side * 11.8;
        const treePt = getRoadPoint(z - 11, treeDist);
        tree.position.set(treePt.x, treePt.y, treePt.z);
        tree.rotation.y = treePt.heading;
        group.add(tree);
        items.push({ object: tree, lateralDist: treeDist, side, rotationOffset: 0, roadZ: z - 11, yOffset: 0 });
      }
    }
  }

  // Street lamps
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

    // Hot-swap fallback → real FBX building when ready
    if (entry.isBuilding && !entry.isFBX && _buildingsReady) {
      const realFBX = spawnFBXBuilding(entry.fbxFile, entry.texName);
      if (realFBX) {
        realFBX.position.copy(obj.position);
        realFBX.rotation.copy(obj.rotation);
        background.remove(obj);
        background.add(realFBX);
        entry.object = realFBX;
        entry.isFBX = true;
      }
    }
  }
}
