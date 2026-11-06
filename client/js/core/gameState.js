export const gameState = {
  status: "loading", // loading, menu, playing, paused, gameOver

  score: 0,
  coins: 0,
  runCoins: 0,
  distance: 0,

  speed: 18,
  baseSpeed: 18,
  maxSpeed: 38,

  gravity: 24,
  jumpForce: 10,
  isJumping: false,
  isSliding: false,

  currentLane: 2,
  lanePositions: [-7.2, -3.6, 0, 3.6, 7.2],

  shieldActive: false,
  boostActive: false,

  // ── Nitro & Boost Gauge ─────────────────────────────────────────
  nitro: 0,              // 0.0 to 1.0
  nitroDraining: false,  // true when nitro boost is active

  // ── Flappy Mid-Air Double-Hop ───────────────────────────────
  airHopsRemaining: 1,   // double-hop charges available while airborne

  // ── Near-Miss Combo System ─────────────────────────────────
  nearMissCombo: 0,       // consecutive near-miss streak
  nearMissTimer: 0,       // countdown to reset streak
  scoreMultiplier: 1,     // 1x base, increases with combo streak

  gameMode: "adventure", // adventure, racing
  currentLevel: 1,

  selectedCar: "cyber",
  selectedStage: "city",

  elapsedTime: 0,
  lastFrameTime: 0,

  scene: null,
  camera: null,
  renderer: null,
  underglowLight: null,

  player: null,
  road: null,
  race: null,
  raceStatus: null,

  obstacles: [],
  opponents: [],
  collectibles: [],
  powerUps: [],
  effects: [],

  input: {
    left: false,
    right: false,
    jump: false,
    slide: false,
    accelerate: false,
    brake: false,
    nitro: false
  }
};

export function resetGameState() {
  gameState.status = "playing";

  gameState.score = 0;
  gameState.runCoins = 0;
  gameState.distance = 0;

  gameState.speed = gameState.baseSpeed;
  gameState.isJumping = false;
  gameState.isSliding = false;

  gameState.currentLane = 2;
  gameState.lanePositions = [-7.2, -3.6, 0, 3.6, 7.2];
  gameState.shieldActive = false;
  gameState.boostActive = false;
  gameState.nitro = 0;
  gameState.nitroDraining = false;
  gameState.airHopsRemaining = 1;
  gameState.nearMissCombo = 0;
  gameState.nearMissTimer = 0;
  gameState.scoreMultiplier = 1;

  gameState.elapsedTime = 0;
  gameState.lastFrameTime = 0;

  gameState.obstacles.length = 0;
  gameState.opponents.length = 0;
  gameState.collectibles.length = 0;
  gameState.powerUps.length = 0;
  gameState.effects.length = 0;

  gameState.input.left = false;
  gameState.input.right = false;
  gameState.input.jump = false;
  gameState.input.slide = false;
  gameState.input.accelerate = false;
  gameState.input.brake = false;
  gameState.input.nitro = false;
}
