import { TAU, clamp, rand } from '../engine/MathUtils.js';
import { drawArmorBody, ALLY_PALETTES } from '../systems/Customization.js';

/**
 * War Machine. The companion is deliberately automatic: a minigun that fires
 * in bursts and a shoulder missile pod on a slow cycle. No inputs, no drafting.
 */
export class Ally {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.r = 15;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.renderAngle = 0;
    this.aimAngle = 0;
    this.frame = config.frame != null ? config.frame : 2;
    this.style = this.frame;
    this.colors = config.colors || ALLY_PALETTES[0];
    this.name = config.name || 'WAR MACHINE';
    this.speed = 330;
    this.maxHp = 190;
    this.hp = 190;
    this.downed = false;
    this.respawn = 0;
    this.fireCd = rand(0.3, 0.9);
    this.missileCd = rand(2.5, 4.5);
    this.burst = 0;
    this.burstCd = 0;
    this.hitCd = 0;
    this.orbit = rand(0, TAU);
    this.trailTimer = 0;
    this.salvo = 0;
  }

  prev() {
    this.px = this.x;
    this.py = this.y;
  }

  revive(game) {
    const a = rand(0, TAU);
    this.x = game.player.x + Math.cos(a) * 46;
    this.y = game.player.y + Math.sin(a) * 46;
    this.px = this.x;
    this.py = this.y;
    this.hp = this.maxHp;
    this.downed = false;
    this.respawn = 0;
    this.vx = 0;
    this.vy = 0;
    game.particles.ring(this.x, this.y, this.colors.stroke, 14, 360, 0.5, 3);
    game.particles.text(this.x, this.y - 32, 'WAR MACHINE ONLINE', this.colors.stroke, 13, 1.2);
    game.audio.pickup();
  }

  update(dt, game) {
    this.hitCd = Math.max(0, this.hitCd - dt);

    if (this.downed) {
      this.respawn -= dt;
      if (this.respawn <= 0) this.revive(game);
      return;
    }

    const player = game.player;
    const target = game.findNearestEnemy(this.x, this.y, 780);

    this.orbit += dt * 0.5;
    const followX = player.x + Math.cos(this.orbit) * 112;
    const followY = player.y + Math.sin(this.orbit) * 112;
    let dx = followX - this.x;
    let dy = followY - this.y;
    const distToSlot = Math.hypot(dx, dy);
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    if (target && distToPlayer < 560) {
      const tx = target.x - this.x;
      const ty = target.y - this.y;
      const td = Math.hypot(tx, ty) || 1;
      if (td < 250) {
        dx -= (tx / td) * 46;
        dy -= (ty / td) * 46;
      }
    }

    const dl = Math.hypot(dx, dy) || 1;
    let desiredX = dl > 6 ? dx / dl : 0;
    let desiredY = dl > 6 ? dy / dl : 0;
    if (distToPlayer > 640) {
      const px = player.x - this.x;
      const py = player.y - this.y;
      const pd = Math.hypot(px, py) || 1;
      desiredX = px / pd;
      desiredY = py / pd;
    }

    const accel = 5.4;
    const speed = this.speed * (distToSlot > 140 ? 1.25 : 1);
    this.vx += (desiredX * speed - this.vx) * Math.min(1, dt * accel);
    this.vy += (desiredY * speed - this.vy) * Math.min(1, dt * accel);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, this.r + 8, game.world.w - this.r - 8);
    this.y = clamp(this.y, this.r + 8, game.world.h - this.r - 8);

    if (target) {
      this.aimAngle = Math.atan2(target.y - this.y, target.x - this.x);
      this.angle = this.aimAngle;
      this._weapons(dt, game, target);
    } else {
      if (Math.hypot(this.vx, this.vy) > 40) this.angle = Math.atan2(this.vy, this.vx);
      this.burst = 0;
      this.fireCd = Math.max(this.fireCd, 0.25);
    }

    this.trailTimer -= dt;
    if (Math.hypot(this.vx, this.vy) > 90 && this.trailTimer <= 0) {
      this.trailTimer = 0.055;
      game.particles.trail(this.x, this.y, -this.vx, -this.vy, this.colors.trail, 2, 0.22);
    }
  }

  _weapons(dt, game, target) {
    const stats = game.player.stats;

    this.fireCd -= dt;
    this.burstCd -= dt;
    this.missileCd -= dt;

    if (this.burst > 0) {
      if (this.burstCd <= 0) {
        this.burst--;
        this.burstCd = 0.055;
        this._fireMinigun(game, target);
      }
    } else if (this.fireCd <= 0) {
      this.burst = 9;
      this.burstCd = 0;
      this.fireCd = 1.25 - Math.min(0.45, stats.allyRate * 0.1);
    }

    if (this.missileCd <= 0) {
      this.missileCd = 5.4;
      this.salvo = 2;
      this._fireMissiles(game, target);
    }
  }

  _fireMinigun(game, target) {
    const stats = game.player.stats;
    const damage = 8.5 * stats.damage * (1 + stats.allyDamage);
    const spread = rand(-0.045, 0.045);
    const a = this.aimAngle + spread;
    const speed = 1220;
    const side = this.salvo % 2 === 0 ? 9 : -9;
    const ox = Math.cos(a + Math.PI * 0.5) * side;
    const oy = Math.sin(a + Math.PI * 0.5) * side;
    game.spawnPlayerBullet(
      this.x + Math.cos(a) * 20 + ox,
      this.y + Math.sin(a) * 20 + oy,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      3,
      damage,
      0.92,
      0,
      0,
      0,
      '#ffd27a',
      2.5,
      0.25
    );
    game.particles.directionalSparks(this.x + ox, this.y + oy, Math.cos(a), Math.sin(a), 1, '#ffd27a', 220, 1.4, 0.14);
    game.audio.minigun();
  }

  _fireMissiles(game, target) {
    const stats = game.player.stats;
    for (let i = 0; i < 2; i++) {
      const a = this.aimAngle + (i === 0 ? -0.16 : 0.16) + rand(-0.05, 0.05);
      const damage = 19 * stats.damage * stats.missileDamage;
      const speed = 660;
      game.spawnPlayerBullet(
        this.x + Math.cos(a) * 16,
        this.y + Math.sin(a) * 16,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        4.4,
        damage,
        2,
        0,
        0,
        0,
        '#ffb347',
        3.6,
        3,
        'missile',
        48,
        false
      );
      game.particles.directionalSparks(this.x, this.y, Math.cos(a), Math.sin(a), 4, '#ffb347', 300, 1.8, 0.22);
    }
    game.audio.microMissiles();
    game.particles.text(this.x, this.y - 30, 'SHOULDER POD', '#ffd27a', 11, 0.8);
  }

  takeDamage(amount, game) {
    if (this.downed || this.hitCd > 0) return false;
    this.hitCd = 0.45;
    this.hp -= amount;
    game.particles.sparkBurst(this.x, this.y, 8, this.colors.stroke, 240, 2.2, 0.35);
    if (this.hp <= 0) {
      this.hp = 0;
      this.downed = true;
      this.respawn = 8;
      game.particles.ring(this.x, this.y, this.colors.stroke, 18, 620, 0.7, 4);
      game.particles.sparkBurst(this.x, this.y, 34, this.colors.stroke, 420, 3, 0.9);
      game.particles.addShake(7);
      game.particles.text(this.x, this.y - 36, 'WAR MACHINE DOWN', '#ff8dc0', 14, 1.4);
      game.audio.explosion(true);
    }
    return true;
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const rot = this.renderAngle != null ? this.renderAngle : this.angle;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 70) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = this.colors.trail;
      ctx.beginPath();
      ctx.moveTo(-9, -5);
      ctx.lineTo(-18 - speed * 0.02, 0);
      ctx.lineTo(-9, 5);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    drawArmorBody(ctx, this.frame, this.colors, {
      variant: 'war',
      boost: Math.min(1, speed / 420),
      heat: this.burst > 0 ? 0.62 : 0.2
    });
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = this.colors.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
