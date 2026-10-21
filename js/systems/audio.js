let audioContext = null;
let masterGain = null;
let muted = false;
let volume = 0.35;
let engineOscillator = null;
let engineGain = null;

function initializeAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

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
  initializeAudioContext();
}

export function setMuted(value) {
  muted = Boolean(value);

  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      muted ? 0 : volume,
      audioContext.currentTime,
      0.03
    );
  }

  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

export function isMuted() {
  return muted;
}

export function setVolume(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return volume;

  volume = Math.min(1, Math.max(0, numericValue));

  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      muted ? 0 : volume,
      audioContext.currentTime,
      0.03
    );
  }

  return volume;
}

export function getVolume() {
  return volume;
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
