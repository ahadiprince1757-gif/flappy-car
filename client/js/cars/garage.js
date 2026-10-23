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

// â”€â”€ Update Inspector Details & Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateInspectorPanel(car) {
  const nameEl = byId("inspectorCarName");
  if (nameEl) nameEl.textContent = car.name;

  const tagEl = byId("inspectorCarTagline");
  if (tagEl) tagEl.textContent = car.tagline || `${car.category} Â· High Performance`;

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

// â”€â”€ Render Car Selection Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    statusBadge.textContent = isSelected ? "EQUIPPED âœ“" : "SELECT";

    topRow.append(catBadge, statusBadge);

    // Image Box (Fully displays car with zero clipping)
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
      <span>âš¡ ${car.hp || 600} HP</span>
      <span>ðŸ ${car.topSpeedMph || 190} MPH</span>
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

      container.querySelectorAll(".car-select-card").forEach((c) => {
        const isThis = c.dataset.carId === car.id;
        c.classList.toggle("selected", isThis);
        const st = c.querySelector(".car-card-status");
        if (st) {
          st.textContent = isThis ? "EQUIPPED âœ“" : "SELECT";
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

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  _stageSnapshotCache.set(stageId, dataUrl);
  return dataUrl;
}

// â”€â”€ Shared drawing helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawRoadPerspective(ctx, W, H, roadColor, lineColor) {
  // Vanishing-point road from bottom to horizon
  const vpX = W / 2, vpY = H * 0.52;
  const roadW = W * 0.72;
  ctx.beginPath();
  ctx.moveTo(W / 2 - roadW / 2, H);
  ctx.lineTo(W / 2 + roadW / 2, H);
  ctx.lineTo(vpX + 6,  vpY);
  ctx.lineTo(vpX - 6,  vpY);
  ctx.closePath();
  ctx.fillStyle = roadColor;
  ctx.fill();

  // Dashed centre line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(vpX, vpY + 2);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Road edge lines
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(vpX - 5, vpY + 2);
  ctx.lineTo(W / 2 - roadW / 2 + 14, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(vpX + 5, vpY + 2);
  ctx.lineTo(W / 2 + roadW / 2 - 14, H);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawSkyGradient(ctx, W, H, top, mid, bot, midStop = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(midStop, mid);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawGround(ctx, W, H, groundColor, horizonY) {
  const g = ctx.createLinearGradient(0, horizonY, 0, H);
  g.addColorStop(0, groundColor);
  g.addColorStop(1, shadeColor(groundColor, -40));
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY, W, H - horizonY);
}

function shadeColor(hex, amt) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// â”€â”€ CITY: Neon Metropolis at Night â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function paintCityStage(ctx, W, H) {
  drawSkyGradient(ctx, W, H, "#000814", "#001530", "#0a1a2e", 0.6);

  const hY = H * 0.52;

  // Stars
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 80; i++) {
    ctx.fillRect(Math.random()*W, Math.random()*hY*0.8, 1, 1);
  }

  // Distant city glow
  const glowG = ctx.createRadialGradient(W/2, hY, 5, W/2, hY, W*0.6);
  glowG.addColorStop(0, "rgba(0,120,255,0.22)");
  glowG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowG;
  ctx.fillRect(0, 0, W, hY + 10);

  // Back-row skyscrapers (dark silhouettes with glowing windows)
  const backBuildings = [
    {x:0.02,w:0.07,h:0.36}, {x:0.10,w:0.05,h:0.28}, {x:0.15,w:0.08,h:0.44},
    {x:0.24,w:0.06,h:0.32}, {x:0.31,w:0.04,h:0.25}, {x:0.36,w:0.07,h:0.38},
    {x:0.44,w:0.05,h:0.20}, {x:0.50,w:0.06,h:0.30}, {x:0.57,w:0.08,h:0.42},
    {x:0.66,w:0.05,h:0.26}, {x:0.72,w:0.07,h:0.36}, {x:0.80,w:0.06,h:0.31},
    {x:0.87,w:0.08,h:0.44}, {x:0.96,w:0.05,h:0.28},
  ];
  backBuildings.forEach(b => {
    const bx = b.x * W, bw = b.w * W;
    const bh = b.h * H;
    const by = hY - bh;
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(bx, by, bw, bh);
    // Glowing windows
    const cols = Math.max(2, Math.floor(bw / 8));
    const rows = Math.max(2, Math.floor(bh / 10));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.38) {
          const winColors = ["#00d4ff","#4488ff","#ffdd88","#ff8800","#ffffff"];
          ctx.fillStyle = winColors[Math.floor(Math.random()*winColors.length)];
          ctx.globalAlpha = 0.6 + Math.random()*0.4;
          ctx.fillRect(bx + 2 + c*(bw/cols), by + 3 + r*(bh/rows), bw/cols - 2, bh/rows - 2);
          ctx.globalAlpha = 1;
        }
      }
    }
  });

  // Front-row mid-rise buildings
  const frontBuildings = [
    {x:0.0,w:0.09,h:0.22,col:"#06102a"},{x:0.10,w:0.07,h:0.18,col:"#081428"},
    {x:0.18,w:0.10,h:0.26,col:"#040e22"},{x:0.29,w:0.06,h:0.16,col:"#071228"},
    {x:0.60,w:0.07,h:0.16,col:"#071228"},{x:0.68,w:0.10,h:0.25,col:"#040e22"},
    {x:0.79,w:0.07,h:0.19,col:"#081428"},{x:0.87,w:0.09,h:0.22,col:"#06102a"},
    {x:0.97,w:0.06,h:0.17,col:"#071228"},
  ];
  frontBuildings.forEach(b => {
    const bx = b.x * W, bw = b.w * W, bh = b.h * H, by = hY - bh;
    ctx.fillStyle = b.col;
    ctx.fillRect(bx, by, bw, bh);
    const cols2 = Math.max(2, Math.floor(bw / 10));
    const rows2 = Math.max(1, Math.floor(bh / 12));
    for (let r = 0; r < rows2; r++) {
      for (let c = 0; c < cols2; c++) {
        if (Math.random() > 0.5) {
          ctx.fillStyle = Math.random() > 0.6 ? "#00efff" : "#ffe566";
          ctx.globalAlpha = 0.5 + Math.random() * 0.4;
          ctx.fillRect(bx + 3 + c*(bw/cols2), by + 3 + r*(bh/rows2), bw/cols2 - 3, bh/rows2 - 3);
          ctx.globalAlpha = 1;
        }
      }
    }
  });

  // Ground
  drawGround(ctx, W, H, "#0d1a25", hY);
  drawRoadPerspective(ctx, W, H, "#0a1520", "#00efff");

  // Neon edge strips
  const vpX = W/2, vpY = hY;
  ctx.shadowColor = "#00efff";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#00efff";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(vpX-4, vpY+1); ctx.lineTo(W*0.12, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vpX+4, vpY+1); ctx.lineTo(W*0.88, H); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Street lamps
  [[0.28,hY,0.5],[0.72,hY,0.5],[0.18,hY+H*0.05,0.75],[0.82,hY+H*0.05,0.75]].forEach(([lx,ly,s]) => {
    const px = lx*W, ph = H*0.15*s;
    ctx.strokeStyle="#334155"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(px, ly+ph); ctx.lineTo(px, ly); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, ly); ctx.lineTo(px+8*s, ly-5*s); ctx.stroke();
    ctx.fillStyle="rgba(255,240,140,0.9)";
    ctx.beginPath(); ctx.arc(px+8*s, ly-5*s, 3*s, 0, Math.PI*2); ctx.fill();
    ctx.shadowColor="#ffe566"; ctx.shadowBlur=8;
    ctx.fillStyle="rgba(255,230,100,0.3)";
    ctx.beginPath(); ctx.arc(px+8*s, ly-5*s, 10*s, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  });

  // Atmospheric fog overlay
  const fogG = ctx.createLinearGradient(0, hY-20, 0, H);
  fogG.addColorStop(0, "rgba(0,30,60,0.55)");
  fogG.addColorStop(0.4, "rgba(0,20,40,0.10)");
  fogG.addColorStop(1, "rgba(0,10,20,0)");
  ctx.fillStyle = fogG;
  ctx.fillRect(0, hY-20, W, H-(hY-20));
}

// â”€â”€ SAVANNAH: African Golden Sunset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function paintSavannahStage(ctx, W, H) {
  drawSkyGradient(ctx, W, H, "#7c2a0a", "#f59e0b", "#fde68a", 0.5);

  const hY = H * 0.52;

  // Sun disc
  ctx.beginPath();
  ctx.arc(W * 0.75, hY - H*0.18, 38, 0, Math.PI * 2);
  const sunG = ctx.createRadialGradient(W*0.75, hY-H*0.18, 0, W*0.75, hY-H*0.18, 38);
  sunG.addColorStop(0, "#fff7d6");
  sunG.addColorStop(0.4, "#ffb703");
  sunG.addColorStop(1, "rgba(251,146,60,0.3)");
  ctx.fillStyle = sunG;
  ctx.fill();
  // Sun glow halo
  const haloG = ctx.createRadialGradient(W*0.75, hY-H*0.18, 20, W*0.75, hY-H*0.18, 90);
  haloG.addColorStop(0, "rgba(251,191,36,0.35)");
  haloG.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = haloG;
  ctx.fillRect(W*0.75-90, hY-H*0.18-90, 180, 180);

  // Horizon heat haze shimmer
  const hazeG = ctx.createLinearGradient(0, hY-18, 0, hY+18);
  hazeG.addColorStop(0, "rgba(253,230,138,0)");
  hazeG.addColorStop(0.5, "rgba(253,230,138,0.30)");
  hazeG.addColorStop(1, "rgba(253,230,138,0)");
  ctx.fillStyle = hazeG;
  ctx.fillRect(0, hY-18, W, 36);

  // Ground
  drawGround(ctx, W, H, "#a16207", hY);
  drawRoadPerspective(ctx, W, H, "#44403c", "#fefce8");

  // Acacia tree silhouettes
  const acacia = [
    {x:0.08,y:hY-5,s:0.9},{x:0.18,y:hY,s:0.75},{x:0.74,y:hY-8,s:1.05},{x:0.86,y:hY-2,s:0.8},{x:0.92,y:hY+4,s:0.65},
  ];
  acacia.forEach(a => {
    const ax = a.x*W, ay = a.y, as = a.s;
    // Trunk
    ctx.strokeStyle = "#3d2010"; ctx.lineWidth = 3*as;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(ax + 2*as, ay - 36*as);
    ctx.stroke();
    // Branches spread
    [[-18,-12],[-6,-16],[8,-10],[18,-8]].forEach(([bx,by]) => {
      ctx.beginPath();
      ctx.moveTo(ax + 2*as, ay - 33*as); ctx.lineTo(ax + bx*as, ay + by*10*as - 26*as);
      ctx.stroke();
    });
    // Flat canopy
    const cpG = ctx.createEllipse ? null : null;
    ctx.fillStyle = "rgba(68,30,10,0.85)";
    ctx.beginPath();
    ctx.ellipse(ax + 2*as, ay - 44*as, 22*as, 7*as, 0, 0, Math.PI*2);
    ctx.fill();
  });

  // Dust overlay at road level
  const dustG = ctx.createLinearGradient(0, hY+20, 0, H);
  dustG.addColorStop(0, "rgba(161,98,7,0.35)");
  dustG.addColorStop(1, "rgba(120,53,15,0.1)");
  ctx.fillStyle = dustG;
  ctx.fillRect(0, hY+20, W, H-(hY+20));
}

// â”€â”€ DESERT: Red Rock Canyon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function paintDesertStage(ctx, W, H) {
  drawSkyGradient(ctx, W, H, "#7c1d0a", "#f97316", "#fde68a", 0.45);

  const hY = H * 0.50;

  // Heat shimmer horizon
  const shimG = ctx.createLinearGradient(0, hY-10, 0, hY+14);
  shimG.addColorStop(0, "rgba(253,186,116,0)");
  shimG.addColorStop(0.5, "rgba(253,186,116,0.25)");
  shimG.addColorStop(1, "rgba(253,186,116,0)");
  ctx.fillStyle = shimG;
  ctx.fillRect(0, hY-10, W, 24);

  // Far canyon mesa silhouettes
  const mesas = [
    {x:0.02,w:0.14,h:0.28},{x:0.16,w:0.10,h:0.20},{x:0.27,w:0.16,h:0.35},
    {x:0.58,w:0.15,h:0.32},{x:0.74,w:0.11,h:0.22},{x:0.86,w:0.14,h:0.28},
  ];
  mesas.forEach(m => {
    const mx = m.x*W, mw = m.w*W, mh = m.h*H, my = hY - mh;
    const mG = ctx.createLinearGradient(mx, my, mx+mw, my);
    mG.addColorStop(0, "#9a3412");
    mG.addColorStop(0.5, "#c2410c");
    mG.addColorStop(1, "#7c2d12");
    ctx.fillStyle = mG;
    // Mesa with flat top
    ctx.beginPath();
    ctx.moveTo(mx, hY);
    ctx.lineTo(mx + mw*0.12, my + mh*0.2);
    ctx.lineTo(mx + mw*0.18, my);
    ctx.lineTo(mx + mw*0.82, my);
    ctx.lineTo(mx + mw*0.88, my + mh*0.2);
    ctx.lineTo(mx + mw, hY);
    ctx.closePath();
    ctx.fill();
    // Mesa shadow face
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(mx + mw*0.72, my, mw*0.28, mh);
  });

  // Ground
  drawGround(ctx, W, H, "#d97706", hY);
  drawRoadPerspective(ctx, W, H, "#292524", "#fef3c7");

  // Sand/dirt edge verge
  const sandG = ctx.createLinearGradient(0, hY, 0, H);
  sandG.addColorStop(0, "rgba(217,119,6,0.7)");
  sandG.addColorStop(1, "rgba(180,83,9,0.3)");
  ctx.fillStyle = sandG;
  ctx.fillRect(0, hY, W*0.23, H-hY);
  ctx.fillRect(W*0.77, hY, W*0.23, H-hY);

  // Desert rocks
  [[0.14,hY+14,22,14],[0.18,hY+20,14,9],[0.78,hY+16,20,12],[0.84,hY+10,12,8]].forEach(([rx,ry,rw,rh]) => {
    ctx.fillStyle = "#9a3412";
    ctx.beginPath();
    ctx.ellipse(rx*W, ry, rw, rh, 0, 0, Math.PI*2);
    ctx.fill();
  });
}

// â”€â”€ JUNGLE: Tropical Rainforest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function paintJungleStage(ctx, W, H) {
  drawSkyGradient(ctx, W, H, "#064e3b", "#10b981", "#6ee7b7", 0.45);

  const hY = H * 0.50;

  // Misty jungle atmosphere
  const mistG = ctx.createRadialGradient(W/2, hY, 10, W/2, hY*0.5, W*0.7);
  mistG.addColorStop(0, "rgba(187,247,208,0.3)");
  mistG.addColorStop(1, "rgba(187,247,208,0)");
  ctx.fillStyle = mistG;
  ctx.fillRect(0, 0, W, H);

  // Far canopy silhouette layer (dark deep green)
  ctx.fillStyle = "#022c22";
  ctx.beginPath();
  ctx.moveTo(0, hY);
  for (let x = 0; x <= W; x += 18) {
    const y = hY - 25 - Math.sin(x*0.04)*28 - Math.cos(x*0.07)*18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, hY);
  ctx.closePath();
  ctx.fill();

  // Mid canopy (lighter green)
  ctx.fillStyle = "#065f46";
  ctx.beginPath();
  ctx.moveTo(0, hY+4);
  for (let x = 0; x <= W; x += 14) {
    const y = hY - 10 - Math.cos(x*0.055)*22 - Math.sin(x*0.09)*12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, hY+4);
  ctx.closePath();
  ctx.fill();

  // Ground
  drawGround(ctx, W, H, "#15803d", hY);
  drawRoadPerspective(ctx, W, H, "#1c1917", "#fef08a");

  // Large jungle trees on sides
  const trees = [
    {x:0.05,h:0.45,w:0.08},{x:0.14,h:0.35,w:0.07},{x:0.22,h:0.42,w:0.06},
    {x:0.72,h:0.40,w:0.07},{x:0.80,h:0.38,w:0.08},{x:0.89,h:0.44,w:0.06},
  ];
  trees.forEach(t => {
    const tx = t.x*W, th = t.h*H, tw = t.w*W;
    const ty = hY - th;
    // Trunk
    const trkG = ctx.createLinearGradient(tx+tw*0.4, ty, tx+tw*0.6, ty);
    trkG.addColorStop(0, "#1e3a1e"); trkG.addColorStop(1, "#0d2010");
    ctx.fillStyle = trkG;
    ctx.fillRect(tx + tw*0.4, ty + th*0.5, tw*0.2, th*0.5);
    // Foliage
    ctx.fillStyle = "#047857";
    ctx.beginPath();
    ctx.ellipse(tx + tw*0.5, ty + th*0.35, tw*0.55, th*0.38, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#059669";
    ctx.beginPath();
    ctx.ellipse(tx + tw*0.5, ty + th*0.28, tw*0.4, th*0.28, 0, 0, Math.PI*2);
    ctx.fill();
  });

  // Drizzle rain effect
  ctx.strokeStyle = "rgba(187,247,208,0.22)";
  ctx.lineWidth = 0.8;
  for (let r = 0; r < 60; r++) {
    const rx = Math.random()*W, ry = Math.random()*H;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx+2, ry+12); ctx.stroke();
  }
}

// â”€â”€ BEACH: Sunset Coastal Highway â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function paintBeachStage(ctx, W, H) {
  drawSkyGradient(ctx, W, H, "#7c1d6f", "#f97316", "#fde68a", 0.48);

  const hY = H * 0.50;

  // Sun/sunset disc on horizon
  const sunG2 = ctx.createRadialGradient(W*0.15, hY+2, 0, W*0.15, hY+2, 50);
  sunG2.addColorStop(0, "rgba(255,255,200,0.95)");
  sunG2.addColorStop(0.4, "rgba(255,150,50,0.85)");
  sunG2.addColorStop(1, "rgba(255,100,0,0)");
  ctx.fillStyle = sunG2;
  ctx.beginPath(); ctx.arc(W*0.15, hY+2, 50, 0, Math.PI*2); ctx.fill();

  // Ocean/sea on left side
  const oceanG = ctx.createLinearGradient(0, hY, 0, H);
  oceanG.addColorStop(0, "#0284c7");
  oceanG.addColorStop(0.5, "#0369a1");
  oceanG.addColorStop(1, "#075985");
  ctx.fillStyle = oceanG;
  ctx.fillRect(0, hY, W*0.32, H-hY);

  // Shimmering ocean reflections
  ctx.strokeStyle = "rgba(255,220,100,0.35)";
  ctx.lineWidth = 1;
  for (let wy = hY+8; wy < H; wy += 7) {
    ctx.beginPath();
    ctx.moveTo(0, wy);
    for (let wx = 0; wx < W*0.32; wx += 16) {
      ctx.lineTo(wx, wy + Math.sin(wx*0.15)*2);
    }
    ctx.stroke();
  }

  // Sandy beach
  const sandG2 = ctx.createLinearGradient(0, hY, 0, H);
  sandG2.addColorStop(0, "#fde047");
  sandG2.addColorStop(1, "#d97706");
  ctx.fillStyle = sandG2;
  ctx.fillRect(W*0.32, hY, W*0.68, H-hY);

  drawRoadPerspective(ctx, W, H, "#334155", "#ffffff");

  // Palm trees on right side
  const palms = [
    {x:0.64,y:hY-5,s:1.1},{x:0.75,y:hY+2,s:0.85},{x:0.86,y:hY-4,s:0.95},{x:0.95,y:hY+6,s:0.7},
  ];
  palms.forEach(p => {
    const px = p.x*W, py = p.y, ps = p.s;
    // Curved trunk
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 5*ps;
    ctx.beginPath();
    ctx.moveTo(px, py + 5);
    ctx.bezierCurveTo(px-4*ps, py-20*ps, px+8*ps, py-40*ps, px+4*ps, py-55*ps*ps*0.9);
    ctx.stroke();
    // Fronds
    const frondColors = ["#15803d","#16a34a","#166534"];
    for (let f = 0; f < 6; f++) {
      const angle = (f/6)*Math.PI*2;
      ctx.strokeStyle = frondColors[f % 3]; ctx.lineWidth = 2*ps;
      ctx.beginPath();
      const topX = px + 4*ps, topY = py - 55*ps*ps*0.9;
      ctx.moveTo(topX, topY);
      ctx.lineTo(topX + Math.cos(angle)*22*ps, topY + Math.sin(angle)*10*ps);
      ctx.stroke();
    }
  });

  // Ocean mist overlay
  const mistO = ctx.createLinearGradient(0, hY-10, W*0.38, hY-10);
  mistO.addColorStop(0, "rgba(186,230,253,0.3)");
  mistO.addColorStop(1, "rgba(186,230,253,0)");
  ctx.fillStyle = mistO;
  ctx.fillRect(0, hY-30, W*0.38, 60);
}

// â”€â”€ VILLAGE: Alpine Mountain Resort â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function paintVillageStage(ctx, W, H) {
  drawSkyGradient(ctx, W, H, "#1e40af", "#93c5fd", "#bfdbfe", 0.55);

  const hY = H * 0.52;

  // Distant snow-capped mountain peaks
  const peaks = [
    {x:0.10,w:0.25,h:0.38},{x:0.30,w:0.20,h:0.30},{x:0.46,w:0.18,h:0.35},
    {x:0.62,w:0.22,h:0.28},{x:0.78,w:0.26,h:0.40},
  ];
  peaks.forEach(p => {
    const px = p.x*W, pw = p.w*W, ph = p.h*H;
    const py = hY - ph;
    // Mountain body
    const mtnG = ctx.createLinearGradient(px+pw/2, py, px+pw, py+ph);
    mtnG.addColorStop(0, "#cbd5e1"); mtnG.addColorStop(0.4, "#64748b"); mtnG.addColorStop(1, "#334155");
    ctx.fillStyle = mtnG;
    ctx.beginPath();
    ctx.moveTo(px, hY);
    ctx.lineTo(px + pw*0.5, py);
    ctx.lineTo(px + pw, hY);
    ctx.closePath();
    ctx.fill();
    // Snow cap
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(px + pw*0.5, py);
    ctx.lineTo(px + pw*0.35, py + ph*0.22);
    ctx.lineTo(px + pw*0.65, py + ph*0.22);
    ctx.closePath();
    ctx.fill();
  });

  // Ground
  drawGround(ctx, W, H, "#16a34a", hY);
  drawRoadPerspective(ctx, W, H, "#334155", "#f8fafc");

  // Dense pine trees on both sides
  const pines = [
    {x:0.03,s:1.1},{x:0.09,s:0.9},{x:0.14,s:1.2},{x:0.20,s:0.85},{x:0.26,s:1.0},
    {x:0.68,s:1.0},{x:0.74,s:1.2},{x:0.80,s:0.9},{x:0.86,s:1.1},{x:0.92,s:0.85},{x:0.97,s:1.0},
  ];
  pines.forEach(p => {
    const px = p.x*W, ps = p.s;
    drawPineTree(ctx, px, hY + 5, ps);
  });

  // Alpine chalets
  [[0.06, hY+2, 0.55], [0.88, hY+2, 0.55]].forEach(([cx, cy, cs]) => {
    const cw = 34*cs, ch = 20*cs;
    ctx.fillStyle = "#92400e";
    ctx.fillRect(cx*W - cw/2, cy, cw, ch);
    // Gable roof
    ctx.fillStyle = "#7c3010";
    ctx.beginPath();
    ctx.moveTo(cx*W - cw/2 - 4, cy);
    ctx.lineTo(cx*W, cy - ch*0.7);
    ctx.lineTo(cx*W + cw/2 + 4, cy);
    ctx.closePath();
    ctx.fill();
    // Snow on roof
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(cx*W - cw/2, cy);
    ctx.lineTo(cx*W, cy - ch*0.7);
    ctx.lineTo(cx*W + cw/2, cy);
    ctx.closePath();
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Windows
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(cx*W - 8*cs, cy + 4*cs, 7*cs, 7*cs);
    ctx.fillRect(cx*W + 2*cs, cy + 4*cs, 7*cs, 7*cs);
  });

  // Crisp mountain air mist
  const airG = ctx.createLinearGradient(0, hY-20, 0, hY+30);
  airG.addColorStop(0, "rgba(191,219,254,0.25)");
  airG.addColorStop(1, "rgba(191,219,254,0)");
  ctx.fillStyle = airG;
  ctx.fillRect(0, hY-20, W, 50);
}

function drawPineTree(ctx, x, baseY, scale) {
  const s = scale;
  // Trunk
  ctx.fillStyle = "#5a3418";
  ctx.fillRect(x - 3*s, baseY - 18*s, 6*s, 18*s);
  // Three-tiered cones
  const foliageColor = ["#064e3b","#065f46","#047857"];
  [[0, 0, 14*s, 18*s],[0, -12*s, 11*s, 15*s],[0, -22*s, 8*s, 13*s]].forEach(([ox, oy, r, h], i) => {
    const tG = ctx.createLinearGradient(x+ox-r, baseY+oy-h, x+ox+r, baseY+oy-h);
    tG.addColorStop(0, foliageColor[i]);
    tG.addColorStop(0.5, "#10b981");
    tG.addColorStop(1, foliageColor[i]);
    ctx.fillStyle = tG;
    ctx.beginPath();
    ctx.moveTo(x+ox-r, baseY+oy);
    ctx.lineTo(x+ox, baseY+oy-h);
    ctx.lineTo(x+ox+r, baseY+oy);
    ctx.closePath();
    ctx.fill();
  });
}


// â”€â”€ Render Track / Environment Selection Grid â”€â”€â”€â”€â”€â”€â”€â”€
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
    const isSelected = selectedStageId === stage.id;

    const card = document.createElement("article");
    card.className = `track-select-card ${isSelected ? "selected" : ""}`;
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
    selectStatus.className = `track-select-status-tag ${isSelected ? "active" : ""}`;
    selectStatus.textContent = isSelected ? "SELECTED âœ“" : "SELECT";

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
      selectStage(stage.id);
      gameState.selectedStage = stage.id;

      if (gameState.scene) {
        createStage(stage.id);
      }

      container.querySelectorAll(".track-select-card").forEach((c) => {
        const isThis = c.dataset.stageId === stage.id;
        c.classList.toggle("selected", isThis);
        const tag = c.querySelector(".track-select-status-tag");
        if (tag) {
          tag.textContent = isThis ? "SELECTED âœ“" : "SELECT";
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
