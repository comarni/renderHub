/* ═══════════════════════════════════════════════════════════════
   ProceduralGenerator — Builds 3D models from assembled primitives
   ═══════════════════════════════════════════════════════════════
   Each generator returns a THREE.Group placed so the bottom of
   the object sits at y = 0 (floor level).
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ── Geometry / mesh helpers ────────────────────────────────── */

function mat(color, roughness = 0.72, metalness = 0.0, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    ...extra,
  });
}

function mkBox(w, h, d, x, y, z, color, roughness, metalness, extra) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(color, roughness ?? 0.72, metalness ?? 0.0, extra ?? {})
  );
  m.position.set(x, y, z);
  return m;
}

function mkCyl(rt, rb, h, x, y, z, color, roughness, metalness, segs = 12) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, segs),
    mat(color, roughness ?? 0.72, metalness ?? 0.0)
  );
  m.position.set(x, y, z);
  return m;
}

function mkSph(r, x, y, z, color, roughness, metalness) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12),
    mat(color, roughness ?? 0.72, metalness ?? 0.0)
  );
  m.position.set(x, y, z);
  return m;
}

function mkCone(r, h, segs, x, y, z, color, roughness) {
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(r, h, segs),
    mat(color, roughness ?? 0.72)
  );
  m.position.set(x, y, z);
  return m;
}

/* ── Individual object generators ───────────────────────────── */

function makeDog(mainColor = '#c8956c') {
  const C    = mainColor;
  const dark = '#7a4828';
  const nose = '#111111';
  const g    = new THREE.Group();

  // Legs (4) — bottom at y=0, center at legH/2
  const legH = 0.38, legR = 0.07, legY = legH / 2;
  [
    [ 0.29, legY,  0.15],
    [ 0.29, legY, -0.15],
    [-0.29, legY,  0.15],
    [-0.29, legY, -0.15],
  ].forEach(([x, y, z]) => g.add(mkCyl(legR, legR, legH, x, y, z, C)));

  // Torso
  g.add(mkBox(0.82, 0.40, 0.44, 0, legH + 0.20, 0, C));

  // Neck
  g.add(mkBox(0.20, 0.23, 0.20, 0.40, legH + 0.41, 0, C));

  // Head
  const headY = legH + 0.55;
  g.add(mkBox(0.35, 0.30, 0.32, 0.61, headY, 0, C));

  // Snout
  g.add(mkBox(0.22, 0.14, 0.22, 0.83, headY - 0.05, 0, C));

  // Nose tip
  g.add(mkBox(0.07, 0.07, 0.07, 0.95, headY - 0.01, 0, nose));

  // Eyes
  [0.14, -0.14].forEach(z =>
    g.add(mkBox(0.05, 0.05, 0.04, 0.80, headY + 0.06, z, nose)));

  // Ears (darker)
  [0.13, -0.13].forEach(z =>
    g.add(mkBox(0.10, 0.16, 0.10, 0.58, headY + 0.23, z, dark)));

  // Tail (tilted backward-upward)
  const tail = mkCyl(0.056, 0.040, 0.32, -0.47, legH + 0.36, 0, C);
  tail.rotation.z = -Math.PI * 0.33;
  g.add(tail);

  return g;
}

function makeCat(mainColor = '#888888') {
  const C    = mainColor;
  const dark = '#505050';
  const g    = new THREE.Group();

  // Legs
  const legH = 0.33, legR = 0.055, legY = legH / 2;
  [
    [ 0.22, legY,  0.12],
    [ 0.22, legY, -0.12],
    [-0.22, legY,  0.12],
    [-0.22, legY, -0.12],
  ].forEach(([x, y, z]) => g.add(mkCyl(legR, legR, legH, x, y, z, C)));

  // Body
  g.add(mkBox(0.68, 0.34, 0.38, 0, legH + 0.17, 0, C));

  // Head
  const headY = legH + 0.44;
  g.add(mkBox(0.30, 0.27, 0.27, 0.47, headY, 0, C));

  // Snout
  g.add(mkBox(0.15, 0.10, 0.18, 0.65, headY - 0.06, 0, C));

  // Nose
  g.add(mkBox(0.05, 0.04, 0.04, 0.74, headY - 0.03, 0, '#cc4466'));

  // Eyes
  [0.10, -0.10].forEach(z =>
    g.add(mkBox(0.06, 0.04, 0.03, 0.66, headY + 0.05, z, '#22aa44')));

  // Pointy ears (4-sided cones)
  [0.10, -0.10].forEach(z => {
    const ear = mkCone(0.07, 0.17, 4, 0.46, headY + 0.22, z, dark);
    ear.rotation.y = Math.PI / 4;
    g.add(ear);
  });

  // Tail (two segments, curving up)
  const t1 = mkCyl(0.045, 0.04, 0.48, -0.47, legH + 0.22, 0, C);
  t1.rotation.z = Math.PI * 0.28;
  g.add(t1);
  const t2 = mkCyl(0.038, 0.032, 0.30, -0.62, legH + 0.52, 0.20, C);
  t2.rotation.x = Math.PI * 0.35;
  g.add(t2);

  return g;
}

function makeCar(mainColor = '#cc2200') {
  const C       = mainColor;
  const wheelC  = '#222222';
  const glassC  = '#88ccee';
  const rimC    = '#cccccc';
  const darkC   = '#333333';
  const g       = new THREE.Group();

  const wR = 0.22, wD = 0.13;
  const wY = wR; // wheel center y

  // Wheels + rims
  [
    [ 0.56, wY,  0.47],
    [ 0.56, wY, -0.47],
    [-0.56, wY,  0.47],
    [-0.56, wY, -0.47],
  ].forEach(([x, y, z]) => {
    const wheel = mkCyl(wR, wR, wD, x, y, z, wheelC, 0.9, 0);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
    const rim = mkCyl(wR * 0.54, wR * 0.54, wD + 0.01, x, y, z, rimC, 0.3, 0.9);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
  });

  // Lower body (hood + trunk)
  const bodyBaseY = wY * 2 + 0.04;
  g.add(mkBox(1.88, 0.30, 0.90, 0, bodyBaseY + 0.15, 0, C, 0.4));

  // Upper cab
  const cabY = bodyBaseY + 0.30 + 0.18;
  g.add(mkBox(0.96, 0.36, 0.84, -0.02, cabY, 0, C, 0.4));

  // Windshield front (semi-transparent glass)
  const wsGeo  = new THREE.BoxGeometry(0.05, 0.31, 0.76);
  const wsMat  = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glassC), roughness: 0.05, metalness: 0.1,
    transparent: true, opacity: 0.55,
  });
  const wsF = new THREE.Mesh(wsGeo, wsMat);
  wsF.position.set(0.50, cabY, 0);
  g.add(wsF);
  const wsR = wsF.clone();
  wsR.position.set(-0.50, cabY, 0);
  g.add(wsR);

  // Front bumper
  g.add(mkBox(0.10, 0.15, 0.90, 0.98, bodyBaseY + 0.075, 0, darkC, 0.8));
  // Rear bumper
  g.add(mkBox(0.10, 0.15, 0.90, -0.98, bodyBaseY + 0.075, 0, darkC, 0.8));

  // Headlights
  [0.32, -0.32].forEach(z =>
    g.add(mkBox(0.06, 0.09, 0.15, 0.98, bodyBaseY + 0.20, z, '#ffffee', 0.1)));

  // Taillights
  [0.32, -0.32].forEach(z =>
    g.add(mkBox(0.06, 0.09, 0.15, -0.98, bodyBaseY + 0.20, z, '#ee2200', 0.2)));

  return g;
}

function makeHouse(mainColor = '#e8c880') {
  const W      = mainColor;
  const roofC  = '#aa3322';
  const doorC  = '#8B562E';
  const glassC = '#88ccee';
  const chimC  = '#888888';
  const g      = new THREE.Group();

  // Walls
  g.add(mkBox(2.0, 1.5, 1.8, 0, 0.75, 0, W));

  // Pyramid roof (ConeGeometry 4 sides = square pyramid)
  const roof = mkCone(1.44, 1.0, 4, 0, 2.0, 0, roofC, 0.85);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  // Door
  g.add(mkBox(0.38, 0.60, 0.09, 0, 0.30, 0.955, doorC, 0.9));

  // Doorknob
  g.add(mkSph(0.04, 0.20, 0.29, 0.97, doorC));

  // Front windows (2)
  [-0.60, 0.60].forEach(x => {
    g.add(mkBox(0.36, 0.30, 0.09, x, 0.85, 0.955, glassC, 0.1));
    // Cross frame
    g.add(mkBox(0.38, 0.04, 0.10, x, 0.85, 0.945, W));
    g.add(mkBox(0.04, 0.32, 0.10, x, 0.85, 0.945, W));
  });

  // Side windows
  [0.955, -0.955].forEach(z =>
    g.add(mkBox(0.09, 0.30, 0.36, z < 0 ? -0.001 : 0.001, 0.85, 0, glassC, 0.1)));

  // Chimney
  g.add(mkBox(0.22, 0.48, 0.22, 0.56, 2.24, -0.36, chimC));

  return g;
}

function makeTree(mainColor = '#4a9c47') {
  const L      = mainColor;
  const trunkC = '#8B562E';
  const g      = new THREE.Group();

  // Trunk
  g.add(mkCyl(0.13, 0.16, 0.95, 0, 0.475, 0, trunkC, 0.92));

  // Three overlapping foliage spheres
  g.add(mkSph(0.70,    0,    1.55,    0,  L, 0.82));
  g.add(mkSph(0.52, -0.28,  1.22,  0.18, L, 0.88));
  g.add(mkSph(0.52,  0.28,  1.20, -0.15, L, 0.88));

  return g;
}

function makeChair(mainColor = '#8B562E') {
  const W = mainColor;
  const g = new THREE.Group();

  // Seat
  g.add(mkBox(0.52, 0.07, 0.52, 0, 0.50, 0, W));

  // 4 Legs
  const lH = 0.50, lR = 0.04;
  [
    [ 0.21, lH / 2,  0.21],
    [ 0.21, lH / 2, -0.21],
    [-0.21, lH / 2,  0.21],
    [-0.21, lH / 2, -0.21],
  ].forEach(([x, y, z]) => g.add(mkCyl(lR, lR, lH, x, y, z, W)));

  // Backrest posts
  [0.21, -0.21].forEach(z =>
    g.add(mkCyl(0.035, 0.035, 0.52, -0.21, 0.77, z, W)));

  // Backrest horizontal panel
  g.add(mkBox(0.07, 0.48, 0.52, -0.21, 0.78, 0, W));

  return g;
}

function makeTable(mainColor = '#8B562E') {
  const W = mainColor;
  const g = new THREE.Group();

  // Tabletop
  g.add(mkBox(1.46, 0.08, 0.84, 0, 0.76, 0, W));

  // 4 Legs
  const lH = 0.72, lR = 0.06;
  [
    [ 0.63, lH / 2,  0.33],
    [ 0.63, lH / 2, -0.33],
    [-0.63, lH / 2,  0.33],
    [-0.63, lH / 2, -0.33],
  ].forEach(([x, y, z]) => g.add(mkCyl(lR, lR, lH, x, y, z, W)));

  return g;
}

function makeRobot(mainColor = '#888888') {
  const C    = mainColor;
  const dark = '#444444';
  const glow = '#00ccff';

  // Glowing eye/chest material (reused for both eyes)
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glow),
    emissive: new THREE.Color(glow),
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.2,
  });

  const g = new THREE.Group();

  // Feet
  [0.16, -0.16].forEach(x =>
    g.add(mkBox(0.22, 0.08, 0.28, x, 0.04, 0.03, dark)));

  // Lower legs
  const lLH = 0.30;
  [0.16, -0.16].forEach(x =>
    g.add(mkBox(0.16, lLH, 0.18, x, 0.08 + lLH / 2, 0, C)));

  // Upper legs
  const uLH = 0.28;
  [0.16, -0.16].forEach(x =>
    g.add(mkBox(0.18, uLH, 0.20, x, 0.38 + uLH / 2, 0, C)));

  // Hip
  g.add(mkBox(0.52, 0.15, 0.28, 0, 0.70, 0, dark));

  // Torso
  g.add(mkBox(0.56, 0.52, 0.32, 0, 1.04, 0, C));

  // Chest panel + light
  g.add(mkBox(0.07, 0.22, 0.28, 0.31, 1.06, 0, dark));
  const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.10), glowMat.clone());
  chestLight.position.set(0.31, 1.11, 0);
  g.add(chestLight);

  // Shoulders
  [0.38, -0.38].forEach(x =>
    g.add(mkBox(0.16, 0.15, 0.28, x, 1.22, 0, dark)));

  // Upper arms
  const uAH = 0.28;
  [0.40, -0.40].forEach(x =>
    g.add(mkBox(0.14, uAH, 0.16, x, 1.06, 0, C)));

  // Lower arms
  const lAH = 0.26;
  [0.40, -0.40].forEach(x =>
    g.add(mkBox(0.12, lAH, 0.14, x, 0.77, 0, C)));

  // Claws/hands
  [0.40, -0.40].forEach(x =>
    g.add(mkBox(0.19, 0.14, 0.14, x, 0.61, 0, dark)));

  // Neck
  g.add(mkBox(0.18, 0.12, 0.18, 0, 1.35, 0, dark));

  // Head
  g.add(mkBox(0.42, 0.38, 0.36, 0, 1.59, 0, C));

  // Eyes (glowing)
  [0.12, -0.12].forEach(x => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.04), glowMat.clone());
    eye.position.set(x, 1.63, 0.20);
    g.add(eye);
  });

  // Antenna rod + orb
  g.add(mkCyl(0.03, 0.03, 0.22, 0, 1.90, 0, dark));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMat.clone());
  orb.position.set(0, 2.02, 0);
  g.add(orb);

  return g;
}

function makeHuman(mainColor = '#f5c5a3') {
  const skin  = mainColor;
  const shirt = '#3366cc';
  const pants = '#222244';
  const shoes = '#222222';
  const hair  = '#3a2010';
  const g     = new THREE.Group();

  // Shoes
  [0.12, -0.12].forEach(x =>
    g.add(mkBox(0.16, 0.07, 0.26, x, 0.035, 0.06, shoes)));

  // Lower legs
  [0.12, -0.12].forEach(x =>
    g.add(mkBox(0.16, 0.34, 0.17, x, 0.24, 0, pants)));

  // Upper legs
  [0.12, -0.12].forEach(x =>
    g.add(mkBox(0.18, 0.26, 0.20, x, 0.54, 0, pants)));

  // Hip
  g.add(mkBox(0.42, 0.14, 0.26, 0, 0.70, 0, pants));

  // Torso
  g.add(mkBox(0.46, 0.45, 0.28, 0, 0.99, 0, shirt));

  // Shoulders
  [0.31, -0.31].forEach(x =>
    g.add(mkBox(0.14, 0.12, 0.26, x, 1.17, 0, shirt)));

  // Upper arms
  [0.34, -0.34].forEach(x =>
    g.add(mkBox(0.13, 0.28, 0.15, x, 1.02, 0, shirt)));

  // Lower arms (skin)
  [0.34, -0.34].forEach(x =>
    g.add(mkBox(0.12, 0.27, 0.13, x, 0.74, 0, skin)));

  // Hands
  [0.34, -0.34].forEach(x =>
    g.add(mkBox(0.14, 0.13, 0.12, x, 0.59, 0.01, skin)));

  // Neck
  g.add(mkBox(0.16, 0.14, 0.16, 0, 1.26, 0, skin));

  // Head
  g.add(mkBox(0.36, 0.38, 0.34, 0, 1.52, 0, skin));

  // Hair
  g.add(mkBox(0.37, 0.10, 0.35, 0, 1.72, 0, hair));
  g.add(mkBox(0.37, 0.28, 0.06, 0, 1.59, -0.18, hair));

  // Eyes
  [0.10, -0.10].forEach(x =>
    g.add(mkBox(0.06, 0.05, 0.04, x, 1.54, 0.18, '#222222')));

  // Mouth
  g.add(mkBox(0.14, 0.03, 0.04, 0, 1.44, 0.18, '#993333'));

  return g;
}

function makeAirplane(mainColor = '#f4f6fb') {
  const body = mainColor;
  const accent = '#ff6b6b';
  const glass = '#87c9ff';
  const metal = '#c8d0dc';
  const g = new THREE.Group();

  g.add(mkCyl(0.22, 0.28, 2.5, 0, 0.72, 0, body, 0.34, 0.28, 18));
  const nose = mkCone(0.22, 0.55, 18, 1.52, 0.72, 0, body, 0.28);
  nose.rotation.z = -Math.PI / 2;
  g.add(nose);

  const tailCone = mkCone(0.20, 0.45, 18, -1.45, 0.72, 0, body, 0.28);
  tailCone.rotation.z = Math.PI / 2;
  g.add(tailCone);

  g.add(mkBox(1.65, 0.08, 0.72, 0.12, 0.82, 0, body, 0.35, 0.18));
  g.add(mkBox(0.70, 0.06, 0.34, -1.08, 1.08, 0, body, 0.35, 0.18));

  const fin = mkBox(0.18, 0.52, 0.08, -1.22, 1.18, 0, accent, 0.42, 0.1);
  g.add(fin);

  g.add(mkBox(0.42, 0.18, 0.30, 0.58, 0.92, 0, glass, 0.08, 0.1, { transparent: true, opacity: 0.72 }));

  [0.7, -0.7].forEach((z) => {
    const engine = mkCyl(0.10, 0.12, 0.28, 0.18, 0.58, z * 0.34, metal, 0.45, 0.45, 16);
    engine.rotation.z = Math.PI / 2;
    g.add(engine);
  });

  return g;
}

function makeBoat(mainColor = '#f4a261') {
  const hull = mainColor;
  const deck = '#f2e9d8';
  const mast = '#7a5230';
  const sail = '#f8fbff';
  const g = new THREE.Group();

  g.add(mkBox(1.9, 0.28, 0.72, 0, 0.22, 0, hull, 0.72, 0.08));
  g.add(mkBox(1.4, 0.22, 0.58, 0, 0.42, 0, deck, 0.82, 0.02));
  g.add(mkBox(0.52, 0.36, 0.46, -0.18, 0.68, 0, '#ffffff', 0.52, 0.06));
  g.add(mkBox(0.10, 1.25, 0.10, 0.28, 1.00, 0, mast, 0.88, 0.02));

  const sailMesh = new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.28, 1.58, 0),
      new THREE.Vector3(0.28, 0.82, 0),
      new THREE.Vector3(0.98, 1.12, 0),
    ]),
    mat(sail, 0.95, 0.01, { side: THREE.DoubleSide })
  );
  sailMesh.geometry.setIndex([0, 1, 2]);
  sailMesh.geometry.computeVertexNormals();
  g.add(sailMesh);

  return g;
}

function makeBuilding(mainColor = '#778090') {
  const g = new THREE.Group();
  const width = 1.3;
  const depth = 1.0;
  const height = 2.8;

  g.add(mkBox(width, height, depth, 0, height / 2, 0, mainColor, 0.82, 0.08));

  for (let floor = 0; floor < 6; floor++) {
    for (let side = -1; side <= 1; side += 2) {
      g.add(mkBox(0.20, 0.18, 0.05, side * 0.66, 0.45 + floor * 0.38, -0.28, '#bfe9ff', 0.12, 0.08));
      g.add(mkBox(0.20, 0.18, 0.05, side * 0.66, 0.45 + floor * 0.38, 0.28, '#bfe9ff', 0.12, 0.08));
    }
  }

  g.add(mkBox(1.36, 0.08, 1.06, 0, height + 0.04, 0, '#5c6572', 0.88, 0.08));
  return g;
}

function makeCloud() {
  const g = new THREE.Group();
  const cloudColor = '#f7fbff';
  g.add(mkSph(0.55, 0, 0.55, 0, cloudColor, 0.98, 0.0));
  g.add(mkSph(0.42, -0.45, 0.52, 0.12, cloudColor, 0.98, 0.0));
  g.add(mkSph(0.48, 0.46, 0.58, -0.08, cloudColor, 0.98, 0.0));
  g.add(mkSph(0.38, 0.92, 0.46, 0.06, cloudColor, 0.98, 0.0));
  g.scale.set(1.4, 0.8, 0.9);
  return g;
}

function makeStreetlight(mainColor = '#5b6370') {
  const g = new THREE.Group();
  const pole = mainColor;
  const lampGlow = '#ffd166';

  g.add(mkCyl(0.05, 0.06, 2.8, 0, 1.4, 0, pole, 0.55, 0.25, 12));
  g.add(mkBox(0.52, 0.05, 0.08, 0.22, 2.72, 0, pole, 0.55, 0.25));
  g.add(mkBox(0.16, 0.16, 0.16, 0.48, 2.62, 0, '#edf2f4', 0.18, 0.08, {
    emissive: new THREE.Color(lampGlow),
    emissiveIntensity: 0.7,
  }));
  return g;
}

/* ── Dispatch table ─────────────────────────────────────────── */

const GENERATORS = {
  dog:   makeDog,
  cat:   makeCat,
  car:   makeCar,
  house: makeHouse,
  tree:  makeTree,
  chair: makeChair,
  table: makeTable,
  robot: makeRobot,
  human: makeHuman,
  airplane: makeAirplane,
  boat: makeBoat,
  building: makeBuilding,
  cloud: makeCloud,
  streetlight: makeStreetlight,
};

export const SUPPORTED_TYPES = Object.keys(GENERATORS);

export class ProceduralGenerator {
  /**
   * Build a THREE.Group for the given type.
   * @param {string} type — one of SUPPORTED_TYPES
   * @param {{ color?: string, scale?: number }} options
   * @returns {THREE.Group}
   */
  generate(type, options = {}) {
    const factory = GENERATORS[type];
    if (!factory) {
      throw new Error(
        `Unknown type: "${type}". Available: ${SUPPORTED_TYPES.join(', ')}`
      );
    }

    const group = factory(options.color || undefined);

    if (options.scale && options.scale !== 1) {
      group.scale.setScalar(options.scale);
    }

    // Mark all children for shadow casting
    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  get supportedTypes() {
    return SUPPORTED_TYPES;
  }
}
