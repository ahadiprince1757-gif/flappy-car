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

export async function fetchLeaderboard() {
  try {
    const res = await fetch(`${API_BASE}/scores`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.scores || [];
  } catch (err) {
    console.warn('[API] Could not fetch leaderboard:', err.message);
    return [];
  }
}

export async function submitScore({ playerName = "Player", score = 0, distance = 0, carId = "cyber" }) {
  try {
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, score, distance, carId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Could not submit score:', err.message);
    return null;
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
