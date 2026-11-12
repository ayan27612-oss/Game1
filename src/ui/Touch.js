import { TAU, clamp } from '../engine/MathUtils.js';
import { STICK_RADIUS, TOUCH_LAYOUT } from './Input.js';

function drawStick(ctx, stick, hint, color) {
  const active = stick.active;
  const cx = active ? stick.ox : hint.x;
  const cy = active ? stick.oy : hint.y;
  const kx = active ? stick.kx : hint.x;
  const ky = active ? stick.ky : hint.y;
  const baseR = STICK_RADIUS + 16;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = active ? 0.9 : 0.28;
  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2.6 : 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = active ? 0.12 : 0.04;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = active ? 0.95 : 0.34;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(kx, ky, 27, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#0a0c12';
  ctx.beginPath();
  ctx.arc(kx, ky, 16, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = active ? 0.9 : 0.45;
  ctx.fillStyle = color;
  ctx.font = '700 10px "SFMono-Regular", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(hint.label || 'MOVE', cx, cy - baseR - 12);
  ctx.restore();
}

function drawButton(ctx, b, opts) {
  const {
    color,
    label,
    sub,
    pressed = false,
    disabled = false,
    progress = 0,
    pulse = 0
  } = opts;
  const r = b.r * (pressed ? 0.97 : 1);
  const alpha = disabled ? 0.4 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';

  if (!disabled && pulse > 0) {
    ctx.globalAlpha = alpha * (0.12 + pulse * 0.1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (1.08 + pulse * 0.04), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = pressed ? 5 : 3;
  ctx.globalAlpha = alpha * (pressed ? 1 : 0.85);
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = alpha * (pressed ? 0.3 : disabled ? 0.05 : 0.13);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.fill();

  if (progress > 0.001) {
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = '#05070d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r - 4, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * clamp(progress, 0, 1));
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha * (disabled ? 0.55 : 1);
  ctx.fillStyle = disabled ? '#8a8f9c' : '#f4f8ff';
  ctx.font = `800 ${b.r > 64 ? 14 : 11}px "SFMono-Regular", Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x, b.y - (sub ? 7 : 0));
  if (sub) {
    ctx.fillStyle = disabled ? '#6e7480' : color;
    ctx.font = `700 ${b.r > 64 ? 11 : 9}px "SFMono-Regular", Consolas, monospace`;
    ctx.fillText(sub, b.x, b.y + (b.r > 64 ? 13 : 11));
  }
  ctx.restore();
}

export function drawTouchControls(ctx, canvas, input, game, state, dpr, view) {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!input.usingTouch || state !== 'playing' || !game) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;

  const player = game.player;
  const now = game.elapsed;
  drawStick(ctx, input.move, TOUCH_LAYOUT.stick, '#8fe8ff');

  if (input.aim.active) {
    drawStick(ctx, input.aim, { x: 900, y: 250, r: 72, label: 'AIM' }, '#ffb347');
  }

  const weapon = player.weapon;
  const firePulse = 0.55 + Math.sin(now * 6) * 0.45;
  drawButton(ctx, TOUCH_LAYOUT.fire, {
    color: '#ffd76a',
    label: 'FIRE',
    sub: weapon.short,
    pressed: input.pressed.fire || input.fireHeld,
    pulse: firePulse
  });

  const mcd = player.missileCooldown;
  const mtotal = 7;
  drawButton(ctx, TOUCH_LAYOUT.missile, {
    color: '#ff9b4a',
    label: 'MSL',
    sub: mcd > 0 ? `${Math.ceil(mcd)}s` : `x${Math.round(player.stats.missileCount)}`,
    pressed: input.pressed.missile,
    disabled: mcd > 0,
    progress: mcd > 0 ? mcd / mtotal : 0
  });

  const dashReady = player.dashCharges > 0;
  drawButton(ctx, TOUCH_LAYOUT.dash, {
    color: dashReady ? '#8fe8ff' : '#ff6b5a',
    label: 'DASH',
    sub: dashReady ? `x${player.dashCharges}` : `${Math.ceil(player.dashRecharge)}s`,
    pressed: input.pressed.dash,
    disabled: !dashReady,
    progress: dashReady ? 0 : 1 - player.dashRecharge / Math.max(0.001, player.stats.dashCooldown)
  });

  drawButton(ctx, TOUCH_LAYOUT.swap, {
    color: '#f4f8ff',
    label: 'SWAP',
    sub: weapon.key,
    pressed: input.pressed.swap
  });

  ctx.globalAlpha = 1;
}
