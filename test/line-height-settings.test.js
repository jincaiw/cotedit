import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, normalizeLineHeight, normalizeSettings } from '../lib/settings.js';
import { parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';

const project = new URL('../', import.meta.url);
const [html, css, renderer] = await Promise.all([
  readFile(new URL('index.html', project), 'utf8'),
  readFile(new URL('src/style.css', project), 'utf8'),
  readFile(new URL('src/main.js', project), 'utf8')
]);

test('editor line height defaults to CotEditor 1.3 and normalizes to 0.1 steps within 0.1–10', () => {
  assert.equal(DEFAULT_SETTINGS.lineHeight, 1.3);
  assert.equal(normalizeLineHeight(0.01), 0.1);
  assert.equal(normalizeLineHeight(1.26), 1.3);
  assert.equal(normalizeLineHeight(9.96), 10);
  assert.equal(normalizeLineHeight(20), 10);
  for (const value of [undefined, null, '2', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(normalizeLineHeight(value), 1.3);
  }
  assert.equal(normalizeSettings({ lineHeight: 2.26 }).lineHeight, 2.3);
  assert.equal(normalizeSettings({ lineHeight: -4 }).lineHeight, 0.1);
});

test('line height persists and is normalized through settings-file import/export', () => {
  const serialized = serializeSettingsFile({ ...DEFAULT_SETTINGS, lineHeight: 2.7 });
  assert.equal(parseSettingsFile(serialized).lineHeight, 2.7);
  const imported = parseSettingsFile(serialized.replace('"lineHeight": 2.7', '"lineHeight": 12'));
  assert.equal(imported.lineHeight, 10);
});

test('settings panel exposes an explicitly labeled CotEditor-range line-height control', () => {
  assert.match(html, /<label class="setting-row" title="设置编辑器行高为当前字号的倍数。"><span>行高<\/span><div class="line-height-controls"><input type="number" id="line-height-setting" min="0\.1" max="10" step="0\.1" value="1\.3" aria-label="编辑器行高倍数" \/><span aria-hidden="true">×<\/span><\/div><\/label>/);
});

test('renderer applies line height to every editor via inherited CSS and persists valid changes', () => {
  assert.match(css, /\.cm-editor\s*\{[^}]*line-height:\s*var\(--editor-line-height,\s*1\.3\)/);
  assert.match(renderer, /root\.style\.setProperty\('--editor-line-height', String\(settings\.lineHeight\)\)/);
  assert.match(renderer, /\$\('#line-height-setting'\)\.value = settings\.lineHeight\.toFixed\(1\)/);
  assert.match(renderer, /\$\('#line-height-setting'\)\.addEventListener\('change',[\s\S]*?normalizeLineHeight\(value\)[\s\S]*?persistSettings\(\)[\s\S]*?applySettings\(\)/);
  assert.match(renderer, /function verticalColumnStep\(view\)[\s\S]*?fontSize \* settings\.lineHeight/);
});
