// Définition et construction des 9 trous du parcours.
// Coordonnées locales par trou : départ vers z+, fairway vers z-.
// Chaque trou est décalé de HOLE_SPACING sur l'axe X dans la scène.

import * as THREE from 'three';

export const BALL_R = 0.18;
export const HOLE_VISUAL_R = 0.3;
export const CAPTURE_R = 0.27;
export const MAX_STROKES = 12;
export const FAIL_SCORE = 14;
export const HOLE_SPACING = 46;
export const GROUND_Y = -1.6;

const FELT = 0x43a047;
const FELT_ALT = 0x4caf50;
const WOOD = 0x8d6e63;
const VOLCANO = 0xa0522d;

// ----------------------------------------------------------- descripteurs

const F = (x, z, w, d, y = 0, color = null) => ({ t: 'floor', x, z, w, d, y, color });
const W = (x1, z1, x2, z2, o = {}) => ({ t: 'wall', x1, z1, x2, z2, h: o.h ?? 0.55, base: o.base ?? 0 });
const B = (x, y, z, sx, sy, sz, o = {}) => ({ t: 'box', x, y, z, sx, sy, sz, ...o });
const RampZ = (x, w, z1, y1, z2, y2, walls = true, color = null) => ({ t: 'rampz', x, w, z1, y1, z2, y2, walls, color });
const RampX = (z, d, x1, y1, x2, y2, color = null) => ({ t: 'rampx', z, d, x1, y1, x2, y2, color });
const Bumper = (x, z, r = 0.5) => ({ t: 'bumper', x, z, r });
const Windmill = (x, z) => ({ t: 'windmill', x, z });
const Water = (x, z, w, d, y = -1.0) => ({ t: 'water', x, z, w, d, y });

function rectWalls(x1, z1, x2, z2, o = {}) {
  return [
    W(x1, z1, x2, z1, o), W(x2, z1, x2, z2, o),
    W(x2, z2, x1, z2, o), W(x1, z2, x1, z1, o),
  ];
}

// ----------------------------------------------------------- les 9 trous

export const HOLES = [
  {
    name: "L'échauffement", par: 2,
    start: [0, 0, 6.5], hole: [0, 0, -5.5],
    els: [F(0, 0, 4, 16), ...rectWalls(-2, -8, 2, 8)],
  },
  {
    name: 'Le coude', par: 3,
    start: [0, 0, 6.5], hole: [-9.2, 0, -4],
    els: [
      F(0, 1, 4, 14), F(-4.5, -4, 13, 4, 0, FELT_ALT),
      W(2, -6, 2, 8), W(-2, 8, 2, 8), W(-2, -2, -2, 8),
      W(-11, -2, -2, -2), W(-11, -6, -11, -2), W(-11, -6, 2, -6),
    ],
  },
  {
    name: 'La montée', par: 3,
    start: [0, 0, 6.5], hole: [0, 1.2, -7.5],
    els: [
      F(0, 4, 4, 8),
      RampZ(0, 4, 0.3, -0.02, -4.3, 1.18),
      F(0, -7, 4, 6, 1.2, FELT_ALT),
      W(-2, 8, 2, 8), W(2, 8, 2, 0), W(-2, 0, -2, 8),
      W(-2, -4, -2, -10, { base: 1.2 }), W(2, -10, 2, -4, { base: 1.2 }), W(-2, -10, 2, -10, { base: 1.2 }),
    ],
  },
  {
    name: 'Le moulin', par: 3,
    start: [0, 0, 7.5], hole: [0, 0, -7],
    els: [
      F(0, 0, 4, 18), ...rectWalls(-2, -9, 2, 9),
      W(-2, 0, -0.75, 0, { h: 1.0 }), W(0.75, 0, 2, 0, { h: 1.0 }),
      Windmill(0, 0),
    ],
  },
  {
    name: 'Le flipper', par: 3,
    start: [0, 0, 6], hole: [0, 0, -7.8],
    els: [
      F(0, -1, 9, 16), ...rectWalls(-4.5, -9, 4.5, 7),
      Bumper(-2.2, 0), Bumper(2.2, 0), Bumper(0, -2.5),
      Bumper(-2.2, -5), Bumper(2.2, -5),
    ],
  },
  {
    name: 'Le Z', par: 3,
    start: [0, 0, 7], hole: [6, 0, -4.5],
    els: [
      F(0, 5.5, 3, 5), F(3, 1.5, 9, 3, 0, FELT_ALT), F(6, -3, 3, 6),
      W(1.5, 8, 1.5, 3), W(1.5, 3, 7.5, 3), W(7.5, 3, 7.5, -6),
      W(7.5, -6, 4.5, -6), W(4.5, -6, 4.5, 0), W(4.5, 0, -1.5, 0),
      W(-1.5, 0, -1.5, 8), W(-1.5, 8, 1.5, 8),
    ],
  },
  {
    name: 'Le pont', par: 3, oobY: -1.2, oobSplash: true,
    start: [0, 0, 7.5], hole: [0, 0, -5],
    els: [
      F(0, 6, 5, 5), F(0, 1, 1.3, 5, 0, FELT_ALT), F(0, -4.5, 6, 6),
      Water(0, 0, 26, 26, -1.0),
      W(-2.5, 8.5, 2.5, 8.5), W(2.5, 8.5, 2.5, 3.5), W(-2.5, 3.5, -2.5, 8.5),
      W(-2.5, 3.5, -0.7, 3.5), W(0.7, 3.5, 2.5, 3.5),
      W(-3, -1.5, -0.7, -1.5), W(0.7, -1.5, 3, -1.5),
      W(3, -1.5, 3, -7.5), W(3, -7.5, -3, -7.5), W(-3, -7.5, -3, -1.5),
    ],
  },
  {
    name: 'La grande descente', par: 3,
    start: [0, 2.4, 7.5], hole: [2.8, 0, -9],
    els: [
      F(0, 7, 4, 4, 2.4),
      RampZ(0, 4, 5.3, 2.38, -2.3, -0.02),
      F(0, -6.5, 9, 9, 0, FELT_ALT),
      W(-2, 9, 2, 9, { base: 2.4 }), W(2, 9, 2, 5, { base: 2.4 }), W(-2, 5, -2, 9, { base: 2.4 }),
      W(-4.5, -2, -2, -2), W(2, -2, 4.5, -2),
      W(4.5, -2, 4.5, -11), W(4.5, -11, -4.5, -11), W(-4.5, -11, -4.5, -2),
      Bumper(0, -6),
    ],
  },
  {
    name: 'Le volcan', par: 4,
    start: [0, 0, 7.5], hole: [0, 1.0, -3.5],
    els: [
      F(0, 6.5, 4, 4), F(0, -2, 11, 13),
      W(-2, 8.5, 2, 8.5), W(2, 8.5, 2, 4.5), W(-2, 4.5, -2, 8.5),
      W(-5.5, 4.5, -2, 4.5), W(2, 4.5, 5.5, 4.5),
      W(5.5, 4.5, 5.5, -8.5), W(5.5, -8.5, -5.5, -8.5), W(-5.5, -8.5, -5.5, 4.5),
      Bumper(-3.2, 0.8), Bumper(3.2, 0.8),
      // le volcan : 4 rampes + sommet plat
      RampZ(0, 5.8, -0.6, 0, -2.75, 0.98, false, VOLCANO),
      RampZ(0, 5.8, -6.4, 0, -4.25, 0.98, false, VOLCANO),
      RampX(-3.5, 5.8, 2.9, 0, 0.75, 0.98, VOLCANO),
      RampX(-3.5, 5.8, -2.9, 0, -0.75, 0.98, VOLCANO),
      B(0, 0.8, -3.5, 1.7, 0.4, 1.7, { color: 0x7f2d26 }),
    ],
  },
];

export const NUM_HOLES = HOLES.length;
export const TOTAL_PAR = HOLES.reduce((a, h) => a + h.par, 0);

// ----------------------------------------------------------- construction

const WALL_T = 0.26;
const FLOOR_T = 0.4;
const E_FLOOR = 0.3;
const E_WALL = 0.55;

function collider(center, half, quat, e, extra = {}) {
  const c = { center, half, quat: null, invQuat: null, e, ...extra };
  if (quat && Math.abs(quat.w - 1) > 1e-6) {
    c.quat = quat.clone();
    c.invQuat = quat.clone().invert();
  }
  return c;
}

function box(group, colliders, center, size, quat, color, e, opts = {}) {
  const half = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
  colliders.push(collider(center.clone(), half, quat, e));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
  mesh.position.copy(center);
  if (quat) mesh.quaternion.copy(quat);
  mesh.receiveShadow = true;
  mesh.castShadow = opts.castShadow ?? false;
  group.add(mesh);
  return mesh;
}

// Rampe le long de z : surface de (z1,y1) à (z2,y2), largeur w centrée en x.
function buildRampZ(group, colliders, el, dx) {
  const dz = el.z2 - el.z1, dy = el.y2 - el.y1;
  const L = Math.hypot(dz, dy);
  const alpha = Math.atan2(-dy, dz);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), alpha);
  const nUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  if (nUp.y < 0) nUp.negate();
  const topMid = new THREE.Vector3(el.x + dx, (el.y1 + el.y2) / 2, (el.z1 + el.z2) / 2);
  const center = topMid.clone().addScaledVector(nUp, -FLOOR_T / 2);
  box(group, colliders, center, new THREE.Vector3(el.w, FLOOR_T, L), q, el.color ?? FELT, E_FLOOR);
  if (el.walls) {
    for (const side of [-1, 1]) {
      const wc = topMid.clone()
        .add(new THREE.Vector3(side * (el.w / 2 + 0.13), 0, 0))
        .addScaledVector(nUp, 0.18);
      box(group, colliders, wc, new THREE.Vector3(WALL_T, 1.1, L + 0.26), q, WOOD, E_WALL, { castShadow: true });
    }
  }
}

// Rampe le long de x : surface de (x1,y1) à (x2,y2), profondeur d centrée en z.
function buildRampX(group, colliders, el, dx) {
  const dxr = el.x2 - el.x1, dy = el.y2 - el.y1;
  const L = Math.hypot(dxr, dy);
  const beta = Math.atan2(dy, dxr);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), beta);
  const nUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  if (nUp.y < 0) nUp.negate();
  const topMid = new THREE.Vector3((el.x1 + el.x2) / 2 + dx, (el.y1 + el.y2) / 2, el.z);
  const center = topMid.clone().addScaledVector(nUp, -FLOOR_T / 2);
  box(group, colliders, center, new THREE.Vector3(L, FLOOR_T, el.d), q, el.color ?? FELT, E_FLOOR);
}

function buildWindmill(group, colliders, movers, el, dx) {
  const pivot = new THREE.Vector3(el.x + dx, 1.5, el.z);
  const speed = 1.1; // rad/s
  const axis = new THREE.Vector3(0, 0, 1);
  const omega = new THREE.Vector3(0, 0, speed);
  const blades = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.8 });
  for (let i = 0; i < 2; i++) {
    const c = collider(pivot.clone(), new THREE.Vector3(1.35, 0.11, 0.08), null, 0.4, {
      vsurf: (p, out) => out.set(-speed * (p.y - pivot.y), speed * (p.x - pivot.x), 0),
    });
    c.quat = new THREE.Quaternion();
    c.invQuat = new THREE.Quaternion();
    colliders.push(c);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 0.16), mat);
    mesh.position.copy(pivot);
    mesh.castShadow = true;
    group.add(mesh);
    blades.push({ c, mesh, phase: i * Math.PI / 2 });
  }
  // moyeu + toit décoratifs
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0x6d4c41 }));
  hub.position.copy(pivot);
  group.add(hub);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xbf8f68, roughness: 0.9 }),
  );
  tower.position.set(pivot.x, 2.35, pivot.z - 0.5);
  tower.castShadow = true;
  group.add(tower);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0xc1452f, roughness: 0.85, flatShading: true }),
  );
  roof.position.set(pivot.x, 3.55, pivot.z - 0.5);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  movers.push({
    update(t) {
      for (const b of blades) {
        const angle = b.phase + t * speed;
        b.c.quat.setFromAxisAngle(axis, angle);
        b.c.invQuat.copy(b.c.quat).invert();
        b.mesh.quaternion.copy(b.c.quat);
      }
    },
  });
}

function buildBumper(group, colliders, el, dx) {
  colliders.push({
    bumper: { x: el.x + dx, z: el.z, r: el.r, h: 0.55, minOut: 4.5 },
    e: 0.6,
  });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(el.r, el.r * 1.08, 0.55, 20),
    new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.6 }),
  );
  body.position.set(el.x + dx, 0.275, el.z);
  body.castShadow = true;
  group.add(body);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(el.r * 0.75, el.r * 0.75, 0.08, 20),
    new THREE.MeshStandardMaterial({ color: 0xffe0b2, roughness: 0.5 }),
  );
  cap.position.set(el.x + dx, 0.59, el.z);
  group.add(cap);
}

function buildFlag(group, holePos) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
  );
  pole.position.y = 0.575;
  g.add(pole);
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 1.12, 0, 0.55, 1.0, 0, 0, 0.88, 0,
  ], 3));
  flagGeo.computeVertexNormals();
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xe63946, side: THREE.DoubleSide }));
  g.add(flag);
  g.position.copy(holePos);
  group.add(g);
  return g;
}

function discAt(group, x, y, z, r, color, opts = {}) {
  const geo = opts.ring
    ? new THREE.RingGeometry(opts.inner, r, 28)
    : new THREE.CircleGeometry(r, 28);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.9,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.8 : 0,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

function addTree(group, x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 0.7 * s, 7),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 }),
  );
  trunk.position.y = 0.35 * s;
  g.add(trunk);
  const matLeaf = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1, flatShading: true });
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.1 * s, 8), matLeaf);
  c1.position.y = 1.1 * s;
  c1.castShadow = true;
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 0.85 * s, 8), matLeaf);
  c2.position.y = 1.7 * s;
  g.add(c2);
  g.position.set(x, GROUND_Y, z);
  group.add(g);
}

function addRock(group, x, z, s = 1) {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4 * s, 0),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 1, flatShading: true }),
  );
  m.position.set(x, GROUND_Y + 0.18 * s, z);
  m.scale.y = 0.6;
  m.rotation.y = x * 7.3;
  group.add(m);
}

// Construit tout le parcours ; renvoie un tableau d'objets par trou.
export function buildCourse(scene) {
  const built = [];

  for (let i = 0; i < HOLES.length; i++) {
    const def = HOLES[i];
    const dx = i * HOLE_SPACING;
    const group = new THREE.Group();
    const colliders = [];
    const movers = [];
    const rects = []; // empreintes au sol pour placer les arbres

    for (const el of def.els) {
      switch (el.t) {
        case 'floor': {
          const center = new THREE.Vector3(el.x + dx, el.y - FLOOR_T / 2, el.z);
          box(group, colliders, center, new THREE.Vector3(el.w, FLOOR_T, el.d), null, el.color ?? FELT, E_FLOOR);
          rects.push({ x: el.x + dx, y: el.y, z: el.z, w: el.w, d: el.d });
          break;
        }
        case 'wall': {
          const cx = (el.x1 + el.x2) / 2 + dx, cz = (el.z1 + el.z2) / 2;
          const ddx = el.x2 - el.x1, ddz = el.z2 - el.z1;
          const len = Math.hypot(ddx, ddz) + WALL_T;
          const theta = Math.atan2(-ddz, ddx);
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), theta);
          const center = new THREE.Vector3(cx, el.base + el.h / 2, cz);
          box(group, colliders, center, new THREE.Vector3(len, el.h + 0.25, WALL_T), q, WOOD, E_WALL, { castShadow: true });
          break;
        }
        case 'box': {
          const q = el.ry ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), el.ry) : null;
          box(group, colliders, new THREE.Vector3(el.x + dx, el.y, el.z),
            new THREE.Vector3(el.sx, el.sy, el.sz), q, el.color ?? WOOD, el.e ?? E_WALL, { castShadow: true });
          break;
        }
        case 'rampz': buildRampZ(group, colliders, el, dx); rects.push({ x: el.x + dx, z: (el.z1 + el.z2) / 2, w: el.w, d: Math.abs(el.z2 - el.z1) }); break;
        case 'rampx': buildRampX(group, colliders, el, dx); break;
        case 'bumper': buildBumper(group, colliders, el, dx); break;
        case 'windmill': buildWindmill(group, colliders, movers, el, dx); break;
        case 'water': {
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(el.w, el.d),
            new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.78, roughness: 0.3 }),
          );
          m.rotation.x = -Math.PI / 2;
          m.position.set(el.x + dx, el.y, el.z);
          group.add(m);
          break;
        }
      }
    }

    const start = new THREE.Vector3(def.start[0] + dx, def.start[1], def.start[2]);
    const hole = new THREE.Vector3(def.hole[0] + dx, def.hole[1], def.hole[2]);
    const pickupSpawns = rects
      .filter(r => r.y != null && r.w >= 2 && r.d >= 2)
      .slice(0, 3)
      .map(r => new THREE.Vector3(r.x, r.y + 0.48, r.z));

    discAt(group, start.x, start.y + 0.012, start.z, 0.5, 0x2e6b33);
    discAt(group, hole.x, hole.y + 0.013, hole.z, HOLE_VISUAL_R, 0x0a0a0a);
    discAt(group, hole.x, hole.y + 0.012, hole.z, 0.38, 0xe8e8e8, { ring: true, inner: HOLE_VISUAL_R });
    if (def.name === 'Le volcan') {
      discAt(group, hole.x, hole.y + 0.011, hole.z, 0.55, 0xff5722, { ring: true, inner: 0.39, emissive: 0xff3d00 });
    }
    const flag = buildFlag(group, hole);
    movers.push({ update(t) { flag.rotation.y = Math.sin(t * 1.3) * 0.25; } });

    // arbres et rochers autour de l'empreinte du trou
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of rects) {
      minX = Math.min(minX, r.x - r.w / 2); maxX = Math.max(maxX, r.x + r.w / 2);
      minZ = Math.min(minZ, r.z - r.d / 2); maxZ = Math.max(maxZ, r.z + r.d / 2);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const radius = Math.max(maxX - minX, maxZ - minZ) / 2 + 4;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + i * 0.7;
      const tx = cx + Math.cos(a) * (radius + (k % 3));
      const tz = cz + Math.sin(a) * (radius + ((k + 1) % 3));
      const inside = rects.some(r =>
        tx > r.x - r.w / 2 - 1.2 && tx < r.x + r.w / 2 + 1.2 &&
        tz > r.z - r.d / 2 - 1.2 && tz < r.z + r.d / 2 + 1.2);
      if (inside) continue;
      if (k % 4 === 3) addRock(group, tx, tz, 0.8 + (k % 2) * 0.5);
      else addTree(group, tx, tz, 0.8 + ((k * 7) % 5) * 0.14);
    }

    scene.add(group);
    built.push({
      index: i,
      name: def.name,
      par: def.par,
      start,
      hole,
      oobY: def.oobY ?? -1.4,
      oobSplash: !!def.oobSplash,
      colliders,
      movers,
      pickupSpawns,
      group,
      center: new THREE.Vector3(cx, 0, cz),
    });
  }

  return built;
}
