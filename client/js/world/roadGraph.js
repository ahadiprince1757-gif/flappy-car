import { MAX_ROAD_LATERAL_DRIFT, CURVE_DELTA_X } from "./roadConstants.js";

/* ================================================================
   CITY ROAD NETWORK GRAPH & CHUNK SEQUENCER
   Assembles reusable road chunks into a rich, interconnected city:
   - Chunk A (highway):     straight -> curve
   - Chunk B (crossroad):   straight -> 4-way junction -> straight
   - Chunk C (interchange): straight -> highway off-ramps & gantry
   - Chunk D (roundabout):  straight -> procedural roundabout plaza -> straight
   - Chunk E (flyover):     elevated overpass bridge over lower city avenue
   - Chunk F (tunnel):      underground lit city underpass tunnel
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

// Directed city network transition graph — every chunk flows smoothly into varied next chunks
const TRANSITIONS = {
  opening:     ["interchange", "curveRight", "roundabout"],
  crossroad:   ["interchange", "flyover", "curveLeft", "curveRight", "roundabout"],
  interchange: ["flyover", "crossroad", "tunnel", "curveLeft", "curveRight"],
  roundabout:  ["crossroad", "interchange", "flyover", "tunnel"],
  flyover:     ["crossroad", "roundabout", "curveLeft", "curveRight"],
  tunnel:      ["crossroad", "interchange", "roundabout"],
  curveLeft:   ["crossroad", "interchange", "roundabout", "flyover", "tunnel"],
  curveRight:  ["crossroad", "interchange", "roundabout", "flyover", "tunnel"]
};

let _currentChunkName = "opening";
let _pendingSegments = [];
let _chunkStep = 0;

export function resetRoadGraph() {
  _currentChunkName = "opening";
  _pendingSegments = [...CHUNK_LIBRARY.opening];
  _chunkStep = 0;
}

/**
 * Choose the next city chunk using the road graph while bounding lateral highway drift.
 */
function chooseNextChunk(currentX) {
  const candidates = TRANSITIONS[_currentChunkName] || TRANSITIONS.crossroad;

  // Filter out curve directions that would push road beyond safe lateral bounds
  const valid = [];
  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    if (name === "curveRight" && currentX + CURVE_DELTA_X > MAX_ROAD_LATERAL_DRIFT) continue;
    if (name === "curveLeft" && currentX - CURVE_DELTA_X < -MAX_ROAD_LATERAL_DRIFT) continue;
    // Keep major landmarks (roundabout, flyover, tunnel) well-paced
    if (_chunkStep < 2 && (name === "tunnel" || name === "flyover")) continue;
    valid.push(name);
  }

  const pool = valid.length > 0 ? valid : ["crossroad"];
  // Deterministic-feeling rich variety with slight randomness so every run feels alive
  const pickIdx = (_chunkStep + Math.floor(Math.random() * pool.length)) % pool.length;
  _currentChunkName = pool[pickIdx];
  _chunkStep++;

  return CHUNK_LIBRARY[_currentChunkName] || CHUNK_LIBRARY.crossroad;
}

/**
 * Pop the next modular RoadSegment type for the chunk streamer.
 */
export function getNextRoadSegmentType(currentX = 0) {
  if (_pendingSegments.length === 0) {
    const nextChunk = chooseNextChunk(currentX);
    for (let i = 0; i < nextChunk.length; i++) {
      _pendingSegments.push(nextChunk[i]);
    }
  }
  return _pendingSegments.shift();
}
