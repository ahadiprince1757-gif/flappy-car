import * as THREE from "three";
import { getAllCars, getCarConfig } from "./cars.js";
import { getAllStages, getStageConfig } from "../stages/stages.js";
import {
  getWallet,
  selectCar,
  selectStage
} from "../systems/economy.js";
import { gameState } from "../core/gameState.js";
import { createPlayer } from "../player/player.js";
import { createStage } from "../stages/stageRenderer.js";
import { spawnCarModel, preloadCarModels, areCarsReady } from "./carModelLoader.js";

let onSelectionChangeCallback = null;

// ── 3D Showcase Turntable State ─────────────────────
let showcaseRenderer = null;
let showcaseScene = null;
let showcaseCamera = null;
let showcaseCarGroup = null;
let showcaseBackdropGroup = null;
let showcaseAnimId = null;
let turntableAngle = 0;
let isDragging = false;
let previousMouseX = 0;
let dragRotationVelocity = 0;
let currentPreviewCarId = null;
let currentPreviewStageId = null;

function byId(id) {
  return document.getElementById(id);
}

export function setGarageSelectionCallback(callback) {
  onSelectionChangeCallback = callback;
}

// ── 3D Turntable Initialization ─────────────────────

export function initShowcaseViewer() {
  const canvas = byId("garageShowcaseCanvas");
  if (!canvas || showcaseRenderer) return;

  // Scene
  showcaseScene = new THREE.Scene();

  // Camera: Elevated 3/4 isometric perspective
  const width = canvas.clientWidth || 480;
  const height = canvas.clientHeight || 260;
  showcaseCamera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  showcaseCamera.position.set(4.2, 2.3, 5.2);
  showcaseCamera.lookAt(0, 0.45, 0);

  // Renderer
  showcaseRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  showcaseRenderer.setSize(width, height, false);
  showcaseRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  showcaseRenderer.shadowMap.enabled = true;
  showcaseRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Studio Lighting Rig
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
  showcaseScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(5, 8, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 25;
  keyLight.shadow.bias = -0.001;
  showcaseScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x00efff, 1.6);
  fillLight.position.set(-5, 4, -3);
  showcaseScene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xff4422, 1.2);
  rimLight.position.set(0, 3, -6);
  showcaseScene.add(rimLight);

  // Glowing Turntable Podium
  const podiumGroup = new THREE.Group();

  // Dark metallic base disc
  const discGeo = new THREE.CylinderGeometry(2.8, 3.0, 0.22, 48);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x071524,
    metalness: 0.85,
    roughness: 0.25
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.y = -0.11;
  disc.receiveShadow = true;
  podiumGroup.add(disc);

  // Glowing LED neon ring border
  const ringGeo = new THREE.TorusGeometry(2.85, 0.04, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00efff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  podiumGroup.add(ring);

  // Inner circular grid pattern
  const innerRingGeo = new THREE.RingGeometry(0.1, 2.7, 32);
  const innerRingMat = new THREE.MeshStandardMaterial({
    color: 0x0b243b,
    metalness: 0.9,
    roughness: 0.4,
    side: THREE.DoubleSide
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.005;
  innerRing.receiveShadow = true;
  podiumGroup.add(innerRing);

  showcaseScene.add(podiumGroup);

  // Groups for dynamically swapped objects
  showcaseCarGroup = new THREE.Group();
  showcaseScene.add(showcaseCarGroup);

  showcaseBackdropGroup = new THREE.Group();
  showcaseScene.add(showcaseBackdropGroup);

  // Interactive Drag & Touch Orbit Controls
  setupShowcaseInteraction(canvas);

  // Resize handler
  window.addEventListener("resize", handleShowcaseResize);

  // Start Animation Loop
  startShowcaseLoop();
}

function handleShowcaseResize() {
  const canvas = byId("garageShowcaseCanvas");
  if (!canvas || !showcaseRenderer || !showcaseCamera) return;

  const width = canvas.clientWidth || 480;
  const height = canvas.clientHeight || 260;
  showcaseCamera.aspect = width / height;
  showcaseCamera.updateProjectionMatrix();
  showcaseRenderer.setSize(width, height, false);
}

function setupShowcaseInteraction(canvas) {
  const onPointerDown = (clientX) => {
    isDragging = true;
    previousMouseX = clientX;
    dragRotationVelocity = 0;
  };

  const onPointerMove = (clientX) => {
    if (!isDragging) return;
    const deltaX = clientX - previousMouseX;
    previousMouseX = clientX;
    dragRotationVelocity = deltaX * 0.012;
    turntableAngle += dragRotationVelocity;
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  canvas.addEventListener("mousedown", (e) => onPointerDown(e.clientX));
  window.addEventListener("mousemove", (e) => onPointerMove(e.clientX));
  window.addEventListener("mouseup", onPointerUp);

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length > 0) onPointerDown(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) onPointerMove(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener("touchend", onPointerUp);
}

function startShowcaseLoop() {
  if (showcaseAnimId) return;

  function animate() {
    showcaseAnimId = requestAnimationFrame(animate);

    if (!isDragging) {
      // Natural idle turntable spin + inertia damping
      dragRotationVelocity *= 0.94;
      turntableAngle += 0.008 + dragRotationVelocity;
    }

    if (showcaseCarGroup) {
      showcaseCarGroup.rotation.y = turntableAngle;
    }

    if (showcaseRenderer && showcaseScene && showcaseCamera) {
      showcaseRenderer.render(showcaseScene, showcaseCamera);
    }
  }

  animate();
}

export function stopShowcaseViewer() {
  if (showcaseAnimId) {
    cancelAnimationFrame(showcaseAnimId);
    showcaseAnimId = null;
  }
}

// ── Mount Real FBX Car on Turntable ─────────────────

export function updateShowcaseCar(carId) {
  if (!showcaseScene || !showcaseCarGroup) return;
  currentPreviewCarId = carId;

  // Clear existing car model
  while (showcaseCarGroup.children.length > 0) {
    const child = showcaseCarGroup.children[0];
    showcaseCarGroup.remove(child);
  }

  const carConfig = getCarConfig(carId);

  // Load and mount the real FBX 3D car model
  const carMesh = spawnCarModel(carId, { bodyColor: carConfig.bodyColor });

  if (carMesh) {
    carMesh.position.set(0, 0, 0);
    // Center alignment on turntable
    showcaseCarGroup.add(carMesh);
  } else {
    // If models are still loading, create temporary high-detail procedural placeholder and retry on ready
    const tempGroup = createHighDetailCarFallback(carConfig);
    showcaseCarGroup.add(tempGroup);

    if (!areCarsReady()) {
      preloadCarModels(() => {
        if (currentPreviewCarId === carId) {
          updateShowcaseCar(carId);
        }
      });
    }
  }

  // Update header label
  const carLabel = byId("showcaseCarName");
  if (carLabel) carLabel.textContent = carConfig.name.toUpperCase();
}

// ── Mount Real 3D Environment Backdrop on Turntable ─

export function updateShowcaseEnvironment(stageId) {
  if (!showcaseScene || !showcaseBackdropGroup) return;
  currentPreviewStageId = stageId;

  // Clear existing backdrop
  while (showcaseBackdropGroup.children.length > 0) {
    const child = showcaseBackdropGroup.children[0];
    showcaseBackdropGroup.remove(child);
  }

  const stageConfig = getStageConfig(stageId);

  // Update atmosphere & backdrop props matching the real stage objects
  const backdrop = createEnvironmentProps(stageId, stageConfig);
  showcaseBackdropGroup.add(backdrop);

  // Update header label
  const stageLabel = byId("showcaseStageName");
  if (stageLabel) stageLabel.textContent = stageConfig.name.toUpperCase();
}

function createEnvironmentProps(stageId, stageConfig) {
  const group = new THREE.Group();

  if (stageId === "city") {
    // 3D Downtown Avenue: Multi-story towers with illuminated glass windows & street poles
    const buildingColors = stageConfig.buildingColors || [0x334155, 0x475569, 0x0284c7];
    const towerPositions = [
      { x: -5.5, z: -4.5, h: 7, w: 2.2, d: 2.4, col: buildingColors[0] },
      { x: -2.8, z: -5.8, h: 9, w: 2.6, d: 2.6, col: buildingColors[1] },
      { x: 0.5, z: -6.2, h: 11, w: 3.0, d: 3.0, col: buildingColors[2] || 0x0284c7 },
      { x: 3.8, z: -5.6, h: 8.5, w: 2.5, d: 2.4, col: buildingColors[0] },
      { x: 6.2, z: -4.2, h: 6.5, w: 2.0, d: 2.2, col: buildingColors[1] }
    ];

    for (const b of towerPositions) {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mat = new THREE.MeshStandardMaterial({
        color: b.col,
        metalness: 0.6,
        roughness: 0.3
      });
      const tower = new THREE.Mesh(geo, mat);
      tower.position.set(b.x, b.h / 2, b.z);
      tower.castShadow = true;
      group.add(tower);

      // Glowing Neon Window Strips
      const windowGeo = new THREE.PlaneGeometry(b.w * 0.75, b.h * 0.7);
      const windowMat = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.45
      });
      const winMesh = new THREE.Mesh(windowGeo, windowMat);
      winMesh.position.set(b.x, b.h / 2, b.z + b.d / 2 + 0.02);
      group.add(winMesh);
    }
  } else if (stageId === "jungle" || stageId === "beach" || stageId === "village") {
    // 3D Forest & Coastal Trees
    const treePositions = [
      { x: -4.8, z: -4.0, scale: 1.2 },
      { x: -2.2, z: -5.5, scale: 1.4 },
      { x: 1.2, z: -5.8, scale: 1.5 },
      { x: 4.2, z: -4.6, scale: 1.3 }
    ];

    for (const pos of treePositions) {
      const tree = createDioramaTree(stageId);
      tree.position.set(pos.x, 0, pos.z);
      tree.scale.setScalar(pos.scale);
      group.add(tree);
    }
  } else if (stageId === "desert") {
    // 3D Sandstone Rock Arches & Desert Canyon Columns
    const rockPositions = [
      { x: -5.0, z: -4.5, h: 4.5, r: 1.6 },
      { x: -1.8, z: -6.0, h: 6.0, r: 2.2 },
      { x: 2.5, z: -5.8, h: 5.2, r: 1.9 },
      { x: 5.2, z: -4.0, h: 4.0, r: 1.4 }
    ];

    for (const rock of rockPositions) {
      const geo = new THREE.CylinderGeometry(rock.r * 0.7, rock.r, rock.h, 7);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xc2410c,
        roughness: 0.9,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(rock.x, rock.h / 2, rock.z);
      mesh.castShadow = true;
      group.add(mesh);
    }
  }

  return group;
}

function createDioramaTree(stageType) {
  const tree = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.8, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  tree.add(trunk);

  // Foliage
  const foliageColor = stageType === "village" ? 0x166534 : stageType === "beach" ? 0x22c55e : 0x15803d;
  const leavesGeo = new THREE.ConeGeometry(1.1, 2.2, 8);
  const leavesMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.7 });
  const leaves = new THREE.Mesh(leavesGeo, leavesMat);
  leaves.position.y = 2.4;
  leaves.castShadow = true;
  tree.add(leaves);

  return tree;
}

function createHighDetailCarFallback(car) {
  const group = new THREE.Group();

  // Sleek Aerodynamic Body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 4.0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: car.bodyColor || 0x06b6d4,
    metalness: 0.75,
    roughness: 0.2
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.4, 0.55, 2.0);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.1
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.0, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Headlights
  const lightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.1);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leftLight = new THREE.Mesh(lightGeo, lightMat);
  leftLight.position.set(-0.6, 0.55, 2.01);
  const rightLight = new THREE.Mesh(lightGeo, lightMat);
  rightLight.position.set(0.6, 0.55, 2.01);
  group.add(leftLight, rightLight);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
  const wheelPositions = [
    [-0.95, 0.35, 1.2],
    [0.95, 0.35, 1.2],
    [-0.95, 0.35, -1.2],
    [0.95, 0.35, -1.2]
  ];

  for (const pos of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(pos[0], pos[1], pos[2]);
    wheel.castShadow = true;
    group.add(wheel);
  }

  return group;
}

// ── Render Garage Vehicle and Stage Lists ───────────

export function renderGarage() {
  const wallet = getWallet();

  // Initialize or re-render 3D Showcase
  initShowcaseViewer();
  updateShowcaseCar(wallet.selectedCar);
  updateShowcaseEnvironment(wallet.selectedStage);

  renderCarList(wallet);
  renderStageList(wallet);
}

function renderCarList(wallet) {
  const container = byId("garageCars");
  if (!container) return;

  const cars = getAllCars();
  container.replaceChildren();

  for (const car of cars) {
    const isSelected = wallet.selectedCar === car.id;

    const card = document.createElement("article");
    card.className = `carCard ${isSelected ? "selected" : ""}`;

    // Card Top Header
    const topRow = document.createElement("div");
    topRow.className = "card-top-row";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = car.name;

    const badge = document.createElement("span");
    badge.className = `badge-tag ${isSelected ? "equipped" : "owned"}`;
    badge.textContent = isSelected ? "SELECTED" : "READY";

    topRow.append(title, badge);

    // Real 3D Object Vehicle Showcase Visual
    const visualBox = document.createElement("div");
    visualBox.className = "car-visual-box";
    visualBox.innerHTML = `
      <div class="car-visual-silhouette car-visual-${car.id}">
        <div class="car-badge-pill">${car.style.toUpperCase()}</div>
        <div class="car-model-spec">FBX MODEL: ${car.modelKey ? car.modelKey.toUpperCase() : "SPORTS"}</div>
        <div class="car-body-preview-strip" style="background: linear-gradient(90deg, ${car.bodyColor} 0%, ${car.accentColor} 100%)"></div>
      </div>
    `;

    // Stats
    const statsContainer = document.createElement("div");
    statsContainer.className = "stat-bars";

    const speedPct = Math.min(100, Math.round((car.speed / 30) * 100));
    const accelPct = Math.min(100, Math.round((car.acceleration / 1.5) * 100));
    const handlePct = Math.min(100, Math.round((car.handling / 1.5) * 100));

    statsContainer.innerHTML = `
      <div class="stat-item">
        <span>TOP SPEED</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${speedPct}%"></div></div>
      </div>
      <div class="stat-item">
        <span>ACCELERATION</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${accelPct}%"></div></div>
      </div>
      <div class="stat-item">
        <span>HANDLING</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${handlePct}%"></div></div>
      </div>
    `;

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "menuBtn";

    if (isSelected) {
      actionBtn.className += " secondary-btn";
      actionBtn.textContent = "IN USE";
      actionBtn.disabled = true;
    } else {
      actionBtn.className += " primary-btn";
      actionBtn.textContent = "SELECT VEHICLE";
      actionBtn.addEventListener("click", () => {
        selectCar(car.id);
        updateShowcaseCar(car.id);
        if (gameState.scene) {
          createPlayer(car.id);
        }
        renderGarage();
        onSelectionChangeCallback?.("car", car.id);
      });
    }

    // Clicking card directly updates showcase immediately
    card.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") {
        updateShowcaseCar(car.id);
      }
    });

    card.append(topRow, visualBox, statsContainer, actionBtn);
    container.append(card);
  }
}

function renderStageList(wallet) {
  const container = byId("garageStages");
  if (!container) return;

  const stages = getAllStages();
  container.replaceChildren();

  for (const stage of stages) {
    const isSelected = wallet.selectedStage === stage.id;

    const card = document.createElement("article");
    card.className = `stageCard ${isSelected ? "selected" : ""}`;

    const topRow = document.createElement("div");
    topRow.className = "card-top-row";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = stage.name;

    const badge = document.createElement("span");
    badge.className = `badge-tag ${isSelected ? "equipped" : "owned"}`;
    badge.textContent = isSelected ? "ACTIVE" : "READY";

    topRow.append(title, badge);

    // Real Environment 3D Diorama Visual Card
    const visualBox = document.createElement("div");
    visualBox.className = `stage-visual-box stage-visual-${stage.id}`;
    
    let objectDescription = "";
    if (stage.id === "city") objectDescription = "🏢 Real 3D FBX Skyscrapers & Streetlights";
    else if (stage.id === "beach") objectDescription = "🌊 Ocean Palms, Sand Dunes & Coastal Guardrails";
    else if (stage.id === "jungle") objectDescription = "🌲 Lush 3D Birch & Pine Forest Trail";
    else if (stage.id === "desert") objectDescription = "🏜️ Red Sandstone Canyon Columns & Arches";
    else if (stage.id === "village") objectDescription = "🏔️ Alpine Chalets & Snow-Laden Pines";

    visualBox.innerHTML = `
      <div class="stage-diorama-banner" style="background: linear-gradient(135deg, ${stage.skyColor} 0%, ${stage.groundColor} 100%)">
        <div class="stage-diorama-overlay">
          <div class="stage-env-type">${stage.scenery.toUpperCase()} ENVIRONMENT</div>
          <div class="stage-objects-badge">${objectDescription}</div>
        </div>
      </div>
    `;

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "menuBtn";

    if (isSelected) {
      actionBtn.className += " secondary-btn";
      actionBtn.textContent = "IN USE";
      actionBtn.disabled = true;
    } else {
      actionBtn.className += " primary-btn";
      actionBtn.textContent = "SELECT ENVIRONMENT";
      actionBtn.addEventListener("click", () => {
        selectStage(stage.id);
        updateShowcaseEnvironment(stage.id);
        if (gameState.scene) {
          createStage(stage.id);
        }
        renderGarage();
        onSelectionChangeCallback?.("stage", stage.id);
      });
    }

    // Clicking stage card updates showcase background immediately
    card.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") {
        updateShowcaseEnvironment(stage.id);
      }
    });

    card.append(topRow, visualBox, actionBtn);
    container.append(card);
  }
}

export function initializeGarage() {
  const carsTab = byId("carsTab");
  const stagesTab = byId("stagesTab");
  const garageCars = byId("garageCars");
  const garageStages = byId("garageStages");

  carsTab?.addEventListener("click", () => {
    carsTab.classList.add("active");
    stagesTab?.classList.remove("active");
    garageCars?.classList.add("active");
    if (garageCars) garageCars.hidden = false;
    garageStages?.classList.remove("active");
    if (garageStages) garageStages.hidden = true;
    handleShowcaseResize();
  });

  stagesTab?.addEventListener("click", () => {
    stagesTab.classList.add("active");
    carsTab?.classList.remove("active");
    garageStages?.classList.add("active");
    if (garageStages) garageStages.hidden = false;
    garageCars?.classList.remove("active");
    if (garageCars) garageCars.hidden = true;
    handleShowcaseResize();
  });

  renderGarage();
}
