const STORAGE_PREFIX = "flappyCar.";

const ALL_CARS = ["cyber", "inferno", "neon", "phantom"];
const ALL_STAGES = ["city", "beach", "jungle", "desert", "village"];

const DEFAULT_DATA = {
  coins: 0,
  selectedCar: "cyber",
  selectedStage: "city",
  ownedCars: [...ALL_CARS],
  ownedStages: [...ALL_STAGES],
  completedLevels: [],
  bestScore: 0
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

export function loadData() {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}save`);
    if (!saved) {
      return cloneDefaults();
    }

    const parsed = JSON.parse(saved);

    return {
      ...cloneDefaults(),
      ...parsed,
      ownedCars: [...ALL_CARS],
      ownedStages: [...ALL_STAGES],
      completedLevels: Array.isArray(parsed.completedLevels)
        ? parsed.completedLevels
        : []
    };
  } catch (error) {
    console.error("Could not load saved game data:", error);
    return cloneDefaults();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}save`,
      JSON.stringify(data)
    );
    return true;
  } catch (error) {
    console.error("Could not save game data:", error);
    return false;
  }
}

export function updateData(updates) {
  const current = loadData();
  const updated = { ...current, ...updates };
  saveData(updated);
  return updated;
}

export function clearSavedData() {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}save`);
  } catch (error) {
    console.error("Could not clear saved game data:", error);
  }
}
