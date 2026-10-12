import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { calculateOverscrollPadding } from '../lib/overscroll.js';

const require = createRequire(import.meta.url);
const shortcuts = require('../lib/shortcuts.json');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('overscroll padding scales the available editor height and rejects invalid geometry', () => {
  assert.equal(calculateOverscrollPadding(1000, 20, 24, 0), 0);
  assert.equal(calculateOverscrollPadding(1000, 20, 24, 0.5), 477.75);
  assert.equal(calculateOverscrollPadding(1000, 20, 24, 1), 955.5);
  assert.equal(calculateOverscrollPadding(1000, 20, 24, 2), 955.5, 'rate is clamped to 100 percent');
  assert.equal(calculateOverscrollPadding(30, 20, 24, 1), 0, 'small editor heights do not create negative space');
  for (const args of [[NaN, 20, 0, 1], [100, Infinity, 0, 1], [100, 20, -1, NaN]]) {
    assert.equal(calculateOverscrollPadding(...args), 0);
  }
});

test('overscroll setting is accessible, persistent, and reconfigures each editor without a menu shortcut', () => {
  assert.match(html, /<label for="overscroll-rate-setting">文末过度滚动<\/label>/);
  assert.match(html, /id="overscroll-rate-setting" min="0" max="100" step="10" value="0" aria-label="文末过度滚动百分比"/);
  assert.match(renderer, /\$\('#overscroll-rate-setting'\)\.value = String\(Math\.round\(settings\.overscrollRate \* 100\)\)/);
  assert.match(renderer, /\$\('#overscroll-rate-setting'\)\.addEventListener\('change',[\s\S]*?settings\.overscrollRate = Math\.round\(Math\.max\(0, Math\.min\(100, value\)\) \/ 10\) \/ 10;[\s\S]*?persistSettings\(\);[\s\S]*?applySettings\(\)/);

  const extension = renderer.slice(renderer.indexOf('function overscrollExtension()'), renderer.indexOf('function autoIndentExtension()'));
  assert.match(extension, /settings\.overscrollRate/);
  assert.match(extension, /settings\.verticalText/);
  assert.match(extension, /calculateOverscrollPadding\(view\.scrollDOM\.clientHeight, view\.defaultLineHeight, view\.documentPadding\.top, rate\)/);
  assert.match(extension, /EditorView\.contentAttributes\.of\(view => view\.plugin\(plugin\)\?\.attrs/);
  const createState = renderer.slice(renderer.indexOf('function createState('), renderer.indexOf('async function createEditor('));
  assert.match(createState, /overscrollCompartment\.of\(overscrollExtension\(\)\)/);
  const applySettings = renderer.slice(renderer.indexOf('function applySettings()'), renderer.indexOf('function applyCustomEditorThemeStyles()'));
  assert.match(applySettings, /overscrollCompartment\.reconfigure\(overscrollExtension\(\)\)/);
  assert.match(css, /\.cm-content \{ padding: 24px 22px 0 14px;/);
  assert.ok(!shortcuts.some(item => /overscroll/i.test(item.id)), 'CotEditor provides this as a setting, not a keyboard command');
  assert.doesNotMatch(renderer, /menu:overscroll|menu-overscroll/);
});
