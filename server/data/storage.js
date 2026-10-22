import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'database.json');

const INITIAL_DATA = {
  leaderboard: [
    { id: "1", playerName: "NeonRacer", score: 4850, distance: 3200, carId: "cyber", date: "2026-10-20" },
    { id: "2", playerName: "TurboPhantom", score: 3920, distance: 2600, carId: "phantom", date: "2026-10-21" },
    { id: "3", playerName: "ApexDriver", score: 2840, distance: 1950, carId: "inferno", date: "2026-10-21" },
    { id: "4", playerName: "CityCruiser", score: 1980, distance: 1400, carId: "cruiser", date: "2026-10-22" },
    { id: "5", playerName: "HighwayPatrol", score: 1540, distance: 1100, carId: "cop", date: "2026-10-22" }
  ],
  garage: {
    coins: 500,
    selectedCar: "cyber",
    selectedStage: "city",
    unlockedCars: ["cyber", "inferno", "neon", "phantom", "taxi", "cop", "cruiser"],
    unlockedStages: ["city", "beach", "jungle", "desert"]
  },
  progress: {
    unlockedLevels: [1, 2, 3],
    completedLevels: [],
    levelHighScores: {}
  }
};

let _db = null;

function loadDatabase() {
  if (_db) return _db;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      _db = JSON.parse(raw);
    } else {
      _db = JSON.parse(JSON.stringify(INITIAL_DATA));
      saveDatabase();
    }
  } catch (err) {
    console.error('[Storage] Error reading database.json, using defaults:', err);
    _db = JSON.parse(JSON.stringify(INITIAL_DATA));
  }
  return _db;
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage] Error writing database.json:', err);
  }
}

export function getLeaderboard() {
  const db = loadDatabase();
  return db.leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
}

export function addScore({ playerName = "Anonymous", score = 0, distance = 0, carId = "cyber" }) {
  const db = loadDatabase();
  const entry = {
    id: Date.now().toString(),
    playerName: String(playerName).trim().slice(0, 16) || "Player",
    score: Number(score) || 0,
    distance: Number(distance) || 0,
    carId,
    date: new Date().toISOString().split('T')[0]
  };

  db.leaderboard.push(entry);
  db.leaderboard.sort((a, b) => b.score - a.score);
  db.leaderboard = db.leaderboard.slice(0, 20); // Keep top 20
  saveDatabase();

  return entry;
}

export function getGarage() {
  const db = loadDatabase();
  return db.garage;
}

export function updateGarage(updates = {}) {
  const db = loadDatabase();
  if (updates.coins !== undefined) {
    db.garage.coins = Math.max(0, Number(updates.coins) || 0);
  }
  if (updates.selectedCar) {
    db.garage.selectedCar = String(updates.selectedCar);
  }
  if (updates.selectedStage) {
    db.garage.selectedStage = String(updates.selectedStage);
  }
  if (Array.isArray(updates.unlockedCars)) {
    db.garage.unlockedCars = [...new Set(updates.unlockedCars)];
  }
  if (Array.isArray(updates.unlockedStages)) {
    db.garage.unlockedStages = [...new Set(updates.unlockedStages)];
  }
  saveDatabase();
  return db.garage;
}

export function getProgress() {
  const db = loadDatabase();
  return db.progress;
}

export function updateProgress(levelId, score = 0) {
  const db = loadDatabase();
  const id = Number(levelId);

  if (!db.progress.completedLevels.includes(id)) {
    db.progress.completedLevels.push(id);
  }

  const nextLevel = id + 1;
  if (!db.progress.unlockedLevels.includes(nextLevel)) {
    db.progress.unlockedLevels.push(nextLevel);
  }

  const prevBest = db.progress.levelHighScores[id] || 0;
  if (score > prevBest) {
    db.progress.levelHighScores[id] = score;
  }

  saveDatabase();
  return db.progress;
}
