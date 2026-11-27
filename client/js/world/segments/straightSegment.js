import { SEGMENT_LENGTH, RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   STRAIGHT ROAD SEGMENT MODULE
   Ultra-low-poly (~56 triangles total for asphalt + curbs + sidewalks + shoulders)
   Shares a single GPU BufferGeometry set across every pooled straight instance.
================================================================ */

let _sharedStraightGeos = null;

function sampleStraightProfile(t, out) {
  out.x = 0;
  // Subtle micro-crown crest (0.14m peak mid-segment, zero slope at t=0 and t=1 for C1 continuity)
  out.y = 0.07 * (1 - Math.cos(Math.PI * 2 * t));
  out.heading = 0;
  // dy/dz = -(dy/dt) / length = -(0.07 * 2π * sin(2πt)) / length
  out.slope = -(0.07 * Math.PI * 2 * Math.sin(Math.PI * 2 * t)) / SEGMENT_LENGTH;
  return out;
}

function getSharedStraightGeometries() {
  if (!_sharedStraightGeos) {
    _sharedStraightGeos = createSharedHighwayGeometries({
      length: SEGMENT_LENGTH,
      segmentsZ: 6, // Low-poly straight strip
      profileFn: sampleStraightProfile
    });
  }
  return _sharedStraightGeos;
}

export function createStraightSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedStraightGeometries(),
    materials,
    "road-seg-straight"
  );

  return createRoadSegment({
    type: "straight",
    length: SEGMENT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleStraightProfile
  });
}
