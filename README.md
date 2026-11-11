<div align="center">
  <img src="assets/icon.svg" width="112" alt="PROTOCOL: SWARM sigil">
  <h1>PROTOCOL: SWARM <sup>2.0</sup></h1>
  <p><strong>A neon twin-stick roguelite built with zero runtime dependencies.</strong><br>
  Draft modules. Stack synergies. Break the swarm.</p>
  <p>
    <a href="https://firstgametesting.vercel.app"><strong>▶ PLAY THE LIVE BUILD</strong></a>
    ·
    <a href="docs/GAMEPLAY.md">Gameplay guide</a>
    ·
    <a href="docs/ARCHITECTURE.md">Architecture</a>
  </p>
</div>

---

## What is PROTOCOL: SWARM?

PROTOCOL: SWARM is a browser-native arena survival game. You pilot a prototype
frame against an escalating swarm, chaining kills for score and drafting
protocol modules on every level-up. Runs are short, builds snowball, and the
grid always wins eventually — the goal is to make it work for its victory.

Version **2.0** is a full systems and presentation upgrade over the original:
four starting doctrines, five synergy families, elite affixes, a second boss,
combo scoring, a permanent Meta Lab, a tabbed command deck, offline support,
and a modular engine that is testable outside the browser.

Everything runs on **vanilla ES modules, Canvas 2D, and WebAudio**. No frame-
work, no build step, no runtime packages, no network calls.

## Highlights

| System | What it adds |
| --- | --- |
| **Doctrines** | Vanguard, Lancer, Warden, and unlockable Phantom each inject a distinct opening build. |
| **Synergy matrix** | Module tags (Ballistic, Phase, Tech, Bio, Command) auto-install bonuses at 4 / 8 / 12 stacks. |
| **Elite swarm** | After 40 seconds, elites roll Armored, Volatile, or Swift affixes with health bars and rewards. |
| **Two bosses** | THE ARCHITECT and THE WARDEN alternate every 105 seconds, with Prime and Omega variants. |
| **Combo scoring** | Chained kills scale score up to 4×; taking a hit breaks half the chain. |
| **Meta Lab** | Spend salvaged credits on permanent unlocks, including the Phantom frame. |
| **Command deck** | Deploy, Hangar, Meta Lab, Archive, and Settings tabs with onboarding and career records. |
| **Offline PWA** | Installable, precached app shell and icons; the game opens without a connection. |
| **Adaptive rendering** | Auto resolution scaling, reduced-motion support, scanline toggle, and a quadtree telemetry overlay. |

## Quick start

Requires **Node.js 18+** (or any static file server).

```bash
git clone https://github.com/ayan27612-oss/Game1.git
cd Game1
npm start
# open http://127.0.0.1:8080
```

`npm start` runs the included zero-dependency static server. To use Python
instead:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. A local server is required because the game
uses ES modules and a service worker; opening `index.html` via `file://` will
not work.

### Debug hooks

Append `?debug` to expose `window.__PROTOCOL_SWARM__` for automation:

- `?debug` — game/save/menu/HUD handles and draft helpers
- `?nogamepad` — skip Gamepad API polling (useful in headless browsers)
- `F` — performance telemetry overlay
- `` ` `` — quadtree visualization

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | `WASD` / arrow keys | Left stick | Left virtual stick |
| Aim | Mouse / right stick | Right stick | Right virtual stick |
| Fire | Hold left mouse button | RT / RB | Right virtual stick |
| Dash | `Space` | A / Cross | DASH button |
| Nova Burst | `Q` | X / Square | NOVA button |
| Aegis Field | `E` | Y / Triangle | AEGIS button |
| Overdrive | `R` | B / Circle | DRIVE button |
| Time Warp | `C` | LB / L1 | WARP button |
| Pause | `P` / `Esc` | Start | Pause HUD button |
| Reroll draft | `4` | — | Reroll button |
| Scanlines | `T` | — | Settings |
| Mute | `M` | — | Settings / HUD |

Touch controls appear automatically on touch devices. The game is designed for
landscape play and requests fullscreen when launched from the UI.

## Game systems

### Doctrines

Each run starts with one frame. Doctrine choice is permanent for the run and
cannot be changed by drafting.

| Doctrine | Role | Opening identity |
| --- | --- | --- |
| **Vanguard** | Balanced | +25 hull, +6% armor, +5% fire rate |
| **Lancer** | Glass cannon | +18% damage, +8% fire rate, +6% crit, −12 hull |
| **Warden** | Bulwark | +45 hull, +12% armor, −10% cooldowns, −8% fire rate |
| **Phantom** | Evasion | +1 dash charge, +12% move speed, +0.06s i-frames, −20 hull |

Phantom is unlocked permanently in the Meta Lab.

### Synergy tiers

Every drafted module carries one or more tags. Reaching a threshold installs a
bonus automatically; thresholds are checked after each pick.

| Tag | 4 stacks | 8 stacks | 12 stacks |
| --- | --- | --- | --- |
| **Ballistic** | Kinetic Array: +12% damage | Railnet: +1 pierce, +10% bullet speed | Siege Protocol: +25% damage, +1 pierce |
| **Phase** | Vector Control: −15% dash recharge | Phase Reservoir: +1 dash charge | Zero Point: +20% dash speed, −10% cooldowns |
| **Tech** | Circuit Bloom: +12% ability power, −8% cooldowns | Drone Link: +1 orbital blade | Singularity Core: +25% ability power, +1 chain arc |
| **Bio** | Nanite Bloom: +25 max hull and heal 25 | Regenerative Matrix: +1.2 hull/s | Immortal Shell: +60 hull, +2 hull/s |
| **Command** | Tactical Uplink: +15% XP, +40 pickup radius | Squad Doctrine: +35% wingman damage and rate | Fleet Protocol: +1 draft reroll, +20% XP |

A module that carries two tags contributes to both families at once, so
multi-tag epics are the core of high-tier builds.

### Combat and scoring

- Kills add score scaled by the combo multiplier: `1 + combo × 0.04`, capped at
  **4×** at 75 kills.
- The combo timer is 3.4 seconds. Taking damage halves the chain.
- Threat level rises every 45 seconds, increasing spawn pressure and elite
  chance.
- Salvage earned at run end: `floor(score / 100 + level × 3)`, multiplied by
  the Salvage Protocol unlock.
- Bosses arrive every 105 seconds. The first is THE ARCHITECT, the second THE
  WARDEN, alternating thereafter. Repeated encounters gain Prime/Omega names
  and additional health.

### Enemy roster

| Enemy | Threat |
| --- | --- |
| **Swarmer** | Fast filler that closes distance in packs. |
| **Sniper** | Locks a telegraphed line before firing; break line of sight or dash. |
| **Hex** | Anchors area denial with rotating bullet patterns. |
| **Bomber** | Detonates on death; respect the blast radius. |
| **Splitter** | Splits into two smaller swarmers when killed. |
| **Weaver** | Weaves lateral bullet curtains and cuts off escape lanes. |
| **Gunner** | Sustained ranged pressure with tracking bursts. |
| **Elites** | Armored (reduced damage), Volatile (post-death burst), or Swift (speed). |
| **Bosses** | Multi-phase health bars, radial attacks, and summoned escorts. |

## Project structure

```
.
├── index.html              # semantic UI shell: HUD, menu, draft, pause, game over
├── style.css               # neon design system + responsive layout
├── manifest.json           # installable PWA metadata
├── sw.js                   # cached app shell + offline fallback
├── server.js               # zero-dependency local static server
├── src/
│   ├── main.js             # boot, game loop, state machine, UI wiring
│   ├── Game.js             # simulation: director, combat, scoring, camera
│   ├── engine/             # math, quadtree, projection, WebAudio synth
│   ├── entities/           # player, ally, enemy roster, bosses
│   ├── systems/            # upgrades, synergies, doctrines, abilities, particles
│   └── ui/                 # input, menu, HUD, touch rendering
├── test/                   # node:test unit and module-import suites
├── tools/                  # development-only icon renderer
├── docs/                   # gameplay, architecture, deployment notes
└── .github/workflows/ci.yml
```

## Development

```bash
npm test        # node:test suites (save schema, drafts, synergies, engine, game)
npm run check   # syntax checks + manifest + service-worker precache validation
npm run icons   # regenerate PWA PNGs (requires Python 3, Pillow, NumPy)
```

There is no bundler and no install step. `npm test` runs directly against the
same ES modules the browser loads.

### Adding content

1. Add a module to `UPGRADES` in `src/systems/Upgrades.js` with a `tags` array.
2. Add or tune synergy thresholds in `src/systems/Synergies.js`.
3. Add the module to the draft UI automatically through the existing renderer.
4. Run `npm test` and `npm run check`.
5. If you add a new runtime module, add it to the `APP_SHELL` list in `sw.js`
   and bump `VERSION` there for a release.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system map and
rendering pipeline.

## Deployment

The build is plain static files. Any static host works:

- **Vercel** — import the repo, framework preset **Other**, output directory `.`
- **GitHub Pages** — publish the repository root
- **Netlify / Cloudflare Pages** — no build command, publish directory `.`

The included `server.js` is for local development and self-hosting via Node; it
adds sane MIME types, ETags, security headers, and cache policy. It is not
required by static hosts.

For a release, update the version string in `sw.js` so returning players fetch
the new precache, then redeploy. `npm run check` verifies that every precached
path exists. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full host
configuration, release steps, and offline verification.

## Save data and privacy

Progress is stored in `localStorage` under `protocol_swarm_save_v2` using schema
version 3. Older v1 saves migrate automatically. Nothing is uploaded; there is
no analytics, account, or network dependency. Clearing site data resets the
Meta Lab, high scores, and settings.

Settings include music/SFX volume, mute, screen shake, damage numbers, reduced
motion, CRT scanlines, and render quality (`auto` adapts resolution to frame
rate).

## Browser support

Modern evergreen browsers with ES modules, Canvas 2D, and WebAudio:

- Chrome / Edge 90+
- Firefox 90+
- Safari 15+

Gamepad support is optional and degrades gracefully. PWA installation and
offline play require HTTPS (or `localhost`) and a browser with service worker
support. The game remains fully playable if service workers are unavailable.

## Credits

Design, code, and procedural art by the PROTOCOL: SWARM project. Built with
Canvas 2D and WebAudio; no third-party runtime assets.
