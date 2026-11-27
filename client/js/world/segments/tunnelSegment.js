import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { ROAD_WIDTH, RoadLayer } from "../roadConstants.js";
import {
  createSharedHighwayGeometries,
  createHighwayVisualGroup,
  createRoadSegment
} from "../roadSegment.js";

/* ================================================================
   SLEEK ARCHED CITY HIGHWAY TUNNEL (120m)
   - Smooth curved concrete arch barrel (NOT a boxy gray cube!)
   - Architectural tapered entrance/exit portals with recessed LED ribs
   - Clean elevated city street deck running above the tunnel roof
   - Integrates seamlessly with TunnelCuller for interior atmosphere & FPS boost
================================================================ */

const TUNNEL_LENGTH = 120;
const TUNNEL_RADIUS = 11.4; // Generous 11.4m radius arch spanning 18m highway + sidewalks!

let _sharedTunnelGeos = null;
let _sharedTunnelExtras = null;

function sampleTunnelProfile(t, out) {
  out.x = 0;
  out.y = 0;
  out.heading = 0;
  out.slope = 0;
  return out;
}

function getSharedTunnelGeometries() {
  if (!_sharedTunnelGeos) {
    _sharedTunnelGeos = createSharedHighwayGeometries({
      length: TUNNEL_LENGTH,
      segmentsZ: 6,
      profileFn: sampleTunnelProfile
    });
  }
  return _sharedTunnelGeos;
}

function createArchInteriorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Clean modern architectural concrete & bright lower ceramic tile wall
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 256, 256);

  // Subtle rib panel joints
  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.lineWidth = 3;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Bright reflective lower tile stripe along both sides of the arch base
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 0, 24, 256);
  ctx.fillRect(232, 0, 24, 256);

  // Subtle warm-amber safety guide line
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(24, 0, 5, 256);
  ctx.fillRect(227, 0, 5, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedTunnelExtras() {
  if (_sharedTunnelExtras) return _sharedTunnelExtras;

  const archTex = createArchInteriorTexture();

  _sharedTunnelExtras = {
    archInner: new THREE.MeshStandardMaterial({
      map: archTex,
      roughness: 0.65,
      metalness: 0.15,
      side: THREE.BackSide // Render crisp interior surface of the curved barrel!
    }),
    archOuter: new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.78,
      metalness: 0.15,
      side: THREE.FrontSide
    }),
    portalConcrete: new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.65,
      metalness: 0.2
    }),
    ribMat: new THREE.MeshStandardMaterial({
      color: "#334155",
      roughness: 0.5,
      metalness: 0.45
    }),
    ledStrip: new THREE.MeshStandardMaterial({
      color: "#e0f2fe",
      emissive: "#7dd3fc",
      emissiveIntensity: 3.6
    }),
    portalAccent: new THREE.MeshStandardMaterial({
      color: "#00efff",
      emissive: "#00efff",
      emissiveIntensity: 2.2
    })
  };
  return _sharedTunnelExtras;
}

export function createTunnelSegment(materials) {
  const visual = createHighwayVisualGroup(
    getSharedTunnelGeometries(),
    materials,
    "road-seg-tunnel"
  );

  const extras = getSharedTunnelExtras();
  const tubeLen = 74;
  const tubeCenterZ = -60;

  // 1. Sleek Curved Semicircular Concrete Tunnel Vault (inner + outer shells)
  // Cylinder rotated -PI/2 around X puts theta ∈ [-PI/2, +PI/2] cleanly in +Y (upper arch!)
  const archGeo = new THREE.CylinderGeometry(
    TUNNEL_RADIUS,
    TUNNEL_RADIUS,
    tubeLen,
    18,
    1,
    true,
    -Math.PI / 2,
    Math.PI
  );
  archGeo.rotateX(-Math.PI / 2);

  const innerArch = new THREE.Mesh(archGeo, extras.archInner);
  innerArch.scale.set(1, 0.78, 1); // Sleek wide elliptical highway tunnel arch (~8.9m tall!)
  innerArch.position.set(0, 0, tubeCenterZ);

  const outerArch = new THREE.Mesh(archGeo, extras.archOuter);
  outerArch.scale.set(1.04, 0.82, 1.0);
  outerArch.position.set(0, 0, tubeCenterZ);
  visual.add(innerArch, outerArch);

  // 2. Sculpted Entrance & Exit Arch Portals with Neon Rim Strips
  const portalArchGeo = new THREE.TorusGeometry(TUNNEL_RADIUS, 0.55, 8, 20, Math.PI);
  const accentArchGeo = new THREE.TorusGeometry(TUNNEL_RADIUS - 0.35, 0.1, 6, 20, Math.PI);

  for (const portalZ of [tubeCenterZ + tubeLen * 0.5, tubeCenterZ - tubeLen * 0.5]) {
    const portalRing = new THREE.Mesh(portalArchGeo, extras.portalConcrete);
    portalRing.scale.set(1.02, 0.80, 1);
    portalRing.position.set(0, 0, portalZ);

    const accentRing = new THREE.Mesh(accentArchGeo, extras.portalAccent);
    accentRing.scale.set(1.01, 0.79, 1);
    accentRing.position.set(0, 0, portalZ + (portalZ > tubeCenterZ ? 0.45 : -0.45));
    visual.add(portalRing, accentRing);
  }

  // 3. Rhythmic Structural Arch Ribs & Glowing Overhead LED Light Strips inside Tunnel
  const ribGeo = new THREE.TorusGeometry(TUNNEL_RADIUS - 0.15, 0.18, 6, 16, Math.PI);
  const ledGeo = new THREE.BoxGeometry(5.6, 0.12, 1.8);
  const ceilingY = TUNNEL_RADIUS * 0.78 - 0.25;

  for (let z = tubeCenterZ + 30; z >= tubeCenterZ - 30; z -= 10) {
    const rib = new THREE.Mesh(ribGeo, extras.ribMat);
    rib.scale.set(1, 0.78, 1);
    rib.position.set(0, 0, z);
    visual.add(rib);

    const led = new THREE.Mesh(ledGeo, extras.ledStrip);
    led.position.set(0, ceilingY, z);
    visual.add(led);
  }

  // 4. Clean Elevated Cross-City Boulevard running seamlessly ABOVE the tunnel vault!
  const upperDeckY = TUNNEL_RADIUS * 0.82 + 0.15;
  const upperStreet = new THREE.Mesh(new THREE.PlaneGeometry(180, 20), materials.avenueMat);
  upperStreet.rotation.x = -Math.PI / 2;
  upperStreet.position.set(0, upperDeckY, tubeCenterZ);
  visual.add(upperStreet);

  if (!visual.userData.customMatTargets) visual.userData.customMatTargets = [];
  visual.userData.customMatTargets.push({ mesh: upperStreet, matKey: "avenueMat" });

  const seg = createRoadSegment({
    type: "tunnel",
    length: TUNNEL_LENGTH,
    layer: RoadLayer.UNDERGROUND,
    deltaX: 0,
    deltaY: 0,
    visual,
    sampleLocalProfile: sampleTunnelProfile
  });

  const baseSampleWorld = seg.navigation.sampleWorld;
  seg.navigation.sampleWorld = (zWorld, lateralOffset, out) => {
    baseSampleWorld(zWorld, lateralOffset, out);
    const zLocal = zWorld - seg.zStart;
    const insideTube = zLocal <= -23 && zLocal >= -97;
    out.layer = insideTube ? RoadLayer.UNDERGROUND : RoadLayer.GROUND;
    out.inTunnel = insideTube;
    return out;
  };

  seg.hasCrossStreet = true;
  seg.crossStreetLocalStart = -18;
  seg.crossStreetLocalEnd = -102;
  return seg;
}
