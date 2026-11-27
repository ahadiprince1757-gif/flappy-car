import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   CITY UNDERPASS / UNDERGROUND TUNNEL MODULE (120m)
   - Approach dip (0m -> -3.6m) -> Lit enclosed tunnel (RoadLayer.UNDERGROUND = -1)
     -> Exit rise (-3.6m -> 0m) back into open city skyline.
   - Constructed from low-poly floor, left/right concrete tiled walls, ceiling,
     glowing overhead LED bars, portal facades, AND a city overpass street above!
   - Works with TunnelCuller to hide far exterior scenery & boost FPS inside!
================================================================ */

const TUNNEL_LENGTH = 120;
const TUNNEL_DEPTH = 0;          // Ground-aligned underpass (zero ground-plane clipping!)
const TUNNEL_CLEAR_HEIGHT = 8.4; // Generous ceiling height so chase camera never clips

let _sharedTunnelGeos = null;
let _sharedTunnelMats = null;

function sampleTunnelProfile(t, out) {
  out.x = 0;
  out.y = TUNNEL_DEPTH;
  out.heading = 0;
  out.slope = 0;
  return out;
}

function getSharedTunnelGeometries() {
  if (!_sharedTunnelGeos) {
    _sharedTunnelGeos = createSharedHighwayGeometries({
      length: TUNNEL_LENGTH,
      segmentsZ: 24,
      profileFn: sampleTunnelProfile
    });
  }
  return _sharedTunnelGeos;
}

function createTunnelWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Industrial tunnel concrete + reflective white ceramic tile lower band
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, 0, 256, 68);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 68, 256, 46);
  ctx.fillStyle = "#f59e0b"; // Safety hazard stripe
  ctx.fillRect(0, 114, 256, 14);

  // Tile seam grid
  ctx.strokeStyle = "rgba(15, 23, 42, 0.25)";
  ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(10, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedTunnelMaterials() {
  if (_sharedTunnelMats) return _sharedTunnelMats;

  const wallTex = createTunnelWallTexture();

  _sharedTunnelMats = {
    wall: new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.65,
      metalness: 0.15
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: "#0f172a",
      roughness: 0.85,
      metalness: 0.1
    }),
    portal: new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.6,
      metalness: 0.3
    }),
    ledLight: new THREE.MeshStandardMaterial({
      color: "#e0f2fe",
      emissive: "#7dd3fc",
      emissiveIntensity: 4.0
    }),
    portalTrim: new THREE.MeshStandardMaterial({
      color: "#00efff",
      emissive: "#00efff",
      emissiveIntensity: 2.5
    }),
    upperRoad: new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.45,
      metalness: 0.18
    })
  };

  return _sharedTunnelMats;
}

export function createTunnelSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedTunnelGeometries(),
    materials,
    "road-seg-tunnel"
  );

  const mats = getSharedTunnelMaterials();

  const tubeLength = 68;
  const tubeCenterZ = -60;
  const halfInnerW = ROAD_WIDTH * 0.5 + 1.4; // 10.4m from center -> 20.8m wide tunnel
  const wallCenterY = TUNNEL_DEPTH + TUNNEL_CLEAR_HEIGHT * 0.5;
  const roofY = TUNNEL_DEPTH + TUNNEL_CLEAR_HEIGHT;

  // 1. Left & Right Tiled Tunnel Walls
  const wallGeo = new THREE.BoxGeometry(1.2, TUNNEL_CLEAR_HEIGHT, tubeLength);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(wallGeo, mats.wall);
    wall.position.set(side * (halfInnerW + 0.6), wallCenterY, tubeCenterZ);
    visual.add(wall);
  }

  // 2. Tunnel Ceiling Deck
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(halfInnerW * 2 + 2.4, 1.0, tubeLength),
    mats.ceiling
  );
  ceiling.position.set(0, roofY + 0.5, tubeCenterZ);
  visual.add(ceiling);

  // 3. Entrance & Exit Architectural Portals with Neon Guidance Strips
  const lintelGeo = new THREE.BoxGeometry(halfInnerW * 2 + 4.4, 2.2, 1.8);
  const trimGeo = new THREE.BoxGeometry(halfInnerW * 2 + 0.4, 0.22, 0.28);
  for (const portalZ of [tubeCenterZ + tubeLength * 0.5, tubeCenterZ - tubeLength * 0.5]) {
    const lintel = new THREE.Mesh(lintelGeo, mats.portal);
    lintel.position.set(0, roofY + 0.7, portalZ);
    visual.add(lintel);

    const trim = new THREE.Mesh(trimGeo, mats.portalTrim);
    trim.position.set(0, roofY - 0.15, portalZ + 0.95);
    visual.add(trim);
  }

  // 4. Rhythmic Glowing Overhead Tunnel LED Strips (high-speed depth sensation!)
  const ledGeo = new THREE.BoxGeometry(6.5, 0.14, 1.6);
  for (let z = tubeCenterZ + 28; z >= tubeCenterZ - 28; z -= 9.5) {
    const led = new THREE.Mesh(ledGeo, mats.ledLight);
    led.position.set(0, roofY - 0.08, z);
    visual.add(led);
  }

  // 5. Overhead City Avenue crossing ABOVE the tunnel roof!
  const upperStreet = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 24),
    mats.upperRoad
  );
  upperStreet.rotation.x = -Math.PI / 2;
  upperStreet.position.set(0, roofY + 1.05, tubeCenterZ);
  visual.add(upperStreet);

  const seg = createRoadSegment({
    type: "tunnel",
    length: TUNNEL_LENGTH,
    layer: RoadLayer.UNDERGROUND,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleTunnelProfile
  });

  // Override navigation sampler to report dynamic RoadLayer (UNDERGROUND inside tube, GROUND on ramps)
  const baseSampleWorld = seg.navigation.sampleWorld;
  seg.navigation.sampleWorld = (zWorld, lateralOffset, out) => {
    baseSampleWorld(zWorld, lateralOffset, out);
    const zLocal = zWorld - seg.zStart; // in [-120, 0]
    const insideTube = zLocal <= -24 && zLocal >= -96;
    out.layer = insideTube ? RoadLayer.UNDERGROUND : RoadLayer.GROUND;
    out.inTunnel = insideTube;
    return out;
  };

  // Clear outer buildings overlapping the tunnel portals & cross-avenue above
  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -18;
  seg.crossStreetLocalEnd = -102;

  return seg;
}
