/* ================================================================
   FLAPPY CAR BACKEND API CLIENT
   Communicates with the Express backend REST endpoints:
   - /api/scores (Leaderboard & high scores)
   - /api/garage (Wallet coins & vehicle unlocks)
   - /api/progress (Circuit & level completions)
================================================================ */

const getApiBase = () => {
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__.replace(/\/+$/, '') + '/api';
  }
  const customApi = typeof localStorage !== 'undefined' && localStorage.getItem('flappy_car_api_url');
  if (customApi) {
    return customApi.replace(/\/+$/, '') + '/api';
  }
  const origin = window.location.origin || '';
  if (!origin || origin.includes('550') || origin.startsWith('file:')) {
    return 'http://localhost:5000/api';
  }
  return '/api';
};

const API_BASE = getApiBase();

export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'online';
  } catch {
    return false;
  }
}

const LOCAL_LEADERBOARD_KEY = 'flappy_car_local_leaderboard_v1';

function readLocalScores() {
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalScore(entry) {
  try {
    const list = readLocalScores();
    list.push(entry);
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(list.slice(0, 15)));
  } catch {}
}

export async function fetchLeaderboard() {
  const localScores = readLocalScores();
  let remoteScores = [];
  try {
    const res = await fetch(`${API_BASE}/scores`);
    if (res.ok) {
      const data = await res.json();
      remoteScores = data.scores || [];
    }
  } catch (err) {
    console.warn('[API] Could not fetch leaderboard, using local records:', err.message);
  }

  // Merge remote + durable local scores cleanly so personal bests never disappear across cold starts
  const merged = [...remoteScores, ...localScores];
  const seen = new Set();
  const deduped = [];
  for (const s of merged) {
    const sig = `${s.playerName}_${s.score}_${s.distance}_${s.carId}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      deduped.push(s);
    }
  }
  deduped.sort((a, b) => (b.score || 0) - (a.score || 0));
  return deduped.slice(0, 10);
}

export async function submitScore({ playerName = "Player", score = 0, distance = 0, carId = "cyber" }) {
  const entry = {
    id: Date.now().toString(),
    playerName,
    score: Math.floor(Number(score) || 0),
    distance: Math.floor(Number(distance) || 0),
    carId,
    date: new Date().toISOString().split('T')[0]
  };
  saveLocalScore(entry);

  try {
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Score saved locally (server unreachable):', err.message);
    return { success: true, entry, localOnly: true };
  }
}

export async function fetchGarageData() {
  try {
    const res = await fetch(`${API_BASE}/garage`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.garage || null;
  } catch (err) {
    console.warn('[API] Could not fetch garage data:', err.message);
    return null;
  }
}

export async function syncGarageData(garageUpdates = {}) {
  try {
    const res = await fetch(`${API_BASE}/garage/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(garageUpdates)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Could not sync garage data:', err.message);
    return null;
  }
}

export async function recordLevelComplete(levelId, score = 0) {
  try {
    const res = await fetch(`${API_BASE}/progress/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelId, score })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Could not record level progress:', err.message);
    return null;
  }
}

export async function fetchProgressData() {
  try {
    const res = await fetch(`${API_BASE}/progress`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.progress || null;
  } catch (err) {
    console.warn('[API] Could not fetch progress data:', err.message);
    return null;
  }
}
