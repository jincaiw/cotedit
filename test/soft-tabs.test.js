import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import { history, redo, undo } from '@codemirror/commands';
import { deleteSoftTab, insertSoftTab } from '../lib/soft-tabs.js';

function createView(doc, selection, extensions = []) {
  let state = EditorState.create({
    doc,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true), history(), ...extensions]
  });
  return {
    get state() { return state; },
    dispatch(transaction) { state = transaction.state; }
  };
}

test('soft Tab inserts spaces to the next tab stop and advances the caret', () => {
  const view = createView('abc', EditorSelection.cursor(1));
  assert.equal(insertSoftTab(view, 4), true);
  assert.equal(view.state.doc.toString(), 'a   bc');
  assert.equal(view.state.selection.main.head, 4);
});

test('soft Tab expands existing tabs using CodeMirror logical columns', () => {
  const view = createView('\txy', EditorSelection.cursor(3));
  assert.equal(insertSoftTab(view, 4), true);
  assert.equal(view.state.doc.toString(), '\txy  ');
  assert.equal(view.state.selection.main.head, 5);
});

test('soft Tab replaces a selected range and computes different widths for multiple cursors', () => {
  const selected = createView('abcd', EditorSelection.range(1, 3));
  assert.equal(insertSoftTab(selected, 4), true);
  assert.equal(selected.state.doc.toString(), 'a   d');
  assert.equal(selected.state.selection.main.head, 4);

  const multi = createView('a\txy\nabz', EditorSelection.create([
    EditorSelection.cursor(2),
    EditorSelection.cursor(7)
  ]));
  assert.equal(insertSoftTab(multi, 4), true);
  assert.equal(multi.state.doc.toString(), 'a\t    xy\nab  z');
  assert.equal(multi.state.selection.ranges.length, 2);
});

test('soft Tab insertion is a single undoable and redoable edit', () => {
  const view = createView('abc', EditorSelection.cursor(1));
  assert.equal(insertSoftTab(view, 4), true);
  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), 'abc');
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), 'a   bc');
});

test('soft Backspace removes spaces back to the preceding tab stop', () => {
  const view = createView('      x', EditorSelection.cursor(6));
  assert.equal(deleteSoftTab(view, 4), true);
  assert.equal(view.state.doc.toString(), '    x');
  assert.equal(view.state.selection.main.head, 4);

  const fullRun = createView('    x', EditorSelection.cursor(4));
  assert.equal(deleteSoftTab(fullRun, 4), true);
  assert.equal(fullRun.state.doc.toString(), 'x');
});

test('soft Backspace works at several cursors in one transaction', () => {
  const view = createView('    a\n  b', EditorSelection.create([
    EditorSelection.cursor(4),
    EditorSelection.cursor(8)
  ]));
  assert.equal(deleteSoftTab(view, 4), true);
  assert.equal(view.state.doc.toString(), 'a\nb');
  assert.equal(view.state.selection.ranges.length, 2);
});

test('soft Backspace falls through for selections, tabs, non-space text, or invalid widths', () => {
  assert.equal(deleteSoftTab(createView('    x', EditorSelection.range(0, 4)), 4), false);
  assert.equal(deleteSoftTab(createView('\tx', EditorSelection.cursor(1)), 4), false);
  assert.equal(deleteSoftTab(createView('ax', EditorSelection.cursor(1)), 4), false);
  assert.equal(deleteSoftTab(createView('    x', EditorSelection.cursor(4)), 0), false);
  assert.equal(insertSoftTab(createView('x', EditorSelection.cursor(0)), 100), false);
});
