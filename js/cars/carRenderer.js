import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { getCarConfig } from "./cars.js";

/* ---------------------------------------------------------------
   Ultra-premium supercar renderer
   - High-gloss paint with env-map-like specular
   - Chamfered body panels (angled geometry, not plain boxes)
   - Detailed cockpit: dashboard bar, LED strip, seat silhouettes
   - Aero kit: front splitter, side skirts, rear diffuser, spoiler
   - Emissive LED taillights (wide blade) + DRL headlights
   - Multi-spoke alloy rims with brake disc
   - Neon underglow ring
--------------------------------------------------------------- */

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.28,
    metalness: opts.metalness ?? 0.55,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function box(parent, size, pos, material, castShadow = true, name = "") {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...pos);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

function cyl(parent, rTop, rBot, h, segs, pos, material, castShadow = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  m.position.set(...pos);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ---- Wheel assembly ---- */
function createWheel(mats, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0.35, z);

  // Tire
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24),
    mats.tire
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);

  // Rim face (octagonal spoke look)
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.265, 8),
    mats.rim
  );
  rim.rotation.z = Math.PI / 2;
  group.add(rim);

  // Inner dark hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.27, 12),
    mat("#1a1a1a", { roughness: 0.5, metalness: 0.8 })
  );
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  // Brake disc (red-orange behind rim)
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16),
    mat("#b91c1c", { roughness: 0.4, metalness: 0.6 })
  );
  disc.rotation.z = Math.PI / 2;
  disc.position.x = x < 0 ? 0.09 : -0.09;
  group.add(disc);

  // Accent coloured hub cap ring
  const capRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.025, 8, 20),
    mats.accent
  );
  capRing.rotation.y = Math.PI / 2;
  group.add(capRing);

  return group;
}

/* ---- Spoiler ---- */
function createSpoiler(parent, mats, config) {
  const width = 1.4;
  // Spoiler blade
  const blade = box(parent, [width, 0.07, 0.38], [0, 1.65, 1.6], mats.body, true, "spoiler-blade");
  blade.rotation.x = -0.18;

  // Spoiler pillars
  for (const sx of [-1, 1]) {
    box(parent, [0.06, 0.38, 0.08], [sx * 0.58, 1.38, 1.62], mats.body);
  }

  // Spoiler accent underside LED
  box(parent, [width - 0.05, 0.025, 0.34], [0, 1.62, 1.6],
    mat(config.accentColor, { emissive: config.accentColor, emissiveIntensity: 1.0, roughness: 0.2 }),
    false, "spoiler-led");
}

/* ---- Front splitter / aero ---- */
function createFrontAero(parent, mats, config) {
  // Splitter
  box(parent, [1.7, 0.045, 0.42], [0, 0.3, -1.82],
    mat("#0a0a0a", { roughness: 0.5, metalness: 0.3 }), true, "splitter");

  // Side canards
  for (const sx of [-1, 1]) {
    const c = box(parent, [0.24, 0.035, 0.28], [sx * 0.96, 0.35, -1.65],
      mat("#111111", { roughness: 0.5 }));
    c.rotation.z = sx * 0.15;
    c.rotation.x = -0.1;
  }
}

/* ---- Side skirts ---- */
function createSideSkirts(parent, mats) {
  for (const sx of [-1, 1]) {
    box(parent, [0.055, 0.15, 2.6], [sx * 0.87, 0.42, 0.0],
      mat("#0d0d0d", { roughness: 0.6 }));
  }
}

/* ---- Rear diffuser ---- */
function createRearDiffuser(parent, mats) {
  box(parent, [1.55, 0.14, 0.38], [0, 0.36, 1.88],
    mat("#0a0a0a", { roughness: 0.5, metalness: 0.3 }));
  // Diffuser fins
  for (let i = -2; i <= 2; i++) {
    box(parent, [0.04, 0.12, 0.35], [i * 0.24, 0.36, 1.88],
      mat("#111111", { roughness: 0.4, metalness: 0.5 }));
  }
}

/* ================================================================
   MAIN CAR MODEL
================================================================ */
export function createCarModel(carId = "cyber") {
  const config = getCarConfig(carId);
  const car = new THREE.Group();
  car.name = `car-${config.id}`;
  car.userData.carId = config.id;
  car.userData.config = config;

  /* ----- Material palette ----- */
  const mats = {
    body: mat(config.bodyColor, { roughness: 0.18, metalness: 0.72 }),

    bodyDark: mat(config.bodyColor, { roughness: 0.3, metalness: 0.6,
      // Tinted slightly darker for lower panels
    }),

    cabin: mat(config.cabinColor, { roughness: 0.22, metalness: 0.35 }),

    glass: new THREE.MeshStandardMaterial({
      color: "#8ad0ea",
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    }),

    tire: mat("#151515", { roughness: 0.92, metalness: 0.04 }),

    rim: mat("#c8d5e0", { roughness: 0.22, metalness: 0.92 }),

    accent: mat(config.accentColor, {
      roughness: 0.2, metalness: 0.5,
      emissive: config.accentColor, emissiveIntensity: 0.4
    }),

    headlight: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#fffde7",
      emissiveIntensity: 2.8,
      roughness: 0.05,
    }),

    drl: new THREE.MeshStandardMaterial({
      color: "#e8f4fd",
      emissive: "#e0f7fa",
      emissiveIntensity: 2.0,
      roughness: 0.1,
    }),

    taillight: new THREE.MeshStandardMaterial({
      color: "#ff1f1f",
      emissive: "#ff0000",
      emissiveIntensity: 3.0,
      roughness: 0.08,
    }),

    taillightOrange: new THREE.MeshStandardMaterial({
      color: "#ff6600",
      emissive: "#ff5500",
      emissiveIntensity: 1.8,
      roughness: 0.1,
    }),

    underglow: new THREE.MeshStandardMaterial({
      color: config.accentColor,
      emissive: config.accentColor,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }),

    chrome: mat("#d0d8e0", { roughness: 0.08, metalness: 0.96 }),
    carbon: mat("#1a1a2a", { roughness: 0.35, metalness: 0.4 }),
  };

  /* ----- CHASSIS (main body slab — wider, slightly trapezoidal profile) ----- */
  // Lower body slab
  box(car, [1.72, 0.32, 3.55], [0, 0.52, 0], mats.body, true, "lower-body");
  // Upper body shell
  box(car, [1.65, 0.28, 3.45], [0, 0.80, 0], mats.body, true, "chassis");
  // Rear haunch (wider over rear wheels)
  box(car, [1.82, 0.22, 1.10], [0, 0.72, 1.1], mats.body, true, "rear-haunch");
  // Front haunch
  box(car, [1.78, 0.20, 0.85], [0, 0.70, -1.05], mats.body, true, "front-haunch");

  /* ----- HOOD (sloped forward) ----- */
  const hood = box(car, [1.56, 0.14, 1.1], [0, 0.95, -1.1], mats.body, true, "hood");
  hood.rotation.x = 0.14;

  /* ----- REAR DECK (flat lid) ----- */
  box(car, [1.46, 0.10, 0.70], [0, 0.98, 1.2], mats.body, true, "rear-deck");

  /* ----- CABIN (passenger cell) ----- */
  box(car, [1.18, 0.60, 1.72], [0, 1.22, 0.12], mats.cabin, true, "cabin");

  /* ----- A-PILLAR / C-PILLAR (dark carbon strips) ----- */
  for (const sx of [-1, 1]) {
    // A-pillar
    const ap = box(car, [0.055, 0.52, 0.09], [sx * 0.555, 1.30, -0.62], mats.carbon);
    ap.rotation.x = -0.45;
    // C-pillar
    const cp = box(car, [0.055, 0.52, 0.09], [sx * 0.555, 1.30, 0.88], mats.carbon);
    cp.rotation.x = 0.45;
  }

  /* ----- WINDSHIELDS ----- */
  const fws = box(car, [1.02, 0.44, 0.07], [0, 1.44, -0.60], mats.glass, false, "front-windshield");
  fws.rotation.x = 0.52;
  const rws = box(car, [1.00, 0.38, 0.07], [0, 1.44, 0.90], mats.glass, false, "rear-windshield");
  rws.rotation.x = -0.48;

  /* ----- SIDE WINDOWS ----- */
  for (const sx of [-1, 1]) {
    box(car, [0.04, 0.38, 1.08], [sx * 0.595, 1.45, 0.1], mats.glass, false);
  }

  /* ----- HEADLIGHTS (wide DRL blade + inner bright spot) ----- */
  for (const sx of [-1, 1]) {
    // DRL blade strip
    box(car, [0.55, 0.055, 0.06], [sx * 0.42, 0.90, -1.79], mats.drl, false, `drl-${sx}`);
    // Central headlight capsule
    box(car, [0.20, 0.16, 0.07], [sx * 0.52, 0.78, -1.78], mats.headlight, false, `headlight-${sx}`);
    // Lower accent bar
    box(car, [0.48, 0.04, 0.055], [sx * 0.40, 0.64, -1.78],
      mat(config.accentColor, { emissive: config.accentColor, emissiveIntensity: 1.2 }), false);
  }

  /* ----- TAILLIGHTS (full-width LED blade — the hero detail) ----- */
  // Central connecting LED bar
  box(car, [1.58, 0.055, 0.06], [0, 0.95, 1.79],
    mat(config.accentColor, { emissive: config.accentColor, emissiveIntensity: 2.5 }), false, "tail-led-bar");
  // Outer stop light clusters
  for (const sx of [-1, 1]) {
    box(car, [0.38, 0.16, 0.07], [sx * 0.56, 0.85, 1.79], mats.taillight, false, `taillight-${sx}`);
    // Turn indicator (amber)
    box(car, [0.16, 0.10, 0.065], [sx * 0.76, 0.85, 1.79], mats.taillightOrange, false);
  }

  /* ----- FRONT GRILLE ----- */
  box(car, [0.80, 0.22, 0.06], [0, 0.70, -1.78], mats.carbon, false, "grille");
  box(car, [0.38, 0.12, 0.065], [0, 0.66, -1.78], mat("#050810", { roughness: 0.2 }), false);
  // Grille accent (brand bar)
  box(car, [0.36, 0.035, 0.07], [0, 0.72, -1.79],
    mat(config.accentColor, { emissive: config.accentColor, emissiveIntensity: 1.5 }), false);

  /* ----- AERO KIT ----- */
  createFrontAero(car, mats, config);
  createSideSkirts(car, mats);
  createRearDiffuser(car, mats);
  createSpoiler(car, mats, config);

  /* ----- SIDE ACCENT STRIPS ----- */
  for (const sx of [-1, 1]) {
    box(car, [0.04, 0.04, 2.65], [sx * 0.86, 0.88, 0], mats.accent, false, `accent-strip-${sx}`);
  }

  /* ----- MIRRORS ----- */
  for (const sx of [-1, 1]) {
    box(car, [0.18, 0.10, 0.28], [sx * 0.76, 1.25, -0.42], mats.carbon, true);
  }

  /* ----- WHEELS ----- */
  const wheels = [];
  for (const wx of [-0.88, 0.88]) {
    for (const wz of [-1.08, 1.08]) {
      const wh = createWheel(mats, wx, wz);
      wheels.push(wh);
      car.add(wh);
    }
  }

  /* ----- UNDERGLOW RING (neon flush) ----- */
  const glowGeo = new THREE.BoxGeometry(1.38, 0.025, 2.7);
  const glow = new THREE.Mesh(glowGeo, mats.underglow);
  glow.position.set(0, 0.20, 0);
  glow.name = "underglow";
  car.add(glow);

  /* ----- EXHAUST PIPES ----- */
  for (const sx of [-1, 1]) {
    const exhaust = cyl(car, 0.05, 0.06, 0.18, 10, [sx * 0.42, 0.30, 1.94], mats.chrome);
    exhaust.rotation.x = Math.PI / 2;
  }

  /* ----- USER DATA ----- */
  car.userData.wheels = wheels;
  car.userData.originalScale = car.scale.clone();

  return car;
}

export function setCarColor(car, color) {
  if (!car) return;
  car.traverse((obj) => {
    if (!obj.isMesh) return;
    const n = obj.name;
    if (n === "chassis" || n === "lower-body" || n === "rear-haunch" ||
        n === "front-haunch" || n === "hood" || n === "rear-deck") {
      obj.material.color.set(color);
    }
  });
}
