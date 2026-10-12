import test from 'node:test';
import assert from 'node:assert/strict';
import { documentWritingDirection, normalizeDocumentWritingDirections, withDocumentWritingDirection } from '../lib/document-directions.js';

test('normalizes per-path writing directions and rejects malformed entries', () => {
  assert.deepEqual(normalizeDocumentWritingDirections({ '/docs/a.txt': 'rtl', '/docs/b.txt': 'ltr', '/docs/c.txt': 'vertical', '': 'rtl', bad: 1 }), {
    '/docs/a.txt': 'rtl', '/docs/b.txt': 'ltr'
  });
  assert.deepEqual(normalizeDocumentWritingDirections([]), {});
});

test('resolves a saved direction by path and falls back to the configured default', () => {
  const directions = { '/docs/rtl.txt': 'rtl', '/docs/ltr.txt': 'ltr' };
  assert.equal(documentWritingDirection(directions, '/docs/rtl.txt'), 'rtl');
  assert.equal(documentWritingDirection(directions, '/docs/ltr.txt'), 'ltr');
  assert.equal(documentWritingDirection(directions, '/docs/new.txt', 'rtl'), 'rtl');
  assert.equal(documentWritingDirection(directions, null, 'rtl'), 'rtl');
});

test('updates a path direction, moves it to the newest slot and keeps at most 500 paths', () => {
  const directions = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`/docs/${index}.txt`, 'ltr']));
  const updated = withDocumentWritingDirection(directions, '/docs/0.txt', 'rtl');
  assert.equal(Object.keys(updated).length, 500);
  assert.equal(updated['/docs/0.txt'], 'rtl');
  assert.ok(Object.keys(updated).at(-1) === '/docs/0.txt');
  const extended = withDocumentWritingDirection(updated, '/docs/new.txt', 'rtl');
  assert.equal(Object.keys(extended).length, 500);
  assert.equal(extended['/docs/1.txt'], undefined);
  assert.equal(extended['/docs/new.txt'], 'rtl');
});
