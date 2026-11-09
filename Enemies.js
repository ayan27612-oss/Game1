import {
  TAU,
  clamp,
  rand,
  dist2,
  normalizeAngle,
  angleDiff,
  lineCircle
} from '../engine/MathUtils.js';

let NEXT_ID = 1;

const TELEGRAPH_DASH = [7, 9];
const HEX_POINTS = 6;

class Enemy {
  constructor(type, x, y) {
    this.id = NEXT_ID++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.vx = 0;
    this.vy = 0;
    this.impulseX = 0;
    this.impulseY = 0;
    this.r = 12;
    this.hp = 20;
    this.maxHp = 20;
    this.speed = 100;
    this.damage = 10;
    this.score = 10;
    this.xp = 3;
    this.color = '#ff5b8f';
    this.dead = false;
    this.rewarded = false;
    this.hitFlash = 0;
    this.age = 0;
    this.angle = 0;
    this.bladeCd = 0;
    this.spawnT = 0.3;
    this.slowTimer = 0;
  }

  slowFactor() {
    return this.slowTimer > 0 ? 0.52 : 1;
  }

  prev() {
    this.px = this.x;
    this.py = this.y;
  }

  applyImpulse(dt) {
    this.x += this.impulseX * dt;
    this.y += this.impulseY * dt;
    const d = Math.exp(-7 * dt);
    this.impulseX *= d;
    this.impulseY *= d;
  }

  hit(amount, game, ix = 0, iy = 0) {
    if (this.dead) return false;
    this.hp -= amount;
    this.hitFlash = 0.12;
    const kb = this.type === 'boss' ? 0.06 : 0.5;
    this.impulseX += ix * kb;
    this.impulseY += iy * kb;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      return true;
    }
    return false;
  }

  updateTimers(dt) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.bladeCd = Math.max(0, this.bladeCd - dt);
    this.spawnT = Math.max(0, this.spawnT - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
  }

  clampWorld(game) {
    const m = this.r + 6;
    this.x = clamp(this.x, m, game.world.w - m);
    this.y = clamp(this.y, m, game.world.h - m);
  }

  drawHealthBar(ctx, x, y, w = 28) {
    if (this.hp >= this.maxHp || this.dead) return;
    const ratio = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - w * 0.5, y, w, 3);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#ff2f8e';
    ctx.fillRect(x - w * 0.5, y, w * ratio, 3);
  }
}

class Swarmer extends Enemy {
  constructor(x, y, scale = 1) {
    super('swarmer', x, y);
    this.r = 11;
    this.hp = 16 * scale;
    this.maxHp = this.hp;
    this.speed = 142 * (1 + Math.min(0.55, (scale - 1) * 0.25));
    this.damage = 5 * (1 + (scale - 1) * 0.25);
    this.score = 12;
    this.xp = 3;
    this.color = '#ff5b8f';
    this.wander = rand(0, TAU);
    this.angle = rand(0, TAU);
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const list = manager.enemies;

    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohX = 0;
    let cohY = 0;
    let count = 0;
    const NEIGHBOR2 = 130 * 130;
    const SEP2 = 44 * 44;

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || e.dead || e.type !== 'swarmer') continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > NEIGHBOR2 || d2 < 1e-4) continue;
      const d = Math.sqrt(d2);
      aliX += e.vx;
      aliY += e.vy;
      cohX += e.x;
      cohY += e.y;
      count++;
      if (d2 < SEP2) {
        const push = (1 - d / 44) * 1.9;
        sepX -= (dx / d) * push;
        sepY -= (dy / d) * push;
      }
    }

    let seekX = player.x - this.x;
    let seekY = player.y - this.y;
    const sd = Math.hypot(seekX, seekY) || 1;
    seekX /= sd;
    seekY /= sd;

    this.wander += dt * 2.4;
    const wanderX = Math.cos(this.wander + this.id * 0.7) * 0.28;
    const wanderY = Math.sin(this.wander * 1.3 + this.id) * 0.28;

    let desiredX = seekX * 1.1 + sepX + wanderX;
    let desiredY = seekY * 1.1 + sepY + wanderY;
    if (count > 0) {
      desiredX += (aliX / count) * 0.03 + (cohX / count - this.x) * 0.008;
      desiredY += (aliY / count) * 0.03 + (cohY / count - this.y) * 0.008;
    }
    const dl = Math.hypot(desiredX, desiredY) || 1;
    desiredX /= dl;
    desiredY /= dl;

    const accel = 6.5;
    const chaseSpeed = this.speed * this.slowFactor();
    this.vx += (desiredX * chaseSpeed - this.vx) * Math.min(1, dt * accel);
    this.vy += (desiredY * chaseSpeed - this.vy) * Math.min(1, dt * accel);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);
    this.angle = Math.atan2(this.vy, this.vx);
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const pulse = 1 + Math.sin(this.age * 8 + this.id) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderAngle != null ? this.renderAngle : this.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : '#ff9cc7';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(12 * pulse, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx, x, y - 18);
  }
}

class Sniper extends Enemy {
  constructor(x, y, scale = 1) {
    super('sniper', x, y);
    this.r = 15;
    this.hp = 34 * scale;
    this.maxHp = this.hp;
    this.speed = 84;
    this.damage = 12 * (1 + (scale - 1) * 0.3);
    this.score = 30;
    this.xp = 7;
    this.color = '#ffc857';
    this.telegraph = 0;
    this.cooldown = rand(0.8, 2.2);
    this.aimAngle = 0;
    this.beamTime = 0;
    this.beamHit = false;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.orbit = rand(0, TAU);
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);
    this.angle = toPlayer;

    const desiredDist = 330;
    let moveX = 0;
    let moveY = 0;
    if (dist < desiredDist - 70) {
      moveX = -dx / dist;
      moveY = -dy / dist;
    } else if (dist > desiredDist + 70) {
      moveX = dx / dist;
      moveY = dy / dist;
    } else {
      this.orbit += dt * 0.7 * this.strafeDir;
      moveX = Math.cos(this.orbit);
      moveY = Math.sin(this.orbit);
    }
    const sp = this.speed * (this.telegraph > 0 ? 0.25 : 1) * this.slowFactor();
    this.vx += (moveX * sp - this.vx) * Math.min(1, dt * 3.4);
    this.vy += (moveY * sp - this.vy) * Math.min(1, dt * 3.4);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);

    if (this.beamTime > 0) {
      this.beamTime -= dt;
      if (!this.beamHit) {
        const ex = this.x + Math.cos(this.aimAngle) * 1500;
        const ey = this.y + Math.sin(this.aimAngle) * 1500;
        if (lineCircle(this.x, this.y, ex, ey, player.x, player.y, player.r) >= 0) {
          if (player.takeDamage(this.damage, game)) {
            this.beamHit = true;
            game.particles.sparkBurst(player.x, player.y, 12, '#ffc857', 300, 2.4, 0.4);
          }
        }
      }
      return;
    }

    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }

    if (this.telegraph > 0) {
      this.telegraph -= dt;
      this.aimAngle = toPlayer;
      if (this.telegraph <= 0) {
        this.aimAngle = toPlayer;
        this.beamTime = 0.15;
        this.beamHit = false;
        this.cooldown = rand(2.2, 3.1);
        game.audio.enemyShot();
        game.audio.zap();
        const ex = this.x + Math.cos(this.aimAngle) * 1500;
        const ey = this.y + Math.sin(this.aimAngle) * 1500;
        game.particles.lightning(this.x, this.y, ex, ey, '#ffc857', 2.4, 0.18);
      }
    } else {
      this.telegraph = 1.0;
      this.aimAngle = toPlayer;
    }
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;

    if (this.telegraph > 0) {
      const a = 1 - this.telegraph;
      const ex = x + Math.cos(this.aimAngle) * 1500;
      const ey = y + Math.sin(this.aimAngle) * 1500;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 200, 87, ${0.14 + a * 0.4})`;
      ctx.lineWidth = 1 + a * 1.6;
      ctx.setLineDash(TELEGRAPH_DASH);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (this.beamTime > 0) {
      const ex = x + Math.cos(this.aimAngle) * 1500;
      const ey = y + Math.sin(this.aimAngle) * 1500;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255, 200, 87, 0.35)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = '#fff6d8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderAngle != null ? this.renderAngle : this.angle);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : 'rgba(38, 28, 10, 0.95)';
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.telegraph > 0 ? '#fff6d8' : '#ffc857';
    ctx.globalAlpha = this.telegraph > 0 ? 0.65 + Math.sin(this.age * 30) * 0.35 : 1;
    ctx.beginPath();
    ctx.arc(3, 0, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    this.drawHealthBar(ctx, x, y - 23, 30);
  }
}

class Hex extends Enemy {
  constructor(x, y, scale = 1) {
    super('hex', x, y);
    this.r = 21;
    this.hp = 78 * scale;
    this.maxHp = this.hp;
    this.speed = 52;
    this.damage = 10 * (1 + (scale - 1) * 0.3);
    this.score = 44;
    this.xp = 11;
    this.color = '#8b5cff';
    this.shieldAngle = rand(0, TAU);
    this.shieldArc = Math.PI * 0.92;
    this.spin = rand(-0.4, 0.4);
    this.orbit = rand(0, TAU);
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);

    this.shieldAngle = this.shieldAngle + normalizeAngle(toPlayer - this.shieldAngle) * Math.min(1, dt * 4.2);

    let mx = 0;
    let my = 0;
    if (dist > 210) {
      mx = dx / dist;
      my = dy / dist;
    } else {
      this.orbit += dt * 0.5;
      mx = Math.cos(this.orbit) * 0.45;
      my = Math.sin(this.orbit) * 0.45;
    }
    this.vx += (mx * this.speed * this.slowFactor() - this.vx) * Math.min(1, dt * 2.4);
    this.vy += (my * this.speed * this.slowFactor() - this.vy) * Math.min(1, dt * 2.4);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);
    this.angle += this.spin * dt;
  }

  isFrontal(bullet) {
    const ang = Math.atan2(bullet.y - this.y, bullet.x - this.x);
    const diff = Math.abs(angleDiff(this.shieldAngle, ang));
    if (diff > this.shieldArc * 0.5) return false;
    const toX = this.x - bullet.x;
    const toY = this.y - bullet.y;
    return bullet.vx * toX + bullet.vy * toY > 0;
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const R = this.r;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderAngle != null ? this.renderAngle : this.angle);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : 'rgba(25, 15, 48, 0.95)';
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < HEX_POINTS; i++) {
      const a = (i / HEX_POINTS) * TAU;
      const px = Math.cos(a) * R;
      const py = Math.sin(a) * R;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(139, 92, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < HEX_POINTS; i++) {
      const a = (i / HEX_POINTS) * TAU;
      const px = Math.cos(a) * R * 0.6;
      const py = Math.sin(a) * R * 0.6;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderShieldAngle != null ? this.renderShieldAngle : this.shieldAngle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(70, 244, 255, 0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, R + 8, -this.shieldArc * 0.5, this.shieldArc * 0.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70, 244, 255, 0.18)';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(0, 0, R + 8, -this.shieldArc * 0.5, this.shieldArc * 0.5);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    this.drawHealthBar(ctx, x, y - 32, 34);
  }
}

class Bomber extends Enemy {
  constructor(x, y, scale = 1) {
    super('bomber', x, y);
    this.r = 20;
    this.hp = 66 * scale;
    this.maxHp = this.hp;
    this.speed = 82;
    this.damage = 14 * (1 + (scale - 1) * 0.3);
    this.score = 38;
    this.xp = 9;
    this.color = '#ff8a66';
    this.fuse = -1;
    this.spin = rand(-0.8, 0.8);
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);

    if (this.fuse >= 0) {
      this.fuse -= dt;
      this.vx *= Math.exp(-4 * dt);
      this.vy *= Math.exp(-4 * dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.applyImpulse(dt);
      if (this.fuse <= 0) {
        this.dead = true;
        game.onEnemyKilled(this);
      }
      return;
    }

    const sp = this.speed * this.slowFactor();
    this.vx += ((dx / dist) * sp - this.vx) * Math.min(1, dt * 2.6);
    this.vy += ((dy / dist) * sp - this.vy) * Math.min(1, dt * 2.6);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);

    if (this.spawnT <= 0 && dist < this.r + player.r + 46) this.fuse = 0.7;
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const armed = this.fuse >= 0;
    const pulse = 1 + Math.sin(this.age * (armed ? 28 : 6)) * (armed ? 0.14 : 0.05);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.age * this.spin);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (armed ? '#ff5b3d' : '#5a1806');
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * pulse, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 138, 102, 0.7)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * this.r * 0.55, Math.sin(a) * this.r * 0.55);
      ctx.lineTo(Math.cos(a) * this.r * 1.18, Math.sin(a) * this.r * 1.18);
      ctx.stroke();
    }
    ctx.fillStyle = armed ? '#fff3e0' : '#ffb37a';
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.34 * pulse, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx, x, y - 30, 34);
  }
}

class Splitter extends Enemy {
  constructor(x, y, scale = 1) {
    super('splitter', x, y);
    this.r = 18;
    this.hp = 72 * scale;
    this.maxHp = this.hp;
    this.speed = 108;
    this.damage = 9 * (1 + (scale - 1) * 0.3);
    this.score = 34;
    this.xp = 8;
    this.color = '#59ffa8';
    this.orbit = rand(0, TAU);
    this.wobble = rand(0, TAU);
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.wobble += dt * 4.2;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const sway = Math.sin(this.wobble) * 0.5;
    const sp = this.speed * this.slowFactor();
    const mx = (dx / dist) + perpX * sway;
    const my = (dy / dist) + perpY * sway;
    this.vx += (mx * sp - this.vx) * Math.min(1, dt * 3.2);
    this.vy += (my * sp - this.vy) * Math.min(1, dt * 3.2);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);
    this.angle = Math.atan2(this.vy, this.vx);
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const pulse = 1 + Math.sin(this.age * 5 + this.id) * 0.07;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderAngle != null ? this.renderAngle : this.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : 'rgba(6, 37, 28, 0.95)';
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const rr = this.r * pulse * (i % 2 === 0 ? 1 : 0.78);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8bffc4';
    for (let i = 0; i < 3; i++) {
      const a = this.age * 2.4 + (i / 3) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * this.r * 0.42, Math.sin(a) * this.r * 0.42, 3.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx, x, y - 28, 32);
  }
}

class Weaver extends Enemy {
  constructor(x, y, scale = 1) {
    super('weaver', x, y);
    this.r = 13;
    this.hp = 30 * scale;
    this.maxHp = this.hp;
    this.speed = 208;
    this.damage = 7 * (1 + (scale - 1) * 0.3);
    this.score = 22;
    this.xp = 5;
    this.color = '#46f4ff';
    this.phase = rand(0, TAU);
    this.trailTimer = 0;
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.phase += dt * 9;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const sway = Math.sin(this.phase) * 0.85;
    const sp = this.speed * this.slowFactor();
    this.vx += (((dx / dist) + perpX * sway) * sp - this.vx) * Math.min(1, dt * 6);
    this.vy += (((dy / dist) + perpY * sway) * sp - this.vy) * Math.min(1, dt * 6);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);
    this.angle = Math.atan2(this.vy, this.vx);

    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.05;
      game.particles.trail(this.x, this.y, -this.vx, -this.vy, this.color, 1.6, 0.24);
    }
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderAngle != null ? this.renderAngle : this.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : 'rgba(5, 30, 40, 0.9)';
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-6, -10);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-6, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#dffbff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx, x, y - 22, 26);
  }
}

class Gunner extends Enemy {
  constructor(x, y, scale = 1) {
    super('gunner', x, y);
    this.r = 16;
    this.hp = 52 * scale;
    this.maxHp = this.hp;
    this.speed = 74;
    this.damage = 9 * (1 + (scale - 1) * 0.3);
    this.score = 36;
    this.xp = 9;
    this.color = '#ff7bbd';
    this.cooldown = rand(0.9, 2.0);
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.orbit = rand(0, TAU);
    this.aimAngle = 0;
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);
    this.angle = toPlayer;

    const desiredDist = 300;
    let mx = 0;
    let my = 0;
    if (dist < desiredDist - 80) {
      mx = -dx / dist;
      my = -dy / dist;
    } else if (dist > desiredDist + 80) {
      mx = dx / dist;
      my = dy / dist;
    } else {
      this.orbit += dt * 0.9 * this.strafeDir;
      mx = Math.cos(this.orbit);
      my = Math.sin(this.orbit);
    }
    const sp = this.speed * this.slowFactor();
    this.vx += (mx * sp - this.vx) * Math.min(1, dt * 3);
    this.vy += (my * sp - this.vy) * Math.min(1, dt * 3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyImpulse(dt);
    this.clampWorld(game);

    this.cooldown -= dt;
    if (this.cooldown <= 0 && this.spawnT <= 0) {
      this.cooldown = rand(1.8, 2.7);
      this.aimAngle = toPlayer;
      for (let i = -1; i <= 1; i++) {
        const a = toPlayer + i * 0.16;
        game.spawnEnemyBullet(
          this.x + Math.cos(a) * 20,
          this.y + Math.sin(a) * 20,
          Math.cos(a) * 520,
          Math.sin(a) * 520,
          4,
          this.damage,
          2.2,
          '#ff7bbd',
          3.4
        );
      }
      game.audio.enemyShot();
      game.particles.directionalSparks(this.x, this.y, Math.cos(toPlayer), Math.sin(toPlayer), 3, this.color, 180, 1.6, 0.2);
    }
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.renderAngle != null ? this.renderAngle : this.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : 'rgba(42, 10, 28, 0.95)';
    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, -10);
    ctx.lineTo(4, -14);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-12, 9);
    ctx.lineTo(4, 14);
    ctx.lineTo(16, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.fillRect(9, -9, 14, 4);
    ctx.fillRect(9, -2, 16, 4);
    ctx.fillRect(9, 5, 14, 4);
    ctx.fillStyle = '#ffe6f1';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx, x, y - 26, 30);
  }
}

function makeBossBeam() {
  return { active: false, angle: 0, telegraph: 0, activeTime: 0, rotation: 0 };
}

class Boss extends Enemy {
  constructor(x, y, bossIndex, elapsed) {
    super('boss', x, y);
    this.r = 62;
    this.maxHp = 650 + bossIndex * 500 + elapsed * 4;
    this.hp = this.maxHp;
    this.speed = 50 + bossIndex * 6;
    this.damage = 18 + bossIndex * 3;
    this.score = 700 + bossIndex * 250;
    this.xp = 140 + bossIndex * 40;
    this.color = '#ff2f8e';
    this.phase = 1;
    this.attackTimer = 1.6;
    this.radialTimer = 1.2;
    this.spiralTimer = 0;
    this.spiralAngle = rand(0, TAU);
    this.summonTimer = 6;
    this.beamTimer = 4;
    this.chargeTimer = 0;
    this.chargeCooldown = 4;
    this.chargeDirX = 0;
    this.chargeDirY = 0;
    this.orbit = rand(0, TAU);
    this.beams = new Array(3);
    for (let i = 0; i < 3; i++) this.beams[i] = makeBossBeam();
  }

  _phaseCheck(game) {
    const ratio = this.hp / this.maxHp;
    const next = ratio < 0.33 ? 3 : ratio < 0.66 ? 2 : 1;
    if (next > this.phase) {
      this.phase = next;
      game.particles.ring(this.x, this.y, this.phase === 3 ? '#ff2f8e' : '#8b5cff', 40, 700, 0.7, 6);
      game.particles.ring(this.x, this.y, '#ffffff', 20, 500, 0.5, 3);
      game.particles.sparkBurst(this.x, this.y, 40, this.phase === 3 ? '#ff2f8e' : '#8b5cff', 520, 3.4, 0.9);
      game.particles.addShake(18);
      game.particles.hit(1.2);
      game.particles.text(this.x, this.y - 90, this.phase === 3 ? 'FINAL PHASE' : 'PHASE II', '#ffd1e6', 22, 1.6);
      game.audio.boss();
    }
  }

  _startBeams(game) {
    const base = Math.atan2(game.player.y - this.y, game.player.x - this.x);
    for (let i = 0; i < 3; i++) {
      const b = this.beams[i];
      b.active = true;
      b.angle = base + (i / 3) * TAU;
      b.telegraph = 0.9;
      b.activeTime = 0.5;
      b.rotation = 0.55;
    }
    game.particles.text(this.x, this.y - 80, 'LOCKING BEAMS', '#ff8dc0', 15, 1.0);
  }

  _radial(game, count, speed, offset = 0) {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * TAU;
      game.spawnEnemyBullet(
        this.x + Math.cos(a) * (this.r + 6),
        this.y + Math.sin(a) * (this.r + 6),
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        6,
        this.damage * 0.45,
        5.5,
        '#ff2f8e',
        5
      );
    }
    game.particles.ring(this.x, this.y, '#ff2f8e', 20, 240, 0.35, 2);
    game.audio.zap();
  }

  update(dt, game, manager) {
    this.updateTimers(dt);
    this._phaseCheck(game);

    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);
    this.angle = toPlayer;

    this.chargeCooldown -= dt;
    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      const chargeSpeed = this.speed * 4.2 * this.slowFactor();
      this.x += this.chargeDirX * chargeSpeed * dt;
      this.y += this.chargeDirY * chargeSpeed * dt;
      if (Math.random() < 0.5) {
        game.particles.trail(this.x, this.y, -this.chargeDirX * 200, -this.chargeDirY * 200, '#ff2f8e', 4, 0.4);
      }
    } else {
      this.orbit += dt * (0.28 + this.phase * 0.06);
      const desiredDist = this.phase === 3 ? 190 : 260;
      let mx = 0;
      let my = 0;
      if (dist > desiredDist + 40) {
        mx = dx / dist;
        my = dy / dist;
      } else if (dist < desiredDist - 40) {
        mx = -dx / dist;
        my = -dy / dist;
      }
      mx += Math.cos(this.orbit) * 0.55;
      my += Math.sin(this.orbit) * 0.55;
      const ml = Math.hypot(mx, my) || 1;
      const sp = this.speed * (this.phase === 3 ? 1.35 : 1) * this.slowFactor();
      this.vx += ((mx / ml) * sp - this.vx) * Math.min(1, dt * 1.8);
      this.vy += ((my / ml) * sp - this.vy) * Math.min(1, dt * 1.8);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    this.applyImpulse(dt);
    this.clampWorld(game);

    if (this.phase === 1) {
      this.radialTimer -= dt;
      if (this.radialTimer <= 0) {
        this._radial(game, 14, 190, rand(0, TAU));
        this.radialTimer = 1.9;
      }
    } else if (this.phase === 2) {
      this.radialTimer -= dt;
      if (this.radialTimer <= 0) {
        this._radial(game, 18, 210, rand(0, TAU));
        this.radialTimer = 2.4;
      }
      this.spiralTimer -= dt;
      if (this.spiralTimer <= 0) {
        this.spiralAngle += 0.32;
        for (let k = 0; k < 2; k++) {
          const a = this.spiralAngle + k * Math.PI;
          game.spawnEnemyBullet(
            this.x + Math.cos(a) * (this.r + 4),
            this.y + Math.sin(a) * (this.r + 4),
            Math.cos(a) * 245,
            Math.sin(a) * 245,
            5,
            this.damage * 0.32,
            4.5,
            '#ff8dc0',
            4
          );
        }
        this.spiralTimer = 0.12;
      }
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        manager.spawnSwarm(this.x + rand(-60, 60), this.y + rand(-60, 60), 4, 1.15);
        this.summonTimer = 7;
        game.particles.ring(this.x, this.y, '#8b5cff', 30, 420, 0.5, 3);
      }
    } else {
      this.radialTimer -= dt;
      if (this.radialTimer <= 0) {
        this._radial(game, 22, 235, rand(0, TAU));
        this.radialTimer = 1.7;
      }
      this.beamTimer -= dt;
      if (this.beamTimer <= 0) {
        this._startBeams(game);
        this.beamTimer = 5.2;
      }
      if (this.chargeCooldown <= 0 && this.chargeTimer <= 0) {
        this.chargeDirX = dx / dist;
        this.chargeDirY = dy / dist;
        this.chargeTimer = 0.75;
        this.chargeCooldown = 5.5;
        game.particles.text(this.x, this.y - 80, 'CHARGE', '#ff2f8e', 17, 0.9);
        game.audio.boss();
      }
    }

    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      if (b.telegraph > 0) {
        b.telegraph -= dt;
        b.angle += b.rotation * dt;
        if (b.telegraph <= 0) {
          b.activeTime = 0.5;
          game.particles.addShake(8);
          game.audio.zap();
        }
      } else {
        b.activeTime -= dt;
        b.angle += b.rotation * 2.2 * dt;
        const ex = this.x + Math.cos(b.angle) * 1600;
        const ey = this.y + Math.sin(b.angle) * 1600;
        if (lineCircle(this.x, this.y, ex, ey, player.x, player.y, player.r) >= 0) {
          player.takeDamage(this.damage * 0.6, game);
        }
        if (b.activeTime <= 0) b.active = false;
      }
    }
  }

  drawBeams(ctx) {
    const x = this.x;
    const y = this.y;
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      const ex = x + Math.cos(b.angle) * 1600;
      const ey = y + Math.sin(b.angle) * 1600;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (b.telegraph > 0) {
        const a = 1 - b.telegraph / 0.9;
        ctx.strokeStyle = `rgba(255, 47, 142, ${0.15 + a * 0.45})`;
        ctx.lineWidth = 2;
        ctx.setLineDash(TELEGRAPH_DASH);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(255, 47, 142, 0.35)';
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = '#ffd1e6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, alpha) {
    this.drawBeams(ctx);
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const R = this.r;
    const phaseColor = this.phase === 3 ? '#ff2f8e' : this.phase === 2 ? '#b06bff' : '#ff7bbd';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle * 0.2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255, 47, 142, 0.28)';
    ctx.lineWidth = 1.5;
    for (let ring = 0; ring < 3; ring++) {
      const rr = R + 14 + ring * 12 + Math.sin(this.age * 2 + ring) * 4;
      ctx.beginPath();
      ctx.arc(0, 0, rr, this.age * (0.4 + ring * 0.15), this.age * (0.4 + ring * 0.15) + Math.PI * 1.25);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-this.age * 0.6);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : 'rgba(30, 8, 28, 0.96)';
    ctx.strokeStyle = phaseColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = phaseColor;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const rr = i % 2 === 0 ? R : R * 0.74;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.age * 0.9);
    ctx.strokeStyle = 'rgba(255, 209, 230, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * R * 0.48;
      const py = Math.sin(a) * R * 0.48;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    const pulse = 1 + Math.sin(this.age * 5) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = phaseColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, 15 * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, 7 * pulse, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export class EnemyManager {
  constructor() {
    this.enemies = [];
    this.boss = null;
  }

  reset() {
    this.enemies.length = 0;
    this.boss = null;
  }

  prevAll() {
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].prev();
  }

  _scaledStats(baseHp, baseSpeed, baseDamage, elapsed) {
    const hpMul = 1 + Math.min(1.2, elapsed * 0.008);
    const speedMul = 1 + Math.min(0.35, elapsed * 0.0022);
    const dmgMul = 1 + Math.min(0.7, elapsed * 0.0022);
    return { hp: baseHp * hpMul, speed: baseSpeed * speedMul, damage: baseDamage * dmgMul };
  }

  spawn(type, x, y, elapsed = 0) {
    let e;
    if (type === 'swarmer') {
      const s = this._scaledStats(20, 142, 5, elapsed);
      e = new Swarmer(x, y, s.hp / 20);
      e.speed = s.speed;
      e.damage = s.damage;
    } else if (type === 'sniper') {
      const s = this._scaledStats(46, 84, 12, elapsed);
      e = new Sniper(x, y, s.hp / 46);
      e.speed = s.speed;
      e.damage = s.damage;
    } else if (type === 'hex') {
      const s = this._scaledStats(100, 52, 10, elapsed);
      e = new Hex(x, y, s.hp / 100);
      e.speed = s.speed;
      e.damage = s.damage;
    } else if (type === 'bomber') {
      const s = this._scaledStats(70, 82, 14, elapsed);
      e = new Bomber(x, y, s.hp / 70);
      e.speed = s.speed;
      e.damage = s.damage;
    } else if (type === 'splitter') {
      const s = this._scaledStats(76, 108, 9, elapsed);
      e = new Splitter(x, y, s.hp / 76);
      e.speed = s.speed;
      e.damage = s.damage;
    } else if (type === 'weaver') {
      const s = this._scaledStats(32, 208, 7, elapsed);
      e = new Weaver(x, y, s.hp / 32);
      e.speed = s.speed;
      e.damage = s.damage;
    } else if (type === 'gunner') {
      const s = this._scaledStats(56, 74, 9, elapsed);
      e = new Gunner(x, y, s.hp / 56);
      e.speed = s.speed;
      e.damage = s.damage;
    } else {
      e = new Swarmer(x, y, 1);
    }
    this.enemies.push(e);
    return e;
  }

  spawnSwarm(x, y, count, scale = 1, elapsed = 0) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const r = rand(10, 72);
      const e = this.spawn('swarmer', x + Math.cos(a) * r, y + Math.sin(a) * r, elapsed);
      if (scale !== 1) {
        e.hp *= scale;
        e.maxHp *= scale;
      }
    }
  }

  spawnBoss(x, y, bossIndex, elapsed) {
    const boss = new Boss(x, y, bossIndex, elapsed);
    this.enemies.push(boss);
    this.boss = boss;
    return boss;
  }

  update(dt, game) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      e.update(dt, game, this);
    }
  }

  cleanup() {
    const list = this.enemies;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].dead) {
        if (this.boss === list[i]) this.boss = null;
        const last = list.length - 1;
        list[i] = list[last];
        list.pop();
      }
    }
  }

  draw(ctx, alpha) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.dead) e.draw(ctx, alpha);
    }
  }
}
