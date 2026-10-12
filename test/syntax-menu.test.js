import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js';

const require = createRequire(import.meta.url);
const { getMenuItemStates, getSyntaxMenuItemStates } = require('../electron/menu-state.cjs');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('hidden syntax menu preferences default to visible and normalize unique safe identifiers', () => {
  assert.deepEqual(DEFAULT_SETTINGS.hiddenSyntaxes, []);
  assert.deepEqual(normalizeSettings({ hiddenSyntaxes: ['javascript', 'JavaScript', 'cot-syntax-awk-a1b2c3d4e5', 'bad id', '../path', 42] }).hiddenSyntaxes,
    ['javascript', 'cot-syntax-awk-a1b2c3d4e5']);
  assert.equal(normalizeSettings({ hiddenSyntaxes: 'javascript' }).hiddenSyntaxes.length, 0);
  const many = Array.from({ length: 230 }, (_, index) => `mode-${index}`);
  assert.equal(normalizeSettings({ hiddenSyntaxes: many }).hiddenSyntaxes.length, 200);
});

test('native syntax menu hides selected built-in and imported modes without losing their active check state', () => {
  assert.deepEqual(getSyntaxMenuItemStates([
    'menu-syntax-javascript', 'menu-syntax-plaintext', 'menu-syntax-cot-syntax-awk-a1b2c3d4e5', 'menu-encoding-utf8'
  ], {
    hasDocument: true,
    language: 'javascript',
    hiddenSyntaxes: ['javascript', 'cot-syntax-awk-a1b2c3d4e5', '../invalid']
  }), {
    'menu-syntax-javascript': { enabled: true, checked: true, visible: false },
    'menu-syntax-plaintext': { enabled: true, checked: false, visible: true },
    'menu-syntax-cot-syntax-awk-a1b2c3d4e5': { enabled: true, checked: false, visible: false }
  });
  assert.equal(getSyntaxMenuItemStates(['menu-syntax-json'], { hasDocument: false })['menu-syntax-json'].enabled, false);
  assert.ok(main.includes("getSyntaxMenuItemStates(menuItemIds('menu-syntax-'), state)"));
  assert.ok(main.includes('item.visible = visible'));
});

test('customize-syntax-menu action is routed from Format > Syntax through preload and renderer', () => {
  assert.match(main, /label: '自定义语法菜单…', click: \(\) => sendCommand\('menu:customize-syntax-menu'\)/);
  assert.ok(preload.includes("'menu:customize-syntax-menu'"));
  assert.match(renderer, /'menu:customize-syntax-menu': showSyntaxMenuDialog/);
  for (const id of ['syntax-menu-dialog', 'syntax-menu-filter', 'syntax-menu-list', 'syntax-menu-show-all', 'syntax-menu-cancel', 'syntax-menu-apply']) {
    assert.ok(index.includes(`id="${id}"`), `syntax menu dialog is missing ${id}`);
  }
  assert.match(renderer, /settings\.hiddenSyntaxes/);
  assert.match(renderer, /function applySyntaxMenuDialog\(\)/);
  assert.match(renderer, /function filterSyntaxMenuDialog\(\)/);
});

test('file-mapping conflict report is routed and enabled only when duplicated mappings exist', () => {
  const id = 'menu-show-file-mapping-conflicts';
  assert.deepEqual(getMenuItemStates({ hasMappingConflicts: false })[id], { enabled: false });
  assert.deepEqual(getMenuItemStates({ hasMappingConflicts: true })[id], { enabled: true });
  assert.match(main, /label: '显示文件映射冲突…', click: \(\) => sendCommand\('menu:show-file-mapping-conflicts'\)/);
  assert.ok(preload.includes("'menu:show-file-mapping-conflicts'"));
  assert.match(renderer, /'menu:show-file-mapping-conflicts': showSyntaxMappingConflictDialog/);
  assert.match(renderer, /findSyntaxMappingConflicts\(customSyntaxes, LANGUAGE_OPTIONS\)/);
  assert.match(renderer, /hasMappingConflicts: hasSyntaxMappingConflicts\(\)/);
  assert.match(renderer, /if \(!\$\('#syntax-menu-dialog'\)\.open\) draftHiddenSyntaxes = null;/);
  assert.ok(renderer.includes("'menu:reset-syntax': () => activeDoc && changeLanguage(languageForDocument(activeDoc.name, activeDoc.text))"));
  assert.ok(renderer.includes("language: item.language || languageForDocument(item.name || '恢复文稿.txt', item.text)"));
  for (const elementId of ['syntax-mapping-conflicts-dialog', 'syntax-mapping-conflict-tables', 'syntax-mapping-conflicts-close']) {
    assert.ok(index.includes(`id="${elementId}"`), `mapping conflict report is missing ${elementId}`);
  }
});

test('syntax names share locale-aware natural sorting across bundled and imported modes', () => {
  assert.match(renderer, /const syntaxMenuCollator = new Intl\.Collator\(undefined, \{ usage: 'sort', numeric: true, sensitivity: 'base' \}\)/);
  assert.match(renderer, /sortLabel: syntax\.name/);
  assert.match(renderer, /\.sort\(\(a, b\) => syntaxMenuCollator\.compare\(a\.sortLabel \|\| a\.label, b\.sortLabel \|\| b\.label\)\)/);
});

test('CotEditor syntax packages can be dropped onto the syntax list without switching the active document', () => {
  assert.match(index, /id="syntax-menu-drop-hint"[^>]*role="status"[^>]*aria-live="polite"[^>]*>[^<]*\.cotsyntax/);
  assert.match(index, /id="syntax-menu-list"[^>]*role="group"/);
  assert.match(styles, /\.syntax-menu-list\.is-import-drop-target[^\{]*\{[^}]*var\(--accent\)/);
  assert.match(preload, /onSyntaxPackageDrop: \(callback\) =>[\s\S]*?webUtils\.getPathForFile\(file\)[\s\S]*?ipcRenderer\.invoke\('syntax:import-dropped', directories\)/);
  assert.match(main, /ipcMain\.handle\('syntax:import-dropped', async \(_event, directories\) => loadCotEditorSyntaxPackages\(directories\)\)/);
  assert.match(renderer, /onSyntaxPackageDrop\?\.\(handleSyntaxPackageDrop\)/);
  assert.match(renderer, /registerImportedCotEditorSyntaxes\(result\.packages, \{ rejectOverflow: true \}\)/);
  assert.match(renderer, /function registerImportedCotEditorSyntaxes\([\s\S]*?if \(activate && activeDoc\) changeLanguage/);
});
