import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { ROAD_WIDTH, LANE_CENTERS, RoadLayer } from "./roadConstants.js";

/* ================================================================
   ROAD SEGMENT BASE CONTRACT & LOW-POLY GEOMETRY BUILDER
   Separates:
   - logic:      id, type, layer, length, zStart/zEnd, xStart/xEnd, yStart/yEnd, exits
   - visual:     THREE.Group with shared low-poly BufferGeometries
   - collision:  lightweight bounds & layer metadata (zero triangle checks)
   - navigation: fast analytical samplePoint(t, lateralOffset, out)
================================================================ */

let _nextSegmentId = 1;

/**
 * Build a low-poly local-space road strip geometry along zLocal ∈ [0, -length].
 * Uses an analytical local profile function: profileFn(t) -> { x, y, heading }.
 */
export function buildSegmentStripGeometry({
  length,
  segmentsZ,
  lateralOffset,
  width,
  heightOffset = 0,
  uRepeat = 1,
  vRepeat = 1,
  profileFn
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const halfWidth = width * 0.5;
  const pt = { x: 0, y: 0, heading: 0 };

  for (let zi = 0; zi <= segmentsZ; zi++) {
    const t = zi / segmentsZ;
    const zLocal = -t * length;
    profileFn(t, pt);

    const cosH = Math.cos(pt.heading);
    const sinH = Math.sin(pt.heading);

    // Left edge (xi = 0) and Right edge (xi = 1) — only 1 quad per longitudinal step!
    for (let xi = 0; xi <= 1; xi++) {
      const lat = lateralOffset + (xi === 0 ? -halfWidth : halfWidth);
      const vx = pt.x + lat * cosH;
      const vy = pt.y + heightOffset;
      const vz = zLocal - lat * sinH;

      positions.push(vx, vy, vz);
      uvs.push(xi * uRepeat, t * vRepeat);
    }
  }

  for (let zi = 0; zi < segmentsZ; zi++) {
    const a = zi * 2;
    const b = a + 1;
    const c = a + 2;
    const d = c + 1;
    // Counter-clockwise upward-facing triangles (+Y normal)
    indices.push(a, b, c, b, d, c);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Build the complete set of shared low-poly BufferGeometries for a segment archetype
 * (asphalt + left/right curbs + left/right sidewalks + left/right shoulders).
 * Built ONCE per segment archetype and reused across all pooled instances!
 */
export function createSharedHighwayGeometries({ length, segmentsZ, profileFn }) {
  const vRepeatAsphalt = length / 16;             // 2.5 repeats = 10 exact dash cycles per 40m
  const vRepeatCurb = Math.round(length / 5);     // 8 exact red/white curb cycles per 40m
  const vRepeatSidewalk = Math.round(length / 5); // 8 exact sidewalk tile cycles per 40m

  return {
    asphalt: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: 0, width: ROAD_WIDTH,
      heightOffset: 0.04, uRepeat: 1, vRepeat: vRepeatAsphalt, profileFn
    }),
    leftCurb: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: -9.25, width: 0.5,
      heightOffset: 0.075, uRepeat: 1, vRepeat: vRepeatCurb, profileFn
    }),
    rightCurb: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: 9.25, width: 0.5,
      heightOffset: 0.075, uRepeat: 1, vRepeat: vRepeatCurb, profileFn
    }),
    leftSidewalk: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: -11.2, width: 3.4,
      heightOffset: 0.09, uRepeat: 1, vRepeat: vRepeatSidewalk, profileFn
    }),
    rightSidewalk: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: 11.2, width: 3.4,
      heightOffset: 0.09, uRepeat: 1, vRepeat: vRepeatSidewalk, profileFn
    }),
    leftShoulder: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: -14.3, width: 2.8,
      heightOffset: 0.02, uRepeat: 1, vRepeat: 2, profileFn
    }),
    rightShoulder: buildSegmentStripGeometry({
      length, segmentsZ, lateralOffset: 14.3, width: 2.8,
      heightOffset: 0.02, uRepeat: 1, vRepeat: 2, profileFn
    })
  };
}

/**
 * Assemble a pooled THREE.Group visual from shared geometries & stage materials.
 */
export function createHighwayVisualGroup(sharedGeos, materials, name) {
  const group = new THREE.Group();
  group.name = name;

  const addStrip = (geo, mat) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const meshes = {
    asphalt: addStrip(sharedGeos.asphalt, materials.asphaltMat),
    leftCurb: addStrip(sharedGeos.leftCurb, materials.curbMat),
    rightCurb: addStrip(sharedGeos.rightCurb, materials.curbMat),
    leftSidewalk: addStrip(sharedGeos.leftSidewalk, materials.sidewalkMat),
    rightSidewalk: addStrip(sharedGeos.rightSidewalk, materials.sidewalkMat),
    leftShoulder: addStrip(sharedGeos.leftShoulder, materials.shoulderMat),
    rightShoulder: addStrip(sharedGeos.rightShoulder, materials.shoulderMat)
  };

  group.userData.stripMeshes = meshes;
  return group;
}

/**
 * Apply a new stage's shared materials to an already-pooled visual group without recreating meshes.
 */
export function applyMaterialsToVisual(visual, materials) {
  const m = visual?.userData?.stripMeshes;
  if (!m || !materials) return;
  m.asphalt.material = materials.asphaltMat;
  m.leftCurb.material = materials.curbMat;
  m.rightCurb.material = materials.curbMat;
  m.leftSidewalk.material = materials.sidewalkMat;
  m.rightSidewalk.material = materials.sidewalkMat;
  m.leftShoulder.material = materials.shoulderMat;
  m.rightShoulder.material = materials.shoulderMat;
}

/**
 * Create a standardized RoadSegment instance separating logic, visual, collision, and navigation.
 */
export function createRoadSegment({
  type,
  length,
  layer = RoadLayer.GROUND,
  deltaX = 0,
  deltaY = 0,
  visual,
  sampleLocalProfile
}) {
  const segment = {
    // ── Pool lifecycle ──
    active: false,

    // ── Lightweight Logical Representation ──
    id: `seg_${_nextSegmentId++}`,
    type,
    layer,
    length,
    deltaX,
    deltaY,
    zStart: 0,
    zEnd: -length,
    xStart: 0,
    yStart: 0,
    xEnd: deltaX,
    yEnd: deltaY,
    lanes: LANE_CENTERS,
    entrances: [{ x: 0, y: 0, z: 0, yaw: 0, layer }],
    exits: [{ id: "main", x: deltaX, y: deltaY, z: -length, yaw: 0, layer }],

    // ── Decoupled Visual Group ──
    visual,

    // ── Lightweight Collision Metadata (Zero Mesh Inspection) ──
    collision: {
      layer,
      halfWidth: ROAD_WIDTH * 0.5,
      isTunnel: layer === RoadLayer.UNDERGROUND,
      hasCeiling: layer === RoadLayer.UNDERGROUND
    },

    // ── Analytical Navigation Sampler (Zero Allocation) ──
    navigation: {
      sampleLocal: sampleLocalProfile,
      sampleWorld(zWorld, lateralOffset, out) {
        const t = Math.max(0, Math.min(1, (segment.zStart - zWorld) / segment.length));
        sampleLocalProfile(t, out);
        const heading = out.heading;
        const cosH = Math.cos(heading);
        const sinH = Math.sin(heading);

        const worldCenterX = segment.xStart + out.x;
        const worldCenterY = segment.yStart + out.y;

        out.x = worldCenterX + lateralOffset * cosH;
        out.y = worldCenterY;
        out.z = zWorld - lateralOffset * sinH;
        out.layer = segment.layer;
        out.segmentType = segment.type;
        return out;
      }
    }
  };

  return segment;
}

/**
 * Position a recycled RoadSegment seamlessly at the previous segment's exit coordinates.
 */
export function placeSegmentAt(segment, xStart, yStart, zStart, materials = null) {
  segment.xStart = xStart;
  segment.yStart = yStart;
  segment.zStart = zStart;

  segment.xEnd = xStart + segment.deltaX;
  segment.yEnd = yStart + segment.deltaY;
  segment.zEnd = zStart - segment.length;

  segment.entrances[0].x = xStart;
  segment.entrances[0].y = yStart;
  segment.entrances[0].z = zStart;

  segment.exits[0].x = segment.xEnd;
  segment.exits[0].y = segment.yEnd;
  segment.exits[0].z = segment.zEnd;

  if (materials) {
    applyMaterialsToVisual(segment.visual, materials);
  }

  segment.visual.position.set(xStart, yStart, zStart);
  segment.visual.visible = true;
  return segment;
}
