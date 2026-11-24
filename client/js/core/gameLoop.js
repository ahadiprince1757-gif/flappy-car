let animationFrameId = null;
let running = false;

// Fixed Physics Timestep: 60Hz deterministic physics
export const FIXED_DT = 1 / 60;
const MAX_ACCUMULATOR = 0.15; // Prevent spiral of death on long stalls

export function startGameLoop({ update, render }) {
  if (running) return;

  running = true;

  let previousTime = performance.now();
  let accumulator = 0;

  function frame(timestamp) {
    if (!running) return;

    const frameTime = Math.min((timestamp - previousTime) / 1000, MAX_ACCUMULATOR);
    previousTime = timestamp;

    accumulator += frameTime;

    // Fixed physics updates
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT, timestamp);
      accumulator -= FIXED_DT;
    }

    // Single render per animation frame
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
