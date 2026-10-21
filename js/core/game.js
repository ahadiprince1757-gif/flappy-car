import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "./gameState.js";

let resizeHandler = null;

export function initializeGame(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Flappy Car needs a valid canvas element.");
  }

  if (gameState.renderer) {
    gameState.renderer.dispose();
    gameState.renderer = null;
  }

  /* ── Scene ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#7dd3fc");
  scene.fog = new THREE.Fog("#bae6fd", 85, 240);

  /* ── Camera ── */
  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    380
  );
  camera.position.set(0, 6.0, 11);
  camera.lookAt(0, 1.4, -10);

  /* ── Renderer ── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha:     false,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled  = true;
  renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace   = THREE.SRGBColorSpace;
  renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;   // vivid, arcade-bright

  /* ── Sky / ambient ── */
  // Hemisphere — warm sky top, dark teal ground bounce
  const hemi = new THREE.HemisphereLight("#d0eeff", "#1a4a2e", 1.9);
  scene.add(hemi);

  /* ── Primary sun (warm gold) ── */
  const sun = new THREE.DirectionalLight("#fff8dc", 3.2);
  sun.position.set(-18, 36, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left   = -45;
  sun.shadow.camera.right  =  45;
  sun.shadow.camera.top    =  45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near   = 0.5;
  sun.shadow.camera.far    = 130;
  sun.shadow.bias          = -0.0004;
  sun.shadow.normalBias    = 0.02;
  scene.add(sun);

  /* ── Fill light (cooler, from opposite side) ── */
  const fill = new THREE.DirectionalLight("#aee4ff", 0.95);
  fill.position.set(20, 15, -10);
  scene.add(fill);

  /* ── Rear / rim light for car silhouette pop ── */
  const rim = new THREE.DirectionalLight("#ffd6a0", 0.60);
  rim.position.set(0, 8, 18);
  scene.add(rim);

  /* ── Point light beneath car for underglow bloom-like effect ── */
  const underglow = new THREE.PointLight("#00f0ff", 1.4, 8, 2);
  underglow.position.set(0, 0.2, 0);
  underglow.name = "underglow-light";
  scene.add(underglow);

  gameState.scene    = scene;
  gameState.camera   = camera;
  gameState.renderer = renderer;
  gameState.underglowLight = underglow;

  resizeRenderer();

  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  resizeHandler = resizeRenderer;
  window.addEventListener("resize", resizeHandler);

  return { THREE, scene, camera, renderer };
}

export function resizeRenderer() {
  const { camera, renderer } = gameState;
  if (!camera || !renderer) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 0 || h <= 0) return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

export function renderGame() {
  const { scene, camera, renderer, player } = gameState;
  if (!scene || !camera || !renderer) return;

  /* Keep underglow point-light attached to player car group */
  if (gameState.underglowLight && player?.group) {
    const wp = new THREE.Vector3();
    player.group.getWorldPosition(wp);
    gameState.underglowLight.position.set(wp.x, 0.25, wp.z);
  }

  renderer.render(scene, camera);
}

export function disposeGame() {
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (gameState.renderer) {
    gameState.renderer.dispose();
    gameState.renderer = null;
  }
  gameState.scene  = null;
  gameState.camera = null;
}
