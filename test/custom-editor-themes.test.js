import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_CUSTOM_EDITOR_THEMES,
  normalizeCustomEditorThemes,
  upsertCustomEditorTheme,
  renameCustomEditorTheme,
  removeCustomEditorTheme
} from '../lib/custom-editor-themes.js';

const reservedNames = ['Anura', 'Classic'];
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
test('custom theme manager is accessible and connected to persisted theme selection and editing', () => {
  for (const id of ['builtin-theme-select', 'custom-theme-controls', 'custom-theme-name', 'custom-theme-rename', 'custom-theme-delete', 'custom-theme-colors']) {
    assert.ok(html.includes(`id="${id}"`), `${id} is present`);
  }
  assert.match(html, /id="custom-theme-colors" class="custom-theme-colors" role="group" aria-label="自定义主题颜色"/);
  assert.match(renderer, /cotedit\.cot-themes\.v1/);
  assert.match(renderer, /function syncCustomThemeEditor\(\)/);
  assert.match(renderer, /dataset\.themeSystemRole/);
  assert.match(renderer, /renameCustomEditorTheme\(customEditorThemes/);
  assert.match(renderer, /removeCustomEditorTheme\(customEditorThemes/);
  assert.match(renderer, /handleCustomThemeColorChange/);
  assert.match(styles, /\.custom-theme-color-row input\[type='color'\]/);
});

const normalizeTheme = (value, fallbackName) => value && value.format === 'cottheme'
  ? { ...value, name: typeof value.name === 'string' ? value.name : fallbackName }
  : null;
const theme = name => ({ format: 'cottheme', name, styles: { text: '#ffffff', background: '#000000' } });

test('custom themes normalize, deduplicate case-insensitively, and exclude built-in names', () => {
  assert.deepEqual(normalizeCustomEditorThemes([
    theme('Aurora'), theme('aurora'), theme('Anura'), null, theme('  Mist  ')
  ], normalizeTheme, reservedNames).map(item => item.name), ['Aurora', 'Mist']);
});

test('imports add or replace a named custom theme while enforcing the collection limit', () => {
  const first = upsertCustomEditorTheme([], theme('Aurora'), normalizeTheme, reservedNames);
  const updated = upsertCustomEditorTheme(first, { ...theme('Aurora'), styles: { text: '#eeeeee', background: '#111111' } }, normalizeTheme, reservedNames);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].styles.text, '#eeeeee');
  assert.throws(() => upsertCustomEditorTheme([], theme('Anura'), normalizeTheme, reservedNames), /内置主题重名/);
  const full = Array.from({ length: MAX_CUSTOM_EDITOR_THEMES }, (_, index) => theme(`Theme ${index}`));
  assert.throws(() => upsertCustomEditorTheme(full, theme('One More'), normalizeTheme), /最多保存/);
});

test('custom theme rename validates empty, duplicate and reserved names', () => {
  const themes = [theme('Aurora'), theme('Mist')];
  assert.deepEqual(renameCustomEditorTheme(themes, 'Aurora', 'Dawn', normalizeTheme, reservedNames).map(item => item.name), ['Dawn', 'Mist']);
  assert.throws(() => renameCustomEditorTheme(themes, 'Aurora', ' ', normalizeTheme), /不能为空/);
  assert.throws(() => renameCustomEditorTheme(themes, 'Aurora', 'mist', normalizeTheme), /已被使用/);
  assert.throws(() => renameCustomEditorTheme(themes, 'Aurora', 'Classic', normalizeTheme, reservedNames), /已被使用/);
});

test('removing a custom theme preserves the others and rejects a missing name', () => {
  assert.deepEqual(removeCustomEditorTheme([theme('Aurora'), theme('Mist')], 'aurora', normalizeTheme).map(item => item.name), ['Mist']);
  assert.throws(() => removeCustomEditorTheme([], 'Missing', normalizeTheme), /找不到/);
});
