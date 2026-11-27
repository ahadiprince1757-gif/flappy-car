import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { getStageConfig } from "./stages.js";
import { createBackground, updateBackground } from "./backgrounds.js";
import { showHUDMessage } from "../ui/hud.js";

import {
  ROAD_WIDTH,
  LANE_CENTERS,
  MARKING_OFFSETS,
  STREAM_BEHIND_Z,
  STREAM_AHEAD_Z
} from "../world/roadConstants.js";
import { getRoadMaterials } from "../world/roadMaterials.js";
import { placeSegmentAt } from "../world/roadSegment.js";
import { initRoadPool, acquireSegment, releaseSegment, releaseAllSegments } from "../world/roadPool.js";
import { resetRoadGraph, getNextRoadSegmentType } from "../world/roadGraph.js";
import { resetTunnelCulling } from "../world/tunnelCuller.js";
import {
  setActiveRoadSegments,
  queryRoadPoint,
  queryRoadHeight,
  queryRoadSlope,
  queryRoadX,
  queryRoadHeading,
  isCrossStreetZone
} from "../world/roadQuery.js";

// Re-export road dimension constants for backwards compatibility across all subsystems
export { ROAD_WIDTH, LANE_CENTERS, MARKING_OFFSETS };

// Continuous dynamic environment progression (every 1000m)
export const STAGE_PROGRESSION = [
  { id: "city",     name: "Metropolis City",   startDist: 0 },
  { id: "beach",    name: "Sunset Coast",      startDist: 1000 },
  { id: "desert",   name: "Dune Canyon",       startDist: 2000 },
  { id: "jungle",   name: "Rainforest Trail",  startDist: 3000 },
  { id: "savannah", name: "African Savannah",  startDist: 4000 },
  { id: "village",  name: "Alpine Resort",     startDist: 5000 }
];

let lastAnnouncedStageIdx = -1;

const TRACK_START_Z = 20;
const TRACK_END_Z = -260;
const TRACK_LENGTH = TRACK_START_Z - TRACK_END_Z; // 280m

/* ── Backwards-Compatible Road Query Adapter ─────────────────── */
export function getRoadHeight(z) {
  return queryRoadHeight(z);
}

export function getRoadSlope(z) {
  return queryRoadSlope(z);
}

export function getRoadX(z) {
  return queryRoadX(z);
}

export function getRoadHeading(z) {
  return queryRoadHeading(z);
}

export function getRoadPoint(z, lateralOffset = 0, out = null) {
  return queryRoadPoint(z, lateralOffset, out);
}

/* ── Road Network Graph Sequencer (Chunk-based city connections) ── */
function pickNextSegmentType(currentX) {
  return getNextRoadSegmentType(currentX);
}

/* ── Roadside Reflector Posts along Sidewalk Edges ────────────── */
function createRoadsidePosts(stage, parent) {
  const postMaterial = new THREE.MeshStandardMaterial({
    color: "#cbd5e1",
    roughness: 0.6,
    metalness: 0.4
  });

  const reflectorMaterial = new THREE.MeshStandardMaterial({
    color: stage.laneColor || "#ffffff",
    emissive: stage.laneColor || "#ffffff",
    emissiveIntensity: 0.6,
    roughness: 0.3
  });

  const stemGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.75, 6);
  const reflectorGeo = new THREE.BoxGeometry(0.12, 0.14, 0.12);

  const posts = [];
  const postCount = 10;
  const postSpacing = TRACK_LENGTH / postCount;

  for (let i = 0; i < postCount; i++) {
    const roadZ = TRACK_START_Z - i * postSpacing;

    for (const side of [-1, 1]) {
      const lateralOffset = side * 9.6;
      const pt = getRoadPoint(roadZ, lateralOffset);

      const postGroup = new THREE.Group();

      const stem = new THREE.Mesh(stemGeo, postMaterial);
      stem.position.y = 0.375;

      const reflector = new THREE.Mesh(reflectorGeo, reflectorMaterial);
      reflector.position.y = 0.62;

      postGroup.add(stem, reflector);
      postGroup.position.set(pt.x, pt.y + 0.08, pt.z);
      postGroup.rotation.y = pt.heading;

      postGroup.userData.roadZ = roadZ;
      postGroup.userData.lateralOffset = lateralOffset;

      parent.add(postGroup);
      posts.push(postGroup);
    }
  }

  return {
    posts,
    geometries: [stemGeo, reflectorGeo],
    materials: [postMaterial, reflectorMaterial]
  };
}

/* ── Create Complete Stage System (Modular Pooled Segments) ───── */
export function createStage(stageId = "city") {
  if (!gameState.scene) {
    throw new Error("Initialize the scene before creating a stage.");
  }

  removeStage();

  const config = getStageConfig(stageId);
  const group = new THREE.Group();
  group.name = `stage-${stageId}`;

  // 1. Shared cached road materials (baked lane dashes — eliminates 96 dash draw calls!)
  const materials = getRoadMaterials(config);

  // 2. Pooled Modular Road Segments Group
  const roadSegmentsGroup = new THREE.Group();
  roadSegmentsGroup.name = "modular-road-segments";
  group.add(roadSegmentsGroup);

  initRoadPool(roadSegmentsGroup, materials);

  const activeSegments = [];
  resetRoadGraph();
  resetTunnelCulling();

  // Populate initial sliding window from +36m behind player out to -300m ahead
  let cursorX = 0;
  let cursorY = 0;
  let cursorZ = STREAM_BEHIND_Z;

  while (cursorZ > STREAM_AHEAD_Z) {
    const type = pickNextSegmentType(cursorX);
    const seg = acquireSegment(type);
    if (!seg) break;

    placeSegmentAt(seg, cursorX, cursorY, cursorZ, materials);
    activeSegments.push(seg);

    cursorX = seg.xEnd;
    cursorY = seg.yEnd;
    cursorZ = seg.zEnd;
  }

  // Register active segments with RoadQuery BEFORE creating posts & scenery
  setActiveRoadSegments(activeSegments);

  // 3. Dynamic Roadside Reflector Posts
  const postData = createRoadsidePosts(config, group);

  // 4. Scenery Background (City buildings, trees, lamps, sky dome)
  const background = createBackground(stageId);
  group.add(background);

  gameState.scene.add(group);
  gameState.scene.background = new THREE.Color(config.skyColor);

  // Realistic atmospheric horizon depth fog
  if (!gameState.scene.fog) {
    gameState.scene.fog = new THREE.Fog(config.fogColor, 35, 115);
  } else {
    gameState.scene.fog.color.set(config.fogColor);
    gameState.scene.fog.near = 35;
    gameState.scene.fog.far = 115;
  }

  _cachedStageColorIdx = -1;
  lastAnnouncedStageIdx = -1;

  gameState.road = {
    group,
    roadSegmentsGroup,
    activeSegments,
    materialsBundle: materials,
    background,
    stageId,
    config,
    posts: postData.posts,
    postGeometries: postData.geometries,
    postMats: postData.materials
  };

  gameState.selectedStage = stageId;
  return gameState.road;
}

const _stageRoadPt = { x: 0, y: 0, z: 0, heading: 0, slope: 0 };
const _currSkyColor = new THREE.Color();
const _nextSkyColor = new THREE.Color();
const _currFogColor = new THREE.Color();
const _nextFogColor = new THREE.Color();
const _targetSkyColor = new THREE.Color();
const _targetFogColor = new THREE.Color();
let _cachedStageColorIdx = -1;

/* ── Update Stage per Frame (Zero-GC Pooled Segment Streaming) ── */
export function updateStage(deltaTime) {
  const road = gameState.road;
  if (!road || gameState.status !== "playing") return;

  const movement = Math.max(0, gameState.speed) * deltaTime;
  const activeSegments = road.activeSegments;

  // 1. Scroll active pooled road segments forward (1:1 world speed — zero UV drift)
  for (let i = 0; i < activeSegments.length; i++) {
    const seg = activeSegments[i];
    seg.zStart += movement;
    seg.zEnd += movement;
    seg.entrances[0].z = seg.zStart;
    seg.exits[0].z = seg.zEnd;
    seg.visual.position.z = seg.zStart;
  }

  // 2. Recycle segments that passed behind the camera back into RoadPool
  while (activeSegments.length > 0 && activeSegments[0].zEnd > STREAM_BEHIND_Z) {
    const oldSeg = activeSegments.shift();
    releaseSegment(oldSeg);
  }

  // 3. Stream recycled segments ahead to keep the active horizon full
  if (activeSegments.length > 0) {
    let tail = activeSegments[activeSegments.length - 1];
    while (tail.zEnd > STREAM_AHEAD_Z) {
      const nextType = pickNextSegmentType(tail.xEnd);
      const nextSeg = acquireSegment(nextType);
      if (!nextSeg) break;

      placeSegmentAt(nextSeg, tail.xEnd, tail.yEnd, tail.zEnd, road.materialsBundle);
      activeSegments.push(nextSeg);
      tail = nextSeg;
    }
  }

  // 4. Scroll Roadside Posts along modular road curve (hide inside cross-streets & plazas)
  for (let i = 0; i < road.posts.length; i++) {
    const post = road.posts[i];
    post.userData.roadZ += movement;

    if (post.userData.roadZ > TRACK_START_Z) {
      post.userData.roadZ -= TRACK_LENGTH;
    }

    const inCross = isCrossStreetZone(post.userData.roadZ);
    post.visible = !inCross;
    if (!inCross) {
      const pt = getRoadPoint(post.userData.roadZ, post.userData.lateralOffset, _stageRoadPt);
      post.position.set(pt.x, pt.y + 0.08, pt.z);
      post.rotation.y = pt.heading;
    }
  }

  // 5. Scroll Scenery along modular road curve
  updateBackground(road.background, deltaTime, gameState.speed);

  // 6. Update odometer
  gameState.distance += movement;

  // 7. Dynamic In-Game Stage & Environment Progression
  updateDynamicStageProgression(road, deltaTime);
}

function updateDynamicStageProgression(road, deltaTime) {
  if (!gameState.scene || !gameState.scene.fog) return;

  const dist = gameState.distance || 0;
  const loopDist = dist % 6000;
  const stageIdx = Math.min(STAGE_PROGRESSION.length - 1, Math.floor(loopDist / 1000));
  const currentStageDef = STAGE_PROGRESSION[stageIdx];
  const nextStageDef = STAGE_PROGRESSION[(stageIdx + 1) % STAGE_PROGRESSION.length];

  // Announce newly reached environment via arcade HUD message
  if (stageIdx !== lastAnnouncedStageIdx) {
    lastAnnouncedStageIdx = stageIdx;
    gameState.selectedStage = currentStageDef.id;
    if (dist > 50) {
      showHUDMessage(`🏁 ENTERING ${currentStageDef.name.toUpperCase()}!`);
    }
  }

  // Only parse hex stage colors when the stage index changes (zero per-frame allocations)
  if (stageIdx !== _cachedStageColorIdx) {
    _cachedStageColorIdx = stageIdx;
    const stageConfig = getStageConfig(currentStageDef.id);
    const nextConfig = getStageConfig(nextStageDef.id);
    _currSkyColor.set(stageConfig.skyColor || "#7dd3fc");
    _currFogColor.set(stageConfig.fogColor || "#bae6fd");
    _nextSkyColor.set(nextConfig.skyColor || stageConfig.skyColor || "#7dd3fc");
    _nextFogColor.set(nextConfig.fogColor || stageConfig.fogColor || "#bae6fd");
  }

  const stageProgress = (loopDist % 1000) / 1000;
  const blendT = stageProgress > 0.7 ? (stageProgress - 0.7) / 0.3 : 0;

  _targetSkyColor.copy(_currSkyColor).lerp(_nextSkyColor, blendT);
  _targetFogColor.copy(_currFogColor).lerp(_nextFogColor, blendT);

  if (gameState.scene.background instanceof THREE.Color) {
    gameState.scene.background.lerp(_targetSkyColor, deltaTime * 2.0);
  }
  if (gameState.scene.fog) {
    gameState.scene.fog.color.lerp(_targetFogColor, deltaTime * 2.0);
  }
}

/* ── Clean Resource Teardown (Recycles Pooled Segments!) ──────── */
export function removeStage() {
  const road = gameState.road;
  if (!road) return;

  // Release all active road segments back into RoadPool (never dispose shared pooled geometries!)
  releaseAllSegments();
  setActiveRoadSegments([]);

  if (gameState.scene && road.group) {
    gameState.scene.remove(road.group);
  }

  // Dispose only stage-local post geometries/materials
  if (road.postGeometries) {
    for (const geo of road.postGeometries) {
      try { geo?.dispose(); } catch {}
    }
  }

  if (road.postMats) {
    for (const mat of road.postMats) {
      try { mat?.dispose(); } catch {}
    }
  }

  gameState.road = null;
}
