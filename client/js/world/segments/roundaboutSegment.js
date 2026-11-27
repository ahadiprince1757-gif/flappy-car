import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import { buildSegmentStripGeometry, createRoadSegment } from "../roadSegment.js";

/* ================================================================
   SEAMLESS PROCEDURAL CITY ROUNDABOUT PLAZA (60m)
   - ZERO curbs or sidewalks slicing through the roundabout!
   - One continuous dark tarmac plaza matching the exact highway shader.
   - Smooth curved road spline guides all 5 lanes cleanly around the
     illuminated landscaped circular island while West & East avenues
     merge seamlessly into the circular plaza ring!
================================================================ */

const ROUNDABOUT_LENGTH = 60;
const ROUNDABOUT_SWEEP_X = 11.4;
const ISLAND_CENTER_X = -4.8;
const ISLAND_CENTER_Z = -30;

let _sharedRoundaboutExtras = null;

function sampleRoundaboutProfile(t, out) {
  const twoPiT = Math.PI * 2 * t;
  out.x = ROUNDABOUT_SWEEP_X * 0.5 * (1 - Math.cos(twoPiT));
  out.y = 0;

  const dxDt = ROUNDABOUT_SWEEP_X * Math.PI * Math.sin(twoPiT);
  out.heading = Math.atan2(-dxDt / ROUNDABOUT_LENGTH, 1);
  out.slope = 0;
  return out;
}

function createRoundaboutDashDecalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 512);

  // Two crisp concentric white dashed roundabout lane rings
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 4;
  ctx.setLineDash([22, 22]);
  ctx.beginPath();
  ctx.arc(256, 256, 155, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 256, 205, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedRoundaboutExtras() {
  if (_sharedRoundaboutExtras) return _sharedRoundaboutExtras;

  const dashTex = createRoundaboutDashDecalTexture();

  _sharedRoundaboutExtras = {
    dashDecalMat: new THREE.MeshStandardMaterial({
      map: dashTex,
      transparent: true,
      roughness: 0.5,
      depthWrite: false
    }),
    islandCurb: new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.68,
      metalness: 0.12
    }),
    islandLawn: new THREE.MeshStandardMaterial({
      color: "#15803d",
      roughness: 0.9,
      metalness: 0.04
    }),
    treeTrunk: new THREE.MeshStandardMaterial({
      color: "#78350f",
      roughness: 0.9
    }),
    treeFoliage: new THREE.MeshStandardMaterial({
      color: "#16a34a",
      roughness: 0.8
    }),
    neonRing: new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      emissive: "#0ea5e9",
      emissiveIntensity: 1.6,
      roughness: 0.25
    }),
    monument: new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      metalness: 0.8,
      roughness: 0.22
    })
  };
  return _sharedRoundaboutExtras;
}

export function createRoundabout(materials, options = {}) {
  const {
    outerRadius = 25.5,
    islandRadius = 6.2,
    segments = 36
  } = options;

  const group = new THREE.Group();
  group.name = "road-seg-roundabout";
  const customTargets = [];
  const extras = getSharedRoundaboutExtras();

  const addTracked = (geo, mat, matKey, pos, rotX = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rotX) mesh.rotation.x = rotX;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (matKey) customTargets.push({ mesh, matKey });
    return mesh;
  };

  // 1. Entry & Exit Straight Apron Stubs (z: 0..-9 and z: -51..-60) seamlessly matching main road
  const stubGeo = buildSegmentStripGeometry({
    length: 10, segmentsZ: 2, lateralOffset: 0, width: ROAD_WIDTH,
    heightOffset: 0.04, uRepeat: 1, vRepeat: 10 / 16,
    profileFn: (t, out) => { out.x = 0; out.y = 0; out.heading = 0; out.slope = 0; }
  });
  addTracked(stubGeo, materials.asphaltMat, "asphaltMat", [0, 0, 0]);
  addTracked(stubGeo, materials.asphaltMat, "asphaltMat", [0, 0, -50]);

  // 2. Unified Continuous Circular Asphalt Plaza (exact y = 0.04, unified plainAsphaltMat — ZERO seams!)
  const ringGeo = new THREE.RingGeometry(islandRadius - 0.2, outerRadius, segments);
  addTracked(ringGeo, materials.plainAsphaltMat, "plainAsphaltMat", [ISLAND_CENTER_X, 0.04, ISLAND_CENTER_Z], -Math.PI / 2);

  // Subtle curved asphalt blend strips connecting entry/exit smoothly into the ring
  const blendGeo = buildSegmentStripGeometry({
    length: ROUNDABOUT_LENGTH, segmentsZ: 18, lateralOffset: 0, width: ROAD_WIDTH,
    heightOffset: 0.042, uRepeat: 1, vRepeat: 1, profileFn: sampleRoundaboutProfile
  });
  addTracked(blendGeo, materials.plainAsphaltMat, "plainAsphaltMat", [0, 0, 0]);

  // Subtle concentric white dashed lane ring decal at y = 0.052 (zero Z-fighting)
  const decalGeo = new THREE.PlaneGeometry(outerRadius * 1.9, outerRadius * 1.9);
  const decal = new THREE.Mesh(decalGeo, extras.dashDecalMat);
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(ISLAND_CENTER_X, 0.052, ISLAND_CENTER_Z);
  group.add(decal);

  // 3. Seamless Connecting West & East City Avenues (same unified avenueMat at exact y = 0.04!)
  const aveLen = 78;
  const aveW = 16.5;
  const aveGeo = new THREE.PlaneGeometry(aveLen, aveW);
  addTracked(aveGeo, materials.avenueMat, "avenueMat", [ISLAND_CENTER_X - outerRadius - aveLen * 0.5 + 2, 0.04, ISLAND_CENTER_Z], -Math.PI / 2);
  addTracked(aveGeo, materials.avenueMat, "avenueMat", [ISLAND_CENTER_X + outerRadius + aveLen * 0.5 - 2, 0.04, ISLAND_CENTER_Z], -Math.PI / 2);

  // Sidewalks framing West & East avenues cleanly outside the circular plaza
  const aveSwGeo = new THREE.PlaneGeometry(aveLen, 3.2);
  for (const sideZ of [-1, 1]) {
    addTracked(aveSwGeo, materials.sidewalkMat, "sidewalkMat", [ISLAND_CENTER_X - outerRadius - aveLen * 0.5 + 2, 0.085, ISLAND_CENTER_Z + sideZ * (aveW * 0.5 + 1.6)], -Math.PI / 2);
    addTracked(aveSwGeo, materials.sidewalkMat, "sidewalkMat", [ISLAND_CENTER_X + outerRadius + aveLen * 0.5 - 2, 0.085, ISLAND_CENTER_Z + sideZ * (aveW * 0.5 + 1.6)], -Math.PI / 2);
  }

  // 4. Outer Circular Stone Curb Ring Framing the Plaza (broken cleanly at entrances/exits via 4 arcs!)
  const arcSpan = Math.PI * 0.28;
  const arcAngles = [Math.PI * 0.11, Math.PI * 0.61, Math.PI * 1.11, Math.PI * 1.61];
  for (const startAngle of arcAngles) {
    const outerSwGeo = new THREE.RingGeometry(outerRadius, outerRadius + 3.2, 10, 1, startAngle, arcSpan);
    addTracked(outerSwGeo, materials.sidewalkMat, "sidewalkMat", [ISLAND_CENTER_X, 0.085, ISLAND_CENTER_Z], -Math.PI / 2);
  }

  // 5. Landscaped Central Roundabout Island (stone curb, lawn, trees, architectural centerpiece)
  const islandGroup = new THREE.Group();
  islandGroup.position.set(ISLAND_CENTER_X, 0, ISLAND_CENTER_Z);

  const curbMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(islandRadius, islandRadius + 0.3, 0.42, 28),
    extras.islandCurb
  );
  curbMesh.position.y = 0.21;
  curbMesh.receiveShadow = true;

  const lawnMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(islandRadius - 0.35, islandRadius - 0.35, 0.46, 28),
    extras.islandLawn
  );
  lawnMesh.position.y = 0.23;

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(islandRadius + 0.04, 0.06, 8, 36),
    extras.neonRing
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.44;

  // Sleek tapered city landmark sculpture in center
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.9, 12), extras.islandCurb);
  plinth.position.y = 0.7;
  const spire = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), extras.monument);
  spire.scale.set(1, 3.2, 1);
  spire.position.y = 4.2;

  // 3 ornamental park trees nestled on the roundabout island
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.8, 6);
  const foliageGeo = new THREE.ConeGeometry(1.15, 2.8, 8);
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3 + 0.4;
    const tx = Math.cos(ang) * 3.4;
    const tz = Math.sin(ang) * 3.4;
    const tr = new THREE.Mesh(trunkGeo, extras.treeTrunk);
    tr.position.set(tx, 1.3, tz);
    const fl = new THREE.Mesh(foliageGeo, extras.treeFoliage);
    fl.position.set(tx, 3.2, tz);
    islandGroup.add(tr, fl);
  }

  islandGroup.add(curbMesh, lawnMesh, halo, plinth, spire);
  group.add(islandGroup);

  group.userData.customMatTargets = customTargets;

  const seg = createRoadSegment({
    type: "roundabout",
    length: ROUNDABOUT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual: group,
    sampleLocalProfile: sampleRoundaboutProfile
  });

  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -4;
  seg.crossStreetLocalEnd = -56;
  return seg;
}

export function createRoundaboutSegment(materials) {
  return createRoundabout(materials);
}
