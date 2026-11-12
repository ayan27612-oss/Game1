import { midiToFreq } from './MathUtils.js';

const BASS_PATTERN = [
  33, 0, 33, 0, 40, 0, 33, 0,
  36, 0, 36, 0, 43, 0, 36, 0,
  33, 0, 33, 0, 40, 0, 33, 0,
  38, 0, 38, 0, 36, 0, 31, 0
];

const LEAD_PATTERN = [
  69, 72, 76, 72, 69, 72, 76, 79,
  74, 72, 69, 67, 69, 72, 76, 72,
  69, 72, 76, 72, 76, 74, 72, 69,
  67, 69, 72, 74, 76, 79, 81, 79
];

export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.leadBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicVolume = 0.34;
    this.sfxVolume = 0.9;
    this.musicPlaying = false;
    this.timer = null;
    this.nextTime = 0;
    this.step = 0;
    this.lowHp = false;
    this.bpm = 104;
    this.lastHit = 0;
    this.lastLaser = 0;
    this.lastZap = 0;
    this.lastDeflect = 0;
    this.lastExplosion = 0;
    this.lastImpact = 0;
    this.lastUi = 0;
    this.lastWave = 0;
    this.lastWarning = 0;
    this.lastEnemyShot = 0;
    this.lastRepulsor = 0;
    this.lastMinigun = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 26;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    this.leadBus = ctx.createGain();
    this.leadBus.gain.value = 0.75;
    this.leadBus.connect(this.musicBus);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    const delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.245;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.24;
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    this.leadBus.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.musicBus);

    const len = Math.floor(ctx.sampleRate * 1.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, t + 0.08);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolumes({ music, sfx, muted } = {}) {
    if (Number.isFinite(music)) this.musicVolume = Math.max(0, Math.min(1, music)) * 0.6;
    if (Number.isFinite(sfx)) this.sfxVolume = Math.max(0, Math.min(1, sfx));
    if (typeof muted === 'boolean') this.muted = muted;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.master) {
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.55, t + 0.08);
    }
    if (this.musicBus && !this.musicPlaying) {
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.linearRampToValueAtTime(this.musicVolume, t + 0.08);
    }
    if (this.sfxBus) {
      this.sfxBus.gain.cancelScheduledValues(t);
      this.sfxBus.gain.linearRampToValueAtTime(this.sfxVolume, t + 0.08);
    }
  }

  setLowHP(low) {
    if (this.lowHp === low) return;
    this.lowHp = low;
    this.bpm = low ? 148 : 104;
  }

  duckMusic(paused) {
    if (!this.ctx || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.linearRampToValueAtTime(this.musicVolume * (paused ? 0.24 : 1), t + 0.15);
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicPlaying) return;
    this.resume();
    this.musicPlaying = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._scheduler(), 25);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _scheduler() {
    if (!this.ctx || !this.musicPlaying) return;
    const lookahead = this.ctx.currentTime + 0.16;
    let guard = 0;
    while (this.nextTime < lookahead && guard++ < 16) {
      this._scheduleStep(this.step, this.nextTime);
      const stepDur = 60 / this.bpm / 2;
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  _scheduleStep(step, t) {
    const ctx = this.ctx;
    const bassNote = BASS_PATTERN[step];
    const stepDur = 60 / this.bpm / 2;

    if (bassNote > 0) {
      this._tone(midiToFreq(bassNote), 'sawtooth', t, stepDur * 0.86, 0.14, this.musicBus, null, 520);
      this._tone(midiToFreq(bassNote - 12), 'sine', t, stepDur * 0.9, 0.11, this.musicBus);
    }

    if (step % 8 === 0) {
      this._tone(150, 'sine', t, 0.13, 0.26, this.musicBus, 42);
    }
    if (step % 8 === 4) {
      this._noise(t, 0.07, 0.08, 3400, 'highpass', 0.7, this.musicBus);
    }

    const leadNote = LEAD_PATTERN[step];
    if (leadNote > 0) {
      const octave = this.lowHp ? 12 : 0;
      this._tone(
        midiToFreq(leadNote + octave),
        this.lowHp ? 'sawtooth' : 'square',
        t,
        stepDur * 0.48,
        this.lowHp ? 0.045 : 0.055,
        this.leadBus,
        null,
        2200
      );
      if (this.lowHp && step % 2 === 1) {
        this._tone(midiToFreq(leadNote + 24), 'triangle', t, stepDur * 0.24, 0.022, this.leadBus);
      }
    }
  }

  _tone(freq, type, t0, dur, vol, dest, slideTo = null, filterFreq = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (filterFreq > 0) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(120, filterFreq * 0.45), t0 + dur);
      filter.Q.value = 4;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  _noise(t0, dur, vol, freq, type = 'lowpass', q = 1, dest = null) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest || this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  laser() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastLaser < 0.045) return;
    this.lastLaser = now;
    this._tone(1250, 'square', now, 0.075, 0.085, this.sfxBus, 260, 3200);
    this._tone(2200, 'sine', now, 0.04, 0.04, this.sfxBus, 900);
  }

  explosion(big = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!big && now - this.lastExplosion < 0.055) return;
    this.lastExplosion = now;
    this._noise(now, big ? 0.65 : 0.34, big ? 0.42 : 0.24, big ? 900 : 1300, 'lowpass', 0.8);
    this._tone(big ? 90 : 140, 'sine', now, big ? 0.7 : 0.38, big ? 0.35 : 0.2, this.sfxBus, 28);
    if (big) this._tone(58, 'sawtooth', now, 0.8, 0.16, this.sfxBus, 22, 400);
  }

  impact(crit = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastImpact < 0.035) return;
    this.lastImpact = now;
    this._tone(crit ? 620 : 420, 'triangle', now, 0.055, crit ? 0.055 : 0.032, this.sfxBus, crit ? 220 : 150);
  }

  xp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._tone(880, 'sine', now, 0.1, 0.07, this.sfxBus);
    this._tone(1320, 'sine', now + 0.055, 0.13, 0.06, this.sfxBus);
  }

  pickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._tone(620, 'triangle', now, 0.08, 0.08, this.sfxBus, 980);
    this._tone(1240, 'sine', now + 0.06, 0.12, 0.05, this.sfxBus);
  }

  dash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noise(now, 0.22, 0.16, 2600, 'highpass', 0.6);
    this._tone(300, 'sawtooth', now, 0.2, 0.06, this.sfxBus, 1200, 1800);
  }

  hit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.05) return;
    this.lastHit = now;
    this._tone(210, 'square', now, 0.14, 0.14, this.sfxBus, 70, 900);
    this._noise(now, 0.12, 0.11, 1800, 'lowpass', 1);
  }

  deflect() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDeflect < 0.05) return;
    this.lastDeflect = now;
    this._tone(1900, 'triangle', now, 0.09, 0.06, this.sfxBus, 1200);
    this._noise(now, 0.06, 0.05, 5200, 'highpass', 1.2);
  }

  zap() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastZap < 0.08) return;
    this.lastZap = now;
    this._noise(now, 0.16, 0.09, 4200, 'bandpass', 2.5);
    this._tone(1400, 'sawtooth', now, 0.12, 0.045, this.sfxBus, 320);
  }

  overheat() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noise(now, 0.5, 0.2, 1200, 'lowpass', 0.7);
    this._tone(420, 'sawtooth', now, 0.5, 0.1, this.sfxBus, 60, 800);
  }

  boss() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._tone(82, 'sawtooth', now, 1.1, 0.24, this.sfxBus, 41, 520);
    this._tone(123, 'square', now + 0.12, 0.9, 0.09, this.sfxBus, 61, 900);
    this._noise(now, 0.9, 0.12, 500, 'lowpass', 0.7);
  }

  bossDeath() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._tone(220, 'sawtooth', now, 1.6, 0.2, this.sfxBus, 30, 1200);
    this._noise(now, 1.4, 0.32, 1500, 'lowpass', 0.6);
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      this._tone(notes[i], 'sine', now + i * 0.11, 0.4, 0.07, this.sfxBus);
    }
  }

  ui() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastUi < 0.04) return;
    this.lastUi = now;
    this._tone(720, 'square', now, 0.045, 0.045, this.sfxBus, 980, 3200);
    this._tone(1440, 'sine', now + 0.012, 0.05, 0.025, this.sfxBus);
  }

  select() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 987.77, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      this._tone(notes[i], 'triangle', now + i * 0.055, 0.18, 0.07, this.sfxBus);
    }
    this._noise(now, 0.18, 0.05, 4200, 'highpass', 0.9);
  }

  wave() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWave < 0.55) return;
    this.lastWave = now;
    this._noise(now, 0.28, 0.055, 720, 'bandpass', 1.4);
    this._tone(180, 'sine', now, 0.24, 0.05, this.sfxBus, 70);
  }

  warning() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWarning < 0.4) return;
    this.lastWarning = now;
    this._tone(440, 'square', now, 0.2, 0.07, this.sfxBus, 440, 1600);
    this._tone(330, 'square', now + 0.22, 0.24, 0.06, this.sfxBus, 330, 1400);
  }

  enemyShot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastEnemyShot < 0.06) return;
    this.lastEnemyShot = now;
    this._tone(760, 'sawtooth', now, 0.07, 0.03, this.sfxBus, 300, 2200);
  }

  gameOver() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392, 329.63, 261.63, 196];
    for (let i = 0; i < notes.length; i++) {
      this._tone(notes[i], 'sawtooth', now + i * 0.16, 0.5, 0.08, this.sfxBus, null, 1200);
    }
    this._noise(now, 0.7, 0.1, 800, 'lowpass', 0.7);
  }

  /* ------------------------------ Iron Man rack ----------------------------- */

  repulsor() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastRepulsor < 0.032) return;
    this.lastRepulsor = now;
    this._tone(1750, 'sine', now, 0.09, 0.085, this.sfxBus, 520, 5200);
    this._tone(2600, 'triangle', now, 0.05, 0.032, this.sfxBus, 1100);
    this._noise(now, 0.045, 0.03, 6200, 'highpass', 1.2);
  }

  unibeam() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noise(now, 0.32, 0.15, 2400, 'bandpass', 1.6);
    this._tone(940, 'sawtooth', now, 0.3, 0.11, this.sfxBus, 120, 3600);
    this._tone(180, 'sine', now, 0.38, 0.18, this.sfxBus, 52);
    this._tone(1880, 'triangle', now + 0.015, 0.16, 0.05, this.sfxBus, 900);
  }

  microMissiles() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.055;
      this._noise(t, 0.2, 0.08, 2800, 'bandpass', 1.4);
      this._tone(420, 'sawtooth', t, 0.18, 0.04, this.sfxBus, 1500, 2200);
    }
    this._tone(140, 'sine', now, 0.16, 0.08, this.sfxBus, 70);
  }

  arc() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noise(now, 0.2, 0.12, 4800, 'bandpass', 3.2);
    this._tone(1650, 'sawtooth', now, 0.16, 0.055, this.sfxBus, 340, 4200);
    this._tone(820, 'square', now + 0.02, 0.12, 0.035, this.sfxBus, 220);
  }

  scatter() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noise(now, 0.24, 0.2, 1500, 'lowpass', 0.9);
    this._tone(240, 'square', now, 0.22, 0.11, this.sfxBus, 70, 1600);
    this._tone(640, 'triangle', now + 0.012, 0.14, 0.05, this.sfxBus, 180);
  }

  missileBarrage() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.07;
      this._noise(t, 0.26, 0.075, 2200, 'bandpass', 1.5);
      this._tone(300 + i * 40, 'sawtooth', t, 0.22, 0.045, this.sfxBus, 1200, 1800);
    }
    this._tone(120, 'sine', now, 0.22, 0.1, this.sfxBus, 58);
  }

  minigun() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastMinigun < 0.045) return;
    this.lastMinigun = now;
    this._tone(1380, 'triangle', now, 0.045, 0.03, this.sfxBus, 620, 3800);
    this._noise(now, 0.035, 0.028, 5200, 'highpass', 1.1);
  }

  combo() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      this._tone(notes[i], 'triangle', now + i * 0.045, 0.2, 0.06, this.sfxBus);
      this._tone(notes[i] * 2, 'sine', now + i * 0.045, 0.12, 0.02, this.sfxBus);
    }
  }
}
