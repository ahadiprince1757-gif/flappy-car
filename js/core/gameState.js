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

  currentLane: 1,
  lanePositions: [-3.6, 0, 3.6],

  shieldActive: false,
  boostActive: false,

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
    slide: false
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

  gameState.currentLane = 1;
  gameState.shieldActive = false;
  gameState.boostActive = false;

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
}
