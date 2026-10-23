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

// ── 3D Turntable Viewer State ─────────────────────────
let showcaseRenderer = null;
let showcaseScene = null;
let showcaseCamera = null;
let showcaseCarGroup = null;
let showcaseAnimId = null;
let turntableAngle = 0;
let isDragging = false;
let previousMouseX = 0;
let dragRotationVelocity = 0;
let currentPreviewCarId = null;
let activeCategoryFilter = "all";

function byId(id) {
  return document.getElementById(id);
}

export function setGarageSelectionCallback(callback) {
  onSelectionChangeCallback = callback;
}

// ── Initialize 3D Turntable Viewer ───────────────────
export function initCarSelectViewer() {
  const canvas = byId("carSelectShowcaseCanvas");
  if (!canvas) return;

  if (showcaseRenderer) {
    handleShowcaseResize();
    startShowcaseLoop();
    return;
  }

  showcaseScene = new THREE.Scene();

  const width = canvas.clientWidth || 400;
  const height = canvas.clientHeight || 240;
  showcaseCamera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
  showcaseCamera.position.set(4.2, 2.2, 5.0);
  showcaseCamera.lookAt(0, 0.45, 0);

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
  showcaseScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x00efff, 1.6);
  fillLight.position.set(-5, 4, -3);
  showcaseScene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xff4422, 1.2);
  rimLight.position.set(0, 3, -6);
  showcaseScene.add(rimLight);

  // Glowing Podium
  const podiumGroup = new THREE.Group();
  const discGeo = new THREE.CylinderGeometry(2.6, 2.8, 0.2, 48);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x071524,
    metalness: 0.85,
    roughness: 0.25
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.y = -0.1;
  disc.receiveShadow = true;
  podiumGroup.add(disc);

  const ringGeo = new THREE.TorusGeometry(2.65, 0.04, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00efff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  podiumGroup.add(ring);

  showcaseScene.add(podiumGroup);

  showcaseCarGroup = new THREE.Group();
  showcaseScene.add(showcaseCarGroup);

  setupShowcaseInteraction(canvas);
  window.addEventListener("resize", handleShowcaseResize);

  startShowcaseLoop();
}

function handleShowcaseResize() {
  const canvas = byId("carSelectShowcaseCanvas");
  if (!canvas || !showcaseRenderer || !showcaseCamera) return;

  const width = canvas.clientWidth || 400;
  const height = canvas.clientHeight || 240;
  if (width === 0 || height === 0) return;

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

export function stopCarSelectViewer() {
  if (showcaseAnimId) {
    cancelAnimationFrame(showcaseAnimId);
    showcaseAnimId = null;
  }
}

// ── Update 3D Model on Turntable ─────────────────────
export function updateShowcaseCar(carId) {
  currentPreviewCarId = carId;
  const carConfig = getCarConfig(carId);

  // Update fallback image
  const fallbackImg = byId("inspectorFallbackImg");
  if (fallbackImg) {
    fallbackImg.src = carConfig.image || `./assets/images/cars/${carId}.jpg`;
    fallbackImg.alt = carConfig.name;
  }

  if (!showcaseScene || !showcaseCarGroup) return;

  // Clear existing model
  while (showcaseCarGroup.children.length > 0) {
    const child = showcaseCarGroup.children[0];
    showcaseCarGroup.remove(child);
  }

  const carMesh = spawnCarModel(carId, { bodyColor: carConfig.bodyColor });

  if (carMesh) {
    carMesh.position.set(0, 0, 0);
    showcaseCarGroup.add(carMesh);
    if (fallbackImg) fallbackImg.style.display = "none";
  } else {
    // If FBX models are still downloading, display fallback image and retry on ready
    if (fallbackImg) fallbackImg.style.display = "block";
    if (!areCarsReady()) {
      preloadCarModels(() => {
        if (currentPreviewCarId === carId) {
          updateShowcaseCar(carId);
        }
      });
    }
  }

  updateInspectorPanel(carConfig);
}

// ── Update Inspector Details & Stats ─────────────────
function updateInspectorPanel(car) {
  const nameEl = byId("inspectorCarName");
  if (nameEl) nameEl.textContent = car.name;

  const tagEl = byId("inspectorCarTagline");
  if (tagEl) tagEl.textContent = car.tagline || `${car.category} · High Performance`;

  const catTagEl = byId("inspectorCategoryTag");
  if (catTagEl) {
    catTagEl.textContent = car.category || "SUPER SPORT";
    catTagEl.style.borderColor = car.accentColor || "#00efff";
    catTagEl.style.color = car.accentColor || "#00efff";
  }

  // Specs Chips
  const hpEl = byId("specHp");
  if (hpEl) hpEl.textContent = `${car.hp || 650} HP`;

  const topSpeedEl = byId("specTopSpeed");
  if (topSpeedEl) topSpeedEl.textContent = `${car.topSpeedMph || 200} MPH`;

  const weightEl = byId("specWeight");
  if (weightEl) weightEl.textContent = `${(car.weightKg || 1350).toLocaleString()} KG`;

  // Stats Bars
  const setBar = (valId, fillId, rating) => {
    const valEl = byId(valId);
    const fillEl = byId(fillId);
    const score = Number(rating || 8.5).toFixed(1);
    if (valEl) valEl.textContent = score;
    if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(10, score * 10))}%`;
  };

  setBar("statSpeedVal", "statSpeedFill", car.maxSpeedRating);
  setBar("statAccelVal", "statAccelFill", car.accelRating);
  setBar("statHandlingVal", "statHandlingFill", car.handlingRating);
  setBar("statBrakingVal", "statBrakingFill", car.brakingRating);
  setBar("statStabilityVal", "statStabilityFill", car.stabilityRating);
}

// ── Render Car Selection Grid ────────────────────────
export function renderCarSelectionScreen(category = activeCategoryFilter) {
  activeCategoryFilter = category;
  const container = byId("carCardsGrid");
  if (!container) return;

  const wallet = getWallet();
  const selectedCarId = gameState.selectedCar || wallet.selectedCar || "cyber";
  const allCars = getAllCars();

  container.replaceChildren();

  const filteredCars = allCars.filter((car) => {
    if (category === "all") return true;
    if (category === "sport") return car.style === "sport";
    if (category === "muscle") return car.style === "muscle";
    if (category === "tuner") return car.style === "futuristic" || car.modelKey === "hatchback";
    if (category === "utility") return car.style === "suv" || car.style === "police" || car.style === "taxi" || car.style === "sedan";
    return true;
  });

  for (const car of filteredCars) {
    const isSelected = selectedCarId === car.id;

    const card = document.createElement("article");
    card.className = `car-select-card ${isSelected ? "selected" : ""}`;
    card.dataset.carId = car.id;

    // Top Row: Category badge & Selection checkmark
    const topRow = document.createElement("div");
    topRow.className = "car-card-top";

    const catBadge = document.createElement("span");
    catBadge.className = "car-card-category";
    catBadge.textContent = car.category || "SPORT";
    catBadge.style.color = car.accentColor || "#00efff";

    const statusBadge = document.createElement("span");
    statusBadge.className = `car-card-status ${isSelected ? "active" : ""}`;
    statusBadge.textContent = isSelected ? "EQUIPPED ✓" : "SELECT";

    topRow.append(catBadge, statusBadge);

    // Image Box
    const imgBox = document.createElement("div");
    imgBox.className = "car-card-thumb-wrap";

    const img = document.createElement("img");
    img.className = "car-card-thumb";
    img.src = car.image || `./assets/images/cars/${car.id}.jpg`;
    img.alt = car.name;
    img.loading = "lazy";
    imgBox.append(img);

    // Car Info Row
    const infoRow = document.createElement("div");
    infoRow.className = "car-card-info";

    const title = document.createElement("h4");
    title.className = "car-card-name";
    title.textContent = car.name;

    const statsMini = document.createElement("div");
    statsMini.className = "car-card-mini-specs";
    statsMini.innerHTML = `
      <span>⚡ ${car.hp || 600} HP</span>
      <span>🏁 ${car.topSpeedMph || 190} MPH</span>
    `;

    infoRow.append(title, statsMini);

    card.append(topRow, imgBox, infoRow);

    // Selection Click Event
    card.addEventListener("click", () => {
      selectCar(car.id);
      gameState.selectedCar = car.id;

      if (gameState.scene) {
        createPlayer(car.id);
      }

      updateShowcaseCar(car.id);

      // Update card visual states
      container.querySelectorAll(".car-select-card").forEach((c) => {
        const isThis = c.dataset.carId === car.id;
        c.classList.toggle("selected", isThis);
        const st = c.querySelector(".car-card-status");
        if (st) {
          st.textContent = isThis ? "EQUIPPED ✓" : "SELECT";
          st.classList.toggle("active", isThis);
        }
      });

      onSelectionChangeCallback?.("car", car.id);
    });

    container.append(card);
  }

  // Ensure inspector reflects the selected car
  const activeCar = getCarConfig(selectedCarId);
  updateShowcaseCar(activeCar.id);
}

// ── Render Track / Environment Selection Grid ────────
export function renderTrackSelectionScreen() {
  const container = byId("trackCardsGrid");
  if (!container) return;

  const wallet = getWallet();
  const selectedStageId = gameState.selectedStage || wallet.selectedStage || "city";
  const stages = getAllStages();

  // Update Active Car pill in header
  const activeCarConfig = getCarConfig(gameState.selectedCar || wallet.selectedCar || "cyber");
  const activeCarLabel = byId("trackActiveCarName");
  if (activeCarLabel) {
    activeCarLabel.textContent = `${activeCarConfig.name} (${activeCarConfig.category})`;
  }

  container.replaceChildren();

  for (const stage of stages) {
    const isSelected = selectedStageId === stage.id;

    const card = document.createElement("article");
    card.className = `track-select-card ${isSelected ? "selected" : ""}`;
    card.dataset.stageId = stage.id;

    // Card Header Banner
    const banner = document.createElement("div");
    banner.className = `track-card-banner track-theme-${stage.id}`;
    banner.style.background = `linear-gradient(135deg, ${stage.skyColor} 0%, ${stage.groundColor} 100%)`;

    const bannerOverlay = document.createElement("div");
    bannerOverlay.className = "track-card-banner-content";

    const catBadge = document.createElement("span");
    catBadge.className = "track-card-category";
    catBadge.textContent = stage.category || "RACING CIRCUIT";

    const diffBadge = document.createElement("span");
    diffBadge.className = "track-card-diff";
    diffBadge.textContent = stage.difficulty || "REGULAR";

    bannerOverlay.append(catBadge, diffBadge);
    banner.append(bannerOverlay);

    // Card Body
    const body = document.createElement("div");
    body.className = "track-card-body";

    const title = document.createElement("h3");
    title.className = "track-card-title";
    title.textContent = stage.name;

    const tagline = document.createElement("p");
    tagline.className = "track-card-desc";
    tagline.textContent = stage.tagline || stage.scenery;

    // Track Specs Row
    const specsRow = document.createElement("div");
    specsRow.className = "track-specs-row";
    specsRow.innerHTML = `
      <div class="track-spec-item">
        <span>ATMOSPHERE</span>
        <strong>${stage.atmosphere || "Clear"}</strong>
      </div>
      <div class="track-spec-item">
        <span>ROAD GRIP</span>
        <strong>${stage.gripRating || "9.0 / 10"}</strong>
      </div>
    `;

    // Action / Status Pill
    const statusRow = document.createElement("div");
    statusRow.className = "track-card-bottom";

    const statusPill = document.createElement("span");
    statusPill.className = `track-status-pill-badge ${isSelected ? "selected" : ""}`;
    statusPill.textContent = isSelected ? "SELECTED TRACK 🏁" : "DRIVE THIS TRACK";

    statusRow.append(statusPill);

    body.append(title, tagline, specsRow, statusRow);
    card.append(banner, body);

    // Selection Click Event
    card.addEventListener("click", () => {
      selectStage(stage.id);
      gameState.selectedStage = stage.id;

      if (gameState.scene) {
        createStage(stage.id);
      }

      // Update card visual states
      container.querySelectorAll(".track-select-card").forEach((c) => {
        const isThis = c.dataset.stageId === stage.id;
        c.classList.toggle("selected", isThis);
        const pill = c.querySelector(".track-status-pill-badge");
        if (pill) {
          pill.textContent = isThis ? "SELECTED TRACK 🏁" : "DRIVE THIS TRACK";
          pill.classList.toggle("selected", isThis);
        }
      });

      onSelectionChangeCallback?.("stage", stage.id);
    });

    container.append(card);
  }
}

// ── Bind Filter Buttons & Global Handlers ────────────
export function initializeGarage() {
  // Bind category filter buttons
  const filterRow = byId("carCategoryFilters");
  if (filterRow) {
    filterRow.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterRow.querySelectorAll(".cat-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const category = btn.dataset.category || "all";
        renderCarSelectionScreen(category);
      });
    });
  }
}

export function renderGarage() {
  renderCarSelectionScreen();
  renderTrackSelectionScreen();
}
