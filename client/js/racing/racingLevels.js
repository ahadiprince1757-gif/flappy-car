export const RACING_LEVELS = [
  {
    id: 1,
    name: "First Sprint",
    description: "Master the road and reach the finish line.",
    distance: 250,
    timeLimit: 60,
    lives: 3,
    coinTarget: 0,
    scoreTarget: 0,
    reward: 50,
    obstacleDifficulty: 1
  },
  {
    id: 2,
    name: "City Rush",
    description: "Cover distance, dodge barriers, and gather coins.",
    distance: 400,
    timeLimit: 85,
    lives: 3,
    coinTarget: 5,
    scoreTarget: 0,
    reward: 100,
    obstacleDifficulty: 1.15
  },
  {
    id: 3,
    name: "Fast Lane",
    description: "Race farther with tight timing and target points.",
    distance: 600,
    timeLimit: 110,
    lives: 3,
    coinTarget: 8,
    scoreTarget: 100,
    reward: 150,
    obstacleDifficulty: 1.3
  },
  {
    id: 4,
    name: "Precision Run",
    description: "Survive high speeds with only two lives allowed.",
    distance: 750,
    timeLimit: 125,
    lives: 2,
    coinTarget: 10,
    scoreTarget: 150,
    reward: 220,
    obstacleDifficulty: 1.45
  },
  {
    id: 5,
    name: "Grand Prix",
    description: "The ultimate 1000m challenge with immense coin reward.",
    distance: 1000,
    timeLimit: 150,
    lives: 2,
    coinTarget: 15,
    scoreTarget: 250,
    reward: 350,
    obstacleDifficulty: 1.6
  }
];

export function getRacingLevel(levelId) {
  return RACING_LEVELS.find((level) => level.id === Number(levelId)) ?? null;
}

export function getAllRacingLevels() {
  return RACING_LEVELS.map((level) => ({ ...level }));
}

export function getNextRacingLevel(levelId) {
  return getRacingLevel(Number(levelId) + 1);
}

export function isFinalRacingLevel(levelId) {
  return Number(levelId) >= RACING_LEVELS.length;
}
