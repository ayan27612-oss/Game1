# Changelog

All notable changes to PROTOCOL: SWARM are documented here. The project uses
semantic versioning for the game build and the service-worker cache.

## [2.0.0] — 2026-11-11

**The systems, command deck, and production-readiness release.**

### Added

- **Doctrines** — Vanguard, Lancer, Warden, and unlockable Phantom frames with
  distinct opening stats and playstyles.
- **Synergy matrix** — five module families (Ballistic, Phase, Tech, Bio,
  Command) with automatic bonuses at 4 / 8 / 12 stacks and 15 unique tiers.
- **Expanded draft pool** — new exotic modules for execution, dash shockwaves,
  ability i-frames, overcharge, and orbital/chain builds, with tag metadata and
  level-scaled rarity weights.
- **Elite swarm** — Armored, Volatile, and Swift affixes with health bars,
  gradient auras, bonus drops, and elite kill tracking.
- **THE WARDEN** — a second multi-phase boss that alternates with THE
  ARCHITECT; later encounters gain Prime/Omega names and scaling health.
- **Combo scoring** — 3.4s chain window, 4× multiplier cap, HUD chain meter,
  milestone callouts, and chain loss on incoming damage.
- **Meta Lab** — eleven permanent unlocks, including the Phantom doctrine,
  Emergency Protocol revive, Draft Overclock, and Salvage Protocol.
- **Command deck UI** — tabbed Deploy / Hangar / Meta Lab / Archive / Settings
  panels, doctrine picker, run intel, synergy primer, and responsive layout.
- **Onboarding** — first-run mission briefing with objective, controls, and
  doctrine overview; replayable from Deploy.
- **Run summary** — score, time, level, kills, best combo, damage dealt/taken,
  elites/bosses, doctrine, drafted modules, salvage, and new-record badge.
- **Pause build sheet** — active module list and synergy matrix while paused.
- **Settings** — music/SFX volume, mute, screen shake, damage numbers, reduced
  motion, CRT scanlines, render quality, and reset save.
- **PWA support** — installable manifest, 192/512/maskable icons, precached
  offline app shell, and cache versioning.
- **Local server** — zero-dependency `server.js` with MIME types, ETags,
  security headers, HEAD support, and path traversal protection.
- **Automated verification** — `node:test` suites for save migration, draft
  weighting, synergy activation, quadtree/math, game lifecycle, and module
  imports; static check script and GitHub Actions CI.

### Changed

- Reorganized the monoliths into `src/engine`, `src/entities`, `src/systems`,
  `src/ui`, `Game.js`, and a thin `main.js` boot/controller layer.
- Save schema upgraded to v3 with validation, score sanitization, settings,
  run aggregates, ship cosmetics, and career totals while migrating v1/v2 data.
- Rewrote the menu and HUD for the 2.0 visual system, including keyboard and
  gamepad navigation for drafts and menus.
- Reworked audio with independent music/SFX buses, mute, ducking, and low-HP
  state.
- Rebalanced threat escalation, spawn cadence, boss scaling, and elite odds.
- Unified touch, mouse/keyboard, and gamepad input behind semantic actions.
- Improved camera projection, dash feedback, overcharge pickup visibility, and
  volatile explosion telegraphs.

### Fixed

- Spent draft rerolls are no longer refunded when a pick raises the reroll cap;
  only newly granted charges are added.
- Snipers now lock their aim at the end of the telegraph instead of tracking
  through the shot.
- Legacy save loading now prefers the current key and writes migrations back.
- Run records now submit complete score objects and update career totals.
- Headless/automation environments no longer initialize the Gamepad API
  unsafely; use `?nogamepad` to force-disable it.

### Performance

- Reused quadtree nodes for broad-phase collision queries.
- Pooled bullets, enemies, pickups, particles, and UI markup where practical.
- Added adaptive internal resolution, DPR caps, reduced-motion effects, and
  telemetry (`F`) for FPS, frame time, entity counts, and quadtree statistics.

## [1.0.0]

Initial public build: neon twin-stick arena survival with drafting, four
abilities, a wingman, boss encounters, and local high scores.
