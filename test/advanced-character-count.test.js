import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { countAdvancedCharacterStrings } from '../lib/unicode-character-info.js';
const require = createRequire(import.meta.url);
const { encodeText } = require('../electron/codec.cjs');

const fixture = 'aaa \t 🐱\n\r\n c';
const count = (options = {}) => countAdvancedCharacterStrings([fixture], options).count;

test('advanced count defaults to grapheme clusters and matches the upstream filtering fixture', () => {
  assert.equal(count(), Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(fixture)).length);
  assert.equal(count({ ignoresNewlines: true }), 9);
  assert.equal(count({ ignoresNewlines: true, ignoresWhitespaces: true }), 5);
  assert.equal(count({ ignoresWhitespaces: true }), 7);
  assert.equal(count({ treatsConsecutiveWhitespaceAsSingle: true }), 7);
  assert.equal(count({ ignoresNewlines: true, treatsConsecutiveWhitespaceAsSingle: true }), 7);
});

test('advanced count supports grapheme, Unicode scalar and UTF-16 units', () => {
  assert.equal(count({ unit: 'scalar' }), 12);
  assert.equal(count({ unit: 'utf16' }), 13);
  assert.equal(count({ unit: 'grapheme' }), count());
});

test('advanced count applies newline and whitespace filters before normalization', () => {
  const text = 'A\u0308\t\u00A0\r\nB';
  assert.equal(countAdvancedCharacterStrings([text], { unit: 'scalar' }).count, 7);
  assert.equal(countAdvancedCharacterStrings([text], { unit: 'scalar', normalizes: true, normalizationForm: 'NFC' }).count, 6);
  assert.equal(countAdvancedCharacterStrings([text], { unit: 'scalar', ignoresNewlines: true, ignoresWhitespaces: true }).count, 3);
  assert.equal(countAdvancedCharacterStrings(['Ｋelvin K'], { unit: 'scalar', normalizes: true, normalizationForm: 'NFKC_CF' }).count, 8);
});

test('advanced count supports CotEditor Modified NFD and Modified NFC forms', () => {
  const options = (normalizationForm) => ({ unit: 'scalar', normalizes: true, normalizationForm });
  assert.equal(countAdvancedCharacterStrings(['Å'], options('NFD')).count, 2);
  assert.equal(countAdvancedCharacterStrings(['Å'], options('MODIFIED_NFD')).count, 1);
  assert.equal(countAdvancedCharacterStrings(['\u0344'], options('NFC')).count, 2);
  assert.equal(countAdvancedCharacterStrings(['\u0344'], options('MODIFIED_NFC')).count, 1);
  const byteResult = countAdvancedCharacterStrings(['\u0344'], {
    unit: 'byte', encoding: 'utf8', normalizes: true, normalizationForm: 'MODIFIED_NFC'
  });
  assert.deepEqual(byteResult.preparedStrings, ['\u0344']);
  assert.equal(encodeText(byteResult.preparedStrings[0], 'utf8').length, 2);
});

test('advanced count dialog groups standard and HFS+ modified normalization forms', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<optgroup label="标准形式">[\s\S]*value="NFKC_CF"[\s\S]*<\/optgroup><optgroup label="HFS\+ 修改型">[\s\S]*value="MODIFIED_NFD"[\s\S]*value="MODIFIED_NFC"[\s\S]*<\/optgroup>/);
  assert.match(html, /aria-label="规范化形式"/);
});

test('multi-selection count sums ranges independently rather than collapsing whitespace across them', () => {
  const result = countAdvancedCharacterStrings(['a ', ' b'], { unit: 'grapheme', treatsConsecutiveWhitespaceAsSingle: true });
  assert.equal(result.count, 4);
  assert.deepEqual(result.preparedStrings, ['a ', ' b']);
});

test('byte count uses the selected encoding and reports unrepresentable content as failure', () => {
  const options = { unit: 'byte', encoding: 'utf8' };
  const prepared = countAdvancedCharacterStrings(['abc犬牛'], options).preparedStrings[0];
  assert.equal(encodeText(prepared, 'utf8').length, 9);
  assert.equal(encodeText(prepared, 'shift_jis').length, 7);
  assert.throws(() => encodeText(prepared, 'ascii'), /无法无损表示/);
  assert.equal(countAdvancedCharacterStrings(['abc犬牛'], options).count, null);
});
