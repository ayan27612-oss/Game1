import { ABILITIES } from '../systems/Abilities.js';
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

const TOUCH_DEADZONE = 0.16;
export const STICK_RADIUS = 58;
export const DASH_BUTTON_RADIUS = 46;

/**
 * Unified keyboard / mouse / touch / gamepad input. The game only consumes
 * semantic actions (move vector, dash edge, ability queue), never raw events.
 */
export class Input {
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
    this.gamepadEnabled = false;
    this.padLastPoll = 0;
    this.gamepadDisabled = isGamepadHostile();

    // Polling the Gamepad API before a device has been announced can be
    // expensive on some embedders and headless runtimes. Wait for the event,
    // then poll normally. Browser automation environments expose a virtual
    // input stack that can make GamepadService enumerate devices unsafely, so
    // they opt out unless a caller explicitly re-enables it.
    if (!this.gamepadDisabled) {
      window.addEventListener('gamepadconnected', () => {
        this.gamepadEnabled = true;
      });
      window.addEventListener('gamepaddisconnected', () => {
        // Re-arm on the next connection event. Calling getGamepads() inside
        // the disconnect callback can be unsafe in embedded runtimes.
        this.gamepadEnabled = false;
        this.padUi = { start: false, confirm: false, left: false, right: false };
      });
    }

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
    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.keys.clear();
    this.mouse.down = false;
    this._resetStick(this.move);
    this._resetStick(this.aim);
    this.dashBtn.id = null;
    this.dashBtn.pressed = false;
    this.abilityHeld = {};
    this.abilityQueued.length = 0;
    this.dashQueued = false;
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
