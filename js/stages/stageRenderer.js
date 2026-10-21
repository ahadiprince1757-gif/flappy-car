import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { gameState } from "../core/gameState.js";
import { getStageConfig } from "./stages.js";
import { createBackground, updateBackground } from "./backgrounds.js";

/*
 * CONTINUOUS HIGHWAY ROAD RENDERER
 *
 * Coordinate convention:
 *   - Player drives towards negative Z.
 *   - Negative Z is ahead into the distance.
 *   - Positive Z is behind the camera.
 *   - The road ribbon is fixed in world space along the mathematical curve.
 *   - Textures, lane dashes, and roadside props scroll forward to create speed.
 *   - Guarantees 100% mathematical alignment between road, curbs, obstacles, and player.
 */

export const ROAD_WIDTH = 10.8; // 3 lanes of 3.6m each
export const LANE_CENTERS = [-3.6, 0, 3.6];
export const MARKING_OFFSETS = [-1.8, 1.8];

const TRACK_START_Z = 20;
const TRACK_END_Z = -260;
const TRACK_LENGTH = TRACK_START_Z - TRACK_END_Z; // 280m
const LONGITUDINAL_SEGMENTS = 80; // Reduced from 200 — still smooth, much less geometry

export function getRoadHeight(z) {
  // Ultra-smooth gentle crest along track (peak 0.45m at mid-track, zero slope at endpoints)
  // Guarantees y >= 0 everywhere so road surface never sinks or clips into ground plane
  const theta = (Math.PI * 2 * (z - TRACK_START_Z)) / TRACK_LENGTH;
  return 0.22 * (1 - Math.cos(theta));
}

export function getRoadSlope(z) {
  const step = 0.5;
  return (getRoadHeight(z + step) - getRoadHeight(z - step)) / (2 * step);
}

export function getRoadX(z) {
  // Majestic, smooth highway sweeping curve
  // Straight along immediate starting zone and perfectly continuous across wrap-around
  const theta = (Math.PI * 2 * (z - TRACK_START_Z)) / TRACK_LENGTH;
  return 2.4 * Math.sin(theta) - 1.2 * Math.sin(2 * theta);
}

export function getRoadHeading(z) {
  const step = 0.5;
  const dx = getRoadX(z + step) - getRoadX(z - step);
  return Math.atan2(-dx, 2 * step);
}

export function getRoadPoint(z, lateralOffset = 0) {
  const heading = getRoadHeading(z);
  const slope = getRoadSlope(z);

  return {
    x: getRoadX(z) + lateralOffset * Math.cos(heading),
    y: getRoadHeight(z),
    z: z - lateralOffset * Math.sin(heading),
    heading,
    slope
  };
}

/* ── Procedural Canvas Textures for Highway Surfaces ─────────── */
function createAsphaltTexture(roadColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = roadColor || "#1e293b";
  ctx.fillRect(0, 0, 128, 256);

  // Subtle tarmac grain noise
  const imgData = ctx.getImageData(0, 0, 128, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Faint tire track paths in lanes
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(16, 0, 14, 256);
  ctx.fillRect(36, 0, 14, 256);
  ctx.fillRect(58, 0, 14, 256);
  ctx.fillRect(78, 0, 14, 256);
  ctx.fillRect(98, 0, 14, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 40);
  return texture;
}

function createCurbTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Alternating red and white racing curb stripes
  ctx.fillStyle = "#e11d48";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 64, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 50);
  return texture;
}

function createSidewalkTexture(sidewalkColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = sidewalkColor || "#94a3b8";
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 60, 60);
  ctx.strokeRect(66, 2, 60, 60);
  ctx.strokeRect(2, 66, 60, 60);
  ctx.strokeRect(66, 66, 60, 60);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 35);
  return texture;
}

/* ── Continuous Ribbon Geometry Builder ───────────────────────── */
function buildContinuousStripGeometry(startZ, endZ, segmentsZ, lateralOffset, width, heightOffset = 0, uRepeat = 1, vRepeat = 1) {
  const positions = [];
  const uvs = [];
  const indices = [];

  const totalLength = startZ - endZ;
  const halfWidth = width / 2;
  const lateralSegments = 2;

  for (let zi = 0; zi <= segmentsZ; zi++) {
    const fraction = zi / segmentsZ;
    const roadZ = startZ - fraction * totalLength;

    for (let xi = 0; xi <= lateralSegments; xi++) {
      const latFraction = xi / lateralSegments;
      const lateral = -halfWidth + width * latFraction;
      const vertex = getRoadPoint(roadZ, lateralOffset + lateral);

      positions.push(
        vertex.x,
        vertex.y + heightOffset,
        vertex.z
      );

      uvs.push(
        latFraction * uRepeat,
        fraction * vRepeat
      );
    }
  }

  const rowSize = lateralSegments + 1;
  for (let zi = 0; zi < segmentsZ; zi++) {
    for (let xi = 0; xi < lateralSegments; xi++) {
      const a = zi * rowSize + xi;
      const b = a + 1;
      const c = a + rowSize;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createMeshStrip(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/* ── Dashed White Lane Divider Markings ────────────────────────── */
function createLaneDashes(stage, parent) {
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#ffffff",
    emissiveIntensity: 0.12,
    roughness: 0.5
  });

  const dashes = [];
  const dashCount = 24; // Reduced from 40 — less per-frame updates
  const spacing = TRACK_LENGTH / dashCount; // 7m spacing

  for (const offset of MARKING_OFFSETS) {
    for (let i = 0; i < dashCount; i++) {
      const roadZ = TRACK_START_Z - i * spacing;
      const pt = getRoadPoint(roadZ, offset);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 2.8),
        material
      );

      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pt.x, pt.y + 0.055, pt.z);
      mesh.rotation.set(-Math.PI / 2 - Math.atan(pt.slope), 0, pt.heading);
      mesh.receiveShadow = true;

      mesh.userData.roadZ = roadZ;
      mesh.userData.laneOffset = offset;

      parent.add(mesh);
      dashes.push(mesh);
    }
  }

  return { dashes, material };
}

/* ── Roadside Posts along Sidewalk Edges ──────────────────────── */
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

  const posts = [];
  const postCount = 10; // Reduced from 16 — less per-frame updates
  const postSpacing = TRACK_LENGTH / postCount; // 17.5m

  for (let i = 0; i < postCount; i++) {
    const roadZ = TRACK_START_Z - i * postSpacing;

    for (const side of [-1, 1]) {
      const lateralOffset = side * 5.9; // Just outside the rumble curb
      const pt = getRoadPoint(roadZ, lateralOffset);

      const postGroup = new THREE.Group();

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.75, 8),
        postMaterial
      );
      stem.position.y = 0.375;
      stem.castShadow = true;

      const reflector = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, 0.12),
        reflectorMaterial
      );
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

  return { posts, materials: [postMaterial, reflectorMaterial] };
}

/* ── Create Complete Stage System ─────────────────────────────── */
export function createStage(stageId = "city") {
  if (!gameState.scene) {
    throw new Error("Initialize the scene before creating a stage.");
  }

  removeStage();

  const config = getStageConfig(stageId);
  const group = new THREE.Group();
  group.name = `stage-${stageId}`;

  // Procedural textures
  const asphaltTex = createAsphaltTexture(config.roadColor);
  const curbTex = createCurbTexture();
  const sidewalkTex = createSidewalkTexture(config.sidewalkColor);

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.88,
    metalness: 0.06,
    side: THREE.DoubleSide
  });

  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.85,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  const edgeLineMat = new THREE.MeshStandardMaterial({
    color: config.laneColor || "#ffffff",
    emissive: config.laneColor || "#ffffff",
    emissiveIntensity: 0.15,
    roughness: 0.5,
    side: THREE.DoubleSide
  });

  // 1. Continuous Asphalt Strip (10.8m wide, 3 lanes)
  const asphaltGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    0, ROAD_WIDTH, 0.04, 1, 40
  );
  group.add(createMeshStrip(asphaltGeo, asphaltMat));

  // 2. White Edge Lines (0.16m wide at ±5.32m)
  const leftEdgeGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    -5.32, 0.16, 0.055, 1, 1
  );
  group.add(createMeshStrip(leftEdgeGeo, edgeLineMat));

  const rightEdgeGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    5.32, 0.16, 0.055, 1, 1
  );
  group.add(createMeshStrip(rightEdgeGeo, edgeLineMat));

  // 3. Red & White Rumble Curbs (0.4m wide at ±5.6m, raised +0.075m)
  const leftCurbGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    -5.6, 0.4, 0.075, 1, 50
  );
  group.add(createMeshStrip(leftCurbGeo, curbMat));

  const rightCurbGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    5.6, 0.4, 0.075, 1, 50
  );
  group.add(createMeshStrip(rightCurbGeo, curbMat));

  // 4. Sidewalks (2.8m wide at ±7.2m, raised +0.09m)
  const leftSidewalkGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    -7.2, 2.8, 0.09, 1, 35
  );
  group.add(createMeshStrip(leftSidewalkGeo, sidewalkMat));

  const rightSidewalkGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    7.2, 2.8, 0.09, 1, 35
  );
  group.add(createMeshStrip(rightSidewalkGeo, sidewalkMat));

  // 4b. Smooth Roadside Shoulder / Verge Strip (2.6m wide at ±9.9m, raised +0.02m)
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: config.groundColor || "#475569",
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  const leftShoulderGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    -9.9, 2.6, 0.02, 1, 10
  );
  group.add(createMeshStrip(leftShoulderGeo, shoulderMat));

  const rightShoulderGeo = buildContinuousStripGeometry(
    TRACK_START_Z, TRACK_END_Z, LONGITUDINAL_SEGMENTS,
    9.9, 2.6, 0.02, 1, 10
  );
  group.add(createMeshStrip(rightShoulderGeo, shoulderMat));

  // 5. Dynamic Scrolling Lane Dashes
  const dashesData = createLaneDashes(config, group);

  // 6. Dynamic Roadside Reflector Posts
  const postData = createRoadsidePosts(config, group);

  // 7. Scenery Background (City buildings, trees, lamps, sky dome)
  const background = createBackground(stageId);
  group.add(background);

  gameState.scene.add(group);
  gameState.scene.background = new THREE.Color(config.skyColor);

  // Realistic atmospheric horizon depth fog: road & props smoothly fade into the mist
  if (!gameState.scene.fog) {
    gameState.scene.fog = new THREE.Fog(config.fogColor, 35, 115);
  } else {
    gameState.scene.fog.color.set(config.fogColor);
    gameState.scene.fog.near = 35;
    gameState.scene.fog.far = 115;
  }

  gameState.road = {
    group,
    background,
    stageId,
    config,
    asphaltTex,
    curbTex,
    sidewalkTex,
    markings: dashesData.dashes,
    markingMat: dashesData.material,
    posts: postData.posts,
    postMats: postData.materials,
    geometries: [
      asphaltGeo,
      leftEdgeGeo,
      rightEdgeGeo,
      leftCurbGeo,
      rightCurbGeo,
      leftSidewalkGeo,
      rightSidewalkGeo,
      leftShoulderGeo,
      rightShoulderGeo
    ],
    materials: [
      asphaltMat,
      curbMat,
      sidewalkMat,
      shoulderMat,
      edgeLineMat,
      dashesData.material,
      ...postData.materials
    ],
    textures: [asphaltTex, curbTex, sidewalkTex]
  };

  gameState.selectedStage = stageId;
  return gameState.road;
}

/* ── Update Stage per Frame ───────────────────────────────────── */
export function updateStage(deltaTime) {
  const road = gameState.road;
  if (!road || gameState.status !== "playing") return;

  const movement = Math.max(0, gameState.speed) * deltaTime;

  // 1. Smooth Highway Texture Scrolling with exact physical repeats
  if (road.asphaltTex) road.asphaltTex.offset.y -= movement / (TRACK_LENGTH / 40);
  if (road.curbTex) road.curbTex.offset.y -= movement / (TRACK_LENGTH / 50);
  if (road.sidewalkTex) road.sidewalkTex.offset.y -= movement / (TRACK_LENGTH / 35);

  // 2. Scroll Lane Dashes smoothly along curve
  for (const dash of road.markings) {
    dash.userData.roadZ += movement;

    if (dash.userData.roadZ > TRACK_START_Z) {
      dash.userData.roadZ -= TRACK_LENGTH;
    }

    const pt = getRoadPoint(dash.userData.roadZ, dash.userData.laneOffset);
    dash.position.set(pt.x, pt.y + 0.055, pt.z);
    dash.rotation.set(-Math.PI / 2 - Math.atan(pt.slope), 0, pt.heading);
  }

  // 3. Scroll Roadside Posts along sidewalk
  for (const post of road.posts) {
    post.userData.roadZ += movement;

    if (post.userData.roadZ > TRACK_START_Z) {
      post.userData.roadZ -= TRACK_LENGTH;
    }

    const pt = getRoadPoint(post.userData.roadZ, post.userData.lateralOffset);
    post.position.set(pt.x, pt.y + 0.08, pt.z);
    post.rotation.y = pt.heading;
  }

  // 4. Scroll Scenery along road curve
  updateBackground(road.background, deltaTime, gameState.speed);

  // 5. Update odometer
  gameState.distance += movement;
}

/* ── Clean Resource Teardown ──────────────────────────────────── */
export function removeStage() {
  const road = gameState.road;
  if (!road) return;

  gameState.scene?.remove(road.group);

  if (road.geometries) {
    for (const geo of road.geometries) geo?.dispose();
  }

  if (road.materials) {
    for (const mat of road.materials) mat?.dispose();
  }

  if (road.textures) {
    for (const tex of road.textures) tex?.dispose();
  }

  road.group.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const m of mats) m?.dispose();
  });

  gameState.road = null;
}