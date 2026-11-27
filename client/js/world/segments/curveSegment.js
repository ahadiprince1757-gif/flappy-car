import { SEGMENT_LENGTH, CURVE_DELTA_X, RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   CURVED ROAD SEGMENT MODULE (curveLeft & curveRight)
   Uses C1-continuous cosine S-ease:
     x(t) = deltaX * 0.5 * (1 - cos(π * t))
   Guarantees zero entry/exit tangent angle (heading = 0 at t=0 and t=1)
   so curves snap seamlessly onto straights, roundabouts, flyovers, or tunnels.
================================================================ */

let _sharedCurveLeftGeos = null;
let _sharedCurveRightGeos = null;

function makeCurveProfile(deltaX) {
  return function sampleCurveProfile(t, out) {
    const halfPiT = Math.PI * t;
    out.x = deltaX * 0.5 * (1 - Math.cos(halfPiT));
    out.y = 0.08 * (1 - Math.cos(Math.PI * 2 * t));

    // Analytical tangent: dx/dz = -(dx/dt) / length
    const dxDt = deltaX * 0.5 * Math.PI * Math.sin(halfPiT);
    const dRoadX_dz = -dxDt / SEGMENT_LENGTH;
    out.heading = Math.atan2(dRoadX_dz, 1);

    const dyDt = 0.08 * Math.PI * 2 * Math.sin(Math.PI * 2 * t);
    out.slope = -dyDt / SEGMENT_LENGTH;
    return out;
  };
}

const sampleCurveLeftProfile = makeCurveProfile(-CURVE_DELTA_X);
const sampleCurveRightProfile = makeCurveProfile(CURVE_DELTA_X);

function getSharedCurveGeometries(direction) {
  if (direction < 0) {
    if (!_sharedCurveLeftGeos) {
      _sharedCurveLeftGeos = createSharedHighwayGeometries({
        length: SEGMENT_LENGTH,
        segmentsZ: 14, // Smooth sweeping arc while staying low-poly
        profileFn: sampleCurveLeftProfile
      });
    }
    return _sharedCurveLeftGeos;
  }

  if (!_sharedCurveRightGeos) {
    _sharedCurveRightGeos = createSharedHighwayGeometries({
      length: SEGMENT_LENGTH,
      segmentsZ: 14,
      profileFn: sampleCurveRightProfile
    });
  }
  return _sharedCurveRightGeos;
}

export function createCurveLeftSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedCurveGeometries(-1),
    materials,
    "road-seg-curve-left"
  );

  return createRoadSegment({
    type: "curveLeft",
    length: SEGMENT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: -CURVE_DELTA_X,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleCurveLeftProfile
  });
}

export function createCurveRightSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedCurveGeometries(1),
    materials,
    "road-seg-curve-right"
  );

  return createRoadSegment({
    type: "curveRight",
    length: SEGMENT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: CURVE_DELTA_X,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleCurveRightProfile
  });
}
