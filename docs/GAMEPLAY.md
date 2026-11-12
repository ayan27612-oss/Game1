# Gameplay guide

This guide covers the WARFORGE run loop, armor marks, weapons, threat pacing,
and the Fabricator. For setup, controls, and deployment see the
[README](../README.md).

## The run loop

1. Pick an **armor mark** in the command deck. The mark is the entire pre-run
   build.
2. Launch. Iron Man starts with the full five-weapon rack; War Machine deploys
   alongside you.
3. Move, fire, dash, and launch missile barrages to survive the swarm.
4. Chain kills for score, push threat, and break heavy units every 105 seconds.
5. When the suit falls — or when you abort from the pause menu — the run is
   converted into salvage and logged in the archive.

There is **no XP, no levelling, no draft, no reroll, and no ability bar**. The
HUD only reports live suit state: hull, reactor heat, dash charges, missile
cooldown, the weapon rack, combo chain, threat, and War Machine status.

## Armor marks

Armor marks apply before permanent Fabricator unlocks, so a fully upgraded hull
build starts with a much larger pool. A mark cannot be changed mid-run.

| Mark | Role | Opening profile |
| --- | --- | --- |
| **Mark III** | Balanced | +30 hull, +4% armor, +5% fire rate |
| **Mark XLII** | Strike | +16% damage, +8% fire rate, +6% crit, +4% speed, −10 hull |
| **Hulkbuster** | Siege | +60 hull, +14% armor, +1 missile, +10% missile damage, −8% fire rate, −6% speed |
| **Bleeding Edge** | Prototype | +1 dash charge, +10% speed, +8% crit, +0.05s i-frames, −15 hull |

Base hull is 140. A fresh Mark III starts at 170 hull; Reinforced Plating adds
25 more for 195. Bleeding Edge is unlocked permanently by buying the Bleeding
Edge Armor unlock in the Fabricator.

## Weapon rack

All five weapons are available from the first second. Press `1`–`5` to select a
weapon directly, `Q` / `E` or the SWAP button to cycle, and use the HUD rack to
see the active weapon and heat state.

| # | Weapon | Damage profile | Heat | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Repulsor** | Fast twin bolts | Low | Reliable default; alternating palm shots. |
| 2 | **Unibeam** | Heavy chest lance | High | Wide pierce, slow cycle, strong knockback. |
| 3 | **Micro Missiles** | Two homing missiles | Medium | Splash damage, excellent against packs. |
| 4 | **Arc Chain** | Chaining bolt | Medium | Jumps to nearby targets; good crowd clear. |
| 5 | **Plasma Scatter** | Eight-pellet burst | High | Point-blank burst; falls off at range. |

Damage and fire rate are multiplied by the player's stats, armor mark, and
Fabricator unlocks. Critical hits use a separate multiplier and brighten the
projectile.

### Heat and overheat

Every shot adds reactor heat. Heat cools while not firing, and cools faster when
the trigger is released. At 100% the suit **overheats**: the weapon locks until
heat falls back below roughly a quarter. Feather the trigger or swap to a
cooler weapon during long engagements. Cryo Coolant improves cooling.

### Missile barrage

The shoulder pod fires a homing volley on a **7-second cooldown**. Base count is
four missiles; Hulkbuster and the Missile Pod unlock each add one. Barrage
missiles splash on impact and benefit from critical chance. The HUD and touch MSL
button show the cooldown and current volley size.

### Dash

Dash is a short burst with i-frames and afterimages. Base charges: **1**, with a
1.15-second recharge per charge. Bleeding Edge and Arc Capacitor add charges.
Dash direction follows movement input, then aim direction, then facing. Use it to
cross bullet curtains, escape bombers, and reposition behind elites.

## War Machine

War Machine is fully autonomous. He closes to optimal range, fires minigun
bursts, and launches shoulder missiles on a slow cycle. He cannot be controlled
directly.

- He has his own hull pool shown in the HUD ally chip.
- At zero hull he goes **down** and rebuilds after **8 seconds**.
- While down he stops dealing damage, so clear the units pressuring him if you
  want sustained fire support.

## Scoring and salvage

- Kills add score scaled by the combo multiplier: `1 + combo × 0.04`.
- The multiplier caps at **4×** at 75 chain.
- The chain timer is **3.4 seconds**; each kill refreshes it.
- Taking damage halves the chain and keeps a short grace window.
- Threat rises every **45 seconds** and increases spawn pressure and elite odds.
- Heavy units arrive every **105 seconds**; later encounters scale up.
- Salvage at run end:

  ```text
  floor((score / 100 + threat × 8 + kills × 0.5) × salvageMultiplier)
  ```

Aborting from the pause menu still banks the current run's salvage.

## Enemy roster

| Enemy | Behavior |
| --- | --- |
| **Swarmer** | Fast filler that closes distance in packs. |
| **Sniper** | Telegraphs a locked line, then fires; dash or break the line. |
| **Hex** | Anchors area denial with rotating bullet patterns. |
| **Bomber** | Detonates on death; leave the blast radius. |
| **Splitter** | Splits into two smaller swarmers when killed. |
| **Weaver** | Weaves lateral bullet curtains to cut off escape lanes. |
| **Gunner** | Sustained ranged pressure with tracking bursts. |
| **Elites** | Armored (reduced damage), Volatile (post-death burst), or Swift (speed). |
| **Bosses** | Multi-phase health bars, radial attacks, and summoned escorts. |

## Pickups

- **Repair cell** (green cross) restores hull.
- **Overcharge** (gold bolt) grants a short damage and fire-rate surge.

Pickup radius is generous; moving through a drop is usually enough.

## Fabricator

Permanent unlocks bought with salvage. They apply to every future run.

| Unlock | Cost | Effect |
| --- | --- | --- |
| **Reinforced Plating** | 140 CR | +25 starting max hull |
| **Repulsor Calibration** | 180 CR | +8% weapon damage |
| **Arc Capacitor** | 240 CR | +1 starting dash charge |
| **Targeting Suite** | 260 CR | +5% critical chance |
| **Cryo Coolant** | 280 CR | +15% weapon cooling |
| **Servo Actuators** | 300 CR | +5% movement speed |
| **Salvage Protocol** | 340 CR | +20% credits earned at run end |
| **Ablative Layer** | 380 CR | +6% starting armor |
| **Missile Pod** | 520 CR | +1 missile in every barrage |
| **Bleeding Edge Armor** | 650 CR | Unlocks the Bleeding Edge mark |
| **Emergency Protocol** | 780 CR | Survive one fatal hit per run at 35% hull |

## Practical tips

- **Swap instead of waiting.** Overheat is per-suit, not per-weapon, but a cooler
  weapon lets you keep pressure while the reactor recovers.
- **Dash through bullets, not away from them.** The i-frames are short; plan the
  exit.
- **Bank barrage for elites and bosses.** Homing splash is wasted on a single
  swarmer.
- **Protect War Machine indirectly.** He draws fire and adds real damage; clear
  the pack around him during his rebuild window.
- **Threat is score.** Pushing into higher threat increases salvage and elite
  drops, but the arena escalates faster than your hull.
- **Combo is the score engine.** At 4× chain, every kill is worth four times its
  base value. Taking a hit costs half the chain, so dash early.
