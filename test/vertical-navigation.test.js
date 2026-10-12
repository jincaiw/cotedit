import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { verticalTextAdjacentPosition } from '../lib/vertical-navigation.js';

test('vertical up and down move by full Unicode grapheme clusters within a column', () => {
  const doc = EditorState.create({ doc: 'A👩‍👩‍👧‍👦e\u0301B' }).doc;
  const familyLength = '👩‍👩‍👧‍👦'.length;
  const accentLength = 'e\u0301'.length;
  assert.equal(verticalTextAdjacentPosition(doc, 0, 'down'), 1);
  assert.equal(verticalTextAdjacentPosition(doc, 1, 'down'), 1 + familyLength);
  assert.equal(verticalTextAdjacentPosition(doc, 1 + familyLength, 'down'), 1 + familyLength + accentLength);
  assert.equal(verticalTextAdjacentPosition(doc, 1 + familyLength, 'up'), 1);
  assert.equal(verticalTextAdjacentPosition(doc, 0, 'up'), 0);
  assert.equal(verticalTextAdjacentPosition(doc, doc.length, 'down'), doc.length);
});

test('vertical left and right traverse neighboring columns at the same grapheme index', () => {
  const doc = EditorState.create({ doc: 'A👩‍👩‍👧‍👦B\nx👩‍👩‍👧‍👦yz\nshort' }).doc;
  const familyLength = '👩‍👩‍👧‍👦'.length;
  const secondLine = doc.line(2);
  const thirdLine = doc.line(3);
  assert.equal(verticalTextAdjacentPosition(doc, 1, 'left'), secondLine.from + 1);
  assert.equal(verticalTextAdjacentPosition(doc, secondLine.from + 1, 'right'), 1);
  assert.equal(verticalTextAdjacentPosition(doc, secondLine.from + 1 + familyLength, 'left'), thirdLine.from + 2);
  assert.equal(verticalTextAdjacentPosition(doc, doc.line(1).from, 'right'), 0);
  assert.equal(verticalTextAdjacentPosition(doc, thirdLine.from, 'left'), thirdLine.from);
});
