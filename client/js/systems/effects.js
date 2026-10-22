import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";

const EFFECT_LIMIT = 35;

export function createBurst(position, color = 0x00ffff, count = 12) {
  const scene = gameState.scene;
  if (!scene) return null;

  while (gameState.effects.length >= EFFECT_LIMIT) {
    removeEffect(gameState.effects[0]);
  }

  const group = new THREE.Group();
  group.position.copy(position);

  const particles = [];
  const particleGeometry = new THREE.SphereGeometry(0.055, 5, 5);

  for (let i = 0; i < count; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1
    });

    const particle = new THREE.Mesh(particleGeometry, material);
    particle.position.set(0, 0, 0);

    particles.push({
      mesh: particle,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4 + 0.5,
        (Math.random() - 0.5) * 5
      )
    });

    group.add(particle);
  }

  scene.add(group);

  const effect = {
    group,
    particles,
    age: 0,
    duration: 0.55
  };

  gameState.effects.push(effect);
  return effect;
}

function removeEffect(effect) {
  if (!effect) return;

  gameState.scene?.remove(effect.group);

  for (const particle of effect.particles) {
    particle.mesh.geometry?.dispose();
    particle.mesh.material?.dispose();
  }

  const index = gameState.effects.indexOf(effect);
  if (index !== -1) {
    gameState.effects.splice(index, 1);
  }
}

export function updateEffects(deltaTime) {
  for (const effect of [...gameState.effects]) {
    effect.age += deltaTime;

    const progress = Math.min(effect.age / effect.duration, 1);
    const opacity = 1 - progress;

    for (const particle of effect.particles) {
      particle.mesh.position.addScaledVector(
        particle.velocity,
        deltaTime
      );

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
  for (const effect of [...gameState.effects]) {
    removeEffect(effect);
  }
}
