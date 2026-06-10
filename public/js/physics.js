// Physique de la balle : gravité, collisions sphère/boîte orientée,
// bumpers cylindriques, frottement de roulement.
// Simulée uniquement côté client pour sa propre balle (jeu en simultané).

import * as THREE from 'three';
import { BALL_R } from './courses.js';

export const GRAVITY = 18;
export const MAX_SHOT_SPEED = 11;
const ROLL_DEC = 2.6;        // décélération de roulement (m/s²)
const DRAG = 0.16;           // frein quadratique
const AIR_DRAG = 0.05;
const STOP_SPEED = 0.14;
const BOUNCE_MIN = 1.5;      // vitesse normale minimale pour rebondir
const SPEED_CAP = 16;

const _lp = new THREE.Vector3();
const _cl = new THREE.Vector3();
const _n = new THREE.Vector3();
const _vrel = new THREE.Vector3();
const _vs = new THREE.Vector3();

export class Ball {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.grounded = false;
  }
}

function collideOBB(ball, c, out) {
  _lp.copy(ball.pos).sub(c.center);
  if (c.invQuat) _lp.applyQuaternion(c.invQuat);
  _cl.set(
    Math.max(-c.half.x, Math.min(c.half.x, _lp.x)),
    Math.max(-c.half.y, Math.min(c.half.y, _lp.y)),
    Math.max(-c.half.z, Math.min(c.half.z, _lp.z)),
  );
  _n.copy(_lp).sub(_cl);
  const d2 = _n.lengthSq();
  if (d2 >= BALL_R * BALL_R) return false;

  if (d2 < 1e-10) {
    // centre à l'intérieur de la boîte : pousser le long de l'axe le moins enfoncé
    const px = c.half.x - Math.abs(_lp.x);
    const py = c.half.y - Math.abs(_lp.y);
    const pz = c.half.z - Math.abs(_lp.z);
    if (px <= py && px <= pz) { _n.set(Math.sign(_lp.x) || 1, 0, 0); out.pen = px + BALL_R; }
    else if (py <= pz) { _n.set(0, Math.sign(_lp.y) || 1, 0); out.pen = py + BALL_R; }
    else { _n.set(0, 0, Math.sign(_lp.z) || 1); out.pen = pz + BALL_R; }
  } else {
    const d = Math.sqrt(d2);
    _n.divideScalar(d);
    out.pen = BALL_R - d;
  }
  if (c.quat) _n.applyQuaternion(c.quat);
  out.n.copy(_n);
  return true;
}

function collideBumper(ball, c, out) {
  const b = c.bumper;
  const dx = ball.pos.x - b.x, dz = ball.pos.z - b.z;
  const d2 = dx * dx + dz * dz;
  const reach = b.r + BALL_R;

  // dessus du bumper : petit appui vertical
  if (ball.pos.y > b.h - 0.05 && d2 < b.r * b.r) {
    if (ball.pos.y - BALL_R < b.h) {
      out.n.set(0, 1, 0);
      out.pen = b.h - (ball.pos.y - BALL_R);
      out.isBumper = false;
      return true;
    }
    return false;
  }
  if (ball.pos.y > b.h + BALL_R) return false;
  if (d2 >= reach * reach || d2 < 1e-10) return false;

  const d = Math.sqrt(d2);
  out.n.set(dx / d, 0, dz / d);
  out.pen = reach - d;
  out.isBumper = true;
  return true;
}

// Avance la balle d'un pas dt. cb : { bounce(impact), bumper() }.
// Renvoie la normale de contact la plus verticale (maxNy), ou -1 sans contact.
export function stepBall(ball, colliders, dt, cb) {
  ball.vel.y -= GRAVITY * dt;
  ball.pos.addScaledVector(ball.vel, dt);

  let maxNy = -1;
  const out = { n: new THREE.Vector3(), pen: 0, isBumper: false };

  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const c of colliders) {
      const hit = c.bumper ? collideBumper(ball, c, out) : collideOBB(ball, c, out);
      if (!hit) continue;
      any = true;
      ball.pos.addScaledVector(out.n, out.pen + 0.0001);
      maxNy = Math.max(maxNy, out.n.y);

      _vs.set(0, 0, 0);
      if (c.vsurf) c.vsurf(ball.pos, _vs);
      _vrel.copy(ball.vel).sub(_vs);
      const vn = _vrel.dot(out.n);
      if (vn < 0) {
        const e = vn < -BOUNCE_MIN ? c.e : 0;
        _vrel.addScaledVector(out.n, -(1 + e) * vn);
        if (out.isBumper) {
          const vr = _vrel.dot(out.n);
          if (vr < c.bumper.minOut) _vrel.addScaledVector(out.n, c.bumper.minOut - vr);
          if (cb && cb.bumper) cb.bumper();
        } else if (vn < -BOUNCE_MIN && out.n.y < 0.7) {
          if (cb && cb.bounce) cb.bounce(-vn);
        }
        ball.vel.copy(_vrel).add(_vs);
      }
    }
    if (!any) break;
  }

  ball.grounded = maxNy > 0.6;
  const sp = ball.vel.length();

  if (ball.grounded) {
    if (sp > 0) {
      const dec = (ROLL_DEC + DRAG * sp) * dt;
      ball.vel.multiplyScalar(Math.max(0, 1 - dec / sp));
    }
    if (ball.vel.length() < STOP_SPEED && maxNy > 0.985) ball.vel.set(0, 0, 0);
  } else if (sp > 0) {
    ball.vel.multiplyScalar(Math.max(0, 1 - AIR_DRAG * dt));
  }

  if (sp > SPEED_CAP) ball.vel.multiplyScalar(SPEED_CAP / sp);

  return maxNy;
}
