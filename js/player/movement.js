import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import {
  getRoadPoint,
  getRoadHeight,
  getRoadSlope
} from "../stages/stageRenderer.js";
import { playJumpSound } from "../systems/audio.js";

const CAMERA_OFFSET = new THREE.Vector3(0, 4.8, 9.0);
const SLIDE_DURATION = 0.7;
const SLIDE_SCALE_Y = 0.58;
const ROAD_LOOK_AHEAD = 20;

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
  player.group.scale.y = SLIDE_SCALE_Y;
}

function updateLaneMovement(player, deltaTime) {
  if (player.currentLaneOffset === undefined) {
    player.currentLaneOffset = player.targetLaneOffset || 0;
  }

  const targetOffset = player.targetLaneOffset !== undefined
    ? player.targetLaneOffset
    : gameState.lanePositions[player.lane] || 0;

  const difference = targetOffset - player.currentLaneOffset;
  const blend = 1 - Math.exp(-player.laneChangeSpeed * deltaTime);

  player.currentLaneOffset += difference * blend;

  if (Math.abs(difference) < 0.005) {
    player.currentLaneOffset = targetOffset;
  }

  const baseZ = player.baseZ ?? (player.baseZ = player.group.position.z || 4);
  const pt = getRoadPoint(baseZ, player.currentLaneOffset);

  player.group.position.x = pt.x;
  player.group.position.z = pt.z;

  // Car yaw and banking roll
  const laneLean = THREE.MathUtils.clamp(difference * -0.15, -0.22, 0.22);
  const targetYaw = pt.heading + THREE.MathUtils.clamp(difference * 0.12, -0.15, 0.15);

  player.group.rotation.y = THREE.MathUtils.damp(
    player.group.rotation.y,
    targetYaw,
    12,
    deltaTime
  );

  player.group.rotation.z = THREE.MathUtils.damp(
    player.group.rotation.z,
    laneLean,
    10,
    deltaTime
  );
}

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
  player.group.position.y = groundElevation + (player.jumpHeight || 0);
}

function updateRoadTilt(player, deltaTime) {
  const z = player.group.position.z;
  const slope = getRoadSlope(z + 2);
  const targetPitch = THREE.MathUtils.clamp(Math.atan(slope) * 0.7, -0.3, 0.3);

  player.group.rotation.x = THREE.MathUtils.damp(
    player.group.rotation.x,
    targetPitch,
    8,
    deltaTime
  );
}

function updateSlide(player, deltaTime) {
  if (!player.isSliding) return;

  player.slideTimer -= deltaTime;
  if (player.slideTimer <= 0) {
    player.isSliding = false;
    player.slideTimer = 0;
    player.group.scale.y = 1;
    gameState.isSliding = false;
  }
}

function updateWheels(player, deltaTime) {
  const wheels = player.group.userData.wheels;
  if (!wheels) return;

  const rotationSpeed = gameState.speed * deltaTime * 1.5;
  for (const wheel of wheels) {
    wheel.rotation.x -= rotationSpeed;
  }
}

function updateCamera(player, deltaTime) {
  const camera = gameState.camera;
  if (!camera) return;

  const playerPos = player.group.position;
  const playerZ = playerPos.z;

  const camPt = getRoadPoint(playerZ + CAMERA_OFFSET.z, (player.currentLaneOffset || 0) * 0.4);

  const desiredCamX = camPt.x;
  const desiredCamY = camPt.y + CAMERA_OFFSET.y;
  const desiredCamZ = camPt.z;

  camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, 5.0, deltaTime);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, 5.0, deltaTime);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, 5.0, deltaTime);

  // Look ahead along curve
  const lookPt = getRoadPoint(playerZ - ROAD_LOOK_AHEAD, 0);
  const lookTarget = new THREE.Vector3(lookPt.x, lookPt.y + 1.2, lookPt.z);

  camera.lookAt(lookTarget);
}

function updatePlayerSpeed(deltaTime) {
  if (gameState.boostActive) return; // boost power-up controls speed directly

  const base = gameState.baseSpeed || 18;
  const max = gameState.maxSpeed || 36;
  const min = 8;

  let targetSpeed = base;
  if (gameState.input.accelerate) {
    targetSpeed = max;
  } else if (gameState.input.brake) {
    targetSpeed = min;
  }

  // Smooth realistic acceleration / deceleration
  const rate = targetSpeed > gameState.speed ? 18.0 : 28.0;
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