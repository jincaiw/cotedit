import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import { pasteExactText } from '../lib/clipboard-commands.js';

function makeView(state) {
  return {
    state,
    lastSpec: null,
    focused: false,
    dispatch(spec) {
      this.lastSpec = spec;
      this.state = this.state.update({
        changes: spec.changes,
        selection: spec.selection,
        userEvent: spec.userEvent
      }).state;
    },
    focus() { this.focused = true; }
  };
}

test('exact paste preserves literal clipboard text in every selected range', () => {
  const state = EditorState.create({
    extensions: EditorState.allowMultipleSelections.of(true),
    doc: 'abcd',
    selection: EditorSelection.create([
      EditorSelection.range(1, 2),
      EditorSelection.range(3, 4)
    ])
  });
  const view = makeView(state);
  const clipboardText = 'Ａ\tΩ';

  assert.equal(pasteExactText(view, clipboardText), true);
  assert.equal(view.state.doc.toString(), 'aＡ\tΩcＡ\tΩ');
  assert.equal(view.lastSpec.userEvent, 'input.paste');
  assert.equal(view.lastSpec.scrollIntoView, true);
  assert.equal(view.focused, true);
});

test('exact paste leaves the document unchanged when clipboard text is empty', () => {
  const view = makeView(EditorState.create({ doc: 'keep', selection: { anchor: 0, head: 4 } }));
  assert.equal(pasteExactText(view, ''), false);
  assert.equal(view.state.doc.toString(), 'keep');
  assert.equal(view.focused, false);
});
