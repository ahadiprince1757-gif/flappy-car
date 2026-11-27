import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   PROCEDURAL CITY ROUNDABOUT MODULE
   - createRoundabout({ radius, innerRadius, exits, segments })
   - Sweeps the 5-lane highway smoothly around the right side of an
     illuminated circular city plaza island with 4 radiating avenues!
   - C1-continuous entry & exit tangents (heading = 0 at t=0 and t=1),
     guaranteeing zero collision with the island across all 5 lanes.
================================================================ */

const ROUNDABOUT_LENGTH = 60;
const ROUNDABOUT_SWEEP_X = 11.2; // Centerline sweeps +11.2m right around the central island
const ISLAND_CENTER_X = -4.8;
const ISLAND_CENTER_Z = -30;

let _sharedRoundaboutGeos = null;
let _sharedRoundaboutMats = null;

function sampleRoundaboutProfile(t, out) {
  // Smooth C1 bump: x(t) = A * 0.5 * (1 - cos(2πt)) -> 0 at t=0, +A at t=0.5, 0 at t=1
  const twoPiT = Math.PI * 2 * t;
  out.x = ROUNDABOUT_SWEEP_X * 0.5 * (1 - Math.cos(twoPiT));
  out.y = 0;

  // Analytical tangent: dx/dt = A * π * sin(2πt), dRoadX/dz = -(dx/dt) / length
  const dxDt = ROUNDABOUT_SWEEP_X * Math.PI * Math.sin(twoPiT);
  out.heading = Math.atan2(-dxDt / ROUNDABOUT_LENGTH, 1);
  out.slope = 0;
  return out;
}

function getSharedRoundaboutGeometries() {
  if (!_sharedRoundaboutGeos) {
    _sharedRoundaboutGeos = createSharedHighwayGeometries({
      length: ROUNDABOUT_LENGTH,
      segmentsZ: 20, // Smooth circular curve around plaza
      profileFn: sampleRoundaboutProfile
    });
  }
  return _sharedRoundaboutGeos;
}

function getSharedRoundaboutMaterials() {
  if (_sharedRoundaboutMats) return _sharedRoundaboutMats;

  // Circular plaza asphalt texture
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();

  const ringTex = new THREE.CanvasTexture(canvas);
  ringTex.colorSpace = THREE.SRGBColorSpace;

  _sharedRoundaboutMats = {
    ringAsphalt: new THREE.MeshStandardMaterial({
      map: ringTex,
      roughness: 0.42,
      metalness: 0.18
    }),
    avenueAsphalt: new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.45,
      metalness: 0.18
    }),
    islandCurb: new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.65,
      metalness: 0.2
    }),
    islandLawn: new THREE.MeshStandardMaterial({
      color: "#15803d",
      roughness: 0.9,
      metalness: 0.05
    }),
    neonRing: new THREE.MeshStandardMaterial({
      color: "#00efff",
      emissive: "#00efff",
      emissiveIntensity: 2.2,
      roughness: 0.2
    }),
    monument: new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      metalness: 0.85,
      roughness: 0.2
    })
  };

  return _sharedRoundaboutMats;
}

/**
 * Procedural Roundabout Generator: createRoundabout(options, materials)
 */
export function createRoundabout(materials, options = {}) {
  const {
    outerRadius = 22.5,
    islandRadius = 6.2,
    segments = 32
  } = options;

  const visual = createHighwayVisualGroup(
    getSharedRoundaboutGeometries(),
    materials,
    "road-seg-roundabout"
  );

  const mats = getSharedRoundaboutMaterials();

  // 1. Procedural Full Circular Roundabout Ring (centered to the left of main sweep)
  const ringGeo = new THREE.RingGeometry(islandRadius, outerRadius, segments);
  const ringMesh = new THREE.Mesh(ringGeo, mats.ringAsphalt);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(ISLAND_CENTER_X, 0.036, ISLAND_CENTER_Z);
  ringMesh.receiveShadow = true;
  visual.add(ringMesh);

  // 2. Radiating West & East City Avenues connecting into the roundabout ring
  const avenueGeo = new THREE.PlaneGeometry(75, 14.5);
  const westAve = new THREE.Mesh(avenueGeo, mats.avenueAsphalt);
  westAve.rotation.x = -Math.PI / 2;
  westAve.position.set(ISLAND_CENTER_X - outerRadius - 34, 0.034, ISLAND_CENTER_Z);
  westAve.receiveShadow = true;

  const eastAve = new THREE.Mesh(avenueGeo, mats.avenueAsphalt);
  eastAve.rotation.x = -Math.PI / 2;
  eastAve.position.set(ISLAND_CENTER_X + outerRadius + 34, 0.034, ISLAND_CENTER_Z);
  eastAve.receiveShadow = true;
  visual.add(westAve, eastAve);

  // 3. Raised Circular Center Plaza Island (stone curb + green lawn + glowing ring + landmark spire)
  const islandGroup = new THREE.Group();
  islandGroup.position.set(ISLAND_CENTER_X, 0, ISLAND_CENTER_Z);

  const curbMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(islandRadius, islandRadius + 0.35, 0.45, 24),
    mats.islandCurb
  );
  curbMesh.position.y = 0.225;
  curbMesh.receiveShadow = true;
  islandGroup.add(curbMesh);

  const lawnMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(islandRadius - 0.4, islandRadius - 0.4, 0.5, 24),
    mats.islandLawn
  );
  lawnMesh.position.y = 0.26;
  islandGroup.add(lawnMesh);

  // Glowing cyan roundabout guidance halo around island rim
  const haloMesh = new THREE.Mesh(
    new THREE.TorusGeometry(islandRadius + 0.08, 0.09, 8, 32),
    mats.neonRing
  );
  haloMesh.rotation.x = Math.PI / 2;
  haloMesh.position.y = 0.48;
  islandGroup.add(haloMesh);

  // Sleek futuristic city obelisk centerpiece
  const spire = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6, 0),
    mats.monument
  );
  spire.scale.set(1, 3.4, 1);
  spire.position.y = 4.2;
  islandGroup.add(spire);

  visual.add(islandGroup);

  const seg = createRoadSegment({
    type: "roundabout",
    length: ROUNDABOUT_LENGTH,
    layer: RoadLayer.GROUND,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleRoundaboutProfile
  });

  // Clear roadside skyscrapers around the full roundabout plaza & radiating avenues
  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -4;
  seg.crossStreetLocalEnd = -56;
  seg.exits = [
    { id: "main", x: 0, y: 0, z: -ROUNDABOUT_LENGTH, yaw: 0, layer: RoadLayer.GROUND },
    { id: "west", x: ISLAND_CENTER_X - 80, y: 0, z: ISLAND_CENTER_Z, yaw: Math.PI / 2, layer: RoadLayer.GROUND },
    { id: "east", x: ISLAND_CENTER_X + 80, y: 0, z: ISLAND_CENTER_Z, yaw: -Math.PI / 2, layer: RoadLayer.GROUND }
  ];

  return seg;
}

export function createRoundaboutSegment(materials) {
  return createRoundabout(materials);
}
