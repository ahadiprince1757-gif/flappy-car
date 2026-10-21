import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OBJLoader } from "../core/OBJLoader.js";
import { MTLLoader } from "../core/MTLLoader.js";

/* ================================================================
   CAR MODEL LOADER
   Loads and manages real 3D downloaded car models:
   - Cop (Police cruiser with red & blue siren bar)
   - Taxi (NYC-style yellow cab with roof taxi sign)
   - SportsCar (Low-slung aerodynamic sports coupe)
   - SportsCar2 (Aggressive tuner sports car)
   - NormalCar1 (Modern sedan)
   - NormalCar2 (Compact hatchback sedan)
   - SUV (Full-size rugged sport utility vehicle)
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

// Mapping from carId in cars.js to model key
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
 * Preload all car models asynchronously
 */
export function preloadCarModels(onComplete) {
  if (onComplete) _readyCallbacks.push(onComplete);
  if (_carsReady) {
    if (onComplete) onComplete();
    return;
  }
  if (_carsLoading) return;
  _carsLoading = true;

  const mtlLoader = new MTLLoader();
  const objLoader = new OBJLoader();
  const keys = Object.keys(CAR_MODELS);
  let pending = keys.length;

  for (const key of keys) {
    const info = CAR_MODELS[key];
    mtlLoader.setPath(CAR_MODEL_BASE);

    mtlLoader.load(
      `${info.file}.mtl`,
      (materials) => {
        materials.preload();

        // Enhance material aesthetics (add shine to car paint and emissive to lights)
        for (const matName in materials.materials) {
          const m = materials.materials[matName];
          if (/headlight/i.test(matName)) {
            m.emissive = new THREE.Color("#fff7d6");
            m.emissiveIntensity = 2.5;
          } else if (/taillight/i.test(matName) || /redlight/i.test(matName)) {
            m.emissive = new THREE.Color("#ff1133");
            m.emissiveIntensity = 2.0;
          } else if (/bluelight/i.test(matName)) {
            m.emissive = new THREE.Color("#0066ff");
            m.emissiveIntensity = 2.5;
          } else if (/window/i.test(matName)) {
            m.transparent = true;
            m.opacity = 0.85;
          }
        }

        objLoader.setMaterials(materials);
        objLoader.setPath(CAR_MODEL_BASE);
        objLoader.load(
          `${info.file}.obj`,
          (group) => {
            configureCarGroup(group, info);
            _carCache.set(key, group);
            checkDone();
          },
          undefined,
          (err) => {
            console.warn(`Failed to load OBJ for car: ${info.file}`, err);
            checkDone();
          }
        );
      },
      undefined,
      (err) => {
        console.warn(`Failed to load MTL for car: ${info.file}`, err);
        // Fallback: load OBJ without MTL
        objLoader.setMaterials(null);
        objLoader.setPath(CAR_MODEL_BASE);
        objLoader.load(
          `${info.file}.obj`,
          (group) => {
            configureCarGroup(group, info);
            _carCache.set(key, group);
            checkDone();
          },
          undefined,
          () => checkDone()
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

/**
 * Configure car pivot, orientation, shadows, and wheel references
 */
function configureCarGroup(group, info) {
  // Center bbox horizontally, sit bottom on ground (y=0)
  const bbox = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  // Shift geometry so base sits on ground at y=0, centered at (0,0)
  group.position.set(-center.x, -bbox.min.y, -center.z);

  // Rotate the inner mesh 180 deg so car front faces inward down the highway (-Z)
  const innerPivot = new THREE.Group();
  innerPivot.add(group);
  innerPivot.rotation.y = Math.PI;

  const wrapper = new THREE.Group();
  wrapper.add(innerPivot);

  const scale = info.scale ?? 1.0;
  wrapper.scale.set(scale, scale, scale);

  // Enable shadow casting and receiving on all meshes
  const wheels = [];
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (/wheel/i.test(child.name) || /wheel/i.test(child.parent?.name || "")) {
        wheels.push(child);
      }
    }
  });

  wrapper.userData.wheels = wheels;
  return wrapper;
}

/**
 * Instantiate a car model by modelKey or carId
 * Returns a THREE.Group or null if not yet loaded
 */
export function spawnCarModel(carIdOrKey, options = {}) {
  const key = CAR_ID_TO_MODEL[carIdOrKey] || carIdOrKey;
  const proto = _carCache.get(key);
  if (!proto) return null;

  const clone = proto.clone(true);

  // Custom tinting if requested
  if (options.bodyColor) {
    tintCarBody(clone, options.bodyColor);
  }

  return clone;
}

/**
 * Tint body paint of car clone
 */
export function tintCarBody(carGroup, hexColor) {
  const targetColor = new THREE.Color(hexColor);
  carGroup.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      // Don't tint windows, wheels, or lights
      if (/headlight/i.test(m.name) || /taillight/i.test(m.name) ||
          /redlight/i.test(m.name) || /bluelight/i.test(m.name) ||
          /window/i.test(m.name) || /black/i.test(m.name) || /grey/i.test(m.name)) {
        continue;
      }
      m.color.copy(targetColor);
    }
  });
}

/**
 * Check if models are loaded
 */
export function areCarsReady() {
  return _carsReady;
}
