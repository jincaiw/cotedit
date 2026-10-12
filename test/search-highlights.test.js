import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import { SearchQuery } from '@codemirror/search';
import { collectVisibleSearchHighlights } from '../lib/search-highlights.js';
import { createSearchQuery } from '../lib/search-tools.js';

const fullRange = state => [{ from: 0, to: state.doc.length }];

test('collects visible search matches and marks the selected match distinctly', () => {
  const state = EditorState.create({ doc: 'alpha beta alpha', selection: EditorSelection.range(11, 16) });
  const query = new SearchQuery({ search: 'alpha', caseSensitive: true, literal: true });
  assert.deepEqual(collectVisibleSearchHighlights(state, query, fullRange(state)), [
    { from: 0, to: 5, selected: false },
    { from: 11, to: 16, selected: true }
  ]);
});

test('limits decorations to rendered ranges and merges nearby ranges safely', () => {
  const state = EditorState.create({ doc: 'alpha beta alpha gamma alpha' });
  const query = new SearchQuery({ search: 'alpha', literal: true });
  assert.deepEqual(collectVisibleSearchHighlights(state, query, [{ from: 0, to: 7 }]), [
    { from: 0, to: 5, selected: false }
  ]);
  assert.deepEqual(collectVisibleSearchHighlights(state, query, [{ from: 0, to: 7 }, { from: 8, to: 29 }]), [
    { from: 0, to: 5, selected: false },
    { from: 11, to: 16, selected: false },
    { from: 23, to: 28, selected: false }
  ]);
});

test('whole-word search highlights only complete words, not embedded substrings', () => {
  const state = EditorState.create({ doc: 'cat scatter cat!' });
  const query = new SearchQuery({ search: 'cat', literal: true, wholeWord: true });
  assert.deepEqual(collectVisibleSearchHighlights(state, query, fullRange(state)), [
    { from: 0, to: 3, selected: false },
    { from: 12, to: 15, selected: false }
  ]);
});

test('literal search highlights canonical equivalents without compatibility-only matches', () => {
  const state = EditorState.create({ doc: '① 1 · ·' });
  assert.deepEqual(collectVisibleSearchHighlights(state, createSearchQuery({ search: '1', caseSensitive: true }), fullRange(state)), [
    { from: 2, to: 3, selected: false }
  ]);
  assert.deepEqual(collectVisibleSearchHighlights(state, createSearchQuery({ search: '·', caseSensitive: true }), fullRange(state)), [
    { from: 4, to: 5, selected: false },
    { from: 6, to: 7, selected: false }
  ]);
});

test('uses the same regular-expression query semantics and skips zero-width marks', () => {
  const state = EditorState.create({ doc: 'écho alpha' });
  const query = new SearchQuery({ search: '\\p{L}+', regexp: true, caseSensitive: true });
  assert.deepEqual(collectVisibleSearchHighlights(state, query, fullRange(state)).map(({ from, to }) => [from, to]), [[0, 4], [5, 10]]);
  const zeroWidth = new SearchQuery({ search: '(?=a)', regexp: true });
  assert.deepEqual(collectVisibleSearchHighlights(state, zeroWidth, fullRange(state)), []);
});

test('returns no highlights for an empty or invalid query', () => {
  const state = EditorState.create({ doc: 'alpha' });
  assert.deepEqual(collectVisibleSearchHighlights(state, new SearchQuery({ search: '' }), fullRange(state)), []);
  assert.deepEqual(collectVisibleSearchHighlights(state, new SearchQuery({ search: '(', regexp: true }), fullRange(state)), []);
});
