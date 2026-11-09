import { TAU, clamp, rand } from '../engine/MathUtils.js';
import { drawShipBody, ALLY_PALETTES } from '../systems/Customization.js';

export class Ally {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.r = 13;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.renderAngle = 0;
    this.aimAngle = 0;
    this.style = config.style != null ? config.style : 1;
    this.colors = config.colors || ALLY_PALETTES[0];
    this.name = config.name || 'WINGMAN';
    this.speed = 310;
    this.maxHp = 160;
    this.hp = 160;
    this.downed = false;
    this.respawn = 0;
    this.fireCd = rand(0.2, 0.8);
    this.hitCd = 0;
    this.orbit = rand(0, TAU);
    this.trailTimer = 0;
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
    game.particles.text(this.x, this.y - 32, 'WINGMAN ONLINE', this.colors.stroke, 13, 1.2);
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
    const target = game.findNearestEnemy(this.x, this.y, 680);

    this.orbit += dt * 0.55;
    const followX = player.x + Math.cos(this.orbit) * 118;
    const followY = player.y + Math.sin(this.orbit) * 118;
    let dx = followX - this.x;
    let dy = followY - this.y;
    const distToSlot = Math.hypot(dx, dy);
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    if (target && distToPlayer < 520) {
      const tx = target.x - this.x;
      const ty = target.y - this.y;
      const td = Math.hypot(tx, ty) || 1;
      if (td < 240) {
        dx -= (tx / td) * 40;
        dy -= (ty / td) * 40;
      }
    }

    const dl = Math.hypot(dx, dy) || 1;
    let desiredX = dl > 6 ? dx / dl : 0;
    let desiredY = dl > 6 ? dy / dl : 0;
    if (distToPlayer > 620) {
      const px = player.x - this.x;
      const py = player.y - this.y;
      const pd = Math.hypot(px, py) || 1;
      desiredX = px / pd;
      desiredY = py / pd;
    }

    const accel = 5.2;
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
    } else if (Math.hypot(this.vx, this.vy) > 40) {
      this.angle = Math.atan2(this.vy, this.vx);
    }

    this.fireCd -= dt;
    if (target && this.fireCd <= 0) {
      this._fire(game, target);
      const rate = 2.6 + game.player.stats.allyRate;
      this.fireCd = 1 / rate;
    }

    this.trailTimer -= dt;
    if (Math.hypot(this.vx, this.vy) > 90 && this.trailTimer <= 0) {
      this.trailTimer = 0.06;
      game.particles.trail(this.x, this.y, -this.vx, -this.vy, this.colors.trail, 1.8, 0.22);
    }
  }

  _fire(game, target) {
    const stats = game.player.stats;
    const damage = (7 + stats.damage * 0.42) * (1 + stats.allyDamage);
    const spread = rand(-0.05, 0.05);
    const a = this.aimAngle + spread;
    const speed = 980;
    game.spawnPlayerBullet(
      this.x + Math.cos(a) * 18,
      this.y + Math.sin(a) * 18,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      3.2,
      damage,
      0.95,
      0,
      0,
      0,
      this.colors.stroke,
      2.6,
      0.4
    );
    game.particles.directionalSparks(this.x, this.y, Math.cos(a), Math.sin(a), 1, this.colors.stroke, 180, 1.4, 0.16);
    game.audio.impact(false);
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
      game.particles.text(this.x, this.y - 36, 'WINGMAN DOWN', '#ff8dc0', 14, 1.4);
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
    if (speed > 60) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22;
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

    drawShipBody(ctx, this.style, this.colors, {});
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = this.colors.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
