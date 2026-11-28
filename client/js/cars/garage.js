import { getAllCars } from "./cars.js";
import {
  getWallet,
  selectCar,
  purchaseCar
} from "../systems/economy.js";
import { gameState } from "../core/gameState.js";

/* ================================================================
   LIGHTWEIGHT VEHICLE SELECTION GARAGE (PURE CARD UI — ZERO BLOAT)
   - Dead 3D turntable WebGL renderer removed for instant mobile fluency.
   - Direct tap-to-equip car cards; FBX vehicle spawns cleanly on race start.
================================================================ */

let onSelectionChangeCallback = null;
let activeCategoryFilter = "all";

function byId(id) {
  return document.getElementById(id);
}

export function setGarageSelectionCallback(callback) {
  onSelectionChangeCallback = callback;
}

export function renderCarSelectionScreen(filterCat = activeCategoryFilter) {
  activeCategoryFilter = filterCat;
  const container = byId("carCardsGrid");
  if (!container) return;

  const wallet = getWallet();
  const allCars = getAllCars();
  const filteredCars = filterCat === "all"
    ? allCars
    : allCars.filter((c) => {
        const cat = (c.category || "").toLowerCase();
        if (filterCat === "sport") return cat.includes("sport");
        if (filterCat === "muscle") return cat.includes("muscle");
        if (filterCat === "tuner") return cat.includes("tuner") || cat.includes("sedan");
        if (filterCat === "utility") return cat.includes("utility") || cat.includes("suv") || cat.includes("police") || cat.includes("taxi");
        return true;
      });

  const coinDisplay = byId("coinDisplay");
  if (coinDisplay) coinDisplay.textContent = wallet.coins;

  container.innerHTML = "";

  for (const car of filteredCars) {
    const ownedList = Array.isArray(wallet.ownedCars) ? wallet.ownedCars : ["cyber"];
    const isOwned = ownedList.includes(car.id);
    const isSelected = wallet.selectedCar === car.id;

    const card = document.createElement("div");
    card.className = `car-select-card ${isSelected ? "selected" : ""} ${!isOwned ? "locked-card" : ""}`;
    card.dataset.carId = car.id;

    // Top Badge Row
    const topRow = document.createElement("div");
    topRow.className = "car-card-top";

    const catBadge = document.createElement("span");
    catBadge.className = "car-card-cat";
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
    img.src = car.image || `./assets/images/cars/${car.id}.webp`;
    img.alt = car.name;
    img.loading = "lazy";
    imgBox.append(img);

    // Car Info Row
    const infoRow = document.createElement("div");
    infoRow.className = "car-card-info";

    const title = document.createElement("h4");
    title.className = "car-card-name";
    title.textContent = car.name;

    infoRow.append(title);
    card.append(topRow, imgBox, infoRow);

    // Selection Click Event
    card.addEventListener("click", () => {
      if (!isOwned) {
        const currentWallet = getWallet();
        if (currentWallet.coins < car.price) {
          alert(`Insufficient Coins!\nYou need ${car.price} coins to unlock ${car.name}.\nYou currently have ${currentWallet.coins} coins.\n\nPlay more to collect coins!`);
          return;
        }

        const confirmBuy = confirm(`Unlock ${car.name} for ${car.price} coins?`);
        if (!confirmBuy) return;

        const res = purchaseCar(car.id);
        if (res.success) {
          selectCar(car.id);
          gameState.selectedCar = car.id;
          const coinEl = byId("coinDisplay");
          if (coinEl) coinEl.textContent = res.coins;
          renderCarSelectionScreen();
          onSelectionChangeCallback?.("car", car.id);
        }
        return;
      }

      selectCar(car.id);
      gameState.selectedCar = car.id;

      container.querySelectorAll(".car-select-card").forEach((c) => {
        const isThis = c.dataset.carId === car.id;
        c.classList.toggle("selected", isThis);
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
}

export function renderTrackSelectionScreen() {}

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
}
