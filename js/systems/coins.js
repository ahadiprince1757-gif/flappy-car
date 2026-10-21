import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { loadData, saveData } from "../core/storage.js";
import { createBurst } from "./effects.js";
import { playCoinSound } from "./audio.js";
import { getRoadPoint } from "../stages/stageRenderer.js";

const COIN_SPAWN_Z = -85;
const COIN_SPAWN_INTERVAL = 2.6;
const COIN_VALUE = 1;
const COIN_SCORE = 5;

let spawnTimer = 1.5;

function createCoin(lane, z) {
  const group = new THREE.Group();

  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.12, 20),
    new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.75,
      roughness: 0.22,
      emissive: 0x805000,
      emissiveIntensity: 0.45
    })
  );

  coin.rotation.x = Math.PI / 2;
  group.add(coin);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.045, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xffef9a })
  );
  group.add(ring);

  const laneOffset = gameState.lanePositions[lane] || 0;
  const pt = getRoadPoint(z, laneOffset);

  group.position.set(
    pt.x,
    pt.y + 1.25,
    pt.z
  );

  gameState.scene.add(group);

  const collectible = {
    type: "coin",
    lane,
    laneOffset,
    group,
    roadZ: z,
    active: true,
    phase: Math.random() * Math.PI * 2
  };

  gameState.collectibles.push(collectible);
  return collectible;
}

function spawnCoinRow() {
  const lane = Math.floor(Math.random() * gameState.lanePositions.length);
  const count = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i += 1) {
    createCoin(lane, COIN_SPAWN_Z - i * 2.8);
  }
}

function collectCoin(collectible) {
  if (!collectible.active) return;

  collectible.active = false;
  const position = collectible.group.position.clone();

  gameState.scene.remove(collectible.group);
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

  collectible.active = false;
  gameState.scene?.remove(collectible.group);
}

export function updateCoins(deltaTime) {
  if (!gameState.scene || !gameState.player) return;

  spawnTimer -= deltaTime;
  if (spawnTimer <= 0) {
    spawnCoinRow();
    spawnTimer = COIN_SPAWN_INTERVAL + Math.random() * 1.5;
  }

  const playerPosition = gameState.player.group.position;

  for (const collectible of [...gameState.collectibles]) {
    if (!collectible.active) {
      const inactiveIndex = gameState.collectibles.indexOf(collectible);
      if (inactiveIndex !== -1) {
        gameState.collectibles.splice(inactiveIndex, 1);
      }
      continue;
    }

    collectible.roadZ = (collectible.roadZ ?? collectible.group.position.z) + gameState.speed * deltaTime;
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

    if (collectible.roadZ > playerPosition.z + 18) {
      removeCoin(collectible);
    }
  }

  gameState.collectibles = gameState.collectibles.filter(
    (item) => item.active
  );
}

export function resetCoins() {
  for (const collectible of gameState.collectibles) {
    gameState.scene?.remove(collectible.group);
  }

  gameState.collectibles = [];
  spawnTimer = 1.5;

  const data = loadData();
  gameState.coins = Math.max(0, Number(data.coins) || 0);
}
