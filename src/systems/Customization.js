/**
 * Armor cosmetics. Everything here is pure Canvas 2D so the same art is used
 * by the player, the War Machine companion, the armory preview and the HUD.
 * Bodies are drawn facing +X and rotated by the caller.
 */

export const ARMOR_FRAMES = [
  { id: 'mk3', name: 'MARK III', tag: 'BALANCED PLATE' },
  { id: 'mk42', name: 'MARK XLII', tag: 'SEGMENTED PLATE' },
  { id: 'hulkbuster', name: 'HULKBUSTER', tag: 'SIEGE PLATE' }
];

export const SHIP_PALETTES = [
  {
    id: 'classic',
    name: 'CLASSIC RED',
    hull: '#b5121b',
    hullLo: '#5d070d',
    plate: '#e8b64a',
    plateLo: '#9c6f1c',
    stroke: '#ffd76a',
    accent: '#ff4b3a',
    core: '#d8fbff',
    glow: '#ffd76a',
    trail: '#ff7a4d',
    visor: '#d8fbff'
  },
  {
    id: 'mk42',
    name: 'MARK XLII',
    hull: '#c81d25',
    hullLo: '#6d0a10',
    plate: '#ffd76a',
    plateLo: '#b4811f',
    stroke: '#ffe79a',
    accent: '#ffb347',
    core: '#fff6c6',
    glow: '#ffcf5c',
    trail: '#ffb347',
    visor: '#fff6c6'
  },
  {
    id: 'bleeding',
    name: 'BLEEDING EDGE',
    hull: '#181a22',
    hullLo: '#08090d',
    plate: '#e0a93c',
    plateLo: '#8f6416',
    stroke: '#ffd76a',
    accent: '#ff3b30',
    core: '#8fe8ff',
    glow: '#ff4b3a',
    trail: '#8fe8ff',
    visor: '#8fe8ff'
  },
  {
    id: 'centurion',
    name: 'SILVER CENTURION',
    hull: '#8798ab',
    hullLo: '#414c5b',
    plate: '#e4edf6',
    plateLo: '#93a4b5',
    stroke: '#dff6ff',
    accent: '#ff4b3a',
    core: '#c8f6ff',
    glow: '#9fe8ff',
    trail: '#9fe8ff',
    visor: '#ff8b7a'
  },
  {
    id: 'hulkbuster',
    name: 'HULKBUSTER GOLD',
    hull: '#7b2c20',
    hullLo: '#35100a',
    plate: '#c99a52',
    plateLo: '#7c5a24',
    stroke: '#ffd76a',
    accent: '#ff6b3a',
    core: '#fff0b8',
    glow: '#ffb347',
    trail: '#ffb347',
    visor: '#ffe9b0'
  },
  {
    id: 'stealth',
    name: 'STEALTH OPS',
    hull: '#141821',
    hullLo: '#070a0f',
    plate: '#414b59',
    plateLo: '#1d232c',
    stroke: '#8fb8d6',
    accent: '#ff3b30',
    core: '#9fe8ff',
    glow: '#5ec8ff',
    trail: '#5ec8ff',
    visor: '#ff5b4a'
  }
];

export const ALLY_PALETTES = [
  {
    id: 'gunmetal',
    name: 'GUNMETAL',
    hull: '#3d454f',
    hullLo: '#171b20',
    plate: '#96a3b2',
    plateLo: '#4c5764',
    stroke: '#d6e0ec',
    accent: '#d94b3f',
    core: '#ffe6a8',
    glow: '#9fd8ff',
    trail: '#9fd8ff',
    visor: '#ff5b4a'
  },
  {
    id: 'patriot',
    name: 'IRON PATRIOT',
    hull: '#1f3a63',
    hullLo: '#0b1930',
    plate: '#c9ccd2',
    plateLo: '#6f7681',
    stroke: '#eef4ff',
    accent: '#d94b3f',
    core: '#fff2c2',
    glow: '#ffd76a',
    trail: '#ffb347',
    visor: '#ff5b4a'
  },
  {
    id: 'midnight',
    name: 'MIDNIGHT',
    hull: '#0e1219',
    hullLo: '#05070a',
    plate: '#333d4a',
    plateLo: '#161c24',
    stroke: '#91a4b8',
    accent: '#ff3b30',
    core: '#ffd27a',
    glow: '#7fc8ff',
    trail: '#7fc8ff',
    visor: '#ff4b3a'
  },
  {
    id: 'mk2',
    name: 'WAR MACHINE MK II',
    hull: '#515b66',
    hullLo: '#20262d',
    plate: '#b3bec9',
    plateLo: '#606d7b',
    stroke: '#e2edf7',
    accent: '#cf3b31',
    core: '#ffe9b0',
    glow: '#9fd8ff',
    trail: '#c6e6ff',
    visor: '#ff6b4a'
  }
];

function flame(ctx, x, y, len, color, alpha) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 2.6);
  ctx.lineTo(x - len, y);
  ctx.lineTo(x, y + 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draw a top-down Iron Man / War Machine suit.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} style armor frame index
 * @param {object} pal palette entry
 * @param {{variant?: 'iron'|'war', pilot?: boolean, flash?: boolean, boost?: number, heat?: number}} opts
 */
export function drawArmorBody(ctx, style, pal, opts = {}) {
  const war = opts.variant === 'war';
  const flash = !!opts.flash;
  const boost = opts.boost || 0;
  const hull = flash ? '#ffffff' : pal.hull;
  const hullLo = flash ? '#ffffff' : pal.hullLo;
  const plate = flash ? '#ffffff' : pal.plate;
  const plateLo = flash ? '#ffffff' : pal.plateLo;
  const stroke = flash ? '#ffffff' : pal.stroke;
  const accent = flash ? '#ffffff' : pal.accent;
  const core = flash ? '#ffffff' : pal.core;
  const visor = flash ? '#ffffff' : (pal.visor || core);
  const bulky = style === 2 || war;
  const angular = style === 1;
  const sx = bulky ? 1.16 : 1;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Boot thrusters / repulsor exhaust.
  if (boost > 0.02) {
    const flick = 0.72 + Math.random() * 0.28;
    flame(ctx, -13, -5.6, (14 + boost * 26) * flick, pal.trail, 0.55);
    flame(ctx, -13, 5.6, (14 + boost * 26) * flick, pal.trail, 0.55);
    flame(ctx, -15, 0, (9 + boost * 17) * flick, '#ffffff', 0.28);
  }

  // Legs / lower suit.
  ctx.fillStyle = hullLo;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-4, -8.4);
  ctx.lineTo(-16, -7.6);
  ctx.lineTo(-19, -3.8);
  ctx.lineTo(-19, 3.8);
  ctx.lineTo(-16, 7.6);
  ctx.lineTo(-4, 8.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Back power pack.
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = plateLo;
  ctx.beginPath();
  ctx.roundRect(-13.5, -5.2, 7.5, 10.4, 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Main torso.
  const torso = ctx.createLinearGradient(-10, -12, 12, 12);
  torso.addColorStop(0, hullLo);
  torso.addColorStop(0.46, hull);
  torso.addColorStop(1, hullLo);
  ctx.fillStyle = torso;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = flash ? 0 : 12;
  ctx.beginPath();
  if (angular) {
    ctx.moveTo(13, 0);
    ctx.lineTo(9, -8.4);
    ctx.lineTo(-5, -10.2);
    ctx.lineTo(-13, -6.8);
    ctx.lineTo(-13, 6.8);
    ctx.lineTo(-5, 10.2);
    ctx.lineTo(9, 8.4);
  } else if (bulky) {
    ctx.moveTo(13.5, 0);
    ctx.lineTo(9.5, -10.5);
    ctx.lineTo(-5, -12);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-14, 8);
    ctx.lineTo(-5, 12);
    ctx.lineTo(9.5, 10.5);
  } else {
    ctx.moveTo(13, 0);
    ctx.lineTo(8.5, -8.8);
    ctx.lineTo(-5, -9.8);
    ctx.lineTo(-12, -6.2);
    ctx.lineTo(-12, 6.2);
    ctx.lineTo(-5, 9.8);
    ctx.lineTo(8.5, 8.8);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Gold chest / abdominal plating.
  ctx.fillStyle = plate;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(9, -6.4);
  ctx.lineTo(2.6, -7.4);
  ctx.lineTo(-2.4, -4.6);
  ctx.lineTo(-2.4, 4.6);
  ctx.lineTo(2.6, 7.4);
  ctx.lineTo(9, 6.4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = plateLo;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(1.5, -5.6);
  ctx.moveTo(8, 5);
  ctx.lineTo(1.5, 5.6);
  ctx.stroke();

  // Arc reactor.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const reactor = ctx.createRadialGradient(1.8, 0, 0.5, 1.8, 0, 9);
  reactor.addColorStop(0, '#ffffff');
  reactor.addColorStop(0.28, core);
  reactor.addColorStop(0.7, pal.glow);
  reactor.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = reactor;
  ctx.beginPath();
  ctx.arc(1.8, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = core;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(1.8, 0, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Shoulder pauldrons.
  const shR = bulky ? 6.6 : 5.4;
  const shoulderY = bulky ? 12.5 : 11;
  ctx.fillStyle = plate;
  ctx.strokeStyle = plateLo;
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-0.5, side * shoulderY, shR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.arc(-0.5, side * shoulderY, shR * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = plate;
  }

  // Arms + palm repulsors.
  for (const side of [-1, 1]) {
    const y = side * (bulky ? 13.4 : 11.7);
    ctx.fillStyle = hull;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(2.5, y - 3.2, bulky ? 17 : 15.5, 6.4, 2.4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.roundRect(12, y - 2.5, 5.2, 5, 1.6);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const palm = ctx.createRadialGradient(18.5, y, 0.5, 18.5, y, 5.4);
    palm.addColorStop(0, '#ffffff');
    palm.addColorStop(0.35, core);
    palm.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = palm;
    ctx.beginPath();
    ctx.arc(18.5, y, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(18.5, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // War Machine shoulder cannon.
  if (war) {
    ctx.fillStyle = plateLo;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-4, -19.5, 15, 5.2, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#10151c';
    ctx.beginPath();
    ctx.roundRect(8, -18.6, 10, 3.4, 1.4);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(16, -18.1, 2.2, 2.4);
  }

  // Helmet.
  ctx.fillStyle = hull;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.1;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = flash ? 0 : 8;
  ctx.beginPath();
  if (bulky) {
    ctx.moveTo(19.5, 0);
    ctx.lineTo(16.5, -6.2);
    ctx.lineTo(11.5, -6.8);
    ctx.lineTo(8.5, -3.6);
    ctx.lineTo(8.5, 3.6);
    ctx.lineTo(11.5, 6.8);
    ctx.lineTo(16.5, 6.2);
  } else {
    ctx.moveTo(20, 0);
    ctx.lineTo(17, -5.4);
    ctx.lineTo(12, -6);
    ctx.lineTo(9, -3.2);
    ctx.lineTo(9, 3.2);
    ctx.lineTo(12, 6);
    ctx.lineTo(17, 5.4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Gold faceplate.
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.moveTo(18.6, 0);
  ctx.lineTo(15.8, -3.2);
  ctx.lineTo(12.4, -2.8);
  ctx.lineTo(13.6, 0);
  ctx.lineTo(12.4, 2.8);
  ctx.lineTo(15.8, 3.2);
  ctx.closePath();
  ctx.fill();

  // Eye slits.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = visor;
  ctx.shadowColor = visor;
  ctx.shadowBlur = 6;
  ctx.fillRect(15.8, -2.5, 2.8, 1.35);
  ctx.fillRect(15.8, 1.15, 2.8, 1.35);
  ctx.restore();

  // Heat glow along the chest seams.
  if (opts.heat > 0.45) {
    const h = Math.min(1, (opts.heat - 0.45) / 0.55);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = h * 0.7;
    ctx.strokeStyle = h > 0.8 ? '#ff3b30' : '#ffb347';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(7, -7.5);
    ctx.lineTo(-2, -8.8);
    ctx.moveTo(7, 7.5);
    ctx.lineTo(-2, 8.8);
    ctx.stroke();
    ctx.restore();
  }

  // Panel highlights.
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(-9.2, -7.4);
  ctx.lineTo(-9.2, 7.4);
  ctx.moveTo(-4.8, -9.4);
  ctx.lineTo(-4.8, 9.4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (opts.pilot) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(1.8, 0, 5.6, -2.3, -0.8);
    ctx.stroke();
  }

  ctx.restore();
}

// Legacy name kept for any stored custom code that still imports it.
export const drawShipBody = drawArmorBody;
