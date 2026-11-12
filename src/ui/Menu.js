import { META_UNLOCKS, DEFAULT_SETTINGS } from '../systems/Upgrades.js';
import { ARMOR_MARKS, getArmorMark, isArmorMarkUnlocked } from '../systems/Doctrines.js';
import { ARMOR_FRAMES, SHIP_PALETTES, ALLY_PALETTES, drawArmorBody } from '../systems/Customization.js';
import { WEAPONS } from '../systems/Weapons.js';
import { formatTime } from '../engine/MathUtils.js';

const el = (id) => document.getElementById(id);

/**
 * Command deck. Five tabs: deploy, armory, fabricator, archive, settings.
 * There is no drafting, no level and no abilities — the selected armor mark and
 * the five-weapon rack are the entire build, so the deck only manages the mark,
 * cosmetics, permanent unlocks and local records.
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
    this.markList = el('mark-list');
    this.metaShop = el('meta-shop');
    this.menuScores = el('menu-scores');
    this.archiveScores = el('archive-scores');
    this.careerStats = el('career-stats');
    this.archiveCareer = el('archive-career');
    this.menuCurrency = el('menu-currency');
    this.metaBalance = el('meta-balance');
    this.menuBest = el('menu-best');
    this.menuRuns = el('menu-runs');
    this.armoryWeapons = el('armory-weapons');
    this.armoryCanvas = el('hangar-preview');
    this.armoryCtx = this.armoryCanvas ? this.armoryCanvas.getContext('2d') : null;
    this.wakeLock = null;
    this.activeTab = 'deploy';
    this.briefingCloseMode = 'dismiss';

    this._bindTabs();
    this._bindMarks();
    this._bindArmory();
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
    if (name === 'armory') this.refreshArmory();
    if (name === 'fabricator' || name === 'archive') this.refreshCareer();
    this.audio.ui();
  }

  _bindTabs() {
    const tabs = this.menu.querySelectorAll('.tab');
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', () => this.switchTab(tabs[i].dataset.tab));
    }
  }

  _bindMarks() {
    if (!this.markList) return;
    this.markList.addEventListener('click', (e) => {
      const card = e.target.closest('.mark-card');
      if (!card) return;
      const mark = ARMOR_MARKS.find((m) => m.id === card.dataset.id);
      if (!mark) return;
      if (!isArmorMarkUnlocked(mark, this.save)) {
        this.toast(`LOCKED // BUILD ${mark.unlock.replace(/_/g, ' ').toUpperCase()} IN THE FABRICATOR`);
        this.audio.ui();
        return;
      }
      this.save.setMark(mark.id);
      this.audio.select();
      this.renderMarks();
      this.refreshHeader();
    });
  }

  _bindArmory() {
    const buttons = document.querySelectorAll('.hangar-btn');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', () => {
        const part = buttons[i].dataset.part;
        const dir = Number(buttons[i].dataset.dir) || 1;
        const len = part === 'frame' ? ARMOR_FRAMES.length : part === 'palette' ? SHIP_PALETTES.length : ALLY_PALETTES.length;
        const cfg = this.save.getShipConfig();
        const current = cfg[part] || 0;
        this.save.setShip(part, (current + dir + len) % len);
        this.audio.init();
        this.audio.resume();
        this.audio.select();
        this.refreshArmory();
      });
    }

    const callsignInput = el('callsign-input');
    const saveCallsign = () => {
      if (!callsignInput) return;
      this.save.setShip('callsign', callsignInput.value);
      callsignInput.value = this.save.getShipConfig().callsign;
      this.audio.select();
      this.toast('CALLSIGN UPDATED');
      this.refreshArmory();
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
      const label = el('set-music-value');
      if (label) label.textContent = `${music.value}%`;
      apply('music', Number(music.value) / 100);
    });
    if (sfx) sfx.addEventListener('input', () => {
      const label = el('set-sfx-value');
      if (label) label.textContent = `${sfx.value}%`;
      apply('sfx', Number(sfx.value) / 100);
    });

    const bindToggle = (id, key) => {
      const input = el(id);
      if (!input) return;
      input.addEventListener('change', () => apply(key, input.checked));
    };
    bindToggle('set-muted', 'muted');
    bindToggle('set-autofire', 'autoFire');
    bindToggle('set-shake', 'screenShake');
    bindToggle('set-numbers', 'damageNumbers');
    bindToggle('set-motion', 'reducedMotion');
    bindToggle('set-scanlines', 'scanlines');

    const quality = el('set-quality');
    if (quality) quality.addEventListener('change', () => apply('quality', quality.value));

    const reset = el('btn-reset-save');
    if (reset) reset.addEventListener('click', () => {
      if (!window.confirm('Reset all progress, credits, unlocks and records? This cannot be undone.')) return;
      this.save.reset();
      this.applySettings(true);
      this.refresh();
      this.toast('PROGRESS RESET // FRESH FORGE');
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
      window.dispatchEvent(new Event('resize'));
    });
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const root = document.documentElement;
        if (root && root.requestFullscreen) {
          await root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock('landscape'); } catch (err) { /* not supported */ }
        }
        if (navigator.wakeLock && !this.wakeLock) {
          try { this.wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { /* ignore */ }
        }
        this.toast('IMMERSIVE MODE // LANDSCAPE LOCKED');
      } else {
        if (screen.orientation && screen.orientation.unlock) {
          try { screen.orientation.unlock(); } catch (err) { /* ignore */ }
        }
        if (this.wakeLock) {
          try { await this.wakeLock.release(); } catch (err) { /* ignore */ }
          this.wakeLock = null;
        }
        await document.exitFullscreen().catch(() => {});
        this.toast('IMMERSIVE MODE OFF');
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
      const label = el('set-music-value');
      if (label) label.textContent = `${music.value}%`;
    }
    if (sfx) {
      sfx.value = String(Math.round((settings.sfx ?? DEFAULT_SETTINGS.sfx) * 100));
      const label = el('set-sfx-value');
      if (label) label.textContent = `${sfx.value}%`;
    }
    setToggle('set-muted', settings.muted);
    setToggle('set-autofire', settings.autoFire !== false);
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
    this.renderMarks();
    this.refreshMeta();
    this.refreshScores();
    this.refreshCareer();
    this.refreshArmory();
    this.refreshWeapons();
    this.refreshHeader();
    this.applySettings(false);
  }

  refreshHeader() {
    if (this.menuCurrency) this.menuCurrency.textContent = `${this.save.currency} CR`;
    if (this.metaBalance) this.metaBalance.textContent = `${this.save.currency} CR`;
    if (this.menuBest) this.menuBest.textContent = String(this.save.bestScore);
    if (this.menuRuns) this.menuRuns.textContent = `${this.save.runs} RUNS`;
  }

  renderMarks() {
    if (!this.markList) return;
    const selected = this.save.mark || 'mark3';
    this.markList.innerHTML = '';
    for (let i = 0; i < ARMOR_MARKS.length; i++) {
      const mark = ARMOR_MARKS[i];
      const unlocked = isArmorMarkUnlocked(mark, this.save);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mark-card' + (mark.id === selected ? ' selected' : '') + (unlocked ? '' : ' locked');
      card.dataset.id = mark.id;
      card.style.setProperty('--mk', mark.color);
      card.setAttribute('aria-pressed', mark.id === selected ? 'true' : 'false');

      const head = document.createElement('div');
      head.className = 'mk-head';
      const index = document.createElement('span');
      index.className = 'mk-index';
      index.textContent = String(i + 1).padStart(2, '0');
      const role = document.createElement('span');
      role.className = 'mk-role';
      role.textContent = mark.role;
      head.appendChild(index);
      head.appendChild(role);

      const name = document.createElement('h4');
      name.textContent = mark.name;

      const desc = document.createElement('p');
      desc.textContent = mark.desc;

      const bonus = document.createElement('div');
      bonus.className = 'mk-bonus';
      for (let j = 0; j < mark.bonus.length; j++) {
        const b = document.createElement('span');
        b.textContent = mark.bonus[j];
        bonus.appendChild(b);
      }

      card.appendChild(head);
      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(bonus);

      if (!unlocked) {
        const lock = document.createElement('div');
        lock.className = 'mk-lock';
        lock.textContent = 'LOCKED // FABRICATOR';
        card.appendChild(lock);
      }
      this.markList.appendChild(card);
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
      meta.textContent = `${formatTime(s.time)} · T${s.threat} · ${getArmorMark(s.mark).name}`;
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
    return [
      ['RUNS', this.save.runs],
      ['BEST SCORE', this.save.bestScore],
      ['AVERAGE', this.save.averageScore],
      ['BEST THREAT', this.save.bestThreat],
      ['BEST CHAIN', this.save.bestCombo],
      ['TOTAL KILLS', this.save.totalKills],
      ['TIME PLAYED', formatTime(this.save.totalTime)],
      ['CREDITS', this.save.currency]
    ];
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

  refreshArmory() {
    if (!this.armoryCtx) return;
    const cfg = this.save.getShipConfig();
    const frame = ARMOR_FRAMES[cfg.frame % ARMOR_FRAMES.length] || ARMOR_FRAMES[0];
    const pal = SHIP_PALETTES[cfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
    const ally = ALLY_PALETTES[cfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0];
    const cs = el('hangar-callsign');
    if (cs) cs.textContent = cfg.callsign;
    const frameEl = el('hangar-style');
    const palEl = el('hangar-palette');
    const allyEl = el('hangar-ally');
    if (frameEl) frameEl.textContent = frame.name;
    if (palEl) palEl.textContent = pal.name;
    if (allyEl) allyEl.textContent = ally.name;
    const callsignInput = el('callsign-input');
    if (callsignInput && document.activeElement !== callsignInput) callsignInput.value = cfg.callsign;
    this.drawArmoryPreview(cfg);
  }

  refreshWeapons() {
    if (!this.armoryWeapons) return;
    this.armoryWeapons.innerHTML = '';
    for (let i = 0; i < WEAPONS.length; i++) {
      const weapon = WEAPONS[i];
      const card = document.createElement('div');
      card.className = 'weapon-card';
      card.style.setProperty('--wc', weapon.color);
      const key = document.createElement('b');
      key.textContent = weapon.key;
      const name = document.createElement('span');
      name.textContent = weapon.name;
      const desc = document.createElement('i');
      desc.textContent = weapon.desc;
      card.appendChild(key);
      card.appendChild(name);
      card.appendChild(desc);
      this.armoryWeapons.appendChild(card);
    }
  }

  drawArmoryPreview(cfg) {
    const c = this.armoryCtx;
    if (!c) return;
    const canvas = this.armoryCanvas;
    const w = canvas.width;
    const h = canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);

    const bg = c.createRadialGradient(w * 0.5, h * 0.46, 8, w * 0.5, h * 0.46, h * 1.35);
    bg.addColorStop(0, 'rgba(255, 183, 77, 0.22)');
    bg.addColorStop(0.42, 'rgba(181, 18, 27, 0.12)');
    bg.addColorStop(1, 'rgba(3, 6, 12, 0)');
    c.fillStyle = '#05070d';
    c.fillRect(0, 0, w, h);
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    // Hangar gantry floor.
    c.save();
    c.strokeStyle = 'rgba(143, 232, 255, 0.09)';
    c.lineWidth = 1;
    const horizon = h * 0.34;
    for (let i = 0; i < 9; i++) {
      const y = horizon + Math.pow(i / 8, 1.9) * (h - horizon);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let i = -8; i <= 8; i++) {
      c.beginPath();
      c.moveTo(w * 0.5 + i * 22, horizon);
      c.lineTo(w * 0.5 + i * 150, h);
      c.stroke();
    }
    c.restore();

    // Center reactor halo.
    c.save();
    c.globalCompositeOperation = 'lighter';
    const halo = c.createRadialGradient(w * 0.5, h * 0.6, 4, w * 0.5, h * 0.6, h * 0.6);
    halo.addColorStop(0, 'rgba(143, 232, 255, 0.24)');
    halo.addColorStop(0.6, 'rgba(255, 183, 77, 0.06)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);
    c.restore();

    const pal = SHIP_PALETTES[cfg.palette % SHIP_PALETTES.length] || SHIP_PALETTES[0];
    const frame = cfg.frame % ARMOR_FRAMES.length;
    c.save();
    c.translate(w * 0.36, h * 0.58);
    c.scale(4.1, 4.1);
    c.rotate(-Math.PI * 0.5);
    drawArmorBody(c, frame, pal, { variant: 'iron', pilot: true });
    c.restore();

    const allyPal = ALLY_PALETTES[cfg.ally % ALLY_PALETTES.length] || ALLY_PALETTES[0];
    c.save();
    c.translate(w * 0.72, h * 0.64);
    c.scale(2.7, 2.7);
    c.rotate(-Math.PI * 0.5);
    drawArmorBody(c, (frame + 1) % ARMOR_FRAMES.length, allyPal, { variant: 'war' });
    c.restore();

    c.fillStyle = 'rgba(159, 216, 255, 0.72)';
    c.font = '600 10px "SFMono-Regular", Consolas, monospace';
    c.textAlign = 'center';
    c.fillText('IRON MAN', w * 0.36, h - 12);
    c.fillText('WAR MACHINE', w * 0.72, h - 12);
  }
}
