import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js';
import { parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';
import { invisibleCharacterPresentation, invisibleLineEndingPresentation } from '../lib/invisible-characters.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');

test('invisible-character category defaults match CotEditor 7.1.1', () => {
  assert.equal(DEFAULT_SETTINGS.showInvisibles, false);
  assert.deepEqual([
    DEFAULT_SETTINGS.showInvisibleNewLine,
    DEFAULT_SETTINGS.showInvisibleTab,
    DEFAULT_SETTINGS.showInvisibleSpace,
    DEFAULT_SETTINGS.showInvisibleWhitespaces,
    DEFAULT_SETTINGS.showInvisibleControl
  ], [true, true, false, true, true]);
  assert.deepEqual([
    normalizeSettings({}).showInvisibleNewLine,
    normalizeSettings({}).showInvisibleTab,
    normalizeSettings({}).showInvisibleSpace,
    normalizeSettings({}).showInvisibleWhitespaces,
    normalizeSettings({}).showInvisibleControl
  ], [true, true, false, true, true]);
});

test('settings-file import/export round-trips category overrides and rejects non-booleans', () => {
  const overrides = {
    showInvisibles: true,
    showInvisibleNewLine: false,
    showInvisibleTab: false,
    showInvisibleSpace: true,
    showInvisibleWhitespaces: false,
    showInvisibleControl: false
  };
  const normalized = normalizeSettings(overrides);
  assert.deepEqual(parseSettingsFile(serializeSettingsFile(overrides)), normalized);
  assert.deepEqual(normalizeSettings({ showInvisibleSpace: 'yes', showInvisibleControl: 1 }), {
    ...DEFAULT_SETTINGS,
    showInvisibleSpace: false,
    showInvisibleControl: true
  });
});

test('line-ending markers are independently controlled and normalize CRLF to one display glyph', () => {
  assert.deepEqual(invisibleLineEndingPresentation(DEFAULT_SETTINGS), { category: 'line-ending', glyph: '↩', width: 1 });
  assert.equal(invisibleLineEndingPresentation({ showInvisibleNewLine: false }), null);
  for (const codePoint of [0x000a, 0x000d, 0x0085, 0x2028, 0x2029]) {
    assert.deepEqual(invisibleCharacterPresentation(codePoint, DEFAULT_SETTINGS), { category: 'line-ending', glyph: '↩', width: 1 });
  }
});

test('tabs, ASCII spaces, and the three official other-whitespace glyph groups are independently gated', () => {
  assert.deepEqual(invisibleCharacterPresentation(0x0009, DEFAULT_SETTINGS), { category: 'tab', glyph: '→', width: 1 });
  assert.equal(invisibleCharacterPresentation(0x0020, DEFAULT_SETTINGS), null, 'ordinary spaces are hidden by the CotEditor default');
  assert.deepEqual(invisibleCharacterPresentation(0x0020, { ...DEFAULT_SETTINGS, showInvisibleSpace: true }), { category: 'space', glyph: '·', width: 1 });
  for (const codePoint of [0x00a0, 0x2007, 0x202f]) {
    assert.deepEqual(invisibleCharacterPresentation(codePoint, DEFAULT_SETTINGS), { category: 'other-whitespace', glyph: '·̂', width: 1 });
  }
  assert.deepEqual(invisibleCharacterPresentation(0x3000, DEFAULT_SETTINGS), { category: 'other-whitespace', glyph: '□', width: 2 });
  for (const codePoint of [0x2000, 0x2003, 0x200a, 0x205f]) {
    assert.deepEqual(invisibleCharacterPresentation(codePoint, DEFAULT_SETTINGS), { category: 'other-whitespace', glyph: '⹀', width: 1 });
  }
  assert.equal(invisibleCharacterPresentation(0x2003, { ...DEFAULT_SETTINGS, showInvisibleWhitespaces: false }), null);
});

test('C0, DEL, C1 and documented format controls receive visible, identifiable markers', () => {
  assert.equal(invisibleCharacterPresentation(0x0000, DEFAULT_SETTINGS).glyph, '␀');
  assert.equal(invisibleCharacterPresentation(0x001b, DEFAULT_SETTINGS).glyph, '␛');
  assert.equal(invisibleCharacterPresentation(0x007f, DEFAULT_SETTINGS).glyph, '␡');
  assert.deepEqual(invisibleCharacterPresentation(0x0080, DEFAULT_SETTINGS), { category: 'control', glyph: '◇', width: 1, title: 'U+0080' });
  assert.deepEqual(invisibleCharacterPresentation(0x200b, DEFAULT_SETTINGS), { category: 'control', glyph: '◇', width: 1, title: 'U+200B' });
  assert.equal(invisibleCharacterPresentation(0x200d, DEFAULT_SETTINGS), null, 'ZWJ remains intact so emoji and joined scripts keep shaping');
  assert.equal(invisibleCharacterPresentation(0x200b, { ...DEFAULT_SETTINGS, showInvisibleControl: false }), null);
  assert.equal(invisibleCharacterPresentation(0x0041, DEFAULT_SETTINGS), null);
});

test('settings UI, immediate renderer reconfiguration, and View command use the five-category model', () => {
  for (const [id, setting] of [
    ['invisible-newline-setting', 'showInvisibleNewLine'],
    ['invisible-tab-setting', 'showInvisibleTab'],
    ['invisible-space-setting', 'showInvisibleSpace'],
    ['invisible-whitespace-setting', 'showInvisibleWhitespaces'],
    ['invisible-control-setting', 'showInvisibleControl']
  ]) {
    assert.ok(html.includes(`id="${id}"`), `settings UI is missing ${setting}`);
    assert.ok(renderer.includes(`'${id}', '${setting}'`), `renderer change handler is missing ${setting}`);
    assert.ok(renderer.includes(`$('#${id}').checked = settings.${setting}`), `renderer sync is missing ${setting}`);
  }
  assert.match(renderer, /invisibleLineEndingPresentation\(settings\)[\s\S]*?Decoration\.widget\([\s\S]*?side: -1/);
  assert.match(renderer, /invisibleCharacterPresentation\(codePoint, settings\)/);
  assert.match(renderer, /displayCompartment\.reconfigure\(displayExtensions\(\)\)/);
  assert.match(main, /id: 'menu-toggle-invisibles', label: '显示不可见字符', type: 'checkbox', click: \(\) => sendCommand\('menu:toggle-invisibles'\)/);
  const item = main.match(/id: 'menu-toggle-invisibles'[^\n]*/)?.[0] || '';
  assert.doesNotMatch(item, /accelerator:/, 'the CotEditor command has no default shortcut');
});
