import { TAU, clamp } from '../engine/MathUtils.js';
import { ABILITIES } from '../systems/Abilities.js';
import { STICK_RADIUS } from './Input.js';

function drawStick(ctx, stick, hintX, hintY, color, label) {
  const active = stick.active;
  const cx = active ? stick.ox : hintX;
  const cy = active ? stick.oy : hintY;
  const kx = active ? stick.kx : hintX;
  const ky = active ? stick.ky : hintY;
  const baseR = STICK_RADIUS + 12;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = active ? 0.85 : 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = active ? 0.14 : 0.05;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = active ? 0.95 : 0.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(kx, ky, 25, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#04010a';
  ctx.beginPath();
  ctx.arc(kx, ky, 15, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = active ? 0.85 : 0.4;
  ctx.fillStyle = color;
  ctx.font = '9px "SFMono-Regular", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy - baseR - 12);
  ctx.restore();
}

function drawDashButton(ctx, input, game) {
  const db = input.getDashButton();
  const player = game ? game.player : null;
  const charges = player ? player.dashCharges : 0;
  const ready = charges > 0;
  const color = ready ? '#46f4ff' : '#ff2f8e';
  const pressed = input.dashBtn.pressed;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pressed ? 1 : 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = pressed ? 4 : 2.5;
  ctx.beginPath();
  ctx.arc(db.x, db.y, db.r, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = pressed ? 0.32 : (ready ? 0.16 : 0.08);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(db.x, db.y, db.r, 0, TAU);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = ready ? 1 : 0.55;
  ctx.fillStyle = ready ? '#dffbff' : '#ffd1e6';
  ctx.font = 'bold 11px "SFMono-Regular", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DASH', db.x, db.y - 4);
  ctx.fillStyle = color;
  ctx.font = '10px "SFMono-Regular", Consolas, monospace';
  ctx.fillText(charges > 0 ? `x${charges}` : '--', db.x, db.y + 13);
  ctx.restore();
}

function drawAbilityButtons(ctx, input, game) {
  if (!game) return;
  const btns = input.getAbilityButtons();
  const player = game.player;
  for (let i = 0; i < btns.length; i++) {
    const b = btns[i];
    const ab = ABILITIES[i];
    const slot = player.abilities[ab.id];
    const total = Math.max(0.001, ab.cooldown * (player.stats.cooldownMult || 1));
    const cd = slot ? slot.cd : 0;
    const ready = cd <= 0;
    const pressed = input.abilityHeld[ab.id] != null;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pressed ? 1 : 0.85;
    ctx.strokeStyle = ready ? ab.color : 'rgba(140, 150, 170, 0.55)';
    ctx.lineWidth = pressed ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = pressed ? 0.34 : (ready ? 0.18 : 0.07);
    ctx.fillStyle = ab.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();

    if (!ready) {
      const frac = clamp(cd / total, 0, 1);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#04010a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 2, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * frac);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = ready ? 1 : 0.45;
    ctx.fillStyle = ready ? ab.color : '#8fa0b0';
    ctx.font = 'bold 9px "SFMono-Regular", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ab.short, b.x, b.y - 3);
    ctx.font = '9px "SFMono-Regular", Consolas, monospace';
    ctx.fillText(ready ? ab.keyLabel : `${Math.ceil(cd)}s`, b.x, b.y + 10);
    ctx.restore();
  }
}

export function drawTouchControls(ctx, canvas, input, game, state, dpr, view) {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!input.usingTouch || state !== 'playing' || !game) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  drawStick(ctx, input.move, 112, view.h - 156, '#46f4ff', 'MOVE');
  drawStick(ctx, input.aim, view.w - 210, view.h - 138, '#ff2f8e', 'AIM / FIRE');
  drawDashButton(ctx, input, game);
  drawAbilityButtons(ctx, input, game);
  ctx.globalAlpha = 1;
}
