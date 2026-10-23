import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/environments/RoomEnvironment.js";
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
  // Use Neutral or Linear tone mapping to preserve bright vibrant colors without crushing shadows
  renderer.toneMapping        = (THREE.NeutralToneMapping !== undefined)
    ? THREE.NeutralToneMapping
    : THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.08;

  /* ── Full ambient illumination so no face is ever black ── */
  const ambient = new THREE.AmbientLight("#ffffff", 1.8);
  scene.add(ambient);

  /* ── Sky / asphalt bounce ── */
  const hemi = new THREE.HemisphereLight("#e0f2fe", "#94a3b8", 1.6);
  scene.add(hemi);

  /* ── Primary sun (shining from front-above to light hoods and front/sides) ── */
  const sun = new THREE.DirectionalLight("#fffbeb", 3.2);
  sun.position.set(22, 38, -15);
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

  /* ── Rear directional light so car rear/taillights pop against the road ── */
  const rear = new THREE.DirectionalLight("#e0f2fe", 2.2);
  rear.position.set(-10, 16, 24);
  scene.add(rear);

  /* ── Fill light from opposite side ── */
  const fill = new THREE.DirectionalLight("#c7d2fe", 1.4);
  fill.position.set(-20, 15, -10);
  scene.add(fill);

  /* ── Point light beneath car for underglow bloom-like effect ── */
  const underglow = new THREE.PointLight("#00f0ff", 1.4, 8, 2);
  underglow.position.set(0, 0.2, 0);
  underglow.name = "underglow-light";
  scene.add(underglow);

  /* ── Procedural env map so metallic materials reflect sky colour ── */
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
    pmrem.dispose();
  } catch (e) {
    // PMREMGenerator not critical — lights still visible
  }


  gameState.scene    = scene;
  gameState.camera   = camera;
  gameState.renderer = renderer;
  gameState.underglowLight = underglow;

  resizeRenderer();

  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  resizeHandler = resizeRenderer;
  window.addEventListener("resize", resizeHandler);
  window.addEventListener("orientationchange", () => {
    setTimeout(resizeRenderer, 100);
    setTimeout(resizeRenderer, 350);
  });
  if (screen.orientation) {
    screen.orientation.addEventListener("change", () => {
      setTimeout(resizeRenderer, 100);
      setTimeout(resizeRenderer, 350);
    });
  }

  return { THREE, scene, camera, renderer };
}

export function resizeRenderer() {
  const { camera, renderer } = gameState;
  if (!camera || !renderer) return;

  const container = document.getElementById("gameContainer");
  const w = (container && container.clientWidth > 0) ? container.clientWidth : window.innerWidth;
  const h = (container && container.clientHeight > 0) ? container.clientHeight : window.innerHeight;
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
