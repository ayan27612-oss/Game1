# Architecture

PROTOCOL: WARFORGE 2.1 is a zero-dependency browser game built with native ES
modules, Canvas 2D, and WebAudio. There is no bundler, transpiler, runtime
framework, or network dependency.

## Module graph

```text
index.html
style.css
src/
  main.js                 boot, fixed-stage sizing, state machine, render loop
  Game.js                 simulation, director, combat, scoring, camera, drawing
  engine/
    AudioSynth.js         WebAudio buses, music scheduler, SFX
    MathUtils.js          angles, lerp, clamp, formatting, RNG helpers
    Projection.js         camera tilt and screen-to-world direction mapping
    Quadtree.js           broad-phase enemy indexing
  entities/
    Player.js             Iron Man: stats, movement, dash, aim, heat, weapons
    Ally.js               War Machine: autonomous bursts, missiles, rebuild
    Enemies.js            swarm roster, elites, bosses, managers
  systems/
    Weapons.js            five-weapon rack, projectile patterns, barrage
    Doctrines.js          armor marks and legacy id normalization
    Customization.js      armor frames, palettes, procedural armor drawing
    Particles.js          pooled VFX, shake, flash, aberration, text
    Upgrades.js           save schema v4, meta unlocks, migrations
  ui/
    Input.js              keyboard/mouse/touch/gamepad semantic input
    Touch.js              touch overlay rendering
    Hud.js                live suit HUD, pause and run summary
    Menu.js               command deck, armory, fabricator, settings
```

The browser loads only `main.js`; every other module is imported through the
ES-module graph.

## Boot and lifecycle

`main.js` owns five responsibilities:

1. **Stage sizing.** The logical game is always **1280×720**. The `#app` element
   is letterboxed inside `#shell`, capped at **1600×900**, and receives an inline
   `font-size` of `stageWidth / 128`, so `1em` is exactly ten logical pixels. UI
   CSS is written in `em` and scales with the stage.
2. **Renderer sizing.** Canvas backing stores are `stage CSS size × DPR ×
   qualityScale`, with `view.dpr = canvas.width / 1280`. `worldCanvas` and the
   chromatic-aberration channel canvas match the main canvas. Auto quality
   lowers or restores `resolutionScale` based on smoothed FPS.
3. **State machine.** States are `menu`, `playing`, `paused`, and `gameover`.
   `Menu` owns the briefing overlay and starts a run through its `onStart`
   callback. There is no level-up or draft state.
4. **UI wiring.** Buttons for pause, resume, abort, retry, mute, scanlines, and
   fullscreen are bound in `main.js` and `Menu.js`. The debug handle is exposed as
   `window.__PROTOCOL_WARFORGE__` with `?debug`.
5. **Fixed-step simulation.** The loop accumulates frame time and runs
   `game.update(1/60)` up to five times per frame, then renders with an
   interpolation alpha. Rendering draws into `worldCanvas`, then composites with
   shake, aberration, and flash onto the visible canvas.

`Game` receives `view`, `input`, `audio`, `save`, `mark`, `settings`, and three
callbacks: `onGameOver`, `onThreat`, and `onBoss`. It never touches the DOM.

## Fixed-stage input mapping

`Input` is constructed with the visible canvas and the logical `view`. Pointer
coordinates are converted through `getBoundingClientRect()` into 1280×720 space,
so touch hit-testing and the touch overlay share one coordinate system
regardless of CSS scale or DPR.

Semantic actions:

- `getMove()` — normalized world-space movement from keys, touch stick, or pad.
- `getAimDir()` — optional right-stick or right-thumb direction; `null` means the
  player should auto-aim or use the mouse.
- `isFiring()` — mouse, pad trigger, or touch FIRE.
- `consumeDash()`, `consumeMissile()`, `consumeWeapon()` — edge-triggered actions.
- `mouse` — logical mouse position used for keyboard/mouse aim.

Touch layout is defined once in `TOUCH_LAYOUT` (logical coordinates) and is used
by both hit-testing and `Touch.js` rendering:

| Control | Position | Radius |
| --- | --- | --- |
| FIRE | 1176, 604 | 78 |
| MSL | 1036, 650 | 56 |
| DASH | 1120, 460 | 62 |
| SWAP | 996, 516 | 52 |
| MOVE hint | 190, 600 | 90 |

The left stick is floating: a touch anywhere in the left 54% of the stage starts
it. A touch in the right half that misses an action button starts the optional
aim stick. Auto-aim and auto-fire are on by default for touch and gamepad and can
be disabled in Settings.

## Simulation model

`Game` owns:

- World bounds, camera, projection, and the quadtree.
- Pools for bullets, enemy bullets, and pickups.
- The director: threat, spawn cadence, elites, and bosses.
- Combat resolution: bullet collisions, chains, splash, crits, combo, damage
  totals, and pickups.
- Scoring and `finalizeRun()`.

`Player` is a thin weapons platform. Its `stats` are multipliers and utility
values, while weapon cards own base damage, rate, heat, and projectile shape.
This keeps armor marks, meta unlocks, and weapons independent of one another.

`Weapons.js` exposes:

- `WEAPONS` — five ordered weapon definitions with `id`, `name`, `short`, `key`,
  `color`, `desc`, `fireRate`, `heat`, `recoil`, and `fire(player, game, angle)`.
- `WEAPON_BY_ID` — lookup map.
- `fireWeapon(player, game, angle)` — fires the active weapon and applies heat,
  recoil, cooldown, and overheat.
- `MISSILE_BARRAGE` and `fireBarrage(player, game, angle)` — cooldown-gated
  homing volley.

`Player.update()` consumes input, moves and clamps the suit, updates aim, fires,
launches barrages, cools heat, updates ghosts, and emits thruster trails.
`Player.draw()` delegates to `Customization.drawArmorBody()`.

`Ally` (War Machine) is fully autonomous: it selects targets, closes to range,
fires minigun bursts, launches shoulder missiles, takes contact damage, and
rebuilds eight seconds after being downed.

## Armor marks

`Doctrines.js` exports `ARMOR_MARKS` and helpers:

- `getArmorMark(id)` — normalized lookup, always returns a mark.
- `normalizeMarkId(id)` — maps legacy doctrine ids (`vanguard`, `lancer`,
  `warden`, `phantom`) onto the new marks.
- `isArmorMarkUnlocked(mark, save)` — checks the mark's Fabricator unlock.
- `armorMarkSummary(mark)` — joins bonus lines for UI.

The four marks are Mark III (balanced), Mark XLII (strike), Hulkbuster (siege),
and Bleeding Edge (prototype, locked behind `armor_bleeding_edge`).

`Game` applies meta unlocks first, then the selected mark, then clamps hull to a
minimum and refills it. Locked marks fall back to Mark III.

## Save schema v4

`Upgrades.js` owns persistence:

- **Key:** `protocol_warforge_save_v3`
- **Legacy keys:** `protocol_swarm_save_v2`, `protocol_swarm_save_v1`
- **Version:** `4`

Fields include currency, top-eight score records, unlocks, career aggregates,
ship cosmetics/callsign, selected mark, settings, briefing flag, and
achievements. Loading sanitizes every field: numeric ranges, unlock strings,
score records, callsign characters, settings, and mark ids. Legacy `doctrine`
fields, `level` score fields, and `doctrine_phantom` unlock ids migrate
automatically.

`finalizeRun()` computes salvage, adds currency, appends a score record with
`threat` and `mark`, and is idempotent.

## Audio

`AudioSynth` creates a master compressor, separate music and SFX buses, a lead
delay, and a noise buffer after the first user gesture. The music scheduler is a
25ms interval that schedules steps ahead of the audio clock. SFX are synthesized
per event: repulsor, unibeam, micro missiles, arc, scatter, missile barrage,
minigun, overheat, explosions, impacts, pickups, UI, boss, and game-over cues.
Low hull raises the music tempo; pausing ducks the music bus.

## UI contract

`Hud` reads simulation state and updates DOM ids from `index.html`:

- Suit integrity, callsign, mark, heat, dash pips, missile status.
- Weapon rack, combo chip, threat chip, score/time/kills/bosses.
- War Machine status and boss bar.
- Pause loadout and post-run summary.

`Menu` owns the five-tab command deck:

- Deploy: armor-mark cards, best score, launch, briefing, fullscreen.
- Armory: procedural armor preview, frame/palette/ally/War Machine paint,
  callsign, weapon primer.
- Fabricator: permanent unlocks and career record.
- Archive: run history and field record.
- Settings: audio, auto-fire, visuals, quality, reset save.

Neither class runs simulation code; both are driven by callbacks and save data.

## Performance and rendering

- Fixed logical stage with adaptive canvas backing resolution.
- Pooled bullets, enemy bullets, pickups, particles, and enemies.
- Quadtree broad phase and reused candidate arrays.
- Interpolated render positions for smooth motion at fixed simulation steps.
- Reduced-motion and screen-shake settings scale particle effects.
- Telemetry (`F`) reports FPS, frame time, entity counts, particle pressure, and
  quadtree query/node counts.

## Testing

`node:test` suites run directly against the browser modules:

- **`test/engine.test.js`** — math, angle wrapping, line-circle intersection,
  projection, and quadtree behavior.
- **`test/game.test.js`** — armor-mark profiles, meta unlocks, weapon firing,
  cycling, barrage cooldown, overheat, dash, finalization, and death callbacks.
- **`test/save.test.js`** — schema defaults, legacy migration, sanitization,
  career aggregates, purchases, and reset.
- **`test/modules.test.js`** — clean imports for every runtime module and API
  surface checks for marks, weapons, upgrades, and input layout.

`npm run check` additionally syntax-checks every `.js`/`.mjs` file, validates
JSON, checks manifest icons, and verifies every `sw.js` precache path exists.

## Adding content

### Add a weapon

1. Append a weapon object to `WEAPONS` in `src/systems/Weapons.js` with a unique
   `id` and key, heat cost, fire rate, and a `fire()` pattern using `spawnRound`
   or `game.spawnPlayerBullet()`.
2. Give it a HUD color and short label.
3. Add a synthesized sound method if it needs a distinct cue.
4. Extend `test/modules.test.js` only if the rack shape changes.

### Add an armor mark

1. Append to `ARMOR_MARKS` with an `id`, name, role, color, description, bonus
   strings, and an `apply(player)` function.
2. Add a legacy alias in `LEGACY_MARK_MAP` if it replaces an old id.
3. Add an unlock entry to `META_UNLOCKS` if it should be purchasable.
4. Update the README and gameplay tables.

### Add a Fabricator unlock

1. Append to `META_UNLOCKS` with `id`, `name`, `desc`, `cost`, and `apply(player)`.
2. The menu renders it automatically and `Game` applies owned unlocks at boot.
3. Add a save test if the unlock changes schema or migration behavior.

### Add a runtime module

1. Add the file under `src/`.
2. Add it to `APP_SHELL` in `sw.js` and bump `VERSION`.
3. Import it from the owning module.
4. Run `npm test` and `npm run check`.
