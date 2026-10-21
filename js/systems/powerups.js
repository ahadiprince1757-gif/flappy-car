import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { createBurst } from "./effects.js";
import { playPowerUpSound } from "./audio.js";
import { getRoadPoint } from "../stages/stageRenderer.js";

const SPAWN_Z = -85;
const SPAWN_INTERVAL_MIN = 12;
const SPAWN_INTERVAL_MAX = 19;

const SHIELD_DURATION = 8;
const BOOST_DURATION = 6;
const BOOST_MULTIPLIER = 1.6;

let spawnTimer = 8;
let shieldTimer = 0;
let boostTimer = 0;

function createPowerUp(type, lane, z) {
  const group = new THREE.Group();
  const color = type === "shield" ? 0x36baff : 0xff7738;

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.48, 1),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.65,
      metalness: 0.3,
      roughness: 0.25
    })
  );
  group.add(orb);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.045, 8, 24),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const laneOffset = gameState.lanePositions[lane] || 0;
  const pt = getRoadPoint(z, laneOffset);

  group.position.set(
    pt.x,
    pt.y + 1.35,
    pt.z
  );

  gameState.scene.add(group);

  const powerUp = {
    type,
    lane,
    laneOffset,
    group,
    roadZ: z,
    active: true,
    phase: Math.random() * Math.PI * 2
  };

  gameState.powerUps.push(powerUp);
  return powerUp;
}

function spawnPowerUp() {
  const lane = Math.floor(Math.random() * gameState.lanePositions.length);
  const type = Math.random() < 0.5 ? "shield" : "boost";
  createPowerUp(type, lane, SPAWN_Z);
}

function removePowerUp(powerUp) {
  if (!powerUp.active) return;
  powerUp.active = false;
  gameState.scene?.remove(powerUp.group);
}

function collectPowerUp(powerUp) {
  if (!powerUp.active) return;

  const position = powerUp.group.position.clone();
  powerUp.active = false;
  gameState.scene?.remove(powerUp.group);

  if (powerUp.type === "shield") {
    gameState.shieldActive = true;
    shieldTimer = SHIELD_DURATION;
    createBurst(position, 0x36baff, 16);
    playPowerUpSound();
  } else {
    gameState.boostActive = true;
    boostTimer = BOOST_DURATION;
    gameState.speed = Math.min(
      gameState.maxSpeed,
      gameState.baseSpeed * BOOST_MULTIPLIER
    );
    createBurst(position, 0xff7738, 16);
    playPowerUpSound();
  }
}

export function updatePowerUps(deltaTime) {
  if (!gameState.scene || !gameState.player) return;

  spawnTimer -= deltaTime;
  if (spawnTimer <= 0) {
    spawnPowerUp();
    spawnTimer =
      SPAWN_INTERVAL_MIN +
      Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
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

  const playerPosition = gameState.player.group.position;

  for (const powerUp of [...gameState.powerUps]) {
    if (!powerUp.active) continue;

    powerUp.roadZ = (powerUp.roadZ ?? powerUp.group.position.z) + gameState.speed * deltaTime;
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

    if (powerUp.roadZ > playerPosition.z + 18) {
      removePowerUp(powerUp);
    }
  }

  gameState.powerUps = gameState.powerUps.filter(
    (powerUp) => powerUp.active
  );
}

export function resetPowerUps() {
  for (const powerUp of gameState.powerUps) {
    gameState.scene?.remove(powerUp.group);
  }

  gameState.powerUps = [];
  spawnTimer = 8;
  shieldTimer = 0;
  boostTimer = 0;

  gameState.shieldActive = false;
  gameState.boostActive = false;
  gameState.speed = gameState.baseSpeed;
}
