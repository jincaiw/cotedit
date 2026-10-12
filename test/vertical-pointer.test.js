import test from 'node:test';
import assert from 'node:assert/strict';
import { verticalTextPositionAtPoint } from '../lib/vertical-pointer.js';

function fixture({ inside = true } = {}) {
  const line = { closest: selector => selector === '.cm-line' ? {} : null };
  const textNode = { nodeType: 3, parentElement: line };
  const mapped = [];
  const view = {
    contentDOM: { contains: node => inside && node === textNode },
    posAtDOM(node, offset) { mapped.push([node, offset]); return 100 + offset; }
  };
  return { line, textNode, mapped, view };
}

test('vertical pointer mapping prefers the writing-mode-aware caret position API', () => {
  const { textNode, mapped, view } = fixture();
  const browserDocument = {
    caretPositionFromPoint(x, y) { assert.deepEqual([x, y], [34, 56]); return { offsetNode: textNode, offset: 13 }; },
    caretRangeFromPoint() { assert.fail('fallback should not run when the native caret position is available'); }
  };
  assert.equal(verticalTextPositionAtPoint(view, 34, 56, browserDocument), 113);
  assert.deepEqual(mapped, [[textNode, 13]]);
});

test('vertical pointer mapping falls back to caretRangeFromPoint', () => {
  const { textNode, view } = fixture();
  const browserDocument = { caretRangeFromPoint: () => ({ startContainer: textNode, startOffset: 7 }) };
  assert.equal(verticalTextPositionAtPoint(view, 8, 9, browserDocument), 107);
});

test('vertical pointer mapping ignores points outside rendered editor lines', () => {
  const { textNode, view, mapped } = fixture({ inside: false });
  const browserDocument = { caretPositionFromPoint: () => ({ offsetNode: textNode, offset: 2 }) };
  assert.equal(verticalTextPositionAtPoint(view, 0, 0, browserDocument), null);
  assert.deepEqual(mapped, []);
  assert.equal(verticalTextPositionAtPoint(view, 0, 0, null), null);
});
