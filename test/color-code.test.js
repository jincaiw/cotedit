import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_CODE_FORMATS, colorPickerHex, formatColorCode, parseColorCode, withColorAlpha } from '../lib/color-code.js';

test('parses all CotEditor-style hexadecimal lengths and retains detected format/case', () => {
  assert.deepEqual(parseColorCode('#abc'), { r: 170, g: 187, b: 204, a: 1, format: 'shortHex', uppercase: false });
  assert.deepEqual(parseColorCode('#ABCD'), { r: 170, g: 187, b: 204, a: 0.8666666666666667, format: 'shortHexAlpha', uppercase: true });
  assert.deepEqual(parseColorCode('#112233'), { r: 17, g: 34, b: 51, a: 1, format: 'hex', uppercase: false });
  assert.deepEqual(parseColorCode('#A1B2C380'), { r: 161, g: 178, b: 195, a: 128 / 255, format: 'hexAlpha', uppercase: true });
  assert.equal(formatColorCode(parseColorCode('#AABBCC'), 'hex', true), '#AABBCC');
});

test('parses comma and modern space/slash RGB(A) syntax including percentages', () => {
  assert.deepEqual(parseColorCode('rgba(255, 0, 128, 0.5)'), { r: 255, g: 0, b: 128, a: 0.5, format: 'rgba', uppercase: false });
  assert.deepEqual(parseColorCode('rgb(100% 0% 50% / 25%)'), { r: 255, g: 0, b: 128, a: 0.25, format: 'rgba', uppercase: false });
  assert.equal(formatColorCode(parseColorCode('rgb(12, 34, 56)'), 'rgb'), 'rgb(12, 34, 56)');
});

test('parses HSL hue units and HWB alpha values and converts them to sRGB', () => {
  assert.deepEqual(parseColorCode('hsl(0.5turn 100% 50%)'), { r: 0, g: 255, b: 255, a: 1, format: 'hsl', uppercase: false });
  assert.deepEqual(parseColorCode('hwb(0 0% 0% / 50%)'), { r: 255, g: 0, b: 0, a: 0.5, format: 'hwbAlpha', uppercase: false });
  assert.equal(formatColorCode({ r: 255, g: 0, b: 0, a: 0.5 }, 'hsl'), 'hsl(0, 100%, 50%)');
  assert.equal(formatColorCode({ r: 255, g: 0, b: 0, a: 0.5 }, 'hwbAlpha'), 'hwb(0 0% 0% / 0.5)');
});

test('formats short hexadecimal only when compressible and preserves alpha in fallback formats', () => {
  assert.equal(formatColorCode({ r: 170, g: 187, b: 204, a: 1 }, 'shortHex'), '#abc');
  assert.equal(formatColorCode({ r: 18, g: 52, b: 86, a: 1 }, 'shortHex'), '#123456');
  assert.equal(formatColorCode({ r: 0, g: 204, b: 153, a: 0.5 }, 'shortHexAlpha'), '#00cc9980');
  assert.equal(formatColorCode({ r: 255, g: 0, b: 0, a: 1 }, 'keyword'), 'red');
  assert.equal(formatColorCode({ r: 1, g: 2, b: 3, a: 0.5 }, 'keyword'), '#01020380');
  assert.equal(formatColorCode({ r: 0, g: 0, b: 0, a: 0 }, 'keyword'), 'transparent');
});

test('exposes safe picker values and clamps alpha without mutating the source', () => {
  const source = { r: 20, g: 40, b: 60, a: 0.25 };
  assert.equal(colorPickerHex(source), '#14283c');
  assert.deepEqual(withColorAlpha(source, 2), { r: 20, g: 40, b: 60, a: 1 });
  assert.deepEqual(source, { r: 20, g: 40, b: 60, a: 0.25 });
  assert.equal(COLOR_CODE_FORMATS.length, 11);
});

test('rejects malformed, unsupported, and oversized color codes', () => {
  for (const value of ['', '#12', '#12345', 'rgb(1, 2)', 'hsl(0 10 20%)', 'hwb(0 0% 0% / nope)', 'var(--color)', 'not-a-color', 'x'.repeat(121)]) {
    assert.equal(parseColorCode(value), null, value);
  }
  assert.equal(formatColorCode({ r: NaN, g: 0, b: 0, a: 1 }, 'hex'), null);
  assert.equal(formatColorCode({ r: 0, g: 0, b: 0, a: 1 }, 'unrecognized'), null);
});
