import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const MATERIALS = {
  barrier: new THREE.MeshStandardMaterial({
    color: 0xff453a,
    roughness: 0.65,
    metalness: 0.1
  }),

  crate: new THREE.MeshStandardMaterial({
    color: 0xb87942,
    roughness: 0.85
  }),

  cone: new THREE.MeshStandardMaterial({
    color: 0xff8c24,
    roughness: 0.7
  }),

  coneStripe: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55
  }),

  gate: new THREE.MeshStandardMaterial({
    color: 0xffcc33,
    roughness: 0.55,
    metalness: 0.15
  }),

  gateDark: new THREE.MeshStandardMaterial({
    color: 0x343b46,
    roughness: 0.7,
    metalness: 0.2
  }),

  oil: new THREE.MeshStandardMaterial({
    color: 0x171923,
    roughness: 0.25,
    metalness: 0.25
  })
};

function createBox(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function createBarrier(group) {
  // Low road barrier: compact enough to jump over.
  group.add(
    createBox(
      1.9, 0.72, 0.48,
      MATERIALS.barrier,
      0, 0.36, 0
    )
  );

  // Reflective horizontal stripe.
  group.add(
    createBox(
      1.92, 0.12, 0.495,
      MATERIALS.coneStripe,
      0, 0.42, 0
    )
  );
}

function createCrate(group) {
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 1.05, 1.05),
    MATERIALS.crate
  );

  crate.position.y = 0.525;
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);

  // Dark reinforcing strips on the front.
  group.add(
    createBox(
      0.12, 1.07, 1.065,
      MATERIALS.gateDark,
      -0.3, 0.525, 0
    )
  );

  group.add(
    createBox(
      0.12, 1.07, 1.065,
      MATERIALS.gateDark,
      0.3, 0.525, 0
    )
  );
}

function createCone(group) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.95, 8),
    MATERIALS.cone
  );

  cone.position.y = 0.475;
  cone.castShadow = true;
  cone.receiveShadow = true;
  group.add(cone);

  // Wide, flat base.
  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.46, 0.12, 8),
    MATERIALS.cone
  );
  baseMesh.position.y = 0.06;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // White reflective band.
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.36, 0.12, 8),
    MATERIALS.coneStripe
  );

  stripe.position.y = 0.43;
  stripe.castShadow = true;
  group.add(stripe);
}

function createGate(group) {
  // Two narrow supports positioned within one lane.
  group.add(
    createBox(
      0.14, 2.25, 0.16,
      MATERIALS.gateDark,
      -0.95, 1.125, 0
    )
  );

  group.add(
    createBox(
      0.14, 2.25, 0.16,
      MATERIALS.gateDark,
      0.95, 1.125, 0
    )
  );

  // Low-width overhead bar.
  group.add(
    createBox(
      2.05, 0.28, 0.24,
      MATERIALS.gate,
      0, 2.0, 0
    )
  );

  // Dark warning stripe across the overhead bar.
  group.add(
    createBox(
      1.95, 0.055, 0.25,
      MATERIALS.gateDark,
      0, 2.0, 0
    )
  );
}

function createOil(group) {
  const oil = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20),
    MATERIALS.oil
  );

  oil.rotation.x = -Math.PI / 2;
  oil.position.y = 0.035;
  oil.scale.set(1.0, 0.72, 1.0);
  oil.receiveShadow = true;
  group.add(oil);

  // A second overlapping patch gives the puddle an irregular edge.
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 16),
    MATERIALS.oil
  );

  patch.rotation.x = -Math.PI / 2;
  patch.position.set(0.35, 0.037, 0.12);
  patch.scale.set(1.0, 0.75, 1.0);
  group.add(patch);
}

/**
 * Creates a 3D obstacle model.
 *
 * Supported types:
 * barrier, crate, cone, gate, oil
 *
 * Returns a THREE.Group so obstacles.js can position and rotate
 * the entire obstacle as one object.
 */
export function createObstacleModel(type = "barrier") {
  const group = new THREE.Group();

  switch (type) {
    case "barrier":
      createBarrier(group);
      break;

    case "crate":
      createCrate(group);
      break;

    case "cone":
      createCone(group);
      break;

    case "gate":
      createGate(group);
      break;

    case "oil":
      createOil(group);
      break;

    default:
      console.warn(`Unknown obstacle type "${type}". Using barrier.`);
      createBarrier(group);
      break;
  }

  group.name = `obstacle-${type}`;
  group.userData.type = type;

  return group;
}
