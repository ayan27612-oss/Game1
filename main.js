import { Game } from './Game.js';
import { AudioSynth } from './engine/AudioSynth.js';
import { SaveData, META_UNLOCKS, RARITY_NAMES } from './systems/Upgrades.js';
import { CAM_TILT, screenDirToWorld } from './engine/Projection.js';
import { ABILITIES } from './systems/Abilities.js';
import { SHIP_STYLES, SHIP_PALETTES, ALLY_PALETTES, drawShipBody } from './systems/Customization.js';
import { TAU, clamp, formatTime } from './engine/MathUtils.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const touchCanvas = document.getElementById('touch-layer');
const tctx = touchCanvas ? touchCanvas.getContext('2d') : null;
const worldCanvas = document.createElement('canvas');
const wctx = worldCanvas.getContext('2d', { desynchronized: true });
const channelCanvas = document.createElement('canvas');
const chCtx = channelCanvas.getContext('2d');

const TOUCH_DEADZONE = 0.16;
const STICK_RADIUS = 58;
const DASH_BUTTON_RADIUS = 46;

const view = { w: window.innerWidth, h: window.innerHeight };
let dpr = 1;
let resolutionScale = 1;
let lastQualityCheck = 0;
let lastQualityDrop = 0;

const el = (id) => document.getElementById(id);
const hud = el('hud');
const hpFill = el('hp-fill');
const hpText = el('hp-text');
const xpFill = el('xp-fill');
const xpText = el('xp-text');
const hudLevel = el('hud-level');
const hudName = el('hud-name');
const hudScore = el('hud-score');
const hudTime = el('hud-time');
const hudKills = el('hud-kills');
const heatFill = el('heat-fill');
const heatStatus = el('heat-status');
const dashPips = el('dash-pips');
const bossBar = el('boss-bar');
const bossFill = el('boss-fill');
const bossPhase = el('boss-phase');
const menu = el('menu');
const draft = el('draft');
const draftCards = el('draft-cards');
const draftLevel = el('draft-level');
const pause = el('pause');
const gameover = el('gameover');
const toastEl = el('toast');
const menuScores = el('menu-scores');
const menuCurrency = el('menu-currency');
const metaShop = el('meta-shop');
const goScore = el('go-score');
const goTime = el('go-time');
const goLevel = el('go-level');
const goKills = el('go-kills');
const goMeta = el('go-meta');
const btnScan = el('btn-scan');
const btnMute = el('btn-mute');
const btnFull = el('btn-full');
const btnFullscreen = el('btn-fullscreen');
const abilityHudEl = el('ability-hud');
const allyChip = el('ally-chip');
const allyState = el('ally-state');
const hangarCanvas = el('hangar-preview');
const hangarCtx = hangarCanvas ? hangarCanvas.getContext('2d') : null;
let wakeLock = null;

class Input {
  constructor(target) {
    this.target = target;
    this.keys = new Set();
    this.mouse = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5, down: false };
    this.dashQueued = false;
    this.usingTouch = false;
    this.usingPad = false;
    this.move = this._makeStick();
    this.aim = this._makeStick();
    this.dashBtn = { id: null, pressed: false };
    this.abilityQueued = [];
    this.abilityHeld = {};
    this.padIndex = -1;
    this.padCount = 0;
    this.padLX = 0;
    this.padLY = 0;
    this.padRX = 0;
    this.padRY = 0;
    this.padFire = false;
    this.padPrev = [];
    this.padUi = { start: false, confirm: false, left: false, right: false };

    window.addEventListener('keydown', (e) => {
      const ab = ABILITIES.find((a) => a.key === e.code);
      if (ab) {
        e.preventDefault();
        this.abilityQueued.push(ab.id);
      }
    });

    target.addEventListener('mousemove', (e) => {
      if (this.usingTouch) return;
      this.usingPad = false;
      const rect = target.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    target.addEventListener('mousedown', (e) => {
      if (this.usingTouch) return;
      this.usingPad = false;
      if (e.button === 0) this.mouse.down = true;
      const rect = target.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());

    target.addEventListener('pointerdown', (e) => this._pointerDown(e));
    target.addEventListener('pointermove', (e) => this._pointerMove(e));
    window.addEventListener('pointerup', (e) => this._pointerUp(e));
    window.addEventListener('pointercancel', (e) => this._pointerUp(e));

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this.dashQueued = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this._resetStick(this.move);
      this._resetStick(this.aim);
      this.dashBtn.id = null;
      this.dashBtn.pressed = false;
      this.abilityHeld = {};
      this.abilityQueued.length = 0;
    });
  }

  _makeStick() {
    return { id: null, active: false, ox: 0, oy: 0, kx: 0, ky: 0, vx: 0, vy: 0, strength: 0 };
  }

  getDashButton() {
    return {
      x: window.innerWidth - 72,
      y: window.innerHeight - 120,
      r: DASH_BUTTON_RADIUS
    };
  }

  getAbilityButtons() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const list = [];
    for (let i = 0; i < ABILITIES.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      list.push({
        id: ABILITIES[i].id,
        x: w - 58 - col * 64,
        y: h - 198 - row * 64,
        r: 28
      });
    }
    return list;
  }

  _pointerDown(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    if (!this.usingTouch) {
      this.usingTouch = true;
      document.body.classList.add('touch-mode');
    }
    if (this.target.setPointerCapture) {
      try { this.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    const rect = this.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const abilityBtns = this.getAbilityButtons();
    for (let i = 0; i < abilityBtns.length; i++) {
      const b = abilityBtns[i];
      if (Math.hypot(x - b.x, y - b.y) <= b.r * 1.2) {
        this.abilityQueued.push(b.id);
        this.abilityHeld[b.id] = e.pointerId;
        return;
      }
    }

    const db = this.getDashButton();
    if (Math.hypot(x - db.x, y - db.y) <= db.r * 1.2) {
      this.dashBtn.id = e.pointerId;
      this.dashBtn.pressed = true;
      this.dashQueued = true;
      return;
    }

    const stick = x < window.innerWidth * 0.5 ? this.move : this.aim;
    if (stick.id !== null) return;
    stick.id = e.pointerId;
    stick.active = true;
    stick.ox = x;
    stick.oy = y;
    stick.kx = x;
    stick.ky = y;
    stick.vx = 0;
    stick.vy = 0;
    stick.strength = 0;
  }

  _pointerMove(e) {
    if (e.pointerType === 'mouse') return;
    const rect = this.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this.move.id === e.pointerId) this._updateStick(this.move, x, y);
    else if (this.aim.id === e.pointerId) this._updateStick(this.aim, x, y);
  }

  _pointerUp(e) {
    if (e.pointerType === 'mouse') return;
    if (this.move.id === e.pointerId) this._resetStick(this.move);
    if (this.aim.id === e.pointerId) this._resetStick(this.aim);
    if (this.dashBtn.id === e.pointerId) {
      this.dashBtn.id = null;
      this.dashBtn.pressed = false;
    }
    for (const id in this.abilityHeld) {
      if (this.abilityHeld[id] === e.pointerId) delete this.abilityHeld[id];
    }
  }

  _updateStick(stick, x, y) {
    let dx = x - stick.ox;
    let dy = y - stick.oy;
    const len = Math.hypot(dx, dy);
    const max = STICK_RADIUS;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    stick.kx = stick.ox + dx;
    stick.ky = stick.oy + dy;
    const nx = dx / max;
    const ny = dy / max;
    const mag = Math.min(1, Math.hypot(nx, ny));
    if (mag < TOUCH_DEADZONE) {
      stick.vx = 0;
      stick.vy = 0;
      stick.strength = 0;
      return;
    }
    const scaled = (mag - TOUCH_DEADZONE) / (1 - TOUCH_DEADZONE);
    const inv = 1 / (mag || 1);
    stick.vx = nx * inv * scaled;
    stick.vy = ny * inv * scaled;
    stick.strength = scaled;
  }

  _resetStick(stick) {
    stick.id = null;
    stick.active = false;
    stick.vx = 0;
    stick.vy = 0;
    stick.strength = 0;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  poll() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let count = 0;
    let lx = 0;
    let ly = 0;
    let rx = 0;
    let ry = 0;
    let fire = false;
    let dash = false;
    let start = false;
    let confirm = false;
    let left = false;
    let right = false;
    const abilities = new Set();
    const nextPrev = [];

    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      count++;
      const axes = pad.axes || [];
      lx += axes[0] || 0;
      ly += axes[1] || 0;
      rx += axes[2] || 0;
      ry += axes[3] || 0;

      const buttons = pad.buttons || [];
      const prev = this.padPrev[i] || [];
      const states = [];
      const pressed = (n) => {
        const b = buttons[n];
        return !!(b && (b.pressed || b.value > 0.5));
      };
      const edge = (n) => pressed(n) && !prev[n];

      if (edge(0)) {
        dash = true;
        confirm = true;
      }
      if (edge(9)) start = true;
      if (edge(14)) left = true;
      if (edge(15)) right = true;
      if (edge(2)) abilities.add('nova');
      if (edge(3)) abilities.add('shield');
      if (edge(1)) abilities.add('overdrive');
      if (edge(4)) abilities.add('timewarp');
      if (pressed(7) || pressed(5)) fire = true;

      for (let n = 0; n < buttons.length; n++) states[n] = pressed(n);
      nextPrev[i] = states;
    }

    this.padCount = count;
    this.padPrev = nextPrev;
    this.padUi = { start, confirm, left, right };
    if (count > 0 && (fire || dash || start || confirm || left || right || Math.abs(lx) > 0.18 || Math.abs(ly) > 0.18 || Math.abs(rx) > 0.18 || Math.abs(ry) > 0.18 || abilities.size > 0)) {
      this.usingPad = true;
    }
    if (count === 0) {
      this.padIndex = -1;
      this.padLX = 0;
      this.padLY = 0;
      this.padRX = 0;
      this.padRY = 0;
      this.padFire = false;
      return;
    }

    this.padIndex = 0;
    const dz = 0.18;
    lx = clamp(lx, -1, 1);
    ly = clamp(ly, -1, 1);
    rx = clamp(rx, -1, 1);
    ry = clamp(ry, -1, 1);
    this.padLX = Math.abs(lx) > dz ? lx : 0;
    this.padLY = Math.abs(ly) > dz ? ly : 0;
    this.padRX = Math.abs(rx) > dz ? rx : 0;
    this.padRY = Math.abs(ry) > dz ? ry : 0;
    this.padFire = fire;

    if (dash) this.dashQueued = true;
    for (const id of abilities) this.abilityQueued.push(id);
  }

  getMove() {
    let x = (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0);
    let y = (this.isDown('KeyS') ? 1 : 0) - (this.isDown('KeyW') ? 1 : 0);
    if (this.move.active) {
      x += this.move.vx;
      y += this.move.vy;
    }
    x += this.padLX;
    y += this.padLY;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    if (x !== 0 || y !== 0) {
      const mag = Math.min(1, Math.hypot(x, y));
      const wd = screenDirToWorld(x, y, CAM_TILT);
      x = wd.x * mag;
      y = wd.y * mag;
    }
    return { x, y };
  }

  getAimDir() {
    if (this.padRX !== 0 || this.padRY !== 0) {
      const wd = screenDirToWorld(this.padRX, this.padRY, CAM_TILT);
      const m = Math.hypot(wd.x, wd.y) || 1;
      return { x: wd.x / m, y: wd.y / m };
    }
    if (this.aim.active && this.aim.strength > 0.01) {
      const wd = screenDirToWorld(this.aim.vx, this.aim.vy, CAM_TILT);
      const m = Math.hypot(wd.x, wd.y) || 1;
      return { x: wd.x / m, y: wd.y / m };
    }
    return null;
  }

  consumeAbilities() {
    if (this.abilityQueued.length === 0) return [];
    const queued = this.abilityQueued.slice();
    this.abilityQueued.length = 0;
    return queued;
  }

  isFiring() {
    return this.mouse.down || this.padFire || (this.aim.active && this.aim.strength > 0.01);
  }

  consumeDash() {
    if (this.dashQueued) {
      this.dashQueued = false;
      return true;
    }
    return false;
  }
}

const input = new Input(canvas);
const audio = new AudioSynth();
const save = SaveData.load();

let game = null;
let state = 'menu';
let alpha = 1;
let telemetry = false;
let scanlinesOn = true;
let draftChoices = [];
let toastTimer = 0;
let lastHudText = 0;

const STEP = 1000 / 60;
let accumulator = 0;
let lastFrame = performance.now();
let fpsSmooth = 60;
let frameMsSmooth = 16.7;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1) * resolutionScale;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = dpr;
  canvas.width = Math.max(1, Math.floor(view.w * dpr));
  canvas.height = Math.max(1, Math.floor(view.h * dpr));
  worldCanvas.width = canvas.width;
  worldCanvas.height = canvas.height;
  channelCanvas.width = canvas.width;
  channelCanvas.height = canvas.height;
  if (touchCanvas) {
    touchCanvas.width = canvas.width;
    touchCanvas.height = canvas.height;
  }
  if (game) game._clampCamera();
}

window.addEventListener('resize', resize);
resize();

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function refreshMenu() {
  menuScores.innerHTML = '';
  if (!save.highScores.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'NO RUNS LOGGED';
    menuScores.appendChild(li);
  } else {
    for (let i = 0; i < save.highScores.length; i++) {
      const s = save.highScores[i];
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(i + 1).padStart(2, '0');
      const sc = document.createElement('span');
      sc.className = 'sc';
      sc.textContent = String(s.score).padStart(6, '0');
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = `${formatTime(s.time)} · LV ${s.level}`;
      li.appendChild(rank);
      li.appendChild(sc);
      li.appendChild(meta);
      menuScores.appendChild(li);
    }
  }

  menuCurrency.textContent = `${save.currency} CR`;
  metaShop.innerHTML = '';
  for (let i = 0; i < META_UNLOCKS.length; i++) {
    const meta = META_UNLOCKS[i];
    const owned = save.hasUnlock(meta.id);
    const item = document.createElement('div');
    item.className = 'meta-item' + (owned ? ' owned' : '');

    const info = document.createElement('div');
    info.className = 'mi-info';
    const name = document.createElement('div');
    name.className = 'mi-name';
    name.textContent = meta.name;
    const desc = document.createElement('div');
    desc.className = 'mi-desc';
    desc.textContent = meta.desc;
    info.appendChild(name);
    info.appendChild(desc);

    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'mi-buy';
    if (owned) {
      buy.textContent = 'OWNED';
      buy.disabled = true;
    } else {
      buy.textContent = `${meta.cost} CR`;
      buy.disabled = save.currency < meta.cost;
      buy.addEventListener('click', () => {
        if (save.buyUnlock(meta.id)) {
          audio.init();
          audio.resume();
          audio.pickup();
          refreshMenu();
          toast(`UNLOCKED: ${meta.name.toUpperCase()}`);
        }
      });
    }
    item.appendChild(info);
    item.appendChild(buy);
    metaShop.appendChild(item);
  }
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      const app = document.getElementById('app');
      if (app.requestFullscreen) {
        await app.requestFullscreen({ navigationUI: 'hide' });
      }
      if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape'); } catch (err) { /* not supported */ }
      }
      if (navigator.wakeLock && !wakeLock) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { /* ignore */ }
      }
      toast('FULLSCREEN: LANDSCAPE LOCKED');
    } else {
      if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch (err) { /* ignore */ }
      }
      if (wakeLock) {
        try { await wakeLock.release(); } catch (err) { /* ignore */ }
        wakeLock = null;
      }
      await document.exitFullscreen();
      toast('FULLSCREEN OFF');
    }
  } catch (err) {
    toast('FULLSCREEN NOT AVAILABLE');
  }
}

function refreshHangar() {
  const cfg = save.getShipConfig();
  const style = SHIP_STYLES[cfg.style % SHIP_STYLES.length] || SHIP_STYLES[0];
  const pal = SHIP_PALETTES[cfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
  const ally = ALLY_PALETTES[cfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0];
  const cs = el('hangar-callsign');
  if (cs) cs.textContent = style.name;
  const styleEl = el('hangar-style');
  const palEl = el('hangar-palette');
  const allyEl = el('hangar-ally');
  if (styleEl) styleEl.textContent = style.name;
  if (palEl) palEl.textContent = pal.name;
  if (allyEl) allyEl.textContent = ally.name;
  drawHangarPreview(cfg);
}

function drawHangarPreview(cfg) {
  if (!hangarCtx) return;
  const c = hangarCtx;
  const w = hangarCanvas.width;
  const h = hangarCanvas.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);

  const bg = c.createRadialGradient(w * 0.42, h * 0.55, 0, w * 0.42, h * 0.55, h * 1.2);
  bg.addColorStop(0, 'rgba(139, 92, 255, 0.2)');
  bg.addColorStop(0.5, 'rgba(255, 47, 142, 0.06)');
  bg.addColorStop(1, 'rgba(4, 1, 10, 0)');
  c.fillStyle = '#06010f';
  c.fillRect(0, 0, w, h);
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  c.strokeStyle = 'rgba(70, 244, 255, 0.1)';
  c.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const y = h * 0.3 + i * i * 2.1;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    c.beginPath();
    c.moveTo(w * 0.42 + i * 10, h * 0.3);
    c.lineTo(w * 0.42 + i * 58, h);
    c.stroke();
  }

  const pal = SHIP_PALETTES[cfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
  c.save();
  c.translate(w * 0.4, h * 0.55);
  c.scale(2.6, 2.6);
  c.rotate(-Math.PI * 0.5);
  drawShipBody(c, cfg.style % SHIP_STYLES.length, pal, { pilot: true });
  c.restore();

  const allyPal = ALLY_PALETTES[cfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0];
  c.save();
  c.translate(w * 0.76, h * 0.68);
  c.scale(1.5, 1.5);
  c.rotate(-Math.PI * 0.5);
  drawShipBody(c, (cfg.style + 1) % SHIP_STYLES.length, allyPal, {});
  c.restore();

  c.fillStyle = 'rgba(157, 184, 199, 0.75)';
  c.font = '9px "SFMono-Regular", Consolas, monospace';
  c.textAlign = 'center';
  c.fillText('OPERATOR', w * 0.4, h - 10);
  c.fillText('WINGMAN', w * 0.76, h - 10);
}

function buildAbilityHud() {
  if (!abilityHudEl) return;
  abilityHudEl.innerHTML = '';
  for (let i = 0; i < ABILITIES.length; i++) {
    const ab = ABILITIES[i];
    const chip = document.createElement('div');
    chip.className = 'ability-chip ready';
    chip.dataset.id = ab.id;
    chip.style.setProperty('--ab', ab.color);
    const key = document.createElement('b');
    key.textContent = ab.keyLabel;
    const name = document.createElement('span');
    name.textContent = ab.short;
    const cd = document.createElement('i');
    cd.textContent = 'RDY';
    chip.appendChild(key);
    chip.appendChild(name);
    chip.appendChild(cd);
    abilityHudEl.appendChild(chip);
  }
}

function updateAbilityHud() {
  if (!game || !abilityHudEl) return;
  const p = game.player;
  for (let i = 0; i < ABILITIES.length; i++) {
    const ab = ABILITIES[i];
    const chip = abilityHudEl.children[i];
    if (!chip) continue;
    const slot = p.abilities[ab.id];
    const cd = slot ? slot.cd : 0;
    const total = Math.max(0.001, ab.cooldown * (p.stats.cooldownMult || 1));
    const label = chip.children[2];
    if (cd > 0) {
      chip.classList.remove('ready');
      chip.style.setProperty('--cd', String(clamp(cd / total, 0, 1)));
      label.textContent = `${Math.ceil(cd)}s`;
    } else {
      chip.classList.add('ready');
      chip.style.setProperty('--cd', '0');
      label.textContent = 'RDY';
    }
  }
}

function buildDashPips() {
  dashPips.innerHTML = '';
  if (!game) return;
  const max = Math.max(1, Math.floor(game.player.stats.maxDashCharges));
  for (let i = 0; i < max; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    dashPips.appendChild(pip);
  }
}

function updateDashPips() {
  if (!game) return;
  const p = game.player;
  const max = Math.max(1, Math.floor(p.stats.maxDashCharges));
  if (dashPips.childElementCount !== max) buildDashPips();
  const pips = dashPips.children;
  for (let i = 0; i < pips.length; i++) {
    const pip = pips[i];
    pip.classList.toggle('full', i < p.dashCharges);
    pip.classList.toggle('charging', i === p.dashCharges && p.dashCharges < max);
  }
}

function startGame() {
  audio.init();
  audio.resume();
  audio.ui();
  audio.stopMusic();
  audio.startMusic();
  audio.duckMusic(false);

  hide(menu);
  hide(gameover);
  hide(pause);
  hide(draft);
  show(hud);
  bossBar.classList.add('hidden');
  document.body.classList.remove('low-hp');

  draftChoices = [];
  state = 'playing';
  accumulator = 0;
  alpha = 1;
  input.dashQueued = false;
  input.mouse.down = false;
  input.abilityQueued.length = 0;
  input.abilityHeld = {};

  game = new Game({
    view,
    input,
    audio,
    save,
    onLevelUp: handleLevelUp,
    onGameOver: handleGameOver
  });

  buildDashPips();
  updateHud(performance.now());
  toast('PROTOCOL INITIALIZED');
}

let padDraftIndex = 0;

function handleLevelUp() {
  if (!game) return;
  state = 'levelup';
  padDraftIndex = 0;
  input.mouse.down = false;
  input.dashQueued = false;
  input.abilityQueued.length = 0;
  input.abilityHeld = {};
  audio.duckMusic(true);
  draftChoices = game.createDraft();
  renderDraft();
  show(draft);
}

function updateDraftPadHighlight() {
  const cards = draftCards.querySelectorAll('.draft-card');
  for (let i = 0; i < cards.length; i++) {
    cards[i].classList.toggle('pad-active', i === padDraftIndex);
  }
}

function handlePadUi() {
  const ui = input.padUi;
  if (!ui) return;
  if (ui.start) {
    if (state === 'menu' || state === 'gameover') startGame();
    else if (state === 'playing' || state === 'paused') togglePause();
    return;
  }
  if (state === 'levelup' && draftChoices.length > 0) {
    if (ui.left || ui.right) {
      const count = draftChoices.length;
      padDraftIndex = (padDraftIndex + (ui.right ? 1 : count - 1)) % count;
      updateDraftPadHighlight();
      audio.ui();
    }
    if (ui.confirm) chooseDraft(padDraftIndex);
    return;
  }
  if (ui.confirm && (state === 'menu' || state === 'gameover')) startGame();
}

function renderDraft() {
  draftLevel.textContent = String(game.level);
  draftCards.innerHTML = '';
  for (let i = 0; i < draftChoices.length; i++) {
    const up = draftChoices[i];
    const stacks = game.player.upgradeCounts[up.id] || 0;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'draft-card';
    card.dataset.rarity = String(up.rarity);
    card.dataset.id = up.id;

    const top = document.createElement('div');
    top.className = 'dc-top';
    const key = document.createElement('span');
    key.className = 'dc-key';
    key.textContent = String(i + 1);
    const rarity = document.createElement('span');
    rarity.className = 'dc-rarity';
    rarity.textContent = RARITY_NAMES[up.rarity] || 'COMMON';
    top.appendChild(key);
    top.appendChild(rarity);

    const name = document.createElement('div');
    name.className = 'dc-name';
    name.textContent = up.name;

    const desc = document.createElement('div');
    desc.className = 'dc-desc';
    desc.textContent = up.desc;

    const stack = document.createElement('div');
    stack.className = 'dc-stack';
    stack.textContent = `STACK ${stacks + 1} / ${up.max}`;

    card.appendChild(top);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(stack);
    if (i === padDraftIndex) card.classList.add('pad-active');
    card.addEventListener('click', () => chooseDraft(i));
    draftCards.appendChild(card);
  }
}

function chooseDraft(index) {
  if (state !== 'levelup' || !game) return;
  const up = draftChoices[index];
  if (!up) return;
  audio.select();
  hide(draft);
  const remaining = game.applyChosen(up.id);
  draftChoices = [];
  if (remaining > 0) {
    state = 'levelup';
    draftChoices = game.createDraft();
    renderDraft();
    show(draft);
  } else {
    state = 'playing';
    input.dashQueued = false;
    input.abilityQueued.length = 0;
    accumulator = 0;
    alpha = 1;
    audio.duckMusic(false);
  }
}

function pauseGame() {
  if (state !== 'playing' || !game) return;
  state = 'paused';
  input.mouse.down = false;
  input.dashQueued = false;
  input.abilityQueued.length = 0;
  input.abilityHeld = {};
  accumulator = 0;
  audio.ui();
  audio.duckMusic(true);
  show(pause);
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  accumulator = 0;
  alpha = 1;
  audio.ui();
  audio.duckMusic(false);
  hide(pause);
}

function togglePause() {
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
}

function handleGameOver() {
  if (!game) return;
  const earned = game.finalizeRun();
  state = 'gameover';
  audio.stopMusic();
  document.body.classList.remove('low-hp');
  hide(draft);
  hide(pause);
  hide(hud);
  bossBar.classList.add('hidden');

  goScore.textContent = String(game.score);
  goTime.textContent = formatTime(game.elapsed);
  goLevel.textContent = String(game.level);
  goKills.textContent = String(game.kills);
  goMeta.textContent = `+${earned} CR SALVAGED`;

  refreshMenu();
  show(gameover);
}

function backToMenu() {
  audio.stopMusic();
  state = 'menu';
  game = null;
  hide(hud);
  hide(gameover);
  hide(pause);
  hide(draft);
  bossBar.classList.add('hidden');
  document.body.classList.remove('low-hp');
  refreshMenu();
  show(menu);
}

function abortRun() {
  if (game && !game.over) {
    const earned = game.finalizeRun();
    toast(`RUN ABORTED · +${earned} CR`);
  }
  backToMenu();
}

function updateHud(now) {
  if (!game || state === 'menu') return;
  const p = game.player;
  const hpRatio = clamp(p.hp / p.stats.maxHp, 0, 1);
  const xpRatio = clamp(game.xp / game.xpNext, 0, 1);

  hpFill.style.width = `${hpRatio * 100}%`;
  hpFill.parentElement.classList.toggle('low', hpRatio < 0.3);
  hpText.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`;
  xpFill.style.width = `${xpRatio * 100}%`;
  xpText.textContent = `XP ${Math.floor(game.xp)} / ${game.xpNext}`;
  hudLevel.textContent = `LV ${game.level}`;
  if (hudName) hudName.textContent = `OPERATOR // ${game.player.callsign || 'NOVA'}`;

  const heat = clamp(p.heat, 0, 1);
  heatFill.style.width = `${heat * 100}%`;
  if (p.overheated) {
    heatStatus.textContent = 'OVERHEAT';
    heatStatus.className = 'over';
  } else if (heat > 0.7) {
    heatStatus.textContent = 'CRITICAL';
    heatStatus.className = 'hot';
  } else if (heat > 0.35) {
    heatStatus.textContent = 'WARM';
    heatStatus.className = 'hot';
  } else {
    heatStatus.textContent = 'READY';
    heatStatus.className = '';
  }

  updateDashPips();
  updateAbilityHud();

  if (allyChip && game.ally) {
    const a = game.ally;
    if (a.downed) {
      allyChip.classList.add('down');
      allyState.textContent = `WINGMAN DOWN ${Math.max(0, Math.ceil(a.respawn))}s`;
    } else {
      allyChip.classList.remove('down');
      allyState.textContent = `WINGMAN ${Math.round(a.hp)}/${a.maxHp}`;
    }
  }

  if (now - lastHudText > 100) {
    lastHudText = now;
    hudScore.textContent = String(game.score);
    hudTime.textContent = formatTime(game.elapsed);
    hudKills.textContent = String(game.kills);
  }

  const boss = game.enemies.boss;
  if (boss && !boss.dead) {
    bossBar.classList.remove('hidden');
    bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
    bossPhase.textContent = `PHASE ${['I', 'II', 'III'][boss.phase - 1] || 'I'}`;
  } else {
    bossBar.classList.add('hidden');
  }

  document.body.classList.toggle('low-hp', hpRatio < 0.3 && state === 'playing');
}

function drawMenuBackdrop(now) {
  const t = now * 0.001;
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.clearRect(0, 0, view.w, view.h);

  const sky = wctx.createLinearGradient(0, 0, 0, view.h);
  sky.addColorStop(0, '#05000f');
  sky.addColorStop(0.55, '#120627');
  sky.addColorStop(1, '#1b0626');
  wctx.fillStyle = sky;
  wctx.fillRect(0, 0, view.w, view.h);

  const cx = view.w * 0.5;
  const horizon = view.h * 0.62;
  const sunR = Math.min(view.w, view.h) * 0.24;

  wctx.save();
  wctx.globalCompositeOperation = 'lighter';
  const sun = wctx.createRadialGradient(cx, horizon - sunR * 0.35, 10, cx, horizon - sunR * 0.35, sunR * 1.7);
  sun.addColorStop(0, 'rgba(255, 90, 170, 0.5)');
  sun.addColorStop(0.45, 'rgba(255, 47, 142, 0.18)');
  sun.addColorStop(1, 'rgba(139, 92, 255, 0)');
  wctx.fillStyle = sun;
  wctx.fillRect(cx - sunR * 2, horizon - sunR * 2, sunR * 4, sunR * 4);
  wctx.restore();

  wctx.save();
  wctx.beginPath();
  wctx.arc(cx, horizon - sunR * 0.35, sunR, 0, Math.PI * 2);
  wctx.clip();
  const disc = wctx.createLinearGradient(0, horizon - sunR * 1.4, 0, horizon + sunR * 0.7);
  disc.addColorStop(0, '#ffd36b');
  disc.addColorStop(0.55, '#ff5f9e');
  disc.addColorStop(1, '#8b5cff');
  wctx.fillStyle = disc;
  wctx.fillRect(cx - sunR, horizon - sunR * 1.4, sunR * 2, sunR * 2.2);
  wctx.fillStyle = 'rgba(5, 0, 15, 0.85)';
  for (let i = 0; i < 9; i++) {
    const y = horizon - sunR * 0.35 + i * 11;
    wctx.fillRect(cx - sunR, y, sunR * 2, 2 + i * 0.8);
  }
  wctx.restore();

  wctx.save();
  wctx.strokeStyle = 'rgba(255, 47, 142, 0.32)';
  wctx.lineWidth = 1;
  for (let i = -24; i <= 24; i++) {
    wctx.beginPath();
    wctx.moveTo(cx + i * 6, horizon);
    wctx.lineTo(cx + i * 120, view.h + 20);
    wctx.stroke();
  }
  wctx.strokeStyle = 'rgba(139, 92, 255, 0.28)';
  const scroll = (t * 0.55) % 1;
  for (let i = 0; i < 18; i++) {
    const z = (i + scroll) / 18;
    const y = horizon + Math.pow(z, 2.4) * (view.h - horizon + 40);
    wctx.globalAlpha = 0.15 + z * 0.4;
    wctx.beginPath();
    wctx.moveTo(0, y);
    wctx.lineTo(view.w, y);
    wctx.stroke();
  }
  wctx.globalAlpha = 1;
  wctx.restore();

  wctx.fillStyle = 'rgba(255, 47, 142, 0.12)';
  wctx.fillRect(0, horizon, view.w, 1);
}

function drawAberration(intensity) {
  const off = (2 + intensity * 4) * dpr;
  const W = worldCanvas.width;
  const H = worldCanvas.height;
  const a = Math.min(0.5, 0.3 * intensity);

  chCtx.setTransform(1, 0, 0, 1, 0, 0);
  chCtx.globalCompositeOperation = 'copy';
  chCtx.drawImage(worldCanvas, 0, 0);
  chCtx.globalCompositeOperation = 'multiply';
  chCtx.fillStyle = '#ff0000';
  chCtx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.drawImage(channelCanvas, off, 0);

  chCtx.globalCompositeOperation = 'copy';
  chCtx.drawImage(worldCanvas, 0, 0);
  chCtx.globalCompositeOperation = 'multiply';
  chCtx.fillStyle = '#0044ff';
  chCtx.fillRect(0, 0, W, H);

  ctx.drawImage(channelCanvas, -off, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawTelemetry() {
  if (!game) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x = 16;
  const y = 146;
  const w = 236;
  const lines = [
    `FPS ${fpsSmooth.toFixed(0)}  FRAME ${frameMsSmooth.toFixed(2)}ms`,
    `ENTITIES ${game.activeEntities()}`,
    `BULLETS ${game.bullets.active}/${game.bullets.size} + ${game.enemyBullets.active}/${game.enemyBullets.size}`,
    `PARTICLES ${game.particles.activeCount}/2400 (${(game.particles.utilization * 100).toFixed(0)}%)`,
    `QT QUERIES ${game.quadtreeQueries}  NODES ${game.quadtreeNodes}`,
    `ENEMIES ${game.enemies.enemies.length}  PADS ${input.padCount}  STATE ${state.toUpperCase()}`
  ];
  const h = 16 + lines.length * 14;
  ctx.fillStyle = 'rgba(3, 10, 18, 0.82)';
  ctx.strokeStyle = 'rgba(70, 244, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, 8);
  else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.font = '10px "SFMono-Regular", Consolas, monospace';
  ctx.textAlign = 'left';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = i === 0 ? '#59ffa8' : i === 4 ? '#ffc857' : '#9db8c7';
    ctx.fillText(lines[i], x + 10, y + 17 + i * 14);
  }
}

function drawStick(stick, hintX, hintY, color, label) {
  const active = stick.active;
  const cx = active ? stick.ox : hintX;
  const cy = active ? stick.oy : hintY;
  const kx = active ? stick.kx : hintX;
  const ky = active ? stick.ky : hintY;
  const baseR = STICK_RADIUS + 12;

  tctx.save();
  tctx.globalCompositeOperation = 'lighter';
  tctx.globalAlpha = active ? 0.85 : 0.3;
  tctx.strokeStyle = color;
  tctx.lineWidth = 2;
  tctx.beginPath();
  tctx.arc(cx, cy, baseR, 0, TAU);
  tctx.stroke();

  tctx.globalAlpha = active ? 0.14 : 0.05;
  tctx.fillStyle = color;
  tctx.beginPath();
  tctx.arc(cx, cy, baseR, 0, TAU);
  tctx.fill();

  tctx.globalAlpha = active ? 0.95 : 0.4;
  tctx.fillStyle = color;
  tctx.beginPath();
  tctx.arc(kx, ky, 25, 0, TAU);
  tctx.fill();

  tctx.globalAlpha = 0.85;
  tctx.fillStyle = '#04010a';
  tctx.beginPath();
  tctx.arc(kx, ky, 15, 0, TAU);
  tctx.fill();
  tctx.restore();

  tctx.save();
  tctx.globalAlpha = active ? 0.85 : 0.4;
  tctx.fillStyle = color;
  tctx.font = '9px "SFMono-Regular", Consolas, monospace';
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.fillText(label, cx, cy - baseR - 12);
  tctx.restore();
}

function drawDashButton() {
  const db = input.getDashButton();
  const player = game ? game.player : null;
  const charges = player ? player.dashCharges : 0;
  const ready = charges > 0;
  const color = ready ? '#46f4ff' : '#ff2f8e';
  const pressed = input.dashBtn.pressed;

  tctx.save();
  tctx.globalCompositeOperation = 'lighter';
  tctx.globalAlpha = pressed ? 1 : 0.9;
  tctx.strokeStyle = color;
  tctx.lineWidth = pressed ? 4 : 2.5;
  tctx.beginPath();
  tctx.arc(db.x, db.y, db.r, 0, TAU);
  tctx.stroke();
  tctx.globalAlpha = pressed ? 0.32 : (ready ? 0.16 : 0.08);
  tctx.fillStyle = color;
  tctx.beginPath();
  tctx.arc(db.x, db.y, db.r, 0, TAU);
  tctx.fill();

  tctx.globalCompositeOperation = 'source-over';
  tctx.globalAlpha = ready ? 1 : 0.55;
  tctx.fillStyle = ready ? '#dffbff' : '#ffd1e6';
  tctx.font = 'bold 11px "SFMono-Regular", Consolas, monospace';
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.fillText('DASH', db.x, db.y - 4);
  tctx.fillStyle = color;
  tctx.font = '10px "SFMono-Regular", Consolas, monospace';
  tctx.fillText(charges > 0 ? `x${charges}` : '--', db.x, db.y + 13);
  tctx.restore();
}

function drawAbilityButtons() {
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

    tctx.save();
    tctx.globalCompositeOperation = 'lighter';
    tctx.globalAlpha = pressed ? 1 : 0.85;
    tctx.strokeStyle = ready ? ab.color : 'rgba(140, 150, 170, 0.55)';
    tctx.lineWidth = pressed ? 4 : 2.5;
    tctx.beginPath();
    tctx.arc(b.x, b.y, b.r, 0, TAU);
    tctx.stroke();

    tctx.globalAlpha = pressed ? 0.34 : (ready ? 0.18 : 0.07);
    tctx.fillStyle = ab.color;
    tctx.beginPath();
    tctx.arc(b.x, b.y, b.r, 0, TAU);
    tctx.fill();

    if (!ready) {
      const frac = clamp(cd / total, 0, 1);
      tctx.globalAlpha = 0.5;
      tctx.strokeStyle = '#04010a';
      tctx.lineWidth = 5;
      tctx.beginPath();
      tctx.arc(b.x, b.y, b.r - 2, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * frac);
      tctx.stroke();
    }
    tctx.restore();

    tctx.save();
    tctx.globalAlpha = ready ? 1 : 0.45;
    tctx.fillStyle = ready ? ab.color : '#8fa0b0';
    tctx.font = 'bold 9px "SFMono-Regular", Consolas, monospace';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.fillText(ab.short, b.x, b.y - 3);
    tctx.font = '9px "SFMono-Regular", Consolas, monospace';
    tctx.fillText(ready ? ab.keyLabel : `${Math.ceil(cd)}s`, b.x, b.y + 10);
    tctx.restore();
  }
}

function drawTouchControls() {
  if (!tctx || !input.usingTouch) return;
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, touchCanvas.width, touchCanvas.height);
  if (state !== 'playing' || !game) return;

  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tctx.globalAlpha = 1;
  drawStick(input.move, 112, view.h - 156, '#46f4ff', 'MOVE');
  drawStick(input.aim, view.w - 210, view.h - 138, '#ff2f8e', 'AIM / FIRE');
  drawDashButton();
  drawAbilityButtons();
  tctx.globalAlpha = 1;
}

function render(now) {
  let camX = view.w * 0.5;
  let camY = view.h * 0.5;
  const renderAlpha = state === 'playing' ? alpha : 1;

  if (game) {
    const cam = game.getCamera(renderAlpha);
    camX = cam.x;
    camY = cam.y;
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, view.w, view.h);
    game.drawWorld(wctx, renderAlpha, camX, camY);
  } else {
    drawMenuBackdrop(now);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#04010a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let shakeX = 0;
  let shakeY = 0;
  if (game) {
    shakeX = game.particles.shakeX * dpr;
    shakeY = game.particles.shakeY * dpr;
  }
  ctx.drawImage(worldCanvas, shakeX, shakeY);

  if (game && game.particles.aberration > 0.02) {
    drawAberration(game.particles.aberration);
  }
  if (game && game.particles.flash > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 47, 142, ${game.particles.flash * 0.4})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (game && telemetry) drawTelemetry();
  drawTouchControls();
}

function frame(now) {
  requestAnimationFrame(frame);
  input.poll();
  handlePadUi();
  let dt = now - lastFrame;
  lastFrame = now;
  if (dt > 250) dt = 250;
  if (dt > 0) {
    frameMsSmooth += (dt - frameMsSmooth) * 0.08;
    fpsSmooth += (1000 / dt - fpsSmooth) * 0.08;
  }

  if (now - lastQualityCheck > 1400) {
    lastQualityCheck = now;
    if (fpsSmooth < 49 && resolutionScale > 0.62) {
      resolutionScale = Math.max(0.62, resolutionScale - 0.1);
      lastQualityDrop = now;
      resize();
    } else if (fpsSmooth > 59 && now - lastQualityDrop > 8000 && resolutionScale < 1) {
      resolutionScale = Math.min(1, resolutionScale + 0.05);
      resize();
    }
  }

  if (state === 'playing' && game && !game.over) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && state === 'playing' && steps < 5) {
      game.update(STEP / 1000);
      accumulator -= STEP;
      steps++;
    }
    if (steps >= 5) accumulator = 0;
    alpha = clamp(accumulator / STEP, 0, 1);
  } else {
    accumulator = 0;
    alpha = 1;
  }

  render(now);
  updateHud(now);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    togglePause();
    return;
  }
  if (e.code === 'KeyF') {
    telemetry = !telemetry;
    toast(`TELEMETRY ${telemetry ? 'ON' : 'OFF'}`);
    return;
  }
  if (e.code === 'Backquote') {
    if (game) {
      game.debugQuadtree = !game.debugQuadtree;
      toast(`QUADTREE DEBUG ${game.debugQuadtree ? 'ON' : 'OFF'}`);
    }
    return;
  }
  if (e.code === 'KeyT') {
    scanlinesOn = !scanlinesOn;
    document.body.classList.toggle('scanlines-off', !scanlinesOn);
    btnScan.classList.toggle('active', scanlinesOn);
    audio.ui();
    toast(`CRT SCANLINES ${scanlinesOn ? 'ON' : 'OFF'}`);
    return;
  }
  if (e.code === 'KeyM') {
    audio.ui();
    const muted = audio.toggleMute();
    btnMute.classList.toggle('active', muted);
    toast(muted ? 'AUDIO MUTED' : 'AUDIO ONLINE');
    return;
  }
  if (state === 'levelup') {
    if (e.code === 'Digit1') chooseDraft(0);
    else if (e.code === 'Digit2') chooseDraft(1);
    else if (e.code === 'Digit3') chooseDraft(2);
    return;
  }
  if (state === 'gameover' && e.code === 'Enter') {
    startGame();
  }
});

el('btn-start').addEventListener('click', startGame);
el('btn-pause').addEventListener('click', togglePause);
el('btn-resume').addEventListener('click', resumeGame);
el('btn-quit').addEventListener('click', abortRun);
el('btn-retry').addEventListener('click', startGame);
el('btn-menu').addEventListener('click', backToMenu);
btnScan.addEventListener('click', () => {
  scanlinesOn = !scanlinesOn;
  document.body.classList.toggle('scanlines-off', !scanlinesOn);
  btnScan.classList.toggle('active', scanlinesOn);
  audio.ui();
  toast(`CRT SCANLINES ${scanlinesOn ? 'ON' : 'OFF'}`);
});
btnMute.addEventListener('click', () => {
  audio.ui();
  const muted = audio.toggleMute();
  btnMute.classList.toggle('active', muted);
  toast(muted ? 'AUDIO MUTED' : 'AUDIO ONLINE');
});

if (btnFull) btnFull.addEventListener('click', toggleFullscreen);
if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  if (btnFull) btnFull.classList.toggle('active', on);
  if (btnFullscreen) btnFullscreen.classList.toggle('active', on);
});

const hangarButtons = document.querySelectorAll('.hangar-btn');
for (let i = 0; i < hangarButtons.length; i++) {
  hangarButtons[i].addEventListener('click', () => {
    const part = hangarButtons[i].dataset.part;
    const dir = Number(hangarButtons[i].dataset.dir) || 1;
    const len = part === 'style' ? SHIP_STYLES.length : part === 'palette' ? SHIP_PALETTES.length : ALLY_PALETTES.length;
    const cfg = save.getShipConfig();
    const current = cfg[part] || 0;
    save.setShip(part, (current + dir + len) % len);
    audio.init();
    audio.resume();
    audio.select();
    refreshHangar();
  });
}

function unlockAudio() {
  audio.init();
  audio.resume();
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') {
    pauseGame();
  } else if (!document.hidden) {
    audio.resume();
    if (document.fullscreenElement && navigator.wakeLock && !wakeLock) {
      navigator.wakeLock.request('screen').then((lock) => { wakeLock = lock; }).catch(() => {});
    }
  }
});

btnScan.classList.toggle('active', scanlinesOn);
refreshMenu();
buildAbilityHud();
refreshHangar();

try {
  if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
    window.__PROTOCOL_SWARM__ = {
      get game() { return game; },
      get state() { return state; },
      get save() { return save; },
      startGame,
      chooseDraft
    };
  }
} catch (err) {
  /* debug hook unavailable */
}

window.addEventListener('gamepadconnected', (e) => {
  toast(`CONTROLLER LINKED // ${(e.gamepad.id || 'PAD').slice(0, 28).toUpperCase()}`);
});
window.addEventListener('gamepaddisconnected', () => {
  toast('CONTROLLER OFFLINE');
});

requestAnimationFrame(frame);
