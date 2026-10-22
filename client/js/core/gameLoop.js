let animationFrameId = null;
let running = false;

const MAX_DELTA_TIME = 0.05;

export function startGameLoop({ update, render }) {
  if (running) return;

  running = true;

  let previousTime = 0;

  function frame(timestamp) {
    if (!running) return;

    const deltaTime = previousTime === 0
      ? 0
      : Math.min((timestamp - previousTime) / 1000, MAX_DELTA_TIME);

    previousTime = timestamp;

    update(deltaTime, timestamp);
    render();

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);
}

export function stopGameLoop() {
  running = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export function isGameLoopRunning() {
  return running;
}
