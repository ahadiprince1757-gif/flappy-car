import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import {
  getRoadPoint,
  getRoadSlope,
  LANE_CENTERS,
  ROAD_WIDTH
} from "../stages/stageRenderer.js";
import { buildTrafficCar } from "./trafficRenderer.js";

/*
 * TRAFFIC CAR MANAGER
 *
 * Manages a pool of AI traffic cars that:
 *  - Spawn ahead of the player and despawn far behind
 *  - Drive on one of 3 lanes at realistic highway speeds
 *  - Some go the same direction as the player (slower, so player overtakes)
 *  - Some approach head-on in the opposite lanes (oncoming traffic)
 *  - Wheels rotate in sync with their movement speed
 *  - Smoothly follow the road curve via getRoadPoint()
 *  - Use object-pooling to avoid GC jank
 */

const POOL_SIZE = 14;          // Max live traffic cars
const SPAWN_AHEAD_Z = -55;     // Z ahead of player to spawn new cars
const DESPAWN_BEHIND_Z = 18;   // Z behind player to remove car
const SAME_DIR_SPEED = 10;     // m/s — slower than player (player overtakes)
const ONCOMING_SPEED = 22;     // m/s — oncoming at highway pace

// Z-world coords:  negative Z = far ahead  /  positive Z = far behind camera
// Player sits at roughly z = +4 fixed in world; road scrolls forward.

const _pool = [];       // { group, active, lane, speed, dir, roadZ, ... }
let   _scene = null;

// ── Initialise pool ───────────────────────────────────────────────
export function initTraffic(scene) {
  _scene = scene;
  resetTraffic();
}

// ── Spawn a car into the pool ─────────────────────────────────────
function spawnCar(playerZ) {
  if (!_scene) return;

  let entry = _pool.find(e => !e.active);

  // If no inactive car in pool, instantiate a new FBX model if below cap
  if (!entry) {
    if (_pool.length < POOL_SIZE) {
      const group = buildTrafficCar();
      if (!group) return; // FBX cache not ready yet, skip spawn until loaded

      group.visible = false;
      _scene.add(group);

      entry = {
        group,
        active: false,
        lane: 1,
        roadZ: 0,
        speed: SAME_DIR_SPEED,
        dir: 1,        // +1 = same as player, -1 = oncoming
        laneOffset: 0,
      };
      _pool.push(entry);
    } else {
      return; // Pool full
    }
  }

  // Pick a random lane (0,1,2) and direction
  const isOncoming = Math.random() < 0.3; // 30% oncoming
  const lane = Math.floor(Math.random() * LANE_CENTERS.length);
  const laneOffset = LANE_CENTERS[lane];

  // Spawn ahead of the player in world-Z (far negative)
  const spawnZ = playerZ + SPAWN_AHEAD_Z - Math.random() * 30;
  const pt = getRoadPoint(spawnZ, laneOffset);

  entry.active = true;
  entry.lane = lane;
  entry.roadZ = spawnZ;
  entry.laneOffset = laneOffset;
  entry.speed = isOncoming ? ONCOMING_SPEED : SAME_DIR_SPEED + Math.random() * 5;
  entry.dir = isOncoming ? -1 : 1;

  entry.group.position.set(pt.x, pt.y, pt.z);
  entry.group.rotation.y = pt.heading + (isOncoming ? Math.PI : 0);
  entry.group.visible = true;
}

// ── Reset / teardown ──────────────────────────────────────────────
export function resetTraffic() {
  for (const entry of _pool) {
    entry.active = false;
    if (entry.group) entry.group.visible = false;
  }
}

export function destroyTraffic() {
  if (_scene) {
    for (const entry of _pool) {
      if (entry.group) {
        _scene.remove(entry.group);
        entry.group.traverse(obj => {
          if (!obj.isMesh) return;
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m?.dispose();
        });
      }
    }
  }
  _pool.length = 0;
  _scene = null;
}

/** Returns the live pool array — used by collision.js */
export function getTrafficPool() {
  return _pool;
}


// ── Per-frame update ──────────────────────────────────────────────
const SPAWN_INTERVAL_MIN = 1.8; // seconds
const SPAWN_INTERVAL_MAX = 3.5;
let   _spawnTimer = 0;
let   _nextSpawn  = 2.0;

export function updateTraffic(deltaTime) {
  if (!gameState.scene || gameState.status !== "playing") return;

  const playerZ  = gameState.player?.group?.position?.z ?? 4;
  const gameSpeed = Math.max(0, gameState.speed);

  // ── Spawner ────────────────────────────────────────────────────
  _spawnTimer += deltaTime;
  if (_spawnTimer >= _nextSpawn) {
    _spawnTimer = 0;
    _nextSpawn = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    spawnCar(playerZ);
  }

  // ── Move each active car ───────────────────────────────────────
  for (const entry of _pool) {
    if (!entry.active) continue;

    /*
     * Road Z convention matches stageRenderer:
     *   - Player Z is roughly fixed ~+4 in world space
     *   - Road scrolls: every frame the road "moves" +gameSpeed*dt in Z
     *   - Same-direction cars: their roadZ also advances by gameSpeed*dt
     *     but they are slower, so player catches them
     *   - Oncoming cars: move in the -Z direction at their own speed
     */
    if (entry.dir === 1) {
      // Same direction — advance with road but slower than player
      entry.roadZ += gameSpeed * deltaTime;            // road scroll contribution
      entry.roadZ -= entry.speed * deltaTime;          // their own forward motion
      // Net effect: car moves backward relative to player (player overtakes)
    } else {
      // Oncoming — advance with road AND add their own forward Z advance
      entry.roadZ += gameSpeed * deltaTime;
      entry.roadZ += entry.speed * deltaTime;
    }

    // Despawn when far behind player
    if (entry.roadZ > DESPAWN_BEHIND_Z + 8) {
      entry.active = false;
      entry.group.visible = false;
      continue;
    }

    // Update 3D position along the curved road
    const pt = getRoadPoint(entry.roadZ, entry.laneOffset);
    const slope = getRoadSlope(entry.roadZ);

    entry.group.position.set(pt.x, pt.y, pt.z);
    entry.group.rotation.y = pt.heading + (entry.dir === -1 ? Math.PI : 0);
    entry.group.rotation.x = -Math.atan(slope) * 0.7;

    // Animate wheels
    const wheels = entry.group.userData.wheels;
    if (wheels) {
      const effectiveSpeed = entry.dir === 1
        ? gameSpeed - entry.speed
        : gameSpeed + entry.speed;
      const rotDelta = effectiveSpeed * deltaTime * 1.4;
      for (const w of wheels) {
        if (entry.dir === 1) {
          w.rotation.x += rotDelta;
        } else {
          w.rotation.x -= rotDelta;
        }
      }
    }

    // Pulse neon underglow subtly
    const light = entry.group.children.find(c => c.isPointLight);
    if (light) {
      light.intensity = 0.7 + Math.sin(Date.now() * 0.003 + entry.roadZ) * 0.25;
    }
  }
}
