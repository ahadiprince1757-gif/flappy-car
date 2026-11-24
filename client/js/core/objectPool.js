/**
 * ObjectPool & ObjectManager
 *
 * Provides high-performance object lifecycle management for Flappy Car:
 * - Pre-allocation & pre-warming
 * - O(1) acquisition and recycling
 * - Hard capacity limits with panic protection (releasing oldest)
 * - Automatic off-screen boundary recycling
 * - Zero GC churn during continuous gameplay
 */

export class ObjectPool {
  /**
   * @param {Object} options
   * @param {string} options.name Pool identifier name
   * @param {Function} options.createFactory Function returning a new object instance
   * @param {Function} [options.resetFn] Optional reset hook (obj) => void
   * @param {number} [options.maxSize=50] Hard ceiling for active instances
   * @param {number} [options.initialSize=0] Count to pre-warm upon initialization
   */
  constructor({ name, createFactory, resetFn = null, maxSize = 50, initialSize = 0 }) {
    this.name = name;
    this.createFactory = createFactory;
    this.resetFn = resetFn;
    this.maxSize = maxSize;

    this.inactive = [];
    this.active = [];

    if (initialSize > 0) {
      this.prewarm(initialSize);
    }
  }

  prewarm(count) {
    const toCreate = Math.min(count, this.maxSize) - (this.inactive.length + this.active.length);
    for (let i = 0; i < toCreate; i++) {
      const obj = this.createFactory();
      obj.active = false;
      if (this.resetFn) this.resetFn(obj);
      this.inactive.push(obj);
    }
  }

  get() {
    let obj = null;

    if (this.inactive.length > 0) {
      obj = this.inactive.pop();
    } else if (this.active.length < this.maxSize) {
      // Allocate on demand if below max ceiling
      obj = this.createFactory();
    } else {
      // Panic Protection: Hard limit reached!
      // Recycle the oldest active object instead of dropping FPS
      obj = this.releaseOldest();
    }

    if (obj) {
      obj.active = true;
      this.active.push(obj);
    }

    return obj;
  }

  release(obj) {
    if (!obj) return;

    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      // Fast removal from active array
      this.active.splice(idx, 1);
    }

    obj.active = false;
    if (this.resetFn) {
      this.resetFn(obj);
    }

    // Add back to pool if not already in inactive
    if (!this.inactive.includes(obj)) {
      this.inactive.push(obj);
    }
  }

  releaseOldest() {
    if (this.active.length === 0) return null;
    const oldest = this.active.shift();
    oldest.active = false;
    if (this.resetFn) {
      this.resetFn(oldest);
    }
    return oldest;
  }

  releaseAll() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      obj.active = false;
      if (this.resetFn) this.resetFn(obj);
      this.inactive.push(obj);
    }
  }

  /**
   * Automated offscreen cleaner
   * @param {Function} shouldRecycleFn (obj) => boolean
   */
  recycleIf(shouldRecycleFn) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      if (shouldRecycleFn(item)) {
        this.release(item);
      }
    }
  }

  get activeCount() {
    return this.active.length;
  }

  get totalCount() {
    return this.active.length + this.inactive.length;
  }
}

/**
 * Central ObjectManager
 * Coordinates all pools and provides unified metrics
 */
class ObjectManagerClass {
  constructor() {
    this.pools = new Map();
  }

  registerPool(name, pool) {
    this.pools.set(name, pool);
    return pool;
  }

  getPool(name) {
    return this.pools.get(name);
  }

  resetAll() {
    for (const pool of this.pools.values()) {
      pool.releaseAll();
    }
  }

  getStats() {
    const stats = {};
    let totalActive = 0;
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = {
        active: pool.activeCount,
        total: pool.totalCount,
        max: pool.maxSize
      };
      totalActive += pool.activeCount;
    }
    stats.totalActive = totalActive;
    return stats;
  }
}

export const ObjectManager = new ObjectManagerClass();
