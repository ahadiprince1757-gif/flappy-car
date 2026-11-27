import { MAX_ROAD_LATERAL_DRIFT, CURVE_DELTA_X } from "./roadConstants.js";

/* ================================================================
   INTERACTIVE CITY ROAD NETWORK GRAPH & DISTRICT ROUTER
   - Streams interconnected city districts seamlessly.
   - Responds LIVE when the player steers LEFT ("uptown") or RIGHT ("skyway")
     through a drivable Boulevard Split Interchange!
================================================================ */

const CHUNK_LIBRARY = {
  opening:     ["straight", "straight", "junction"],
  crossroad:   ["straight", "junction"],
  interchange: ["straight", "interchange"],
  roundabout:  ["straight", "roundabout", "straight"],
  flyover:     ["straight", "flyover"],
  tunnel:      ["straight", "tunnel"],
  curveLeft:   ["curveLeft", "straight"],
  curveRight:  ["curveRight", "straight"]
};

// District-flavored route queues when player picks a branch at an interchange
const DISTRICT_ROUTES = {
  uptown: ["roundabout", "crossroad", "curveLeft", "crossroad", "interchange"],
  skyway: ["flyover", "curveRight", "tunnel", "crossroad", "interchange"]
};

const TRANSITIONS = {
  opening:     ["interchange", "curveRight", "roundabout"],
  crossroad:   ["interchange", "flyover", "curveLeft", "curveRight", "roundabout"],
  interchange: ["flyover", "crossroad", "tunnel", "roundabout"],
  roundabout:  ["crossroad", "interchange", "flyover", "tunnel"],
  flyover:     ["crossroad", "roundabout", "curveLeft", "curveRight"],
  tunnel:      ["crossroad", "interchange", "roundabout"],
  curveLeft:   ["crossroad", "interchange", "roundabout", "flyover", "tunnel"],
  curveRight:  ["crossroad", "interchange", "roundabout", "flyover", "tunnel"]
};

let _currentChunkName = "opening";
let _pendingSegments = [];
let _preferredChunks = [];
let _chunkStep = 0;

export function resetRoadGraph() {
  _currentChunkName = "opening";
  _pendingSegments = [...CHUNK_LIBRARY.opening];
  _preferredChunks = [];
  _chunkStep = 0;
}

/**
 * Called live when the player steers LEFT ("uptown") or RIGHT ("skyway") through a route split!
 */
export function selectCityRoute(routeKey) {
  const route = DISTRICT_ROUTES[routeKey];
  if (!route) return;
  _preferredChunks = [...route];
}

function chooseNextChunk(currentX) {
  // Follow the player's chosen city district route first!
  while (_preferredChunks.length > 0) {
    let pick = _preferredChunks.shift();
    if (pick === "curveRight" && currentX + CURVE_DELTA_X > MAX_ROAD_LATERAL_DRIFT) pick = "curveLeft";
    if (pick === "curveLeft" && currentX - CURVE_DELTA_X < -MAX_ROAD_LATERAL_DRIFT) pick = "curveRight";
    _currentChunkName = pick;
    _chunkStep++;
    return CHUNK_LIBRARY[pick] || CHUNK_LIBRARY.crossroad;
  }

  const candidates = TRANSITIONS[_currentChunkName] || TRANSITIONS.crossroad;
  const valid = [];
  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    if (name === "curveRight" && currentX + CURVE_DELTA_X > MAX_ROAD_LATERAL_DRIFT) continue;
    if (name === "curveLeft" && currentX - CURVE_DELTA_X < -MAX_ROAD_LATERAL_DRIFT) continue;
    if (_chunkStep < 1 && (name === "tunnel" || name === "flyover")) continue;
    valid.push(name);
  }

  const pool = valid.length > 0 ? valid : ["crossroad"];
  const pickIdx = (_chunkStep + Math.floor(Math.random() * pool.length)) % pool.length;
  _currentChunkName = pool[pickIdx];
  _chunkStep++;

  return CHUNK_LIBRARY[_currentChunkName] || CHUNK_LIBRARY.crossroad;
}

export function getNextRoadSegmentType(currentX = 0) {
  if (_pendingSegments.length === 0) {
    const nextChunk = chooseNextChunk(currentX);
    for (let i = 0; i < nextChunk.length; i++) {
      _pendingSegments.push(nextChunk[i]);
    }
  }
  return _pendingSegments.shift();
}
