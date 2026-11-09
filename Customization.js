export const SHIP_STYLES = [
  { id: 'interceptor', name: 'INTERCEPTOR' },
  { id: 'lancer', name: 'LANCER' },
  { id: 'warden', name: 'WARDEN' }
];

export const SHIP_PALETTES = [
  {
    id: 'nova',
    name: 'NOVA',
    hull: '#092030',
    hullLo: '#061520',
    stroke: '#46f4ff',
    accent: '#8b5cff',
    core: '#dffbff',
    glow: '#46f4ff',
    trail: '#46f4ff'
  },
  {
    id: 'ember',
    name: 'EMBER',
    hull: '#2a0a18',
    hullLo: '#1a0510',
    stroke: '#ff2f8e',
    accent: '#ffc857',
    core: '#ffe6f1',
    glow: '#ff2f8e',
    trail: '#ff8dc0'
  },
  {
    id: 'verdant',
    name: 'VERDANT',
    hull: '#04241a',
    hullLo: '#021610',
    stroke: '#59ffa8',
    accent: '#46f4ff',
    core: '#e6fff2',
    glow: '#59ffa8',
    trail: '#59ffa8'
  },
  {
    id: 'solar',
    name: 'SOLAR',
    hull: '#2a1e05',
    hullLo: '#1a1203',
    stroke: '#ffc857',
    accent: '#ff8a66',
    core: '#fff6d8',
    glow: '#ffc857',
    trail: '#ffc857'
  },
  {
    id: 'void',
    name: 'VOID',
    hull: '#170a2a',
    hullLo: '#0d0618',
    stroke: '#b06bff',
    accent: '#ff2f8e',
    core: '#f0e6ff',
    glow: '#b06bff',
    trail: '#b06bff'
  },
  {
    id: 'frost',
    name: 'FROST',
    hull: '#0a2030',
    hullLo: '#061420',
    stroke: '#8be9ff',
    accent: '#dffbff',
    core: '#ffffff',
    glow: '#8be9ff',
    trail: '#8be9ff'
  }
];

export const ALLY_PALETTES = [
  { id: 'mint', name: 'MINT', hull: '#06251c', stroke: '#59ffa8', accent: '#46f4ff', core: '#e6fff2', glow: '#59ffa8', trail: '#59ffa8' },
  { id: 'rose', name: 'ROSE', hull: '#2a0a1c', stroke: '#ff7bbd', accent: '#ffc857', core: '#ffe6f1', glow: '#ff7bbd', trail: '#ff7bbd' },
  { id: 'amber', name: 'AMBER', hull: '#2a1e05', stroke: '#ffc857', accent: '#59ffa8', core: '#fff6d8', glow: '#ffc857', trail: '#ffc857' },
  { id: 'violet', name: 'VIOLET', hull: '#170a2a', stroke: '#b06bff', accent: '#46f4ff', core: '#f0e6ff', glow: '#b06bff', trail: '#b06bff' }
];

export function drawShipBody(ctx, style, pal, opts = {}) {
  const flash = opts.flash;
  const hull = flash ? '#ffffff' : pal.hull;
  const stroke = flash ? '#ffffff' : pal.stroke;
  const accent = flash ? '#ffffff' : pal.accent;
  const core = flash ? '#ffffff' : pal.core;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = hull;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();

  if (style === 1) {
    ctx.moveTo(24, 0);
    ctx.lineTo(2, -4.5);
    ctx.lineTo(-5, -13);
    ctx.lineTo(-3, -4);
    ctx.lineTo(-14, -4);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-3, 4);
    ctx.lineTo(-5, 13);
    ctx.lineTo(2, 4.5);
  } else if (style === 2) {
    ctx.moveTo(17, 0);
    ctx.lineTo(9, -9);
    ctx.lineTo(-3, -13);
    ctx.lineTo(-11, -7);
    ctx.lineTo(-11, 7);
    ctx.lineTo(-3, 13);
    ctx.lineTo(9, 9);
  } else {
    ctx.moveTo(19, 0);
    ctx.lineTo(-2, -12);
    ctx.lineTo(-12, -8);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 8);
    ctx.lineTo(-2, 12);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (style === 1) {
    ctx.moveTo(15, 0);
    ctx.lineTo(-2, -3);
    ctx.lineTo(-1, 0);
    ctx.lineTo(-2, 3);
  } else if (style === 2) {
    ctx.moveTo(11, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 5);
  } else {
    ctx.moveTo(12, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 6);
  }
  ctx.closePath();
  ctx.stroke();

  if (style === 2) {
    ctx.fillStyle = accent;
    ctx.fillRect(-4, -17, 10, 3);
    ctx.fillRect(-4, 14, 10, 3);
  } else if (style === 1) {
    ctx.fillStyle = accent;
    ctx.fillRect(-10, -13, 4, 3);
    ctx.fillRect(-10, 10, 4, 3);
  }

  if (opts.pilot) {
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 12;
    const glass = ctx.createRadialGradient(0, -1.5, 1, 0, 0, 10);
    glass.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    glass.addColorStop(0.45, pal.hullLo);
    glass.addColorStop(1, 'rgba(2, 8, 14, 0.98)');
    ctx.fillStyle = glass;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, -0.5, 9.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-6, -6, 4.4, 3);
    ctx.fillRect(-6, 3, 4.4, 3);
    ctx.globalAlpha = 1;

    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0.4, 0, 3.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.fillStyle = stroke;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(2.2, 0, 2.6, 2.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(3.0, -0.9, 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-0.5, 0, 7.4, -2.45, -1.15);
    ctx.stroke();
  } else {
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(2, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = stroke;
  ctx.fillRect(6, -1.8, 15, 3.6);
  ctx.restore();
}
