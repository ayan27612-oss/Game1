# Deployment guide

PROTOCOL: WARFORGE is a static site. There is no build command, server-side
runtime, environment variable, or secret. Deploy the repository contents as-is.

## Hosts

### Vercel

1. Import the GitHub repository.
2. Framework preset: **Other**.
3. Build command: leave empty.
4. Output directory: `.`
5. Deploy.

The existing `manifest.json`, `sw.js`, and relative asset paths work from the
site root. The homepage is already configured as
`https://firstgametesting.vercel.app`.

### GitHub Pages

1. Push the release branch.
2. Settings → Pages → Deploy from a branch.
3. Select the branch and `/ (root)`.
4. Save.

If the site is served from a repository subpath, all game paths are relative, so
no base-path rewrite is required. The service worker scope follows its own
location.

### Netlify / Cloudflare Pages

- Build command: none
- Publish directory: `.`

### Self-hosting

```bash
PORT=8080 HOST=0.0.0.0 node server.js
```

`server.js` has no dependencies and supports:

- MIME types for HTML/CSS/JS/JSON/SVG/PNG/fonts/markdown
- weak ETags and `304 Not Modified`
- `HEAD` requests
- content security policy and common hardening headers
- safe path resolution and traversal rejection
- cache policy: `no-cache` for HTML and the service worker, long-lived icons,
  revalidated scripts/styles

Put it behind a TLS-terminating reverse proxy for production. Service workers
require HTTPS except on `localhost`.

## Release checklist

1. Update the version in `package.json`.
2. Update the build label in `index.html` if the visible build number changes.
3. Bump `VERSION` in `sw.js`. **This is required** so returning players receive
   the new precache.
4. If files were added or renamed, update `APP_SHELL` in `sw.js`.
5. Add a `CHANGELOG.md` entry.
6. Run:

   ```bash
   npm run check
   npm test
   ```

7. Manually smoke-test:
   - first load and briefing, including lens flare and title render
   - command deck: armor-mark select, armory loadout, fabricator purchase
   - start run, weapon swap (all five weapons), missile barrage, dash, pause,
     death, retry
   - War Machine companion fires autonomously
   - landscape lock and fullscreen request on a mobile device
   - settings persistence after reload
   - service worker update and offline reload
8. Deploy.

## Save schema

The current save schema is **v4** (`SAVE_VERSION = 4`), stored under
`protocol_warforge_save_v3`. Legacy `protocol_swarm_save_v2`/`_v1` payloads are
migrated on load, including the old doctrine IDs to armor marks
(`vanguard→mark3`, `lancer→mark42`, `warden→hulkbuster`,
`phantom→bleeding_edge`). Never remove a migration step without a major version
bump; a returning player's save must always load.

## Verifying the service worker

In DevTools → Application → Service Workers, confirm the worker is activated and
controls the page. In Cache Storage, confirm a cache named
`protocol-warforge-v<version>` exists.

To test offline:

1. Load the game once and wait for the service worker to activate.
2. Reload so the page is controlled.
3. Switch DevTools Network to **Offline**.
4. Reload again. The command deck should still render and the game should start.

If an asset is missing from `APP_SHELL`, the install still completes because
entries are added independently, but the first offline request for that file
will fail. `npm run check` catches missing precache paths before deployment.

## Cache and update behavior

`sw.js` uses:

- **Navigation requests** — network-first, falling back to the cached
  `index.html`.
- **Static assets** — stale-while-revalidate: serve cache immediately, refresh
  in the background.
- **Activation** — delete every cache that is not the current version.
- **Install** — `skipWaiting()` plus `clients.claim()` so a fresh release takes
  control promptly.

Static hosts may add their own CDN cache headers. If a deploy appears stale,
verify that `sw.js` is served with revalidation/no-cache semantics; the
included Node server does this by default.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Blank page from `file://` | ES modules and service worker require HTTP | Serve over localhost or HTTPS |
| Old build after deploy | `sw.js` version or CDN cache not updated | Bump `VERSION`, hard reload, purge CDN |
| Touch controls missing | Device reports a fine pointer | Use a touch device or emulate touch in DevTools |
| Game renders in portrait | Fullscreen/orientation lock was declined or unsupported | Rotate the device; the stage stays letterboxed at 16:9 either way |
| Letterboxed with black bars | Stage aspect differs from 16:9 | Expected: the fixed stage is capped at 1600×900 |
| No gamepad input | Gamepad polling disabled in automation/headless | Use a normal browser; remove `?nogamepad` |
| Progress reset | Browser storage cleared or different origin | Use the same origin/domain; avoid private mode |
| Audio silent | Autoplay policy before first gesture | Click/tap once; check mute and volume settings |

## Rollback

Static hosting makes rollback straightforward:

1. Redeploy the previous commit.
2. Bump `VERSION` in that build's `sw.js` if clients need to leave a broken
   cache. An unchanged version will keep the newer cached shell until the
   browser revalidates `sw.js`; versioning the cache avoids ambiguity.

Save data is backward compatible via sanitization, but schema changes should
still be additive and guarded by `SAVE_VERSION`.
