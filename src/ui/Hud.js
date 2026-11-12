import { WEAPONS } from '../systems/Weapons.js';
import { clamp, formatTime } from '../engine/MathUtils.js';

const el = (id) => document.getElementById(id);

/**
 * Combat HUD for the Iron Man / War Machine build. There is no XP bar, no
 * level and no draft overlay — the armor mark and the five-weapon rack are the
 * entire build, so the HUD simply reports the suit's live state.
 */
export class Hud {
  constructor({ audio } = {}) {
    this.audio = audio;

    this.hudEl = el('hud');
    this.hpFill = el('hp-fill');
    this.hpText = el('hp-text');
    this.name = el('hud-name');
    this.mark = el('hud-mark');
    this.score = el('hud-score');
    this.time = el('hud-time');
    this.kills = el('hud-kills');
    this.bosses = el('hud-bosses');
    this.heatFill = el('heat-fill');
    this.heatStatus = el('heat-status');
    this.dashPips = el('dash-pips');
    this.missileFill = el('missile-fill');
    this.missileStatus = el('missile-status');
    this.weaponRack = el('weapon-rack');
    this.bossBar = el('boss-bar');
    this.bossFill = el('boss-fill');
    this.bossName = el('boss-name');
    this.bossPhase = el('boss-phase');
    this.bossIntro = el('boss-intro');
    this.bossIntroName = el('boss-intro-name');
    this.bossIntroSub = el('boss-intro-sub');
    this.comboChip = el('combo-chip');
    this.comboValue = el('combo-value');
    this.comboCount = el('combo-count');
    this.threat = el('hud-threat');
    this.allyChip = el('ally-chip');
    this.allyState = el('ally-state');
    this.pause = el('pause');
    this.pauseStats = el('pause-stats');
    this.pauseLoadout = el('pause-loadout');
    this.gameover = el('gameover');
    this.toastEl = el('toast');
    this.lastHudText = 0;
    this.toastTimer = 0;
    this.bossTimer = 0;
    this.weaponChips = [];

    this.buildWeaponRack();
  }

  toast(message, duration = 1900) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), duration);
  }

  showHud() { if (this.hudEl) this.hudEl.classList.remove('hidden'); }
  hideHud() { if (this.hudEl) this.hudEl.classList.add('hidden'); }

  buildWeaponRack() {
    if (!this.weaponRack) return;
    this.weaponRack.innerHTML = '';
    this.weaponChips = [];
    for (let i = 0; i < WEAPONS.length; i++) {
      const weapon = WEAPONS[i];
      const chip = document.createElement('div');
      chip.className = 'weapon-chip';
      chip.dataset.id = weapon.id;
      chip.style.setProperty('--wc', weapon.color);
      chip.setAttribute('role', 'listitem');

      const key = document.createElement('b');
      key.textContent = weapon.key;
      const name = document.createElement('span');
      name.textContent = weapon.short;
      const label = document.createElement('i');
      label.textContent = weapon.name;

      chip.appendChild(key);
      chip.appendChild(name);
      chip.appendChild(label);
      this.weaponRack.appendChild(chip);
      this.weaponChips.push(chip);
    }
  }

  update(game, state, now) {
    if (!game || !this.hudEl) return;
    const p = game.player;
    const hpRatio = clamp(p.hp / p.stats.maxHp, 0, 1);
    const heat = clamp(p.heat, 0, 1);

    this.hpFill.style.width = `${hpRatio * 100}%`;
    this.hpFill.parentElement.classList.toggle('low', hpRatio < 0.3);
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`;
    this.name.textContent = `${p.callsign || 'TONY'} // IRON MAN`;
    this.mark.textContent = game.mark.name;

    this.heatFill.style.width = `${heat * 100}%`;
    this.heatFill.parentElement.classList.toggle('hot', heat > 0.7 && !p.overheated);
    this.heatFill.parentElement.classList.toggle('over', p.overheated);
    if (p.overheated) {
      this.heatStatus.textContent = 'OVERHEAT';
      this.heatStatus.className = 'over';
    } else if (heat > 0.7) {
      this.heatStatus.textContent = 'CRITICAL';
      this.heatStatus.className = 'hot';
    } else if (heat > 0.35) {
      this.heatStatus.textContent = 'WARM';
      this.heatStatus.className = 'hot';
    } else {
      this.heatStatus.textContent = 'READY';
      this.heatStatus.className = '';
    }

    this.updateDashPips(p);
    this.updateWeaponRack(p);
    this.updateMissiles(p);
    this.updateCombo(game);
    this.updateAlly(game);
    this.updateBoss(game);

    if (now - this.lastHudText > 100) {
      this.lastHudText = now;
      this.score.textContent = String(game.score);
      this.time.textContent = formatTime(game.elapsed);
      this.kills.textContent = String(game.kills);
      if (this.bosses) this.bosses.textContent = String(game.bossKills);
    }
    if (this.threat) this.threat.textContent = String(game.threat);
    document.body.classList.toggle('low-hp', hpRatio < 0.3 && state === 'playing');
  }

  updateWeaponRack(player) {
    for (let i = 0; i < this.weaponChips.length; i++) {
      const chip = this.weaponChips[i];
      const active = i === player.weaponIndex;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-current', active ? 'true' : 'false');
      chip.classList.toggle('overheated', active && player.overheated);
    }
  }

  updateMissiles(player) {
    if (!this.missileFill) return;
    const total = 7;
    const ready = player.missileCooldown <= 0;
    this.missileFill.style.width = `${ready ? 100 : clamp(1 - player.missileCooldown / total, 0, 1) * 100}%`;
    this.missileFill.parentElement.classList.toggle('ready', ready);
    if (this.missileStatus) {
      this.missileStatus.textContent = ready ? `READY x${Math.round(player.stats.missileCount)}` : `${Math.ceil(player.missileCooldown)}s`;
    }
  }

  updateCombo(game) {
    if (!this.comboChip) return;
    const show = game.combo >= 2;
    this.comboChip.classList.toggle('hidden', !show);
    if (!show) return;
    this.comboValue.textContent = `${game.comboMultiplier.toFixed(1)}x`;
    this.comboCount.textContent = `${game.combo} CHAIN`;
    this.comboChip.classList.toggle('hot', game.combo >= 25);
  }

  updateAlly(game) {
    if (!this.allyChip || !game.ally) return;
    const a = game.ally;
    if (a.downed) {
      this.allyChip.classList.add('down');
      this.allyState.textContent = `WAR MACHINE DOWN ${Math.max(0, Math.ceil(a.respawn))}s`;
    } else {
      this.allyChip.classList.remove('down');
      this.allyState.textContent = `WAR MACHINE ${Math.round(a.hp)}/${a.maxHp}`;
    }
  }

  updateBoss(game) {
    const boss = game.enemies.boss;
    if (boss && !boss.dead) {
      this.bossBar.classList.remove('hidden');
      this.bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
      this.bossName.textContent = boss.name || 'THE ARCHITECT';
      this.bossPhase.textContent = `PHASE ${['I', 'II', 'III', 'IV'][boss.phase - 1] || 'I'}`;
    } else if (this.bossBar) {
      this.bossBar.classList.add('hidden');
    }
  }

  updateDashPips(player) {
    if (!this.dashPips) return;
    const max = Math.max(1, Math.floor(player.stats.maxDashCharges));
    if (this.dashPips.childElementCount !== max) {
      this.dashPips.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip';
        this.dashPips.appendChild(pip);
      }
    }
    const pips = this.dashPips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('full', i < player.dashCharges);
      pips[i].classList.toggle('charging', i === player.dashCharges && player.dashCharges < max);
    }
  }

  showBossIntro(boss) {
    if (!this.bossIntro || !boss) return;
    this.bossIntroName.textContent = boss.name || 'HEAVY UNIT';
    this.bossIntroSub.textContent = 'BREAK THE CORE // SURVIVE THE RESPONSE';
    this.bossIntro.classList.remove('hidden');
    clearTimeout(this.bossTimer);
    this.bossTimer = setTimeout(() => this.bossIntro.classList.add('hidden'), 2800);
  }

  _statMarks(game) {
    return [
      ['MARK', game.mark.name],
      ['WEAPON', game.player.weapon.name],
      ['DAMAGE', `${Math.round(game.player.stats.damage * 100)}%`],
      ['ARMOR', `${Math.round(game.player.stats.armor * 100)}%`],
      ['CRIT', `${Math.round(game.player.stats.crit * 100)}%`],
      ['DASH', `${game.player.stats.maxDashCharges} CHARGES`],
      ['MISSILES', `${Math.round(game.player.stats.missileCount)} / BARRAGE`],
      ['CALLSIGN', game.player.callsign]
    ];
  }

  showPause(game) {
    if (!this.pause) return;
    const stats = [
      ['SCORE', game.score],
      ['TIME', formatTime(game.elapsed)],
      ['THREAT', game.threat],
      ['COMBO BEST', game.comboBest]
    ];
    this.pauseStats.innerHTML = '';
    for (let i = 0; i < stats.length; i++) {
      const div = document.createElement('div');
      div.className = 'career-stat';
      const label = document.createElement('span');
      label.textContent = stats[i][0];
      const value = document.createElement('b');
      value.textContent = String(stats[i][1]);
      div.appendChild(label);
      div.appendChild(value);
      this.pauseStats.appendChild(div);
    }

    if (this.pauseLoadout) {
      this.pauseLoadout.innerHTML = '';
      const marks = this._statMarks(game);
      for (let i = 0; i < marks.length; i++) {
        const item = document.createElement('div');
        item.className = 'loadout-item';
        const label = document.createElement('span');
        label.textContent = marks[i][0];
        const value = document.createElement('b');
        value.textContent = marks[i][1];
        item.appendChild(label);
        item.appendChild(value);
        this.pauseLoadout.appendChild(item);
      }
      const rack = document.createElement('div');
      rack.className = 'loadout-rack';
      for (let i = 0; i < WEAPONS.length; i++) {
        const span = document.createElement('span');
        const weapon = WEAPONS[i];
        span.textContent = `${weapon.key} ${weapon.short}`;
        span.style.setProperty('--wc', weapon.color);
        span.classList.toggle('active', i === game.player.weaponIndex);
        rack.appendChild(span);
      }
      this.pauseLoadout.appendChild(rack);
    }

    this.pause.classList.remove('hidden');
  }

  hidePause() {
    if (this.pause) this.pause.classList.add('hidden');
  }

  showGameOver(game, earned, isRecord) {
    if (!this.gameover) return;
    el('go-score').textContent = String(game.score);
    el('go-time').textContent = formatTime(game.elapsed);
    el('go-threat').textContent = String(game.threat);
    el('go-kills').textContent = String(game.kills);
    const bestMult = 1 + Math.min(3, game.comboBest * 0.04);
    el('go-combo').textContent = `${game.comboBest} (${bestMult.toFixed(1)}x)`;
    el('go-dealt').textContent = String(Math.round(game.damageDealt));
    el('go-taken').textContent = String(Math.round(game.damageTaken));
    el('go-bosses').textContent = `${game.bossKills} / ${game.elitesKilled}`;
    el('go-mark').textContent = game.mark.name;
    el('go-meta').textContent = `+${earned} CR SALVAGED`;
    const record = el('go-record');
    if (record) record.classList.toggle('hidden', !isRecord);

    const build = el('go-build');
    if (build) {
      build.innerHTML = '';
      for (let i = 0; i < WEAPONS.length; i++) {
        const span = document.createElement('span');
        span.textContent = `${WEAPONS[i].key} ${WEAPONS[i].name}`;
        span.style.setProperty('--wc', WEAPONS[i].color);
        build.appendChild(span);
      }
    }
    this.gameover.classList.remove('hidden');
  }

  hideGameOver() {
    if (this.gameover) this.gameover.classList.add('hidden');
  }

  hideAllGameplayOverlays() {
    this.hidePause();
    this.hideGameOver();
    if (this.bossBar) this.bossBar.classList.add('hidden');
    if (this.bossIntro) this.bossIntro.classList.add('hidden');
    document.body.classList.remove('low-hp');
  }
}
