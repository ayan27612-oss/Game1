import { CAM_TILT, screenDirToWorld } from '../engine/Projection.js';
import { clamp } from '../engine/MathUtils.js';

function isGamepadHostile() {
  try {
    if (navigator.webdriver) return true;
    if (/HeadlessChrome/i.test(navigator.userAgent || '')) return true;
    return new URLSearchParams(location.search).has('nogamepad');
  } catch (err) {
    return true;
  }
}

const TOUCH_DEADZONE = 0.15;
export const STICK_RADIUS = 72;

/** Logical 1280x720 touch layout. The touch canvas draws exactly these. */
export const TOUCH_LAYOUT = {
  fire: { id: 'fire', x: 1176, y: 604, r: 78, label: 'FIRE' },
  missile: { id: 'missile', x: 1036, y: 650, r: 56, label: 'MSL' },
  dash: { id: 'dash', x: 1120, y: 460, r: 62, label: 'DASH' },
  swap: { id: 'swap', x: 996, y: 516, r: 52, label: 'SWAP' },
  stick: { id: 'stick', x: 190, y: 600, r: 90, label: 'MOVE' }
};

function makeStick() {
  return { id: null, active: false, ox: 0, oy: 0, kx: 0, ky: 0, vx: 0, vy: 0, strength: 0 };
}

/**
 * Unified keyboard / mouse / touch / gamepad input. Gameplay code consumes
 * semantic actions: movement, aim, trigger, dash, missile, weapon selection.
 */
export class Input {
  constructor(target, view) {
    this.target = target;
    this.view = view || { w: 1280, h: 720 };
    this.keys = new Set();
    this.mouse = { x: this.view.w * 0.5, y: this.view.h * 0.5, down: false };
    this.dashQueued = false;
    this.missileQueued = false;
    this.weaponQueued = null;
    this.usingTouch = false;
    this.usingPad = false;
    this.move = makeStick();
    this.aim = makeStick();
    this.fireHeld = false;
    this.firePointer = null;
    this.pressed = { fire: false, missile: false, dash: false, swap: false };
    this.padIndex = -1;
    this.padCount = 0;
    this.padLX = 0;
    this.padLY = 0;
    this.padRX = 0;
    this.padRY = 0;
    this.padFire = false;
    this.padPrev = [];
    this.padUi = { start: false, confirm: false, left: false, right: false };
    this.gamepadEnabled = false;
    this.padLastPoll = 0;
    this.gamepadDisabled = isGamepadHostile();

    if (!this.gamepadDisabled) {
      window.addEventListener('gamepadconnected', () => {
        this.gamepadEnabled = true;
      });
      window.addEventListener('gamepaddisconnected', () => {
        this.gamepadEnabled = false;
        this.padUi = { start: false, confirm: false, left: false, right: false };
      });
    }

    target.addEventListener('mousemove', (e) => {
      if (this.usingTouch) return;
      this.usingPad = false;
      const p = this._point(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    target.addEventListener('mousedown', (e) => {
      if (this.usingTouch) return;
      this.usingPad = false;
      if (e.button === 0) this.mouse.down = true;
      const p = this._point(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());

    target.addEventListener('pointerdown', (e) => this._pointerDown(e));
    target.addEventListener('pointermove', (e) => this._pointerMove(e));
    window.addEventListener('pointerup', (e) => this._pointerUp(e));
    window.addEventListener('pointercancel', (e) => this._pointerUp(e));

    window.addEventListener('keydown', (e) => this._keyDown(e));
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.keys.clear();
    this.mouse.down = false;
    this._resetStick(this.move);
    this._resetStick(this.aim);
    this.fireHeld = false;
    this.firePointer = null;
    this.pressed = { fire: false, missile: false, dash: false, swap: false };
    this.dashQueued = false;
    this.missileQueued = false;
    this.weaponQueued = null;
  }

  _point(e) {
    const rect = this.target.getBoundingClientRect();
    const w = rect.width || this.view.w;
    const h = rect.height || this.view.h;
    return {
      x: ((e.clientX - rect.left) / w) * this.view.w,
      y: ((e.clientY - rect.top) / h) * this.view.h
    };
  }

  getActionButtons() {
    return [TOUCH_LAYOUT.swap, TOUCH_LAYOUT.dash, TOUCH_LAYOUT.missile, TOUCH_LAYOUT.fire];
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

    const p = this._point(e);
    const buttons = this.getActionButtons();
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (Math.hypot(p.x - b.x, p.y - b.y) > b.r * 1.16) continue;
      this.pressed[b.id] = true;
      if (b.id === 'fire') {
        this.fireHeld = true;
        this.firePointer = e.pointerId;
      } else if (b.id === 'missile') {
        this.missileQueued = true;
      } else if (b.id === 'dash') {
        this.dashQueued = true;
      } else if (b.id === 'swap') {
        this.weaponQueued = 'cycle';
      }
      return;
    }

    if (p.x < this.view.w * 0.54) {
      if (this.move.id === null) this._startStick(this.move, e.pointerId, p.x, p.y);
    } else if (this.aim.id === null) {
      this._startStick(this.aim, e.pointerId, p.x, p.y);
    }
  }

  _pointerMove(e) {
    if (e.pointerType === 'mouse') return;
    if (this.firePointer === e.pointerId) return;
    const p = this._point(e);
    if (this.move.id === e.pointerId) this._updateStick(this.move, p.x, p.y);
    else if (this.aim.id === e.pointerId) this._updateStick(this.aim, p.x, p.y);
  }

  _pointerUp(e) {
    if (e.pointerType === 'mouse') return;
    if (this.move.id === e.pointerId) this._resetStick(this.move);
    if (this.aim.id === e.pointerId) this._resetStick(this.aim);
    if (this.firePointer === e.pointerId) {
      this.firePointer = null;
      this.fireHeld = false;
      this.pressed.fire = false;
    }
    this.pressed.missile = false;
    this.pressed.dash = false;
    this.pressed.swap = false;
  }

  _startStick(stick, id, x, y) {
    stick.id = id;
    stick.active = true;
    stick.ox = x;
    stick.oy = y;
    stick.kx = x;
    stick.ky = y;
    stick.vx = 0;
    stick.vy = 0;
    stick.strength = 0;
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

  _keyDown(e) {
    const wasDown = this.keys.has(e.code);
    this.keys.add(e.code);
    if (e.repeat || wasDown) return;

    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      this.dashQueued = true;
    } else if (e.code === 'KeyR') {
      this.missileQueued = true;
    } else if (e.code === 'KeyQ') {
      this.weaponQueued = 'cycle';
    } else if (e.code === 'KeyE') {
      this.weaponQueued = 'cycle';
    } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' ||
      e.code === 'Digit4' || e.code === 'Digit5') {
      this.weaponQueued = Number(e.code.slice(5)) - 1;
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  poll() {
    if (this.gamepadDisabled || !this.gamepadEnabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.padLastPoll < 50) return;
    this.padLastPoll = now;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let count = 0;
    let lx = 0;
    let ly = 0;
    let rx = 0;
    let ry = 0;
    let fire = false;
    let dash = false;
    let missile = false;
    let swap = false;
    let start = false;
    let confirm = false;
    let left = false;
    let right = false;
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
      if (edge(1)) missile = true;
      if (edge(2)) swap = true;
      if (pressed(7) || pressed(5) || pressed(6)) fire = true;

      for (let n = 0; n < buttons.length; n++) states[n] = pressed(n);
      nextPrev[i] = states;
    }

    this.padCount = count;
    this.padPrev = nextPrev;
    this.padUi = { start, confirm, left, right };
    if (count > 0 && (fire || dash || missile || swap || start || confirm || left || right ||
      Math.abs(lx) > 0.18 || Math.abs(ly) > 0.18 ||
      Math.abs(rx) > 0.18 || Math.abs(ry) > 0.18)) {
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
    if (missile) this.missileQueued = true;
    if (swap) this.weaponQueued = 'cycle';
  }

  getMove() {
    let x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    let y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) -
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
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

  isFiring() {
    return this.mouse.down || this.padFire || this.fireHeld;
  }

  consumeDash() {
    if (!this.dashQueued) return false;
    this.dashQueued = false;
    return true;
  }

  consumeMissile() {
    if (!this.missileQueued) return false;
    this.missileQueued = false;
    return true;
  }

  consumeWeapon() {
    if (this.weaponQueued == null) return null;
    const value = this.weaponQueued;
    this.weaponQueued = null;
    return value;
  }
}
