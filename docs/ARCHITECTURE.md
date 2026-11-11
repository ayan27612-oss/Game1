# Architecture

PROTOCOL: SWARM 2.0 is a zero-dependency browser game. It uses native ES
modules, a single Canvas 2D renderer, and WebAudio. There is no build step,
bundler, framework, or runtime package.

## Design goals

1. **Instant deployment** — static files, any host, no toolchain.
2. **Deterministic simulation** — fixed 60 Hz updates with interpolated render.
3. **Testable core** — gameplay systems import cleanly in Node without a DOM.
4. **Bounded allocations** — pools for bullets, pickups, particles, and
   enemies; a reused quadtree.
5. **Graceful enhancement** — gamepad, touch, PWA, and haptics are optional.

## Module map

```
index.html               DOM shell: HUD, menu tabs, draft, pause, game over
style.css                design system, responsive layout, reduced-motion rules
src/main.js              boot, frame loop, UI state machine, wiring
src/Game.js              simulation core, director, combat, scoring, render world
src/engine/
  MathUtils.js           scalar/vector/angle/segment helpers, formatTime
  Projection.js          camera tilt, aim projection, screen-to-world vectors
  Quadtree.js            broad-phase spatial index with reused nodes
  AudioSynth.js          procedural music/SFX, buses, ducking, low-HP state
src/entities/
  Player.js              player stats, dash, abilities, heat, damage, revive
  Ally.js                wingman AI and support fire
  Enemies.js             enemy roster, elites, bosses, spawn manager
src/systems/
  Upgrades.js            module pool, rarity weighting, drafts, save data
  Synergies.js           tag counting, tier table, activation
  Doctrines.js           starting frames and unlock rules
  Abilities.js           ability definitions and key bindings
  Particles.js           pooled particles, shake, flash, aberration
  Customization.js       hull/palette data and ship drawing
src/ui/
  Input.js               semantic input for keyboard/mouse/touch/gamepad
  Menu.js                command deck, settings, briefing, hangar
  Hud.js                 live HUD, draft, pause, game over, banners
  Touch.js               virtual sticks and touch buttons
```

`main.js` is the only browser-entry module. Everything under `src/engine`,
`src/entities`, `src/systems`, and even `src/ui` can be imported in Node for
tests because DOM access happens inside constructors or methods, not at module
load time.

## Boot sequence

1. `index.html` loads `src/main.js` as a module.
2. `main.js` creates the world canvas, offscreen composition canvases, input,
   audio, save data, HUD, and menu.
3. The menu is shown. No game simulation exists yet.
4. Starting a run constructs `Game`, applies meta unlocks and the selected
   doctrine, then enters the `playing` state.
5. The service worker registers after `load` when the origin is HTTP(S).

UI state is one of `menu`, `playing`, `levelup`, `paused`, or `gameover`.
`main.js` owns this state; `Game` never changes UI state directly, it emits
callbacks (`onLevelUp`, `onGameOver`, `onSynergy`, `onThreat`, `onBoss`).

## Frame loop

`main.js` runs `requestAnimationFrame` and accumulates elapsed time:

```text
poll input
update quality scaling (auto mode)
while accumulator >= 1/60 and playing:
  game.update(1/60)
  accumulator -= 1/60
alpha = accumulator / step
render(alpha)
update HUD
```

The simulation always advances in fixed 1/60s ticks, capped at five catch-up
steps to avoid a spiral of death. Rendering interpolates entity previous
positions using `alpha`, so motion remains smooth on 90/120 Hz displays.

## Simulation order

`Game.update(dt)` deliberately orders work so queries see consistent state:

1. Advance elapsed time; decay combo.
2. Set elite spawn chance from threat/time.
3. Apply threat escalation.
4. Snapshot previous positions for render interpolation.
5. Update player and wingman.
6. Move camera.
7. Run the director (spawn waves, specialists, bosses).
8. Update enemies (slowed by Time Warp).
9. Rebuild the quadtree from live enemies.
10. Resolve enemy contact damage.
11. Update bullets and hits (player and enemy).
12. Update pickups, orbitals, and singularities.
13. Update particles/audio state; clean up dead entities.
14. Record quadtree statistics for telemetry.

Player bullets use swept segment queries (`lineCircle`) against quadtree
candidates, preventing tunneling at high projectile speeds.

## Rendering pipeline

The renderer composes into two offscreen canvases:

1. **World canvas** — background grid, arena, pickups, particles, enemies,
   bullets, player, wingman, and world-space effects.
2. **Channel canvas** — used for cheap RGB channel separation when the
   aberration effect is active.

The final canvas then applies:

- camera shake offset,
- optional additive aberration,
- full-screen hit flash,
- optional telemetry overlay,
- touch controls on a separate transparent canvas.

The camera uses `CAMERA_ZOOM = 0.92` and `CAM_TILT = 0.72`. Vertical screen
movement is divided by the tilt when converting to world space, which keeps aim
and movement visually aligned.

CSS handles scanlines, vignette, glass panels, and reduced motion. The "quality"
setting scales only internal resolution; UI remains at device resolution.

## Input model

`Input` exposes semantic actions rather than raw events:

- `getMove()` — normalized world-space movement vector
- `getAim()` / `aimAngle` — aim target
- `isFiring()`
- `consumeDash()`
- `consumeAbilities()`
- `padUi` — edge-triggered menu navigation

Keyboard, mouse, touch, and gamepad feed the same interface. Gamepad polling is
deferred until a `gamepadconnected` event. It is forcibly disabled in
`navigator.webdriver`, headless Chrome, and `?nogamepad` environments where
enumeration can crash embedded Chromium.

## Entity and collision model

- Enemies, bullets, pickups, and particles are pooled or preallocated.
- The quadtree is rebuilt each tick from live enemies; node structure is reused.
- Queries inflate by `Quadtree.MAX_RADIUS` to account for moving enemies between
  rebuilds, then perform exact circle tests on candidates.
- Bosses and elites are ordinary enemies with additional flags, phases, and
  draw/update branches.

## Progression and persistence

`src/systems/Upgrades.js` owns the module table and save schema.

- Modules are data objects with rarity, max stacks, tags, and an `apply`
  function that mutates player stats.
- `draftUpgrades(player, count, level)` filters maxed modules, weights by
  rarity/level, and applies a small repeat-tag penalty for diversity.
- `SaveData` sanitizes every field loaded from `localStorage`. Save schema is
  version 3, stored under `protocol_swarm_save_v2`; legacy v1 data migrates.
- Career aggregates (`runs`, `totalScore`, `totalKills`, `totalTime`,
  `bestCombo`, `bestLevel`) update when a run is finalized.
- Run finalization is idempotent, so game-over and abort paths cannot double
  award credits.

## Audio

`AudioSynth` builds all music and SFX procedurally with oscillators and noise.
It exposes separate music and SFX gain buses, mute, ducking (draft/pause), and a
low-HP tension layer. Audio initialization is deferred until a user gesture to
satisfy browser autoplay policies. No audio files are loaded.

## PWA and offline behavior

`sw.js` precaches the app shell with a versioned cache name. Navigation uses
network-first with an offline `index.html` fallback; static assets use
stale-while-revalidate. Old caches are deleted on activation.

Release checklist for new modules:

1. Add the runtime file to `APP_SHELL` in `sw.js`.
2. Bump `VERSION` in `sw.js`.
3. Run `npm run check` to verify every precached path exists.
4. Deploy.

## Failure handling

- Missing storage (private mode, quota) falls back to an in-memory save object.
- Corrupt JSON falls back to a fresh save.
- Service worker failure is non-fatal; the game remains playable online.
- Gamepad absence or disabled polling simply hides that input path.
- Audio context failures are isolated; gameplay continues silently.

## Testing strategy

- **Pure systems** — save migration/sanitization, draft weighting, synergy
  activation, math, and quadtree behavior.
- **Game lifecycle** — construction, doctrine/meta application, reroll caps,
  pending level-ups, finalization idempotence, and death callbacks.
- **Module imports** — every runtime ES module is imported in Node to catch
  broken import graphs and top-level DOM assumptions.
- **Static checks** — `scripts/check.mjs` runs `node --check` over every script,
  validates JSON manifests, and verifies service-worker precache coverage.

Browser smoke tests are performed manually or with Playwright against
`?debug`; they are intentionally not part of CI to keep the repository
dependency-free.

## Extension guide

### Add an enemy

1. Subclass `Enemy` in `src/entities/Enemies.js`.
2. Implement `update(dt, game)` and `draw(ctx)`.
3. Register the type in `EnemyManager.spawn()`.
4. Add director scheduling in `Game.director()`.
5. Tune score/XP and elite eligibility.

### Add a module

1. Append to `UPGRADES` with a unique id, rarity, max, tags, description, and
   `apply` callback.
2. If it introduces a new tag, add metadata and tiers in `Synergies.js`.
3. Draft and HUD rendering pick it up automatically.
4. Add a unit test if the apply behavior is non-trivial.

### Add a doctrine

1. Append to `DOCTRINES` with id, name, role, color, bonuses, and `apply`.
2. If locked, add a matching Meta Lab unlock with the same `unlock` id.
3. The menu picker, save validation, and run setup read from the table.
