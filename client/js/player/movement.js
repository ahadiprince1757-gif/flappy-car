import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import {
  getRoadPoint,
  getRoadHeight,
  getRoadSlope
} from "../stages/stageRenderer.js";
import { playJumpSound } from "../systems/audio.js";
import { createTireSmoke } from "../systems/effects.js";

const CAMERA_BASE_OFFSET = new THREE.Vector3(0, 4.6, 8.8);
const SLIDE_DURATION = 0.7;
const SLIDE_SCALE_Y = 0.58;
const ROAD_LOOK_AHEAD = 22;

export function changeLane(direction) {
  const player = gameState.player;
  if (!player || gameState.status !== "playing") return;

  const nextLane = THREE.MathUtils.clamp(
    player.lane + direction,
    0,
    gameState.lanePositions.length - 1
  );

  if (nextLane === player.lane) return;

  player.lane = nextLane;
  player.targetLaneOffset = gameState.lanePositions[nextLane];
  gameState.currentLane = nextLane;
}

export function moveLeft() {
  changeLane(-1);
}

export function moveRight() {
  changeLane(1);
}

export function jump() {
  const player = gameState.player;
  if (!player || gameState.status !== "playing") return;
  if (player.isJumping || player.isSliding) return;

  player.isJumping = true;
  player.verticalVelocity = gameState.jumpForce;
  gameState.isJumping = true;
  playJumpSound();
}

export function slide() {
  const player = gameState.player;
  if (!player || gameState.status !== "playing") return;
  if (player.isJumping || player.isSliding) return;

  player.isSliding = true;
  player.slideTimer = SLIDE_DURATION;
  gameState.isSliding = true;
  const baseScaleY = player.group.userData.originalScale?.y ?? 1;
  player.group.scale.y = baseScaleY * SLIDE_SCALE_Y;
}

/* ── 1. STEERING, INERTIA & DRIFT MECHANICS ────────────────────────── */
function updateLaneMovement(player, deltaTime) {
  if (player.currentLaneOffset === undefined) {
    player.currentLaneOffset = player.targetLaneOffset || 0;
  }

  const handling = player.config?.handling || 1.15;
  const targetOffset = player.targetLaneOffset !== undefined
    ? player.targetLaneOffset
    : gameState.lanePositions[player.lane] || 0;

  const difference = targetOffset - player.currentLaneOffset;
  const isHardSteer = Math.abs(difference) > 0.6;
  const isBraking = Boolean(gameState.input.brake);
  const isHighSpeed = gameState.speed > 22;

  // Drift condition: turning while braking or fast aggressive cornering
  const shouldDrift = isHardSteer && (isBraking || isHighSpeed);
  player.isDrifting = shouldDrift;

  // Responsive spring-damper lane interpolation
  const steerRate = (player.laneChangeSpeed || 14) * handling * (shouldDrift ? 0.88 : 1.0);
  const blend = 1 - Math.exp(-steerRate * deltaTime);
  player.currentLaneOffset += difference * blend;

  if (Math.abs(difference) < 0.005) {
    player.currentLaneOffset = targetOffset;
    player.isDrifting = false;
  }

  const baseZ = player.baseZ ?? (player.baseZ = player.group.position.z || 4);
  const pt = getRoadPoint(baseZ, player.currentLaneOffset);

  player.group.position.x = pt.x;
  player.group.position.z = pt.z;

  // Lateral drift slip angle & centrifugal body roll
  const driftSlip = shouldDrift ? Math.sign(difference) * -0.22 : 0;
  const targetYaw = pt.heading + THREE.MathUtils.clamp(difference * 0.14, -0.18, 0.18) + driftSlip;
  const bodyRoll = THREE.MathUtils.clamp(difference * -0.16, -0.25, 0.25);

  player.group.rotation.y = THREE.MathUtils.damp(player.group.rotation.y, targetYaw, shouldDrift ? 9 : 14, deltaTime);
  player.group.rotation.z = THREE.MathUtils.damp(player.group.rotation.z, bodyRoll, 10, deltaTime);

  // Spawn rear tire smoke when drifting or hard braking
  if ((shouldDrift || (isBraking && isHighSpeed)) && Math.random() < 0.45) {
    const rearPosL = new THREE.Vector3(pt.x - 0.55, pt.y + 0.15, pt.z + 1.2);
    const rearPosR = new THREE.Vector3(pt.x + 0.55, pt.y + 0.15, pt.z + 1.2);
    createTireSmoke(rearPosL, shouldDrift ? 1.3 : 0.9);
    createTireSmoke(rearPosR, shouldDrift ? 1.3 : 0.9);
  }
}

/* ── 2. SUSPENSION, PITCH & WEIGHT TRANSFER ───────────────────────── */
function updateRoadTilt(player, deltaTime) {
  const z = player.group.position.z;
  const slope = getRoadSlope(z + 2);
  const roadPitch = THREE.MathUtils.clamp(Math.atan(slope) * 0.7, -0.3, 0.3);

  // Weight transfer pitch:
  // Accelerating: rear squats, nose pitches up (+rad)
  // Braking: front suspension dives, nose pitches down (-rad)
  let weightTransferPitch = 0;
  if (gameState.input.accelerate) {
    weightTransferPitch = 0.045; // rear squat
  } else if (gameState.input.brake) {
    weightTransferPitch = -0.075; // front dive
  }

  // Micro road surface contour vibration
  const roadVibration = Math.sin(Date.now() * 0.038) * 0.004 * Math.min(1.5, gameState.speed / 18);
  const targetPitch = roadPitch + weightTransferPitch + roadVibration;

  player.group.rotation.x = THREE.MathUtils.damp(
    player.group.rotation.x,
    targetPitch,
    9,
    deltaTime
  );
}

/* ── 3. VERTICAL JUMP & ROCKET BOOSTERS ───────────────────────────── */
function updateJump(player, deltaTime) {
  const z = player.group.position.z;
  const groundElevation = getRoadHeight(z);

  if (player.isJumping) {
    player.verticalVelocity -= gameState.gravity * deltaTime;
    player.jumpHeight = (player.jumpHeight || 0) + player.verticalVelocity * deltaTime;

    if (player.jumpHeight <= 0) {
      player.jumpHeight = 0;
      player.verticalVelocity = 0;
      player.isJumping = false;
      gameState.isJumping = false;

      // Landing suspension compression rebound
      if (player.group) {
        player.group.position.y = groundElevation - 0.08;
      }
    }
  }

  // Animate fiery rocket fuel thrusters below the car while airborne
  const rocket = player.group?.userData.rocketThrusters;
  if (rocket) {
    if (player.isJumping && (player.jumpHeight || 0) > 0.05) {
      rocket.group.visible = true;
      if (rocket.light) {
        rocket.light.intensity = 3.8 + Math.random() * 1.8;
      }
      const pulseTime = Date.now() * 0.045;
      for (let i = 0; i < rocket.flames.length; i++) {
        const flame = rocket.flames[i];
        const stretch = 1.0 + Math.sin(pulseTime + i * 1.2) * 0.35 + Math.random() * 0.3;
        flame.scale.y = stretch;
        flame.scale.x = flame.scale.z = 0.85 + Math.random() * 0.3;
      }
    } else {
      rocket.group.visible = false;
      if (rocket.light) rocket.light.intensity = 0;
    }
  }

  player.groundY = groundElevation;
  const targetY = groundElevation + (player.jumpHeight || 0);
  player.group.position.y = THREE.MathUtils.damp(player.group.position.y, targetY, 24, deltaTime);
}

function updateSlide(player, deltaTime) {
  if (!player.isSliding) return;

  player.slideTimer -= deltaTime;
  if (player.slideTimer <= 0) {
    player.isSliding = false;
    player.slideTimer = 0;
    const baseScaleY = player.group.userData.originalScale?.y ?? 1;
    player.group.scale.y = baseScaleY;
    gameState.isSliding = false;
  }
}

/* ── 4. WHEEL SPIN & STEERING ANGLES ──────────────────────────────── */
function updateWheels(player, deltaTime) {
  const wheels = player.group.userData.wheels;
  if (!wheels) return;

  const rotationSpeed = gameState.speed * deltaTime * 1.6;
  const targetOffset = player.targetLaneOffset !== undefined
    ? player.targetLaneOffset
    : gameState.lanePositions[player.lane] || 0;
  const steerDelta = THREE.MathUtils.clamp((targetOffset - (player.currentLaneOffset || 0)) * 0.45, -0.4, 0.4);

  for (const wheel of wheels) {
    if (!wheel) continue;
    // Longitudinal spin
    if (wheel.rotation) {
      wheel.rotation.x -= rotationSpeed;
    }
    // Front wheel directional steering visual
    if (wheel.position.z < 0) {
      wheel.rotation.y = THREE.MathUtils.damp(wheel.rotation.y, steerDelta, 14, deltaTime);
    }
  }
}

/* ── 5. CINEMATIC DYNAMIC CAMERA (SPEED FOV & INERTIA) ────────────── */
function updateCamera(player, deltaTime) {
  const camera = gameState.camera;
  if (!camera) return;

  const playerPos = player.group.position;
  const playerZ = playerPos.z;

  // Dynamic camera distance: pulls back under high acceleration / boost
  const speedRatio = THREE.MathUtils.clamp((gameState.speed - 10) / 26, 0, 1);
  const accelOffsetZ = gameState.input.accelerate ? 0.9 : gameState.input.brake ? -0.5 : 0;
  const camDistZ = CAMERA_BASE_OFFSET.z + speedRatio * 0.8 + accelOffsetZ;

  const camPt = getRoadPoint(playerZ + camDistZ, (player.currentLaneOffset || 0) * 0.45);

  const desiredCamX = camPt.x;
  const desiredCamY = camPt.y + CAMERA_BASE_OFFSET.y;
  const desiredCamZ = camPt.z;

  camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, 5.5, deltaTime);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, 5.0, deltaTime);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, 5.5, deltaTime);

  // Dynamic speed-sensitive FOV (normal 60° -> 68° at top speed -> 72° in boost)
  const targetFov = gameState.boostActive ? 72 : THREE.MathUtils.lerp(60, 68, speedRatio);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3.5, deltaTime);
    camera.updateProjectionMatrix();
  }

  // Look ahead dynamically along the road curvature
  const lookPt = getRoadPoint(playerZ - ROAD_LOOK_AHEAD, (player.currentLaneOffset || 0) * 0.15);
  const lookTarget = new THREE.Vector3(lookPt.x, lookPt.y + 1.25, lookPt.z);
  camera.lookAt(lookTarget);
}

/* ── 6. REALISTIC ACCELERATION & BRAKING CURVES ───────────────────── */
function updatePlayerSpeed(deltaTime) {
  if (gameState.boostActive) return; // rocket boost power-up controls speed directly

  const carAccel = playerAccelFactor();
  const base = gameState.baseSpeed || 18;
  const max = gameState.maxSpeed || 36;
  const min = 8;

  let targetSpeed = base;
  if (gameState.input.accelerate) {
    targetSpeed = max;
  } else if (gameState.input.brake) {
    targetSpeed = min;
  }

  // Realistic progressive acceleration curve (quicker off the line, gradual near redline)
  const isAccelerating = targetSpeed > gameState.speed;
  const rate = isAccelerating
    ? 16.0 * carAccel * (1 - (gameState.speed / (max * 1.15)) * 0.35)
    : 28.0; // tight responsive braking

  gameState.speed = THREE.MathUtils.damp(gameState.speed, targetSpeed, rate, deltaTime);

  // Dynamic visual brake feedback on car's rear LED bar
  const player = gameState.player;
  if (player?.group) {
    const isBraking = Boolean(gameState.input.brake);
    const tailLed = player.group.getObjectByName("tail-led-bar");
    if (tailLed?.material) {
      tailLed.material.emissiveIntensity = isBraking ? 6.5 : 2.5;
    }
    for (const sx of [-1, 1]) {
      const tl = player.group.getObjectByName(`taillight-${sx}`);
      if (tl?.material) {
        tl.material.emissiveIntensity = isBraking ? 5.2 : 1.8;
      }
    }
  }
}

function playerAccelFactor() {
  return gameState.player?.config?.acceleration || 1.2;
}

export function updatePlayerMovement(deltaTime) {
  const player = gameState.player;
  if (!player || gameState.status !== "playing") return;

  updatePlayerSpeed(deltaTime);
  updateLaneMovement(player, deltaTime);
  updateJump(player, deltaTime);
  updateRoadTilt(player, deltaTime);
  updateSlide(player, deltaTime);
  updateWheels(player, deltaTime);
  updateCamera(player, deltaTime);
}