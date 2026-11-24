import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { ObjectPool, ObjectManager } from "../core/objectPool.js";

const MAX_EFFECT_GROUPS = 20;
const MAX_PARTICLES_PER_EFFECT = 16;

// Shared geometries and materials
let burstGeo = null;
let smokeGeo = null;

function getParticleGeometries() {
  if (!burstGeo) {
    burstGeo = new THREE.SphereGeometry(0.055, 4, 4);
    smokeGeo = new THREE.SphereGeometry(0.12, 4, 4);
  }
  return { burstGeo, smokeGeo };
}

/* ── Pre-allocated Effect Pool ────────────────────────────────── */
export const effectPool = new ObjectPool({
  name: "EffectPool",
  maxSize: MAX_EFFECT_GROUPS,
  createFactory: () => {
    const { burstGeo } = getParticleGeometries();
    const group = new THREE.Group();
    group.visible = false;

    const particles = [];
    for (let i = 0; i < MAX_PARTICLES_PER_EFFECT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(burstGeo, mat);
      mesh.visible = false;
      group.add(mesh);

      particles.push({
        mesh,
        velocity: new THREE.Vector3()
      });
    }

    if (gameState.scene) {
      gameState.scene.add(group);
    }

    return {
      group,
      particles,
      age: 0,
      duration: 0.5,
      activeCount: 0,
      active: false
    };
  },
  resetFn: (effect) => {
    effect.active = false;
    effect.age = 0;
    if (effect.group) {
      effect.group.visible = false;
    }
    for (const p of effect.particles) {
      p.mesh.visible = false;
    }
  }
});

ObjectManager.registerPool("effects", effectPool);

export function createBurst(position, color = 0x00ffff, count = 12) {
  const scene = gameState.scene;
  if (!scene) return null;

  const effect = effectPool.get();
  if (!effect) return null;

  if (effect.group.parent !== scene) {
    scene.add(effect.group);
  }

  const { burstGeo } = getParticleGeometries();
  const safeCount = Math.min(count, MAX_PARTICLES_PER_EFFECT);

  effect.group.position.copy(position);
  effect.age = 0;
  effect.duration = 0.55;
  effect.activeCount = safeCount;
  effect.active = true;
  effect.group.visible = true;

  for (let i = 0; i < effect.particles.length; i++) {
    const p = effect.particles[i];
    if (i < safeCount) {
      p.mesh.geometry = burstGeo;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(1);
      p.mesh.position.set(0, 0, 0);
      p.mesh.visible = true;

      p.velocity.set(
        (Math.random() - 0.5) * 5,
        Math.random() * 4 + 0.5,
        (Math.random() - 0.5) * 5
      );
    } else {
      p.mesh.visible = false;
    }
  }

  if (!gameState.effects.includes(effect)) {
    gameState.effects.push(effect);
  }

  return effect;
}

export function createTireSmoke(position, scale = 1.0) {
  const scene = gameState.scene;
  if (!scene) return null;

  const effect = effectPool.get();
  if (!effect) return null;

  if (effect.group.parent !== scene) {
    scene.add(effect.group);
  }

  const { smokeGeo } = getParticleGeometries();

  effect.group.position.copy(position);
  effect.age = 0;
  effect.duration = 0.35;
  effect.activeCount = 1;
  effect.active = true;
  effect.group.visible = true;

  const p = effect.particles[0];
  p.mesh.geometry = smokeGeo;
  p.mesh.material.color.setHex(0xd1d5db);
  p.mesh.material.opacity = 0.5;
  p.mesh.scale.setScalar(scale);
  p.mesh.position.set(0, 0, 0);
  p.mesh.visible = true;

  p.velocity.set(
    (Math.random() - 0.5) * 1.2,
    Math.random() * 0.8 + 0.2,
    Math.random() * 2.0 + 1.0
  );

  for (let i = 1; i < effect.particles.length; i++) {
    effect.particles[i].mesh.visible = false;
  }

  if (!gameState.effects.includes(effect)) {
    gameState.effects.push(effect);
  }

  return effect;
}

export function createSparks(position, count = 8) {
  return createBurst(position, 0xffd700, count);
}

function removeEffect(effect) {
  if (!effect) return;
  effectPool.release(effect);

  const index = gameState.effects.indexOf(effect);
  if (index !== -1) {
    gameState.effects.splice(index, 1);
  }
}

let cameraShakeTimer = 0;
let cameraShakeDuration = 0;
let cameraShakeIntensity = 0;

export function triggerCameraShake(intensity = 0.35, duration = 0.3) {
  cameraShakeIntensity = intensity;
  cameraShakeDuration = duration;
  cameraShakeTimer = duration;
}

export function updateEffects(deltaTime) {
  if (cameraShakeTimer > 0 && gameState.camera) {
    cameraShakeTimer -= deltaTime;
    const progress = Math.max(0, cameraShakeTimer / cameraShakeDuration);
    const currIntensity = cameraShakeIntensity * progress;
    gameState.camera.position.x += (Math.random() - 0.5) * 2 * currIntensity;
    gameState.camera.position.y += (Math.random() - 0.5) * 2 * currIntensity;
  }

  for (let i = gameState.effects.length - 1; i >= 0; i--) {
    const effect = gameState.effects[i];
    if (!effect.active) {
      gameState.effects.splice(i, 1);
      continue;
    }

    effect.age += deltaTime;
    const progress = Math.min(effect.age / effect.duration, 1);
    const opacity = 1 - progress;

    for (let j = 0; j < effect.activeCount; j++) {
      const particle = effect.particles[j];
      particle.mesh.position.addScaledVector(particle.velocity, deltaTime);
      particle.velocity.y -= 7 * deltaTime;
      particle.mesh.material.opacity = opacity;
      particle.mesh.scale.setScalar(Math.max(0.01, opacity));
    }

    if (effect.age >= effect.duration) {
      removeEffect(effect);
    }
  }
}

export function clearEffects() {
  cameraShakeTimer = 0;
  effectPool.releaseAll();
  gameState.effects.length = 0;
}
