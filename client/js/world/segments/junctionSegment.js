import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { SEGMENT_LENGTH, ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   CITY JUNCTION & HIGHWAY INTERCHANGE MODULES
   1. junction (4-Way City Crossroad):
      - Perpendicular 4-lane cross-avenue extending ±85m into the city
      - Crisp zebra crosswalks & intersection markings
      - 4 corner traffic light gantries with glowing signal heads
   2. interchange (Highway Off-Ramp / On-Ramp Split):
      - Angled diverging exit ramps & merging slip-roads branching ±32°
      - Overhead highway steel gantry with glowing destination signboards
================================================================ */

let _sharedBaseGeos = null;
let _sharedCrossMaterials = null;

function sampleFlatProfile(t, out) {
  out.x = 0;
  out.y = 0;
  out.heading = 0;
  out.slope = 0;
  return out;
}

function getSharedBaseGeometries() {
  if (!_sharedBaseGeos) {
    _sharedBaseGeos = createSharedHighwayGeometries({
      length: SEGMENT_LENGTH,
      segmentsZ: 4,
      profileFn: sampleFlatProfile
    });
  }
  return _sharedBaseGeos;
}

function createCrossAvenueTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Asphalt base
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 512, 256);

  // Subtle tarmac texture
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(0, 42, 512, 28);
  ctx.fillRect(0, 186, 512, 28);

  // Outer white edge lines
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 8, 512, 6);
  ctx.fillRect(0, 242, 512, 6);

  // Double amber center line
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(0, 122, 512, 4);
  ctx.fillRect(0, 130, 512, 4);

  // White dashed lane dividers
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  for (let x = 16; x < 512; x += 64) {
    ctx.fillRect(x, 64, 30, 4);
    ctx.fillRect(x, 188, 30, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(6, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCrosswalkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(248, 250, 252, 0.92)";
  for (let x = 8; x < 248; x += 24) {
    ctx.fillRect(x, 8, 12, 48);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGantrySignTexture(leftText, centerText, rightText) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Highway green-teal metallic sign backing
  ctx.fillStyle = "#065f46";
  ctx.fillRect(0, 0, 512, 128);

  // Crisp white reflective border
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);

  // Column dividers
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(170, 14);
  ctx.lineTo(170, 114);
  ctx.moveTo(342, 14);
  ctx.lineTo(342, 114);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText(leftText, 88, 56);
  ctx.fillText(centerText, 256, 56);
  ctx.fillText(rightText, 424, 56);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 32px system-ui, sans-serif";
  ctx.fillText("↖", 88, 100);
  ctx.fillText("↑", 256, 100);
  ctx.fillText("↗", 424, 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedJunctionMaterials() {
  if (_sharedCrossMaterials) return _sharedCrossMaterials;

  const crossTex = createCrossAvenueTexture();
  const crosswalkTex = createCrosswalkTexture();
  const signTex = createGantrySignTexture("UPTOWN", "METRO CORE", "HARBOR");

  _sharedCrossMaterials = {
    crossAsphalt: new THREE.MeshStandardMaterial({
      map: crossTex,
      roughness: 0.42,
      metalness: 0.18
    }),
    crossSidewalk: new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.85,
      metalness: 0.05
    }),
    crosswalk: new THREE.MeshStandardMaterial({
      map: crosswalkTex,
      transparent: true,
      roughness: 0.5,
      depthWrite: false
    }),
    pole: new THREE.MeshStandardMaterial({
      color: "#334155",
      metalness: 0.8,
      roughness: 0.3
    }),
    housing: new THREE.MeshStandardMaterial({
      color: "#0f172a",
      metalness: 0.5,
      roughness: 0.5
    }),
    lightGreen: new THREE.MeshStandardMaterial({
      color: "#22c55e",
      emissive: "#22c55e",
      emissiveIntensity: 3.5
    }),
    lightRed: new THREE.MeshStandardMaterial({
      color: "#ef4444",
      emissive: "#ef4444",
      emissiveIntensity: 3.0
    }),
    lightAmber: new THREE.MeshStandardMaterial({
      color: "#f59e0b",
      emissive: "#f59e0b",
      emissiveIntensity: 1.2
    }),
    signBoard: new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.45,
      roughness: 0.35
    })
  };

  return _sharedCrossMaterials;
}

function buildTrafficLightCorner(mats, x, z, faceDir) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Vertical pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.2, 6), mats.pole);
  pole.position.y = 3.1;
  g.add(pole);

  // Cantilever arm reaching over the road
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 0.16), mats.pole);
  arm.position.set(faceDir * 2.1, 5.9, 0);
  g.add(arm);

  // Signal head box
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.25, 0.34), mats.housing);
  box.position.set(faceDir * 3.6, 5.4, 0);
  g.add(box);

  // Glowing lenses (green for main highway flow)
  const lensGeo = new THREE.CircleGeometry(0.13, 8);
  const red = new THREE.Mesh(lensGeo, mats.lightRed);
  red.position.set(faceDir * 3.6, 5.75, 0.18);
  const amber = new THREE.Mesh(lensGeo, mats.lightAmber);
  amber.position.set(faceDir * 3.6, 5.4, 0.18);
  const green = new THREE.Mesh(lensGeo, mats.lightGreen);
  green.position.set(faceDir * 3.6, 5.05, 0.18);
  g.add(red, amber, green);

  return g;
}

/**
 * 4-Way City Crossroad Junction Segment (40m)
 */
export function createJunctionSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedBaseGeometries(),
    materials,
    "road-seg-junction"
  );

  const mats = getSharedJunctionMaterials();

  // 1. Wide perpendicular city cross-avenue spanning ±85m left & right
  const crossRoadGeo = new THREE.PlaneGeometry(170, 15.6);
  const crossRoad = new THREE.Mesh(crossRoadGeo, mats.crossAsphalt);
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.set(0, 0.052, -20);
  crossRoad.receiveShadow = true;
  visual.add(crossRoad);

  // 2. Cross-avenue sidewalks on north & south edges of the side street
  const sideGeo = new THREE.PlaneGeometry(76, 2.8);
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const sw = new THREE.Mesh(sideGeo, mats.crossSidewalk);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(sideX * (ROAD_WIDTH * 0.5 + 40), 0.092, -20 + sideZ * 9.2);
      sw.receiveShadow = true;
      visual.add(sw);
    }
  }

  // 3. Zebra crosswalks before & after the intersection
  const cwGeo = new THREE.PlaneGeometry(ROAD_WIDTH - 0.8, 3.0);
  for (const zOff of [-10.4, -29.6]) {
    const cw = new THREE.Mesh(cwGeo, mats.crosswalk);
    cw.rotation.x = -Math.PI / 2;
    cw.position.set(0, 0.068, zOff);
    visual.add(cw);
  }

  // 4. Traffic light gantries on far-left and far-right corners
  visual.add(buildTrafficLightCorner(mats, -10.4, -29.5, 1));
  visual.add(buildTrafficLightCorner(mats, 10.4, -29.5, -1));

  const seg = createRoadSegment({
    type: "junction",
    length: SEGMENT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleFlatProfile
  });

  // Mark cross-street clearance zone so roadside skyscrapers don't block side avenues
  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -4;
  seg.crossStreetLocalEnd = -36;
  seg.exits = [
    { id: "main", x: 0, y: 0, z: -SEGMENT_LENGTH, yaw: 0, layer: RoadLayer.GROUND },
    { id: "left", x: -85, y: 0, z: -20, yaw: Math.PI / 2, layer: RoadLayer.GROUND },
    { id: "right", x: 85, y: 0, z: -20, yaw: -Math.PI / 2, layer: RoadLayer.GROUND }
  ];

  return seg;
}

/**
 * Highway Interchange Segment with Diverging Off-Ramps & Overhead Sign Gantry (40m)
 */
export function createInterchangeSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedBaseGeometries(),
    materials,
    "road-seg-interchange"
  );

  const mats = getSharedJunctionMaterials();

  // 1. Angled diverging slip-ramps branching off left & right at ±32°
  const rampGeo = new THREE.PlaneGeometry(11.0, 72);
  for (const side of [-1, 1]) {
    const ramp = new THREE.Mesh(rampGeo, mats.crossAsphalt);
    ramp.rotation.x = -Math.PI / 2;
    ramp.rotation.z = side * -0.54; // ~31° diverging highway exit ramp
    ramp.position.set(side * 25.5, 0.048, -32);
    ramp.receiveShadow = true;
    visual.add(ramp);

    // Sidewalk/curb borders along ramp
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 68), mats.pole);
    rail.rotation.y = side * -0.54;
    rail.position.set(side * 31.2, 0.35, -30);
    visual.add(rail);
  }

  // 2. Overhead Highway Steel Truss Gantry spanning all 5 lanes
  const gantryZ = -18;
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.34, 8.2, 8);
  const leftPillar = new THREE.Mesh(pillarGeo, mats.pole);
  leftPillar.position.set(-10.8, 4.1, gantryZ);
  const rightPillar = new THREE.Mesh(pillarGeo, mats.pole);
  rightPillar.position.set(10.8, 4.1, gantryZ);

  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.55, 0.55), mats.pole);
  crossBeam.position.set(0, 7.8, gantryZ);

  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(13.5, 3.0, 0.25), mats.signBoard);
  signMesh.position.set(0, 7.2, gantryZ + 0.38);

  visual.add(leftPillar, rightPillar, crossBeam, signMesh);

  const seg = createRoadSegment({
    type: "interchange",
    length: SEGMENT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleFlatProfile
  });

  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -4;
  seg.crossStreetLocalEnd = -40;
  seg.exits = [
    { id: "main", x: 0, y: 0, z: -SEGMENT_LENGTH, yaw: 0, layer: RoadLayer.GROUND },
    { id: "exitLeft", x: -42, y: 0, z: -60, yaw: 0.54, layer: RoadLayer.GROUND },
    { id: "exitRight", x: 42, y: 0, z: -60, yaw: -0.54, layer: RoadLayer.GROUND }
  ];

  return seg;
}
