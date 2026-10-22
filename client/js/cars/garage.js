import { getAllCars } from "./cars.js";
import { getAllStages } from "../stages/stages.js";
import {
  getWallet,
  selectCar,
  selectStage
} from "../systems/economy.js";
import { gameState } from "../core/gameState.js";
import { createPlayer } from "../player/player.js";
import { createStage } from "../stages/stageRenderer.js";

let onSelectionChangeCallback = null;

function byId(id) {
  return document.getElementById(id);
}

export function setGarageSelectionCallback(callback) {
  onSelectionChangeCallback = callback;
}

export function renderGarage() {
  const wallet = getWallet();
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

    const topRow = document.createElement("div");
    topRow.className = "card-top-row";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = car.name;

    const swatch = document.createElement("div");
    swatch.className = "car-color-swatch";
    swatch.style.backgroundColor = car.bodyColor;
    swatch.style.borderColor = car.accentColor;

    const badge = document.createElement("span");
    badge.className = `badge-tag ${isSelected ? "equipped" : "owned"}`;
    badge.textContent = isSelected ? "SELECTED" : "READY";

    topRow.append(title, swatch, badge);

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
        if (gameState.scene) {
          createPlayer(car.id);
        }
        renderGarage();
        onSelectionChangeCallback?.("car", car.id);
      });
    }

    card.append(topRow, statsContainer, actionBtn);
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

    const banner = document.createElement("div");
    banner.className = "stage-preview-banner";
    banner.style.background = `linear-gradient(135deg, ${stage.skyColor} 0%, ${stage.groundColor} 100%)`;
    banner.textContent = `Scenery: ${stage.scenery.toUpperCase()}`;

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
        if (gameState.scene) {
          createStage(stage.id);
        }
        renderGarage();
        onSelectionChangeCallback?.("stage", stage.id);
      });
    }

    card.append(topRow, banner, actionBtn);
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
  });

  stagesTab?.addEventListener("click", () => {
    stagesTab.classList.add("active");
    carsTab?.classList.remove("active");
    garageStages?.classList.add("active");
    if (garageStages) garageStages.hidden = false;
    garageCars?.classList.remove("active");
    if (garageCars) garageCars.hidden = true;
  });

  renderGarage();
}
