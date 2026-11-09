import { TAU, clamp, rand } from '../engine/MathUtils.js';
import { drawShipBody, SHIP_PALETTES } from '../systems/Customization.js';
import { ABILITIES } from '../systems/Abilities.js';

const GHOST_COUNT = 18;

function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch (err) {
    /* haptics unavailable */
  }
}

function makeGhost() {
  return { active: false, x: 0, y: 0, angle: 0, life: 0, maxLife: 0.24 };
}

export class Player {
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
    this.style = config.style || 0;
    this.colors = config.colors || SHIP_PALETTES[0];
    this.callsign = config.callsign || 'NOVA';

    this.stats = {
      maxHp: 130,
      armor: 0.08,
      damage: 15,
      fireRate: 6.4,
      bulletSpeed: 1050,
      bulletLife: 1.15,
      bulletRadius: 4.4,
      spread: 0.03,
      multishot: 1,
      pierce: 0,
      ricochet: 0,
      chain: 0,
      chainDamage: 0,
      crit: 0.1,
      critMult: 2.1,
      lifesteal: 0,
      moveSpeed: 365,
      accel: 2600,
      damping: 6.2,
      dashSpeed: 1250,
      dashDuration: 0.16,
      dashCooldown: 1.2,
      dashIFrames: 0.3,
      maxDashCharges: 1,
      heatPerShot: 0.034,
      coolRate: 0.55,
      regen: 0,
      xpGain: 1,
      pickupRadius: 105,
      orbitalBlades: 0,
      bladeDamage: 22,
      singularityDash: 0,
      homing: 0,
      thorns: 0,
      nova: 0,
      novaDamage: 0,
      berserk: 0,
      frost: 0,
      abilityPower: 1,
      cooldownMult: 1,
      novaBonus: 0,
      shieldBonus: 0,
      allyDamage: 0,
      allyRate: 0
    };

    this.abilities = {};
    for (let i = 0; i < ABILITIES.length; i++) this.abilities[ABILITIES[i].id] = { cd: 0 };
    this.buffs = { shield: 0, overdrive: 0, timewarp: 0 };

    this.hp = this.stats.maxHp;
    this.heat = 0;
    this.overheated = false;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.dashTimer = 0;
    this.dashDirX = 1;
    this.dashDirY = 0;
    this.dashCharges = this.stats.maxDashCharges;
    this.dashRecharge = this.stats.dashCooldown;
    this.ghostTimer = 0;
    this.ghostCursor = 0;
    this.trailTimer = 0;
    this.novaTimer = 1.5;
    this.ghosts = new Array(GHOST_COUNT);
    for (let i = 0; i < GHOST_COUNT; i++) this.ghosts[i] = makeGhost();
    this.upgradeCounts = Object.create(null);
    this.aimX = x + 100;
    this.aimY = y;
  }

  get maxHp() {
    return this.stats.maxHp;
  }

  prev() {
    this.px = this.x;
    this.py = this.y;
  }

  update(dt, game) {
    const input = game.input;
    const stats = this.stats;

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    for (let i = 0; i < ABILITIES.length; i++) {
      const a = this.abilities[ABILITIES[i].id];
      if (a && a.cd > 0) a.cd = Math.max(0, a.cd - dt);
    }
    this.buffs.shield = Math.max(0, this.buffs.shield - dt);
    this.buffs.overdrive = Math.max(0, this.buffs.overdrive - dt);
    this.buffs.timewarp = Math.max(0, this.buffs.timewarp - dt);

    if (input.consumeAbilities) {
      const queued = input.consumeAbilities();
      for (let i = 0; i < queued.length; i++) this.useAbility(queued[i], game);
    }

    if (this.dashCharges < stats.maxDashCharges) {
      this.dashRecharge -= dt;
      if (this.dashRecharge <= 0) {
        this.dashCharges++;
        this.dashRecharge = stats.dashCooldown;
      }
    }

    if (input.consumeDash()) {
      this.tryDash(game);
    }

    const mv = input.getMove();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    let dirX = 0;
    let dirY = 0;
    if (mag > 0.001) {
      dirX = mv.x / mag;
      dirY = mv.y / mag;
    }

    const driveMul = this.buffs.overdrive > 0 ? 1.14 : 1;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.x += this.dashDirX * stats.dashSpeed * dt;
      this.y += this.dashDirY * stats.dashSpeed * dt;
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this._spawnGhost();
        this.ghostTimer = 0.024;
      }
      if (this.dashTimer <= 0) {
        this.vx = this.dashDirX * stats.dashSpeed * 0.22;
        this.vy = this.dashDirY * stats.dashSpeed * 0.22;
      }
    } else {
      if (mag > 0) {
        this.vx += dirX * stats.accel * driveMul * mag * dt;
        this.vy += dirY * stats.accel * driveMul * mag * dt;
      }
      const damp = Math.exp(-stats.damping * dt);
      this.vx *= damp;
      this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      const maxSpeed = stats.moveSpeed * driveMul;
      if (sp > maxSpeed) {
        const k = maxSpeed / sp;
        this.vx *= k;
        this.vy *= k;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    this.x = clamp(this.x, this.r + 8, game.world.w - this.r - 8);
    this.y = clamp(this.y, this.r + 8, game.world.h - this.r - 8);

    const aim = input.getAimDir ? input.getAimDir() : null;
    if (aim) {
      this.aimX = this.x + aim.x * 400;
      this.aimY = this.y + aim.y * 400;
      this.angle = Math.atan2(aim.y, aim.x);
    } else if (!input.usingTouch && !input.usingPad) {
      this.aimX = game.mouseWorld.x;
      this.aimY = game.mouseWorld.y;
      this.angle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
    }

    const firing = input.isFiring ? input.isFiring() : input.mouse.down;
    if (firing && !this.overheated && this.fireCooldown <= 0) {
      this.fire(game);
    }

    if (this.overheated) {
      this.heat -= stats.coolRate * 1.15 * dt;
      if (this.heat <= 0.28) {
        this.heat = 0.28;
        this.overheated = false;
      }
    } else if (firing) {
      this.heat -= stats.coolRate * 0.12 * dt;
    } else {
      this.heat -= stats.coolRate * dt;
    }
    this.heat = clamp(this.heat, 0, 1);

    if (stats.regen > 0 && this.hp > 0 && this.hp < stats.maxHp) {
      this.hp = Math.min(stats.maxHp, this.hp + stats.regen * dt);
    }

    if (stats.nova > 0) {
      this.novaTimer -= dt;
      if (this.novaTimer <= 0) {
        this.novaTimer = Math.max(1.4, 3.4 - stats.nova * 0.35);
        this._novaPulse(game);
      }
    }

    for (let i = 0; i < GHOST_COUNT; i++) {
      const g = this.ghosts[i];
      if (g.active) {
        g.life -= dt;
        if (g.life <= 0) g.active = false;
      }
    }

    this.trailTimer -= dt;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 80 && this.trailTimer <= 0) {
      this.trailTimer = 0.035;
      const backX = this.x - Math.cos(this.angle) * 12;
      const backY = this.y - Math.sin(this.angle) * 12;
      game.particles.trail(backX, backY, -this.vx, -this.vy, this.colors.trail, 2.2, 0.25);
    }
  }

  tryDash(game) {
    const stats = this.stats;
    if (this.dashCharges <= 0 || this.dashTimer > 0) return false;

    const input = game.input;
    const mv = input.getMove();
    let dx = mv.x;
    let dy = mv.y;
    let m = Math.hypot(dx, dy);
    if (m < 0.2) {
      const aim = input.getAimDir ? input.getAimDir() : null;
      if (aim) {
        dx = aim.x;
        dy = aim.y;
      } else {
        dx = Math.cos(this.angle);
        dy = Math.sin(this.angle);
      }
    } else {
      dx /= m;
      dy /= m;
    }

    this.dashDirX = dx;
    this.dashDirY = dy;
    this.dashTimer = stats.dashDuration;
    this.invuln = Math.max(this.invuln, stats.dashIFrames);
    this.dashCharges--;
    if (this.dashRecharge <= 0) this.dashRecharge = stats.dashCooldown;
    this.ghostTimer = 0;
    this._spawnGhost();

    game.particles.ring(this.x, this.y, this.colors.trail, 10, 330, 0.3, 2);
    game.particles.sparkBurst(this.x, this.y, 10, '#8be9ff', 260, 2.2, 0.35);
    game.audio.dash();
    buzz(12);

    if (stats.singularityDash > 0) {
      game.spawnSingularity(this.x, this.y, stats.singularityDash);
    }
    return true;
  }

  _spawnGhost() {
    const g = this.ghosts[this.ghostCursor];
    this.ghostCursor = (this.ghostCursor + 1) % GHOST_COUNT;
    g.active = true;
    g.x = this.x;
    g.y = this.y;
    g.angle = this.angle;
    g.life = g.maxLife;
  }

  _novaPulse(game) {
    const stats = this.stats;
    const radius = 128 + stats.nova * 22;
    const damage = 14 + stats.novaDamage + stats.nova * 6;
    const list = game.enemies.enemies;
    game.particles.ring(this.x, this.y, '#8b5cff', 14, radius * 3.2, 0.5, 3);
    game.particles.sparkBurst(this.x, this.y, 14, '#c8b6ff', 280, 2.4, 0.45);
    game.audio.zap();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const rr = radius + e.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      const died = e.hit(damage, game, dx * 0.08, dy * 0.08);
      if (stats.frost > 0) e.slowTimer = Math.max(e.slowTimer, 1.4);
      game.particles.sparkBurst(e.x, e.y, 4, '#c8b6ff', 200, 2, 0.3);
      if (died) game.onEnemyKilled(e);
    }
  }

  _thornsNova(game) {
    const stats = this.stats;
    const radius = 118 + stats.thorns * 16;
    const damage = 10 + stats.thorns * 10;
    const list = game.enemies.enemies;
    game.particles.ring(this.x, this.y, '#ffc857', 12, radius * 3.2, 0.42, 3);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const rr = radius + e.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      const died = e.hit(damage, game, dx * 0.1, dy * 0.1);
      game.particles.sparkBurst(e.x, e.y, 3, '#ffc857', 180, 2, 0.28);
      if (died) game.onEnemyKilled(e);
    }
  }

  useAbility(id, game) {
    const cfg = ABILITIES.find((a) => a.id === id);
    const slot = this.abilities[id];
    if (!cfg || !slot || slot.cd > 0 || this.hp <= 0) return false;
    slot.cd = cfg.cooldown * this.stats.cooldownMult;
    const power = this.stats.abilityPower;
    game.audio.select();

    if (id === 'nova') {
      const radius = (205 + this.stats.novaBonus) * power;
      const damage = (58 + this.stats.damage * 1.5 + this.stats.novaBonus * 2) * power;
      const list = game.enemies.enemies;
      game.particles.ring(this.x, this.y, '#b06bff', 26, radius * 5.2, 0.55, 4);
      game.particles.ring(this.x, this.y, '#ffffff', 12, radius * 3.2, 0.4, 2);
      game.particles.sparkBurst(this.x, this.y, 30, '#c8b6ff', 520, 3, 0.7);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead) continue;
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const rr = radius + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const died = e.hit(damage, game, dx * 0.85, dy * 0.85);
        game.particles.sparkBurst(e.x, e.y, 5, '#c8b6ff', 260, 2.4, 0.4);
        if (died) game.onEnemyKilled(e);
      }
      game.particles.text(this.x, this.y - 48, 'NOVA BURST', '#c8b6ff', 18, 1.2);
      game.particles.addShake(9);
      game.audio.explosion(true);
    } else if (id === 'shield') {
      this.buffs.shield = 3.5 + this.stats.shieldBonus;
      this.invuln = Math.max(this.invuln, this.buffs.shield);
      game.particles.ring(this.x, this.y, '#59ffa8', 24, 620, 0.6, 4);
      game.particles.sparkBurst(this.x, this.y, 18, '#8bffc4', 300, 2.4, 0.5);
      game.particles.text(this.x, this.y - 48, 'AEGIS FIELD', '#59ffa8', 16, 1.2);
      game.audio.pickup();
    } else if (id === 'overdrive') {
      this.buffs.overdrive = 6 + this.stats.shieldBonus * 0.6;
      game.particles.ring(this.x, this.y, '#ffc857', 22, 560, 0.55, 4);
      game.particles.sparkBurst(this.x, this.y, 18, '#ffe066', 320, 2.6, 0.5);
      game.particles.text(this.x, this.y - 48, 'OVERDRIVE', '#ffc857', 17, 1.2);
      game.audio.levelUp();
    } else if (id === 'timewarp') {
      this.buffs.timewarp = 4.5;
      game.particles.ring(this.x, this.y, '#46f4ff', 30, 900, 0.7, 3);
      game.particles.ring(this.x, this.y, '#ffffff', 16, 520, 0.5, 2);
      game.particles.text(this.x, this.y - 48, 'TIME WARP', '#8be9ff', 17, 1.2);
      game.particles.addShake(5);
      game.audio.zap();
    }
    return true;
  }

  fire(game) {
    const stats = this.stats;
    const shots = Math.max(1, Math.floor(stats.multishot));
    const totalSpread = stats.spread * (shots - 1);
    const base = this.angle - totalSpread * 0.5;
    const rage = 1 + stats.berserk * clamp(1 - this.hp / stats.maxHp, 0, 1);
    const driveMul = this.buffs.overdrive > 0 ? 1.3 : 1;

    for (let i = 0; i < shots; i++) {
      const a = base + stats.spread * i + rand(-0.008, 0.008);
      const crit = Math.random() < stats.crit;
      const dmg = stats.damage * rage * driveMul * (crit ? stats.critMult : 1);
      const sx = this.x + Math.cos(a) * 21;
      const sy = this.y + Math.sin(a) * 21;
      game.spawnPlayerBullet(
        sx,
        sy,
        Math.cos(a) * stats.bulletSpeed,
        Math.sin(a) * stats.bulletSpeed,
        stats.bulletRadius,
        dmg,
        stats.bulletLife,
        stats.pierce,
        stats.ricochet,
        stats.chain,
        crit ? '#ffe066' : '#6ff9ff',
        crit ? 4.4 : 3.1,
        stats.homing
      );
      game.particles.directionalSparks(sx, sy, Math.cos(a), Math.sin(a), 2, '#8be9ff', 220, 1.6, 0.2);
    }

    this.fireCooldown = 1 / (stats.fireRate * (this.buffs.overdrive > 0 ? 1.5 : 1));
    this.heat += stats.heatPerShot * (this.buffs.overdrive > 0 ? 0.9 : 1);
    this.vx -= Math.cos(this.angle) * 26;
    this.vy -= Math.sin(this.angle) * 26;
    game.audio.laser();

    if (this.heat >= 1) {
      this.heat = 1;
      if (!this.overheated) {
        this.overheated = true;
        game.audio.overheat();
        game.particles.text(this.x, this.y - 34, 'OVERHEAT', '#ff2f8e', 14, 1.1);
        game.particles.sparkBurst(this.x, this.y, 14, '#ffc857', 220, 2.4, 0.45);
      }
    }
  }

  heal(amount, game) {
    if (this.hp <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    const gained = Math.round(this.hp - before);
    if (gained > 0 && game) {
      game.particles.text(this.x, this.y - 30, '+' + gained, '#59ffa8', 14, 0.9);
      game.particles.ring(this.x, this.y, '#59ffa8', 8, 120, 0.35, 2);
      game.audio.pickup();
    }
  }

  takeDamage(amount, game) {
    if (this.invuln > 0 || this.dashTimer > 0 || this.hp <= 0) return false;
    if (this.buffs.shield > 0) {
      game.particles.sparkBurst(this.x, this.y, 8, '#59ffa8', 260, 2.2, 0.35);
      game.audio.deflect();
      return false;
    }
    const actual = Math.max(1, amount * (1 - this.stats.armor));
    this.hp -= actual;
    this.invuln = 0.8;
    this.hitFlash = 0.28;
    game.particles.hit(1);
    game.particles.text(this.x, this.y - 30, '-' + Math.round(actual), '#ff5b8f', 15, 0.85);
    game.particles.sparkBurst(this.x, this.y, 16, '#ff2f8e', 360, 2.6, 0.5);
    game.audio.hit();
    buzz(22);
    if (this.stats.thorns > 0) this._thornsNova(game);
    if (this.hp <= 0) {
      this.hp = 0;
      game.onPlayerDeath();
    }
    return true;
  }

  drawGhosts(ctx, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < GHOST_COUNT; i++) {
      const g = this.ghosts[i];
      if (!g.active) continue;
      const a = (g.life / g.maxLife) * 0.32;
      const x = g.x;
      const y = g.y;
      ctx.globalAlpha = a;
      ctx.strokeStyle = this.colors.trail;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(g.angle) * 17, y + Math.sin(g.angle) * 17);
      ctx.lineTo(x + Math.cos(g.angle + 2.45) * 13, y + Math.sin(g.angle + 2.45) * 13);
      ctx.lineTo(x + Math.cos(g.angle + Math.PI) * 7, y + Math.sin(g.angle + Math.PI) * 7);
      ctx.lineTo(x + Math.cos(g.angle - 2.45) * 13, y + Math.sin(g.angle - 2.45) * 13);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  draw(ctx, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const speed = Math.hypot(this.vx, this.vy);
    const invulnAlpha = this.invuln > 0 ? (Math.floor(this.invuln * 22) % 2 === 0 ? 0.45 : 1) : 1;
    const rot = this.renderAngle != null ? this.renderAngle : this.angle;
    const pal = this.colors;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = invulnAlpha;

    if (speed > 40) {
      const flick = 0.6 + Math.random() * 0.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = pal.trail;
      ctx.globalAlpha = invulnAlpha * 0.26 * flick;
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(-22 - speed * 0.03 * flick, 0);
      ctx.lineTo(-9, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = invulnAlpha * 0.2 * flick;
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.lineTo(-17 - speed * 0.02 * flick, 0);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = invulnAlpha;
    }

    drawShipBody(ctx, this.style, pal, { flash: this.hitFlash > 0, pilot: true });
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';

    if (this.buffs.shield > 0) {
      const pulse = 1 + Math.sin(this.buffs.shield * 10) * 0.05;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#59ffa8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * pulse, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#59ffa8';
      ctx.beginPath();
      ctx.arc(0, 0, 28 * pulse, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.buffs.overdrive > 0) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffc857';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24 + Math.sin(this.buffs.overdrive * 14) * 3, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.buffs.timewarp > 0) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#46f4ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (this.heat > 0.55) {
      const h = (this.heat - 0.55) / 0.45;
      ctx.strokeStyle = this.overheated ? 'rgba(255, 47, 142, 0.85)' : 'rgba(255, 200, 87, 0.7)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + h * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 23 + h * 5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.invuln > 0.1) {
      ctx.strokeStyle = 'rgba(70, 244, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
