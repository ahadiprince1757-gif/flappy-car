import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { FBXLoader } from "../core/FBXLoader.js";
import { OBJLoader } from "../core/OBJLoader.js";
import { MTLLoader } from "../core/MTLLoader.js";

/* ================================================================
   CAR MODEL LOADER (FBX Primary with OBJ Fallback)
   Loads real 3D downloaded car models from FBX:
   - Cop.fbx (Police cruiser with red & blue siren bar)
   - Taxi.fbx (NYC-style yellow cab with roof taxi sign)
   - SportsCar.fbx (Low-slung aerodynamic sports coupe)
   - SportsCar2.fbx (Aggressive tuner sports car)
   - NormalCar1.fbx (Modern sedan)
   - NormalCar2.fbx (Compact hatchback sedan)
   - SUV.fbx (Full-size rugged sport utility vehicle)
================================================================ */

const CAR_MODEL_BASE = "./assets/models/cars/";

export const CAR_MODELS = {
  cop:        { file: "Cop",        name: "Highway Patrol", type: "police", scale: 1.0 },
  taxi:       { file: "Taxi",       name: "Metro Cab",      type: "taxi",   scale: 1.0 },
  sport:      { file: "SportsCar",  name: "Cyber GT",       type: "sport",  scale: 1.0 },
  sport2:     { file: "SportsCar2", name: "Inferno V8",     type: "muscle", scale: 1.0 },
  sedan:      { file: "NormalCar1", name: "Urban Cruiser",  type: "sedan",  scale: 1.0 },
  hatchback:  { file: "NormalCar2", name: "Neon Apex",      type: "hatch",  scale: 1.0 },
  suv:        { file: "SUV",        name: "Phantom SUV",    type: "suv",    scale: 1.08 },
};

export const CAR_ID_TO_MODEL = {
  cyber:    "sport",
  inferno:  "sport2",
  neon:     "hatchback",
  phantom:  "suv",
  taxi:     "taxi",
  cop:      "cop",
  cruiser:  "sedan",
};

const _carCache = new Map();
let _carsLoading = false;
let _carsReady = false;
const _readyCallbacks = [];

/**
 * Preload all car models asynchronously via FBX
 */
export function preloadCarModels(onComplete) {
  if (onComplete) _readyCallbacks.push(onComplete);
  if (_carsReady) {
    if (onComplete) onComplete();
    return;
  }
  if (_carsLoading) return;
  _carsLoading = true;

  const fbxLoader = new FBXLoader();
  const mtlLoader = new MTLLoader();
  const objLoader = new OBJLoader();

  const keys = Object.keys(CAR_MODELS);
  let pending = keys.length;

  for (const key of keys) {
    const info = CAR_MODELS[key];
    fbxLoader.setPath(CAR_MODEL_BASE);

    // 1. Try loading FBX first
    fbxLoader.load(
      `${info.file}.fbx`,
      (group) => {
        enhanceCarMaterials(group);
        const configured = configureCarGroup(group, info);
        _carCache.set(key, configured);
        checkDone();
      },
      undefined,
      (err) => {
        console.warn(`FBX load failed for ${info.file}.fbx, falling back to OBJ...`, err);
        // 2. Fallback to OBJ + MTL
        mtlLoader.setPath(CAR_MODEL_BASE);
        mtlLoader.load(
          `${info.file}.mtl`,
          (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.setPath(CAR_MODEL_BASE);
            objLoader.load(
              `${info.file}.obj`,
              (group) => {
                enhanceCarMaterials(group);
                const configured = configureCarGroup(group, info);
                _carCache.set(key, configured);
                checkDone();
              },
              undefined,
              () => checkDone()
            );
          },
          undefined,
          () => {
            objLoader.setMaterials(null);
            objLoader.setPath(CAR_MODEL_BASE);
            objLoader.load(
              `${info.file}.obj`,
              (group) => {
                const configured = configureCarGroup(group, info);
                _carCache.set(key, configured);
                checkDone();
              },
              undefined,
              () => checkDone()
            );
          }
        );
      }
    );
  }

  function checkDone() {
    pending--;
    if (pending <= 0) {
      _carsReady = true;
      _carsLoading = false;
      for (const cb of _readyCallbacks) {
        try { cb(); } catch (e) { console.error(e); }
      }
      _readyCallbacks.length = 0;
    }
  }
}

function enhanceCarMaterials(group) {
  group.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      const name = m.name || "";
      if (/headlight/i.test(name)) {
        m.emissive = new THREE.Color("#fff7d6");
        m.emissiveIntensity = 2.5;
      } else if (/taillight/i.test(name) || /redlight/i.test(name)) {
        m.emissive = new THREE.Color("#ff1133");
        m.emissiveIntensity = 2.0;
      } else if (/bluelight/i.test(name)) {
        m.emissive = new THREE.Color("#0066ff");
        m.emissiveIntensity = 2.5;
      } else if (/window/i.test(name)) {
        m.transparent = true;
        m.opacity = 0.85;
      }
    }
  });
}

/**
 * Configure car geometry:
 * 1. Rotate vertices by 180 deg so car front faces inward (-Z) down the highway
 * 2. Autoscale cm to meters if needed
 * 3. Center horizontally and place bottom on ground (y = 0)
 */
function configureCarGroup(group, info) {
  // Measure raw bounding box
  const rawBox = new THREE.Box3().setFromObject(group);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);

  // If exported in cm (size > 20m), normalize to meters (0.01x)
  if (rawSize.z > 20 || rawSize.x > 20) {
    group.scale.setScalar(0.01);
  }

  // 1. Permanently rotate all mesh geometries 180 degrees so front faces -Z (down the road)
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.rotateY(Math.PI);
      child.geometry.computeVertexNormals();
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // 2. Center bounding box horizontally and place bottom on ground (y = 0)
  const bbox = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  group.position.set(-center.x, -bbox.min.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.add(group);

  const scale = info.scale ?? 1.0;
  wrapper.scale.set(scale, scale, scale);

  // Collect wheel references for wheel spin animation
  const wheels = [];
  group.traverse((child) => {
    if (child.isMesh && (/wheel/i.test(child.name) || /wheel/i.test(child.parent?.name || ""))) {
      wheels.push(child);
    }
  });

  wrapper.userData.wheels = wheels;
  return wrapper;
}

/**
 * Instantiate a car model by modelKey or carId
 */
export function spawnCarModel(carIdOrKey, options = {}) {
  const key = CAR_ID_TO_MODEL[carIdOrKey] || carIdOrKey;
  const proto = _carCache.get(key);
  if (!proto) return null;

  const clone = proto.clone(true);

  if (options.bodyColor) {
    tintCarBody(clone, options.bodyColor);
  }

  return clone;
}

export function tintCarBody(carGroup, hexColor) {
  const targetColor = new THREE.Color(hexColor);
  carGroup.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (/headlight/i.test(m.name) || /taillight/i.test(m.name) ||
          /redlight/i.test(m.name) || /bluelight/i.test(m.name) ||
          /window/i.test(m.name) || /black/i.test(m.name) || /grey/i.test(m.name)) {
        continue;
      }
      m.color.copy(targetColor);
    }
  });
}

export function areCarsReady() {
  return _carsReady;
}
