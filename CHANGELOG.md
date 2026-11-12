# Changelog

All notable changes to PROTOCOL: WARFORGE are documented here. The project uses
semantic versioning for the game build and the service-worker cache.

## [2.1.0] — 2026-11-12

**The WARFORGE overhaul: Iron Man + War Machine.**

### Added

- **Iron Man player suit** with procedural armor art, arc-reactor lighting,
  thruster trails, dash ghosts, hit flashes, and a callsign.
- **War Machine wingman** — fully autonomous minigun bursts and shoulder
  missiles, with a downed state and an eight-second rebuild.
- **Five-weapon rack** — Repulsor, Unibeam, Micro Missiles, Arc Chain, and
  Plasma Scatter, all available from the start, each with its own projectile
  profile, heat cost, recoil, and synthesized sound.
- **Missile barrage** — homing shoulder-pod volley on a seven-second cooldown.
- **Armor marks** — Mark III, Mark XLII, Hulkbuster, and unlockable Bleeding
  Edge replace doctrines as the entire pre-run build.
- **Mobile-first controller** — floating left-thumb joystick, FIRE / MSL / DASH /
  SWAP action cluster, right-thumb aim drag, auto-aim, and auto-fire.
- **Fixed 16:9 stage** — logical 1280×720 render target, letterboxed and scaled
  up to a 1600×900 cap, with em-scaled UI and adaptive internal resolution.
- **Immersive launch** — fullscreen request and landscape orientation lock on
  mission start where supported.
- **New command deck** — armor-mark cards, hangar preview, weapon primer,
  Fabricator, archive, and expanded settings.
- **New audio** — repulsor, unibeam, micro-missile, arc, scatter, barrage,
  minigun, overheat, and combo cues layered over the existing music buses.
- **PWA branding** — new arc-reactor/helmet icon set and Iron Man themed
  manifest and install metadata.

### Changed

- **Removed levelling, XP, drafts, rerolls, abilities, and synergies entirely.**
  There is no level-up overlay, no draft pool, and no ability bar.
- Save schema upgraded to **v4** under `protocol_warforge_save_v3`, with legacy
  SWARM keys, doctrine ids, unlock ids, and score records migrated automatically.
- Rebuilt the HUD around suit integrity, heat, dash pips, missile cooldown, the
  weapon rack, combo chain, threat, and War Machine status.
- Rebuilt the menu, pause, game-over, and briefing screens for the WARFORGE
  theme, including armor-mark selection and salvage breakdowns.
- Rebalanced hull, armor, fire rate, crit, dash, missile, and heat values around
  the new weapon rack.
- Salvage now uses `floor((score / 100 + threat × 8 + kills × 0.5) × multiplier)`.
- Reframed score records around `threat` and `mark` instead of `level` and
  `doctrine`, while still reading legacy fields.
- Tightened the service-worker cache name and precache list for the new module
  graph, dropping deleted ability/synergy modules and adding the weapon rack.

### Fixed

- Run finalization stays idempotent and no longer awards salvage twice.
- Locked armor marks always fall back to Mark III.
- DOM/UI wiring no longer references removed draft, synergy, or level elements.
- Tests now cover weapon firing, heat lockout, barrage cooldowns, dash charges,
  armor-mark profiles, save migration, and module imports.

## [2.0.0] — 2026-11-11

**The previous SWARM systems and production-readiness release.**

### Added

- **Doctrines** — Vanguard, Lancer, Warden, and unlockable Phantom frames with
  distinct opening stats and playstyles.
- **Synergy matrix** — five module families (Ballistic, Phase, Tech, Bio,
  Command) with automatic bonuses at 4 / 8 / 12 stacks.
- **Expanded draft pool** with tag metadata and level-scaled rarity weights.
- **Elite swarm** — Armored, Volatile, and Swift affixes.
- **THE WARDEN** — a second multi-phase boss alternating with THE ARCHITECT.
- **Combo scoring** — 3.4s chain window and a 4× multiplier cap.
- **Meta Lab**, command deck UI, onboarding briefing, run summary, pause build
  sheet, expanded settings, PWA support, local server, and automated tests.

### Changed

- Reorganized the monoliths into `src/engine`, `src/entities`, `src/systems`,
  `src/ui`, `Game.js`, and a thin `main.js` boot/controller layer.
- Save schema upgraded to v3 with validation, sanitization, and career totals.
- Reworked audio with independent music/SFX buses, mute, and ducking.

## [1.0.0]

Initial public build: neon twin-stick arena survival with drafting, four
abilities, a wingman, boss encounters, and local high scores.
