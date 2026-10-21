import { gameState } from "../core/gameState.js";
import { loadData, saveData } from "../core/storage.js";
import { getCarConfig } from "../cars/cars.js";
import { getStageConfig } from "../stages/stages.js";

function getSavedData() {
  const data = loadData();

  data.coins = Math.max(0, Number(data.coins) || 0);
  data.ownedCars = Array.isArray(data.ownedCars) && data.ownedCars.length > 0
    ? data.ownedCars
    : ["cyber"];
  data.ownedStages = Array.isArray(data.ownedStages) && data.ownedStages.length > 0
    ? data.ownedStages
    : ["city"];

  if (!data.ownedCars.includes("cyber")) {
    data.ownedCars.push("cyber");
  }

  if (!data.ownedStages.includes("city")) {
    data.ownedStages.push("city");
  }

  return data;
}

function persist(data) {
  saveData(data);
  gameState.coins = data.coins;
}

function purchaseItem({
  id,
  getConfig,
  ownedKey
}) {
  const config = getConfig(id);
  if (!config) {
    return { success: false, reason: "not-found" };
  }

  const data = getSavedData();

  if (data[ownedKey].includes(id)) {
    return { success: false, reason: "already-owned" };
  }

  const price = Math.max(0, Number(config.price) || 0);

  if (data.coins < price) {
    return {
      success: false,
      reason: "insufficient-coins",
      required: price,
      available: data.coins
    };
  }

  data.coins -= price;
  data[ownedKey].push(id);

  persist(data);

  return {
    success: true,
    reason: "purchased",
    itemId: id,
    price,
    coins: data.coins
  };
}

export function purchaseCar(carId) {
  return purchaseItem({
    id: carId,
    getConfig: getCarConfig,
    ownedKey: "ownedCars"
  });
}

export function purchaseStage(stageId) {
  return purchaseItem({
    id: stageId,
    getConfig: getStageConfig,
    ownedKey: "ownedStages"
  });
}

export function selectCar(carId) {
  const config = getCarConfig(carId);
  if (!config) {
    return { success: false, reason: "not-found" };
  }

  const data = getSavedData();

  if (!data.ownedCars.includes(carId)) {
    return { success: false, reason: "not-owned" };
  }

  data.selectedCar = carId;
  persist(data);

  gameState.selectedCar = carId;
  gameState.baseSpeed = config.speed;
  gameState.speed = config.speed;

  return { success: true, carId };
}

export function selectStage(stageId) {
  const config = getStageConfig(stageId);
  if (!config) {
    return { success: false, reason: "not-found" };
  }

  const data = getSavedData();

  if (!data.ownedStages.includes(stageId)) {
    return { success: false, reason: "not-owned" };
  }

  data.selectedStage = stageId;
  persist(data);

  gameState.selectedStage = stageId;

  return { success: true, stageId };
}

export function getWallet() {
  const data = getSavedData();
  gameState.coins = data.coins;

  return {
    coins: data.coins,
    ownedCars: [...data.ownedCars],
    ownedStages: [...data.ownedStages],
    selectedCar: data.selectedCar ?? "cyber",
    selectedStage: data.selectedStage ?? "city"
  };
}

export function awardCoins(amount) {
  const value = Math.floor(Number(amount));

  if (!Number.isFinite(value) || value <= 0) {
    return { success: false, reason: "invalid-amount" };
  }

  const data = getSavedData();
  data.coins += value;
  persist(data);

  return {
    success: true,
    awarded: value,
    coins: data.coins
  };
}
