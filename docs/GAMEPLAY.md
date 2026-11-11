# Gameplay guide

This guide covers the run loop, build planning, threats, and scoring in
PROTOCOL: SWARM 2.0. For controls and setup, see the [README](../README.md).

## The run loop

1. Pick a doctrine in the command deck and initialize a run.
2. Move, aim, fire, dash, and use abilities to survive the swarm.
3. Collect XP. Every level opens a draft of three protocol modules.
4. Draft modules to raise stats and stack tags. At 4 / 8 / 12 tag stacks, a
   synergy tier installs automatically.
5. Threat rises every 45 seconds. Bosses arrive every 105 seconds.
6. When the hull fails, the run is scored. Salvage converts to credits for
   permanent Meta Lab unlocks.

There is no extraction. A run ends only when the player dies or aborts from the
pause menu. Aborting still banks salvage for the current score and level.

## Doctrines

| Doctrine | Best for | Opening trade-off |
| --- | --- | --- |
| **Vanguard** | First runs and flexible drafting | No weaknesses; modest bonuses |
| **Lancer** | Aggressive crit and damage builds | 12 less hull; needs dash discipline |
| **Warden** | Learning boss patterns and sustained fire | Slower fire rate; very durable |
| **Phantom** | Hit-and-run and dash-centric builds | 20 less hull; unlocked in Meta Lab |

Doctrine stats apply before meta unlocks, so a fully upgraded Warden can start
with a very large hull pool. The doctrine is fixed for the run.

## Drafting

- Three cards are offered per level. Cards show rarity, tags, description, and
  current stack count.
- Base rerolls: **2 per run**. Draft Overclock adds one; the Command tier-12
  synergy, Fleet Protocol, adds another when it activates.
- Rerolls are spent permanently. Raising the cap grants only the new charge,
  not a refill.
- Modules have individual maximum stacks. Once maxed, they leave the pool.
- Rarity weights shift with level: commons become less frequent while rares and
  epics become more common.
- Multi-tag modules are premium picks because they advance two synergy
  families at once.

### Tag families at a glance

| Tag | Identity | Iconic modules |
| --- | --- | --- |
| **Ballistic** | Raw damage, projectiles, pierce | High Caliber, Twin Barrels, Railgun |
| **Phase** | Dash uptime, mobility, i-frames | Afterburner, Phase Capacitor, Ghost Protocol |
| **Tech** | Abilities, chain arcs, orbitals | Chain Lightning, Orbital Blades, Fusion Reactor |
| **Bio** | Hull, armor, regeneration, lifesteal | Kinetic Plating, Nanite Repair, Vampiric Rounds |
| **Command** | XP, wingman, pickups, rerolls | Magnetic Core, Wingman Link, Executioner |

The full threshold table lives in the [README](../README.md#synergy-tiers).

## Economy and upgrades

Salvage at run end:

```
floor(score / 100 + level * 3) * salvageMultiplier
```

`salvageMultiplier` is `1.2` with the Salvage Protocol unlock, otherwise `1`.
Credits persist locally and are spent in the Meta Lab. Purchases are permanent
and apply at the start of every future run. The Meta Lab also unlocks the
Phantom doctrine.

Priority purchases for new players:

1. **Reinforced Hull** — the simplest survivability increase.
2. **Hot Barrel** — immediate damage.
3. **Neural Link** — faster drafts, which compounds into stronger builds.
4. **Draft Overclock** — one extra reroll every run.
5. **Emergency Protocol** — a second life at 35% hull.
6. **Phantom Frame** — a new doctrine and playstyle.

## Combat fundamentals

### Heat and firing

Firing builds heat. At high heat the weapon becomes inaccurate and can
overheat, forcing a cooldown. Feathering the trigger, Phase Coolant, and Fusion
Reactor keep sustained damage online. Overcharge pickups reduce heat and add
35% damage for 8 seconds.

### Dash

Dash grants brief invulnerability, leaves afterimages, and is the primary answer
to snipers, bomber blasts, and boss radials. Dash charges refill over time;
Phase modules reduce recharge and add charges. Quantum Dash turns the dash into
a shockwave, while Singularity Dash leaves a pulling gravity well.

### Abilities

| Ability | Cooldown | Role |
| --- | --- | --- |
| **Nova Burst** | 10s | Radial clear with high ability scaling |
| **Aegis Field** | 16s | Damage shield and breathing room |
| **Overdrive** | 20s | Fire rate, damage, and mobility boost |
| **Time Warp** | 24s | Slows enemies and projectiles dramatically |

Cooldown reduction and ability power come from Tech modules and synergies.
Phase Shift grants i-frames on cast, which can turn a defensive ability into a
safe repositioning tool.

### Execution and crits

Executioner adds damage against enemies below 30% hull. Crit chance and crit
multiplier stack multiplicatively with raw damage, making Lancer and Ballistic
builds spike hard once Targeting Array and Critical Core come online.

## Threats

| Time | Escalation |
| --- | --- |
| 0:00 | Swarmers and basic pressure |
| 0:08 | First sniper waves |
| 0:14 | Hex area denial |
| 0:17 | Bombers |
| 0:40 | Elites begin spawning |
| 0:45 | Threat level 2 |
| 1:45 | First boss (Architect/Warden alternating) |
| Every 45s | Threat +1 |
| Every 105s | Next boss |

Elite chance grows with threat and elapsed time, capped at 18% per eligible
spawn. Elites drop health and often overcharge.

### Elite affixes

- **Armored** — takes reduced damage and has a heavier health bar. Bring pierce,
  crits, or sustained fire.
- **Volatile** — detonates on death. Kill it at range or dash out of the blast.
- **Swift** — significantly faster. Circle-strafe and use crowd control.

### Bosses

**THE ARCHITECT** is a radial-pressure fight with expanding patterns and
summoned escorts. Stay moving, use the gaps between rings, and save a dash for
the final overlap.

**THE WARDEN** is a heavier siege frame with sweeping lanes and punishing
contact. It rewards patient damage windows over greedy uptime. Time Warp is
excellent for skipping a dense pattern.

Both bosses gain health and damage with each encounter. Prime and Omega
variants appear after the first cycle. Boss kills drop four health pickups and
an overcharge.

## Scoring

- Each kill awards its base score multiplied by the combo multiplier.
- Combo multiplier: `1 + combo * 0.04`, capped at **4×**.
- The chain window is 3.4 seconds. Taking damage halves the current chain.
- Milestones at 10 / 25 / 50 / 100 display callouts.
- Score and level determine salvage. Higher combo is the fastest route to a
  large credit payout.
- High scores keep the top eight runs locally, with doctrine, time, level,
  kills, combo, and date.

## Build archetypes

| Archetype | Core tags | Key modules | Win condition |
| --- | --- | --- | --- |
| **Railgun Lancer** | Ballistic / Tech | Railgun, High Caliber, Targeting, Piercing | Delete elites before they close |
| **Phase Dancer** | Phase / Tech | Phase Capacitor, Ghost Protocol, Quantum Dash | Never stop moving; dash through patterns |
| **Orbital Engineer** | Tech / Command | Orbital Blades, Chain Lightning, Reactor Matrix | Passive area damage while kiting |
| **Bio Bruiser** | Bio / Ballistic | Plating, Vampiric, Berserker, Glass Cannon | Out-sustain and out-damage at close range |
| **Fleet Commander** | Command / Tech | Wingman Link, Magnetic Core, Executioner | XP acceleration into a wide draft pool |
| **Nova Prophet** | Tech / Phase | Nova Core, Pulse Emitter, Phase Shift | Ability cycles clear entire screens |

Builds are suggestions, not gates. The draft pool and synergy thresholds reward
adapting to what the run offers. A third tag on an epic card can be worth more
than a marginally stronger common pick.
