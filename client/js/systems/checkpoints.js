import { gameState } from "../core/gameState.js";
import { grantTemporaryShield } from "./powerups.js";
import { clearObstacles } from "../obstacles/obstacles.js";
import { resetTraffic } from "../traffic/trafficCars.js";

/* ================================================================
   SILENT IN-MEMORY CHECKPOINT & ADAPTIVE DIFFICULTY SYSTEM
   - Tracks checkpoints purely in memory every CHECKPOINT_INTERVAL meters
     with ZERO visual archways, banners, or screen clutter.
   - Saves milestone progress (distance, score, coins, count) for
     seamless checkpoint revives with a 4-second invulnerability shield.
   - Calculates dynamic difficulty tier based on progression.
================================================================ */

export const CHECKPOINT_INTERVAL = 250; // Every 250m (250m, 500m, 750m, 1000m...)

let nextCheckpointDist = CHECKPOINT_INTERVAL;
let checkpointsPassedCount = 0;
let lastPassedCheckpoint = null;

// Dynamic difficulty tiers definition — optimized for bustling 5-lane highway
export const DIFFICULTY_TIERS = [
  { tier: 1, name: "CRUISING",    minDist: 0,   speedBoost: 0, minGap: 16, interval: [1.2, 1.6], maxTraffic: 2 },
  { tier: 2, name: "HIGHWAY",     minDist: 150, speedBoost: 2, minGap: 13, interval: [0.95, 1.3], maxTraffic: 4 },
  { tier: 3, name: "SPEEDWAY",    minDist: 400, speedBoost: 4, minGap: 10, interval: [0.75, 1.05], maxTraffic: 6 },
  { tier: 4, name: "HYPERDRIVE",  minDist: 800, speedBoost: 7, minGap: 8, interval: [0.55, 0.85], maxTraffic: 8 }
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

export function checkCheckpointSpawn() {
  // Checkpoints are tracked purely in memory — no 3D archways spawned
}

/**
 * Silently counts and saves checkpoints in memory as distance progresses.
 */
export function updateCheckpoints() {
  if (gameState.status !== "playing") return;

  const dist = gameState.distance || 0;
  while (dist >= nextCheckpointDist) {
    const distanceMark = nextCheckpointDist;
    checkpointsPassedCount++;

    lastPassedCheckpoint = {
      distance: distanceMark,
      score: gameState.score,
      coins: gameState.runCoins || 0,
      count: checkpointsPassedCount
    };

    gameState.lastCheckpoint = lastPassedCheckpoint;
    gameState.checkpointsPassed = checkpointsPassedCount;
    gameState.score += 150;

    nextCheckpointDist += CHECKPOINT_INTERVAL;
  }
}

export function getCheckpointsPassed() {
  return checkpointsPassedCount;
}

/**
 * Revive player at their last silently saved checkpoint
 */
export function revivePlayerAtCheckpoint() {
  if (!gameState.lastCheckpoint) return;

  const cp = gameState.lastCheckpoint;

  // 1. Restore progress from memory
  gameState.distance = cp.distance;
  gameState.score = cp.score;
  gameState.runCoins = cp.coins;

  // 2. Clear road hazards near player for safe runway
  clearObstacles();
  resetTraffic();

  // 3. Reset player position on center lane
  gameState.currentLane = 2;
  gameState.isJumping = false;
  gameState.isSliding = false;
  if (gameState.player) {
    gameState.player.lane = 2;
    gameState.player.currentLaneOffset = gameState.lanePositions[2] || 0;
    gameState.player.targetLaneOffset = gameState.player.currentLaneOffset;
  }
  if (gameState.player?.group) {
    gameState.player.group.position.set(0, 0, 4);
    gameState.player.group.rotation.set(0, 0, 0);
  }

  // 4. Grant 4.0-second invulnerable shield
  grantTemporaryShield(4.0);

  // 5. Resume gameplay silently
  gameState.status = "playing";
}

/**
 * Reset internal checkpoint memory on full run restart
 */
export function resetCheckpoints() {
  nextCheckpointDist = CHECKPOINT_INTERVAL;
  checkpointsPassedCount = 0;
  lastPassedCheckpoint = null;
  gameState.lastCheckpoint = null;
  gameState.checkpointsPassed = 0;
}
