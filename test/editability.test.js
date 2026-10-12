import test from 'node:test';
import assert from 'node:assert/strict';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { editabilityExtensions } from '../lib/editability.js';

test('prevent editing blocks document changes while preserving selection/navigation state', () => {
  const state = EditorState.create({ doc: 'keep this text', extensions: editabilityExtensions(true) });
  assert.equal(state.readOnly, true);
  assert.equal(state.facet(EditorView.editable), false);

  const attemptedChange = state.update({ changes: { from: 0, to: 4, insert: 'lose' } });
  assert.equal(attemptedChange.docChanged, false);
  assert.equal(attemptedChange.state.doc.toString(), 'keep this text');

  const movedCaret = attemptedChange.state.update({ selection: EditorSelection.cursor(5) });
  assert.equal(movedCaret.state.selection.main.head, 5);
  assert.equal(movedCaret.state.doc.toString(), 'keep this text');
});

test('reconfiguring editability locks and then restores text edits', () => {
  const editability = new Compartment();
  let state = EditorState.create({ doc: 'text', extensions: editability.of(editabilityExtensions(false)) });
  assert.equal(state.facet(EditorView.editable), true);

  state = state.update({ effects: editability.reconfigure(editabilityExtensions(true)) }).state;
  assert.equal(state.readOnly, true);
  state = state.update({ changes: { from: 0, to: 4, insert: 'blocked' } }).state;
  assert.equal(state.doc.toString(), 'text');

  state = state.update({ effects: editability.reconfigure(editabilityExtensions(false)) }).state;
  assert.equal(state.readOnly, false);
  assert.equal(state.facet(EditorView.editable), true);
  state = state.update({ changes: { from: 0, to: 4, insert: 'editable' } }).state;
  assert.equal(state.doc.toString(), 'editable');
});
