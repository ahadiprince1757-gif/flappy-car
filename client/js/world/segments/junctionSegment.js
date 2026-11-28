import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { SEGMENT_LENGTH, ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import { buildSegmentStripGeometry, createRoadSegment } from "../roadSegment.js";

/* ================================================================
   SEAMLESS INTERCONNECTED CITY JUNCTIONS & DRIVABLE ROUTE SPLITS
   - Zero overlapping curbs or sidewalks cutting across cross-streets!
   - Every asphalt surface shares the EXACT unified tarmac material so
     connected avenues merge invisibly like a real modern city.
   1. junction (4-Way City Crossroad, 40m):
      - Approach & exit curbs stop cleanly at the 4 rounded corners.
      - Open seamless intersection box with zebra crosswalks on all 4 sides
        and sleek dark-steel traffic lights on the corners.
   2. interchange (Drivable Boulevard Split & City Route Selector, 80m):
      - Road widens smoothly around a landscaped central splitter island
        with overhead highway gantry ("↖ UPTOWN PLAZA | EXPRESS SKYWAY ↗").
      - Driving Left or Right around the divider steers the upcoming
        RoadGraph directly into that city district!
================================================================ */

let _sharedJunctionDecals = null;

function sampleFlatProfile(t, out) {
  out.x = 0;
  out.y = 0;
  out.heading = 0;
  out.slope = 0;
  return out;
}

function createCrosswalkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(248, 250, 252, 0.88)";
  for (let x = 10; x < 246; x += 24) {
    ctx.fillRect(x, 8, 12, 48);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGantrySignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#064e3b";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);

  // Center split divider
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(256, 16);
  ctx.lineTo(256, 112);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillText("UPTOWN PLAZA", 128, 52);
  ctx.fillText("EXPRESS SKYWAY", 384, 52);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 32px system-ui, sans-serif";
  ctx.fillText("↖  LEFT LANES", 128, 98);
  ctx.fillText("RIGHT LANES  ↗", 384, 98);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTurnArrowsTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 76px system-ui, sans-serif";

  // Far-left lane (lane 0): glowing cyan Left Turn arrow
  ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
  ctx.fillText("↰", 52, 64);

  // Center lanes (1-3): crisp white Straight arrows
  ctx.fillStyle = "rgba(248, 250, 252, 0.72)";
  ctx.fillText("↑", 154, 64);
  ctx.fillText("↑", 256, 64);
  ctx.fillText("↑", 358, 64);

  // Far-right lane (lane 4): glowing cyan Right Turn arrow
  ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
  ctx.fillText("↱", 460, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedJunctionExtras() {
  if (_sharedJunctionDecals) return _sharedJunctionDecals;

  const cwTex = createCrosswalkTexture();
  const signTex = createGantrySignTexture();
  const arrowTex = createTurnArrowsTexture();

  _sharedJunctionDecals = {
    crosswalkMat: new THREE.MeshStandardMaterial({
      map: cwTex,
      transparent: true,
      roughness: 0.5,
      depthWrite: false
    }),
    turnArrowMat: new THREE.MeshStandardMaterial({
      map: arrowTex,
      emissiveMap: arrowTex,
      emissive: new THREE.Color("#38bdf8"),
      emissiveIntensity: 0.6,
      transparent: true,
      roughness: 0.4,
      depthWrite: false
    }),
    poleMat: new THREE.MeshStandardMaterial({
      color: "#1e293b",
      metalness: 0.78,
      roughness: 0.32
    }),
    housingMat: new THREE.MeshStandardMaterial({
      color: "#0f172a",
      metalness: 0.5,
      roughness: 0.5
    }),
    greenMat: new THREE.MeshStandardMaterial({
      color: "#22c55e",
      emissive: "#22c55e",
      emissiveIntensity: 3.0
    }),
    amberMat: new THREE.MeshStandardMaterial({
      color: "#f59e0b",
      emissive: "#f59e0b",
      emissiveIntensity: 0.8
    }),
    redMat: new THREE.MeshStandardMaterial({
      color: "#ef4444",
      emissive: "#ef4444",
      emissiveIntensity: 0.9
    }),
    curbStoneMat: new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.7,
      metalness: 0.1
    }),
    lawnMat: new THREE.MeshStandardMaterial({
      color: "#15803d",
      roughness: 0.9,
      metalness: 0.05
    }),
    chevronGlowMat: new THREE.MeshStandardMaterial({
      color: "#00efff",
      emissive: "#00efff",
      emissiveIntensity: 2.2
    }),
    signMat: new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.4,
      roughness: 0.35
    })
  };
  return _sharedJunctionDecals;
}

function addTrackedMesh(group, customTargets, geo, mat, matKey, pos, rotX = 0, rotY = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rotX) mesh.rotation.x = rotX;
  if (rotY) mesh.rotation.y = rotY;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (matKey) {
    customTargets.push({ mesh, matKey });
  }
  return mesh;
}

function buildTrafficLight(extras, x, z, dirX) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 6.0, 8), extras.poleMat);
  pole.position.y = 3.0;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.14), extras.poleMat);
  arm.position.set(dirX * 2.0, 5.75, 0);
  g.add(arm);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.3), extras.housingMat);
  head.position.set(dirX * 3.5, 5.3, 0);
  g.add(head);

  const lensGeo = new THREE.CircleGeometry(0.11, 8);
  const r = new THREE.Mesh(lensGeo, extras.redMat);
  r.position.set(dirX * 3.5, 5.62, 0.16);
  const a = new THREE.Mesh(lensGeo, extras.amberMat);
  a.position.set(dirX * 3.5, 5.3, 0.16);
  const gr = new THREE.Mesh(lensGeo, extras.greenMat);
  gr.position.set(dirX * 3.5, 4.98, 0.16);
  g.add(r, a, gr);

  return g;
}

/**
 * 1. SEAMLESS 4-WAY CITY CROSSROAD (40m)
 *    Main curbs & sidewalks cleanly stop at z = -11 and resume at z = -29,
 *    with rounded corner sidewalks merging seamlessly into the left/right city avenues!
 */
export function createJunctionSegment(materials) {
  const group = new THREE.Group();
  group.name = "road-seg-junction";
  const customTargets = [];
  const extras = getSharedJunctionExtras();

  const halfRoad = ROAD_WIDTH * 0.5; // 9.0m
  const stubLen = 11.0;              // z: 0..-11 (near) and z: -29..-40 (far)
  const crossW = 18.0;               // Clean 18m cross-avenue opening (z: -11..-29)

  // A. Near & Far Main Highway Approaches (with baked 5-lane lines)
  const stubGeo = buildSegmentStripGeometry({
    length: stubLen, segmentsZ: 2, lateralOffset: 0, width: ROAD_WIDTH,
    heightOffset: 0.04, uRepeat: 1, vRepeat: stubLen / 16, profileFn: sampleFlatProfile
  });
  addTrackedMesh(group, customTargets, stubGeo, materials.asphaltMat, "asphaltMat", [0, 0, 0]);
  addTrackedMesh(group, customTargets, stubGeo, materials.asphaltMat, "asphaltMat", [0, 0, -29]);

  // B. Seamless Center Intersection Box (exact same y = 0.04, unified plain tarmac — ZERO Z-fighting!)
  const centerGeo = new THREE.PlaneGeometry(ROAD_WIDTH, crossW);
  addTrackedMesh(group, customTargets, centerGeo, materials.plainAsphaltMat, "plainAsphaltMat", [0, 0.04, -20], -Math.PI / 2);

  // C. Connecting Left & Right City Avenues (starting cleanly at x = ±9m, exact y = 0.04!)
  const aveLen = 82;
  const aveGeo = new THREE.PlaneGeometry(aveLen, crossW);
  addTrackedMesh(group, customTargets, aveGeo, materials.avenueMat, "avenueMat", [-(halfRoad + aveLen * 0.5), 0.04, -20], -Math.PI / 2);
  addTrackedMesh(group, customTargets, aveGeo, materials.avenueMat, "avenueMat", [+(halfRoad + aveLen * 0.5), 0.04, -20], -Math.PI / 2);

  // D. Clean Non-Overlapping Corner Sidewalks & Curbs (ONLY outside the cross-street!)
  const mainSwGeo = new THREE.PlaneGeometry(4.0, stubLen);
  const mainCurbGeo = new THREE.BoxGeometry(0.45, 0.14, stubLen);
  const crossSwGeo = new THREE.PlaneGeometry(aveLen, 3.6);
  const crossCurbGeo = new THREE.BoxGeometry(aveLen, 0.14, 0.45);
  const cornerFilletGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.14, 12);

  for (const sideX of [-1, 1]) {
    for (const zCenter of [-stubLen * 0.5, -40 + stubLen * 0.5]) {
      // Main highway curb & sidewalk stubs
      addTrackedMesh(group, customTargets, mainCurbGeo, materials.curbMat, "curbMat", [sideX * (halfRoad + 0.22), 0.07, zCenter]);
      addTrackedMesh(group, customTargets, mainSwGeo, materials.sidewalkMat, "sidewalkMat", [sideX * (halfRoad + 2.45), 0.09, zCenter], -Math.PI / 2);
    }

    // Side-avenue north & south sidewalks & curbs (starting cleanly outside main highway)
    for (const sideZ of [-1, 1]) {
      const zEdge = -20 + sideZ * (crossW * 0.5);
      addTrackedMesh(group, customTargets, crossCurbGeo, materials.curbMat, "curbMat", [sideX * (halfRoad + aveLen * 0.5), 0.07, zEdge + sideZ * 0.22]);
      addTrackedMesh(group, customTargets, crossSwGeo, materials.sidewalkMat, "sidewalkMat", [sideX * (halfRoad + aveLen * 0.5), 0.09, zEdge + sideZ * 2.05], -Math.PI / 2);

      // Rounded stone corner fillet connecting main sidewalk to side-avenue sidewalk
      addTrackedMesh(group, customTargets, cornerFilletGeo, materials.curbMat, "curbMat", [sideX * (halfRoad + 1.8), 0.07, zEdge + sideZ * 1.8]);
    }
  }

  // E. Crisp Zebra Crosswalks on all 4 approaches of the intersection
  const cwMainGeo = new THREE.PlaneGeometry(ROAD_WIDTH - 1.2, 2.8);
  const cwSideGeo = new THREE.PlaneGeometry(crossW - 1.2, 2.8);
  const cwNear = new THREE.Mesh(cwMainGeo, extras.crosswalkMat);
  cwNear.rotation.x = -Math.PI / 2;
  cwNear.position.set(0, 0.055, -10.2);

  const cwFar = new THREE.Mesh(cwMainGeo, extras.crosswalkMat);
  cwFar.rotation.x = -Math.PI / 2;
  cwFar.position.set(0, 0.055, -29.8);

  const cwLeft = new THREE.Mesh(cwSideGeo, extras.crosswalkMat);
  cwLeft.rotation.x = -Math.PI / 2;
  cwLeft.rotation.z = Math.PI / 2;
  cwLeft.position.set(-halfRoad - 1.6, 0.055, -20);

  const cwRight = new THREE.Mesh(cwSideGeo, extras.crosswalkMat);
  cwRight.rotation.x = -Math.PI / 2;
  cwRight.rotation.z = Math.PI / 2;
  cwRight.position.set(halfRoad + 1.6, 0.055, -20);
  group.add(cwNear, cwFar, cwLeft, cwRight);

  // E2. Glowing Painted Turn-Lane Guide Arrows on approach (signals drivable Left/Right crossroad turns!)
  const arrowDecal = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH - 0.8, 4.6), extras.turnArrowMat);
  arrowDecal.rotation.x = -Math.PI / 2;
  arrowDecal.position.set(0, 0.056, -5.2);
  group.add(arrowDecal);

  // F. Sleek Modern Corner Traffic Signals
  group.add(buildTrafficLight(extras, -(halfRoad + 1.4), -30.2, 1));
  group.add(buildTrafficLight(extras, +(halfRoad + 1.4), -30.2, -1));

  group.userData.customMatTargets = customTargets;

  const seg = createRoadSegment({
    type: "junction",
    length: SEGMENT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual: group,
    sampleLocalProfile: sampleFlatProfile
  });

  seg.isCrossroadTurn = true;
  seg.turnTaken = false;
  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -6;
  seg.crossStreetLocalEnd = -34;
  return seg;
}

/**
 * 2. DRIVABLE BOULEVARD SPLIT & INTERACTIVE ROUTE SELECTOR (80m)
 *    Highway smoothly flares wide into two drivable city carriageways
 *    passing on either side of a landscaped central median island.
 *    Steer LEFT for Uptown Plaza / Roundabouts, or RIGHT for Express Skyway / Tunnels!
 */
const INTERCHANGE_LENGTH = 80;

export function createInterchangeSegment(materials) {
  const group = new THREE.Group();
  group.name = "road-seg-interchange";
  const customTargets = [];
  const extras = getSharedJunctionExtras();

  // Dynamic width profile: flares seamlessly from 18m -> 25m mid-split -> 18m
  const segsZ = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let zi = 0; zi <= segsZ; zi++) {
    const t = zi / segsZ;
    const zLocal = -t * INTERCHANGE_LENGTH;
    const flare = 3.6 * 0.5 * (1 - Math.cos(Math.PI * 2 * t)); // 0 -> +3.6m each side -> 0
    const halfW = ROAD_WIDTH * 0.5 + flare;

    positions.push(-halfW, 0.04, zLocal);
    uvs.push(0, t * (INTERCHANGE_LENGTH / 16));
    positions.push(+halfW, 0.04, zLocal);
    uvs.push(1, t * (INTERCHANGE_LENGTH / 16));
  }
  for (let zi = 0; zi < segsZ; zi++) {
    const a = zi * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const asphaltGeo = new THREE.BufferGeometry();
  asphaltGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  asphaltGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  asphaltGeo.setIndex(indices);
  asphaltGeo.computeVertexNormals();
  addTrackedMesh(group, customTargets, asphaltGeo, materials.asphaltMat, "asphaltMat", [0, 0, 0]);

  // Smoothly flaring outer curbs & sidewalks following exact road perimeter (ZERO clipping!)
  for (const side of [-1, 1]) {
    const curbPos = [];
    const curbUvs = [];
    const curbIdx = [];
    const swPos = [];
    const swUvs = [];

    for (let zi = 0; zi <= segsZ; zi++) {
      const t = zi / segsZ;
      const zLocal = -t * INTERCHANGE_LENGTH;
      const flare = 3.6 * 0.5 * (1 - Math.cos(Math.PI * 2 * t));
      const edgeX = side * (ROAD_WIDTH * 0.5 + flare);

      const xInner = side > 0 ? edgeX : edgeX - 0.5;
      const xOuter = side > 0 ? edgeX + 0.5 : edgeX;
      curbPos.push(xInner, 0.08, zLocal, xOuter, 0.08, zLocal);
      curbUvs.push(0, t * 14, 1, t * 14);

      const swInner = side > 0 ? edgeX + 0.5 : edgeX - 3.9;
      const swOuter = side > 0 ? edgeX + 3.9 : edgeX - 0.5;
      swPos.push(swInner, 0.09, zLocal, swOuter, 0.09, zLocal);
      swUvs.push(0, t * 14, 1, t * 14);
    }
    for (let zi = 0; zi < segsZ; zi++) {
      const a = zi * 2;
      curbIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbPos, 3));
    cGeo.setAttribute("uv", new THREE.Float32BufferAttribute(curbUvs, 2));
    cGeo.setIndex(curbIdx);
    cGeo.computeVertexNormals();
    addTrackedMesh(group, customTargets, cGeo, materials.curbMat, "curbMat", [0, 0, 0]);

    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.Float32BufferAttribute(swPos, 3));
    sGeo.setAttribute("uv", new THREE.Float32BufferAttribute(swUvs, 2));
    sGeo.setIndex(curbIdx);
    sGeo.computeVertexNormals();
    addTrackedMesh(group, customTargets, sGeo, materials.sidewalkMat, "sidewalkMat", [0, 0, 0]);
  }

  // Sleek Landscaped Central Boulevard Divider Island (safely between lanes 1 and 2 at x = -1.8!)
  // Recall lanes are at [-7.2, -3.6, 0, +3.6, +7.2], so x = -1.8 sits cleanly between oncoming & cruising lanes!
  const islandGroup = new THREE.Group();
  islandGroup.position.set(-1.8, 0, -40);

  const islandBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 26), extras.curbStoneMat);
  islandBase.position.y = 0.14;
  const islandLawn = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.32, 24.5), extras.lawnMat);
  islandLawn.position.y = 0.16;
  const noseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.28, 12), extras.curbStoneMat);
  noseCap.position.set(0, 0.14, 13);
  const tailCap = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.28, 12), extras.curbStoneMat);
  tailCap.position.set(0, 0.14, -13);
  const chevronBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.18), extras.chevronGlowMat);
  chevronBeacon.position.set(0, 0.72, 13.0);
  islandGroup.add(islandBase, islandLawn, noseCap, tailCap, chevronBeacon);
  group.add(islandGroup);

  // Overhead Highway Steel Route Sign Gantry at z = -16
  const gantryZ = -16;
  const pillarGeo = new THREE.CylinderGeometry(0.24, 0.3, 8.2, 8);
  const lp = new THREE.Mesh(pillarGeo, extras.poleMat);
  lp.position.set(-12.2, 4.1, gantryZ);
  const rp = new THREE.Mesh(pillarGeo, extras.poleMat);
  rp.position.set(12.2, 4.1, gantryZ);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(25.2, 0.5, 0.5), extras.poleMat);
  beam.position.set(0, 7.9, gantryZ);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(14.0, 2.9, 0.22), extras.signMat);
  sign.position.set(0, 7.2, gantryZ + 0.35);
  group.add(lp, rp, beam, sign);

  group.userData.customMatTargets = customTargets;

  const seg = createRoadSegment({
    type: "interchange",
    length: INTERCHANGE_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual: group,
    sampleLocalProfile: sampleFlatProfile
  });

  // Mark as an interactive route-selector fork!
  seg.isRouteSplit = true;
  seg.splitTriggered = false;
  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -12;
  seg.crossStreetLocalEnd = -68;
  return seg;
}
