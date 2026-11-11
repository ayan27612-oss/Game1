import { TAU, rand } from '../engine/MathUtils.js';

const MAX_PARTICLES = 2400;

const SPARK = 0;
const RING = 1;
const TEXT = 2;
const LIGHTNING = 3;

function makeParticle(index) {
  return {
    index,
    active: false,
    type: SPARK,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    x2: 0,
    y2: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 1,
    growth: 0,
    width: 1,
    gravity: 0,
    drag: 0,
    color: '#ffffff',
    text: '',
    spin: 0
  };
}

export class ParticleSystem {
  constructor() {
    this.pool = new Array(MAX_PARTICLES);
    this.free = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i] = makeParticle(i);
      this.free[i] = MAX_PARTICLES - 1 - i;
    }
    this.activeCount = 0;
    this.steal = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.aberration = 0;
    this.flash = 0;
    this.shakeScale = 1;
    this.fxScale = 1;
  }

  reset() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i].active = false;
      this.free[i] = MAX_PARTICLES - 1 - i;
    }
    this.activeCount = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.aberration = 0;
    this.flash = 0;
  }

  _acquire() {
    let p;
    if (this.free.length > 0) {
      p = this.pool[this.free.pop()];
      if (!p.active) {
        p.active = true;
        this.activeCount++;
      }
    } else {
      this.steal = (this.steal + 1) % MAX_PARTICLES;
      p = this.pool[this.steal];
      if (!p.active) {
        p.active = true;
        this.activeCount++;
      }
    }
    return p;
  }

  _release(p) {
    if (!p.active) return;
    p.active = false;
    this.activeCount--;
    this.free.push(p.index);
  }

  sparkBurst(x, y, count, color, speed = 300, size = 2.2, life = 0.5) {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      const a = rand(0, TAU);
      const sp = rand(speed * 0.2, speed);
      p.type = SPARK;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = rand(life * 0.5, life);
      p.maxLife = p.life;
      p.size = rand(size * 0.5, size);
      p.color = color;
      p.gravity = 0;
      p.drag = 3.2;
      p.growth = 0;
      p.width = 1;
      p.text = '';
    }
  }

  directionalSparks(x, y, dirX, dirY, count, color, speed = 320, size = 2, life = 0.4) {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      const a = Math.atan2(dirY, dirX) + rand(-0.75, 0.75);
      const sp = rand(speed * 0.25, speed);
      p.type = SPARK;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = rand(life * 0.5, life);
      p.maxLife = p.life;
      p.size = rand(size * 0.5, size);
      p.color = color;
      p.gravity = 0;
      p.drag = 4.5;
      p.growth = 0;
      p.width = 1;
      p.text = '';
    }
  }

  trail(x, y, vx, vy, color, size = 2.4, life = 0.28) {
    const p = this._acquire();
    p.type = SPARK;
    p.x = x;
    p.y = y;
    p.vx = vx * 0.12;
    p.vy = vy * 0.12;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.gravity = 0;
    p.drag = 2.5;
    p.growth = 0;
    p.width = 1;
    p.text = '';
  }

  ring(x, y, color, radius = 8, growth = 260, life = 0.42, width = 3) {
    const p = this._acquire();
    p.type = RING;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = life;
    p.maxLife = life;
    p.size = radius;
    p.growth = growth;
    p.width = width;
    p.color = color;
    p.gravity = 0;
    p.drag = 0;
    p.text = '';
  }

  text(x, y, str, color = '#dffbff', size = 13, life = 0.85) {
    const p = this._acquire();
    p.type = TEXT;
    p.x = x;
    p.y = y;
    p.vx = rand(-14, 14);
    p.vy = -62;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.gravity = 40;
    p.drag = 1.6;
    p.growth = 0;
    p.width = 1;
    p.text = str;
  }

  lightning(x1, y1, x2, y2, color = '#8be9ff', width = 2, life = 0.17) {
    const p = this._acquire();
    p.type = LIGHTNING;
    p.x = x1;
    p.y = y1;
    p.x2 = x2;
    p.y2 = y2;
    p.vx = 0;
    p.vy = 0;
    p.life = life;
    p.maxLife = life;
    p.size = 0;
    p.width = width;
    p.color = color;
    p.gravity = 0;
    p.drag = 0;
    p.growth = 0;
    p.text = '';
  }

  addShake(amount) {
    this.shake = Math.min(32, this.shake + amount * this.shakeScale);
  }

  hit(intensity = 1) {
    this.shake = Math.min(32, this.shake + 6 * intensity * this.shakeScale);
    this.aberration = Math.min(1.6, this.aberration + 1.0 * intensity * this.fxScale);
    this.flash = Math.min(0.5, this.flash + 0.18 * intensity * this.fxScale);
  }

  update(dt) {
    const pool = this.pool;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this._release(p);
        continue;
      }
      if (p.type === TEXT) {
        p.vy += p.gravity * dt;
        p.vx *= Math.exp(-p.drag * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === SPARK) {
        p.vx *= Math.exp(-p.drag * dt);
        p.vy *= Math.exp(-p.drag * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === RING) {
        p.size += p.growth * dt;
        p.growth *= Math.exp(-1.8 * dt);
      }
    }

    this.shake *= Math.exp(-7.5 * dt);
    if (this.shake < 0.05) this.shake = 0;
    this.aberration *= Math.exp(-8 * dt);
    if (this.aberration < 0.02) this.aberration = 0;
    this.flash *= Math.exp(-9 * dt);
    if (this.flash < 0.01) this.flash = 0;

    if (this.shake > 0.05) {
      this.shakeX = rand(-this.shake, this.shake);
      this.shakeY = rand(-this.shake, this.shake);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  draw(ctx, game) {
    const pool = this.pool;
    if (game && game.setGroundTransform) game.setGroundTransform(ctx, 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p.active || p.type === TEXT) continue;
      const a = p.life / p.maxLife;
      if (p.type === SPARK) {
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
        ctx.stroke();
      } else if (p.type === RING) {
        ctx.globalAlpha = a * 0.75;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * a + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
      } else if (p.type === LIGHTNING) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * 2.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, p.width * 0.7);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p.active || p.type !== TEXT) continue;
      if (game && game.setBillboardTransform) game.setBillboardTransform(ctx, p.x, p.y, 24);
      const a = Math.min(1, p.life / p.maxLife * 1.6);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = `700 ${p.size}px "SFMono-Regular", Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  get utilization() {
    return this.activeCount / MAX_PARTICLES;
  }
}
