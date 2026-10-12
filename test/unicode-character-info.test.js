import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getUnicodeCharacterInfo, getUnicodeScalarInfo } from '../lib/unicode-character-info.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const unicodeData = JSON.parse(readFileSync(new URL('../lib/unicode-character-data.json', import.meta.url), 'utf8'));

test('Unicode metadata provides official names, long general categories and blocks', async () => {
  assert.deepEqual(await getUnicodeScalarInfo(0x0041), {
    codePoint: 0x0041, codePointLabel: 'U+0041', name: 'LATIN CAPITAL LETTER A',
    categoryCode: 'Lu', categoryName: 'Uppercase Letter', blockName: 'Basic Latin', age: '1.1'
  });
  assert.equal((await getUnicodeScalarInfo(0x0301)).name, 'COMBINING ACUTE ACCENT');
  assert.equal((await getUnicodeScalarInfo(0x0301)).categoryName, 'Nonspacing Mark');
  assert.equal((await getUnicodeScalarInfo(0x0000)).name, 'NULL');
  assert.equal((await getUnicodeScalarInfo(0x000A)).name, 'LINE FEED');
});

test('Unicode metadata expands algorithmic Hangul, CJK and Tangut names', async () => {
  assert.equal((await getUnicodeScalarInfo(0xAC00)).name, 'HANGUL SYLLABLE GA');
  assert.equal((await getUnicodeScalarInfo(0x4E00)).name, 'CJK UNIFIED IDEOGRAPH-4E00');
  const extensionH = await getUnicodeScalarInfo(0x31350);
  assert.equal(extensionH.name, 'CJK UNIFIED IDEOGRAPH-31350');
  assert.equal(extensionH.blockName, 'CJK Unified Ideographs Extension H');
  assert.equal((await getUnicodeScalarInfo(0x17000)).name, 'TANGUT IDEOGRAPH-17000');
});

test('Unicode metadata distinguishes unassigned scalars and provides every component of a grapheme', async () => {
  const unassigned = await getUnicodeScalarInfo(0x0378);
  assert.equal(unassigned.name, null);
  assert.equal(unassigned.categoryCode, 'Cn');
  assert.equal(unassigned.age, null);
  const noncharacter = await getUnicodeScalarInfo(0x10FFFF);
  assert.equal(noncharacter.categoryCode, 'Cn');
  assert.equal(noncharacter.age, '2.0', 'Unicode DerivedAge records noncharacters as assigned in Unicode 2.0');
  const family = await getUnicodeCharacterInfo('👩‍👩‍👧‍👦');
  assert.equal(family.length, 7);
  assert.equal(family[0].name, 'WOMAN');
  assert.equal(family[1].name, 'ZERO WIDTH JOINER');
});

test('Unicode Age reports first-assigned version and the character panel renders it per scalar', async () => {
  assert.equal((await getUnicodeScalarInfo(0x1F600)).age, '6.1', 'GRINNING FACE was first assigned in Unicode 6.1');
  assert.equal((await getUnicodeScalarInfo(0x1FAEA)).age, '17.0', 'DISTORTED FACE was first assigned in Unicode 17.0');
  assert.match(renderer, /const age = item\.age \? `<span>Unicode 版本：Unicode \$\{escapeHtml\(item\.age\)\}<\/span>` : ''/);
  assert.match(renderer, /\$\{age\}<\/div><\/div>`/);
});

test('Unicode metadata accepts only a numeric code point or one-code-point string', async () => {
  assert.deepEqual(await getUnicodeScalarInfo('A'), await getUnicodeScalarInfo(0x0041));
  assert.equal((await getUnicodeScalarInfo('𝄞')).codePoint, 0x1D11E);
  for (const value of ['', 'AB', 'e\u0301', '👨‍👩‍👧‍👦', true, {}, 65.5, -1, 0x110000]) {
    assert.equal(await getUnicodeScalarInfo(value), null, `unexpected metadata for ${String(value)}`);
  }
});

test('Unicode 17 generated Age ranges retain source provenance and compact range invariants', () => {
  assert.equal(unicodeData.version, '17.0.0');
  assert.match(unicodeData.sourceHashes?.['DerivedAge.txt'] || '', /^[0-9a-f]{64}$/);
  assert.equal(unicodeData.ages.length, 1788);

  let previousEnd = -1;
  let previousAge = null;
  for (const [start, end, age] of unicodeData.ages) {
    assert.ok(Number.isInteger(start) && Number.isInteger(end));
    assert.ok(start >= 0 && start <= end && end <= 0x10FFFF);
    assert.ok(start > previousEnd, `overlapping or unsorted Age range at U+${start.toString(16).toUpperCase()}`);
    assert.match(age, /^\d+\.\d+$/);
    assert.ok(!(age === previousAge && start === previousEnd + 1), 'adjacent ranges with the same Age should be merged');
    previousEnd = end;
    previousAge = age;
  }
});
