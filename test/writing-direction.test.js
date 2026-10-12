import test from 'node:test';
import assert from 'node:assert/strict';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

test('writing direction changes the active document content direction attribute', () => {
  const direction = new Compartment();
  let state = EditorState.create({ doc: 'plain text', extensions: direction.of(EditorView.contentAttributes.of({ dir: 'ltr' })) });
  assert.deepEqual(state.facet(EditorView.contentAttributes), [{ dir: 'ltr' }]);

  state = state.update({ effects: direction.reconfigure(EditorView.contentAttributes.of({ dir: 'rtl' })) }).state;
  assert.deepEqual(state.facet(EditorView.contentAttributes), [{ dir: 'rtl' }]);
  assert.equal(state.doc.toString(), 'plain text');

  state = state.update({ effects: direction.reconfigure(EditorView.contentAttributes.of({ dir: 'ltr' })) }).state;
  assert.deepEqual(state.facet(EditorView.contentAttributes), [{ dir: 'ltr' }]);
});
