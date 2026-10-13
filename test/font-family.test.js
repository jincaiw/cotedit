import test from 'node:test';
import assert from 'node:assert/strict';
import { editorFontFamilyStack, normalizeEditorFontFamily } from '../lib/font-family.js';

test('normalizes safe single font-family names and rejects CSS syntax', () => {
  assert.equal(normalizeEditorFontFamily('  Noto Sans SC  '), 'Noto Sans SC');
  assert.equal(normalizeEditorFontFamily('思源黑体'), '思源黑体');
  assert.equal(normalizeEditorFontFamily(''), '');
  assert.equal(normalizeEditorFontFamily('Arial; color:red'), '');
  assert.equal(normalizeEditorFontFamily('"Arial"'), '');
  assert.equal(normalizeEditorFontFamily('A'.repeat(81)), '');
  assert.equal(normalizeEditorFontFamily(null), '');
});

test('selected families retain the selected standard or monospaced fallback stack', () => {
  assert.equal(editorFontFamilyStack('Noto Sans SC', 'standard'), '"Noto Sans SC", var(--editor-font-standard)');
  assert.equal(editorFontFamilyStack('JetBrains Mono', 'monospaced'), '"JetBrains Mono", var(--editor-font-monospace)');
  assert.equal(editorFontFamilyStack('bad;family', 'monospaced'), 'var(--editor-font-monospace)');
  assert.equal(editorFontFamilyStack('', 'standard'), 'var(--editor-font-standard)');
});

test('font family menu, chooser, persisted setting, and both editor views are connected', async () => {
  const { readFile } = await import('node:fs/promises');
  const [main, menu, preload, html, css] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../electron/preload.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/style.css', import.meta.url), 'utf8')
  ]);
  assert.match(menu, /id: 'menu-show-fonts', label: '显示字体…'/);
  assert.match(preload, /'menu:show-fonts'/);
  assert.match(main, /'menu:show-fonts': showFontPicker/);
  assert.match(main, /root\.style\.setProperty\('--editor-font-family', editorFontFamilyStack\(settings\.fontFamily, fontType\)\)/);
  assert.match(main, /fontTypeByLanguage = setFontTypeOverride\(settings\.fontTypeByLanguage, language, event\.target\.value\)/);
  assert.match(html, /id="font-type-language-setting"[^>]*aria-label="当前语法字体类型"/);
  assert.match(html, /id="font-picker-dialog"[^>]*aria-labelledby="font-picker-title"/);
  assert.match(html, /id="font-family-input"[^>]*maxlength="80"/);
  assert.match(html, /id="font-family-preview"/);
  assert.match(css, /\.cm-editor \{[^}]*font-family: var\(--editor-font-family\)/);
  assert.match(css, /\.cm-editor > \.cm-scroller \{[^}]*font-family: var\(--editor-font-family\)/);
});
