import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OBJLoader } from "../core/OBJLoader.js";
import { MTLLoader } from "../core/MTLLoader.js";
import { getStageConfig } from "./stages.js";
import { getRoadPoint } from "./stageRenderer.js";

/* ================================================================
   Ultra-premium background: real downloaded building models with
   city textures, coastal ocean, mountain cliffs, detailed 3D trees,
   richly detailed shop buildings, modern street furniture, and
   atmospheric sky dome.
================================================================ */

const WORLD_LENGTH  = 260;
const RECYCLE_DIST  = 50;

// Base path for assets (relative to index.html)
const MODEL_BASE    = "./assets/models/buildings/";
const TEXTURE_BASE  = "./assets/textures/buildings/";

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
   REAL BUILDING LOADER
   Loads downloaded OBJ+MTL city building models with stage-themed
   texture swaps. Buildings auto-scale so 1-story ~ 5m, 4-story ~20m.
================================================================ */

// Building catalogue — each entry matches a downloaded OBJ file
const BUILDING_CATALOGUE = [
  { file: "1Story",          stories: 1, type: "shop"   },
  { file: "1Story_GableRoof",stories: 1, type: "house"  },
  { file: "1Story_Sign",     stories: 1, type: "shop"   },
  { file: "2Story",          stories: 2, type: "block"  },
  { file: "2Story_Balcony",  stories: 2, type: "block"  },
  { file: "2Story_Columns",  stories: 2, type: "civic"  },
  { file: "2Story_Double",   stories: 2, type: "block"  },
  { file: "2Story_Sign",     stories: 2, type: "shop"   },
  { file: "2Story_Wide",     stories: 2, type: "block"  },
  { file: "3Story_Balcony",  stories: 3, type: "block"  },
  { file: "3Story_Small",    stories: 3, type: "block"  },
  { file: "4Story",          stories: 4, type: "tower"  },
  { file: "4Story_Center",   stories: 4, type: "tower"  },
  { file: "6Story_Stack",    stories: 6, type: "tower"  },
];

// Stage-to-texture mapping — picks building texture by stage mood
const STAGE_TEXTURES = {
  city:    ["Texture_DarkBlue", "Texture_Dark", "Texture_Grey", "Texture_Blue"],
  desert:  ["Texture_Yellow",   "Texture_Red",  "Texture_Light", "Texture_Light2"],
  forest:  ["Texture_Green",    "Texture_Light","Texture_Grey",  "Texture_DarkPurple"],
  night:   ["Texture_Dark",     "Texture_DarkPurple","Texture_DarkBlue","Texture_Casino"],
  snow:    ["Texture_Light",    "Texture_Light2","Texture_Blue",  "Texture_Grey"],
  _default:["Texture_Grey",     "Texture_Blue", "Texture_Dark",  "Texture_Light"],
};

// Preloaded model cache: file -> THREE.Group prototype
const _modelCache = new Map();
let   _cacheReady = false;
const _pendingCallbacks = [];

// Scale factor: Blender units are roughly 1 unit = 1m in the OBJs,
// but the building extents at 1x are ~1.0 unit wide and 1.0 tall per story.
// We scale up so 1 story = ~5m in our world.
const BLENDER_SCALE = 5.0;

// Texture loader shared
const _texLoader = new THREE.TextureLoader();
const _texCache  = new Map();

function loadTexture(name) {
  if (_texCache.has(name)) return _texCache.get(name);
  const tex = _texLoader.load(`${TEXTURE_BASE}${name}.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(name, tex);
  return tex;
}

function applyBuildingTexture(group, textureName, stageConfig) {
  const tex = loadTexture(textureName);

  // Apply the atlas texture to all meshes in the loaded OBJ
  group.traverse(obj => {
    if (!obj.isMesh) return;
    const oldMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;

    obj.material = new THREE.MeshStandardMaterial({
      map:         tex,
      roughness:   0.72,
      metalness:   0.15,
      envMapIntensity: 0.4,
    });
    obj.castShadow    = true;
    obj.receiveShadow = true;

    if (oldMat) oldMat.dispose();
  });
}

/**
 * Load all building OBJs into cache asynchronously.
 * When done, fire any pending callbacks.
 */
export function preloadBuildingModels() {
  if (_cacheReady) return;

  const mtlLoader = new MTLLoader();
  const objLoader = new OBJLoader();
  let   pending   = BUILDING_CATALOGUE.length;

  for (const entry of BUILDING_CATALOGUE) {
    const { file } = entry;
    mtlLoader.setPath(MODEL_BASE);
    mtlLoader.load(`${file}.mtl`, (materials) => {
      materials.preload();
      objLoader.setMaterials(materials);
      objLoader.setPath(MODEL_BASE);
      objLoader.load(`${file}.obj`, (group) => {
        // Normalise scale and pivot to ground
        const bbox = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        // Shift so Y-min = 0 (sits on ground)
        group.position.y = -bbox.min.y;

        const wrapper = new THREE.Group();
        wrapper.add(group);
        // Scale so total height = stories * 5m
        const targetH = entry.stories * BLENDER_SCALE;
        const scaleF  = targetH / (size.y || 1);
        wrapper.scale.setScalar(scaleF);

        _modelCache.set(file, wrapper);

        pending--;
        if (pending === 0) {
          _cacheReady = true;
          for (const cb of _pendingCallbacks) cb();
          _pendingCallbacks.length = 0;
        }
      }, undefined, (err) => {
        console.warn(`Building OBJ load failed: ${file}`, err);
        pending--;
        if (pending === 0) {
          _cacheReady = true;
          for (const cb of _pendingCallbacks) cb();
          _pendingCallbacks.length = 0;
        }
      });
    }, undefined, (err) => {
      console.warn(`Building MTL load failed: ${file}.mtl`, err);
      // Still try loading OBJ without MTL
      objLoader.setMaterials(null);
      objLoader.setPath(MODEL_BASE);
      objLoader.load(`${file}.obj`, (group) => {
        const bbox = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        group.position.y = -bbox.min.y;
        const wrapper = new THREE.Group();
        wrapper.add(group);
        const targetH = entry.stories * BLENDER_SCALE;
        const scaleF  = targetH / (size.y || 1);
        wrapper.scale.setScalar(scaleF);
        _modelCache.set(file, wrapper);
        pending--;
        if (pending === 0) {
          _cacheReady = true;
          for (const cb of _pendingCallbacks) cb();
          _pendingCallbacks.length = 0;
        }
      }, undefined, () => {
        _modelCache.set(file, null);
        pending--;
        if (pending === 0) {
          _cacheReady = true;
          for (const cb of _pendingCallbacks) cb();
          _pendingCallbacks.length = 0;
        }
      });
    });
  }
}

/**
 * Clone a model from cache and apply the right texture.
 * Returns a THREE.Group or null if not yet loaded / failed.
 */
function spawnBuildingModel(file, stageId, textureName) {
  const proto = _modelCache.get(file);
  if (!proto) return null;

  const clone = proto.clone(true);
  applyBuildingTexture(clone, textureName, getStageConfig(stageId));
  return clone;
}

/* ================================================================
   PROCEDURAL fallback building — used while models load or for forest/desert
================================================================ */
function createFallbackBuilding(stage, rng, sideSign) {
  const group = new THREE.Group();
  const w = 6  + rng() * 5;
  const h = 12 + rng() * 28;
  const d = 6  + rng() * 4;

  const palette = stage.buildingColors ?? ["#334155","#475569","#1e293b","#0f172a"];
  const wallCol = palette[Math.floor(rng() * palette.length)];

  box(group, [w + 2.4, 0.5, d + 2.4], [0, 0.25, 0],
    mat("#4b5563", { roughness: 0.9 }), false);
  box(group, [w, h, d], [0, h / 2 + 0.5, 0],
    mat(wallCol, { roughness: 0.65, metalness: 0.25 }));

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#bae6fd", emissive: "#38bdf8", emissiveIntensity: 0.28,
    roughness: 0.08, metalness: 0.55, transparent: true, opacity: 0.82,
  });
  const frontZ = d / 2 + 0.06;
  box(group, [w * 0.78, h * 0.72, 0.15], [0, h * 0.55, frontZ], glassMat, false);

  const awningCols = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899"];
  const awCol = awningCols[Math.floor(rng() * awningCols.length)];
  const aw = box(group, [w * 0.85, 0.22, 0.85], [0, 3.9, frontZ + 0.42],
    mat(awCol, { roughness: 0.55 }));
  aw.rotation.x = 0.2;

  box(group, [w * 0.70, 1.0, 0.22], [0, 4.8, frontZ + 0.12],
    mat("#0f172a", { emissive: awCol, emissiveIntensity: 0.7, roughness: 0.2 }), false);

  const winMat = new THREE.MeshStandardMaterial({
    color: "#e0f2fe", emissive: "#38bdf8",
    emissiveIntensity: rng() > 0.5 ? 0.6 : 0.2, roughness: 0.1,
  });
  const floors = Math.floor((h - 6) / 3.0);
  const cols   = Math.floor(w / 2.1);
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + ((c + 0.5) / cols) * w;
      const wy = 6.5 + f * 2.95;
      box(group, [0.9, 1.5, 0.12], [wx, wy, frontZ + 0.02], winMat, false);
      box(group, [0.12, 1.5, 0.9], [sideSign * (w / 2 + 0.04), wy, (rng() - 0.5) * d * 0.6],
        winMat, false);
    }
  }

  box(group, [w * 0.5, 0.8, d * 0.5], [0, h + 0.9, 0],
    mat("#1e293b", { roughness: 0.5, metalness: 0.6 }));
  box(group, [1.4, 1.0, 1.4], [w * 0.2, h + 1.3, 0],
    mat("#374151", { roughness: 0.5, metalness: 0.7 }));
  cyl(group, 0.02, 0.04, 3.5, 6, [0, h + 3.2, 0],
    mat("#64748b", { roughness: 0.4, metalness: 0.9 }));

  return group;
}

/* ================================================================
   TREE — ultra-lush multi-tier foliage with visible trunk detail
================================================================ */
function createTree(stage, rng) {
  const group    = new THREE.Group();
  const isJungle = stage.scenery === "jungle";
  const trunkH   = 2.4 + rng() * 0.9;

  cyl(group, 0.14, 0.22, trunkH, 8, [0, trunkH / 2, 0],
    mat("#3b1a08", { roughness: 0.92, metalness: 0.0 }));

  const palette = isJungle
    ? ["#14532d","#15803d","#166534","#16a34a"]
    : ["#1a4731","#2d6a4f","#40916c","#52b788"];

  const layers = isJungle ? 3 : 2;
  for (let l = 0; l < layers; l++) {
    const r    = (layers - l) * 0.45 + 0.85 + rng() * 0.25;
    const yOff = trunkH + l * 0.75 + 0.2;
    const lMat = mat(palette[Math.floor(rng() * palette.length)], { roughness: 0.75 });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), lMat);
    canopy.position.set((rng() - 0.5) * 0.25, yOff, (rng() - 0.5) * 0.25);
    canopy.scale.set(1, 0.82, 1);
    canopy.castShadow = true;
    group.add(canopy);
  }
  return group;
}

/* ================================================================
   STREET LAMP — modern cobra-head style
================================================================ */
function createStreetLamp() {
  const group = new THREE.Group();
  const pMat  = mat("#334155", { roughness: 0.35, metalness: 0.85 });

  cyl(group, 0.05, 0.11, 5.4, 8, [0, 2.7, 0], pMat);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6), pMat);
  arm.rotation.z = Math.PI / 3.4;
  arm.position.set(0.44, 5.15, 0);
  group.add(arm);

  box(group, [0.32, 0.10, 0.18], [0.84, 5.0, 0],
    mat("#1e293b", { roughness: 0.4, metalness: 0.7 }));
  box(group, [0.26, 0.03, 0.14], [0.84, 4.93, 0],
    new THREE.MeshStandardMaterial({
      color: "#fef9c3", emissive: "#fde68a",
      emissiveIntensity: 2.8, roughness: 0.1,
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
   SKY DOME
================================================================ */
function createSkyDome(stage) {
  const skyGeo = new THREE.SphereGeometry(400, 16, 10);
  const skyMat = new THREE.MeshBasicMaterial({ color: stage.skyColor, side: THREE.BackSide });
  return new THREE.Mesh(skyGeo, skyMat);
}

/* ================================================================
   MOUNTAIN RANGE
================================================================ */
function createMountainRange(stage) {
  const group = new THREE.Group();
  const mMat  = mat("#1e3a5f", { roughness: 0.95 });
  const peaks = [
    { x: 55, h: 38, w: 22 }, { x: 72, h: 52, w: 28 },
    { x: 90, h: 42, w: 20 }, { x: 108, h: 60, w: 32 },
    { x: 125, h: 44, w: 24 },
  ];
  for (const p of peaks) {
    const geo  = new THREE.ConeGeometry(p.w / 2, p.h, 6);
    const peak = new THREE.Mesh(geo, mMat);
    peak.position.set(p.x, p.h / 2 - 2, -WORLD_LENGTH / 2);
    peak.castShadow = true;
    group.add(peak);
  }
  return group;
}

/* ================================================================
   Select a building from catalogue given RNG + stage
================================================================ */
function pickBuilding(rng, stageId) {
  const catalogue = BUILDING_CATALOGUE;
  const entry     = catalogue[Math.floor(rng() * catalogue.length)];
  const textures  = STAGE_TEXTURES[stageId] || STAGE_TEXTURES._default;
  const texName   = textures[Math.floor(rng() * textures.length)];
  return { entry, texName };
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
  ground.position.set(0, -0.02, -WORLD_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  group.add(createSkyDome(stage));

  const ocean = createOceanPlane(stage);
  if (ocean) group.add(ocean);
  group.add(createMountainRange(stage));

  /* 1. Street Lamps every 44m */
  for (let z = 10; z > -WORLD_LENGTH; z -= 44) {
    for (const side of [-1, 1]) {
      const lamp       = createStreetLamp();
      const lampLat    = side * 8.6;
      const lampPt     = getRoadPoint(z, lampLat);
      const rotOffset  = side > 0 ? -Math.PI : 0;
      lamp.position.set(lampPt.x, lampPt.y + 0.08, lampPt.z);
      lamp.rotation.y  = lampPt.heading + rotOffset;
      group.add(lamp);
      items.push({ object: lamp, lateralDist: lampLat, side, rotationOffset: rotOffset, roadZ: z, yOffset: 0.08 });
    }
  }

  /* 2. Buildings & Trees every 22m */
  for (let z = 18; z > -WORLD_LENGTH; z -= 22) {
    for (const side of [-1, 1]) {
      const isCity = stage.scenery === "city" || stage.scenery === "village";
      const isBuilding = isCity && ((Math.abs(Math.round(z / 22)) % 2 === 0) || rng() > 0.35);

      const lateralDist = isBuilding
        ? side * (18.5 + rng() * 2.5)
        : side * (12.8 + rng() * 1.5);

      const pt        = getRoadPoint(z, lateralDist);
      const rotOffset = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      let primaryObj;

      if (isBuilding && _cacheReady) {
        // Use real downloaded building model
        const { entry, texName } = pickBuilding(rng, stageId);
        const model = spawnBuildingModel(entry.file, stageId, texName);
        if (model) {
          primaryObj = model;
          // Face buildings towards road
          primaryObj.rotation.y = rotOffset;
        } else {
          primaryObj = createFallbackBuilding(stage, rng, side);
        }
      } else if (isBuilding) {
        // Models not yet loaded — use procedural building
        // Register a callback to swap to real model later
        primaryObj = createFallbackBuilding(stage, rng, side);
      } else {
        primaryObj = createTree(stage, rng);
      }

      primaryObj.position.set(pt.x, pt.y, pt.z);
      primaryObj.rotation.y = pt.heading + rotOffset;
      group.add(primaryObj);
      items.push({
        object: primaryObj,
        lateralDist,
        side,
        rotationOffset: rotOffset,
        roadZ: z,
        yOffset: 0,
        isBuilding,
        stageId,
        // Store rng snapshot for deferred model swaps
        _buildingFile: isBuilding ? (() => {
          const { entry, texName } = pickBuilding(makeRNG(Math.abs(z * 7 + side * 13)), stageId);
          return { file: entry.file, texName };
        })() : null,
      });
    }
  }

  group.userData.sceneryObjects  = items;
  group.userData.worldLength     = WORLD_LENGTH;
  group.userData.recycleDistance = RECYCLE_DIST;
  group.userData.stageId         = stageId;
  return group;
}

/* ================================================================
   updateBackground — scroll and re-project along curve.
   When models finish loading, swaps procedural fallbacks for real models.
================================================================ */
export function updateBackground(background, deltaTime, speed) {
  if (!background) return;

  const items       = background.userData.sceneryObjects ?? [];
  const worldLength = background.userData.worldLength ?? WORLD_LENGTH;
  const recycleDist = background.userData.recycleDistance ?? RECYCLE_DIST;
  const stageId     = background.userData.stageId ?? "city";
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

    // Lazy-swap procedural fallback → real OBJ model after cache ready
    if (entry.isBuilding && entry._buildingFile && _cacheReady && !entry._modelLoaded) {
      const { file, texName } = entry._buildingFile;
      const realModel = spawnBuildingModel(file, stageId, texName);
      if (realModel) {
        realModel.position.copy(obj.position);
        realModel.rotation.copy(obj.rotation);
        background.remove(obj);
        background.add(realModel);
        entry.object     = realModel;
        entry._modelLoaded = true;
      }
    }
  }
}
