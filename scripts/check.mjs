#!/usr/bin/env node
/** Repository sanity checks: syntax, JSON validity, and offline shell coverage. */
import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKIP = new Set(['.git', 'node_modules', 'coverage']);
const failures = [];
let checked = 0;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile() && (extname(entry.name) === '.js' || extname(entry.name) === '.mjs')) {
      const rel = relative(ROOT, full);
      const result = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      checked++;
      if (result.status !== 0) {
        failures.push(`syntax: ${rel}\n${result.stderr.trim()}`);
      }
    }
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(join(ROOT, file), 'utf8'));
  } catch (err) {
    failures.push(`json: ${file} — ${err.message}`);
    return null;
  }
}

async function main() {
  await walk(ROOT);

  const pkg = await readJson('package.json');
  const manifest = await readJson('manifest.json');
  if (pkg && pkg.type !== 'module') failures.push('package.json must declare "type": "module"');
  if (manifest) {
    if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      failures.push('manifest.json must list icons');
    }
    for (const icon of manifest.icons || []) {
      try {
        await stat(join(ROOT, icon.src));
      } catch (err) {
        failures.push(`manifest icon missing: ${icon.src}`);
      }
    }
  }

  try {
    const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
    const urls = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((match) => match[1]);
    for (const url of new Set(urls)) {
      try {
        await stat(join(ROOT, url));
      } catch (err) {
        failures.push(`service worker precaches missing file: ${url}`);
      }
    }
  } catch (err) {
    failures.push(`sw.js: ${err.message}`);
  }

  if (failures.length) {
    console.error(`check failed (${failures.length}):\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`check ok: ${checked} scripts, manifest + service worker shell verified`);
}

main();
