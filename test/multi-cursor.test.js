import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EditorSelection, EditorState } from '@codemirror/state';
import { collapseMultipleInsertionPoints } from '../lib/multi-cursor.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function createView(doc, selection) {
  let state = EditorState.create({
    doc,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true)]
  });
  let dispatchCount = 0;
  return {
    get state() { return state; },
    get dispatchCount() { return dispatchCount; },
    dispatch(transaction) {
      dispatchCount += 1;
      state = state.update(transaction).state;
    }
  };
}

test('collapsing multi-cursor insertion points keeps the first document-order point', () => {
  const view = createView('0123456789', EditorSelection.create([
    EditorSelection.cursor(2),
    EditorSelection.cursor(5),
    EditorSelection.cursor(8)
  ], 2));

  assert.equal(view.state.selection.main.head, 8, 'the primary cursor starts below the first point');
  assert.equal(collapseMultipleInsertionPoints(view), true);
  assert.equal(view.state.selection.ranges.length, 1);
  assert.equal(view.state.selection.main.head, 2);
  assert.equal(view.state.doc.toString(), '0123456789');
  assert.equal(view.dispatchCount, 1);
});

test('single cursors and selections containing a non-empty range are left untouched', () => {
  const single = createView('abcd', EditorSelection.cursor(2));
  assert.equal(collapseMultipleInsertionPoints(single), false);
  assert.equal(single.dispatchCount, 0);

  const mixed = createView('abcdefghij', EditorSelection.create([
    EditorSelection.cursor(1),
    EditorSelection.range(5, 7)
  ]));
  const before = mixed.state.selection;
  assert.equal(collapseMultipleInsertionPoints(mixed), false);
  assert.equal(mixed.state.selection, before);
  assert.equal(mixed.dispatchCount, 0);
});

test('Escape applies multi-cursor collapse only to the focused editor and leaves dialogs, IME, and modified Escape alone', () => {
  const keydownStart = renderer.indexOf("document.addEventListener('keydown', async event => {");
  assert.notEqual(keydownStart, -1);
  const escapeStart = renderer.indexOf("if (event.key === 'Escape') {", keydownStart);
  const escapeBlockEnd = renderer.indexOf('const platform =', escapeStart);
  const escapeBlock = renderer.slice(escapeStart, escapeBlockEnd);

  assert.match(renderer.slice(keydownStart, escapeStart), /if \(isShortcutCompositionEvent\(event\)\) return;/,
    'IME composition is returned before Escape processing');
  assert.match(escapeBlock, /!event\.ctrlKey && !event\.metaKey && !event\.altKey && !event\.shiftKey/,
    'only an unmodified Escape collapses insertion points');
  assert.match(escapeBlock, /!event\.defaultPrevented/,
    'an editor keymap that already handled Escape keeps priority');
  assert.match(escapeBlock, /!document\.querySelector\('dialog\[open\]'\)/,
    'Escape in an open dialog does not collapse editor cursors');
  assert.match(escapeBlock, /view\?\.hasFocus && view\.dom\.contains\(event\.target\)/,
    'the keyboard event must originate in the focused editor');
  assert.match(escapeBlock, /collapseMultipleInsertionPoints\(view\)/);
});
