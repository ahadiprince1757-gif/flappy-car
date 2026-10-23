import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { getRoadPoint } from "../stages/stageRenderer.js";
import { createBurst } from "./effects.js";
import { playRaceCompleteSound } from "./audio.js";
import { showHUDMessage } from "../ui/hud.js";
import { grantTemporaryShield } from "./powerups.js";
import { clearObstacles } from "../obstacles/obstacles.js";
import { resetTraffic } from "../traffic/trafficCars.js";

/* ================================================================
   PROCEDURAL CHECKPOINT & ADAPTIVE DIFFICULTY SYSTEM
   - Spawns overhead 3D neon Checkpoint Archways every CHECKPOINT_INTERVAL meters
   - Saves milestone progress: distance, score, and coins
   - Provides safe Revive mechanism with 4-second invulnerability shield
   - Calculates dynamic difficulty tier based on progression
================================================================ */

export const CHECKPOINT_INTERVAL = 250; // Every 250m (250m, 500m, 750m, 1000m...)

let activeArchway = null;
let nextCheckpointDist = CHECKPOINT_INTERVAL;
let lastPassedCheckpoint = null;

// Dynamic difficulty tiers definition
export const DIFFICULTY_TIERS = [
  { tier: 1, name: "CRUISING",    minDist: 0,   speedBoost: 0, minGap: 24, interval: [1.8, 2.3], maxTraffic: 0 },
  { tier: 2, name: "HIGHWAY",     minDist: 150, speedBoost: 2, minGap: 20, interval: [1.4, 1.8], maxTraffic: 1 },
  { tier: 3, name: "SPEEDWAY",    minDist: 400, speedBoost: 4, minGap: 17, interval: [1.1, 1.4], maxTraffic: 2 },
  { tier: 4, name: "HYPERDRIVE",  minDist: 800, speedBoost: 7, minGap: 14, interval: [0.9, 1.2], maxTraffic: 3 }
];

export function getCurrentDifficulty() {
  const dist = gameState.distance || 0;
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    if (dist >= DIFFICULTY_TIERS[i].minDist) {
      return DIFFICULTY_TIERS[i];
    }
  }
  return DIFFICULTY_TIERS[0];
}

/**
 * Creates a glowing 3D Checkpoint Archway
 */
function createArchwayMesh(distanceMark) {
  const group = new THREE.Group();

  const pillarMat = new THREE.MeshStandardMaterial({
    color: "#0a192f",
    metalness: 0.85,
    roughness: 0.2
  });

  const neonMat = new THREE.MeshStandardMaterial({
    color: "#00efff",
    emissive: "#00efff",
    emissiveIntensity: 0.85,
    roughness: 0.2
  });

  const goldNeonMat = new THREE.MeshStandardMaterial({
    color: "#ffd700",
    emissive: "#ffd700",
    emissiveIntensity: 0.9,
    roughness: 0.2
  });

  // Left & Right Pillars (spanning across 3 lanes: road is 10.8m wide)
  const pillarGeo = new THREE.BoxGeometry(0.7, 5.2, 0.7);
  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-6.2, 2.6, 0);

  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(6.2, 2.6, 0);

  // Neon glowing strips along pillars
  const stripGeo = new THREE.BoxGeometry(0.15, 5.0, 0.72);
  const leftStrip = new THREE.Mesh(stripGeo, neonMat);
  leftStrip.position.set(-5.85, 2.6, 0);

  const rightStrip = new THREE.Mesh(stripGeo, neonMat);
  rightStrip.position.set(5.85, 2.6, 0);

  // Overhead Crossbar Beam
  const beamGeo = new THREE.BoxGeometry(13.2, 0.85, 0.8);
  const crossbeam = new THREE.Mesh(beamGeo, pillarMat);
  crossbeam.position.set(0, 4.8, 0);

  // Overhead glowing banner text ribbon via canvas
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Draw cyber banner
  ctx.fillStyle = "#000814";
  ctx.fillRect(0, 0, 512, 128);

  // Border neon
  ctx.strokeStyle = "#00efff";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 120);

  // Text
  ctx.font = "bold 44px sans-serif";
  ctx.fillStyle = "#ffd700";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`⚡ CHECKPOINT ${distanceMark}M ⚡`, 256, 64);

  const bannerTex = new THREE.CanvasTexture(canvas);
  bannerTex.generateMipmaps = false;
  bannerTex.minFilter = THREE.LinearFilter;

  const bannerMat = new THREE.MeshBasicMaterial({
    map: bannerTex,
    transparent: true
  });

  const bannerGeo = new THREE.PlaneGeometry(8.5, 2.1);
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(0, 4.8, 0.42);

  // Ground neon laser crossing line
  const groundLaserGeo = new THREE.PlaneGeometry(12.0, 0.4);
  const groundLaser = new THREE.Mesh(groundLaserGeo, goldNeonMat);
  groundLaser.rotation.x = -Math.PI / 2;
  groundLaser.position.set(0, 0.05, 0);

  group.add(leftPillar, rightPillar, leftStrip, rightStrip, crossbeam, bannerMesh, groundLaser);

  group.userData = {
    distanceMark,
    roadZ: -80, // Spawns down the road ahead of player
    passed: false
  };

  return group;
}

/**
 * Spawns the next 3D checkpoint archway when approaching
 */
export function checkCheckpointSpawn() {
  if (!gameState.scene) return;
  const dist = gameState.distance || 0;

  // Next checkpoint trigger (spawn 80m before crossing)
  if (!activeArchway && dist >= nextCheckpointDist - 80) {
    activeArchway = createArchwayMesh(nextCheckpointDist);
    activeArchway.userData.roadZ = -80;
    gameState.scene.add(activeArchway);
  }
}

/**
 * Updates checkpoint archway position and crossing detection
 */
export function updateCheckpoints(deltaTime) {
  checkCheckpointSpawn();

  if (!activeArchway) return;

  const speed = gameState.speed || gameState.baseSpeed || 18;
  const move = speed * deltaTime;

  activeArchway.userData.roadZ += move;
  const currentZ = activeArchway.userData.roadZ;

  // Align to road curvature
  const pt = getRoadPoint(currentZ, 0);
  activeArchway.position.set(pt.x, pt.y, pt.z);
  activeArchway.rotation.y = pt.heading;

  // Check if player passed the archway (player is around z = 4)
  const playerZ = gameState.player?.group?.position?.z ?? 4;

  if (!activeArchway.userData.passed && currentZ >= playerZ) {
    activeArchway.userData.passed = true;
    onCheckpointReached(activeArchway.userData.distanceMark);
  }

  // Despawn once behind camera (z > 16)
  if (currentZ > 16) {
    gameState.scene?.remove(activeArchway);
    activeArchway = null;
    nextCheckpointDist += CHECKPOINT_INTERVAL;
  }
}

/**
 * Handler when crossing checkpoint
 */
function onCheckpointReached(distanceMark) {
  lastPassedCheckpoint = {
    distance: distanceMark,
    score: gameState.score,
    coins: gameState.runCoins || 0
  };

  gameState.lastCheckpoint = lastPassedCheckpoint;

  // Audio fanfare
  playRaceCompleteSound();

  // Visual particle explosion
  if (gameState.player?.group) {
    createBurst(gameState.player.group.position, 0x00efff, 28);
    createBurst(new THREE.Vector3(0, 4, activeArchway?.position?.z || 0), 0xffd700, 32);
  }

  // Bonus points
  gameState.score += 150;

  // High-impact notification
  showHUDMessage(`⚡ CHECKPOINT ${distanceMark}M REACHED! [SAVED] ⚡`);
}

/**
 * Revive player at their last saved checkpoint
 */
export function revivePlayerAtCheckpoint() {
  if (!gameState.lastCheckpoint) return;

  const cp = gameState.lastCheckpoint;

  // 1. Restore progress
  gameState.distance = cp.distance;
  gameState.score = cp.score;
  gameState.runCoins = cp.coins;

  // 2. Clear road hazards near player for safe runway
  clearObstacles();
  resetTraffic();

  // 3. Reset player position on center lane
  gameState.currentLane = 1;
  gameState.isJumping = false;
  gameState.isSliding = false;
  if (gameState.player?.group) {
    gameState.player.group.position.set(0, 0, 4);
    gameState.player.group.rotation.set(0, 0, 0);
  }

  // 4. Grant 4.0-second invulnerable shield
  grantTemporaryShield(4.0);

  // 5. Resume gameplay
  gameState.status = "playing";
  showHUDMessage(`REVIVED AT ${cp.distance}M · 🛡️ SHIELD ACTIVE!`);
}

/**
 * Reset checkpoint system on full run restart
 */
export function resetCheckpoints() {
  if (activeArchway && gameState.scene) {
    gameState.scene.remove(activeArchway);
  }
  activeArchway = null;
  nextCheckpointDist = CHECKPOINT_INTERVAL;
  lastPassedCheckpoint = null;
  gameState.lastCheckpoint = null;
}
