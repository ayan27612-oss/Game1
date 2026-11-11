import { UPGRADES, RARITY_NAMES } from '../systems/Upgrades.js';
import { SYNERGY_TAGS, SYNERGY_TIERS, tagCounts } from '../systems/Synergies.js';
import { ABILITIES } from '../systems/Abilities.js';
import { clamp, formatTime } from '../engine/MathUtils.js';

const el = (id) => document.getElementById(id);
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export class Hud {
  constructor({ audio, onChoose, onReroll }) {
    this.audio = audio;
    this.onChoose = onChoose;
    this.onReroll = onReroll;

    this.hudEl = el('hud');
    this.hpFill = el('hp-fill');
    this.hpText = el('hp-text');
    this.xpFill = el('xp-fill');
    this.xpText = el('xp-text');
    this.level = el('hud-level');
    this.name = el('hud-name');
    this.doctrine = el('hud-doctrine');
    this.score = el('hud-score');
    this.time = el('hud-time');
    this.kills = el('hud-kills');
    this.elites = el('hud-elites');
    this.heatFill = el('heat-fill');
    this.heatStatus = el('heat-status');
    this.dashPips = el('dash-pips');
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
    this.abilityHud = el('ability-hud');
    this.allyChip = el('ally-chip');
    this.allyState = el('ally-state');
    this.draft = el('draft');
    this.draftCards = el('draft-cards');
    this.draftLevel = el('draft-level');
    this.draftRerolls = el('draft-rerolls');
    this.draftRerollBtn = el('btn-reroll');
    this.pause = el('pause');
    this.pauseStats = el('pause-stats');
    this.pauseBuild = el('pause-build');
    this.pauseSynergies = el('pause-synergies');
    this.gameover = el('gameover');
    this.toastEl = el('toast');
    this.synergyBanner = el('synergy-banner');
    this.synergyName = el('synergy-name');
    this.synergyDesc = el('synergy-desc');
    this.lastHudText = 0;
    this.toastTimer = 0;
    this.synergyTimer = 0;
    this.bossTimer = 0;

    this.buildAbilityHud();
    if (this.draftRerollBtn) {
      this.draftRerollBtn.addEventListener('click', () => this.onReroll());
    }
    if (this.draftCards) {
      this.draftCards.addEventListener('click', (e) => {
        const card = e.target.closest('.draft-card');
        if (!card) return;
        this.onChoose(Number(card.dataset.index));
      });
    }
  }

  toast(message, duration = 1900) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), duration);
  }

  showHud() { this.hudEl.classList.remove('hidden'); }
  hideHud() { this.hudEl.classList.add('hidden'); }

  buildAbilityHud() {
    if (!this.abilityHud) return;
    this.abilityHud.innerHTML = '';
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
      this.abilityHud.appendChild(chip);
    }
  }

  update(game, state, now) {
    if (!game || !this.hudEl) return;
    const p = game.player;
    const hpRatio = clamp(p.hp / p.stats.maxHp, 0, 1);
    const xpRatio = clamp(game.xp / game.xpNext, 0, 1);

    this.hpFill.style.width = `${hpRatio * 100}%`;
    this.hpFill.parentElement.classList.toggle('low', hpRatio < 0.3);
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`;
    this.xpFill.style.width = `${xpRatio * 100}%`;
    this.xpText.textContent = `XP ${Math.floor(game.xp)} / ${game.xpNext}`;
    this.level.textContent = `LV ${game.level}`;
    this.name.textContent = `OPERATOR // ${p.callsign || 'NOVA'}`;
    this.doctrine.textContent = game.doctrine.name;

    const heat = clamp(p.heat, 0, 1);
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
    this.updateAbilityHud(p);
    this.updateCombo(game);
    this.updateAlly(game);
    this.updateBoss(game);

    if (now - this.lastHudText > 100) {
      this.lastHudText = now;
      this.score.textContent = String(game.score);
      this.time.textContent = formatTime(game.elapsed);
      this.kills.textContent = String(game.kills);
      if (this.elites) this.elites.textContent = String(game.elitesKilled + game.bossKills);
    }
    if (this.threat) this.threat.textContent = String(game.threat);
    document.body.classList.toggle('low-hp', hpRatio < 0.3 && state === 'playing');
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
      this.allyState.textContent = `WINGMAN DOWN ${Math.max(0, Math.ceil(a.respawn))}s`;
    } else {
      this.allyChip.classList.remove('down');
      this.allyState.textContent = `WINGMAN ${Math.round(a.hp)}/${a.maxHp}`;
    }
  }

  updateBoss(game) {
    const boss = game.enemies.boss;
    if (boss && !boss.dead) {
      this.bossBar.classList.remove('hidden');
      this.bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
      this.bossName.textContent = boss.name || 'THE ARCHITECT';
      this.bossPhase.textContent = `PHASE ${['I', 'II', 'III', 'IV'][boss.phase - 1] || 'I'}`;
    } else {
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

  updateAbilityHud(player) {
    if (!this.abilityHud) return;
    for (let i = 0; i < ABILITIES.length; i++) {
      const ab = ABILITIES[i];
      const chip = this.abilityHud.children[i];
      if (!chip) continue;
      const slot = player.abilities[ab.id];
      const cd = slot ? slot.cd : 0;
      const total = Math.max(0.001, ab.cooldown * (player.stats.cooldownMult || 1));
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

  showBossIntro(boss) {
    if (!this.bossIntro || !boss) return;
    this.bossIntroName.textContent = boss.name || 'SECTOR GUARDIAN';
    this.bossIntroSub.textContent = boss.type === 'boss'
      ? 'BREAK THE CORE // SURVIVE THE RESPONSE'
      : 'HEAVY UNIT INBOUND // HOLD THE LINE';
    this.bossIntro.classList.remove('hidden');
    clearTimeout(this.bossTimer);
    this.bossTimer = setTimeout(() => this.bossIntro.classList.add('hidden'), 2800);
  }

  showSynergy(tier) {
    if (!this.synergyBanner || !tier) return;
    const meta = SYNERGY_TAGS[tier.tag];
    this.synergyName.textContent = tier.name;
    this.synergyDesc.textContent = tier.desc;
    this.synergyBanner.style.borderColor = meta ? meta.color : '#59ffa8';
    this.synergyBanner.classList.remove('hidden');
    clearTimeout(this.synergyTimer);
    this.synergyTimer = setTimeout(() => this.synergyBanner.classList.add('hidden'), 3200);
  }

  showDraft(game, choices) {
    if (!this.draft) return;
    this.draftLevel.textContent = String(game.level);
    this.draftRerolls.textContent = String(game.rerolls);
    this.draftRerollBtn.disabled = game.rerolls <= 0;
    this.renderDraftChoices(game, choices);
    this.draft.classList.remove('hidden');
  }

  hideDraft() {
    this.draft.classList.add('hidden');
  }

  renderDraftChoices(game, choices) {
    this.draftCards.innerHTML = '';
    for (let i = 0; i < choices.length; i++) {
      const up = choices[i];
      const stacks = game.player.upgradeCounts[up.id] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'draft-card';
      card.dataset.rarity = String(up.rarity);
      card.dataset.index = String(i);

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

      const tags = document.createElement('div');
      tags.className = 'dc-tags';
      const list = up.tags || [];
      for (let t = 0; t < list.length; t++) {
        const meta = SYNERGY_TAGS[list[t]];
        const tag = document.createElement('span');
        tag.className = 'dc-tag';
        tag.style.setProperty('--tg', meta ? meta.color : '#8fa7b8');
        tag.textContent = meta ? meta.name : String(list[t]).toUpperCase();
        tags.appendChild(tag);
      }

      const stack = document.createElement('div');
      stack.className = 'dc-stack';
      const stackText = document.createElement('span');
      stackText.textContent = 'MODULE STACK';
      const stackVal = document.createElement('b');
      stackVal.textContent = `${stacks + 1} / ${up.max}`;
      stack.appendChild(stackText);
      stack.appendChild(stackVal);

      card.appendChild(top);
      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(tags);
      card.appendChild(stack);
      this.draftCards.appendChild(card);
    }
    this.draftRerolls.textContent = String(game.rerolls);
    this.draftRerollBtn.disabled = game.rerolls <= 0;
  }

  _buildListMarkup(player) {
    const entries = [];
    for (const id in player.upgradeCounts) {
      const stacks = player.upgradeCounts[id] || 0;
      if (!stacks) continue;
      const up = UPGRADE_BY_ID.get(id);
      if (!up) continue;
      entries.push({ name: up.name, stacks, max: up.max, rarity: up.rarity });
    }
    entries.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
    return entries;
  }

  showPause(game) {
    if (!this.pause) return;
    const stats = [
      ['SCORE', game.score],
      ['TIME', formatTime(game.elapsed)],
      ['LEVEL', game.level],
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

    this.pauseBuild.innerHTML = '';
    const build = this._buildListMarkup(game.player);
    if (!build.length) {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = 'NO MODULES DRAFTED YET';
      this.pauseBuild.appendChild(note);
    } else {
      for (let i = 0; i < build.length; i++) {
        const item = document.createElement('div');
        item.className = 'build-item';
        const name = document.createElement('b');
        name.textContent = build[i].name;
        const stacks = document.createElement('span');
        stacks.textContent = `×${build[i].stacks}`;
        item.appendChild(name);
        item.appendChild(stacks);
        this.pauseBuild.appendChild(item);
      }
    }

    this.pauseSynergies.innerHTML = '';
    const counts = tagCounts(game.player);
    const tags = Object.keys(SYNERGY_TAGS);
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const meta = SYNERGY_TAGS[tag];
      const count = counts[tag] || 0;
      const next = SYNERGY_TIERS.filter((t) => t.tag === tag).find((t) => count < t.at);
      const item = document.createElement('div');
      item.className = 'synergy-item';
      item.style.setProperty('--tg', meta.color);
      const head = document.createElement('div');
      head.className = 'syn-head';
      const name = document.createElement('b');
      name.textContent = meta.name;
      const value = document.createElement('span');
      value.textContent = next ? `${count} / ${next.at}` : `${count} MAXED`;
      head.appendChild(name);
      head.appendChild(value);
      item.appendChild(head);
      const note = document.createElement('small');
      note.textContent = next ? `NEXT: ${next.name} — ${next.desc}` : 'ALL TIERS ONLINE';
      item.appendChild(note);
      this.pauseSynergies.appendChild(item);
    }

    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  showGameOver(game, earned, isRecord) {
    if (!this.gameover) return;
    el('go-score').textContent = String(game.score);
    el('go-time').textContent = formatTime(game.elapsed);
    el('go-level').textContent = String(game.level);
    el('go-kills').textContent = String(game.kills);
    const bestMult = 1 + Math.min(3, game.comboBest * 0.04);
    el('go-combo').textContent = `${game.comboBest} (${bestMult.toFixed(1)}x)`;
    el('go-dealt').textContent = String(Math.round(game.damageDealt));
    el('go-taken').textContent = String(Math.round(game.damageTaken));
    el('go-elites').textContent = `${game.elitesKilled} / ${game.bossKills}`;
    el('go-doctrine').textContent = game.doctrine.name;
    el('go-meta').textContent = `+${earned} CR SALVAGED`;
    const record = el('go-record');
    if (record) record.classList.toggle('hidden', !isRecord);

    const build = el('go-build');
    if (build) {
      build.innerHTML = '';
      const modules = this._buildListMarkup(game.player);
      for (let i = 0; i < modules.length; i++) {
        const span = document.createElement('span');
        span.textContent = `${modules[i].name} ×${modules[i].stacks}`;
        build.appendChild(span);
      }
      const counted = tagCounts(game.player);
      for (const tag in SYNERGY_TAGS) {
        if (counted[tag] > 0) {
          const span = document.createElement('span');
          span.textContent = `${SYNERGY_TAGS[tag].name} ${counted[tag]}`;
          span.style.color = SYNERGY_TAGS[tag].color;
          build.appendChild(span);
        }
      }
    }
    this.gameover.classList.remove('hidden');
  }

  hideGameOver() {
    this.gameover.classList.add('hidden');
  }

  hideAllGameplayOverlays() {
    this.hideDraft();
    this.hidePause();
    this.hideGameOver();
    this.bossBar.classList.add('hidden');
    this.bossIntro.classList.add('hidden');
    this.synergyBanner.classList.add('hidden');
    document.body.classList.remove('low-hp');
  }
}
