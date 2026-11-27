import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import {
  buildSegmentStripGeometry,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   SLEEK ARCHITECTURAL CITY FLYOVER / OVERPASS (120m)
   - Continuous highway ribbon with clean concrete bridge side-barriers
     rising smoothly along the EXACT ramp curve (no boxy floating slabs!).
   - Tapered cylindrical piers + seamless unified city avenue passing
     underneath at y = 0 with matching sidewalks & tarmac.
================================================================ */

const FLYOVER_LENGTH = 120;
const DECK_HEIGHT = 6.2;

let _sharedFlyoverGeos = null;
let _sharedFlyoverExtras = null;

function sampleFlyoverProfile(t, out) {
  out.x = 0;
  out.heading = 0;

  let y = 0;
  let dyDt = 0;

  if (t < 0.28) {
    const u = t / 0.28;
    y = DECK_HEIGHT * 0.5 * (1 - Math.cos(Math.PI * u));
    dyDt = (DECK_HEIGHT * 0.5 * Math.PI * Math.sin(Math.PI * u)) / 0.28;
  } else if (t <= 0.72) {
    y = DECK_HEIGHT;
    dyDt = 0;
  } else {
    const u = (t - 0.72) / 0.28;
    y = DECK_HEIGHT * 0.5 * (1 + Math.cos(Math.PI * u));
    dyDt = -(DECK_HEIGHT * 0.5 * Math.PI * Math.sin(Math.PI * u)) / 0.28;
  }

  out.y = y;
  out.slope = -dyDt / FLYOVER_LENGTH;
  return out;
}

function buildCurvedBarrierGeometry(side) {
  const segsZ = 28;
  const xInner = side * (ROAD_WIDTH * 0.5 + 0.15);
  const xOuter = side * (ROAD_WIDTH * 0.5 + 0.65);
  const barrierH = 1.05;
  const deckDrop = -0.85;
  const pt = { x: 0, y: 0, heading: 0, slope: 0 };

  const positions = [];
  const indices = [];

  for (let zi = 0; zi <= segsZ; zi++) {
    const t = zi / segsZ;
    const zLocal = -t * FLYOVER_LENGTH;
    sampleFlyoverProfile(t, pt);
    // Taper barrier height down smoothly at ground endpoints
    const liftFactor = Math.min(1, pt.y / 1.2);
    const yTop = pt.y + 0.15 + barrierH * liftFactor;
    const yBot = Math.max(0, pt.y + deckDrop * liftFactor);

    // 4 cross-section vertices per slice: inner-bot, inner-top, outer-top, outer-bot
    positions.push(
      xInner, pt.y + 0.04, zLocal,
      xInner, yTop, zLocal,
      xOuter, yTop, zLocal,
      xOuter, yBot, zLocal
    );
  }

  for (let zi = 0; zi < segsZ; zi++) {
    const b0 = zi * 4;
    const b1 = (zi + 1) * 4;
    // Top face, inner face, outer face
    if (side > 0) {
      indices.push(b0 + 1, b0 + 2, b1 + 1, b0 + 2, b1 + 2, b1 + 1); // top
      indices.push(b0 + 0, b0 + 1, b1 + 0, b0 + 1, b1 + 1, b1 + 0); // inner
      indices.push(b0 + 2, b0 + 3, b1 + 2, b0 + 3, b1 + 3, b1 + 2); // outer
    } else {
      indices.push(b0 + 2, b0 + 1, b1 + 2, b0 + 1, b1 + 1, b1 + 2); // top
      indices.push(b0 + 1, b0 + 0, b1 + 1, b0 + 0, b1 + 0, b1 + 1); // inner
      indices.push(b0 + 3, b0 + 2, b1 + 3, b0 + 2, b1 + 2, b1 + 3); // outer
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function getSharedFlyoverGeometries() {
  if (!_sharedFlyoverGeos) {
    _sharedFlyoverGeos = {
      asphalt: buildSegmentStripGeometry({
        length: FLYOVER_LENGTH, segmentsZ: 28, lateralOffset: 0, width: ROAD_WIDTH,
        heightOffset: 0.04, uRepeat: 1, vRepeat: FLYOVER_LENGTH / 16, profileFn: sampleFlyoverProfile
      }),
      leftBarrier: buildCurvedBarrierGeometry(-1),
      rightBarrier: buildCurvedBarrierGeometry(1)
    };
  }
  return _sharedFlyoverGeos;
}

function getSharedFlyoverExtras() {
  if (_sharedFlyoverExtras) return _sharedFlyoverExtras;
  _sharedFlyoverExtras = {
    concrete: new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.72,
      metalness: 0.14
    }),
    pierMat: new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.78,
      metalness: 0.12
    }),
    accentLed: new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      emissive: "#0ea5e9",
      emissiveIntensity: 1.8
    })
  };
  return _sharedFlyoverExtras;
}

export function createFlyoverSegment(materials) {
  const group = new THREE.Group();
  group.name = "road-seg-flyover";
  const customTargets = [];
  const geos = getSharedFlyoverGeometries();
  const extras = getSharedFlyoverExtras();

  // 1. Continuous curved asphalt bridge deck
  const asphalt = new THREE.Mesh(geos.asphalt, materials.asphaltMat);
  asphalt.receiveShadow = true;
  group.add(asphalt);
  customTargets.push({ mesh: asphalt, matKey: "asphaltMat" });

  // 2. Sleek continuous curved concrete bridge parapets following exact elevation curve!
  const leftBarrier = new THREE.Mesh(geos.leftBarrier, extras.concrete);
  const rightBarrier = new THREE.Mesh(geos.rightBarrier, extras.concrete);
  group.add(leftBarrier, rightBarrier);

  // Subtle bridge underside soffit slab & linear bridge lights on center deck
  const underSlab = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH + 0.6, 0.75, 56),
    extras.pierMat
  );
  underSlab.position.set(0, DECK_HEIGHT - 0.38, -60);
  group.add(underSlab);

  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 52), extras.accentLed);
    strip.position.set(side * (ROAD_WIDTH * 0.5 + 0.16), DECK_HEIGHT + 0.95, -60);
    group.add(strip);
  }

  // 3. Sleek Tapered Cylindrical Architectural Support Columns
  const pierGeo = new THREE.CylinderGeometry(0.65, 0.85, DECK_HEIGHT, 12);
  for (const pierZ of [-42, -78]) {
    for (const pierX of [-7.8, 0, 7.8]) {
      const pier = new THREE.Mesh(pierGeo, extras.pierMat);
      pier.position.set(pierX, DECK_HEIGHT * 0.5, pierZ);
      group.add(pier);
    }
  }

  // 4. Unified Ground-Level City Boulevard passing cleanly UNDERNEATH the overpass at y = 0!
  const underRoad = new THREE.Mesh(new THREE.PlaneGeometry(180, 18.5), materials.avenueMat);
  underRoad.rotation.x = -Math.PI / 2;
  underRoad.position.set(0, 0.04, -60);
  underRoad.receiveShadow = true;
  group.add(underRoad);
  customTargets.push({ mesh: underRoad, matKey: "avenueMat" });

  const underSwGeo = new THREE.PlaneGeometry(180, 3.2);
  for (const sideZ of [-1, 1]) {
    const sw = new THREE.Mesh(underSwGeo, materials.sidewalkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.085, -60 + sideZ * 10.8);
    sw.receiveShadow = true;
    group.add(sw);
    customTargets.push({ mesh: sw, matKey: "sidewalkMat" });
  }

  group.userData.customMatTargets = customTargets;

  const seg = createRoadSegment({
    type: "flyover",
    length: FLYOVER_LENGTH,
    layer: RoadLayer.FLYOVER,
    deltaX: 0,
    deltaY: 0,
    visual: group,
    sampleLocalProfile: sampleFlyoverProfile
  });

  const baseSampleWorld = seg.navigation.sampleWorld;
  seg.navigation.sampleWorld = (zWorld, lateralOffset, out) => {
    baseSampleWorld(zWorld, lateralOffset, out);
    out.layer = out.y > 2.5 ? RoadLayer.FLYOVER : RoadLayer.GROUND;
    return out;
  };

  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -44;
  seg.crossStreetLocalEnd = -76;
  return seg;
}
