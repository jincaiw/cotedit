import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageFiles = new Set(packageJson.build.files);

const settingsRuntimeModules = [
  'lib/shortcuts.js',
  'lib/toolbar-items.js',
  'lib/snippets.js',
  'lib/settings.js',
  'lib/settings-file.js',
  'lib/multiple-replace.js',
  'lib/icu-regexp.js'
];

test('electron-builder includes the complete runtime settings import graph', () => {
  for (const file of settingsRuntimeModules) assert.ok(packageFiles.has(file), `${file} must be included in the packaged app`);
  const packageRoot = fileURLToPath(new URL('..', import.meta.url));
  for (const file of settingsRuntimeModules) assert.ok(readFileSync(`${packageRoot}/${file}`, 'utf8').length > 0, `${file} must exist`);
});
