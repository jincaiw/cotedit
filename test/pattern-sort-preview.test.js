import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { delimitedSortKeyRange, regexSortKeyRange } from '../lib/pattern-sort-preview.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('CSV-style pattern sort preview reports the exact trimmed 1-based field range', () => {
  assert.deepEqual(delimitedSortKeyRange('name,  beta  ,3', ',', 2), { from: 7, to: 11 });
  assert.deepEqual(delimitedSortKeyRange('a||  b ||c', '||', 2), { from: 5, to: 6 });
  assert.deepEqual(delimitedSortKeyRange('left\tright', '\t', 2), { from: 5, to: 10 });
});

test('delimited pattern sort preview distinguishes empty, whitespace-only, and missing columns', () => {
  assert.deepEqual(delimitedSortKeyRange('left,,right', ',', 2), { from: 5, to: 5 });
  assert.equal(delimitedSortKeyRange('left,   ,right', ',', 2), null);
  assert.equal(delimitedSortKeyRange('left,right', ',', 3), null);
  assert.equal(delimitedSortKeyRange('a,b', ',', 0), null);
  assert.deepEqual(delimitedSortKeyRange('left,right', '', 2), { from: 5, to: 10 });
});

test('regular-expression pattern sort preview identifies the full match and requested capture by UTF-16 range', () => {
  const regexp = /^(\p{L}+):(\d+)$/du;
  const sample = 'éclair:42';
  assert.deepEqual(regexSortKeyRange(regexp, sample), { from: 0, to: sample.length });
  assert.deepEqual(regexSortKeyRange(regexp, sample, 1), { from: 0, to: 6 });
  assert.deepEqual(regexSortKeyRange(regexp, sample, 2), { from: 7, to: 9 });
  assert.equal(regexSortKeyRange(regexp, sample, 3), null);
  assert.equal(regexSortKeyRange(/z(a)?/du, 'z', 1), null, 'an unmatched optional capture has no range');
  assert.equal(regexSortKeyRange(/x/du, 'sample'), null);
});

test('pattern-sort dialog safely highlights only the sample range and keeps preview text accessible', () => {
  assert.match(renderer, /function renderPatternSortSample\(sample, range\)[\s\S]*?createElement\('mark'\)[\s\S]*?replaceChildren/);
  assert.match(renderer, /getDelimitedSortKeyRange\(line, delimiter, column\)/);
  assert.match(renderer, /getRegexSortKeyRange\(regexp, line, useCapture \? captureIndex : 0\)/);
  assert.match(renderer, /renderPatternSortSample\(sample, draft\.error \? null : draft\.options\.getRange\(sample\)\)/);
  assert.match(html, /id="pattern-sort-sample-line"[^>]*aria-describedby="pattern-sort-sample-description"/);
  assert.match(html, /id="pattern-sort-sample-description" class="sr-only">高亮部分为排序键。/);
  assert.doesNotMatch(html, /id="pattern-sort-sample-line"[^>]*aria-label=/);
  assert.match(styles, /\.pattern-sort-key-highlight\s*\{[^}]*background:\s*var\(--accent-soft\)/);
});
