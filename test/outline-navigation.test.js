import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentOutlineItem, nearestOutlineItemAtOrBefore } from '../lib/outline-navigation.js';

test('outline navigation selects the nearest previous or next item around the caret line', () => {
  const items = [
    { line: 20, label: 'Third' },
    { line: 2, label: 'First' },
    { line: 11, label: 'Second' }
  ];
  assert.equal(adjacentOutlineItem(items, 11, -1)?.label, 'First');
  assert.equal(adjacentOutlineItem(items, 11, 1)?.label, 'Third');
  assert.equal(adjacentOutlineItem(items, 8, -1)?.label, 'First');
  assert.equal(adjacentOutlineItem(items, 8, 1)?.label, 'Second');
});

test('outline navigation returns no item at document bounds and rejects invalid input', () => {
  const items = [{ line: 2 }, { line: 9 }];
  assert.equal(adjacentOutlineItem(items, 1, -1), null);
  assert.equal(adjacentOutlineItem(items, 9, 1), null);
  assert.equal(adjacentOutlineItem(items, 0, 1), null);
  assert.equal(adjacentOutlineItem(items, 2.5, -1), null);
  assert.equal(adjacentOutlineItem(items, 2, 0), null);
  assert.equal(adjacentOutlineItem([{ line: 0 }, { line: NaN }, null], 3, -1), null);
});

test('navigation bar tracks the nearest outline item at or before the caret', () => {
  const items = [{ line: 18, label: 'Third' }, { line: 2, label: 'First' }, { line: 11, label: 'Second' }];
  assert.equal(nearestOutlineItemAtOrBefore(items, 1), null);
  assert.equal(nearestOutlineItemAtOrBefore(items, 11)?.label, 'Second');
  assert.equal(nearestOutlineItemAtOrBefore(items, 99)?.label, 'Third');
  assert.equal(nearestOutlineItemAtOrBefore(items, 0), null);
  assert.equal(nearestOutlineItemAtOrBefore(items, 2.5), null);
  assert.equal(nearestOutlineItemAtOrBefore(null, 12), null);
});
