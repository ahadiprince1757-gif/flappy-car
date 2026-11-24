import * as THREE from "three";
import { getAllCars, getCarConfig } from "./cars.js";
import { getAllStages, getStageConfig } from "../stages/stages.js";
import {
  getWallet,
  selectCar,
  selectStage,
  purchaseCar,
  purchaseStage
} from "../systems/economy.js";
import { playCoinSound } from "../systems/audio.js";
import { gameState } from "../core/gameState.js";
import { createPlayer } from "../player/player.js";
import { createStage } from "../stages/stageRenderer.js";
import { spawnCarModel, preloadCarModels, areCarsReady } from "./carModelLoader.js";

let onSelectionChangeCallback = null;

// â”€â”€ 3D Turntable Viewer State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

const _stageSnapshotCache = new Map();

function byId(id) {
  return document.getElementById(id);
}

export function setGarageSelectionCallback(callback) {
  onSelectionChangeCallback = callback;
}

// â”€â”€ Initialize 3D Turntable Viewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    alpha: false,
    powerPreference: "high-performance"
  });
  showcaseRenderer.setClearColor(0x000000, 1.0);
  showcaseRenderer.setSize(width, height, false);
  showcaseRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  showcaseRenderer.shadowMap.enabled = true;
  showcaseRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Studio Lighting Rig
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  showcaseScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(5, 8, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  showcaseScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x00efff, 1.8);
  fillLight.position.set(-5, 4, -3);
  showcaseScene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xff4422, 1.4);
  rimLight.position.set(0, 3, -6);
  showcaseScene.add(rimLight);

  // Glowing Solid Podium
  const podiumGroup = new THREE.Group();
  const discGeo = new THREE.CylinderGeometry(2.6, 2.8, 0.2, 48);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    metalness: 0.9,
    roughness: 0.2
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

// â”€â”€ Update 3D Model on Turntable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// ── Update Inspector Details & Stats ──────────────────────────────
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

  // Buy / Equip Button in Inspector
  const buyBtn = byId("inspectorBuyEquipBtn");
  if (buyBtn) {
    const wallet = getWallet();
    const isOwned = wallet.ownedCars.includes(car.id);
    const isSelected = isOwned && (gameState.selectedCar === car.id || wallet.selectedCar === car.id);

    if (isSelected) {
      buyBtn.textContent = "EQUIPPED ✓";
      buyBtn.className = "btn-action btn-secondary";
      buyBtn.style.opacity = "0.7";
      buyBtn.onclick = null;
    } else if (isOwned) {
      buyBtn.textContent = "EQUIP CAR";
      buyBtn.className = "btn-action btn-primary";
      buyBtn.style.opacity = "1";
      buyBtn.onclick = () => {
        selectCar(car.id);
        gameState.selectedCar = car.id;
        if (gameState.scene) createPlayer(car.id);
        renderCarSelectionScreen();
        onSelectionChangeCallback?.("car", car.id);
      };
    } else {
      buyBtn.textContent = `UNLOCK · 🪙 ${car.price}`;
      buyBtn.className = "btn-action btn-primary";
      buyBtn.style.opacity = "1";
      buyBtn.onclick = () => {
        const currentWallet = getWallet();
        if (currentWallet.coins < car.price) {
          alert(`Insufficient Coins!\nYou need ${car.price} coins to unlock ${car.name}.\nYou currently have ${currentWallet.coins} coins.\n\nPlay more races to collect coins!`);
          return;
        }

        const res = purchaseCar(car.id);
        if (res.success) {
          playCoinSound();
          selectCar(car.id);
          gameState.selectedCar = car.id;
          if (gameState.scene) createPlayer(car.id);
          const coinDisplay = byId("coinDisplay");
          if (coinDisplay) coinDisplay.textContent = res.coins;
          renderCarSelectionScreen();
          onSelectionChangeCallback?.("car", car.id);
        }
      };
    }
  }
}

// ── Render Car Selection Grid ──────────────────────────────
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
    const isOwned = wallet.ownedCars.includes(car.id);
    const isSelected = isOwned && selectedCarId === car.id;

    const card = document.createElement("article");
    card.className = `car-select-card ${isSelected ? "selected" : ""} ${!isOwned ? "locked-card" : ""}`;
    card.dataset.carId = car.id;

    // Top Row: Category badge & Selection checkmark
    const topRow = document.createElement("div");
    topRow.className = "car-card-top";

    const catBadge = document.createElement("span");
    catBadge.className = "car-card-category";
    catBadge.textContent = car.category || "SPORT";
    catBadge.style.color = car.accentColor || "#00efff";

    const statusBadge = document.createElement("span");
    if (!isOwned) {
      statusBadge.className = "car-card-status locked";
      statusBadge.textContent = `🔒 ${car.price}`;
    } else {
      statusBadge.className = `car-card-status ${isSelected ? "active" : ""}`;
      statusBadge.textContent = isSelected ? "EQUIPPED ✓" : "SELECT";
    }

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
      <span>🏎️ ${car.topSpeedMph || 190} MPH</span>
    `;

    infoRow.append(title, statsMini);
    card.append(topRow, imgBox, infoRow);

    // Selection Click Event
    card.addEventListener("click", () => {
      updateShowcaseCar(car.id);

      if (!isOwned) {
        // Preview on turntable, and trigger inspector buy flow
        container.querySelectorAll(".car-select-card").forEach((c) => {
          c.classList.toggle("preview-selected", c.dataset.carId === car.id);
        });
        return;
      }

      selectCar(car.id);
      gameState.selectedCar = car.id;

      if (gameState.scene) {
        createPlayer(car.id);
      }

      container.querySelectorAll(".car-select-card").forEach((c) => {
        const isThis = c.dataset.carId === car.id;
        c.classList.toggle("selected", isThis);
        c.classList.remove("preview-selected");
        const st = c.querySelector(".car-card-status");
        if (st && !c.classList.contains("locked-card")) {
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

// â”€â”€ 2D Canvas Stage Panorama Painter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generates beautiful illustrated panoramas for each stage card
function getStageDioramaSnapshot(stageId) {
  if (_stageSnapshotCache.has(stageId)) {
    return _stageSnapshotCache.get(stageId);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");

  const painters = {
    city: paintCityStage,
    savannah: paintSavannahStage,
    desert: paintDesertStage,
    jungle: paintJungleStage,
    beach: paintBeachStage,
    village: paintVillageStage,
  };

  const painter = painters[stageId] || paintCityStage;
  painter(ctx, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  _stageSnapshotCache.set(stageId, dataUrl);
  return dataUrl;
}

// ── Realistic 3D Stage Drawing Engine (Cinematic Racing Cover Art) ──────────────────────────
function drawCinematicHighway(ctx, W, H, roadHex, curbA, curbB, lineHex) {
  const vpX = W * 0.5, vpY = H * 0.44;
  const bottomRoadW = W * 0.92;
  const topRoadW = 32;

  // Road tarmac with texture gradient
  const roadGrad = ctx.createLinearGradient(0, vpY, 0, H);
  roadGrad.addColorStop(0, "#111827");
  roadGrad.addColorStop(0.4, roadHex);
  roadGrad.addColorStop(1, "#030712");

  ctx.beginPath();
  ctx.moveTo(vpX - bottomRoadW / 2, H);
  ctx.lineTo(vpX + bottomRoadW / 2, H);
  ctx.lineTo(vpX + topRoadW / 2, vpY);
  ctx.lineTo(vpX - topRoadW / 2, vpY);
  ctx.closePath();
  ctx.fillStyle = roadGrad;
  ctx.fill();

  // Curbs on left and right
  const curbW = 32;
  const topCurbW = 4;

  // Left Curb
  ctx.beginPath();
  ctx.moveTo(vpX - bottomRoadW / 2 - curbW, H);
  ctx.lineTo(vpX - bottomRoadW / 2, H);
  ctx.lineTo(vpX - topRoadW / 2, vpY);
  ctx.lineTo(vpX - topRoadW / 2 - topCurbW, vpY);
  ctx.closePath();
  const leftCurbGrad = ctx.createLinearGradient(0, vpY, 0, H);
  leftCurbGrad.addColorStop(0, curbB);
  leftCurbGrad.addColorStop(0.5, curbA);
  leftCurbGrad.addColorStop(1, curbB);
  ctx.fillStyle = leftCurbGrad;
  ctx.fill();

  // Right Curb
  ctx.beginPath();
  ctx.moveTo(vpX + bottomRoadW / 2, H);
  ctx.lineTo(vpX + bottomRoadW / 2 + curbW, H);
  ctx.lineTo(vpX + topRoadW / 2 + topCurbW, vpY);
  ctx.lineTo(vpX + topRoadW / 2, vpY);
  ctx.closePath();
  ctx.fillStyle = leftCurbGrad;
  ctx.fill();

  // 3D Guard Rail Posts along highway
  for (let s = 0; s < 14; s++) {
    const t = Math.pow(s / 14, 2.2);
    const y = vpY + (H - vpY) * t;
    const halfW = (topRoadW / 2 + (bottomRoadW / 2 - topRoadW / 2) * t) + (topCurbW + (curbW - topCurbW) * t);
    const postH = 6 + 32 * t;

    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(vpX - halfW - 3 * t, y - postH, 4 * t + 1, postH);
    ctx.fillRect(vpX + halfW, y - postH, 4 * t + 1, postH);
  }

  // 5 Lane Dash Lines with high-speed perspective
  const laneFractions = [-0.32, -0.16, 0, 0.16, 0.32];
  for (const frac of laneFractions) {
    ctx.save();
    ctx.strokeStyle = lineHex || "#f8fafc";
    ctx.lineWidth = frac === 0 ? 3 : 2;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    ctx.moveTo(vpX + topRoadW * frac * 0.8, vpY + 2);
    ctx.lineTo(vpX + bottomRoadW * frac, H);
    ctx.stroke();
    ctx.restore();
  }

  // Wet road reflections / headlamp gloss
  const wetReflect = ctx.createLinearGradient(vpX - 80, 0, vpX + 80, 0);
  wetReflect.addColorStop(0, "rgba(255,255,255,0)");
  wetReflect.addColorStop(0.5, "rgba(255,255,255,0.18)");
  wetReflect.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wetReflect;
  ctx.beginPath();
  ctx.moveTo(vpX - 100, H);
  ctx.lineTo(vpX + 100, H);
  ctx.lineTo(vpX + 15, vpY);
  ctx.lineTo(vpX - 15, vpY);
  ctx.closePath();
  ctx.fill();
}

function drawSpeedLines(ctx, W, H, color) {
  ctx.save();
  ctx.strokeStyle = color || "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.5;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const startX = Math.random() * W;
    const startY = H * 0.45 + Math.random() * (H * 0.55);
    const len = 30 + Math.random() * 80;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + (startX - W / 2) * 0.25, startY + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// 1. CITY: Ultra-Realistic 3D Cyber Neon Highway
function paintCityStage(ctx, W, H) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  skyGrad.addColorStop(0, "#020617");
  skyGrad.addColorStop(0.6, "#0f172a");
  skyGrad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.46);

  const skylineLayers = [
    { count: 18, minH: 80, maxH: 190, color: "#1e1b4b" },
    { count: 14, minH: 100, maxH: 240, color: "#090d16" }
  ];

  for (const layer of skylineLayers) {
    const colW = W / layer.count;
    for (let i = 0; i < layer.count; i++) {
      const bh = layer.minH + Math.sin(i * 1.7) * (layer.maxH - layer.minH) * 0.5 + Math.random() * 30;
      const bx = i * colW - 10;
      const by = H * 0.45 - bh;

      ctx.fillStyle = layer.color;
      ctx.fillRect(bx, by, colW + 4, bh);

      ctx.fillStyle = Math.random() > 0.4 ? "rgba(0,239,255,0.8)" : "rgba(255,215,0,0.7)";
      for (let wy = by + 10; wy < H * 0.44; wy += 12) {
        if (Math.random() > 0.45) ctx.fillRect(bx + 4, wy, 4, 6);
        if (Math.random() > 0.45) ctx.fillRect(bx + colW - 8, wy, 4, 6);
      }
    }
  }

  const horizonGlow = ctx.createRadialGradient(W / 2, H * 0.44, 10, W / 2, H * 0.44, W * 0.6);
  horizonGlow.addColorStop(0, "rgba(0,239,255,0.65)");
  horizonGlow.addColorStop(0.4, "rgba(168,85,247,0.35)");
  horizonGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, H * 0.25, W, H * 0.22);

  const groundGrad = ctx.createLinearGradient(0, H * 0.44, 0, H);
  groundGrad.addColorStop(0, "#090d16");
  groundGrad.addColorStop(1, "#020617");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H * 0.44, W, H * 0.56);

  drawCinematicHighway(ctx, W, H, "#0f172a", "#00efff", "#ff007f", "#38bdf8");
  drawSpeedLines(ctx, W, H, "rgba(0,239,255,0.4)");
  drawVignette(ctx, W, H);
}

// 2. SAVANNAH: Realistic 3D African Sunset Safari Expressway
function paintSavannahStage(ctx, W, H) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  skyGrad.addColorStop(0, "#451a03");
  skyGrad.addColorStop(0.35, "#b45309");
  skyGrad.addColorStop(0.7, "#f59e0b");
  skyGrad.addColorStop(1, "#fef08a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.46);

  const sunGrad = ctx.createRadialGradient(W * 0.5, H * 0.36, 10, W * 0.5, H * 0.36, 120);
  sunGrad.addColorStop(0, "#ffffff");
  sunGrad.addColorStop(0.25, "#fef08a");
  sunGrad.addColorStop(0.6, "rgba(245,158,11,0.5)");
  sunGrad.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.36, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.45);
  ctx.lineTo(W * 0.25, H * 0.42);
  ctx.lineTo(W * 0.45, H * 0.44);
  ctx.lineTo(W * 0.75, H * 0.41);
  ctx.lineTo(W, H * 0.45);
  ctx.lineTo(W, H * 0.46);
  ctx.lineTo(0, H * 0.46);
  ctx.closePath();
  ctx.fill();

  const grassGrad = ctx.createLinearGradient(0, H * 0.44, 0, H);
  grassGrad.addColorStop(0, "#b45309");
  grassGrad.addColorStop(0.4, "#78350f");
  grassGrad.addColorStop(1, "#451a03");
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, H * 0.44, W, H * 0.56);

  const trees = [
    { x: W * 0.12, y: H * 0.44, s: 1.1 },
    { x: W * 0.22, y: H * 0.445, s: 0.7 },
    { x: W * 0.82, y: H * 0.44, s: 1.2 },
    { x: W * 0.92, y: H * 0.445, s: 0.8 }
  ];
  for (const t of trees) {
    ctx.fillStyle = "#291305";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y - 42 * t.s, 44 * t.s, 14 * t.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(t.x - 3 * t.s, t.y - 42 * t.s, 6 * t.s, 42 * t.s);
  }

  drawCinematicHighway(ctx, W, H, "#292524", "#d97706", "#ffffff", "#fef08a");
  drawSpeedLines(ctx, W, H, "rgba(254,240,138,0.3)");
  drawVignette(ctx, W, H);
}

// 3. BEACH: Realistic 3D Coastal Ocean Boulevard
function paintBeachStage(ctx, W, H) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  skyGrad.addColorStop(0, "#0369a1");
  skyGrad.addColorStop(0.45, "#38bdf8");
  skyGrad.addColorStop(0.85, "#fb923c");
  skyGrad.addColorStop(1, "#fef08a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.46);

  const sunX = W * 0.28, sunY = H * 0.42;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 80);
  sunGrad.addColorStop(0, "#ffffff");
  sunGrad.addColorStop(0.3, "#fde047");
  sunGrad.addColorStop(1, "rgba(253,224,71,0)");
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
  ctx.fill();

  const oceanGrad = ctx.createLinearGradient(0, H * 0.44, 0, H);
  oceanGrad.addColorStop(0, "#0284c7");
  oceanGrad.addColorStop(0.5, "#0369a1");
  oceanGrad.addColorStop(1, "#075985");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, H * 0.44, W * 0.4, H * 0.56);

  const sandGrad = ctx.createLinearGradient(0, H * 0.44, 0, H);
  sandGrad.addColorStop(0, "#fde047");
  sandGrad.addColorStop(1, "#d97706");
  ctx.fillStyle = sandGrad;
  ctx.fillRect(W * 0.4, H * 0.44, W * 0.6, H * 0.56);

  const palms = [
    { x: W * 0.78, y: H * 0.44, s: 1.3 },
    { x: W * 0.88, y: H * 0.445, s: 1.0 },
    { x: W * 0.96, y: H * 0.45, s: 0.8 }
  ];
  for (const p of palms) {
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 5 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x - 10 * p.s, p.y - 30 * p.s, p.x + 8 * p.s, p.y - 70 * p.s);
    ctx.stroke();

    ctx.fillStyle = "#14532d";
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(p.x + 8 * p.s + Math.cos(angle) * 20 * p.s, p.y - 70 * p.s + Math.sin(angle) * 8 * p.s, 22 * p.s, 6 * p.s, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCinematicHighway(ctx, W, H, "#1e293b", "#38bdf8", "#ffffff", "#ffffff");
  drawSpeedLines(ctx, W, H, "rgba(56,189,248,0.35)");
  drawVignette(ctx, W, H);
}

// 4. DESERT: Realistic 3D Red Rock Canyon Gorge
function paintDesertStage(ctx, W, H) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  skyGrad.addColorStop(0, "#7c2d12");
  skyGrad.addColorStop(0.4, "#ea580c");
  skyGrad.addColorStop(0.8, "#fb923c");
  skyGrad.addColorStop(1, "#fed7aa");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.46);

  const canyonLeft = ctx.createLinearGradient(0, 0, W * 0.35, 0);
  canyonLeft.addColorStop(0, "#431407");
  canyonLeft.addColorStop(0.7, "#9a3412");
  canyonLeft.addColorStop(1, "#c2410c");

  ctx.fillStyle = canyonLeft;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * 0.32, 0);
  ctx.lineTo(W * 0.28, H * 0.25);
  ctx.lineTo(W * 0.20, H * 0.44);
  ctx.lineTo(0, H * 0.44);
  ctx.closePath();
  ctx.fill();

  const canyonRight = ctx.createLinearGradient(W, 0, W * 0.65, 0);
  canyonRight.addColorStop(0, "#431407");
  canyonRight.addColorStop(0.7, "#9a3412");
  canyonRight.addColorStop(1, "#c2410c");

  ctx.fillStyle = canyonRight;
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(W * 0.68, 0);
  ctx.lineTo(W * 0.72, H * 0.25);
  ctx.lineTo(W * 0.80, H * 0.44);
  ctx.lineTo(W, H * 0.44);
  ctx.closePath();
  ctx.fill();

  const sandGrad = ctx.createLinearGradient(0, H * 0.44, 0, H);
  sandGrad.addColorStop(0, "#c2410c");
  sandGrad.addColorStop(0.4, "#9a3412");
  sandGrad.addColorStop(1, "#431407");
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, H * 0.44, W, H * 0.56);

  drawCinematicHighway(ctx, W, H, "#1c1917", "#ea580c", "#ffffff", "#fed7aa");
  drawSpeedLines(ctx, W, H, "rgba(234,88,12,0.4)");
  drawVignette(ctx, W, H);
}

// 5. JUNGLE: Realistic 3D Tropical Rainforest Highway
function paintJungleStage(ctx, W, H) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  skyGrad.addColorStop(0, "#064e3b");
  skyGrad.addColorStop(0.5, "#047857");
  skyGrad.addColorStop(0.85, "#34d399");
  skyGrad.addColorStop(1, "#a7f3d0");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.46);

  const mistGrad = ctx.createRadialGradient(W / 2, H * 0.44, 20, W / 2, H * 0.44, W * 0.55);
  mistGrad.addColorStop(0, "rgba(167,243,208,0.6)");
  mistGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, H * 0.2, W, H * 0.3);

  ctx.fillStyle = "#064e3b";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.44);
  ctx.lineTo(W * 0.2, H * 0.18);
  ctx.lineTo(W * 0.5, H * 0.32);
  ctx.lineTo(W * 0.8, H * 0.15);
  ctx.lineTo(W, H * 0.44);
  ctx.closePath();
  ctx.fill();

  const jungleFloor = ctx.createLinearGradient(0, H * 0.44, 0, H);
  jungleFloor.addColorStop(0, "#047857");
  jungleFloor.addColorStop(0.5, "#064e3b");
  jungleFloor.addColorStop(1, "#022c22");
  ctx.fillStyle = jungleFloor;
  ctx.fillRect(0, H * 0.44, W, H * 0.56);

  drawCinematicHighway(ctx, W, H, "#0f172a", "#10b981", "#ffffff", "#6ee7b7");
  drawSpeedLines(ctx, W, H, "rgba(52,211,153,0.35)");
  drawVignette(ctx, W, H);
}

// 6. VILLAGE: Realistic 3D Snow-Dusted Alpine Peaks
function paintVillageStage(ctx, W, H) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  skyGrad.addColorStop(0, "#1e3a8a");
  skyGrad.addColorStop(0.45, "#3b82f6");
  skyGrad.addColorStop(0.85, "#93c5fd");
  skyGrad.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.46);

  const peaks = [
    { x: W * 0.15, h: 180, w: 160 },
    { x: W * 0.40, h: 220, w: 200 },
    { x: W * 0.65, h: 240, w: 210 },
    { x: W * 0.88, h: 190, w: 180 }
  ];

  for (const p of peaks) {
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(p.x - p.w / 2, H * 0.44);
    ctx.lineTo(p.x, H * 0.44 - p.h);
    ctx.lineTo(p.x + p.w / 2, H * 0.44);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(p.x - p.w * 0.22, H * 0.44 - p.h * 0.55);
    ctx.lineTo(p.x, H * 0.44 - p.h);
    ctx.lineTo(p.x + p.w * 0.22, H * 0.44 - p.h * 0.55);
    ctx.lineTo(p.x + p.w * 0.08, H * 0.44 - p.h * 0.45);
    ctx.lineTo(p.x, H * 0.44 - p.h * 0.5);
    ctx.lineTo(p.x - p.w * 0.08, H * 0.44 - p.h * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  const alpineGround = ctx.createLinearGradient(0, H * 0.44, 0, H);
  alpineGround.addColorStop(0, "#1e293b");
  alpineGround.addColorStop(0.5, "#0f172a");
  alpineGround.addColorStop(1, "#020617");
  ctx.fillStyle = alpineGround;
  ctx.fillRect(0, H * 0.44, W, H * 0.56);

  drawCinematicHighway(ctx, W, H, "#1e293b", "#38bdf8", "#ffffff", "#ffffff");
  drawSpeedLines(ctx, W, H, "rgba(255,255,255,0.45)");
  drawVignette(ctx, W, H);
}

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
    activeCarLabel.textContent = `${activeCarConfig.name}`;
  }

  container.replaceChildren();

  for (const stage of stages) {
    const isOwned = wallet.ownedStages.includes(stage.id);
    const isSelected = isOwned && selectedStageId === stage.id;

    const card = document.createElement("article");
    card.className = `track-select-card ${isSelected ? "selected" : ""} ${!isOwned ? "locked-card" : ""}`;
    card.dataset.stageId = stage.id;

    // 1. Stage Picture Container (Large, prominent photo of the stage)
    const photoBox = document.createElement("div");
    photoBox.className = "track-card-photo-box";

    // Generate real 3D diorama photo of the stage
    const photoUrl = getStageDioramaSnapshot(stage.id);

    const img = document.createElement("img");
    img.className = "track-card-photo-img";
    img.src = photoUrl;
    img.alt = stage.name;
    img.loading = "lazy";

    // Floating badges over stage photo
    const overlayBadges = document.createElement("div");
    overlayBadges.className = "track-photo-overlay-badges";

    const catBadge = document.createElement("span");
    catBadge.className = "track-card-category-badge";
    catBadge.textContent = stage.category || "STAGE";

    const diffBadge = document.createElement("span");
    diffBadge.className = "track-card-diff-badge";
    diffBadge.textContent = stage.difficulty || "REGULAR";

    overlayBadges.append(catBadge, diffBadge);
    photoBox.append(img, overlayBadges);

    // 2. Card Info Body
    const body = document.createElement("div");
    body.className = "track-card-body";

    const headerRow = document.createElement("div");
    headerRow.className = "track-card-header-row";

    const title = document.createElement("h3");
    title.className = "track-card-title";
    title.textContent = stage.name;

    const selectStatus = document.createElement("span");
    if (!isOwned) {
      selectStatus.className = "track-select-status-tag locked";
      selectStatus.textContent = `🔒 ${stage.price}`;
    } else {
      selectStatus.className = `track-select-status-tag ${isSelected ? "active" : ""}`;
      selectStatus.textContent = isSelected ? "SELECTED ✓" : "SELECT";
    }

    headerRow.append(title, selectStatus);

    const tagline = document.createElement("p");
    tagline.className = "track-card-desc";
    tagline.textContent = stage.tagline || stage.scenery;

    // Track Specs Mini Row
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

    body.append(headerRow, tagline, specsRow);
    card.append(photoBox, body);

    // Selection Click Event
    card.addEventListener("click", () => {
      if (!isOwned) {
        const currentWallet = getWallet();
        if (currentWallet.coins < stage.price) {
          alert(`Insufficient Coins!\nYou need ${stage.price} coins to unlock ${stage.name}.\nYou currently have ${currentWallet.coins} coins.`);
          return;
        }

        const confirmUnlock = confirm(`Unlock track "${stage.name}" for ${stage.price} coins?`);
        if (!confirmUnlock) return;

        const res = purchaseStage(stage.id);
        if (res.success) {
          playCoinSound();
          selectStage(stage.id);
          gameState.selectedStage = stage.id;
          if (gameState.scene) createStage(stage.id);
          const coinDisplay = byId("coinDisplay");
          if (coinDisplay) coinDisplay.textContent = res.coins;
          renderTrackSelectionScreen();
          onSelectionChangeCallback?.("stage", stage.id);
        }
        return;
      }

      selectStage(stage.id);
      gameState.selectedStage = stage.id;

      if (gameState.scene) {
        createStage(stage.id);
      }

      container.querySelectorAll(".track-select-card").forEach((c) => {
        const isThis = c.dataset.stageId === stage.id;
        c.classList.toggle("selected", isThis);
        const tag = c.querySelector(".track-select-status-tag");
        if (tag && !c.classList.contains("locked-card")) {
          tag.textContent = isThis ? "SELECTED ✓" : "SELECT";
          tag.classList.toggle("active", isThis);
        }
      });

      onSelectionChangeCallback?.("stage", stage.id);
    });

    container.append(card);
  }
}

// â”€â”€ Bind Filter Buttons & Global Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function initializeGarage() {
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
