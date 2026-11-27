import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   MULTI-LAYER HIGHWAY FLYOVER / OVERPASS MODULE (120m)
   - Smooth ramp UP (0m -> +6.5m) -> Elevated Deck (RoadLayer.FLYOVER = 1)
     -> Smooth ramp DOWN (+6.5m -> 0m).
   - Full ground-level city expressway passes perpendicularly UNDERNEATH
     the elevated bridge at y = 0 with concrete support piers & guardrails!
   - Layer-aware: sets out.layer = RoadLayer.FLYOVER on elevated span.
================================================================ */

const FLYOVER_LENGTH = 120;
const DECK_HEIGHT = 6.5;

let _sharedFlyoverGeos = null;
let _sharedFlyoverMats = null;

function sampleFlyoverProfile(t, out) {
  out.x = 0;
  out.heading = 0;

  let y = 0;
  let dyDt = 0;

  if (t < 0.28) {
    // Smooth cosine ramp UP (0 -> DECK_HEIGHT)
    const u = t / 0.28;
    y = DECK_HEIGHT * 0.5 * (1 - Math.cos(Math.PI * u));
    dyDt = (DECK_HEIGHT * 0.5 * Math.PI * Math.sin(Math.PI * u)) / 0.28;
  } else if (t <= 0.72) {
    // Flat elevated flyover deck
    y = DECK_HEIGHT;
    dyDt = 0;
  } else {
    // Smooth cosine ramp DOWN (DECK_HEIGHT -> 0)
    const u = (t - 0.72) / 0.28;
    y = DECK_HEIGHT * 0.5 * (1 + Math.cos(Math.PI * u));
    dyDt = -(DECK_HEIGHT * 0.5 * Math.PI * Math.sin(Math.PI * u)) / 0.28;
  }

  out.y = y;
  // dy/dz = -(dy/dt) / length
  out.slope = -dyDt / FLYOVER_LENGTH;
  return out;
}

function getSharedFlyoverGeometries() {
  if (!_sharedFlyoverGeos) {
    _sharedFlyoverGeos = createSharedHighwayGeometries({
      length: FLYOVER_LENGTH,
      segmentsZ: 28,
      profileFn: sampleFlyoverProfile
    });
  }
  return _sharedFlyoverGeos;
}

function getSharedFlyoverMaterials() {
  if (_sharedFlyoverMats) return _sharedFlyoverMats;

  _sharedFlyoverMats = {
    concrete: new THREE.MeshStandardMaterial({
      color: "#64748b",
      roughness: 0.78,
      metalness: 0.15
    }),
    guardrail: new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      metalness: 0.7,
      roughness: 0.3
    }),
    beacon: new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      emissive: "#38bdf8",
      emissiveIntensity: 2.5
    }),
    underRoad: new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.45,
      metalness: 0.18
    }),
    underStripe: new THREE.MeshStandardMaterial({
      color: "#fbbf24",
      emissive: "#f59e0b",
      emissiveIntensity: 0.3
    })
  };

  return _sharedFlyoverMats;
}

export function createFlyoverSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedFlyoverGeometries(),
    materials,
    "road-seg-flyover"
  );

  const mats = getSharedFlyoverMaterials();

  // 1. Concrete bridge under-deck slab & safety parapets on the elevated center span (z: -34 to -86)
  const deckSpanLen = 54;
  const underSlab = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH + 6.4, 0.9, deckSpanLen),
    mats.concrete
  );
  underSlab.position.set(0, DECK_HEIGHT - 0.45, -60);
  visual.add(underSlab);

  // Left & Right bridge guardrails + neon accent strips along the elevated deck
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.05, deckSpanLen),
      mats.guardrail
    );
    wall.position.set(side * (ROAD_WIDTH * 0.5 + 0.55), DECK_HEIGHT + 0.55, -60);
    visual.add(wall);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, deckSpanLen),
      mats.beacon
    );
    strip.position.set(side * (ROAD_WIDTH * 0.5 + 0.3), DECK_HEIGHT + 0.85, -60);
    visual.add(strip);
  }

  // 2. Heavy Concrete Bridge Support Pillars dropping down to y = 0
  const pierGeo = new THREE.BoxGeometry(1.4, DECK_HEIGHT, 1.8);
  for (const pierZ of [-40, -80]) {
    for (const pierX of [-8.5, 0, 8.5]) {
      const pier = new THREE.Mesh(pierGeo, mats.concrete);
      pier.position.set(pierX, DECK_HEIGHT * 0.5, pierZ);
      visual.add(pier);
    }
  }

  // 3. Lower Ground-Level City Cross-Expressway passing UNDERNEATH the flyover at y = 0!
  const underRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 20),
    mats.underRoad
  );
  underRoad.rotation.x = -Math.PI / 2;
  underRoad.position.set(0, 0.04, -60);
  underRoad.receiveShadow = true;
  visual.add(underRoad);

  const underDivider = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 0.45),
    mats.underStripe
  );
  underDivider.rotation.x = -Math.PI / 2;
  underDivider.position.set(0, 0.06, -60);
  visual.add(underDivider);

  const seg = createRoadSegment({
    type: "flyover",
    length: FLYOVER_LENGTH,
    layer: RoadLayer.FLYOVER,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleFlyoverProfile
  });

  // Override navigation sampler to report dynamic RoadLayer (GROUND on ramps, FLYOVER on upper deck)
  const baseSampleWorld = seg.navigation.sampleWorld;
  seg.navigation.sampleWorld = (zWorld, lateralOffset, out) => {
    baseSampleWorld(zWorld, lateralOffset, out);
    out.layer = out.y > 2.5 ? RoadLayer.FLYOVER : RoadLayer.GROUND;
    return out;
  };

  // Clear buildings along the lower cross-expressway corridor
  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -44;
  seg.crossStreetLocalEnd = -76;

  return seg;
}
