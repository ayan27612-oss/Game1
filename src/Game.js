import {
  TAU,
  clamp,
  lerp,
  rand,
  dist2,
  circleCircle,
  lineCircle,
  normalizeAngle
} from './engine/MathUtils.js';
import { Quadtree } from './engine/Quadtree.js';
import { projectAngle as projectWorldAngle, CAM_TILT, CAMERA_ZOOM } from './engine/Projection.js';
import { Player } from './entities/Player.js';
import { Ally } from './entities/Ally.js';
import { EnemyManager } from './entities/Enemies.js';
import { ParticleSystem } from './systems/Particles.js';
import { SHIP_STYLES, SHIP_PALETTES, ALLY_PALETTES } from './systems/Customization.js';
import {
  draftUpgrades,
  applyUpgrade,
  META_UNLOCKS
} from './systems/Upgrades.js';
import { getDoctrine, isDoctrineUnlocked } from './systems/Doctrines.js';
import { checkSynergies } from './systems/Synergies.js';

class BulletPool {
  constructor(size) {
    this.size = size;
    this.items = new Array(size);
    this.free = new Array(size);
    for (let i = 0; i < size; i++) {
      this.items[i] = {
        index: i,
        active: false,
        x: 0,
        y: 0,
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        r: 4,
        damage: 0,
        life: 0,
        maxLife: 1,
        pierce: 0,
        ricochet: 0,
        chain: 0,
        enemy: false,
        homing: 0,
        color: '#ffffff',
        size: 3,
        hits: new Int32Array(8),
        hitCount: 0
      };
      this.free[i] = size - 1 - i;
    }
    this.active = 0;
  }

  spawn(x, y, vx, vy, r, damage, life, pierce, ricochet, chain, color, size, enemy = false, homing = 0) {
    if (this.free.length === 0) return null;
    const b = this.items[this.free.pop()];
    b.active = true;
    b.x = x;
    b.y = y;
    b.px = x;
    b.py = y;
    b.vx = vx;
    b.vy = vy;
    b.r = r;
    b.damage = damage;
    b.life = life;
    b.maxLife = life;
    b.pierce = pierce;
    b.ricochet = ricochet;
    b.chain = chain;
    b.enemy = enemy;
    b.homing = homing;
    b.color = color;
    b.size = size;
    b.hitCount = 0;
    this.active++;
    return b;
  }

  release(b) {
    if (!b.active) return;
    b.active = false;
    this.active--;
    this.free.push(b.index);
  }

  prevAll() {
    for (let i = 0; i < this.size; i++) {
      const b = this.items[i];
      if (b.active) {
        b.px = b.x;
        b.py = b.y;
      }
    }
  }
}

class PickupPool {
  constructor(size) {
    this.size = size;
    this.items = new Array(size);
    this.free = new Array(size);
    for (let i = 0; i < size; i++) {
      this.items[i] = {
        index: i,
        active: false,
        x: 0,
        y: 0,
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        type: 'health',
        life: 0,
        age: 0
      };
      this.free[i] = size - 1 - i;
    }
  }

  spawn(x, y, type = 'health') {
    if (this.free.length === 0) return null;
    const p = this.items[this.free.pop()];
    p.active = true;
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    p.vx = rand(-30, 30);
    p.vy = rand(-30, 30);
    p.type = type;
    p.life = 18;
    p.age = 0;
    return p;
  }

  release(p) {
    if (!p.active) return;
    p.active = false;
    this.free.push(p.index);
  }

  update(dt, game) {
    const player = game.player;
    for (let i = 0; i < this.size; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const magnet = player.stats.pickupRadius;
      if (d < magnet) {
        const sp = 240 + (1 - d / magnet) * 620;
        p.vx = (dx / d) * sp;
        p.vy = (dy / d) * sp;
      } else {
        p.vx *= Math.exp(-2 * dt);
        p.vy *= Math.exp(-2 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = clamp(p.x, 20, game.world.w - 20);
      p.y = clamp(p.y, 20, game.world.h - 20);
      if (d < player.r + 14) {
        if (p.type === 'health') {
          player.heal(22, game);
        } else if (p.type === 'overcharge') {
          player.buffs.overcharge = Math.max(player.buffs.overcharge, 8);
          player.heat = Math.max(0, player.heat - 0.2);
          game.particles.ring(player.x, player.y, '#ffe066', 18, 320, 0.5, 3);
          game.particles.sparkBurst(player.x, player.y, 16, '#fff3b0', 300, 2.6, 0.5);
          if (game.settings?.damageNumbers !== false) {
            game.particles.text(player.x, player.y - 40, 'OVERCHARGE', '#ffe066', 16, 1.2);
          }
          game.audio.zap();
        }
        this.release(p);
      }
    }
  }

  draw(ctx, alpha) {
    for (let i = 0; i < this.size; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      const pulse = 1 + Math.sin(p.age * 7) * 0.18;
      const fade = p.life < 3 ? (Math.floor(p.life * 8) % 2 === 0 ? 0.35 : 1) : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = fade;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(89, 255, 168, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * pulse, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#59ffa8';
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function makeSingularity() {
  return {
    active: false,
    x: 0,
    y: 0,
    life: 0,
    maxLife: 1,
    radius: 170,
    damage: 40,
    angle: 0
  };
}

export class Game {
  constructor(opts) {
    this.view = opts.view;
    this.input = opts.input;
    this.audio = opts.audio;
    this.save = opts.save;
    this.onLevelUp = opts.onLevelUp || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.onSynergy = opts.onSynergy || (() => {});
    this.onThreat = opts.onThreat || (() => {});
    this.onBoss = opts.onBoss || (() => {});
    this.settings = opts.settings || {};
    this.doctrine = getDoctrine(opts.doctrine || this.save.doctrine || 'vanguard');
    if (!isDoctrineUnlocked(this.doctrine, this.save)) this.doctrine = getDoctrine('vanguard');

    this.world = { w: 4200, h: 3200 };
    this.tilt = CAM_TILT;
    this.zoom = CAMERA_ZOOM;
    const shipCfg = this.save.getShipConfig ? this.save.getShipConfig() : { style: 0, palette: 0, ally: 0 };
    this.shipCfg = shipCfg;
    const shipStyle = ((shipCfg.style % SHIP_STYLES.length) + SHIP_STYLES.length) % SHIP_STYLES.length;
    const playerPal = SHIP_PALETTES[shipCfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
    this.player = new Player(this.world.w * 0.5, this.world.h * 0.5, {
      style: shipStyle,
      colors: playerPal,
      callsign: shipCfg.callsign || playerPal.name
    });
    this.ally = new Ally(this.player.x - 70, this.player.y, {
      style: (shipStyle + 1) % SHIP_STYLES.length,
      colors: ALLY_PALETTES[shipCfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0],
      name: 'WINGMAN'
    });
    this.enemies = new EnemyManager();
    this.particles = new ParticleSystem();
    this.quadtree = new Quadtree(0, 0, this.world.w, this.world.h, 8, 0, 6);
    this.quadtreeNodes = 1;
    this.quadtreeQueries = 0;
    this.bullets = new BulletPool(820);
    this.enemyBullets = new BulletPool(540);
    this.pickups = new PickupPool(40);

    this.candA = [];
    this.candB = [];
    this.candC = [];
    this.candH = [];
    this.chainHits = [];

    this.singularities = new Array(8);
    for (let i = 0; i < this.singularities.length; i++) this.singularities[i] = makeSingularity();

    this.camera = {
      x: this.player.x,
      y: this.player.y,
      px: this.player.x,
      py: this.player.y
    };
    this.mouseWorld = { x: this.player.x + 100, y: this.player.y };

    this.elapsed = 0;
    this.score = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 8;
    this.pendingLevelUps = 0;
    this.draftOpen = false;
    this.over = false;
    this.finalized = false;
    this.debugQuadtree = false;

    this.threat = 1;
    this.nextThreat = 45;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboBest = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.healingDone = 0;
    this.elitesKilled = 0;
    this.bossKills = 0;
    this.revivesUsed = 0;
    this.rerolls = 2;

    this.swarmTimer = 1.6;
    this.sniperTimer = 8;
    this.hexTimer = 14;
    this.bomberTimer = 17;
    this.splitterTimer = 25;
    this.weaverTimer = 10;
    this.gunnerTimer = 21;
    this.nextBoss = 105;
    this.bossCount = 0;
    this.bladeAngle = 0;

    this.stars = [];
    for (let i = 0; i < 220; i++) {
      this.stars.push({
        x: rand(0, this.world.w),
        y: rand(0, this.world.h),
        s: rand(0.6, 2.2),
        a: rand(0.08, 0.4)
      });
    }

    this.starfield = [];
    for (let i = 0; i < 240; i++) {
      this.starfield.push({
        x: Math.random(),
        y: Math.random(),
        s: rand(0.6, 2.6),
        a: rand(0.15, 0.75),
        d: rand(0.05, 0.35),
        tw: rand(0.6, 2.4),
        hue: Math.random() < 0.18 ? '#ffd7f2' : Math.random() < 0.3 ? '#d9c8ff' : '#bfefff'
      });
    }
    this.renderScale = 1;

    for (let i = 0; i < this.save.unlocks.length; i++) {
      const meta = META_UNLOCKS.find((m) => m.id === this.save.unlocks[i]);
      if (meta) meta.apply(this.player);
    }
    this.doctrine.apply(this.player);
    this.player.stats.maxHp = Math.max(40, this.player.stats.maxHp);
    this.player.hp = this.player.stats.maxHp;
    this.player.dashCharges = this.player.stats.maxDashCharges;
    this.rerollCap = Math.max(0, Math.floor(this.player.stats.rerolls));
    this.rerolls = this.rerollCap;

    this.particles.shakeScale = this.settings.screenShake === false ? 0 : 1;
    this.particles.fxScale = this.settings.reducedMotion ? 0.25 : 1;

    this._clampCamera();
  }

  _clampCamera() {
    const zoom = this.zoom || 1;
    const halfW = this.view.w / (2 * zoom);
    const halfH = this.view.h / (2 * zoom * (this.tilt || 1));
    this.camera.x = this.world.w <= halfW * 2
      ? this.world.w * 0.5
      : clamp(this.camera.x, halfW, this.world.w - halfW);
    this.camera.y = this.world.h <= halfH * 2
      ? this.world.h * 0.5
      : clamp(this.camera.y, halfH, this.world.h - halfH);
  }

  updateCamera(dt) {
    const p = this.player;
    const targetX = p.x;
    const targetY = p.y;
    const k = 1 - Math.exp(-7 * dt);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;
    this._clampCamera();
  }

  getCamera(alpha) {
    return {
      x: lerp(this.camera.px, this.camera.x, alpha),
      y: lerp(this.camera.py, this.camera.y, alpha)
    };
  }

  project(x, y, z = 0) {
    const cam = this._cam || this.camera;
    const zoom = this.zoom || 1;
    return {
      x: this.view.w * 0.5 + (x - cam.x) * zoom,
      y: this.view.h * 0.5 + (y - cam.y) * zoom * this.tilt - z * zoom,
      s: zoom
    };
  }

  projectAngle(a) {
    return projectWorldAngle(a, this.tilt);
  }

  setGroundTransform(ctx, height = 0) {
    const cam = this._cam || this.camera;
    const zoom = this.zoom || 1;
    const dpr = this.view.dpr || 1;
    const sx = zoom * dpr;
    const sy = zoom * this.tilt * dpr;
    const ex = (this.view.w * 0.5 - cam.x * zoom) * dpr;
    const ey = (this.view.h * 0.5 - cam.y * zoom * this.tilt - height * zoom) * dpr;
    ctx.setTransform(sx, 0, 0, sy, ex, ey);
  }

  setBillboardTransform(ctx, wx, wy, height = 0) {
    const cam = this._cam || this.camera;
    const zoom = this.zoom || 1;
    const dpr = this.view.dpr || 1;
    const px = this.view.w * 0.5 + (wx - cam.x) * zoom;
    const py = this.view.h * 0.5 + (wy - cam.y) * zoom * this.tilt - height * zoom;
    const s = zoom * dpr;
    ctx.setTransform(s, 0, 0, s, (px - wx * zoom) * dpr, (py - wy * zoom) * dpr);
  }

  _actorPos(ref, alpha) {
    return {
      x: ref.px + (ref.x - ref.px) * alpha,
      y: ref.py + (ref.y - ref.py) * alpha
    };
  }

  findNearestEnemy(x, y, maxDist = 640) {
    const list = this.enemies.enemies;
    const max2 = maxDist * maxDist;
    let best = null;
    let bestD = max2;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    }
    return best;
  }

  spawnPlayerBullet(x, y, vx, vy, r, damage, life, pierce, ricochet, chain, color, size, homing = 0) {
    return this.bullets.spawn(x, y, vx, vy, r, damage, life, pierce, ricochet, chain, color, size, false, homing);
  }

  spawnEnemyBullet(x, y, vx, vy, r, damage, life, color, size) {
    return this.enemyBullets.spawn(x, y, vx, vy, r, damage, life, 0, 0, 0, color, size, true);
  }

  spawnSingularity(x, y, stacks) {
    let s = null;
    for (let i = 0; i < this.singularities.length; i++) {
      if (!this.singularities[i].active) {
        s = this.singularities[i];
        break;
      }
    }
    if (!s) s = this.singularities[0];
    s.active = true;
    s.x = x;
    s.y = y;
    s.maxLife = 1.35;
    s.life = s.maxLife;
    s.radius = 165 + stacks * 45;
    s.damage = 42 * stacks;
    s.angle = rand(0, TAU);
    this.particles.ring(x, y, '#8b5cff', 20, 260, 0.6, 3);
  }

  update(dt) {
    if (this.over) {
      this.particles.update(dt);
      return;
    }

    this.elapsed += dt;
    Quadtree.resetStats();

    this.comboTimer -= dt;
    if (this.comboTimer <= 0 && this.combo > 0) {
      this.combo = 0;
    }
    this.enemies.eliteChance = this.elapsed > 40
      ? Math.min(0.18, 0.02 + this.threat * 0.012 + this.elapsed * 0.00035)
      : 0;
    if (this.elapsed >= this.nextThreat) {
      this.threat++;
      this.nextThreat += 45;
      this.onThreat(this.threat);
      this.particles.text(this.player.x, this.player.y - 76, `THREAT LEVEL ${this.threat}`, '#ffc857', 18, 1.8);
      this.audio.warning();
    }

    this.camera.px = this.camera.x;
    this.camera.py = this.camera.y;
    this.player.prev();
    this.ally.prev();
    this.enemies.prevAll();
    this.bullets.prevAll();
    this.enemyBullets.prevAll();

    const zoom = this.zoom || 1;
    this.mouseWorld.x = this.camera.x + (this.input.mouse.x - this.view.w * 0.5) / zoom;
    this.mouseWorld.y = this.camera.y + (this.input.mouse.y - this.view.h * 0.5) / (zoom * this.tilt);

    const warpSlow = this.player.buffs.timewarp > 0 ? 0.42 : 1;
    this.enemySlow = warpSlow;

    this.player.update(dt, this);
    this.ally.update(dt, this);
    this.updateCamera(dt);
    this.director(dt);
    this.enemies.update(dt * warpSlow, this);
    this.buildQuadtree();
    this.enemyContact();
    this.updateBullets(dt, warpSlow);
    this.pickups.update(dt, this);
    this.updateOrbitals(dt);
    this.updateSingularities(dt);
    this.particles.update(dt);
    this.audio.setLowHP(this.player.hp / this.player.stats.maxHp < 0.3);
    this.enemies.cleanup();
    this.quadtreeNodes = this.quadtree.countNodes();
    this.quadtreeQueries = Quadtree.queryCount;
  }

  buildQuadtree() {
    this.quadtree.clear();
    const list = this.enemies.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.dead) this.quadtree.insert(e);
    }
  }

  _spawnPoint() {
    const angle = rand(0, TAU);
    const dist = Math.max(this.view.w, this.view.h) * 0.62 + rand(90, 260);
    let x = this.player.x + Math.cos(angle) * dist;
    let y = this.player.y + Math.sin(angle) * dist;
    x = clamp(x, 60, this.world.w - 60);
    y = clamp(y, 60, this.world.h - 60);
    return { x, y };
  }

  director(dt) {
    const diff = this.elapsed;
    const enemyCap = 150;

    this.swarmTimer -= dt;
    if (this.swarmTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        const count = 3 + Math.min(8, Math.floor(diff / 30));
        this.enemies.spawnSwarm(p.x, p.y, count, 1, diff);
        this.audio.wave();
      }
      this.swarmTimer = Math.max(2.8, 6.2 - diff * 0.018);
    }

    this.sniperTimer -= dt;
    if (this.sniperTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        this.enemies.spawn('sniper', p.x, p.y, diff);
        this.audio.wave();
        if (diff > 60 && Math.random() < 0.5) {
          const p2 = this._spawnPoint();
          this.enemies.spawn('sniper', p2.x, p2.y, diff);
        }
      }
      this.sniperTimer = Math.max(5.5, 10.0 - diff * 0.015);
    }

    this.hexTimer -= dt;
    if (this.hexTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        this.enemies.spawn('hex', p.x, p.y, diff);
        this.audio.wave();
        if (diff > 90 && Math.random() < 0.4) {
          const p2 = this._spawnPoint();
          this.enemies.spawn('hex', p2.x, p2.y, diff);
        }
      }
      this.hexTimer = Math.max(9.0, 16 - diff * 0.016);
    }

    this.weaverTimer -= dt;
    if (this.weaverTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        const count = diff > 40 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const pp = i === 0 ? p : this._spawnPoint();
          this.enemies.spawn('weaver', pp.x, pp.y, diff);
        }
        this.audio.wave();
      }
      this.weaverTimer = Math.max(3.4, 7.4 - diff * 0.012);
    }

    this.gunnerTimer -= dt;
    if (this.gunnerTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        this.enemies.spawn('gunner', p.x, p.y, diff);
        this.audio.wave();
        if (diff > 75 && Math.random() < 0.45) {
          const p2 = this._spawnPoint();
          this.enemies.spawn('gunner', p2.x, p2.y, diff);
        }
      }
      this.gunnerTimer = Math.max(7.5, 13 - diff * 0.014);
    }

    this.splitterTimer -= dt;
    if (this.splitterTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        this.enemies.spawn('splitter', p.x, p.y, diff);
        this.audio.wave();
      }
      this.splitterTimer = Math.max(9, 15 - diff * 0.012);
    }

    this.bomberTimer -= dt;
    if (this.bomberTimer <= 0) {
      if (this.enemies.enemies.length < enemyCap) {
        const p = this._spawnPoint();
        this.enemies.spawn('bomber', p.x, p.y, diff);
        this.audio.wave();
        if (diff > 100 && Math.random() < 0.4) {
          const p2 = this._spawnPoint();
          this.enemies.spawn('bomber', p2.x, p2.y, diff);
        }
      }
      this.bomberTimer = Math.max(10, 17 - diff * 0.012);
    }

    if (!this.enemies.boss && this.elapsed >= this.nextBoss) {
      const p = this._spawnPoint();
      const boss = this.enemies.spawnBoss(p.x, p.y, this.bossCount, diff);
      this.bossCount++;
      this.nextBoss += 105;
      this.audio.warning();
      this.audio.boss();
      this.particles.addShake(16);
      this.particles.text(this.player.x, this.player.y - 80, `WARNING: ${boss.name}`, '#ff2f8e', 20, 2.2);
      this.onBoss(boss);
    }
  }

  enemyContact() {
    const p = this.player;
    this.candC.length = 0;
    this.quadtree.query(p.x, p.y, p.r + 80, this.candC);
    for (let i = 0; i < this.candC.length; i++) {
      const e = this.candC[i];
      if (e.dead) continue;
      if (circleCircle(p.x, p.y, p.r, e.x, e.y, e.r)) {
        if (p.takeDamage(e.damage, this)) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          p.vx += (dx / d) * 260;
          p.vy += (dy / d) * 260;
        }
      }
    }

    const ally = this.ally;
    if (ally && !ally.downed) {
      this.candC.length = 0;
      this.quadtree.query(ally.x, ally.y, ally.r + 56, this.candC);
      for (let i = 0; i < this.candC.length; i++) {
        const e = this.candC[i];
        if (e.dead) continue;
        if (circleCircle(ally.x, ally.y, ally.r, e.x, e.y, e.r)) {
          if (ally.takeDamage(e.damage * 0.55, this)) {
            const dx = ally.x - e.x;
            const dy = ally.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            ally.vx += (dx / d) * 180;
            ally.vy += (dy / d) * 180;
          }
        }
      }
    }
  }

  _wallBounce(b, isEnemy, pool) {
    const W = this.world.w;
    const H = this.world.h;
    let hit = false;
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      hit = true;
    } else if (b.x + b.r > W) {
      b.x = W - b.r;
      b.vx = -Math.abs(b.vx);
      hit = true;
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
      hit = true;
    } else if (b.y + b.r > H) {
      b.y = H - b.r;
      b.vy = -Math.abs(b.vy);
      hit = true;
    }
    if (!hit) return false;
    if (isEnemy || b.ricochet <= 0) {
      pool.release(b);
      return true;
    }
    b.ricochet--;
    this.particles.sparkBurst(b.x, b.y, 3, b.color, 150, 1.8, 0.24);
    return false;
  }

  _steerBullet(b, dt) {
    this.candH.length = 0;
    this.quadtree.query(b.x, b.y, 300, this.candH);
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < this.candH.length; i++) {
      const e = this.candH[i];
      if (e.dead) continue;
      const d = dist2(b.x, b.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    const desired = Math.atan2(best.y - b.y, best.x - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    const diff = normalizeAngle(desired - cur);
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const maxTurn = 8 * dt * Math.min(1.8, b.homing);
    const angle = cur + clamp(diff, -maxTurn, maxTurn);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
  }

  updateBullets(dt, enemySlow = 1) {
    this._stepBullets(this.bullets, dt, false);
    this._stepBullets(this.enemyBullets, dt * enemySlow, true);
  }

  _stepBullets(pool, dt, isEnemy) {
    const player = this.player;
    for (let i = 0; i < pool.size; i++) {
      const b = pool.items[i];
      if (!b.active) continue;

      if (!isEnemy && b.homing > 0) this._steerBullet(b, dt);

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        pool.release(b);
        continue;
      }
      if (this._wallBounce(b, isEnemy, pool)) continue;

      if (isEnemy) {
        if (lineCircle(b.px, b.py, b.x, b.y, player.x, player.y, player.r + b.r) >= 0) {
          player.takeDamage(b.damage, this);
          this.particles.sparkBurst(b.x, b.y, 7, b.color, 240, 2.2, 0.35);
          pool.release(b);
        }
        continue;
      }

      this.candA.length = 0;
      const halfDist = Math.hypot(b.x - b.px, b.y - b.py) * 0.5;
      this.quadtree.query((b.x + b.px) * 0.5, (b.y + b.py) * 0.5, halfDist + b.r, this.candA);
      let released = false;

      for (let j = 0; j < this.candA.length; j++) {
        const e = this.candA[j];
        if (e.dead) continue;

        let already = false;
        for (let k = 0; k < b.hitCount; k++) {
          if (b.hits[k] === e.id) {
            already = true;
            break;
          }
        }
        if (already) continue;

        if (lineCircle(b.px, b.py, b.x, b.y, e.x, e.y, e.r + b.r) < 0) continue;

        if (e.type === 'hex' && e.isFrontal(b)) {
          const nx = Math.cos(e.shieldAngle);
          const ny = Math.sin(e.shieldAngle);
          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) {
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
          }
          b.x = e.x + nx * (e.r + 12);
          b.y = e.y + ny * (e.r + 12);
          b.damage *= 0.5;
          this.particles.sparkBurst(b.x, b.y, 6, '#46f4ff', 260, 2.2, 0.3);
          this.audio.deflect();
          continue;
        }

        if (b.hitCount < 8) b.hits[b.hitCount++] = e.id;

        let hitDamage = b.damage;
        if (player.stats.execute > 0 && e.hp / e.maxHp < 0.3) {
          hitDamage *= 1 + player.stats.execute;
        }
        const died = e.hit(hitDamage, this, b.vx * 0.06, b.vy * 0.06);
        if (player.stats.frost > 0) {
          e.slowTimer = Math.max(e.slowTimer, 1.2 + player.stats.frost * 0.25);
        }
        if (player.stats.lifesteal > 0) {
          player.hp = Math.min(player.stats.maxHp, player.hp + hitDamage * player.stats.lifesteal);
        }

        this.particles.sparkBurst(b.x, b.y, 5, b.color, 250, 2.2, 0.32);
        const crit = b.color === '#ffe066';
        if (this.settings.damageNumbers !== false) {
          this.particles.text(
            e.x + rand(-7, 7),
            e.y - e.r - 8,
            String(Math.round(e.lastHitAmount || hitDamage)),
            crit ? '#ffe066' : '#dffbff',
            crit ? 16 : 12,
            0.6
          );
        }
        this.audio.impact(crit);

        if (b.chain > 0 && Math.random() < 0.35) {
          this.chainLightning(e.x, e.y, b.chain, b.damage);
        }
        if (died) this.onEnemyKilled(e);

        if (b.pierce > 0) {
          b.pierce--;
        } else {
          pool.release(b);
          released = true;
          break;
        }
      }
      if (released) continue;
    }
  }

  chainLightning(x, y, hops, baseDamage) {
    this.chainHits.length = 0;
    let fromX = x;
    let fromY = y;
    const range = 330;
    const chainDamage = baseDamage * 0.55 + this.player.stats.chainDamage;

    for (let hop = 0; hop < hops; hop++) {
      this.candB.length = 0;
      this.quadtree.query(fromX, fromY, range, this.candB);
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < this.candB.length; i++) {
        const e = this.candB[i];
        if (e.dead) continue;
        let seen = false;
        for (let k = 0; k < this.chainHits.length; k++) {
          if (this.chainHits[k] === e.id) {
            seen = true;
            break;
          }
        }
        if (seen) continue;
        if (lineCircle(fromX, fromY, e.x, e.y, e.x, e.y, e.r + 2) < 0) continue;
        const d = dist2(fromX, fromY, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) break;
      this.chainHits.push(best.id);
      this.particles.lightning(fromX, fromY, best.x, best.y, '#8be9ff', 2.4, 0.2);
      this.particles.sparkBurst(best.x, best.y, 5, '#8be9ff', 200, 2, 0.3);
      const died = best.hit(chainDamage, this, 0, 0);
      if (this.settings.damageNumbers !== false) {
        this.particles.text(best.x, best.y - best.r - 8, String(Math.round(best.lastHitAmount || chainDamage)), '#8be9ff', 12, 0.6);
      }
      if (this.player.stats.frost > 0) {
        best.slowTimer = Math.max(best.slowTimer, 1.2 + this.player.stats.frost * 0.25);
      }
      this.audio.zap();
      if (died) this.onEnemyKilled(best);
      fromX = best.x;
      fromY = best.y;
    }
  }

  updateOrbitals(dt) {
    const n = Math.floor(this.player.stats.orbitalBlades);
    if (n <= 0) return;
    this.bladeAngle += dt * 2.7;
    const p = this.player;
    const radius = 84;
    for (let i = 0; i < n; i++) {
      const a = this.bladeAngle + (i / n) * TAU;
      const bx = p.x + Math.cos(a) * radius;
      const by = p.y + Math.sin(a) * radius;
      this.candC.length = 0;
      this.quadtree.query(bx, by, 22, this.candC);
      for (let j = 0; j < this.candC.length; j++) {
        const e = this.candC[j];
        if (e.dead || e.bladeCd > 0) continue;
        if (!circleCircle(bx, by, 19, e.x, e.y, e.r)) continue;
        e.bladeCd = 0.32;
        const died = e.hit(p.stats.bladeDamage, this, Math.cos(a) * 120, Math.sin(a) * 120);
        this.particles.sparkBurst(bx, by, 4, '#8be9ff', 200, 2, 0.28);
        if (died) this.onEnemyKilled(e);
      }
    }
  }

  updateSingularities(dt) {
    const p = this.player;
    for (let i = 0; i < this.singularities.length; i++) {
      const s = this.singularities[i];
      if (!s.active) continue;
      s.life -= dt;
      s.angle += dt * 4.5;

      this.candC.length = 0;
      this.quadtree.query(s.x, s.y, s.radius, this.candC);
      for (let j = 0; j < this.candC.length; j++) {
        const e = this.candC[j];
        if (e.dead) continue;
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < s.radius) {
          const force = (1 - d / s.radius) * 1150;
          e.impulseX += (dx / d) * force * dt;
          e.impulseY += (dy / d) * force * dt;
        }
      }
      if (Math.random() < 0.35) {
        const a = rand(0, TAU);
        const r = s.radius * (0.4 + Math.random() * 0.6);
        this.particles.trail(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, -Math.cos(a) * 300, -Math.sin(a) * 300, '#8b5cff', 2.2, 0.3);
      }

      if (s.life <= 0) {
        s.active = false;
        this.candC.length = 0;
        this.quadtree.query(s.x, s.y, s.radius, this.candC);
        for (let j = 0; j < this.candC.length; j++) {
          const e = this.candC[j];
          if (e.dead) continue;
          if (dist2(s.x, s.y, e.x, e.y) > s.radius * s.radius) continue;
          const died = e.hit(s.damage, this, (e.x - s.x) * 1.4, (e.y - s.y) * 1.4);
          if (died) this.onEnemyKilled(e);
        }
        this.particles.ring(s.x, s.y, '#8b5cff', 30, 900, 0.6, 5);
        this.particles.ring(s.x, s.y, '#ffffff', 12, 600, 0.45, 3);
        this.particles.sparkBurst(s.x, s.y, 30, '#b28cff', 500, 3, 0.8);
        this.particles.addShake(12);
        this.particles.hit(0.8);
        this.audio.explosion();
        if (dist2(p.x, p.y, s.x, s.y) < 150 * 150) p.takeDamage(12, this);
      }
    }
  }

  get comboMultiplier() {
    return 1 + Math.min(3, this.combo * 0.04);
  }

  onPlayerHit(amount) {
    if (this.combo >= 10) {
      this.particles.text(this.player.x, this.player.y - 48, 'CHAIN BROKEN', '#ff8dc0', 13, 0.9);
    }
    this.combo = Math.floor(this.combo * 0.5);
    this.comboTimer = Math.max(this.comboTimer, 0.9);
    if (this.particles.shakeScale > 0) this.particles.addShake(Math.min(6, amount * 0.25));
  }

  _detonate(e) {
    const volatile = e.elite && e.affix === 'volatile';
    const radius = volatile ? 150 : 165;
    const r2 = radius * radius;
    const p = this.player;
    if (dist2(p.x, p.y, e.x, e.y) < r2) {
      const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
      const base = volatile ? 20 + e.damage * 1.3 : 16 + e.damage * 1.6;
      p.takeDamage(base * (1 - d / radius * 0.55), this);
    }
    if (this.ally && !this.ally.downed && dist2(this.ally.x, this.ally.y, e.x, e.y) < r2) {
      this.ally.takeDamage(e.damage * 1.4, this);
    }
    this.particles.ring(e.x, e.y, volatile ? '#b06bff' : '#ff8a66', 26, 760, 0.6, 6);
    this.particles.ring(e.x, e.y, '#fff3e0', 14, 480, 0.4, 3);
    this.particles.sparkBurst(e.x, e.y, volatile ? 42 : 34, volatile ? '#c8b6ff' : '#ffb37a', 540, 3.2, 0.8);
    this.particles.addShake(12);
    this.particles.hit(0.7);
    this.audio.explosion(true);
    this.particles.text(e.x, e.y - 46, volatile ? 'VOLATILE BURST' : 'DETONATION', volatile ? '#c8b6ff' : '#ffb37a', 16, 1.1);
  }

  onEnemyKilled(e) {
    if (e.rewarded) return;
    e.rewarded = true;
    this.kills++;
    this.combo++;
    this.comboTimer = 3.4;
    this.comboBest = Math.max(this.comboBest, this.combo);
    const multiplier = this.comboMultiplier;
    this.score += Math.round(e.score * multiplier);
    this.gainXp(e.xp);

    if (this.combo === 10 || this.combo === 25 || this.combo === 50 || this.combo === 100) {
      this.particles.text(
        this.player.x,
        this.player.y - 66,
        `CHAIN x${this.combo} // ${multiplier.toFixed(1)}x`,
        this.combo >= 50 ? '#ff2f8e' : '#ffc857',
        18,
        1.6
      );
      this.audio.levelUp();
    }

    const isBoss = e.type === 'boss';
    const color = isBoss ? '#ff2f8e' : e.color;
    this.particles.ring(e.x, e.y, color, e.r * 0.8, isBoss ? 700 : 220, isBoss ? 0.9 : 0.4, isBoss ? 6 : 2);
    this.particles.sparkBurst(e.x, e.y, isBoss ? 70 : Math.min(18, 6 + Math.floor(e.r)), color, isBoss ? 650 : 320, isBoss ? 4 : 2.5, isBoss ? 1.2 : 0.5);
    this.particles.addShake(isBoss ? 26 : 2.5);
    this.audio.explosion(isBoss);

    if (isBoss) {
      this.bossKills++;
      this.enemies.boss = null;
      this.particles.text(e.x, e.y - 70, `${e.name || 'ARCHITECT'} TERMINATED`, '#ffd1e6', 22, 2.4);
      this.particles.hit(1.6);
      this.audio.bossDeath();
      for (let i = 0; i < 4; i++) {
        this.pickups.spawn(e.x + rand(-50, 50), e.y + rand(-50, 50), 'health');
      }
      this.pickups.spawn(e.x, e.y, 'overcharge');
    } else {
      if (e.type === 'bomber') {
        this._detonate(e);
      } else if (e.type === 'splitter') {
        this.enemies.spawnSwarm(e.x, e.y, 2, 0.72, this.elapsed);
        this.particles.ring(e.x, e.y, '#59ffa8', e.r, 420, 0.55, 3);
        this.particles.text(e.x, e.y - 38, 'SPLIT', '#8bffc4', 13, 1.0);
      }
      if (e.elite) {
        this.elitesKilled++;
        this.pickups.spawn(e.x + rand(-16, 16), e.y + rand(-16, 16), 'health');
        if (Math.random() < 0.55) this.pickups.spawn(e.x + rand(-24, 24), e.y + rand(-24, 24), 'overcharge');
        if (e.affix === 'volatile' && e.type !== 'bomber') this._detonate(e);
        this.particles.text(e.x, e.y - (e.r + 20), 'ELITE DOWN', '#ffc857', 14, 1.1);
      } else if (Math.random() < 0.07) {
        this.pickups.spawn(e.x, e.y, 'health');
      }
    }
  }

  gainXp(amount) {
    this.xp += amount * this.player.stats.xpGain;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(8 + this.level * 5 + Math.pow(this.level, 1.2));
      this.pendingLevelUps++;
      leveled = true;
    }
    if (leveled && !this.draftOpen) {
      this.draftOpen = true;
      this.audio.levelUp();
      this.onLevelUp();
    }
  }

  createDraft() {
    return draftUpgrades(this.player, 3, this.level);
  }

  rerollDraft() {
    if (this.rerolls <= 0) return null;
    this.rerolls--;
    this.audio.ui();
    return this.createDraft();
  }

  applyChosen(id) {
    const up = applyUpgrade(id, this.player, this);
    if (up) {
      const nextCap = Math.max(0, Math.floor(this.player.stats.rerolls));
      if (nextCap > this.rerollCap) {
        this.rerolls += nextCap - this.rerollCap;
        this.rerollCap = nextCap;
      }
      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
      const activated = checkSynergies(this.player, this);
      if (activated.length) this.onSynergy(activated);
    }
    if (this.pendingLevelUps <= 0) {
      this.pendingLevelUps = 0;
      this.draftOpen = false;
    }
    return this.pendingLevelUps;
  }

  onPlayerDeath() {
    if (this.over) return;
    this.over = true;
    this.audio.stopMusic();
    this.audio.gameOver();
    this.audio.explosion(true);
    this.particles.ring(this.player.x, this.player.y, '#ff2f8e', 20, 900, 0.9, 7);
    this.particles.ring(this.player.x, this.player.y, '#ffffff', 10, 600, 0.6, 4);
    this.particles.sparkBurst(this.player.x, this.player.y, 80, '#ff2f8e', 700, 4, 1.3);
    this.particles.hit(2);
    this.onGameOver();
  }

  finalizeRun() {
    if (this.finalized) return 0;
    this.finalized = true;
    const earned = Math.floor((this.score / 100 + this.level * 3) * this.save.currencyMultiplier());
    this.save.addCurrency(earned);
    this.save.addScore({
      score: this.score,
      time: this.elapsed,
      level: this.level,
      kills: this.kills,
      combo: this.comboBest,
      doctrine: this.doctrine.id,
      date: new Date().toISOString().slice(0, 10)
    });
    return earned;
  }

  activeEntities() {
    return this.enemies.enemies.length + this.bullets.active + this.enemyBullets.active + this.particles.activeCount;
  }

  drawWorld(ctx, alpha, camX, camY) {
    const view = this.view;
    const dpr = view.dpr || 1;
    this._cam = { x: camX, y: camY };
    this.renderScale = this.zoom;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawBackdrop(ctx, camX, camY);

    this.setGroundTransform(ctx, 0);
    this._drawFloor(ctx, camX, camY);
    this._drawShadows(ctx, alpha);
    this.player.drawGhosts(ctx, alpha);
    this._drawSingularities(ctx, alpha);

    this.setGroundTransform(ctx, 12);
    this._drawBullets(ctx, this.bullets, alpha, false);
    this._drawBullets(ctx, this.enemyBullets, alpha, true);

    const actors = [];
    for (let i = 0; i < this.enemies.enemies.length; i++) {
      const e = this.enemies.enemies[i];
      if (e.dead) continue;
      actors.push({ kind: 'enemy', ref: e, y: e.py + (e.y - e.py) * alpha });
    }
    actors.push({
      kind: 'player',
      ref: this.player,
      y: this.player.py + (this.player.y - this.player.py) * alpha
    });
    if (this.ally && !this.ally.downed) {
      actors.push({
        kind: 'ally',
        ref: this.ally,
        y: this.ally.py + (this.ally.y - this.ally.py) * alpha
      });
    }
    for (let i = 0; i < this.pickups.size; i++) {
      const p = this.pickups.items[i];
      if (p.active) actors.push({ kind: 'pickup', ref: p, y: p.y });
    }
    actors.sort((a, b) => a.y - b.y);

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      const ref = a.ref;
      const x = ref.px + (ref.x - ref.px) * alpha;
      const y = ref.py + (ref.y - ref.py) * alpha;
      let height = 14;
      if (a.kind === 'player') {
        height = 19;
        ref.renderAngle = this.projectAngle(ref.angle);
      } else if (a.kind === 'enemy') {
        height = ref.type === 'boss' ? 48 : ref.r * 0.95;
        ref.renderAngle = this.projectAngle(ref.angle);
        if (ref.shieldAngle != null) ref.renderShieldAngle = this.projectAngle(ref.shieldAngle);
      } else if (a.kind === 'ally') {
        height = 16;
        ref.renderAngle = this.projectAngle(ref.angle);
      } else if (a.kind === 'pickup') {
        height = 11;
      }
      this.setBillboardTransform(ctx, x, y, height);
      if (a.kind === 'pickup') this._drawPickup(ctx, ref);
      else ref.draw(ctx, alpha);
    }

    this.setGroundTransform(ctx, 10);
    this._drawBlades(ctx, alpha);

    this.particles.draw(ctx, this);

    if (this.debugQuadtree) {
      this.setGroundTransform(ctx, 0);
      ctx.save();
      ctx.globalAlpha = 0.9;
      this.quadtree.draw(ctx, true);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  _drawBackdrop(ctx, camX, camY) {
    const view = this.view;
    const w = view.w;
    const h = view.h;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05000f');
    sky.addColorStop(0.55, '#0c0621');
    sky.addColorStop(1, '#1b0626');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.54, 0, w * 0.5, h * 0.54, h * 0.85);
    glow.addColorStop(0, 'rgba(139, 92, 255, 0.18)');
    glow.addColorStop(0.45, 'rgba(255, 47, 142, 0.05)');
    glow.addColorStop(1, 'rgba(139, 92, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.starfield.length; i++) {
      const s = this.starfield[i];
      let sx = (s.x * w - camX * s.d * 0.16) % w;
      let sy = (s.y * h - camY * s.d * 0.1) % h;
      if (sx < 0) sx += w;
      if (sy < 0) sy += h;
      const twinkle = 0.68 + Math.sin(this.elapsed * s.tw + i * 1.7) * 0.32;
      ctx.globalAlpha = s.a * twinkle;
      ctx.fillStyle = s.hue;
      ctx.fillRect(sx, sy, s.s, s.s);
      if (s.s > 1.9) {
        ctx.globalAlpha = s.a * twinkle * 0.35;
        ctx.fillRect(sx - s.s, sy, s.s * 3, 0.6);
        ctx.fillRect(sx, sy - s.s, 0.6, s.s * 3);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawFloor(ctx, camX, camY) {
    const zoom = this.zoom || 1;
    const halfW = this.view.w / (2 * zoom);
    const halfH = this.view.h / (2 * zoom * this.tilt);
    const left = camX - halfW;
    const right = camX + halfW;
    const top = camY - halfH;
    const bottom = camY + halfH;

    const step = 90;
    const startX = Math.floor(left / step) * step;
    const startY = Math.floor(top / step) * step;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(70, 244, 255, 0.06)';
    ctx.beginPath();
    for (let x = startX; x <= right + step; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= bottom + step; y += step) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    const major = step * 5;
    const mx0 = Math.floor(left / major) * major;
    const my0 = Math.floor(top / major) * major;
    ctx.strokeStyle = 'rgba(139, 92, 255, 0.12)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = mx0; x <= right + major; x += major) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = my0; y <= bottom + major; y += major) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(70, 244, 255, 0.35)';
    const dotStep = major;
    const dx0 = Math.floor(left / dotStep) * dotStep;
    const dy0 = Math.floor(top / dotStep) * dotStep;
    for (let x = dx0; x <= right + dotStep; x += dotStep) {
      for (let y = dy0; y <= bottom + dotStep; y += dotStep) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#46f4ff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = 'rgba(70, 244, 255, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(1, 1, this.world.w - 2, this.world.h - 2);
    ctx.strokeStyle = 'rgba(255, 47, 142, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, this.world.w - 32, this.world.h - 32);
    ctx.restore();
  }

  _drawShadows(ctx, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';

    const shadow = (ref, r) => {
      const x = ref.px + (ref.x - ref.px) * alpha;
      const y = ref.py + (ref.y - ref.py) * alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };

    for (let i = 0; i < this.enemies.enemies.length; i++) {
      const e = this.enemies.enemies[i];
      if (e.dead) continue;
      shadow(e, e.r * 1.15);
      if (e.elite) {
        const x = e.px + (e.x - e.px) * alpha;
        const y = e.py + (e.y - e.py) * alpha;
        const aura = e.affix === 'armored' ? '#8be9ff' : e.affix === 'swift' ? '#ffc857' : '#ff8a66';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16 + Math.sin(e.age * 4.5) * 0.05;
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(x, y, e.r * 1.8, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.62;
        ctx.strokeStyle = aura;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(x, y, e.r * 1.5, e.age * 1.4, e.age * 1.4 + TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    for (let i = 0; i < this.pickups.size; i++) {
      const p = this.pickups.items[i];
      if (!p.active) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, TAU);
      ctx.fill();
    }
    shadow(this.player, 17);
    if (this.ally && !this.ally.downed) shadow(this.ally, 14);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const px = this.player.px + (this.player.x - this.player.px) * alpha;
    const py = this.player.py + (this.player.y - this.player.py) * alpha;
    ctx.strokeStyle = 'rgba(70, 244, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 24, 0, TAU);
    ctx.stroke();
    if (this.ally && !this.ally.downed) {
      const ax = this.ally.px + (this.ally.x - this.ally.px) * alpha;
      const ay = this.ally.py + (this.ally.y - this.ally.py) * alpha;
      ctx.strokeStyle = this.ally.colors.stroke;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(ax, ay, 20, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawPickup(ctx, p) {
    const overcharge = p.type === 'overcharge';
    const color = overcharge ? '#ffe066' : '#59ffa8';
    const glow = overcharge ? 'rgba(255, 224, 102, 0.4)' : 'rgba(89, 255, 168, 0.35)';
    const pulse = 1 + Math.sin(p.age * (overcharge ? 11 : 7)) * 0.18;
    const fade = p.life < 3 ? (Math.floor(p.life * 8) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.age * (overcharge ? 2.4 : 0));
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = color;
    if (overcharge) {
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, -1);
      ctx.lineTo(2, -1);
      ctx.lineTo(4, 9);
      ctx.lineTo(-6, 1);
      ctx.lineTo(-2, 1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawBullets(ctx, pool, alpha, isEnemy) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < pool.size; i++) {
      const b = pool.items[i];
      if (!b.active) continue;
      const x = b.px + (b.x - b.px) * alpha;
      const y = b.py + (b.y - b.py) * alpha;
      const px = b.px;
      const py = b.py;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = isEnemy ? 0.9 : 0.95;
      ctx.lineWidth = b.size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (isEnemy) {
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(x, y, b.size * 0.9, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawSingularities(ctx, alpha) {
    for (let i = 0; i < this.singularities.length; i++) {
      const s = this.singularities[i];
      if (!s.active) continue;
      const t = 1 - s.life / s.maxLife;
      const radius = s.radius * (0.55 + t * 0.45);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(139, 92, 255, 0.5)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius * (0.35 + k * 0.22), s.angle + k * 2, s.angle + k * 2 + Math.PI * 1.2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(10, 0, 25, 0.55)';
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius * 0.22, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(178, 140, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5 + Math.sin(s.angle * 3) * 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _drawBlades(ctx, alpha) {
    const n = Math.floor(this.player.stats.orbitalBlades);
    if (n <= 0) return;
    const p = this.player;
    const px = p.px + (p.x - p.px) * alpha;
    const py = p.py + (p.y - p.py) * alpha;
    const radius = 84;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = this.bladeAngle + (i / n) * TAU;
      const bx = px + Math.cos(a) * radius;
      const by = py + Math.sin(a) * radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + this.bladeAngle * 0.6);
      ctx.fillStyle = 'rgba(70, 244, 255, 0.9)';
      ctx.strokeStyle = '#dffbff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(70, 244, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, radius, a - 0.15, a + 0.15);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
