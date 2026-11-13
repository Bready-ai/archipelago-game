import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pagesBase } from './pages-base.js';
const dist = path.resolve('dist');
const base = pagesBase({ basePath: process.env.VITE_BASE_PATH, repository: process.env.GITHUB_REPOSITORY });
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
let checked = 0;
for (const [, url] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  if (/^(?:https?:|#|data:)/.test(url)) continue;
  assert.ok(url.startsWith(base), `Incorrect Pages base: ${url}; expected ${base}`);
  await access(path.join(dist, decodeURI(url.slice(base.length).split(/[?#]/)[0])));
  checked++;
}
for (const name of await readdir(path.join(dist, 'assets'))) {
  if (!name.endsWith('.css') && !name.endsWith('.js')) continue;
  const source = await readFile(path.join(dist, 'assets', name), 'utf8');
  const urls = name.endsWith('.css') ? [...source.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)] : [...source.matchAll(/(?:from|import)\s*["'](\.\/?[^"']+)["']/g)];
  for (const [, url] of urls) {
    if (/^(?:https?:|data:)/.test(url)) continue;
    const file = url.startsWith(base) ? path.join(dist, url.slice(base.length)) : path.resolve(dist, 'assets', url);
    assert.ok(file.startsWith(dist + path.sep), `Asset leaves dist: ${url}`);
    await access(file); checked++;
  }
}
assert.ok(checked >= 3, 'Expected built modules, stylesheet, and fonts');
console.log(`Verified ${checked} asset references under ${base}`);
