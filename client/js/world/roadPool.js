import { ObjectPool, ObjectManager } from "../core/objectPool.js";
import { createStraightSegment } from "./segments/straightSegment.js";
import { createCurveLeftSegment, createCurveRightSegment } from "./segments/curveSegment.js";

/* ================================================================
   ROAD SEGMENT OBJECT POOL (ZERO-GC RECYCLING)
   Pre-warms and recycles modular road segments by type so no mesh or
   geometry is ever created or disposed during active gameplay.
================================================================ */

const _pools = new Map();
const _factories = {
  straight: createStraightSegment,
  curveLeft: createCurveLeftSegment,
  curveRight: createCurveRightSegment
};

let _parentGroup = null;
let _currentMaterials = null;

/**
 * Register a new segment type factory dynamically (used by M3 Flyover, M4 Roundabout, M5 Tunnel).
 */
export function registerSegmentType(type, factoryFn, maxSize = 6) {
  _factories[type] = factoryFn;
  if (_parentGroup && _currentMaterials && !_pools.has(type)) {
    _createPoolForType(type, maxSize, 0);
  }
}

function _createPoolForType(type, maxSize, initialSize) {
  const factory = _factories[type];
  if (!factory) {
    throw new Error(`[RoadPool] Unknown segment type: "${type}"`);
  }

  const pool = new ObjectPool({
    name: `road_${type}`,
    maxSize,
    initialSize,
    createFactory: () => {
      const seg = factory(_currentMaterials);
      seg.visual.visible = false;
      if (_parentGroup) {
        _parentGroup.add(seg.visual);
      }
      return seg;
    },
    resetFn: (seg) => {
      seg.active = false;
      if (seg.visual) {
        seg.visual.visible = false;
      }
    }
  });

  _pools.set(type, pool);
  ObjectManager.registerPool(`road_${type}`, pool);
  return pool;
}

/**
 * Initialize or attach the pooled road segments to a Three.js parent container.
 */
export function initRoadPool(parentGroup, materials) {
  _parentGroup = parentGroup;
  _currentMaterials = materials;

  // Ensure pools exist for registered types
  if (!_pools.has("straight")) {
    _createPoolForType("straight", 14, 8);
  }
  if (!_pools.has("curveLeft")) {
    _createPoolForType("curveLeft", 8, 4);
  }
  if (!_pools.has("curveRight")) {
    _createPoolForType("curveRight", 8, 4);
  }

  // Re-attach existing pooled visuals to the current stage container
  for (const pool of _pools.values()) {
    for (const seg of pool.inactive) {
      seg.visual.visible = false;
      if (seg.visual.parent !== parentGroup) {
        parentGroup.add(seg.visual);
      }
    }
    for (const seg of pool.active) {
      if (seg.visual.parent !== parentGroup) {
        parentGroup.add(seg.visual);
      }
    }
  }
}

export function acquireSegment(type) {
  let pool = _pools.get(type);
  if (!pool) {
    pool = _createPoolForType(type, 8, 0);
  }
  const seg = pool.get();
  if (seg && _parentGroup && seg.visual.parent !== _parentGroup) {
    _parentGroup.add(seg.visual);
  }
  return seg;
}

export function releaseSegment(segment) {
  if (!segment) return;
  const pool = _pools.get(segment.type);
  if (pool) {
    pool.release(segment);
  } else if (segment.visual) {
    segment.visual.visible = false;
    segment.active = false;
  }
}

export function releaseAllSegments() {
  for (const pool of _pools.values()) {
    pool.releaseAll();
  }
}
