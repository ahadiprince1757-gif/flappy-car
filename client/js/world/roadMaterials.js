import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/* ================================================================
   UNIFIED CITY ROAD MATERIALS & PROCEDURAL TEXTURES
   Every highway, cross-avenue, roundabout, off-ramp, flyover, and
   tunnel shares the EXACT same tarmac palette & roughness so all
   connected roads merge invisibly with zero color seams!
================================================================ */

const _stageMaterialCache = new Map();

function paintAsphaltBase(ctx, w, h, roadColor) {
  ctx.fillStyle = roadColor || "#1e293b";
  ctx.fillRect(0, 0, w, h);

  // Subtle realistic tarmac aggregate grain
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 12 - 6;
    data[i]     = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Standard 5-lane highway texture (dashed dividers, double amber median, crisp edge lines)
 */
function createBakedHighwayAsphaltTexture(roadColor, laneColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  paintAsphaltBase(ctx, 512, 512, roadColor);

  // Subtle darkened tire wear paths down each of the 5 lanes
  const laneWidthPx = 512 / 5;
  ctx.fillStyle = "rgba(0, 0, 0, 0.13)";
  for (let lane = 0; lane < 5; lane++) {
    const cx = lane * laneWidthPx + laneWidthPx * 0.5;
    ctx.fillRect(cx - 22, 0, 12, 512);
    ctx.fillRect(cx + 10, 0, 12, 512);
  }

  // Solid outer highway edge lines
  ctx.fillStyle = laneColor || "#f8fafc";
  ctx.fillRect(6, 0, 5, 512);
  ctx.fillRect(501, 0, 5, 512);

  // Dashed lane dividers (4 cycles per tile)
  const dashCount = 4;
  const tileStep = 512 / dashCount;
  const dashLen = tileStep * 0.44;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";

  for (let div = 1; div <= 4; div++) {
    const x = Math.round(div * laneWidthPx) - 2;
    if (div === 2) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
      ctx.fillRect(x - 3, 0, 3, 512);
      ctx.fillRect(x + 3, 0, 3, 512);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    } else {
      for (let d = 0; d < dashCount; d++) {
        ctx.fillRect(x, d * tileStep + 18, 4, dashLen);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Seamless plain tarmac texture (identical base color & grain, NO stripes)
 * Used inside intersection centers, roundabout plazas, and smooth merge aprons!
 */
function createSeamlessPlainAsphaltTexture(roadColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  paintAsphaltBase(ctx, 256, 256, roadColor);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Connecting city cross-avenue texture (matches exact tarmac color & grain!)
 */
function createConnectingAvenueTexture(roadColor, laneColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  paintAsphaltBase(ctx, 512, 256, roadColor);

  // Subtle tire wear
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(0, 44, 512, 24);
  ctx.fillRect(0, 188, 512, 24);

  // Outer edge lines
  ctx.fillStyle = laneColor || "#f8fafc";
  ctx.fillRect(0, 7, 512, 5);
  ctx.fillRect(0, 244, 512, 5);

  // Double amber center median
  ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
  ctx.fillRect(0, 123, 512, 3);
  ctx.fillRect(0, 130, 512, 3);

  // Dashed lane lines
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  for (let x = 16; x < 512; x += 64) {
    ctx.fillRect(x, 65, 28, 4);
    ctx.fillRect(x, 187, 28, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(5, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Clean urban stone curb texture (modern concrete curb — looks like a real city!)
 */
function createCurbTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(0, 0, 64, 4);
  ctx.fillRect(0, 64, 64, 4);

  // Subtle stone bevel shading
  const grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, "rgba(15,23,42,0.18)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.08)");
  grad.addColorStop(1, "rgba(15,23,42,0.18)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSidewalkTexture(sidewalkColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = sidewalkColor || "#94a3b8";
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = "rgba(15, 23, 42, 0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 60, 60);
  ctx.strokeRect(66, 2, 60, 60);
  ctx.strokeRect(2, 66, 60, 60);
  ctx.strokeRect(66, 66, 60, 60);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Get (or create & cache) the unified material set for a stage theme.
 */
export function getRoadMaterials(stageConfig) {
  const key = stageConfig?.id || "city";
  if (_stageMaterialCache.has(key)) {
    return _stageMaterialCache.get(key);
  }

  const asphaltTex = createBakedHighwayAsphaltTexture(
    stageConfig?.roadColor,
    stageConfig?.laneColor
  );
  const plainAsphaltTex = createSeamlessPlainAsphaltTexture(stageConfig?.roadColor);
  const avenueTex = createConnectingAvenueTexture(
    stageConfig?.roadColor,
    stageConfig?.laneColor
  );
  const curbTex = createCurbTexture();
  const sidewalkTex = createSidewalkTexture(stageConfig?.sidewalkColor);

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.42,
    metalness: 0.18,
    side: THREE.FrontSide
  });

  const plainAsphaltMat = new THREE.MeshStandardMaterial({
    map: plainAsphaltTex,
    roughness: 0.42,
    metalness: 0.18,
    side: THREE.FrontSide
  });

  const avenueMat = new THREE.MeshStandardMaterial({
    map: avenueTex,
    roughness: 0.42,
    metalness: 0.18,
    side: THREE.FrontSide
  });

  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.72,
    metalness: 0.08,
    side: THREE.FrontSide
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.85,
    metalness: 0.04,
    side: THREE.FrontSide
  });

  const shoulderMat = new THREE.MeshStandardMaterial({
    color: stageConfig?.groundColor || "#475569",
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.FrontSide
  });

  const bundle = {
    asphaltMat,
    plainAsphaltMat,
    avenueMat,
    curbMat,
    sidewalkMat,
    shoulderMat,
    textures: [asphaltTex, plainAsphaltTex, avenueTex, curbTex, sidewalkTex]
  };

  _stageMaterialCache.set(key, bundle);
  return bundle;
}
