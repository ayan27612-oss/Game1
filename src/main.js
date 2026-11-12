import { Game } from './Game.js';
import { AudioSynth } from './engine/AudioSynth.js';
import { SaveData } from './systems/Upgrades.js';
import { Input } from './ui/Input.js';
import { Menu } from './ui/Menu.js';
import { Hud } from './ui/Hud.js';
import { drawTouchControls } from './ui/Touch.js';
import { clamp } from './engine/MathUtils.js';

/* ------------------------------------------------------------------ */
/* fixed 16:9 stage                                                   */
/* ------------------------------------------------------------------ */

const STAGE_W = 1280;
const STAGE_H = 720;
const STAGE_MAX_W = 1600;
const STAGE_MAX_H = 900;

const shell = document.getElementById('shell');
const app = document.getElementById('app');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const touchCanvas = document.getElementById('touch-layer');
const tctx = touchCanvas ? touchCanvas.getContext('2d') : null;
const worldCanvas = document.createElement('canvas');
const wctx = worldCanvas.getContext('2d', { desynchronized: true });
const channelCanvas = document.createElement('canvas');
const chCtx = channelCanvas.getContext('2d');

const view = { w: STAGE_W, h: STAGE_H, dpr: 1 };
const input = new Input(canvas, view);
const audio = new AudioSynth();
const save = SaveData.load(storage());

let game = null;
let state = 'menu';
let alpha = 1;
let telemetry = false;
let resolutionScale = 1;

const STEP = 1000 / 60;
let accumulator = 0;
let lastFrame = performance.now();
let fpsSmooth = 60;
let frameMsSmooth = 16.7;
let lastQualityCheck = 0;
let lastQualityDrop = 0;

const hud = new Hud({ audio });

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
  const vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || STAGE_W);
  const vh = Math.max(1, window.innerHeight || document.documentElement.clientHeight || STAGE_H);

  // Letterbox a locked 16:9 stage inside the window, capped at 1600x900.
  let stageScale = Math.min(vw / STAGE_W, vh / STAGE_H, STAGE_MAX_W / STAGE_W);
  stageScale = Math.max(0.16, stageScale);
  const stageW = Math.max(1, Math.floor(STAGE_W * stageScale));
  const stageH = Math.max(1, Math.round(stageW * (STAGE_H / STAGE_W)));

  app.style.width = `${stageW}px`;
  app.style.height = `${stageH}px`;
  // 1em === 10 logical pixels on the 1280x720 render target.
  app.style.fontSize = `${stageW / 128}px`;

  const dprCap = save.settings.quality === 'low' ? 1.25 : 2;
  const pixelRatio = Math.min(dprCap, window.devicePixelRatio || 1) * qualityScale();
  const backingW = Math.max(1, Math.floor(stageW * pixelRatio));
  const backingH = Math.max(1, Math.round(backingW * (STAGE_H / STAGE_W)));

  view.dpr = backingW / STAGE_W;
  canvas.width = backingW;
  canvas.height = backingH;
  worldCanvas.width = backingW;
  worldCanvas.height = backingH;
  channelCanvas.width = backingW;
  channelCanvas.height = backingH;
  if (touchCanvas) {
    touchCanvas.width = backingW;
    touchCanvas.height = backingH;
  }
  ctx.imageSmoothingEnabled = true;
  if (game) game._clampCamera();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
}
resize();

/* ------------------------------------------------------------------ */
/* boot / lifecycle                                                   */
/* ------------------------------------------------------------------ */

function requestImmersive() {
  const root = document.documentElement;
  if (!document.fullscreenElement && root && root.requestFullscreen) {
    root.requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        if (screen.orientation && screen.orientation.lock) {
          return screen.orientation.lock('landscape').catch(() => {});
        }
        return null;
      })
      .catch(() => {});
  } else if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

function startGame() {
  audio.init();
  audio.resume();
  audio.ui();
  audio.stopMusic();
  audio.startMusic();
  audio.duckMusic(false);

  menu.hide();
  menu.hideBriefing();
  hud.hideAllGameplayOverlays();
  hud.showHud();
  document.body.classList.remove('low-hp');

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
    mark: save.mark,
    settings: save.settings,
    onGameOver: handleGameOver,
    onThreat: handleThreat,
    onBoss: handleBoss
  });

  requestImmersive();

  hud.update(game, state, performance.now());
  hud.toast(`SUIT ONLINE // ${game.mark.name}`, 2200);
}

function handleThreat(level) {
  hud.toast(`THREAT ESCALATION // LEVEL ${level}`, 2200);
}

function handleBoss(boss) {
  hud.showBossIntro(boss);
  hud.toast(`WARNING // ${boss.name || 'HEAVY UNIT'}`, 2400);
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
  hud.hidePause();
  hud.hideHud();
  if (hud.bossBar) hud.bossBar.classList.add('hidden');
  hud.showGameOver(game, earned, isRecord);
  menu.refresh();
}

function backToMenu() {
  audio.stopMusic();
  state = 'menu';
  game = null;
  hud.hideHud();
  hud.hideAllGameplayOverlays();
  document.body.classList.remove('low-hp');
  menu.show();
  menu.refresh();
  input.reset();
}

function abortRun() {
  if (game && !game.finalized) {
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

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const tag = e.target && e.target.tagName;
  const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (typing) return;
    const briefing = document.getElementById('briefing');
    if (briefing && !briefing.classList.contains('hidden')) {
      menu.hideBriefing();
      e.preventDefault();
      return;
    }
    if (state === 'playing' || state === 'paused') {
      e.preventDefault();
      togglePause();
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
    else if (state === 'playing' || state === 'paused') togglePause();
    else if (state === 'gameover') startGame();
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
  const w = view.w;
  const h = view.h;

  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sky = wctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#04060b');
  sky.addColorStop(0.52, '#0a101c');
  sky.addColorStop(1, '#1a100c');
  wctx.fillStyle = sky;
  wctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const horizon = h * 0.64;
  const sunR = Math.min(w, h) * 0.22;

  // Arc-reactor halo.
  wctx.save();
  wctx.globalCompositeOperation = 'lighter';
  const halo = wctx.createRadialGradient(cx, horizon - sunR * 0.35, 8, cx, horizon - sunR * 0.35, sunR * 2);
  halo.addColorStop(0, 'rgba(216, 251, 255, 0.5)');
  halo.addColorStop(0.32, 'rgba(143, 232, 255, 0.16)');
  halo.addColorStop(0.62, 'rgba(255, 183, 71, 0.1)');
  halo.addColorStop(1, 'rgba(181, 18, 27, 0)');
  wctx.fillStyle = halo;
  wctx.fillRect(cx - sunR * 2.4, horizon - sunR * 2.4, sunR * 4.8, sunR * 4.8);
  wctx.restore();

  // Gold reactor disc behind the skyline.
  wctx.save();
  wctx.beginPath();
  wctx.arc(cx, horizon - sunR * 0.35, sunR, 0, Math.PI * 2);
  wctx.clip();
  const disc = wctx.createLinearGradient(0, horizon - sunR * 1.4, 0, horizon + sunR * 0.7);
  disc.addColorStop(0, '#fff6c6');
  disc.addColorStop(0.5, '#ffb347');
  disc.addColorStop(1, '#b5121b');
  wctx.fillStyle = disc;
  wctx.fillRect(cx - sunR, horizon - sunR * 1.4, sunR * 2, sunR * 2.2);
  wctx.fillStyle = 'rgba(5, 7, 13, 0.82)';
  for (let i = 0; i < 9; i++) {
    const y = horizon - sunR * 0.35 + i * 11;
    wctx.fillRect(cx - sunR, y, sunR * 2, 2 + i * 0.8);
  }
  wctx.restore();

  // Perspective hangar grid.
  wctx.save();
  wctx.strokeStyle = 'rgba(255, 183, 71, 0.26)';
  wctx.lineWidth = 1;
  for (let i = -24; i <= 24; i++) {
    wctx.beginPath();
    wctx.moveTo(cx + i * 6, horizon);
    wctx.lineTo(cx + i * 120, h + 20);
    wctx.stroke();
  }
  wctx.strokeStyle = 'rgba(143, 232, 255, 0.22)';
  const scroll = (t * 0.55) % 1;
  for (let i = 0; i < 18; i++) {
    const z = (i + scroll) / 18;
    const y = horizon + Math.pow(z, 2.4) * (h - horizon + 40);
    wctx.globalAlpha = 0.12 + z * 0.34;
    wctx.beginPath();
    wctx.moveTo(0, y);
    wctx.lineTo(w, y);
    wctx.stroke();
  }
  wctx.globalAlpha = 1;
  wctx.restore();

  wctx.fillStyle = 'rgba(255, 183, 71, 0.16)';
  wctx.fillRect(0, horizon, w, 1);

  // Distant Stark tower silhouette.
  wctx.save();
  wctx.fillStyle = 'rgba(4, 6, 11, 0.72)';
  const baseY = horizon + 2;
  const towers = [
    [cx - 250, 46, 120],
    [cx - 160, 68, 90],
    [cx - 40, 54, 150],
    [cx + 70, 80, 70],
    [cx + 160, 40, 110],
    [cx + 240, 58, 60]
  ];
  for (let i = 0; i < towers.length; i++) {
    const [x, tw, th] = towers[i];
    wctx.fillRect(x - tw * 0.5, baseY - th, tw, th);
    wctx.fillStyle = i % 2 ? 'rgba(143, 232, 255, 0.5)' : 'rgba(255, 183, 71, 0.55)';
    wctx.fillRect(x - 1, baseY - th - 6, 2, 6);
    wctx.fillStyle = 'rgba(4, 6, 11, 0.72)';
  }
  wctx.restore();
}

function drawAberration(intensity) {
  const off = (2 + intensity * 4) * view.dpr;
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
  const w = 304;
  const lines = [
    `FPS ${fpsSmooth.toFixed(0)}  FRAME ${frameMsSmooth.toFixed(2)}ms  SCALE ${view.dpr.toFixed(2)}`,
    `ENTITIES ${game.activeEntities()}`,
    `BULLETS ${game.bullets.active}/${game.bullets.size} + ${game.enemyBullets.active}/${game.enemyBullets.size}`,
    `PARTICLES ${game.particles.activeCount}/2400 (${(game.particles.utilization * 100).toFixed(0)}%)`,
    `QT QUERIES ${game.quadtreeQueries}  NODES ${game.quadtreeNodes}`,
    `THREAT ${game.threat}  COMBO ${game.combo}  BEST ${game.comboBest}`,
    `MARK ${game.mark.name}  WEAPON ${game.player.weapon.name}`,
    `ENEMIES ${game.enemies.enemies.length}  PADS ${input.padCount}  STATE ${state.toUpperCase()}`
  ];
  const h = 16 + lines.length * 14;
  ctx.fillStyle = 'rgba(4, 6, 11, 0.82)';
  ctx.strokeStyle = 'rgba(255, 183, 71, 0.35)';
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
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
    game.drawWorld(wctx, renderAlpha, camX, camY);
  } else {
    drawMenuBackdrop(now);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#04060b';
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
    ctx.fillStyle = `rgba(255, 183, 71, ${game.particles.flash * 0.34})`;
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
    window.__PROTOCOL_WARFORGE__ = {
      get game() { return game; },
      get state() { return state; },
      get save() { return save; },
      get menu() { return menu; },
      get hud() { return hud; },
      startGame,
      pauseGame,
      resumeGame,
      abortRun,
      backToMenu,
      toggleMute,
      togglePause,
      requestImmersive,
      renderer: { canvas, ctx, view, app, shell }
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
