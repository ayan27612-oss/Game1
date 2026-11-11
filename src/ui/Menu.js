import { META_UNLOCKS, DEFAULT_SETTINGS } from '../systems/Upgrades.js';
import { DOCTRINES, isDoctrineUnlocked } from '../systems/Doctrines.js';
import { SHIP_STYLES, SHIP_PALETTES, ALLY_PALETTES, drawShipBody } from '../systems/Customization.js';
import { formatTime } from '../engine/MathUtils.js';

const el = (id) => document.getElementById(id);

/**
 * Owns the command deck: tabbed menu, doctrine pick, hangar, meta lab,
 * archive, settings, briefing, and fullscreen/wake-lock plumbing.
 */
export class Menu {
  constructor({ save, audio, onStart, toast, onSettingsChange }) {
    this.save = save;
    this.audio = audio;
    this.onStart = onStart;
    this.toast = toast;
    this.onSettingsChange = onSettingsChange || (() => {});

    this.menu = el('menu');
    this.briefing = el('briefing');
    this.doctrineList = el('doctrine-list');
    this.metaShop = el('meta-shop');
    this.menuScores = el('menu-scores');
    this.archiveScores = el('archive-scores');
    this.careerStats = el('career-stats');
    this.archiveCareer = el('archive-career');
    this.menuCurrency = el('menu-currency');
    this.metaBalance = el('meta-balance');
    this.menuBest = el('menu-best');
    this.menuRuns = el('menu-runs');
    this.hangarCanvas = el('hangar-preview');
    this.hangarCtx = this.hangarCanvas ? this.hangarCanvas.getContext('2d') : null;
    this.wakeLock = null;
    this.activeTab = 'deploy';
    this.briefingCloseMode = 'dismiss';

    this._bindTabs();
    this._bindDoctrines();
    this._bindHangar();
    this._bindSettings();
    this._bindBriefing();
    this._bindFullscreen();

    this.applySettings(false);
    this.refresh();
  }

  show() {
    this.menu.classList.remove('hidden');
    this.refresh();
  }

  hide() {
    this.menu.classList.add('hidden');
  }

  isVisible() {
    return !this.menu.classList.contains('hidden');
  }

  switchTab(name) {
    this.activeTab = name;
    const tabs = this.menu.querySelectorAll('.tab');
    for (let i = 0; i < tabs.length; i++) {
      const active = tabs[i].dataset.tab === name;
      tabs[i].classList.toggle('active', active);
      tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    const panels = this.menu.querySelectorAll('.tab-panel');
    for (let i = 0; i < panels.length; i++) {
      panels[i].classList.toggle('active', panels[i].id === `panel-${name}`);
    }
    if (name === 'hangar') this.refreshHangar();
    if (name === 'meta' || name === 'archive') this.refreshCareer();
    this.audio.ui();
  }

  _bindTabs() {
    const tabs = this.menu.querySelectorAll('.tab');
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', () => this.switchTab(tabs[i].dataset.tab));
    }
  }

  _bindDoctrines() {
    if (!this.doctrineList) return;
    this.doctrineList.addEventListener('click', (e) => {
      const card = e.target.closest('.doctrine-card');
      if (!card) return;
      const doctrine = DOCTRINES.find((d) => d.id === card.dataset.id);
      if (!doctrine) return;
      if (!isDoctrineUnlocked(doctrine, this.save)) {
        this.toast(`LOCKED // UNLOCK ${doctrine.unlock.replace(/_/g, ' ').toUpperCase()} IN THE META LAB`);
        this.audio.ui();
        return;
      }
      this.save.setDoctrine(doctrine.id);
      this.audio.select();
      this.renderDoctrines();
    });
  }

  _bindHangar() {
    const buttons = document.querySelectorAll('.hangar-btn');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', () => {
        const part = buttons[i].dataset.part;
        const dir = Number(buttons[i].dataset.dir) || 1;
        const len = part === 'style' ? SHIP_STYLES.length : part === 'palette' ? SHIP_PALETTES.length : ALLY_PALETTES.length;
        const cfg = this.save.getShipConfig();
        const current = cfg[part] || 0;
        this.save.setShip(part, (current + dir + len) % len);
        this.audio.init();
        this.audio.resume();
        this.audio.select();
        this.refreshHangar();
      });
    }

    const callsignInput = el('callsign-input');
    const saveCallsign = () => {
      if (!callsignInput) return;
      this.save.setShip('callsign', callsignInput.value);
      callsignInput.value = this.save.getShipConfig().callsign;
      this.audio.select();
      this.toast('CALLSIGN UPDATED');
      this.refreshHangar();
    };
    if (callsignInput) {
      callsignInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveCallsign();
      });
    }
    const btn = el('btn-save-callsign');
    if (btn) btn.addEventListener('click', saveCallsign);
  }

  _bindSettings() {
    const music = el('set-music');
    const sfx = el('set-sfx');
    const apply = (key, value) => {
      this.save.setSetting(key, value);
      this.applySettings(true);
      this.onSettingsChange(key, value);
    };

    if (music) music.addEventListener('input', () => {
      el('set-music-value').textContent = `${music.value}%`;
      apply('music', Number(music.value) / 100);
    });
    if (sfx) sfx.addEventListener('input', () => {
      el('set-sfx-value').textContent = `${sfx.value}%`;
      apply('sfx', Number(sfx.value) / 100);
    });

    const bindToggle = (id, key) => {
      const input = el(id);
      if (!input) return;
      input.addEventListener('change', () => apply(key, input.checked));
    };
    bindToggle('set-muted', 'muted');
    bindToggle('set-shake', 'screenShake');
    bindToggle('set-numbers', 'damageNumbers');
    bindToggle('set-motion', 'reducedMotion');
    bindToggle('set-scanlines', 'scanlines');

    const quality = el('set-quality');
    if (quality) quality.addEventListener('change', () => apply('quality', quality.value));

    const reset = el('btn-reset-save');
    if (reset) reset.addEventListener('click', () => {
      if (!window.confirm('Reset all progress, credits, unlocks and scores? This cannot be undone.')) return;
      this.save.reset();
      this.applySettings(true);
      this.refresh();
      this.toast('PROGRESS RESET // FRESH PROTOCOL');
      this.audio.ui();
    });
  }

  _bindBriefing() {
    const open = el('btn-briefing');
    if (open) open.addEventListener('click', () => this.showBriefing());
    const close = el('btn-briefing-close');
    if (close) close.addEventListener('click', () => this.hideBriefing());
    const dismiss = el('btn-briefing-dismiss');
    if (dismiss) dismiss.addEventListener('click', () => this.hideBriefing());
    const start = el('btn-briefing-start');
    if (start) start.addEventListener('click', () => {
      this.save.markBriefingSeen();
      this.hideBriefing();
      this.audio.ui();
      this.onStart();
    });
    const startBtn = el('btn-start');
    if (startBtn) startBtn.addEventListener('click', () => this.requestStart());
    const retry = el('btn-retry');
    if (retry) retry.addEventListener('click', () => this.onStart());
  }

  requestStart() {
    this.audio.init();
    this.audio.resume();
    if (!this.save.seenBriefing) {
      this.showBriefing(true);
      return;
    }
    this.onStart();
  }

  showBriefing(fromDeploy = false) {
    this.briefingCloseMode = fromDeploy ? 'deploy' : 'dismiss';
    this.briefing.classList.remove('hidden');
    this.audio.ui();
  }

  hideBriefing() {
    this.briefing.classList.add('hidden');
    this.audio.ui();
  }

  _bindFullscreen() {
    const buttons = [el('btn-full'), el('btn-fullscreen')];
    for (let i = 0; i < buttons.length; i++) {
      if (!buttons[i]) continue;
      buttons[i].addEventListener('click', () => this.toggleFullscreen());
    }
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i]) buttons[i].classList.toggle('active', on);
      }
    });
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const app = el('app');
        if (app && app.requestFullscreen) await app.requestFullscreen({ navigationUI: 'hide' });
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock('landscape'); } catch (err) { /* not supported */ }
        }
        if (navigator.wakeLock && !this.wakeLock) {
          try { this.wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { /* ignore */ }
        }
        this.toast('FULLSCREEN: LANDSCAPE LOCKED');
      } else {
        if (screen.orientation && screen.orientation.unlock) {
          try { screen.orientation.unlock(); } catch (err) { /* ignore */ }
        }
        if (this.wakeLock) {
          try { await this.wakeLock.release(); } catch (err) { /* ignore */ }
          this.wakeLock = null;
        }
        await document.exitFullscreen();
        this.toast('FULLSCREEN OFF');
      }
    } catch (err) {
      this.toast('FULLSCREEN NOT AVAILABLE');
    }
  }

  applySettings(playFeedback = false) {
    const settings = this.save.settings;
    const scanlines = settings.scanlines !== false;
    document.body.classList.toggle('scanlines-off', !scanlines);

    const music = el('set-music');
    const sfx = el('set-sfx');
    const setToggle = (id, value) => {
      const input = el(id);
      if (input) input.checked = !!value;
    };
    if (music) {
      music.value = String(Math.round((settings.music ?? DEFAULT_SETTINGS.music) * 100));
      el('set-music-value').textContent = `${music.value}%`;
    }
    if (sfx) {
      sfx.value = String(Math.round((settings.sfx ?? DEFAULT_SETTINGS.sfx) * 100));
      el('set-sfx-value').textContent = `${sfx.value}%`;
    }
    setToggle('set-muted', settings.muted);
    setToggle('set-shake', settings.screenShake !== false);
    setToggle('set-numbers', settings.damageNumbers !== false);
    setToggle('set-motion', settings.reducedMotion);
    setToggle('set-scanlines', settings.scanlines !== false);
    const quality = el('set-quality');
    if (quality) quality.value = settings.quality || 'auto';

    this.audio.setVolumes({
      music: settings.music,
      sfx: settings.sfx,
      muted: !!settings.muted
    });
    if (playFeedback) this.audio.ui();
  }

  refresh() {
    this.renderDoctrines();
    this.refreshMeta();
    this.refreshScores();
    this.refreshCareer();
    this.refreshHangar();
    this.refreshHeader();
    this.applySettings(false);
  }

  refreshHeader() {
    if (this.menuCurrency) this.menuCurrency.textContent = `${this.save.currency} CR`;
    if (this.metaBalance) this.metaBalance.textContent = `${this.save.currency} CR`;
    if (this.menuBest) this.menuBest.textContent = String(this.save.bestScore);
    if (this.menuRuns) this.menuRuns.textContent = `${this.save.runs} RUNS`;
  }

  renderDoctrines() {
    if (!this.doctrineList) return;
    const selected = this.save.doctrine || 'vanguard';
    this.doctrineList.innerHTML = '';
    for (let i = 0; i < DOCTRINES.length; i++) {
      const d = DOCTRINES[i];
      const unlocked = isDoctrineUnlocked(d, this.save);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'doctrine-card' + (d.id === selected ? ' selected' : '') + (unlocked ? '' : ' locked');
      card.dataset.id = d.id;
      card.style.setProperty('--doc', d.color);
      card.setAttribute('aria-pressed', d.id === selected ? 'true' : 'false');

      const head = document.createElement('div');
      head.className = 'dc-head';
      const icon = document.createElement('span');
      icon.className = 'dc-icon';
      icon.textContent = d.name.slice(0, 1);
      const role = document.createElement('span');
      role.className = 'dc-role';
      role.textContent = d.role;
      head.appendChild(icon);
      head.appendChild(role);

      const name = document.createElement('h4');
      name.textContent = d.name;

      const desc = document.createElement('p');
      desc.textContent = d.desc;

      const bonus = document.createElement('div');
      bonus.className = 'dc-bonus';
      for (let j = 0; j < d.bonus.length; j++) {
        const b = document.createElement('span');
        b.textContent = d.bonus[j];
        bonus.appendChild(b);
      }

      card.appendChild(head);
      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(bonus);

      if (!unlocked) {
        const lock = document.createElement('div');
        lock.className = 'dc-lock';
        lock.textContent = 'LOCKED // META LAB';
        card.appendChild(lock);
      }
      this.doctrineList.appendChild(card);
    }
  }

  refreshMeta() {
    if (!this.metaShop) return;
    this.metaShop.innerHTML = '';
    for (let i = 0; i < META_UNLOCKS.length; i++) {
      const meta = META_UNLOCKS[i];
      const owned = this.save.hasUnlock(meta.id);
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
      buy.className = 'mi-buy' + (owned ? ' owned' : '');
      if (owned) {
        buy.textContent = 'OWNED';
        buy.disabled = true;
      } else {
        buy.textContent = `${meta.cost} CR`;
        buy.disabled = this.save.currency < meta.cost;
        buy.addEventListener('click', () => {
          if (this.save.buyUnlock(meta.id)) {
            this.audio.init();
            this.audio.resume();
            this.audio.pickup();
            this.refresh();
            this.toast(`UNLOCKED: ${meta.name.toUpperCase()}`);
          }
        });
      }
      item.appendChild(info);
      item.appendChild(buy);
      this.metaShop.appendChild(item);
    }
  }

  _scoreList(target, limit) {
    if (!target) return;
    target.innerHTML = '';
    const scores = this.save.highScores.slice(0, limit);
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'NO RUNS LOGGED';
      target.appendChild(li);
      return;
    }
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(i + 1).padStart(2, '0');
      const score = document.createElement('span');
      score.className = 'sc';
      score.textContent = String(s.score).padStart(6, '0');
      const meta = document.createElement('span');
      meta.className = 'meta';
      const doc = String(s.doctrine || 'vanguard').toUpperCase();
      meta.textContent = `${formatTime(s.time)} · LV ${s.level} · ${doc}`;
      li.appendChild(rank);
      li.appendChild(score);
      li.appendChild(meta);
      target.appendChild(li);
    }
  }

  refreshScores() {
    this._scoreList(this.menuScores, 5);
    this._scoreList(this.archiveScores, 20);
  }

  _careerMarkup() {
    const stats = [
      ['RUNS', this.save.runs],
      ['BEST SCORE', this.save.bestScore],
      ['AVERAGE', this.save.averageScore],
      ['BEST LEVEL', this.save.bestLevel],
      ['BEST COMBO', this.save.bestCombo],
      ['TOTAL KILLS', this.save.totalKills],
      ['TIME PLAYED', formatTime(this.save.totalTime)],
      ['CREDITS', this.save.currency]
    ];
    return stats;
  }

  refreshCareer() {
    const render = (target) => {
      if (!target) return;
      target.innerHTML = '';
      const stats = this._careerMarkup();
      for (let i = 0; i < stats.length; i++) {
        const div = document.createElement('div');
        div.className = 'career-stat';
        const label = document.createElement('span');
        label.textContent = stats[i][0];
        const value = document.createElement('b');
        value.textContent = String(stats[i][1]);
        div.appendChild(label);
        div.appendChild(value);
        target.appendChild(div);
      }
    };
    render(this.careerStats);
    render(this.archiveCareer);
    this.refreshHeader();
  }

  refreshHangar() {
    if (!this.hangarCtx) return;
    const cfg = this.save.getShipConfig();
    const style = SHIP_STYLES[cfg.style % SHIP_STYLES.length] || SHIP_STYLES[0];
    const pal = SHIP_PALETTES[cfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
    const ally = ALLY_PALETTES[cfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0];
    const cs = el('hangar-callsign');
    if (cs) cs.textContent = cfg.callsign;
    const styleEl = el('hangar-style');
    const palEl = el('hangar-palette');
    const allyEl = el('hangar-ally');
    if (styleEl) styleEl.textContent = style.name;
    if (palEl) palEl.textContent = pal.name;
    if (allyEl) allyEl.textContent = ally.name;
    const callsignInput = el('callsign-input');
    if (callsignInput && document.activeElement !== callsignInput) callsignInput.value = cfg.callsign;
    this.drawHangarPreview(cfg);
  }

  drawHangarPreview(cfg) {
    const c = this.hangarCtx;
    if (!c) return;
    const canvas = this.hangarCanvas;
    const w = canvas.width;
    const h = canvas.height;
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
    for (let i = 0; i < 11; i++) {
      const y = h * 0.28 + i * i * 1.6;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let i = -7; i <= 7; i++) {
      c.beginPath();
      c.moveTo(w * 0.42 + i * 10, h * 0.28);
      c.lineTo(w * 0.42 + i * 78, h);
      c.stroke();
    }

    const pal = SHIP_PALETTES[cfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
    c.save();
    c.translate(w * 0.4, h * 0.54);
    c.scale(3.1, 3.1);
    c.rotate(-Math.PI * 0.5);
    drawShipBody(c, cfg.style % SHIP_STYLES.length, pal, { pilot: true });
    c.restore();

    const allyPal = ALLY_PALETTES[cfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0];
    c.save();
    c.translate(w * 0.76, h * 0.68);
    c.scale(1.75, 1.75);
    c.rotate(-Math.PI * 0.5);
    drawShipBody(c, (cfg.style + 1) % SHIP_STYLES.length, allyPal, {});
    c.restore();

    c.fillStyle = 'rgba(157, 184, 199, 0.75)';
    c.font = '10px "SFMono-Regular", Consolas, monospace';
    c.textAlign = 'center';
    c.fillText('OPERATOR', w * 0.4, h - 10);
    c.fillText('WINGMAN', w * 0.76, h - 10);
  }
}
