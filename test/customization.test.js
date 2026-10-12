import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveCotEditorThemeStyles } from '../lib/cot-theme-colors.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeCotEditorTheme } = require('../electron/cot-theme.cjs');
const { findUserScript, loadUserScripts } = require('../electron/script-system.cjs');

test('imports CotEditor theme colors and removes unsafe or unsupported values', () => {
  const theme = normalizeCotEditorTheme({
    name: '  Twilight  ',
    text: { color: '#F1F1F1' },
    background: { color: '#121212' },
    keywords: { color: '#AABBCC' },
    characters: { color: '#123456' },
    insertionPoint: { color: '#112233', usesSystemSetting: true },
    invisibles: { color: '#44556680' },
    highlight: { color: '#778899' },
    comments: { color: 'url(javascript:alert(1))' },
    metadata: { author: 'Test', description: 'A theme description', unexpected: 'ignored' }
  });
  assert.equal(theme.format, 'cottheme');
  assert.equal(theme.name, 'Twilight');
  assert.deepEqual(theme.styles, {
    text: '#f1f1f1', background: '#121212', insertionPoint: '#112233', invisibles: '#44556680',
    highlight: '#778899', keywords: '#aabbcc', characters: '#123456'
  });
  assert.deepEqual(theme.metadata, { author: 'Test', description: 'A theme description', license: undefined, distributionURL: undefined });
  assert.deepEqual(theme.systemSettings, ['insertionPoint']);
});

test('resolves CotEditor system color roles and uses theme-aware fallbacks', () => {
  const theme = normalizeCotEditorTheme({
    text: { color: '#eeeeee', usesSystemSetting: true }, background: { color: '#111111' },
    selection: { color: '#a7caff', usesSystemSetting: true },
    insertionPoint: { color: '#aaaaaa', usesSystemSetting: true },
    highlight: { color: '#5da810', usesSystemSetting: true },
    comments: { color: '#888888', usesSystemSetting: true }
  });
  assert.deepEqual(theme.systemSettings, ['selection', 'insertionPoint', 'highlight']);
  assert.deepEqual(resolveCotEditorThemeStyles(theme), {
    text: '#eeeeee', background: '#111111', selection: 'Highlight', insertionPoint: 'CanvasText', highlight: 'AccentColor', comments: '#888888'
  });
  assert.deepEqual(resolveCotEditorThemeStyles(theme, () => false), {
    text: '#eeeeee', background: '#111111', selection: 'var(--accent)', insertionPoint: 'var(--accent)', highlight: 'var(--accent)', comments: '#888888'
  });
});

test('rejects malformed CotEditor themes and unsafe color syntax', () => {
  assert.throws(() => normalizeCotEditorTheme(null), /JSON 对象/);
  assert.throws(() => normalizeCotEditorTheme({ text: { color: '#000' }, background: { color: '#fff' } }), /必须包含有效的 text.color/);
  assert.throws(() => normalizeCotEditorTheme({ text: { color: 'red' }, background: { color: '#ffffff' } }), /必须包含有效的 text.color/);
});

test('loads only bounded regular JavaScript scripts with stable display names', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cotedit-scripts-'));
  try {
    await writeFile(path.join(directory, 'hello.js'), '// @name: Hello world\nreturn input.text;');
    await writeFile(path.join(directory, 'ignored.txt'), 'not a script');
    await writeFile(path.join(directory, '.hidden.js'), 'return "hidden";');
    await mkdir(path.join(directory, 'nested.js'));
    await writeFile(path.join(directory, 'oversized.js'), 'x'.repeat(300 * 1024));
    const scripts = await loadUserScripts(directory);
    assert.deepEqual(scripts.map(({ id, name }) => ({ id, name })), [{ id: 'hello.js', name: 'Hello world' }]);
    assert.equal(scripts[0].source, await readFile(path.join(directory, 'hello.js'), 'utf8'));
    assert.equal(findUserScript(scripts, 'hello.js'), scripts[0]);
    assert.equal(findUserScript(scripts, '../hello.js'), null);
    assert.equal(findUserScript(scripts, 'missing.js'), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
