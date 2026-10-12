import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import { history, redo, undo } from '@codemirror/commands';
import { applyTextReplacements, MAX_TEXT_REPLACEMENT_FIELD_BYTES, MAX_TEXT_REPLACEMENTS, normalizeTextReplacements } from '../lib/text-replacements.js';
import { textTransformationTransaction } from '../lib/text-transform-range.js';

function stateWithRanges(text, ranges, extensions = []) {
  return EditorState.create({
    doc: text,
    selection: EditorSelection.create(ranges),
    extensions: [EditorState.allowMultipleSelections.of(true), ...extensions]
  });
}

function applySelected(state, rules) {
  const transaction = textTransformationTransaction(state, text => applyTextReplacements(text, rules), { selectionRequired: true });
  return transaction ? state.update({ ...transaction, userEvent: 'input.replace.text' }) : null;
}

test('normalizes local replacement records with bounded size, unique IDs and unique triggers', () => {
  const normalized = normalizeTextReplacements([
    { id: 'one', trigger: 'omw', replacement: 'on my way' },
    { id: 'two', trigger: 'omw', replacement: 'duplicate trigger' },
    { id: 'one', trigger: 'id-collision', replacement: 'duplicate id' },
    { id: 'empty', trigger: '', replacement: 'ignored' },
    { id: 'nul', trigger: 'bad\0trigger', replacement: 'ignored' },
    { id: 'disabled', trigger: 'brb', replacement: 'be right back', enabled: false },
    { id: 'large', trigger: 'x', replacement: 'x'.repeat(MAX_TEXT_REPLACEMENT_FIELD_BYTES + 1) }
  ]);
  assert.deepEqual(normalized, [
    { id: 'one', trigger: 'omw', replacement: 'on my way', enabled: true },
    { id: 'disabled', trigger: 'brb', replacement: 'be right back', enabled: false }
  ]);
  assert.deepEqual(normalizeTextReplacements('invalid'), []);
  assert.equal(normalizeTextReplacements(Array.from({ length: MAX_TEXT_REPLACEMENTS + 1 }, (_, index) => ({ id: `r${index}`, trigger: `t${index}`, replacement: '' }))).length, MAX_TEXT_REPLACEMENTS);
});

test('applies literal, case-sensitive, longest-first matches in one pass without cascading', () => {
  const rules = [
    { id: 'short', trigger: 'foo', replacement: 'bar' },
    { id: 'long', trigger: 'foobar', replacement: 'done' },
    { id: 'meta', trigger: 'a+b', replacement: '$1\\' },
    { id: 'cascade', trigger: 'bar', replacement: 'cascade' },
    { id: 'disabled', trigger: 'x', replacement: 'y', enabled: false }
  ];
  assert.equal(applyTextReplacements('foobar foo FOOBAR a+b x', rules), 'done bar FOOBAR $1\\ x');
  assert.equal(applyTextReplacements('no match', rules), 'no match');
  assert.equal(applyTextReplacements('foo', []), 'foo');
});

test('replaces only text inside multiple selections in one undoable CodeMirror transaction', () => {
  const rules = [
    { id: 'one', trigger: 'omw', replacement: 'on my way' },
    { id: 'two', trigger: '(c)', replacement: '©' }
  ];
  let state = stateWithRanges('omw outside (c) and omw', [
    EditorSelection.range(3, 0),
    EditorSelection.range(23, 20)
  ], [history()]);
  const original = state;
  const applied = applySelected(state, rules);
  assert.ok(applied);
  assert.equal(applied.state.doc.toString(), 'on my way outside (c) and on my way');
  assert.equal(applied.docChanged, true);
  state = applied.state;
  const view = { get state() { return state; }, dispatch: transaction => { state = state.update(transaction).state; } };
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), original.doc.toString());
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'on my way outside (c) and on my way');
});

test('leaves a selection unchanged and creates no edit when no trigger matches', () => {
  let state = stateWithRanges('nothing here', [EditorSelection.range(12, 0)], [history()]);
  const before = state;
  const applied = applySelected(state, [{ id: 'x', trigger: 'omw', replacement: 'on my way' }]);
  assert.ok(applied);
  assert.equal(applied.docChanged, false);
  assert.equal(applied.changes.empty, true);
  state = applied.state;
  assert.equal(state.doc.toString(), before.doc.toString());
  const view = { get state() { return state; }, dispatch: transaction => { state = state.update(transaction).state; } };
  assert.equal(undo(view), false);
});

test('requires selected text and preserves empty secondary cursors when applying rules', () => {
  const state = stateWithRanges('omw here', [EditorSelection.cursor(2)]);
  assert.equal(applySelected(state, [{ id: 'x', trigger: 'omw', replacement: 'on my way' }]), null);

  const multi = stateWithRanges('omw here omw', [EditorSelection.range(3, 0), EditorSelection.cursor(5), EditorSelection.range(12, 9)]);
  const applied = applySelected(multi, [{ id: 'x', trigger: 'omw', replacement: 'on my way' }]);
  assert.equal(applied.state.doc.toString(), 'on my way here on my way');
  assert.equal(applied.state.selection.ranges.length, 3);
  assert.equal(applied.state.selection.ranges[1].head, 11);
});
