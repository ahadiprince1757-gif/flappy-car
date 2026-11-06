/**
 * Flappy Car 3D — Triple-Channel Audio System
 *
 * Features:
 * - Channel 1 (SFX & Engine): Real-time WebAudio synthesis (engine revs, crashes, drifts, coins)
 * - Channel 2 (Custom BGM): HTML5 Audio element loading user-selected local audio files
 * - Channel 3 (Built-in BGM): Procedural synthwave sequencer via WebAudio (no file needed)
 * - Pentatonic coin arpeggios with streak pitch-shifting
 * - Enhanced crash SFX (multi-oscillator noise burst)
 * - Tire screech drift audio, turbo blow-off valve, near-miss whoosh
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

// Coin streak arpeggio state
let coinStreakCount = 0;
let coinStreakTimer = null;
const PENTATONIC_FREQS = [523, 587, 659, 784, 880, 1047, 1175, 1319]; // C5 pentatonic

// Built-in synthwave BGM state
let synthBGMActive = false;
let synthBGMTimeout = null;
let synthBGMNodes = [];
const SYNTH_BGM_TEMPO = 142; // BPM
const SYNTH_BEAT_SEC = 60 / SYNTH_BGM_TEMPO;

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
  // Auto-start built-in synthwave BGM if user hasn't loaded a custom track
  if (!musicPlayer?.src && !muted) {
    setTimeout(() => startSynthwaveBGM(), 200);
  }
}

export function startSynthwaveBGM() {
  if (synthBGMActive) return;
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;

  synthBGMActive = true;

  // Synthwave BGM: 4-bar looping pattern using bass synth + arp melody + kick pulse
  // Tempo: 142 BPM
  const BPS = SYNTH_BEAT_SEC; // seconds per beat
  const BAR = BPS * 4; // 4 beats = 1 bar
  const LOOP_BARS = 8; // 8-bar loop
  const LOOP_DURATION = BAR * LOOP_BARS;

  // Bass sequence (root notes per bar): D2 D2 A1 Bb1 (classic retrowave IV-I-V-VI)
  const BASS_NOTES = [73.42, 73.42, 55, 58.27, 73.42, 73.42, 65.41, 61.74];
  // Arp melody: D4 F#4 A4 C5 B4 A4 G4 F#4
  const ARP_NOTES = [293.66, 369.99, 440, 523.25, 493.88, 440, 392, 369.99,
                     329.63, 293.66, 261.63, 246.94, 293.66, 369.99, 440, 523.25];

  const bgmGain = context.createGain();
  bgmGain.gain.value = muted ? 0 : Math.min(0.09, musicVolume * 0.14);
  bgmGain.connect(context.destination); // connect directly (not through SFX masterGain)
  synthBGMNodes.push(bgmGain);

  function scheduleLoop(startTime) {
    if (!synthBGMActive) return;

    // ── Bass synth ────────────────────────────────────────────────
    for (let bar = 0; bar < LOOP_BARS; bar++) {
      const freq = BASS_NOTES[bar % BASS_NOTES.length];
      const t = startTime + bar * BAR;

      const bassOsc = context.createOscillator();
      const bassEnv = context.createGain();
      bassOsc.type = "sawtooth";
      bassOsc.frequency.setValueAtTime(freq, t);
      bassEnv.gain.setValueAtTime(0.001, t);
      bassEnv.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
      bassEnv.gain.exponentialRampToValueAtTime(0.4, t + BPS * 1.5);
      bassEnv.gain.exponentialRampToValueAtTime(0.001, t + BAR - 0.04);
      bassOsc.connect(bassEnv);
      bassEnv.connect(bgmGain);
      bassOsc.start(t);
      bassOsc.stop(t + BAR);
      bassOsc.onended = () => { bassOsc.disconnect(); bassEnv.disconnect(); };
      synthBGMNodes.push(bassOsc, bassEnv);
    }

    // ── Arp melody ───────────────────────────────────────────────
    for (let step = 0; step < ARP_NOTES.length * 2; step++) {
      const freq = ARP_NOTES[step % ARP_NOTES.length];
      const t = startTime + step * (BPS / 2);
      if (t >= startTime + LOOP_DURATION) break;

      const arpOsc = context.createOscillator();
      const arpEnv = context.createGain();
      arpOsc.type = "triangle";
      arpOsc.frequency.setValueAtTime(freq, t);
      arpEnv.gain.setValueAtTime(0.001, t);
      arpEnv.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
      arpEnv.gain.exponentialRampToValueAtTime(0.001, t + BPS / 2 - 0.02);
      arpOsc.connect(arpEnv);
      arpEnv.connect(bgmGain);
      arpOsc.start(t);
      arpOsc.stop(t + BPS / 2);
      arpOsc.onended = () => { arpOsc.disconnect(); arpEnv.disconnect(); };
      synthBGMNodes.push(arpOsc, arpEnv);
    }

    // ── Kick drum pulse (every beat) ─────────────────────────────
    for (let beat = 0; beat < LOOP_BARS * 4; beat++) {
      const t = startTime + beat * BPS;
      const kickOsc = context.createOscillator();
      const kickEnv = context.createGain();
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(120, t);
      kickOsc.frequency.exponentialRampToValueAtTime(35, t + 0.1);
      kickEnv.gain.setValueAtTime(0.001, t);
      kickEnv.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
      kickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      kickOsc.connect(kickEnv);
      kickEnv.connect(bgmGain);
      kickOsc.start(t);
      kickOsc.stop(t + 0.16);
      kickOsc.onended = () => { kickOsc.disconnect(); kickEnv.disconnect(); };
      synthBGMNodes.push(kickOsc, kickEnv);
    }

    // Schedule next loop
    synthBGMTimeout = setTimeout(() => scheduleLoop(startTime + LOOP_DURATION), (LOOP_DURATION - 0.5) * 1000);
  }

  scheduleLoop(context.currentTime + 0.1);
}

export function stopSynthwaveBGM() {
  synthBGMActive = false;
  if (synthBGMTimeout) {
    clearTimeout(synthBGMTimeout);
    synthBGMTimeout = null;
  }
  for (const node of synthBGMNodes) {
    try { node.stop?.(); } catch {}
    try { node.disconnect(); } catch {}
  }
  synthBGMNodes = [];
}

export function isSynthBGMActive() {
  return synthBGMActive;
}

export function playCoinSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;

  // Pentatonic arpeggio: each coin in quick succession steps up the scale
  if (coinStreakTimer) clearTimeout(coinStreakTimer);
  coinStreakTimer = setTimeout(() => { coinStreakCount = 0; }, 800);

  const idx = Math.min(coinStreakCount, PENTATONIC_FREQS.length - 1);
  const baseFreq = PENTATONIC_FREQS[idx];
  coinStreakCount = (coinStreakCount + 1) % PENTATONIC_FREQS.length;

  const now = context.currentTime;

  // Primary chime tone
  const osc1 = context.createOscillator();
  const env1 = context.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(baseFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);
  env1.gain.setValueAtTime(0.001, now);
  env1.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
  env1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc1.connect(env1);
  env1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.16);
  osc1.onended = () => { osc1.disconnect(); env1.disconnect(); };

  // Sparkle harmonic overtone
  const osc2 = context.createOscillator();
  const env2 = context.createGain();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(baseFreq * 2, now + 0.02);
  env2.gain.setValueAtTime(0.001, now + 0.02);
  env2.gain.exponentialRampToValueAtTime(0.1, now + 0.04);
  env2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc2.connect(env2);
  env2.connect(masterGain);
  osc2.start(now + 0.02);
  osc2.stop(now + 0.12);
  osc2.onended = () => { osc2.disconnect(); env2.disconnect(); };
}

export function playJumpSound() {
  playTone({
    frequency: 240,
    endFrequency: 580,
    duration: 0.18,
    type: "triangle",
    gain: 0.22
  });
}

export function playPowerUpSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;
  const now = context.currentTime;

  // Rising triple-chord power-up jingle
  const notes = [330, 415, 523, 659, 830];
  notes.forEach((freq, i) => {
    const o = context.createOscillator();
    const e = context.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, now + i * 0.065);
    e.gain.setValueAtTime(0.001, now + i * 0.065);
    e.gain.exponentialRampToValueAtTime(0.2, now + i * 0.065 + 0.025);
    e.gain.exponentialRampToValueAtTime(0.001, now + i * 0.065 + 0.14);
    o.connect(e);
    e.connect(masterGain);
    o.start(now + i * 0.065);
    o.stop(now + i * 0.065 + 0.16);
    o.onended = () => { o.disconnect(); e.disconnect(); };
  });
}

export function playCrashSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;
  const now = context.currentTime;

  // 1. Sub-bass impact thud
  const sub = context.createOscillator();
  const subEnv = context.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(90, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.28);
  subEnv.gain.setValueAtTime(0.001, now);
  subEnv.gain.exponentialRampToValueAtTime(0.45, now + 0.01);
  subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  sub.connect(subEnv); subEnv.connect(masterGain);
  sub.start(now); sub.stop(now + 0.34);
  sub.onended = () => { sub.disconnect(); subEnv.disconnect(); };

  // 2. Metal crunch — sawtooth burst
  const crunch = context.createOscillator();
  const crunchEnv = context.createGain();
  crunch.type = "sawtooth";
  crunch.frequency.setValueAtTime(220, now);
  crunch.frequency.exponentialRampToValueAtTime(55, now + 0.18);
  crunchEnv.gain.setValueAtTime(0.001, now);
  crunchEnv.gain.exponentialRampToValueAtTime(0.3, now + 0.008);
  crunchEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  crunch.connect(crunchEnv); crunchEnv.connect(masterGain);
  crunch.start(now); crunch.stop(now + 0.24);
  crunch.onended = () => { crunch.disconnect(); crunchEnv.disconnect(); };

  // 3. White-noise glass shatter
  const bufferSize = context.sampleRate * 0.18;
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;
  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 2800;
  const noiseEnv = context.createGain();
  noiseEnv.gain.setValueAtTime(0.001, now + 0.02);
  noiseEnv.gain.exponentialRampToValueAtTime(0.18, now + 0.035);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseEnv);
  noiseEnv.connect(masterGain);
  noise.start(now + 0.02);
  noise.onended = () => { noise.disconnect(); noiseFilter.disconnect(); noiseEnv.disconnect(); };
}

export function playDriftSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;
  const now = context.currentTime;

  // Tire screech: narrow-band noise pitched around 2.4kHz with wobble
  const bufferSize = Math.floor(context.sampleRate * 0.22);
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const nd = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) nd[i] = (Math.random() * 2 - 1) * 0.7;
  const noiseSrc = context.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bandpass = context.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(2400, now);
  bandpass.frequency.exponentialRampToValueAtTime(1800, now + 0.22);
  bandpass.Q.value = 2.5;

  const driftEnv = context.createGain();
  driftEnv.gain.setValueAtTime(0.001, now);
  driftEnv.gain.exponentialRampToValueAtTime(0.14, now + 0.03);
  driftEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  noiseSrc.connect(bandpass);
  bandpass.connect(driftEnv);
  driftEnv.connect(masterGain);
  noiseSrc.start(now);
  noiseSrc.onended = () => { noiseSrc.disconnect(); bandpass.disconnect(); driftEnv.disconnect(); };
}

export function playTurboBlowOffSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;
  const now = context.currentTime;

  // Pneumatic PSSH — filtered noise spike dropping rapidly
  const bufSize = Math.floor(context.sampleRate * 0.18);
  const buf = context.createBuffer(1, bufSize, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = context.createBufferSource();
  src.buffer = buf;

  const hpf = context.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 1200;

  const env = context.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  src.connect(hpf); hpf.connect(env); env.connect(masterGain);
  src.start(now);
  src.onended = () => { src.disconnect(); hpf.disconnect(); env.disconnect(); };
}

export function playNitroBoostSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;
  const now = context.currentTime;

  // High-pitch afterburner rocket ignition
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
  env.gain.setValueAtTime(0.001, now);
  env.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(env); env.connect(masterGain);
  osc.start(now); osc.stop(now + 0.36);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}


export function playNearMissSound() {
  const context = initializeAudioContext();
  if (!context || muted || !masterGain) return;
  const now = context.currentTime;

  // Doppler whoosh — frequency sweep down from 900 to 200
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.14);
  env.gain.setValueAtTime(0.001, now);
  env.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc.connect(env); env.connect(masterGain);
  osc.start(now); osc.stop(now + 0.16);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
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

  // Multi-layered engine: low roar + mid-tone harmonic
  engineOscillator.type = "sawtooth";
  engineOscillator.frequency.value = 55;
  engineGain.gain.value = 0.022;

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
