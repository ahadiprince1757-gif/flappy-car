import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { queryRoadPoint, isCrossStreetZone } from "./roadQuery.js";

/* ================================================================
   INSTANCED SCENERY & 4-TIER DISTANCE LOD MANAGER
   Replaces ~100+ individual streetlamp, reflector post, and distant
   skyline tower meshes with just 5 THREE.InstancedMesh draw calls!
   - Zero per-frame allocations (uses static scratch Object3D & roadPt).
   - Automatically hides instances inside cross-street / plaza zones.
================================================================ */

const _dummy = new THREE.Object3D();
const _hiddenScale = 0.0001;
const _roadPt = { x: 0, y: 0, z: 0, heading: 0, slope: 0 };

const POST_COUNT_PER_SIDE = 12;
const LAMP_COUNT_PER_SIDE = 8;
const SKYLINE_COUNT = 28;
const SPAN_START_Z = 20;
const SPAN_LENGTH = 260;

export function createInstancedScenery(stageConfig) {
  const group = new THREE.Group();
  group.name = "instanced-scenery-lod";

  // ── 1. Instanced Roadside Reflector Posts (2 draw calls for 24 posts) ──
  const totalPosts = POST_COUNT_PER_SIDE * 2;
  const postStemGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.75, 6);
  const postStemMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.6, metalness: 0.4 });
  const postRefGeo = new THREE.BoxGeometry(0.12, 0.14, 0.12);
  const postRefMat = new THREE.MeshStandardMaterial({
    color: stageConfig?.laneColor || "#ffffff",
    emissive: stageConfig?.laneColor || "#38bdf8",
    emissiveIntensity: 0.7,
    roughness: 0.3
  });

  const postStems = new THREE.InstancedMesh(postStemGeo, postStemMat, totalPosts);
  const postRefs = new THREE.InstancedMesh(postRefGeo, postRefMat, totalPosts);
  postStems.frustumCulled = false;
  postRefs.frustumCulled = false;

  const postEntries = [];
  const postSpacing = SPAN_LENGTH / POST_COUNT_PER_SIDE;
  for (let i = 0; i < POST_COUNT_PER_SIDE; i++) {
    const roadZ = SPAN_START_Z - i * postSpacing;
    postEntries.push({ roadZ, lat: -9.6 });
    postEntries.push({ roadZ, lat: 9.6 });
  }

  // ── 2. Instanced Highway Streetlamps (2 draw calls for 16 lamps) ──
  const totalLamps = LAMP_COUNT_PER_SIDE * 2;
  const lampPoleGeo = new THREE.CylinderGeometry(0.06, 0.11, 5.4, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.35, metalness: 0.8 });
  const lampBulbGeo = new THREE.BoxGeometry(0.65, 0.08, 0.2);
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: "#fef08a",
    emissive: "#fef08a",
    emissiveIntensity: 2.6
  });

  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, totalLamps);
  const lampBulbs = new THREE.InstancedMesh(lampBulbGeo, lampBulbMat, totalLamps);
  lampPoles.frustumCulled = false;
  lampBulbs.frustumCulled = false;

  const lampEntries = [];
  const lampSpacing = SPAN_LENGTH / LAMP_COUNT_PER_SIDE;
  for (let i = 0; i < LAMP_COUNT_PER_SIDE; i++) {
    const roadZ = SPAN_START_Z - i * lampSpacing;
    lampEntries.push({ roadZ, side: -1, lat: -9.4 });
    lampEntries.push({ roadZ, side: 1, lat: 9.4 });
  }

  // ── 3. Instanced Far City Skyline Silhouette Towers (Tier-3 LOD: 1 draw call!) ──
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshStandardMaterial({
    color: stageConfig?.buildingColors?.[0] || "#1e293b",
    roughness: 0.85,
    metalness: 0.15
  });
  const skylineTowers = new THREE.InstancedMesh(towerGeo, towerMat, SKYLINE_COUNT);
  skylineTowers.frustumCulled = false;

  const skylineEntries = [];
  const skySpacing = SPAN_LENGTH / (SKYLINE_COUNT / 2);
  for (let i = 0; i < SKYLINE_COUNT / 2; i++) {
    const roadZ = SPAN_START_Z - i * skySpacing;
    const hL = 22 + ((i * 17) % 28);
    const hR = 24 + ((i * 23) % 30);
    skylineEntries.push({ roadZ, lat: -44 - (i % 3) * 8, w: 11 + (i % 4) * 2, h: hL, d: 11 });
    skylineEntries.push({ roadZ: roadZ - 6, lat: 44 + (i % 3) * 8, w: 11 + (i % 3) * 2, h: hR, d: 11 });
  }

  group.add(postStems, postRefs, lampPoles, lampBulbs, skylineTowers);

  const system = {
    group,
    postStems,
    postRefs,
    postEntries,
    lampPoles,
    lampBulbs,
    lampEntries,
    skylineTowers,
    skylineEntries,
    geometries: [postStemGeo, postRefGeo, lampPoleGeo, lampBulbGeo, towerGeo],
    materials: [postStemMat, postRefMat, lampPoleMat, lampBulbMat, towerMat]
  };

  // Position all instances initially
  updateInstancedScenery(system, 0, 160);
  return system;
}

export function updateInstancedScenery(system, movement, lodFarDist = 160) {
  if (!system) return;

  // 1. Update Instanced Reflector Posts
  const posts = system.postEntries;
  for (let i = 0; i < posts.length; i++) {
    const e = posts[i];
    e.roadZ += movement;
    if (e.roadZ > SPAN_START_Z) e.roadZ -= SPAN_LENGTH;

    const visible = e.roadZ > -lodFarDist && !isCrossStreetZone(e.roadZ);
    if (!visible) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(_hiddenScale);
      _dummy.updateMatrix();
      system.postStems.setMatrixAt(i, _dummy.matrix);
      system.postRefs.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    const pt = queryRoadPoint(e.roadZ, e.lat, _roadPt);
    _dummy.scale.set(1, 1, 1);
    _dummy.rotation.set(0, pt.heading, 0);
    _dummy.position.set(pt.x, pt.y + 0.45, pt.z);
    _dummy.updateMatrix();
    system.postStems.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(pt.x, pt.y + 0.72, pt.z);
    _dummy.updateMatrix();
    system.postRefs.setMatrixAt(i, _dummy.matrix);
  }
  system.postStems.instanceMatrix.needsUpdate = true;
  system.postRefs.instanceMatrix.needsUpdate = true;

  // 2. Update Instanced Streetlamps
  const lamps = system.lampEntries;
  for (let i = 0; i < lamps.length; i++) {
    const e = lamps[i];
    e.roadZ += movement;
    if (e.roadZ > SPAN_START_Z) e.roadZ -= SPAN_LENGTH;

    const visible = e.roadZ > -lodFarDist && !isCrossStreetZone(e.roadZ);
    if (!visible) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(_hiddenScale);
      _dummy.updateMatrix();
      system.lampPoles.setMatrixAt(i, _dummy.matrix);
      system.lampBulbs.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    const pt = queryRoadPoint(e.roadZ, e.lat, _roadPt);
    _dummy.scale.set(1, 1, 1);
    _dummy.rotation.set(0, pt.heading, 0);
    _dummy.position.set(pt.x, pt.y + 2.7, pt.z);
    _dummy.updateMatrix();
    system.lampPoles.setMatrixAt(i, _dummy.matrix);

    // Lamp fixture overhanging slightly toward road
    _dummy.position.set(pt.x - e.side * 0.55, pt.y + 5.35, pt.z);
    _dummy.updateMatrix();
    system.lampBulbs.setMatrixAt(i, _dummy.matrix);
  }
  system.lampPoles.instanceMatrix.needsUpdate = true;
  system.lampBulbs.instanceMatrix.needsUpdate = true;

  // 3. Update Instanced Far Skyline Silhouette Towers (Tier-3 LOD)
  const towers = system.skylineEntries;
  for (let i = 0; i < towers.length; i++) {
    const e = towers[i];
    e.roadZ += movement;
    if (e.roadZ > SPAN_START_Z) e.roadZ -= SPAN_LENGTH;

    const pt = queryRoadPoint(e.roadZ, e.lat, _roadPt);
    _dummy.rotation.set(0, pt.heading, 0);
    _dummy.scale.set(e.w, e.h, e.d);
    _dummy.position.set(pt.x, e.h * 0.5, pt.z);
    _dummy.updateMatrix();
    system.skylineTowers.setMatrixAt(i, _dummy.matrix);
  }
  system.skylineTowers.instanceMatrix.needsUpdate = true;
}

export function disposeInstancedScenery(system) {
  if (!system) return;
  for (const g of system.geometries || []) {
    try { g.dispose(); } catch {}
  }
  for (const m of system.materials || []) {
    try { m.dispose(); } catch {}
  }
}
