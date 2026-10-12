import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json');

test('sidebar displays the package version instead of a stale hard-coded version', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /<span id="app-version"><\/span>/);
  assert.match(source, /import packageMetadata from '\.\.\/package\.json';/);
  assert.match(source, /\$\('#app-version'\)\.textContent = packageMetadata\.version;/);
  assert.ok(/^\d+\.\d+\.\d+$/.test(packageMetadata.version));
});
