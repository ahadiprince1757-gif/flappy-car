import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { loadData, saveData } from "../core/storage.js";
import { createBurst } from "./effects.js";
import { playCoinSound } from "./audio.js";
import { getRoadPoint } from "../stages/stageRenderer.js";
import { ObjectPool, ObjectManager } from "../core/objectPool.js";

const COIN_SPAWN_Z = -85;
const COIN_VALUE = 1;
const COIN_SCORE = 5;
const MAX_COINS = 30; // Bounded pool ceiling

// Distance-based procedural spawning (meters)
const COIN_DISTANCE_INTERVAL_MIN = 45;
const COIN_DISTANCE_INTERVAL_MAX = 75;
let coinDistanceAccumulator = 0;
let nextCoinDistanceTarget = 30;

// Shared reusable geometries and materials for all pooled coins
let sharedCylinderGeo = null;
let sharedTorusGeo = null;
let sharedCoinMat = null;
let sharedRingMat = null;

function getSharedCoinAssets() {
  if (!sharedCylinderGeo) {
    sharedCylinderGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16);
    sharedTorusGeo = new THREE.TorusGeometry(0.43, 0.045, 6, 16);
    sharedCoinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.75,
      roughness: 0.22,
      emissive: 0x805000,
      emissiveIntensity: 0.45
    });
    sharedRingMat = new THREE.MeshBasicMaterial({ color: 0xffef9a });
  }
  return { sharedCylinderGeo, sharedTorusGeo, sharedCoinMat, sharedRingMat };
}

/* ── Coin Pool Definition ────────────────────────────────────────── */
export const coinPool = new ObjectPool({
  name: "CoinPool",
  maxSize: MAX_COINS,
  createFactory: () => {
    const { sharedCylinderGeo, sharedTorusGeo, sharedCoinMat, sharedRingMat } = getSharedCoinAssets();
    const group = new THREE.Group();

    const coin = new THREE.Mesh(sharedCylinderGeo, sharedCoinMat);
    coin.rotation.x = Math.PI / 2;
    group.add(coin);

    const ring = new THREE.Mesh(sharedTorusGeo, sharedRingMat);
    group.add(ring);

    group.visible = false;
    if (gameState.scene) {
      gameState.scene.add(group);
    }

    return {
      type: "coin",
      lane: 2,
      laneOffset: 0,
      group,
      roadZ: COIN_SPAWN_Z,
      active: false,
      phase: 0
    };
  },
  resetFn: (collectible) => {
    collectible.active = false;
    if (collectible.group) {
      collectible.group.visible = false;
    }
  }
});

ObjectManager.registerPool("coins", coinPool);

export function spawnCoin(lane, z) {
  if (!gameState.scene) return null;

  const collectible = coinPool.get();
  if (!collectible) return null;

  if (collectible.group.parent !== gameState.scene) {
    gameState.scene.add(collectible.group);
  }

  const laneOffset = gameState.lanePositions[lane] || 0;
  const pt = getRoadPoint(z, laneOffset);

  collectible.lane = lane;
  collectible.laneOffset = laneOffset;
  collectible.roadZ = z;
  collectible.phase = Math.random() * Math.PI * 2;
  collectible.active = true;

  collectible.group.position.set(pt.x, pt.y + 1.25, pt.z);
  collectible.group.visible = true;

  if (!gameState.collectibles.includes(collectible)) {
    gameState.collectibles.push(collectible);
  }

  return collectible;
}

export function spawnCoinRow(lane = null, count = 4, spacing = 2.8) {
  const chosenLane = lane !== null ? lane : Math.floor(Math.random() * gameState.lanePositions.length);
  for (let i = 0; i < count; i++) {
    spawnCoin(chosenLane, COIN_SPAWN_Z - i * spacing);
  }
}

function collectCoin(collectible) {
  if (!collectible.active) return;

  const position = collectible.group.position.clone();
  coinPool.release(collectible);

  const idx = gameState.collectibles.indexOf(collectible);
  if (idx !== -1) {
    gameState.collectibles.splice(idx, 1);
  }

  gameState.score += COIN_SCORE;
  gameState.runCoins = (gameState.runCoins || 0) + 1;

  const data = loadData();
  data.coins = Math.max(0, Number(data.coins) || 0) + COIN_VALUE;
  saveData(data);
  gameState.coins = data.coins;

  playCoinSound();
  createBurst(position, 0xffd54a, 9);
}

function removeCoin(collectible) {
  if (!collectible.active) return;
  coinPool.release(collectible);

  const idx = gameState.collectibles.indexOf(collectible);
  if (idx !== -1) {
    gameState.collectibles.splice(idx, 1);
  }
}

export function updateCoins(deltaTime) {
  if (!gameState.scene || !gameState.player) return;

  const playerPosition = gameState.player.group.position;
  const speed = Math.max(0, gameState.speed);

  // Distance-driven spawner: spawn coin rows consistently based on highway distance
  if (gameState.status === "playing") {
    coinDistanceAccumulator += speed * deltaTime;
    if (coinDistanceAccumulator >= nextCoinDistanceTarget) {
      coinDistanceAccumulator = 0;
      nextCoinDistanceTarget = COIN_DISTANCE_INTERVAL_MIN + Math.random() * (COIN_DISTANCE_INTERVAL_MAX - COIN_DISTANCE_INTERVAL_MIN);
      spawnCoinRow();
    }
  }

  for (let i = gameState.collectibles.length - 1; i >= 0; i--) {
    const collectible = gameState.collectibles[i];
    if (!collectible.active) {
      gameState.collectibles.splice(i, 1);
      continue;
    }

    collectible.roadZ += speed * deltaTime;
    const pt = getRoadPoint(collectible.roadZ, collectible.laneOffset);

    collectible.phase += deltaTime * 4;
    collectible.group.rotation.y += deltaTime * 2.5;

    collectible.group.position.set(
      pt.x,
      pt.y + 1.25 + Math.sin(collectible.phase) * 0.12,
      pt.z
    );

    const dx = Math.abs(collectible.group.position.x - playerPosition.x);
    const dz = Math.abs(collectible.group.position.z - playerPosition.z);
    const dy = Math.abs(collectible.group.position.y - playerPosition.y);

    if (dx < 1.35 && dz < 1.8 && dy < 1.8) {
      collectCoin(collectible);
      continue;
    }

    // Off-screen boundary cleanup
    if (collectible.roadZ > playerPosition.z + 10) {
      removeCoin(collectible);
    }
  }
}

export function resetCoins() {
  coinPool.releaseAll();
  gameState.collectibles.length = 0;
  coinDistanceAccumulator = 0;
  nextCoinDistanceTarget = 30;

  const data = loadData();
  gameState.coins = Math.max(0, Number(data.coins) || 0);
}
