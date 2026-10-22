import { gameState } from "../core/gameState.js";
import { loadData, saveData } from "../core/storage.js";
import { awardCoins } from "../systems/economy.js";
import {
  getRacingLevel,
  getNextRacingLevel
} from "./racingLevels.js";

function getRaceProgress() {
  const race = gameState.race;
  if (!race) return null;

  return {
    distance: Math.max(0, gameState.distance - race.startDistance),
    coins: Math.max(0, (gameState.runCoins || 0) - race.startCoins),
    score: Math.max(0, gameState.score - race.startScore),
    timeRemaining: Math.max(0, race.level.timeLimit - race.elapsedTime),
    lives: race.lives
  };
}

function finishRace(status, reason = null) {
  const race = gameState.race;
  if (!race || race.status !== "playing") return;

  race.status = status;
  race.reason = reason;
  race.progress = getRaceProgress();

  gameState.raceStatus = status;
  gameState.status = "gameOver";

  if (status === "completed") {
    const data = loadData();
    const completed = Array.isArray(data.completedLevels)
      ? data.completedLevels
      : [];

    if (!completed.includes(race.level.id)) {
      completed.push(race.level.id);
    }

    data.completedLevels = completed;
    saveData(data);

    const rewardResult = awardCoins(race.level.reward);
    race.reward = rewardResult.success ? race.level.reward : 0;

    window.dispatchEvent(
      new CustomEvent("flappycar:race-completed", {
        detail: {
          levelId: race.level.id,
          levelName: race.level.name,
          reward: race.reward,
          progress: race.progress,
          nextLevel: getNextRacingLevel(race.level.id)?.id ?? null
        }
      })
    );

    return;
  }

  window.dispatchEvent(
    new CustomEvent("flappycar:race-failed", {
      detail: {
        levelId: race.level.id,
        levelName: race.level.name,
        reason,
        progress: race.progress
      }
    })
  );
}

export function startRace(levelId = 1) {
  const level = getRacingLevel(levelId);
  if (!level) {
    return { success: false, reason: "level-not-found" };
  }

  const data = loadData();
  const completedLevels = Array.isArray(data.completedLevels)
    ? data.completedLevels
    : [];

  if (level.id > 1 && !completedLevels.includes(level.id - 1)) {
    return {
      success: false,
      reason: "level-locked",
      requiredLevel: level.id - 1
    };
  }

  gameState.gameMode = "racing";
  gameState.currentLevel = level.id;
  gameState.runCoins = 0;
  gameState.score = 0;
  gameState.distance = 0;
  gameState.elapsedTime = 0;

  gameState.race = {
    level,
    status: "playing",
    reason: null,
    elapsedTime: 0,
    lives: level.lives,
    startDistance: gameState.distance,
    startCoins: gameState.runCoins,
    startScore: gameState.score,
    progress: null,
    reward: 0
  };

  gameState.raceStatus = "playing";
  gameState.status = "playing";

  window.dispatchEvent(
    new CustomEvent("flappycar:race-started", {
      detail: {
        levelId: level.id,
        levelName: level.name,
        distanceTarget: level.distance,
        timeLimit: level.timeLimit,
        lives: level.lives
      }
    })
  );

  return {
    success: true,
    level
  };
}

export function updateRacing(deltaTime) {
  const race = gameState.race;

  if (
    gameState.gameMode !== "racing" ||
    !race ||
    race.status !== "playing" ||
    gameState.status !== "playing"
  ) {
    return;
  }

  race.elapsedTime += deltaTime;
  const progress = getRaceProgress();
  race.progress = progress;

  const distanceComplete = progress.distance >= race.level.distance;
  const coinsComplete = progress.coins >= race.level.coinTarget;
  const scoreComplete = progress.score >= race.level.scoreTarget;

  if (distanceComplete && coinsComplete && scoreComplete) {
    finishRace("completed");
    return;
  }

  if (race.elapsedTime >= race.level.timeLimit) {
    finishRace("failed", "time-limit");
  }
}

export function handleRaceCollision(obstacle = null) {
  if (gameState.gameMode !== "racing") {
    gameState.status = "gameOver";

    window.dispatchEvent(
      new CustomEvent("flappycar:gameover", {
        detail: {
          score: gameState.score,
          coins: gameState.runCoins || 0,
          distance: gameState.distance,
          obstacleType: obstacle?.type ?? null
        }
      })
    );
    return;
  }

  const race = gameState.race;
  if (!race || race.status !== "playing") {
    gameState.status = "gameOver";
    return;
  }

  race.lives = Math.max(0, race.lives - 1);

  window.dispatchEvent(
    new CustomEvent("flappycar:race-life-lost", {
      detail: {
        lives: race.lives,
        obstacleType: obstacle?.type ?? null
      }
    })
  );

  if (race.lives <= 0) {
    finishRace("failed", "no-lives");
  }
}

export function getRaceState() {
  const race = gameState.race;
  if (!race) return null;

  return {
    level: race.level,
    status: race.status,
    reason: race.reason,
    lives: race.lives,
    elapsedTime: race.elapsedTime,
    progress: getRaceProgress(),
    reward: race.reward
  };
}

export function abandonRace() {
  if (gameState.race?.status === "playing") {
    finishRace("failed", "abandoned");
  }
}

export function getUnlockedRacingLevels() {
  const data = loadData();
  const completed = Array.isArray(data.completedLevels)
    ? data.completedLevels
    : [];

  return {
    completedLevels: [...completed],
    unlockedLevels: [
      1,
      ...completed.map((id) => Number(id) + 1)
    ].filter((id, index, array) => (
      getRacingLevel(id) && array.indexOf(id) === index
    ))
  };
}
