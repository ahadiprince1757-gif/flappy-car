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
                enhanceCarMaterials(group);
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

function enhanceCarMaterials(group, defaultBodyColor = "#06b6d4") {
  group.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;

    const oldMats = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = oldMats.map((m) => {
      const name = (m?.name || child.name || "").toLowerCase();

      // 1. Headlights (intense warm glow)
      if (/headlight/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#fffbe8"),
          emissive: new THREE.Color("#fff7d6"),
          emissiveIntensity: 4.5,
          roughness: 0.15,
          metalness: 0.2,
          side: THREE.DoubleSide,
        });
      }

      // 2. Taillights (intense ruby red glow)
      if (/taillight/i.test(name) || /redlight/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#ff1133"),
          emissive: new THREE.Color("#ff1133"),
          emissiveIntensity: 4.0,
          roughness: 0.15,
          metalness: 0.2,
          side: THREE.DoubleSide,
        });
      }

      // 3. Police blue lights / sirens
      if (/bluelight/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#0066ff"),
          emissive: new THREE.Color("#0088ff"),
          emissiveIntensity: 4.5,
          roughness: 0.15,
          metalness: 0.2,
          side: THREE.DoubleSide,
        });
      }

      // 4. White siren lights
      if (/whitelight/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#ffffff"),
          emissive: new THREE.Color("#ffffff"),
          emissiveIntensity: 4.5,
          roughness: 0.15,
          metalness: 0.2,
          side: THREE.DoubleSide,
        });
      }

      // 5. Windows / Glass (sleek tinted automotive glass)
      if (/window/i.test(name) || /glass/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#1e293b"),
          roughness: 0.12,
          metalness: 0.80,
          transparent: true,
          opacity: 0.80,
          envMapIntensity: 2.0,
          side: THREE.DoubleSide,
        });
      }

      // 6. Tires / Rubber / Black trim
      if (/black/i.test(name) || /tire/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#1f242c"),
          roughness: 0.80,
          metalness: 0.15,
          side: THREE.DoubleSide,
        });
      }

      // 7. Rims / Chrome / Grey metal parts
      if (/grey/i.test(name) || /gray/i.test(name) || /rim/i.test(name) || /metal/i.test(name)) {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#d1d5db"),
          roughness: 0.25,
          metalness: 0.85,
          envMapIntensity: 1.6,
          side: THREE.DoubleSide,
        });
      }

      // 8. Car Body Panels (vibrant automotive paint with gloss clearcoat)
      let bodyColor = new THREE.Color(defaultBodyColor);
      if (m?.color && (m.color.r > 0.08 || m.color.g > 0.08 || m.color.b > 0.08)) {
        bodyColor = m.color.clone();
      }

      return new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.25,       // Gloss clearcoat
        metalness: 0.35,       // Metallic shimmer without darkening
        envMapIntensity: 1.5,
        side: THREE.DoubleSide,
      });
    });

    child.material = Array.isArray(child.material) ? newMats : newMats[0];
  });
}

/**
 * Configure car geometry:
 * 1. Autoscale cm to meters if needed
 * 2. Rotate 180 degrees so car front faces -Z (down the road) cleanly via Object3D
 * 3. Center horizontally and place bottom on ground (y = 0)
 */
function configureCarGroup(group, info) {
  // 1. Auto-detect unit scale if model was exported in cm or tiny normalized space
  const rawBox = new THREE.Box3().setFromObject(group);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);

  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
  let unitScale = 1.0;
  if (maxDim > 20) {
    unitScale = 0.01;
    group.scale.setScalar(unitScale);
  } else if (maxDim < 0.5) {
    unitScale = 4.0 / Math.max(maxDim, 0.001);
    group.scale.setScalar(unitScale);
  }

  // 2. Measure oriented box and align car so length is along Z, width along X, height along Y
  group.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(group);
  let size = new THREE.Vector3();
  box.getSize(size);

  // In Blender/FBX, length is often along Y (causing car to stand vertically on its nose/tail)
  if (size.y > size.z) {
    group.rotation.x = -Math.PI / 2;
    group.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(group);
    box.getSize(size);
  }

  // If length is along X (sideways across the lanes)
  if (size.x > size.z) {
    group.rotation.y += Math.PI / 2;
    group.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(group);
    box.getSize(size);
  }

  // Check front vs back:
  // Headlights must point towards -Z (down the road), taillights towards +Z (camera)
  let headZ = null;
  let tailZ = null;
  group.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || child.material?.name || "").toLowerCase();
    const wp = new THREE.Vector3();
    child.getWorldPosition(wp);
    if (/headlight/i.test(name) && headZ === null) headZ = wp.z;
    if (/taillight|redlight/i.test(name) && tailZ === null) tailZ = wp.z;
  });

  if (headZ !== null && tailZ !== null && headZ > tailZ) {
    group.rotation.y += Math.PI;
    group.updateMatrixWorld(true);
  }

  // Check upside-down:
  // Wheels must be lower than windows/roof
  let wheelY = null;
  let windowY = null;
  group.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || child.material?.name || "").toLowerCase();
    const wp = new THREE.Vector3();
    child.getWorldPosition(wp);
    if (/wheel/i.test(name) && wheelY === null) wheelY = wp.y;
    if (/window|glass/i.test(name) && windowY === null) windowY = wp.y;
  });

  if (wheelY !== null && windowY !== null && wheelY > windowY) {
    group.rotation.z += Math.PI;
    group.updateMatrixWorld(true);
  }

  // 3. Center bounding box horizontally and place bottom of wheels on road (y = 0)
  group.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  group.position.set(-center.x, -box.min.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.add(group);
  wrapper.updateMatrixWorld(true);

  // 4. Exact scale normalization: car length along Z is exactly 4.2m
  const TARGET_CAR_LENGTH = 4.2; // metres
  let finalScale = (info.scale ?? 1.0) * (TARGET_CAR_LENGTH / Math.max(size.z, 0.1));
  wrapper.scale.set(finalScale, finalScale, finalScale);

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

  // Deep clone materials so each instance can be tinted independently without cross-affecting
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map(m => m.clone())
        : child.material.clone();
    }
  });

  // Re-link wheels to this cloned instance
  const wheels = [];
  clone.traverse((child) => {
    if (child.isMesh && (/wheel/i.test(child.name) || /wheel/i.test(child.parent?.name || ""))) {
      wheels.push(child);
    }
  });
  clone.userData.wheels = wheels;

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
      const name = (m.name || obj.name || "").toLowerCase();
      if (/headlight|taillight|redlight|bluelight|whitelight|window|glass|black|tire|grey|gray|rim/i.test(name)) {
        continue;
      }
      m.color.copy(targetColor);
    }
  });
}

export function areCarsReady() {
  return _carsReady;
}
