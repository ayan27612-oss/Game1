import { Game } from './Game.js';
import { AudioSynth } from './engine/AudioSynth.js';
import { SaveData } from './systems/Upgrades.js';
import { Input } from './ui/Input.js';
import { Menu } from './ui/Menu.js';
import { Hud } from './ui/Hud.js';
import { drawTouchControls } from './ui/Touch.js';
import { clamp } from './engine/MathUtils.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const touchCanvas = document.getElementById('touch-layer');
const tctx = touchCanvas ? touchCanvas.getContext('2d') : null;
const worldCanvas = document.createElement('canvas');
const wctx = worldCanvas.getContext('2d', { desynchronized: true });
const channelCanvas = document.createElement('canvas');
const chCtx = channelCanvas.getContext('2d');

const view = { w: window.innerWidth, h: window.innerHeight, dpr: 1 };
const input = new Input(canvas);
const audio = new AudioSynth();
const save = SaveData.load(storage());
let game = null;
let state = 'menu';
let alpha = 1;
let telemetry = false;
let draftChoices = [];
let padDraftIndex = 0;
let resolutionScale = 1;

const STEP = 1000 / 60;
let accumulator = 0;
let lastFrame = performance.now();
let fpsSmooth = 60;
let frameMsSmooth = 16.7;
let lastQualityCheck = 0;
let lastQualityDrop = 0;

const hud = new Hud({
  audio,
  onChoose: (index) => chooseDraft(index),
  onReroll: () => rerollDraft()
});

const menu = new Menu({
  save,
  audio,
  toast: (message) => hud.toast(message),
  onStart: startGame,
  onSettingsChange: (key, value) => applyRuntimeSetting(key, value)
});

function storage() {
  try {
    return window.localStorage;
  } catch (err) {
    return null;
  }
}

audio.setVolumes({
  music: save.settings.music,
  sfx: save.settings.sfx,
  muted: !!save.settings.muted
});

/* ------------------------------------------------------------------ */
/* resolution / quality                                               */
/* ------------------------------------------------------------------ */

function qualityScale() {
  const q = save.settings.quality || 'auto';
  if (q === 'low') return 0.7;
  if (q === 'medium') return 0.85;
  if (q === 'high') return 1;
  return resolutionScale;
}

function resize() {
  const cap = (save.settings.quality === 'low' ? 1.25 : 2);
  const dpr = Math.min(cap, window.devicePixelRatio || 1) * qualityScale();
  view.dpr = dpr;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
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

/* ------------------------------------------------------------------ */
/* boot / lifecycle                                                   */
/* ------------------------------------------------------------------ */

function startGame() {
  audio.init();
  audio.resume();
  audio.ui();
  audio.stopMusic();
  audio.startMusic();
  audio.duckMusic(false);

  menu.hide();
  menu.hideBriefing();
  hud.hideGameOver();
  hud.hidePause();
  hud.hideDraft();
  hud.showHud();
  hud.bossBar.classList.add('hidden');
  hud.bossIntro.classList.add('hidden');
  hud.synergyBanner.classList.add('hidden');
  document.body.classList.remove('low-hp');

  draftChoices = [];
  padDraftIndex = 0;
  state = 'playing';
  accumulator = 0;
  alpha = 1;
  input.reset();

  resolutionScale = 1;
  resize();

  game = new Game({
    view,
    input,
    audio,
    save,
    doctrine: save.doctrine,
    settings: save.settings,
    onLevelUp: handleLevelUp,
    onGameOver: handleGameOver,
    onSynergy: handleSynergy,
    onThreat: handleThreat,
    onBoss: handleBoss
  });

  hud.update(game, state, performance.now());
  hud.toast(`PROTOCOL INITIALIZED // ${game.doctrine.name}`);
}

function handleLevelUp() {
  if (!game) return;
  state = 'levelup';
  padDraftIndex = 0;
  input.reset();
  audio.duckMusic(true);
  draftChoices = game.createDraft();
  hud.showDraft(game, draftChoices);
  updateDraftPadHighlight();
}

function chooseDraft(index) {
  if (state !== 'levelup' || !game) return;
  const up = draftChoices[index];
  if (!up) return;
  audio.select();
  hud.hideDraft();
  const remaining = game.applyChosen(up.id);
  draftChoices = [];
  if (remaining > 0) {
    state = 'levelup';
    draftChoices = game.createDraft();
    hud.showDraft(game, draftChoices);
    updateDraftPadHighlight();
  } else {
    state = 'playing';
    input.reset();
    accumulator = 0;
    alpha = 1;
    audio.duckMusic(false);
    hud.toast(`${up.name.toUpperCase()} ONLINE`);
  }
}

function rerollDraft() {
  if (state !== 'levelup' || !game) return;
  const choices = game.rerollDraft();
  if (!choices) {
    hud.toast('NO REROLLS REMAINING');
    audio.ui();
    return;
  }
  draftChoices = choices;
  padDraftIndex = 0;
  hud.showDraft(game, draftChoices);
  updateDraftPadHighlight();
  hud.toast(`DRAFT REROLLED // ${game.rerolls} LEFT`);
}

function updateDraftPadHighlight() {
  if (!hud.draftCards) return;
  const cards = hud.draftCards.querySelectorAll('.draft-card');
  for (let i = 0; i < cards.length; i++) {
    cards[i].classList.toggle('pad-active', i === padDraftIndex);
  }
}

function handleSynergy(activated) {
  if (!activated || !activated.length) return;
  for (let i = 0; i < activated.length; i++) hud.showSynergy(activated[i]);
  const names = activated.map((t) => t.name).join(' + ');
  hud.toast(`SYNERGY ONLINE // ${names}`, 2300);
}

function handleThreat(level) {
  hud.toast(`THREAT ESCALATION // LEVEL ${level}`, 2200);
}

function handleBoss(boss) {
  hud.showBossIntro(boss);
  hud.toast(`WARNING // ${boss.name || 'SECTOR GUARDIAN'}`, 2400);
}

function pauseGame() {
  if (state !== 'playing' || !game) return;
  state = 'paused';
  input.reset();
  accumulator = 0;
  audio.ui();
  audio.duckMusic(true);
  hud.showPause(game);
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  accumulator = 0;
  alpha = 1;
  audio.ui();
  audio.duckMusic(false);
  hud.hidePause();
}

function togglePause() {
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
}

function handleGameOver() {
  if (!game) return;
  const previousBest = save.bestScore;
  const earned = game.finalizeRun();
  const isRecord = game.score > previousBest && game.score > 0;
  state = 'gameover';
  audio.stopMusic();
  document.body.classList.remove('low-hp');
  hud.hideDraft();
  hud.hidePause();
  hud.hideHud();
  hud.bossBar.classList.add('hidden');
  hud.showGameOver(game, earned, isRecord);
  menu.refresh();
}

function backToMenu() {
  audio.stopMusic();
  state = 'menu';
  game = null;
  hud.hideHud();
  hud.hideGameOver();
  hud.hidePause();
  hud.hideDraft();
  hud.bossBar.classList.add('hidden');
  hud.bossIntro.classList.add('hidden');
  hud.synergyBanner.classList.add('hidden');
  document.body.classList.remove('low-hp');
  menu.show();
  menu.refresh();
  input.reset();
}

function abortRun() {
  if (game && !game.over) {
    const earned = game.finalizeRun();
    hud.toast(`RUN ABORTED // +${earned} CR SALVAGED`, 2300);
  }
  backToMenu();
}

/* ------------------------------------------------------------------ */
/* settings shortcuts                                                 */
/* ------------------------------------------------------------------ */

function applyRuntimeSetting(key) {
  menu.applySettings(false);
  syncAudioButtons();
  const settings = save.settings;
  if (game) {
    game.settings = settings;
    if (game.particles) {
      game.particles.shakeScale = settings.screenShake === false ? 0 : 1;
      game.particles.fxScale = settings.reducedMotion ? 0.25 : 1;
    }
  }
  if (key === 'quality') {
    resolutionScale = 1;
    lastQualityDrop = 0;
    resize();
    hud.toast(`RENDER QUALITY // ${String(settings.quality).toUpperCase()}`);
  }
}

function toggleScanlines() {
  const value = save.settings.scanlines === false;
  save.setSetting('scanlines', value);
  applyRuntimeSetting('scanlines');
  hud.toast(`CRT SCANLINES ${value ? 'ON' : 'OFF'}`);
}

function toggleMute() {
  const value = !save.settings.muted;
  save.setSetting('muted', value);
  audio.init();
  audio.resume();
  audio.setMuted(value);
  applyRuntimeSetting('muted');
  hud.toast(value ? 'AUDIO MUTED' : 'AUDIO ONLINE');
}

function syncAudioButtons() {
  const settings = save.settings;
  const muted = !!settings.muted;
  const scan = settings.scanlines !== false;
  const btnMute = document.getElementById('btn-mute');
  const btnScan = document.getElementById('btn-scan');
  const btnPauseMute = document.getElementById('btn-pause-mute');
  const btnPauseScan = document.getElementById('btn-pause-scan');
  if (btnMute) btnMute.classList.toggle('active', muted);
  if (btnScan) btnScan.classList.toggle('active', scan);
  if (btnPauseMute) btnPauseMute.classList.toggle('active', muted);
  if (btnPauseScan) btnPauseScan.classList.toggle('active', scan);
}

/* ------------------------------------------------------------------ */
/* UI wiring                                                          */
/* ------------------------------------------------------------------ */

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', abortRun);
document.getElementById('btn-menu').addEventListener('click', backToMenu);
document.getElementById('btn-pause-mute').addEventListener('click', toggleMute);
document.getElementById('btn-pause-scan').addEventListener('click', toggleScanlines);
document.getElementById('btn-scan').addEventListener('click', toggleScanlines);
document.getElementById('btn-mute').addEventListener('click', toggleMute);

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('pointerup', () => audio.select());
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const tag = e.target && e.target.tagName;
  const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (!typing) {
      if (!document.getElementById('briefing').classList.contains('hidden')) {
        menu.hideBriefing();
        e.preventDefault();
        return;
      }
      if (state === 'playing' || state === 'paused') {
        e.preventDefault();
        togglePause();
      }
    }
    return;
  }

  if (typing) return;

  if (e.code === 'KeyF') {
    telemetry = !telemetry;
    hud.toast(`TELEMETRY ${telemetry ? 'ON' : 'OFF'}`);
    return;
  }
  if (e.code === 'Backquote') {
    if (game) {
      game.debugQuadtree = !game.debugQuadtree;
      hud.toast(`QUADTREE DEBUG ${game.debugQuadtree ? 'ON' : 'OFF'}`);
    }
    return;
  }
  if (e.code === 'KeyT') { toggleScanlines(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }

  if (state === 'levelup') {
    if (e.code === 'Digit1') chooseDraft(0);
    else if (e.code === 'Digit2') chooseDraft(1);
    else if (e.code === 'Digit3') chooseDraft(2);
    else if (e.code === 'Digit4') rerollDraft();
    return;
  }
  if (state === 'gameover' && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    startGame();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') {
    pauseGame();
  } else if (!document.hidden) {
    audio.resume();
  }
});

function unlockAudio() {
  audio.init();
  audio.resume();
}
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

/* ------------------------------------------------------------------ */
/* gamepad UI navigation                                              */
/* ------------------------------------------------------------------ */

function handlePadUi() {
  const ui = input.padUi;
  if (!ui) return;
  if (ui.start) {
    if (state === 'menu') menu.requestStart();
    else if (state === 'gameover') startGame();
    else if (state === 'playing' || state === 'paused') togglePause();
    else if (state === 'levelup') { /* keep drafting */ }
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
  if (ui.confirm && (state === 'menu' || state === 'gameover')) {
    if (state === 'menu') menu.requestStart();
    else startGame();
  }
}

/* ------------------------------------------------------------------ */
/* rendering                                                          */
/* ------------------------------------------------------------------ */

function drawMenuBackdrop(now) {
  const t = now * 0.001;
  const dpr = view.dpr;
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
  const dpr = view.dpr;
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
  const dpr = view.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x = 16;
  const y = 146;
  const w = 260;
  const lines = [
    `FPS ${fpsSmooth.toFixed(0)}  FRAME ${frameMsSmooth.toFixed(2)}ms  SCALE ${view.dpr.toFixed(2)}`,
    `ENTITIES ${game.activeEntities()}`,
    `BULLETS ${game.bullets.active}/${game.bullets.size} + ${game.enemyBullets.active}/${game.enemyBullets.size}`,
    `PARTICLES ${game.particles.activeCount}/2400 (${(game.particles.utilization * 100).toFixed(0)}%)`,
    `QT QUERIES ${game.quadtreeQueries}  NODES ${game.quadtreeNodes}`,
    `THREAT ${game.threat}  COMBO ${game.combo}  REROLLS ${game.rerolls}`,
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

function render(now) {
  let camX = view.w * 0.5;
  let camY = view.h * 0.5;
  const renderAlpha = state === 'playing' ? alpha : 1;

  if (game) {
    const cam = game.getCamera(renderAlpha);
    camX = cam.x;
    camY = cam.y;
    wctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
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
    shakeX = game.particles.shakeX * view.dpr;
    shakeY = game.particles.shakeY * view.dpr;
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
  drawTouchControls(tctx, touchCanvas, input, game, state, view.dpr, view);
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
    if (save.settings.quality === 'auto') {
      if (fpsSmooth < 49 && resolutionScale > 0.62) {
        resolutionScale = Math.max(0.62, resolutionScale - 0.1);
        lastQualityDrop = now;
        resize();
      } else if (fpsSmooth > 59 && now - lastQualityDrop > 8000 && resolutionScale < 1) {
        resolutionScale = Math.min(1, resolutionScale + 0.05);
        resize();
      }
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
  if (game && state !== 'menu' && state !== 'gameover') hud.update(game, state, now);
}

/* ------------------------------------------------------------------ */
/* debug / PWA                                                        */
/* ------------------------------------------------------------------ */

try {
  if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
    window.__PROTOCOL_SWARM__ = {
      get game() { return game; },
      get state() { return state; },
      get save() { return save; },
      get menu() { return menu; },
      get hud() { return hud; },
      startGame,
      chooseDraft,
      rerollDraft,
      toggleMute,
      togglePause,
      renderer: { canvas, ctx, view }
    };
  }
} catch (err) {
  /* debug hook unavailable */
}

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

syncAudioButtons();
menu.show();
requestAnimationFrame(frame);
