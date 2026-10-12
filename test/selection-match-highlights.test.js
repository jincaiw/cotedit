import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import {
  collectSelectionInstanceMatches,
  createTrailingDebounce,
  MAX_SELECTION_INSTANCE_HIGHLIGHTS,
  selectionInstanceHighlightExtension
} from '../lib/selection-match-highlights.js';

function selectedState(doc, from, to) {
  return EditorState.create({ doc, selection: EditorSelection.range(from, to) });
}

function fakeTimers() {
  let nextId = 0;
  const tasks = new Map();
  const cancelled = [];
  return {
    tasks,
    cancelled,
    setTimeout(callback, delay) {
      const id = ++nextId;
      tasks.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      cancelled.push(id);
      tasks.delete(id);
    },
    run(id) {
      const task = tasks.get(id);
      if (!task) return false;
      tasks.delete(id);
      task.callback();
      return true;
    }
  };
}

test('selected-text highlighting finds visible occurrences but excludes every overlap with the selection', () => {
  const state = selectedState('foo foo food', 0, 3);
  assert.deepEqual(collectSelectionInstanceMatches(state, [{ from: 0, to: state.doc.length }]), [
    { from: 4, to: 7 },
    { from: 8, to: 11 }
  ]);
});

test('selected-text highlighting stays within visible ranges and ignores multi-range or oversized selections', () => {
  const state = selectedState('foo x foo x foo', 0, 3);
  assert.deepEqual(collectSelectionInstanceMatches(state, [{ from: 0, to: 9 }]), [{ from: 6, to: 9 }]);
  const multiple = EditorState.create({
    doc: 'foo foo',
    extensions: EditorState.allowMultipleSelections.of(true),
    selection: EditorSelection.create([EditorSelection.range(0, 3), EditorSelection.range(4, 7)])
  });
  assert.deepEqual(collectSelectionInstanceMatches(multiple, [{ from: 0, to: multiple.doc.length }]), []);
  const cursor = EditorState.create({ doc: 'foo foo', selection: EditorSelection.cursor(0) });
  assert.deepEqual(collectSelectionInstanceMatches(cursor, [{ from: 0, to: cursor.doc.length }]), []);
  const oversized = selectedState('x'.repeat(201) + ' ' + 'x'.repeat(201), 0, 201);
  assert.deepEqual(collectSelectionInstanceMatches(oversized, [{ from: 0, to: oversized.doc.length }]), []);
});

test('highlighting returns no instances when the visible occurrence cap is exceeded', () => {
  const doc = Array.from({ length: MAX_SELECTION_INSTANCE_HIGHLIGHTS + 2 }, () => 'x').join(' ');
  const state = selectedState(doc, 0, 1);
  assert.deepEqual(collectSelectionInstanceMatches(state, [{ from: 0, to: state.doc.length }]), []);
});

test('trailing debounce reschedules, fires only the latest callback, and supports cancellation', () => {
  const timers = fakeTimers();
  let calls = 0;
  const debounced = createTrailingDebounce(() => { calls++; }, 500, timers);
  debounced.schedule();
  const first = [...timers.tasks.keys()][0];
  assert.equal(timers.tasks.get(first).delay, 500);
  debounced.schedule();
  const latest = [...timers.tasks.keys()][0];
  assert.notEqual(latest, first);
  assert.deepEqual(timers.cancelled, [first]);
  assert.equal(timers.run(first), false);
  assert.equal(debounced.pending, true);
  assert.equal(timers.run(latest), true);
  assert.equal(calls, 1);
  assert.equal(debounced.pending, false);

  debounced.schedule();
  const cancelled = [...timers.tasks.keys()][0];
  debounced.cancel();
  assert.equal(timers.run(cancelled), false);
  assert.equal(calls, 1);
});

test('selection highlight extension is constructible for the configured zero and default delays', () => {
  assert.ok(selectionInstanceHighlightExtension(0));
  assert.ok(selectionInstanceHighlightExtension());
});
