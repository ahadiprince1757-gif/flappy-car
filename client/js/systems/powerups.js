import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { createBurst } from "./effects.js";
import { playPowerUpSound } from "./audio.js";
import { getRoadPoint } from "../stages/stageRenderer.js";
import { ObjectPool, ObjectManager } from "../core/objectPool.js";

const SPAWN_Z = -85;
const SHIELD_DURATION = 8;
const BOOST_DURATION = 6;
const BOOST_MULTIPLIER = 1.6;
const MAX_POWERUPS = 6;

// Distance-based procedural spawning (meters)
const POWERUP_DISTANCE_MIN = 220;
const POWERUP_DISTANCE_MAX = 380;
let powerupDistanceAccumulator = 0;
let nextPowerupDistanceTarget = 150;

let shieldTimer = 0;
let boostTimer = 0;

// Shared power-up meshes
let sharedIcoGeo = null;
let sharedTorusGeo = null;
let sharedShieldMat = null;
let sharedBoostMat = null;
let sharedShieldRingMat = null;
let sharedBoostRingMat = null;

function getSharedPowerUpAssets() {
  if (!sharedIcoGeo) {
    sharedIcoGeo = new THREE.IcosahedronGeometry(0.48, 1);
    sharedTorusGeo = new THREE.TorusGeometry(0.65, 0.045, 8, 20);

    sharedShieldMat = new THREE.MeshStandardMaterial({
      color: 0x36baff,
      emissive: 0x36baff,
      emissiveIntensity: 0.65,
      metalness: 0.3,
      roughness: 0.25
    });
    sharedBoostMat = new THREE.MeshStandardMaterial({
      color: 0xff7738,
      emissive: 0xff7738,
      emissiveIntensity: 0.65,
      metalness: 0.3,
      roughness: 0.25
    });

    sharedShieldRingMat = new THREE.MeshBasicMaterial({ color: 0x36baff });
    sharedBoostRingMat = new THREE.MeshBasicMaterial({ color: 0xff7738 });
  }
  return {
    sharedIcoGeo,
    sharedTorusGeo,
    sharedShieldMat,
    sharedBoostMat,
    sharedShieldRingMat,
    sharedBoostRingMat
  };
}

export const powerUpPool = new ObjectPool({
  name: "PowerUpPool",
  maxSize: MAX_POWERUPS,
  createFactory: () => {
    const assets = getSharedPowerUpAssets();
    const group = new THREE.Group();

    const orb = new THREE.Mesh(assets.sharedIcoGeo, assets.sharedShieldMat);
    group.add(orb);

    const ring = new THREE.Mesh(assets.sharedTorusGeo, assets.sharedShieldRingMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.visible = false;
    if (gameState.scene) {
      gameState.scene.add(group);
    }

    return {
      type: "shield",
      lane: 2,
      laneOffset: 0,
      group,
      orb,
      ring,
      roadZ: SPAWN_Z,
      active: false,
      phase: 0
    };
  },
  resetFn: (powerUp) => {
    powerUp.active = false;
    if (powerUp.group) {
      powerUp.group.visible = false;
    }
  }
});

ObjectManager.registerPool("powerups", powerUpPool);

export function spawnPowerUp(type = null, lane = null) {
  if (!gameState.scene) return null;

  const chosenType = type || (Math.random() < 0.5 ? "shield" : "boost");
  const chosenLane = lane !== null ? lane : Math.floor(Math.random() * gameState.lanePositions.length);

  const powerUp = powerUpPool.get();
  if (!powerUp) return null;

  if (powerUp.group.parent !== gameState.scene) {
    gameState.scene.add(powerUp.group);
  }

  const assets = getSharedPowerUpAssets();
  powerUp.type = chosenType;
  if (chosenType === "shield") {
    powerUp.orb.material = assets.sharedShieldMat;
    powerUp.ring.material = assets.sharedShieldRingMat;
  } else {
    powerUp.orb.material = assets.sharedBoostMat;
    powerUp.ring.material = assets.sharedBoostRingMat;
  }

  const laneOffset = gameState.lanePositions[chosenLane] || 0;
  const pt = getRoadPoint(SPAWN_Z, laneOffset);

  powerUp.lane = chosenLane;
  powerUp.laneOffset = laneOffset;
  powerUp.roadZ = SPAWN_Z;
  powerUp.phase = Math.random() * Math.PI * 2;
  powerUp.active = true;

  powerUp.group.position.set(pt.x, pt.y + 1.35, pt.z);
  powerUp.group.visible = true;

  if (!gameState.powerUps.includes(powerUp)) {
    gameState.powerUps.push(powerUp);
  }

  return powerUp;
}

function removePowerUp(powerUp) {
  if (!powerUp.active) return;
  powerUpPool.release(powerUp);

  const idx = gameState.powerUps.indexOf(powerUp);
  if (idx !== -1) {
    gameState.powerUps.splice(idx, 1);
  }
}

function collectPowerUp(powerUp) {
  if (!powerUp.active) return;

  const position = powerUp.group.position.clone();
  removePowerUp(powerUp);

  if (powerUp.type === "shield") {
    gameState.shieldActive = true;
    shieldTimer = SHIELD_DURATION;
    createBurst(position, 0x36baff, 16);
  } else {
    gameState.boostActive = true;
    boostTimer = BOOST_DURATION;
    gameState.speed = Math.min(
      gameState.maxSpeed,
      gameState.baseSpeed * BOOST_MULTIPLIER
    );
    createBurst(position, 0xff7738, 16);
  }
}

export function updatePowerUps(deltaTime) {
  if (!gameState.scene || !gameState.player) return;

  const playerPosition = gameState.player.group.position;
  const speed = Math.max(0, gameState.speed);

  // Distance-driven powerup spawner
  if (gameState.status === "playing") {
    powerupDistanceAccumulator += speed * deltaTime;
    if (powerupDistanceAccumulator >= nextPowerupDistanceTarget) {
      powerupDistanceAccumulator = 0;
      nextPowerupDistanceTarget = POWERUP_DISTANCE_MIN + Math.random() * (POWERUP_DISTANCE_MAX - POWERUP_DISTANCE_MIN);
      spawnPowerUp();
    }
  }

  if (shieldTimer > 0) {
    shieldTimer -= deltaTime;
    if (shieldTimer <= 0) {
      shieldTimer = 0;
      gameState.shieldActive = false;
    }
  }

  if (boostTimer > 0) {
    boostTimer -= deltaTime;
    if (boostTimer <= 0) {
      boostTimer = 0;
      gameState.boostActive = false;
      gameState.speed = gameState.baseSpeed;
    }
  }

  for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
    const powerUp = gameState.powerUps[i];
    if (!powerUp.active) {
      gameState.powerUps.splice(i, 1);
      continue;
    }

    powerUp.roadZ += speed * deltaTime;
    const pt = getRoadPoint(powerUp.roadZ, powerUp.laneOffset);

    powerUp.phase += deltaTime * 3;
    powerUp.group.rotation.y += deltaTime * 1.8;

    powerUp.group.position.set(
      pt.x,
      pt.y + 1.35 + Math.sin(powerUp.phase) * 0.14,
      pt.z
    );

    const dx = Math.abs(powerUp.group.position.x - playerPosition.x);
    const dz = Math.abs(powerUp.group.position.z - playerPosition.z);
    const dy = Math.abs(powerUp.group.position.y - playerPosition.y);

    if (dx < 1.35 && dz < 1.8 && dy < 1.8) {
      collectPowerUp(powerUp);
      continue;
    }

    if (powerUp.roadZ > playerPosition.z + 10) {
      removePowerUp(powerUp);
    }
  }
}

export function resetPowerUps() {
  powerUpPool.releaseAll();
  gameState.powerUps.length = 0;
  powerupDistanceAccumulator = 0;
  nextPowerupDistanceTarget = 150;

  shieldTimer = 0;
  boostTimer = 0;
  gameState.shieldActive = false;
  gameState.boostActive = false;
  gameState.speed = gameState.baseSpeed;
}

export function grantTemporaryShield(duration = 4.0) {
  gameState.shieldActive = true;
  shieldTimer = duration;
  if (gameState.player?.group) {
    createBurst(gameState.player.group.position, 0x36baff, 24);
  }
}
