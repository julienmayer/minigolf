// Moteur du jeu : scène 3D, caméra, contrôles, boucle physique,
// balles des autres joueurs (interpolées depuis le réseau).

import * as THREE from 'three';
import { buildCourse, BALL_R, CAPTURE_R, MAX_STROKES, GROUND_Y } from './courses.js';
import { Ball, stepBall, MAX_SHOT_SPEED } from './physics.js';
import * as ui from './ui.js';
import * as audio from './audio.js';

const STEP = 1 / 120;
const SEND_INTERVAL = 80;       // ms entre deux envois de position
const MIN_SHOT_SPEED = 1.0;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.net = null;

    this.phase = 'menu';        // menu | play | between | end
    this.players = new Map();   // id -> joueur distant (et soi-même pour le HUD)
    this.meId = null;

    this.cam = { yaw: 0, pitch: 0.55, dist: 5.5, target: new THREE.Vector3() };
    this.charge = null;
    this.intro = { active: false, t: 0 };

    this.holeIdx = 0;
    this.cur = null;
    this.acc = 0;
    this.lastTime = performance.now();
    this.lastSend = 0;
    this.wasMoving = false;
    this.holeStartLocal = 0;
    this.holeEndsLocal = 0;
    this.timeUp = false;

    this.me = {
      ball: new Ball(),
      strokes: 0,
      holed: false,
      maxed: false,
      atRest: true,
      lastShotPos: new THREE.Vector3(),
      sink: -1,
      mesh: null,
    };

    this.initScene();
    this.initInput();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------- scène

  initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ed9f2);
    this.scene.fog = new THREE.Fog(0x9ed9f2, 32, 85);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);

    const hemi = new THREE.HemisphereLight(0xcfeaff, 0x5d9c59, 0.95);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff4d6, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -16;
    this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16;
    this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.far = 60;
    this.scene.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ color: 0x7cb56b, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // nuages décoratifs
    this.clouds = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (k % 2) * 0.7, 8, 6), cloudMat);
        s.position.set(k * 1.4 - 1.4, (k % 2) * 0.4, (k * 0.7) % 1.2);
        s.scale.y = 0.55;
        g.add(s);
      }
      g.position.set(i * 52 - 10 + (i % 3) * 9, 10 + (i % 4) * 2, -20 + (i % 5) * 11);
      this.scene.add(g);
      this.clouds.push(g);
    }

    this.holes = buildCourse(this.scene);
    this.cur = this.holes[0];
    this.placeSun(this.holes[0].center);

    // flèche de visée
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.arrow = new THREE.Group();
    this.arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 1), arrowMat);
    this.arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 10), arrowMat.clone());
    this.arrowHead.rotation.x = -Math.PI / 2;
    this.arrow.add(this.arrowShaft, this.arrowHead);
    this.arrow.visible = false;
    this.scene.add(this.arrow);

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  placeSun(center) {
    this.sun.position.set(center.x + 9, 16, center.z + 7);
    this.sun.target.position.copy(center);
  }

  makeBallMesh(color, mine) {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.35, metalness: 0.05,
      transparent: !mine, opacity: mine ? 1 : 0.85,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 18), mat);
    m.castShadow = true;
    this.scene.add(m);
    return m;
  }

  makeLabel(name) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 32px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 7;
    c.strokeStyle = 'rgba(0,0,0,0.75)';
    c.strokeText(name, 128, 34);
    c.fillStyle = '#fff';
    c.fillText(name, 128, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.scale.set(1.7, 0.42, 1);
    sp.renderOrder = 5;
    this.scene.add(sp);
    return sp;
  }

  // ------------------------------------------------------------- partie

  begin(players, meId) {
    this.meId = meId;
    for (const p of players) this.addPlayer(p);
  }

  addPlayer(p) {
    if (this.players.has(p.id)) return;
    const mine = p.id === this.meId;
    const entry = {
      id: p.id, name: p.name, color: p.color,
      mesh: this.makeBallMesh(p.color, mine),
      label: mine ? null : this.makeLabel(p.name),
      shown: new THREE.Vector3(),
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      t0: 0, dur: 90, lastMsg: 0,
      strokes: 0, holedAt: null, failed: false, sink: -1,
    };
    entry.mesh.visible = false;
    if (entry.label) entry.label.visible = false;
    this.players.set(p.id, entry);
    if (mine) this.me.mesh = entry.mesh;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.scene.remove(p.mesh);
    if (p.label) this.scene.remove(p.label);
    this.players.delete(id);
    this.refreshSide();
  }

  startHole(i, durationMs) {
    this.holeIdx = i;
    this.cur = this.holes[i];
    this.phase = 'play';
    this.timeUp = false;
    this.charge = null;
    ui.setPower(0);

    const startPos = this.cur.start.clone().add(new THREE.Vector3(0, BALL_R + 0.02, 0));
    this.me.ball.pos.copy(startPos);
    this.me.ball.vel.set(0, 0, 0);
    this.me.strokes = 0;
    this.me.holed = false;
    this.me.maxed = false;
    this.me.atRest = true;
    this.me.sink = -1;
    this.me.lastShotPos.copy(startPos);

    for (const p of this.players.values()) {
      p.strokes = 0; p.holedAt = null; p.failed = false; p.sink = -1;
      p.shown.copy(startPos);
      p.from.copy(startPos);
      p.to.copy(startPos);
      p.mesh.visible = true;
      p.mesh.scale.setScalar(1);
      if (p.label) p.label.visible = true;
    }

    this.holeStartLocal = performance.now();
    this.holeEndsLocal = this.holeStartLocal + durationMs;
    this.placeSun(this.cur.center);

    // angle de départ : caméra derrière la balle, face au trou
    const f = this.cur.hole.clone().sub(this.cur.start).setY(0).normalize();
    this.cam.yaw = Math.atan2(-f.x, -f.z);
    this.cam.pitch = 0.5;
    this.cam.dist = 5.5;
    this.cam.target.copy(this.cur.hole);
    this.intro = { active: true, t: 0 };

    ui.showHud();
    ui.setHoleInfo(i + 1, this.cur.name, this.cur.par);
    ui.setStrokes(0, MAX_STROKES);
    ui.banner(`Trou ${i + 1} — ${this.cur.name}`, `Par ${this.cur.par}`, 2600);
    this.refreshSide();
    this.sendState(true);
  }

  freezeHole() {
    this.phase = 'between';
    this.me.ball.vel.set(0, 0, 0);
    this.charge = null;
    this.arrow.visible = false;
    ui.setPower(0);
  }

  gameOver() {
    this.phase = 'end';
    this.charge = null;
    this.arrow.visible = false;
    audio.fanfare();
  }

  backToLobby() {
    this.phase = 'menu';
    for (const p of this.players.values()) {
      p.mesh.visible = false;
      if (p.label) p.label.visible = false;
    }
  }

  refreshSide() {
    const meP = this.players.get(this.meId);
    if (meP) {
      meP.strokes = this.me.strokes;
      meP.holedAt = this.me.holed ? this.me.strokes : null;
      meP.failed = this.me.maxed && !this.me.holed;
    }
    ui.updateSidePlayers([...this.players.values()], this.meId);
  }

  // ------------------------------------------------------------- réseau

  sendState(force = false) {
    if (!this.net) return;
    const now = performance.now();
    if (!force && now - this.lastSend < SEND_INTERVAL) return;
    this.lastSend = now;
    const p = this.me.ball.pos;
    this.net.send({ type: 'state', p: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] });
  }

  setRemoteState(id, arr) {
    const p = this.players.get(id);
    if (!p || id === this.meId) return;
    const now = performance.now();
    p.from.copy(p.shown);
    p.to.set(arr[0], arr[1], arr[2]);
    p.dur = Math.min(200, Math.max(40, now - p.lastMsg || 90));
    p.t0 = now;
    p.lastMsg = now;
    if (p.to.distanceTo(p.from) > 5) p.from.copy(p.to); // téléportation (respawn)
  }

  remoteStroke(id, strokes) {
    const p = this.players.get(id);
    if (!p) return;
    p.strokes = strokes;
    this.refreshSide();
  }

  remoteHoled(id, strokes) {
    const p = this.players.get(id);
    if (!p || id === this.meId) return;
    p.holedAt = strokes;
    p.sink = 0;
    p.shown.copy(this.cur.hole).y += BALL_R;
    audio.holedOther();
    ui.toast(`${p.name} termine en ${strokes} coup${strokes > 1 ? 's' : ''} — ${ui.scoreTerm(strokes, this.cur.par, true)}`);
    this.refreshSide();
  }

  remoteMaxed(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.failed = true;
    ui.toast(`${p.name} n'a pas terminé le trou…`);
    this.refreshSide();
  }

  // ------------------------------------------------------------- entrées

  canShootNow() {
    return this.phase === 'play' && this.me.atRest && !this.me.holed
      && !this.me.maxed && !this.intro.active;
  }

  initInput() {
    const cv = this.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    cv.addEventListener('pointerdown', (e) => {
      if (this.phase === 'menu') return;
      audio.unlock();
      cv.setPointerCapture(e.pointerId);
      if (this.intro.active) this.intro.t = 99;
      if (e.button === 0 && this.canShootNow()) {
        this.charge = { power: 0, maxTicked: false };
      } else {
        this.drag = { x: e.clientX, y: e.clientY };
      }
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });

    cv.addEventListener('pointermove', (e) => {
      if (!this.lastPointer) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (this.charge) {
        this.cam.yaw -= dx * 0.0028;
        this.charge.power = Math.max(0, Math.min(1, this.charge.power + dy / 270));
        if (this.charge.power >= 1 && !this.charge.maxTicked) {
          this.charge.maxTicked = true;
          audio.tickMax();
        }
        if (this.charge.power < 1) this.charge.maxTicked = false;
        ui.setPower(this.charge.power);
      } else if (this.drag) {
        this.cam.yaw -= dx * 0.0055;
        this.cam.pitch = Math.max(0.12, Math.min(1.32, this.cam.pitch + dy * 0.005));
      }
    });

    const release = () => {
      if (this.charge) {
        if (this.charge.power > 0.04 && this.canShootNow()) this.shoot(this.charge.power);
        this.charge = null;
        ui.setPower(0);
      }
      this.drag = null;
      this.lastPointer = null;
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
    addEventListener('blur', release);

    cv.addEventListener('wheel', (e) => {
      this.cam.dist = Math.max(2.2, Math.min(14, this.cam.dist * Math.exp(e.deltaY * 0.001)));
    }, { passive: true });

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.charge) {
        this.charge = null;
        ui.setPower(0);
      }
    });
  }

  shoot(power) {
    const dir = new THREE.Vector3(-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw));
    this.me.lastShotPos.copy(this.me.ball.pos);
    this.me.ball.vel.copy(dir.multiplyScalar(MIN_SHOT_SPEED + (MAX_SHOT_SPEED - MIN_SHOT_SPEED) * power));
    this.me.atRest = false;
    this.wasMoving = true;
    this.me.strokes++;
    ui.setStrokes(this.me.strokes, MAX_STROKES);
    audio.shoot(power);
    if (this.net) this.net.send({ type: 'stroke' });
    this.sendState(true);
    this.refreshSide();
  }

  // ------------------------------------------------------------- simulation

  fixedStep(dt) {
    const me = this.me;
    if (me.holed || me.sink >= 0) return;

    stepBall(me.ball, this.cur.colliders, dt, {
      bounce: (impact) => audio.bounce(impact),
      bumper: () => audio.bumper(),
    });

    const h = this.cur.hole;
    const dx = me.ball.pos.x - h.x;
    const dz = me.ball.pos.z - h.z;
    const d2 = dx * dx + dz * dz;
    const speed = me.ball.vel.length();

    // aspiration légère près du trou
    if (d2 < 0.32 * 0.32 && speed > 0.01 && speed < 0.9 && Math.abs(me.ball.pos.y - (h.y + BALL_R)) < 0.1) {
      me.ball.vel.x -= dx * 6 * dt;
      me.ball.vel.z -= dz * 6 * dt;
    }

    // balle dans le trou ?
    if (this.phase === 'play' && d2 < CAPTURE_R * CAPTURE_R && speed < 4.5
      && Math.abs(me.ball.pos.y - (h.y + BALL_R)) < 0.25) {
      me.holed = true;
      me.sink = 0;
      me.ball.vel.set(0, 0, 0);
      audio.holed();
      const term = ui.scoreTerm(me.strokes, this.cur.par, true);
      ui.banner(term, `${me.strokes} coup${me.strokes > 1 ? 's' : ''}`, 2800);
      if (this.net) this.net.send({ type: 'holed', strokes: me.strokes });
      this.refreshSide();
      return;
    }

    // hors limites
    if (me.ball.pos.y < this.cur.oobY) {
      me.ball.pos.copy(me.lastShotPos);
      me.ball.vel.set(0, 0, 0);
      me.atRest = true;
      this.wasMoving = false;
      if (this.cur.oobSplash) { audio.splash(); ui.toast('Plouf ! 💦'); }
      else ui.toast('Hors limites !');
      this.sendState(true);
      return;
    }

    // détection de l'arrêt
    const moving = me.ball.vel.lengthSq() > 1e-6;
    if (!moving && this.wasMoving) {
      this.wasMoving = false;
      me.atRest = true;
      this.sendState(true);
      if (this.phase === 'play' && me.strokes >= MAX_STROKES && !me.holed && !me.maxed) {
        me.maxed = true;
        ui.banner('Limite de coups atteinte', `score : ${MAX_STROKES + 1}`, 2600);
        if (this.net) this.net.send({ type: 'maxed' });
        this.refreshSide();
      }
    } else if (moving) {
      this.wasMoving = true;
      me.atRest = false;
    }
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    const tHole = (now - this.holeStartLocal) / 1000;
    for (const hole of this.holes) for (const m of hole.movers) m.update(tHole);
    for (const c of this.clouds) {
      c.position.x += dt * 0.4;
      if (c.position.x > 440) c.position.x = -30;
    }

    if (this.phase === 'play') {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.fixedStep(STEP);
        this.acc -= STEP;
      }
      if (this.me.ball.vel.lengthSq() > 1e-6) this.sendState();

      const remain = (this.holeEndsLocal - now) / 1000;
      ui.setTimer(remain);
      if (remain <= 0 && !this.timeUp) {
        this.timeUp = true;
        if (!this.me.holed && !this.me.maxed) {
          this.me.maxed = true;
          ui.banner('Temps écoulé !', '', 2400);
          if (this.net) this.net.send({ type: 'maxed' });
          this.refreshSide();
        }
      }
    }

    this.updateBalls(now, dt);
    this.updateCamera(dt);
    this.updateArrow();
    this.renderer.render(this.scene, this.camera);
  }

  updateBalls(now, dt) {
    // sa propre balle
    const meP = this.players.get(this.meId);
    if (meP) {
      if (this.me.sink >= 0 && this.me.sink < 1) {
        this.me.sink = Math.min(1, this.me.sink + dt / 0.5);
        const s = this.me.sink;
        meP.mesh.position.copy(this.me.ball.pos);
        meP.mesh.position.y -= s * 0.4;
        meP.mesh.scale.setScalar(1 - s * 0.7);
        if (this.me.sink >= 1) meP.mesh.visible = false;
      } else if (!this.me.holed) {
        const prev = meP.mesh.position.clone();
        meP.mesh.position.copy(this.me.ball.pos);
        this.rollMesh(meP.mesh, meP.mesh.position.clone().sub(prev));
      }
    }

    // balles distantes
    for (const p of this.players.values()) {
      if (p.id === this.meId) continue;
      if (p.sink >= 0 && p.sink < 1) {
        p.sink = Math.min(1, p.sink + dt / 0.5);
        p.mesh.position.copy(p.shown);
        p.mesh.position.y -= p.sink * 0.4;
        p.mesh.scale.setScalar(1 - p.sink * 0.7);
        if (p.label) p.label.visible = false;
        if (p.sink >= 1) p.mesh.visible = false;
        continue;
      }
      if (p.holedAt != null) continue;
      const a = Math.min(1, (now - p.t0) / p.dur);
      const prev = p.shown.clone();
      p.shown.lerpVectors(p.from, p.to, a);
      p.mesh.position.copy(p.shown);
      this.rollMesh(p.mesh, p.shown.clone().sub(prev));
      if (p.label) {
        p.label.position.copy(p.shown);
        p.label.position.y += 0.55;
      }
    }
  }

  rollMesh(mesh, delta) {
    const dist = Math.hypot(delta.x, delta.z);
    if (dist < 1e-6) return;
    const axis = new THREE.Vector3(delta.z, 0, -delta.x).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, dist / BALL_R);
    mesh.quaternion.premultiply(q);
  }

  updateCamera(dt) {
    const cam = this.cam;

    if (this.phase === 'menu') {
      cam.yaw += dt * 0.12;
      cam.target.lerp(this.holes[0].center, 1 - Math.exp(-3 * dt));
      cam.dist = 16;
      cam.pitch = 0.5;
    } else if (this.intro.active) {
      this.intro.t += dt / 2.2;
      if (this.intro.t >= 1) {
        this.intro.active = false;
      } else {
        const k = this.intro.t * this.intro.t * (3 - 2 * this.intro.t);
        cam.target.copy(this.cur.hole).lerp(this.me.ball.pos, k);
        cam.dist = 10 - 4.5 * k;
        cam.pitch = 0.85 - 0.35 * k;
      }
    } else {
      const focus = (this.me.holed || this.me.maxed) && this.phase === 'play'
        ? this.cur.hole
        : this.me.ball.pos;
      cam.target.lerp(focus, 1 - Math.exp(-8 * dt));
    }

    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    this.camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * cam.dist * cp,
      cam.target.y + cam.dist * sp,
      cam.target.z + Math.cos(cam.yaw) * cam.dist * cp,
    );
    this.camera.lookAt(cam.target.x, cam.target.y + 0.3, cam.target.z);
  }

  updateArrow() {
    const show = this.canShootNow();
    this.arrow.visible = show;
    if (!show) return;
    const power = this.charge ? this.charge.power : 0;
    const len = 0.7 + power * 2.1;
    const dir = new THREE.Vector3(-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw));
    this.arrow.position.copy(this.me.ball.pos);
    this.arrow.position.y += 0.02;
    this.arrowShaft.scale.z = len;
    this.arrowShaft.position.set(0, 0, -BALL_R - 0.15 - len / 2);
    this.arrowHead.position.set(0, 0, -BALL_R - 0.15 - len - 0.17);
    this.arrow.rotation.y = this.cam.yaw;
    const col = new THREE.Color().setHSL(0.33 - power * 0.33, 0.9, 0.55);
    this.arrowShaft.material.color.copy(col);
    this.arrowHead.material.color.copy(col);
  }
}
