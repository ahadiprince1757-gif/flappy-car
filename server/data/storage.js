import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* ================================================================
   DURABLE PERSISTENCE ADAPTER (Cloud KV / Upstash Redis + Local Fallback)
   - On Vercel: Automatically persists leaderboard, garage, and progress
     to Vercel KV / Upstash Redis REST API when env vars are set
     (KV_REST_API_URL + KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL + TOKEN).
   - Fallback: Safe writable path (/tmp on read-only serverless, local
     database.json during development) — zero EROFS crashes!
================================================================ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_FILE = IS_SERVERLESS
  ? path.join('/tmp', 'flappy_car_database.json')
  : path.join(__dirname, 'database.json');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KV_KEY = 'flappy_car_3d:db_v1';

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
    unlockedCars: ["cyber"],
    unlockedStages: ["city", "beach", "jungle", "desert"]
  },
  progress: {
    unlockedLevels: [1, 2, 3],
    completedLevels: [],
    levelHighScores: {}
  }
};

let _db = null;
let _kvHydrated = false;

async function kvGet() {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL.replace(/\/+$/, '')}/get/${encodeURIComponent(KV_KEY)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.result) return null;
    return typeof body.result === 'string' ? JSON.parse(body.result) : body.result;
  } catch {
    return null;
  }
}

async function kvSet(data) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL.replace(/\/+$/, '')}/set/${encodeURIComponent(KV_KEY)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  } catch (err) {
    console.warn('[Storage] KV sync failed:', err.message);
  }
}

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
  } catch {
    _db = JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  // Hydrate asynchronously from cloud KV if configured
  if (KV_URL && KV_TOKEN && !_kvHydrated) {
    _kvHydrated = true;
    kvGet().then((remote) => {
      if (remote && Array.isArray(remote.leaderboard)) {
        _db = remote;
      }
    }).catch(() => {});
  }

  return _db;
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8');
  } catch {
    // Safe ignore on read-only environments
  }
  if (KV_URL && KV_TOKEN) {
    kvSet(_db);
  }
}

export function getLeaderboard() {
  const db = loadDatabase();
  return [...db.leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
}

export function addScore({ playerName = "Driver", score = 0, distance = 0, carId = "cyber" }) {
  const db = loadDatabase();
  const entry = {
    id: Date.now().toString(),
    playerName: String(playerName).slice(0, 20),
    score: Math.max(0, Math.floor(Number(score) || 0)),
    distance: Math.max(0, Math.floor(Number(distance) || 0)),
    carId: String(carId || "cyber"),
    date: new Date().toISOString().split('T')[0]
  };
  db.leaderboard.push(entry);
  db.leaderboard.sort((a, b) => b.score - a.score);
  db.leaderboard = db.leaderboard.slice(0, 20);
  saveDatabase();
  return entry;
}

export function getGarage() {
  return loadDatabase().garage;
}

export function updateGarage(updates = {}) {
  const db = loadDatabase();
  if (typeof updates.coins === 'number') db.garage.coins = Math.max(0, updates.coins);
  if (updates.selectedCar) db.garage.selectedCar = updates.selectedCar;
  if (updates.selectedStage) db.garage.selectedStage = updates.selectedStage;
  if (Array.isArray(updates.unlockedCars)) db.garage.unlockedCars = updates.unlockedCars;
  if (Array.isArray(updates.unlockedStages)) db.garage.unlockedStages = updates.unlockedStages;
  saveDatabase();
  return db.garage;
}

export function getProgress() {
  return loadDatabase().progress;
}

export function updateProgress(updates = {}) {
  const db = loadDatabase();
  if (Array.isArray(updates.unlockedLevels)) db.progress.unlockedLevels = updates.unlockedLevels;
  if (Array.isArray(updates.completedLevels)) db.progress.completedLevels = updates.completedLevels;
  if (updates.levelHighScores && typeof updates.levelHighScores === 'object') {
    db.progress.levelHighScores = { ...db.progress.levelHighScores, ...updates.levelHighScores };
  }
  saveDatabase();
  return db.progress;
}
