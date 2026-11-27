import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/* ================================================================
   SHARED ROAD MATERIALS & BAKED PROCEDURAL TEXTURES
   - Bakes dashed white lane dividers, solid edge lines, tire tracks,
     and tarmac grain directly into a single 512x512 asphalt texture.
   - Eliminates 96 individual lane-dash PlaneGeometry draw calls and
     per-frame mesh transforms!
   - Caches materials per stageId so all pooled segments share GPU state.
================================================================ */

const _stageMaterialCache = new Map();

function createBakedHighwayAsphaltTexture(roadColor, laneColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // 1. Base asphalt fill
  ctx.fillStyle = roadColor || "#1e293b";
  ctx.fillRect(0, 0, 512, 512);

  // 2. Subtle tarmac aggregate grain
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 14 - 7;
    data[i]     = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Subtle darkened tire wear paths down each of the 5 lanes
  const laneWidthPx = 512 / 5;
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  for (let lane = 0; lane < 5; lane++) {
    const cx = lane * laneWidthPx + laneWidthPx * 0.5;
    ctx.fillRect(cx - 24, 0, 14, 512);
    ctx.fillRect(cx + 10, 0, 14, 512);
  }

  // 4. Solid outer highway edge lines (baked — zero extra meshes)
  ctx.fillStyle = laneColor || "#f8fafc";
  ctx.fillRect(6, 0, 6, 512);
  ctx.fillRect(500, 0, 6, 512);

  // 5. Dashed lane divider lines between the 5 lanes (4 dividers, 4 dashes per tile)
  const dashCount = 4;
  const tileStep = 512 / dashCount;
  const dashLen = tileStep * 0.44;
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";

  for (let div = 1; div <= 4; div++) {
    const x = Math.round(div * laneWidthPx) - 2;
    // Double subtle amber divider between oncoming (lanes 0-1) and cruising (lanes 2-4)
    if (div === 2) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.92)";
      ctx.fillRect(x - 3, 0, 3, 512);
      ctx.fillRect(x + 3, 0, 3, 512);
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
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

function createCurbTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#e11d48";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 64, 64, 64);

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

  ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
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
 * Get (or create & cache) the shared material set for a stage theme.
 * All pooled road segments reuse these exact material instances.
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
  const curbTex = createCurbTexture();
  const sidewalkTex = createSidewalkTexture(stageConfig?.sidewalkColor);

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.4,
    metalness: 0.2,
    side: THREE.FrontSide
  });

  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.65,
    metalness: 0.05,
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
    curbMat,
    sidewalkMat,
    shoulderMat,
    textures: [asphaltTex, curbTex, sidewalkTex]
  };

  _stageMaterialCache.set(key, bundle);
  return bundle;
}
