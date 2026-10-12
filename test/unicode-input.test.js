import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EditorSelection, EditorState } from '@codemirror/state';
import { normalizeRecentUnicodeCodePoints, parseUnicodeCodePoint, recordRecentUnicodeCodePoint, unicodeCharacterFromCodePointInput } from '../lib/unicode-input.js';

const menu = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('parses CotEditor-style hexadecimal Unicode scalar representations', () => {
  for (const input of ['U+1F600', 'u+1f600', '0x1F600', '\\u1F600', '1f600']) {
    assert.equal(parseUnicodeCodePoint(input), 0x1f600, input);
  }
  assert.equal(parseUnicodeCodePoint(' 0041 '), 0x41);
});

test('accepts the Unicode scalar range including both endpoints', () => {
  assert.equal(parseUnicodeCodePoint('0'), 0);
  assert.equal(parseUnicodeCodePoint('10FFFF'), 0x10ffff);
});

test('rejects malformed, overlong, out-of-range, and surrogate inputs', () => {
  for (const input of ['', 'U+', '0x', 'U+1234567', '12 34', '-1', '+41', '0x110000', 'D800', 'U+DFFF']) {
    assert.equal(parseUnicodeCodePoint(input), null, input);
  }
  assert.equal(parseUnicodeCodePoint(null), null);
  assert.equal(parseUnicodeCodePoint(65), null);
});

test('converts valid supplementary code points to one Unicode character', () => {
  assert.equal(unicodeCharacterFromCodePointInput('U+1F600'), '😀');
  assert.equal(unicodeCharacterFromCodePointInput('U+10FFFF'), String.fromCodePoint(0x10ffff));
  assert.equal(unicodeCharacterFromCodePointInput('U+D800'), null);
});

test('recent Unicode code point history is scalar-only, unique, newest-first and bounded', () => {
  assert.deepEqual(normalizeRecentUnicodeCodePoints([0x41, 0x1f600, 0x41, 0xd800, -1, 0x110000, '66']), [0x41, 0x1f600]);
  assert.deepEqual(normalizeRecentUnicodeCodePoints('not an array'), []);
  const initial = Array.from({ length: 12 }, (_, index) => 0x41 + index);
  assert.deepEqual(normalizeRecentUnicodeCodePoints(initial), initial.slice(0, 10));
  assert.deepEqual(recordRecentUnicodeCodePoint(initial, 0x1f642), [0x1f642, ...initial.slice(0, 9)]);
  assert.deepEqual(recordRecentUnicodeCodePoint([0x41, 0x42], 0x42), [0x42, 0x41]);
  assert.deepEqual(recordRecentUnicodeCodePoint([0x41], 0xdfff), [0x41]);
});

test('inserts one code point at each CodeMirror selection while replacing selected text', () => {
  const state = EditorState.create({
    extensions: EditorState.allowMultipleSelections.of(true),
    doc: 'abcd',
    selection: EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(3)])
  });
  assert.equal(state.update(state.replaceSelection('😀')).state.doc.toString(), 'a😀bc😀d');

  const selected = EditorState.create({ doc: 'abcde', selection: { anchor: 1, head: 3 } });
  assert.equal(selected.update(selected.replaceSelection('😀')).state.doc.toString(), 'a😀de');
});

test('Unicode code point menu is routed to a labelled, live-preview insertion dialog', () => {
  assert.match(menu, /id: 'menu-insert-unicode-code-point', label: '按 Unicode 码点插入…'[\s\S]*?sendCommand\('menu:insert-unicode-code-point'\)/);
  assert.ok(preload.includes("'menu:insert-unicode-code-point'"));
  assert.match(renderer, /'menu:insert-unicode-code-point': showUnicodeCodePointDialog/);
  assert.match(renderer, /function insertUnicodeCodePoint\(event\)[\s\S]*?replaceSelection\(String\.fromCodePoint\(codePoint\)\)/);
  assert.match(html, /<dialog id="unicode-codepoint-dialog"[^>]*aria-labelledby="unicode-codepoint-title"/);
  for (const id of ['unicode-codepoint-input', 'unicode-codepoint-preview', 'unicode-codepoint-label', 'unicode-codepoint-error', 'unicode-codepoint-cancel', 'unicode-codepoint-insert']) {
    assert.ok(html.includes(`id="${id}"`), `Unicode input dialog is missing ${id}`);
  }
  assert.match(renderer, /unicode-codepoint-dialog'\)\.addEventListener\('close',[\s\S]*?activeEditor\(\)\?\.focus\(\)/);
  assert.ok(html.includes('id="unicode-codepoint-history-section"'));
  assert.ok(html.includes('id="unicode-codepoint-history"'));
  assert.match(renderer, /function renderRecentUnicodeCodePoints\(\)[\s\S]*?button\.textContent = label[\s\S]*?input\.value = label/);
  assert.match(renderer, /settings\.recentUnicodeCodePoints = recordRecentUnicodeCodePoint\(settings\.recentUnicodeCodePoints, codePoint\)/);
});

test('CotEditor literal-character menu actions insert a backslash and yen sign', () => {
  for (const [id, channel, label] of [
    ['menu-insert-backslash', 'menu:insert-backslash', '插入反斜线'],
    ['menu-insert-yen-mark', 'menu:insert-yen-mark', '插入日元符号']
  ]) {
    assert.ok(menu.includes(`id: '${id}'`));
    assert.ok(menu.includes(`label: '${label}'`));
    assert.ok(menu.includes(`sendCommand('${channel}')`));
    assert.ok(preload.includes(`'${channel}'`));
  }
  assert.match(renderer, /'menu:insert-backslash': \(\) => insertLiteralText\('\\\\'\)/);
  assert.match(renderer, /'menu:insert-yen-mark': \(\) => insertLiteralText\('¥'\)/);
  assert.match(renderer, /function insertLiteralText\(text\)[\s\S]*?state\.replaceSelection\(text\)/);
  assert.match(menu, /id: 'menu-insert-yen-mark',[^\n]*accelerator: accelerator\('insertYenMark'\)/);
  assert.match(renderer, /insertYenMark: \(\) => insertLiteralText\('¥'\)/);
});
