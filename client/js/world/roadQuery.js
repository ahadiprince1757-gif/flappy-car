import { RoadLayer } from "./roadConstants.js";

/* ================================================================
   ROAD QUERY ENGINE (LAYER-AWARE, ZERO-ALLOCATION)
   Provides fast O(activeSegments) point, elevation, slope, and heading
   queries against the active modular road network.
   Backwards-compatible with stageRenderer's getRoadPoint(z, lat, out).
================================================================ */

let _activeSegments = [];

const _queryScratch = {
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  slope: 0,
  layer: RoadLayer.GROUND,
  segmentType: "straight"
};

export function setActiveRoadSegments(segments) {
  _activeSegments = segments || [];
}

export function getActiveRoadSegments() {
  return _activeSegments;
}

/**
 * Find the active RoadSegment covering local world coordinate `z`
 * (optionally matching a preferred `layer`).
 */
export function findSegmentAtZ(z, preferredLayer = null) {
  const len = _activeSegments.length;
  if (len === 0) return null;

  let fallback = null;

  for (let i = 0; i < len; i++) {
    const seg = _activeSegments[i];
    // Segment covers z ∈ [zEnd, zStart] (recall zStart > zEnd because road goes toward -Z)
    if (z <= seg.zStart && z >= seg.zEnd) {
      if (preferredLayer === null || seg.layer === preferredLayer) {
        return seg;
      }
      fallback = seg;
    }
  }

  if (fallback) return fallback;

  // Clamp gracefully to nearest end segment if query Z is slightly outside active span
  const first = _activeSegments[0];
  if (z > first.zStart) return first;
  return _activeSegments[len - 1];
}

/**
 * Sample world-space road position, heading, slope, and layer at local Z & lateral offset.
 * Writes directly into `out` when provided (zero GC allocation in hot loops).
 */
export function queryRoadPoint(z, lateralOffset = 0, out = null, preferredLayer = null) {
  const target = out || {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    slope: 0,
    layer: RoadLayer.GROUND,
    segmentType: "straight"
  };

  const seg = findSegmentAtZ(z, preferredLayer);
  if (!seg) {
    target.x = lateralOffset;
    target.y = 0;
    target.z = z;
    target.heading = 0;
    target.slope = 0;
    target.layer = RoadLayer.GROUND;
    target.segmentType = "straight";
    return target;
  }

  return seg.navigation.sampleWorld(z, lateralOffset, target);
}

export function queryRoadHeight(z, preferredLayer = null) {
  return queryRoadPoint(z, 0, _queryScratch, preferredLayer).y;
}

export function queryRoadSlope(z, preferredLayer = null) {
  return queryRoadPoint(z, 0, _queryScratch, preferredLayer).slope;
}

export function queryRoadX(z, preferredLayer = null) {
  return queryRoadPoint(z, 0, _queryScratch, preferredLayer).x;
}

export function queryRoadHeading(z, preferredLayer = null) {
  return queryRoadPoint(z, 0, _queryScratch, preferredLayer).heading;
}
