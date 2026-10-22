/**
 * Flappy Car 3D — Dual-Channel Audio & Custom Music Jukebox System
 * 
 * Features:
 * - Channel 1 (SFX & Engine): Real-time WebAudio synthesis (engine revs, crashes, drifts, coins)
 * - Channel 2 (Custom BGM): HTML5 Audio element loading user-selected local audio files
 * - Independent volume sliders for Engine/SFX vs Music
 * - Mobile / Android & Capacitor lifecycle protection (auto-pause on background / lock screen)
 * - Safe memory management with URL.revokeObjectURL
 */

let audioContext = null;
let masterGain = null;
let muted = false;
let sfxVolume = 0.35;
let musicVolume = 0.60;
let engineOscillator = null;
let engineGain = null;

// Custom music player state
let musicPlayer = null;
let musicPicker = null;
let musicUrl = null;
let currentTrackName = "";
let wasMusicPlayingBeforeHide = false;
let audioInitialized = false;

// Storage keys
const STORAGE_MUSIC_VOL = "flappyCar.musicVol";
const STORAGE_SFX_VOL = "flappyCar.sfxVol";
const STORAGE_MUTED = "flappyCar.muted";

function loadSavedSettings() {
  try {
    const savedMusic = localStorage.getItem(STORAGE_MUSIC_VOL);
    if (savedMusic !== null) musicVolume = Math.min(1, Math.max(0, parseFloat(savedMusic)));

    const savedSfx = localStorage.getItem(STORAGE_SFX_VOL);
    if (savedSfx !== null) sfxVolume = Math.min(1, Math.max(0, parseFloat(savedSfx)));

    const savedMuted = localStorage.getItem(STORAGE_MUTED);
    if (savedMuted !== null) muted = savedMuted === "true";
  } catch {}
}

loadSavedSettings();

function initializeAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : sfxVolume;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

/**
 * Connect and setup the custom music file picker and audio player
 */
export function setupCustomMusicPlayer() {
  if (typeof document === "undefined") return;

  musicPicker = document.getElementById("musicPicker");
  musicPlayer = document.getElementById("player");

  if (!musicPlayer) {
    musicPlayer = document.createElement("audio");
    musicPlayer.id = "player";
    musicPlayer.loop = true;
    musicPlayer.preload = "none";
    document.body.appendChild(musicPlayer);
  }

  musicPlayer.volume = muted ? 0 : musicVolume;

  // File Picker Change Event
  if (musicPicker) {
    musicPicker.addEventListener("change", () => {
      const file = musicPicker.files && musicPicker.files[0];
      if (!file) return;

      loadCustomMusicFile(file);
    });
  }

  // Mobile / Android / Capacitor Visibility & Lock-Screen Protection
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);

  // Play/pause button hooks
  bindMusicButtons();
  updateMusicUI();
}

/**
 * Load user-selected audio file into player
 */
export function loadCustomMusicFile(file) {
  if (!file) return;

  if (!musicPlayer) {
    musicPlayer = document.getElementById("player");
  }

  // Revoke previous blob URL to prevent memory leaks on mobile / desktop
  if (musicUrl) {
    URL.revokeObjectURL(musicUrl);
    musicUrl = null;
  }

  musicUrl = URL.createObjectURL(file);
  currentTrackName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "Custom Track";

  if (musicPlayer) {
    musicPlayer.src = musicUrl;
    musicPlayer.volume = muted ? 0 : musicVolume;
    musicPlayer.play().then(() => {
      updateMusicUI();
    }).catch((err) => {
      console.warn("[CustomMusic] Play prevented by browser gesture policy:", err.message);
      updateMusicUI();
    });
  }

  updateMusicUI();
}

/**
 * Toggle custom music playback
 */
export async function toggleCustomMusic() {
  if (!musicPlayer) {
    musicPlayer = document.getElementById("player");
  }
  if (!musicPicker) {
    musicPicker = document.getElementById("musicPicker");
  }

  // If no track is loaded yet, open file picker directly
  if (!musicPlayer || !musicPlayer.src) {
    if (musicPicker) {
      musicPicker.click();
    }
    return false;
  }

  if (musicPlayer.paused) {
    try {
      musicPlayer.volume = muted ? 0 : musicVolume;
      await musicPlayer.play();
      updateMusicUI();
      return true;
    } catch (err) {
      console.error("[CustomMusic] Play error:", err);
      return false;
    }
  } else {
    musicPlayer.pause();
    updateMusicUI();
    return false;
  }
}

/**
 * Eject / unload custom music
 */
export function ejectCustomMusic() {
  if (musicPlayer) {
    musicPlayer.pause();
    musicPlayer.removeAttribute("src");
    musicPlayer.load();
  }

  if (musicUrl) {
    URL.revokeObjectURL(musicUrl);
    musicUrl = null;
  }

  currentTrackName = "";
  if (musicPicker) musicPicker.value = "";
  updateMusicUI();
}

/**
 * Handle Android / Browser app pause when screen locks or app loses focus
 */
function handleVisibilityChange() {
  if (document.hidden) {
    if (musicPlayer && !musicPlayer.paused) {
      wasMusicPlayingBeforeHide = true;
      musicPlayer.pause();
    }
    if (audioContext && audioContext.state === "running") {
      audioContext.suspend().catch(() => {});
    }
  } else {
    if (wasMusicPlayingBeforeHide && musicPlayer && musicPlayer.src && !muted) {
      musicPlayer.play().catch(() => {});
      wasMusicPlayingBeforeHide = false;
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    updateMusicUI();
  }
}

function handlePageHide() {
  if (musicPlayer && !musicPlayer.paused) {
    musicPlayer.pause();
  }
}

/**
 * Update UI buttons and badges showing track name and playing state
 */
export function updateMusicUI() {
  const isPlaying = musicPlayer && !musicPlayer.paused && Boolean(musicPlayer.src);
  const trackText = currentTrackName || "Add Music";

  // Top header button
  const trackTitle = document.getElementById("trackTitle");
  if (trackTitle) {
    trackTitle.textContent = currentTrackName ? `🎶 ${currentTrackName}` : "Add Music";
    trackTitle.title = currentTrackName ? `Now Playing: ${currentTrackName}` : "Click to select your music file";
  }

  const jukeboxIcon = document.getElementById("jukeboxIcon");
  if (jukeboxIcon) {
    jukeboxIcon.textContent = isPlaying ? "⏸" : "🎵";
  }

  const playMusicBtn = document.getElementById("playMusic");
  if (playMusicBtn) {
    playMusicBtn.classList.toggle("is-playing", isPlaying);
  }

  // Audio Mixer modal elements
  const mixerTrackStatus = document.getElementById("mixerTrackStatus");
  if (mixerTrackStatus) {
    mixerTrackStatus.textContent = currentTrackName ? `${currentTrackName} (${isPlaying ? "Playing" : "Paused"})` : "No file loaded";
    mixerTrackStatus.classList.toggle("active-track", Boolean(currentTrackName));
  }

  const mixerPlayBtn = document.getElementById("mixerPlayBtn");
  if (mixerPlayBtn) {
    mixerPlayBtn.textContent = isPlaying ? "⏸ PAUSE" : "▶ PLAY";
  }

  // Pause menu elements
  const pauseTrackName = document.getElementById("pauseTrackName");
  if (pauseTrackName) {
    pauseTrackName.textContent = currentTrackName || "Music Off";
  }
  const pauseMusicIcon = document.getElementById("pauseMusicIcon");
  if (pauseMusicIcon) {
    pauseMusicIcon.textContent = isPlaying ? "⏸" : "▶";
  }

  // Volume text displays
  const musicVolText = document.getElementById("musicVolText");
  if (musicVolText) musicVolText.textContent = `${Math.round(musicVolume * 100)}%`;

  const sfxVolText = document.getElementById("sfxVolText");
  if (sfxVolText) sfxVolText.textContent = `${Math.round(sfxVolume * 100)}%`;

  const musicVolSlider = document.getElementById("musicVolSlider");
  if (musicVolSlider) musicVolSlider.value = Math.round(musicVolume * 100);

  const sfxVolSlider = document.getElementById("sfxVolSlider");
  if (sfxVolSlider) sfxVolSlider.value = Math.round(sfxVolume * 100);

  const mixerMuteToggle = document.getElementById("mixerMuteToggle");
  if (mixerMuteToggle) {
    mixerMuteToggle.textContent = muted ? "MUTED 🔇" : "SOUND ON 🔊";
    mixerMuteToggle.classList.toggle("is-muted", muted);
  }
}

function bindMusicButtons() {
  const playBtn = document.getElementById("playMusic");
  if (playBtn && !playBtn.__bound) {
    playBtn.__bound = true;
    playBtn.addEventListener("click", () => {
      toggleCustomMusic();
    });
  }

  const mixerPickBtn = document.getElementById("mixerPickBtn");
  if (mixerPickBtn && !mixerPickBtn.__bound) {
    mixerPickBtn.__bound = true;
    mixerPickBtn.addEventListener("click", () => {
      if (musicPicker) musicPicker.click();
    });
  }

  const mixerPlayBtn = document.getElementById("mixerPlayBtn");
  if (mixerPlayBtn && !mixerPlayBtn.__bound) {
    mixerPlayBtn.__bound = true;
    mixerPlayBtn.addEventListener("click", () => {
      toggleCustomMusic();
    });
  }

  const mixerEjectBtn = document.getElementById("mixerEjectBtn");
  if (mixerEjectBtn && !mixerEjectBtn.__bound) {
    mixerEjectBtn.__bound = true;
    mixerEjectBtn.addEventListener("click", () => {
      ejectCustomMusic();
    });
  }

  const musicVolSlider = document.getElementById("musicVolSlider");
  if (musicVolSlider && !musicVolSlider.__bound) {
    musicVolSlider.__bound = true;
    musicVolSlider.addEventListener("input", (e) => {
      setMusicVolume(e.target.value / 100);
    });
  }

  const sfxVolSlider = document.getElementById("sfxVolSlider");
  if (sfxVolSlider && !sfxVolSlider.__bound) {
    sfxVolSlider.__bound = true;
    sfxVolSlider.addEventListener("input", (e) => {
      setSfxVolume(e.target.value / 100);
    });
  }

  const pauseMusicToggleBtn = document.getElementById("pauseMusicToggleBtn");
  if (pauseMusicToggleBtn && !pauseMusicToggleBtn.__bound) {
    pauseMusicToggleBtn.__bound = true;
    pauseMusicToggleBtn.addEventListener("click", () => {
      toggleCustomMusic();
    });
  }
}

// ── Master Mute & Volume Channels ───────────────────

export function setMuted(value) {
  muted = Boolean(value);
  try {
    localStorage.setItem(STORAGE_MUTED, String(muted));
  } catch {}

  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      muted ? 0 : sfxVolume,
      audioContext.currentTime,
      0.03
    );
  }

  if (musicPlayer) {
    musicPlayer.volume = muted ? 0 : musicVolume;
  }

  updateMusicUI();
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

export function isMuted() {
  return muted;
}

export function setSfxVolume(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return sfxVolume;

  sfxVolume = Math.min(1, Math.max(0, numericValue));
  try {
    localStorage.setItem(STORAGE_SFX_VOL, String(sfxVolume));
  } catch {}

  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      muted ? 0 : sfxVolume,
      audioContext.currentTime,
      0.03
    );
  }

  updateMusicUI();
  return sfxVolume;
}

export function getSfxVolume() {
  return sfxVolume;
}

export function setMusicVolume(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return musicVolume;

  musicVolume = Math.min(1, Math.max(0, numericValue));
  try {
    localStorage.setItem(STORAGE_MUSIC_VOL, String(musicVolume));
  } catch {}

  if (musicPlayer) {
    musicPlayer.volume = muted ? 0 : musicVolume;
  }

  updateMusicUI();
  return musicVolume;
}

export function getMusicVolume() {
  return musicVolume;
}

// Backward-compatible alias for existing callers
export function setVolume(value) {
  return setSfxVolume(value);
}

export function getVolume() {
  return sfxVolume;
}

export function isMusicPlaying() {
  return Boolean(musicPlayer && !musicPlayer.paused && musicPlayer.src);
}

export function getTrackTitle() {
  return currentTrackName;
}

// ── WebAudio Tone Synthesizer for SFX ────────────────

function playTone({
  frequency = 440,
  endFrequency = frequency,
  duration = 0.12,
  type = "sine",
  gain = 0.25
} = {}) {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(
    Math.max(20, frequency),
    now
  );

  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, endFrequency),
    now + Math.max(0.02, duration)
  );

  envelope.gain.setValueAtTime(0.001, now);
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(0.002, gain),
    now + 0.012
  );
  envelope.gain.exponentialRampToValueAtTime(
    0.001,
    now + duration
  );

  oscillator.connect(envelope);
  envelope.connect(masterGain);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);

  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

export function initializeAudio() {
  if (audioInitialized) return;
  audioInitialized = true;
  initializeAudioContext();
  setupCustomMusicPlayer();
}

export function playCoinSound() {
  playTone({
    frequency: 850,
    endFrequency: 1320,
    duration: 0.11,
    type: "sine",
    gain: 0.22
  });
}

export function playJumpSound() {
  playTone({
    frequency: 240,
    endFrequency: 520,
    duration: 0.16,
    type: "triangle",
    gain: 0.2
  });
}

export function playPowerUpSound() {
  playTone({
    frequency: 330,
    endFrequency: 990,
    duration: 0.28,
    type: "sine",
    gain: 0.24
  });
}

export function playCrashSound() {
  playTone({
    frequency: 150,
    endFrequency: 45,
    duration: 0.32,
    type: "sawtooth",
    gain: 0.25
  });
}

export function playRaceCompleteSound() {
  playTone({
    frequency: 523,
    endFrequency: 784,
    duration: 0.18,
    type: "triangle",
    gain: 0.2
  });

  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(784, now + 0.19);
  oscillator.frequency.exponentialRampToValueAtTime(
    1046,
    now + 0.39
  );

  envelope.gain.setValueAtTime(0.001, now);
  envelope.gain.setValueAtTime(0.2, now + 0.2);
  envelope.gain.exponentialRampToValueAtTime(
    0.001,
    now + 0.4
  );

  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(now + 0.19);
  oscillator.stop(now + 0.42);

  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

export function playRaceFailedSound() {
  playTone({
    frequency: 350,
    endFrequency: 110,
    duration: 0.4,
    type: "triangle",
    gain: 0.22
  });
}

export function startEngineSound() {
  const context = initializeAudioContext();
  if (!context || muted || engineOscillator) return;

  engineOscillator = context.createOscillator();
  engineGain = context.createGain();

  engineOscillator.type = "sawtooth";
  engineOscillator.frequency.value = 65;
  engineGain.gain.value = 0.025;

  engineOscillator.connect(engineGain);
  engineGain.connect(masterGain);
  engineOscillator.start();
}

export function updateEngineSound(speed, baseSpeed = 18) {
  if (!audioContext || !engineOscillator || !engineGain) return;

  const normalizedSpeed = Math.max(
    0,
    Math.min(2, speed / Math.max(1, baseSpeed))
  );

  engineOscillator.frequency.setTargetAtTime(
    55 + normalizedSpeed * 50,
    audioContext.currentTime,
    0.12
  );

  engineGain.gain.setTargetAtTime(
    muted ? 0 : 0.012 + normalizedSpeed * 0.018,
    audioContext.currentTime,
    0.12
  );
}

export function stopEngineSound() {
  if (!engineOscillator) return;

  try {
    engineOscillator.stop();
  } catch {
    // Already stopped
  }

  engineOscillator.disconnect();
  engineGain?.disconnect();

  engineOscillator = null;
  engineGain = null;
}
