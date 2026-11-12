import { TAU, clamp } from '../engine/MathUtils.js';
import { drawArmorBody, SHIP_PALETTES } from '../systems/Customization.js';
import { WEAPONS, MISSILE_BARRAGE, fireWeapon, fireBarrage } from '../systems/Weapons.js';

const GHOST_COUNT = 14;

function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch (err) {
    /* haptics unavailable */
  }
}

function makeGhost() {
  return { active: false, x: 0, y: 0, angle: 0, life: 0, maxLife: 0.2 };
}

/**
 * Iron Man. A thin weapons platform: the armor mark and the equipped weapon
 * define the build, and every stat here is a multiplier or a utility value.
 * There is deliberately no XP, no level, no ability slots and no drafting.
 */
export class Player {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.r = 16;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.renderAngle = 0;
    this.frame = config.frame || 0;
    this.colors = config.colors || SHIP_PALETTES[0];
    this.callsign = config.callsign || 'TONY';

    this.stats = {
      maxHp: 140,
      armor: 0.08,
      // Offensive multipliers. Weapon cards own the base numbers.
      damage: 1,
      fireRate: 1,
      projectileSpeed: 1,
      projectileLife: 1,
      heatMult: 1,
      crit: 0.1,
      critMult: 2.1,
      splashBonus: 0,
      chainBonus: 0,
      // Mobility.
      moveSpeed: 350,
      accel: 2500,
      damping: 6.2,
      dashSpeed: 1120,
      dashDuration: 0.16,
      dashCooldown: 1.15,
      dashIFrames: 0.32,
      maxDashCharges: 1,
      // Heat + pickups.
      coolRate: 0.52,
      pickupRadius: 110,
      // War Machine support.
      allyDamage: 0,
      allyRate: 0,
      // Missile pod.
      missileCount: 4,
      missileDamage: 1,
      // Emergency Protocol meta unlock.
      reviveCharges: 0
    };

    this.buffs = { overcharge: 0 };
    this.hp = this.stats.maxHp;
    this.heat = 0;
    this.overheated = false;
    this.fireCooldown = 0;
    this.missileCooldown = 0;
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
    this.weaponIndex = 0;
    this.aimX = x + 100;
    this.aimY = y;
    this.autoTarget = null;
    this.ghosts = new Array(GHOST_COUNT);
    for (let i = 0; i < GHOST_COUNT; i++) this.ghosts[i] = makeGhost();
  }

  get maxHp() {
    return this.stats.maxHp;
  }

  get weapon() {
    return WEAPONS[this.weaponIndex] || WEAPONS[0];
  }

  prev() {
    this.px = this.x;
    this.py = this.y;
  }

  setWeapon(index) {
    const next = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    if (next === this.weaponIndex) return false;
    this.weaponIndex = next;
    this.fireCooldown = Math.max(this.fireCooldown, 0.06);
    return true;
  }

  cycleWeapon(delta = 1) {
    return this.setWeapon(this.weaponIndex + delta);
  }

  update(dt, game) {
    const input = game.input;
    const stats = this.stats;

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.buffs.overcharge = Math.max(0, this.buffs.overcharge - dt);

    const change = input.consumeWeapon ? input.consumeWeapon() : null;
    if (change === 'cycle') {
      if (this.cycleWeapon(1)) game.audio.ui();
    } else if (Number.isInteger(change)) {
      if (this.setWeapon(change)) game.audio.ui();
    }

    if (this.dashCharges < stats.maxDashCharges) {
      this.dashRecharge -= dt;
      if (this.dashRecharge <= 0) {
        this.dashCharges++;
        this.dashRecharge = stats.dashCooldown;
      }
    }

    if (input.consumeDash && input.consumeDash()) this.tryDash(game);

    const mv = input.getMove();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    let dirX = 0;
    let dirY = 0;
    if (mag > 0.001) {
      dirX = mv.x / mag;
      dirY = mv.y / mag;
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.x += this.dashDirX * stats.dashSpeed * dt;
      this.y += this.dashDirY * stats.dashSpeed * dt;
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this._spawnGhost();
        this.ghostTimer = 0.022;
      }
      if (this.dashTimer <= 0) {
        this.vx = this.dashDirX * stats.dashSpeed * 0.2;
        this.vy = this.dashDirY * stats.dashSpeed * 0.2;
      }
    } else {
      if (mag > 0) {
        this.vx += dirX * stats.accel * mag * dt;
        this.vy += dirY * stats.accel * mag * dt;
      }
      const damp = Math.exp(-stats.damping * dt);
      this.vx *= damp;
      this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      const maxSpeed = stats.moveSpeed;
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

    this._aim(dt, game, input, dirX, dirY, mag);

    const assist = (input.usingTouch || input.usingPad) && game.settings.autoFire !== false;
    const wantsFire = input.isFiring ? input.isFiring() : input.mouse.down;
    const firing = wantsFire || (assist && (this.autoTarget || input.usingTouch));

    if (firing && !this.overheated && this.fireCooldown <= 0) {
      this.fire(game);
    }

    if (input.consumeMissile && input.consumeMissile() && this.missileCooldown <= 0) {
      this.launchBarrage(game);
    }

    if (this.overheated) {
      this.heat -= stats.coolRate * 1.2 * dt;
      if (this.heat <= 0.26) {
        this.heat = 0.26;
        this.overheated = false;
      }
    } else if (firing) {
      this.heat -= stats.coolRate * 0.16 * dt;
    } else {
      this.heat -= stats.coolRate * dt;
    }
    this.heat = clamp(this.heat, 0, 1);

    for (let i = 0; i < GHOST_COUNT; i++) {
      const g = this.ghosts[i];
      if (g.active) {
        g.life -= dt;
        if (g.life <= 0) g.active = false;
      }
    }

    this.trailTimer -= dt;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 90 && this.trailTimer <= 0) {
      this.trailTimer = 0.032;
      const backX = this.x - Math.cos(this.angle) * 13;
      const backY = this.y - Math.sin(this.angle) * 13;
      game.particles.trail(backX, backY, -this.vx, -this.vy, this.colors.trail, 2.4, 0.22);
    }
  }

  _aim(dt, game, input, dirX, dirY, mag) {
    const aim = input.getAimDir ? input.getAimDir() : null;
    const assisted = input.usingTouch || input.usingPad;
    const auto = game.settings.autoFire !== false;
    this.autoTarget = assisted ? game.findNearestEnemy(this.x, this.y, 820) : null;

    if (aim) {
      this.aimX = this.x + aim.x * 420;
      this.aimY = this.y + aim.y * 420;
      this.angle = Math.atan2(aim.y, aim.x);
      return;
    }
    if (assisted && auto && this.autoTarget) {
      this.aimX = this.autoTarget.x;
      this.aimY = this.autoTarget.y;
      const desired = Math.atan2(this.autoTarget.y - this.y, this.autoTarget.x - this.x);
      let diff = desired - this.angle;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      this.angle += diff * Math.min(1, dt * 18);
      return;
    }
    if (assisted) {
      if (mag > 0.1) this.angle = Math.atan2(dirY, dirX);
      return;
    }
    this.aimX = game.mouseWorld.x;
    this.aimY = game.mouseWorld.y;
    this.angle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
  }

  fire(game) {
    if (this.hp <= 0) return null;
    const weapon = fireWeapon(this, game, this.angle);
    if (weapon.recoil) {
      this.vx -= Math.cos(this.angle) * weapon.recoil;
      this.vy -= Math.sin(this.angle) * weapon.recoil;
    }
    return weapon;
  }

  launchBarrage(game) {
    if (this.hp <= 0 || this.missileCooldown > 0) return false;
    fireBarrage(this, game, this.angle);
    this.missileCooldown = MISSILE_BARRAGE.cooldown;
    buzz(16);
    return true;
  }

  tryDash(game) {
    const stats = this.stats;
    if (this.dashCharges <= 0 || this.dashTimer > 0 || this.hp <= 0) return false;

    const input = game.input;
    const mv = input.getMove();
    let dx = mv.x;
    let dy = mv.y;
    const m = Math.hypot(dx, dy);
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

    game.particles.ring(this.x, this.y, this.colors.glow, 10, 340, 0.3, 2);
    game.particles.sparkBurst(this.x, this.y, 12, '#8fe8ff', 280, 2.2, 0.35);
    game.audio.dash();
    buzz(12);
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

  heal(amount, game) {
    if (this.hp <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    const gained = Math.round(this.hp - before);
    if (gained > 0 && game) {
      game.healingDone += gained;
      if (game.settings?.damageNumbers !== false) {
        game.particles.text(this.x, this.y - 30, '+' + gained, '#59ffa8', 14, 0.9);
      }
      game.particles.ring(this.x, this.y, '#59ffa8', 8, 120, 0.35, 2);
      game.audio.pickup();
    }
  }

  takeDamage(amount, game) {
    if (this.invuln > 0 || this.dashTimer > 0 || this.hp <= 0) return false;
    const actual = Math.max(1, amount * (1 - this.stats.armor));
    this.hp -= actual;
    this.invuln = 0.8;
    this.hitFlash = 0.28;
    game.damageTaken += actual;
    game.onPlayerHit(actual);
    game.particles.hit(1);
    if (game.settings?.damageNumbers !== false) {
      game.particles.text(this.x, this.y - 30, '-' + Math.round(actual), '#ff5b8f', 15, 0.85);
    }
    game.particles.sparkBurst(this.x, this.y, 16, '#ff7a4d', 360, 2.6, 0.5);
    game.audio.hit();
    buzz(22);
    if (this.hp <= 0) {
      if (this.stats.reviveCharges > 0) {
        this.stats.reviveCharges--;
        this.hp = Math.max(1, this.stats.maxHp * 0.35);
        this.invuln = 2.4;
        this.hitFlash = 0;
        game.revivesUsed++;
        game.particles.ring(this.x, this.y, '#ffc857', 30, 900, 0.8, 6);
        game.particles.ring(this.x, this.y, '#ffffff', 16, 520, 0.6, 3);
        game.particles.sparkBurst(this.x, this.y, 45, '#ffe066', 600, 3.4, 1.1);
        game.particles.text(this.x, this.y - 56, 'EMERGENCY PROTOCOL', '#ffc857', 19, 2);
        game.particles.addShake(16);
        game.audio.bossDeath();
        buzz([30, 40, 80]);
      } else {
        this.hp = 0;
        game.onPlayerDeath();
      }
    }
    return true;
  }

  drawGhosts(ctx, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < GHOST_COUNT; i++) {
      const g = this.ghosts[i];
      if (!g.active) continue;
      const a = (g.life / g.maxLife) * 0.3;
      const x = g.x;
      const y = g.y;
      ctx.globalAlpha = a;
      ctx.strokeStyle = this.colors.trail;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(g.angle) * 17, y + Math.sin(g.angle) * 17);
      ctx.lineTo(x + Math.cos(g.angle + 2.4) * 13, y + Math.sin(g.angle + 2.4) * 13);
      ctx.lineTo(x + Math.cos(g.angle + Math.PI) * 7, y + Math.sin(g.angle + Math.PI) * 7);
      ctx.lineTo(x + Math.cos(g.angle - 2.4) * 13, y + Math.sin(g.angle - 2.4) * 13);
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

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = invulnAlpha;

    if (speed > 50) {
      const flick = 0.6 + Math.random() * 0.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = this.colors.trail;
      ctx.globalAlpha = invulnAlpha * 0.22 * flick;
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(-22 - speed * 0.025 * flick, 0);
      ctx.lineTo(-9, 6);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = invulnAlpha;
    }

    drawArmorBody(ctx, this.frame, this.colors, {
      variant: 'iron',
      pilot: true,
      flash: this.hitFlash > 0,
      boost: Math.min(1, speed / 460),
      heat: this.heat
    });
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';

    if (this.buffs.overcharge > 0) {
      const pulse = 1 + Math.sin(this.buffs.overcharge * 18) * 0.08;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 31 * pulse, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (this.heat > 0.55) {
      const h = (this.heat - 0.55) / 0.45;
      ctx.strokeStyle = this.overheated ? 'rgba(255, 59, 48, 0.9)' : 'rgba(255, 200, 87, 0.72)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + h * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24 + h * 6, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.invuln > 0.1) {
      ctx.strokeStyle = 'rgba(143, 232, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
