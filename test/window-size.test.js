import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { DEFAULT_WINDOW_SIZE, WINDOW_SIZE_LIMITS, applyWindowSize, isValidWindowSize, normalizeWindowSize } = require('../electron/window-size.cjs');
import { readLastWindowSize, rememberLastWindowSize, resolveWindowSize } from '../lib/window-size-preferences.js';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('default window dimensions preserve the existing desktop footprint and enforce safe bounds', () => {
  assert.deepEqual(DEFAULT_WINDOW_SIZE, { width: 1280, height: 820 });
  assert.deepEqual(WINDOW_SIZE_LIMITS, { minWidth: 860, minHeight: 600, maxWidth: 4000, maxHeight: 4000 });
  assert.deepEqual(normalizeWindowSize({ width: 900.6, height: 900.2 }), { width: 901, height: 900 });
  assert.deepEqual(normalizeWindowSize({ width: 100.6, height: 5001 }), { width: 860, height: 4000 });
  assert.deepEqual(normalizeWindowSize({ width: 1, height: 5001 }), { width: 860, height: 4000 });
  assert.deepEqual(normalizeWindowSize({ width: '1400', height: null }), DEFAULT_WINDOW_SIZE);
  assert.deepEqual(normalizeWindowSize([]), DEFAULT_WINDOW_SIZE);
});

test('window-size application rejects malformed or closed windows and applies valid requests once', () => {
  const calls = [];
  const window = { setSize: (...size) => calls.push(size), isDestroyed: () => false };
  assert.equal(isValidWindowSize({ width: 1280, height: 820 }), true);
  assert.equal(applyWindowSize(window, { width: 1440, height: 960 }), true);
  assert.deepEqual(calls, [[1440, 960]]);
  assert.equal(applyWindowSize(window, { width: 1, height: 960 }), false);
  assert.equal(applyWindowSize({ ...window, isDestroyed: () => true }, { width: 1440, height: 960 }), false);
  assert.equal(applyWindowSize({}, { width: 1440, height: 960 }), false);
  assert.deepEqual(calls, [[1440, 960]]);
});

test('blank width or height follows the last actual size and first launch retains the established default', () => {
  assert.deepEqual(resolveWindowSize({ width: null, height: null }, null), DEFAULT_WINDOW_SIZE);
  assert.deepEqual(resolveWindowSize({ width: 1480, height: null }, { width: 1360, height: 920 }), { width: 1480, height: 920 });
  assert.deepEqual(resolveWindowSize({ width: null, height: 700 }, { width: 1360, height: 920 }), { width: 1360, height: 700 });
  assert.deepEqual(resolveWindowSize({ width: 500, height: 5001 }, { width: 1360, height: 920 }), { width: 860, height: 4000 });
});

test('last actual window size is stored only in the existing local preference storage and malformed values fall back safely', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  assert.deepEqual(readLastWindowSize(storage), DEFAULT_WINDOW_SIZE);
  assert.equal(rememberLastWindowSize(storage, { width: 1440, height: 980 }), true);
  assert.deepEqual(readLastWindowSize(storage), { width: 1440, height: 980 });
  assert.equal(rememberLastWindowSize(storage, { width: 10, height: 980 }), false);
  values.set('cotedit.last-window-size.v1', '{broken');
  assert.deepEqual(readLastWindowSize(storage), DEFAULT_WINDOW_SIZE);
});

test('renderer and main process connect the persisted preference through a narrow size-only IPC', () => {
  const main = readFileSync(resolve(projectRoot, 'electron/main.cjs'), 'utf8');
  const preload = readFileSync(resolve(projectRoot, 'electron/preload.cjs'), 'utf8');
  const renderer = readFileSync(resolve(projectRoot, 'src/main.js'), 'utf8');
  const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
  assert.match(main, /show: false/);
  assert.match(main, /ipcMain\.handle\('window:set-size',[\s\S]{0,260}appWindows\.has\(window\)[\s\S]{0,180}applyWindowSize\(window, size\)/);
  assert.match(main, /ipcMain\.handle\('window:show-ready',[\s\S]{0,600}window\.show\(\)/);
  assert.match(main, /window\.webContents\.send\('window:size-changed', \{ width, height \}\)/);
  assert.match(preload, /setWindowSize: \(size\) => ipcRenderer\.invoke\('window:set-size', size\)/);
  assert.match(preload, /showWindowWhenReady: \(\) => ipcRenderer\.invoke\('window:show-ready'\)/);
  assert.match(preload, /onWindowSizeChanged: \(callback\)/);
  assert.match(renderer, /resolveWindowSize\(settings, readLastWindowSize\(localStorage\)\)/);
  assert.match(renderer, /onWindowSizeChanged\?\.\(scheduleRememberWindowSize\)/);
  assert.match(html, /id="window-width-setting" min="860" max="4000"/);
  assert.match(html, /id="window-height-setting" min="600" max="4000"/);
  assert.match(html, /placeholder="上次"/);
  const applySettingsBody = renderer.split('function applySettings() {')[1]?.split('\nfunction applyCustomEditorThemeStyles()')[0];
  assert.ok(applySettingsBody);
  assert.doesNotMatch(applySettingsBody, /syncDefaultWindowSize/);
  assert.match(renderer, /registerEvents\(\);\s*void createEditor\(\)\.then\(async/);
  assert.match(renderer, /await syncDefaultWindowSize\(\);\s*await window\.cotedit\?\.showWindowWhenReady\?\.\(\)/);
  const importSettingsBody = renderer.match(/async function importSettingsFile\(\) \{([\s\S]*?)function renderRemoteEditingStatus/);
  assert.ok(importSettingsBody?.[1]?.includes('syncDefaultWindowSize()'));
});
