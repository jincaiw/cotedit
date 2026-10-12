import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { decodeBuffer, encodeText, findIncompatibleCharacters, normalizeEncoding, getLineEndings, normalizeLineEndings, dominantLineEnding } = require('../electron/codec.cjs');

const sample = 'CotEdit 中文与 café';

test('decodes UTF-8 and UTF-16 BOMs and preserves BOM metadata', () => {
  assert.deepEqual(decodeBuffer(Buffer.from('plain ASCII')), { text: 'plain ASCII', encoding: 'utf8', bom: false });
  const utf8 = encodeText(sample, 'utf8', true);
  const utf16le = encodeText(sample, 'utf16le', true);
  const utf16be = encodeText(sample, 'utf16be', true);
  assert.deepEqual(decodeBuffer(utf8), { text: sample, encoding: 'utf8', bom: true });
  assert.deepEqual(decodeBuffer(utf16le), { text: sample, encoding: 'utf16le', bom: true });
  assert.equal(decodeBuffer(utf16be).text, sample);
  assert.equal(decodeBuffer(utf16be).encoding, 'utf-16be');
});

test('converts Shift_JIS, GBK, Big5 and Windows encodings', () => {
  for (const [encoding, text] of [
    ['shift_jis', 'これは日本語の文字コードを検査するための十分に長い文章です。変換を確認します。'],
    ['gbk', '这是用于测试中文简体文本编码识别的更长句子。请保持字符串完整。'],
    ['big5', '這是用於測試繁體中文文字編碼辨識的完整句子。請保留原始字詞。']
  ]) {
    assert.equal(decodeBuffer(encodeText(text, encoding)).text, text);
  }
  assert.equal(decodeBuffer(encodeText('café', 'windows-1252')).text, 'café');
  assert.equal(normalizeEncoding('UTF-16BE'), 'utf16-be');
  assert.throws(() => encodeText('emoji 😀', 'windows-1252'), /无法无损表示/);
});

test('lists unique encoding-incompatible characters with first location and occurrence count', () => {
  const report = findIncompatibleCharacters('café 😀 😀\na\u0301', 'windows-1252');
  assert.deepEqual(report, {
    items: [
      { character: '😀', codePoint: 'U+1F600', firstLine: 1, firstColumn: 6, occurrences: 2 },
      { character: '\u0301', codePoint: 'U+0301', firstLine: 2, firstColumn: 2, occurrences: 1 }
    ],
    distinctCount: 2, occurrenceCount: 3, truncated: false
  });
  assert.deepEqual(findIncompatibleCharacters('café', 'windows-1252').items, []);
});

test('incompatible-character scan checks Unicode line separators and bounds displayed items', () => {
  const separators = findIncompatibleCharacters('a\u0085b\u2028c\u2029d', 'ascii');
  assert.deepEqual(separators.items.map(item => [item.codePoint, item.firstLine, item.firstColumn]), [
    ['U+0085', 1, 2], ['U+2028', 2, 2], ['U+2029', 3, 2]
  ]);
  const unique = Array.from({ length: 40 }, (_, index) => String.fromCodePoint(0x1f600 + index)).join('');
  const limited = findIncompatibleCharacters(unique, 'ascii', 12);
  assert.equal(limited.items.length, 12);
  assert.equal(limited.distinctCount, 40);
  assert.equal(limited.truncated, true);
});

test('rejects likely binary data rather than opening it as text', () => {
  const binary = Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]);
  assert.throws(() => decodeBuffer(binary), /二进制文件/);
  const explicitlyOpened = decodeBuffer(binary, { allowBinaryText: true });
  assert.equal(explicitlyOpened.text.includes('\0'), true);
  assert.equal(typeof explicitlyOpened.encoding, 'string');
});

test('extracts and normalizes Unicode NEL, LS and PS line endings', () => {
  const text = 'a\r\nb\rc\nd\u0085e\u2028f\u2029';
  const endings = ['CRLF', 'CR', 'LF', 'NEL', 'LS', 'PS'];
  assert.deepEqual(getLineEndings(text), endings);
  assert.equal(normalizeLineEndings(text), 'a\nb\nc\nd\ne\nf\n');
  assert.equal(dominantLineEnding(['PS', 'NEL', 'NEL'], 'LF'), 'NEL');
});
