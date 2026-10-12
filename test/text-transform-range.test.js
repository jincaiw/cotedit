import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EditorState, EditorSelection } from '@codemirror/state';
import { history, redo, undo } from '@codemirror/commands';
import { textTransformationRange, textTransformationTransaction } from '../lib/text-transform-range.js';
import { normalizeUnicode, replaceDoubleHyphensWithEmDash, replacePairedStraightQuotes, straightenCurlyQuotes } from '../lib/text-tools.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function stateAt(text, anchor, head = anchor) {
  return EditorState.create({ doc: text, selection: { anchor, head } });
}

function stateWithRanges(text, ranges, extraExtensions = []) {
  return EditorState.create({
    doc: text,
    selection: EditorSelection.create(ranges),
    extensions: [EditorState.allowMultipleSelections.of(true), ...extraExtensions]
  });
}

function applyTransformation(state, transform, options) {
  const transaction = textTransformationTransaction(state, transform, options);
  return transaction ? state.update(transaction).state : state;
}

test('actual renderer enables CodeMirror multiple selections for document states', () => {
  assert.match(renderer, /function createState\(doc\)[\s\S]*?EditorState\.allowMultipleSelections\.of\(true\)/);
});

test('uses the active word at the caret rather than transforming its whole line', () => {
  const text = 'alpha 世界 beta';
  assert.deepEqual(textTransformationRange(stateAt(text, 7)), { from: 6, to: 8 });
  assert.deepEqual(textTransformationRange(stateAt(text, 11)), { from: 9, to: 13 });
  assert.deepEqual(textTransformationRange(stateAt(text, 13)), { from: 9, to: 13 });
});

test('uses the same adjacent-word boundary semantics as CodeMirror Select Word', () => {
  const text = 'alpha beta';
  assert.deepEqual(textTransformationRange(stateAt(text, 5)), { from: 0, to: 5 });
  assert.deepEqual(textTransformationRange(stateAt(text, 6)), { from: 6, to: 10 });
  assert.equal(textTransformationRange(stateAt('!!!', 1)), null);
  assert.equal(textTransformationRange(stateAt('', 0)), null);
});

test('uses the exact nonempty selection instead of widening it to a word', () => {
  const text = 'alpha beta';
  assert.deepEqual(textTransformationRange(stateAt(text, 1, 3)), { from: 1, to: 3 });
  assert.deepEqual(textTransformationRange(stateAt(text, 8, 6)), { from: 6, to: 8 });
});

test('transforms every nonempty selection in one transaction and preserves direction', () => {
  const state = stateWithRanges('alpha beta gamma', [
    EditorSelection.range(5, 0),
    EditorSelection.range(10, 6)
  ]);
  const next = applyTransformation(state, text => text.toUpperCase());

  assert.equal(next.doc.toString(), 'ALPHA BETA gamma');
  assert.deepEqual(next.selection.ranges.map(({ anchor, head }) => [anchor, head]), [[5, 0], [10, 6]]);
});

test('Modified Unicode forms apply to the exact selection and round-trip through CodeMirror history', () => {
  const cases = [
    ['MODIFIED_NFD', 'a\u1f71b', 'a\u03b1\u0301b', 1, 2],
    ['MODIFIED_NFC', 'a\u1f71\u03b1\u0301b', 'a\u1f71\u03acb', 1, 4]
  ];
  for (const [form, original, expected, from, to] of cases) {
    let state = stateWithRanges(original, [EditorSelection.range(from, to)], [history()]);
    const transaction = textTransformationTransaction(state, text => normalizeUnicode(text, form));
    const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
    assert.ok(transaction);
    view.dispatch({ ...transaction, userEvent: 'input.format' });
    assert.equal(view.state.doc.toString(), expected);
    assert.equal(undo(view), true);
    assert.equal(view.state.doc.toString(), original);
    assert.equal(redo(view), true);
    assert.equal(view.state.doc.toString(), expected);
  }
});

test('identical selected-text transforms do not mark the document changed or create undo history', () => {
  let state = stateWithRanges('ALPHA', [EditorSelection.range(0, 5)], [history()]);
  const transaction = textTransformationTransaction(state, text => text.toUpperCase());

  assert.ok(transaction);
  assert.equal(transaction.changes.empty, true);
  const applied = state.update({ ...transaction, userEvent: 'input.format' });
  assert.equal(applied.docChanged, false);
  state = applied.state;
  assert.equal(state.doc.toString(), 'ALPHA');
  assert.deepEqual(state.selection.ranges.map(({ from, to }) => [from, to]), [[0, 5]]);

  const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
  assert.equal(undo(view), false, 'an equivalent replacement must not add a history event');
});

test('an unchanged word at a cursor is selected without a document change or undo entry', () => {
  let state = stateWithRanges('ALPHA beta', [EditorSelection.cursor(2)], [history()]);
  const transaction = textTransformationTransaction(state, text => text.toUpperCase());

  assert.ok(transaction);
  assert.equal(transaction.changes.empty, true);
  const applied = state.update({ ...transaction, userEvent: 'input.format' });
  assert.equal(applied.docChanged, false);
  state = applied.state;
  assert.equal(state.doc.toString(), 'ALPHA beta');
  assert.deepEqual(state.selection.ranges.map(({ from, to }) => [from, to]), [[0, 5]], 'the target word remains selected');

  const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
  assert.equal(undo(view), false, 'selection-only transformation must not add a history event');
});

test('maps later selected ranges after a Unicode transformation changes string length', () => {
  const state = stateWithRanges('ß one ß', [
    EditorSelection.range(0, 1),
    EditorSelection.range(6, 7)
  ]);
  const next = applyTransformation(state, text => text.toUpperCase());

  assert.equal(next.doc.toString(), 'SS one SS');
  assert.deepEqual(next.selection.ranges.map(({ from, to }) => [from, to]), [[0, 2], [7, 9]]);
});

test('preserves a secondary empty cursor while transforming all selected text', () => {
  const state = stateWithRanges('alpha beta gamma', [
    EditorSelection.range(0, 5),
    EditorSelection.cursor(8),
    EditorSelection.range(16, 11)
  ]);
  const next = applyTransformation(state, text => text.toUpperCase());

  assert.equal(next.doc.toString(), 'ALPHA beta GAMMA');
  assert.equal(next.selection.ranges.length, 3);
  assert.equal(next.selection.ranges[1].head, 8);
  assert.deepEqual(next.selection.ranges.map(({ anchor, head }) => [anchor, head]), [[0, 5], [8, 8], [16, 11]]);
});

test('transforms words at multiple cursors and applies a shared word target only once', () => {
  const multipleWords = stateWithRanges('alpha beta', [EditorSelection.cursor(2), EditorSelection.cursor(8)]);
  assert.equal(applyTransformation(multipleWords, text => text.toUpperCase()).doc.toString(), 'ALPHA BETA');

  const duplicateWord = stateWithRanges('alpha', [EditorSelection.cursor(2), EditorSelection.cursor(3)]);
  assert.equal(applyTransformation(duplicateWord, text => text.toUpperCase()).doc.toString(), 'ALPHA');
});

test('selection-required transformations accept any nonempty range and reject cursor-only state', () => {
  const cursorOnly = stateWithRanges('alpha beta', [EditorSelection.cursor(2), EditorSelection.cursor(8)]);
  assert.equal(textTransformationTransaction(cursorOnly, text => text, { selectionRequired: true }), null);

  const selected = stateWithRanges('alpha\nbeta gamma\ndelta', [
    EditorSelection.range(0, 10),
    EditorSelection.range(11, 22)
  ]);
  const next = applyTransformation(selected, text => text.replace(/\s*\n\s*/g, ' '), { selectionRequired: true });
  assert.equal(next.doc.toString(), 'alpha beta gamma delta');
});

test('batches multi-selection transforms into one undoable and redoable edit', () => {
  let state = stateWithRanges('alpha beta', [
    EditorSelection.range(0, 5),
    EditorSelection.range(6, 10)
  ], [history()]);
  const original = state;
  const transaction = textTransformationTransaction(state, text => text.toUpperCase());
  state = state.update({ ...transaction, userEvent: 'input.format' }).state;
  assert.equal(state.doc.toString(), 'ALPHA BETA');

  const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), original.doc.toString());
  assert.equal(state.selection.ranges.length, 2);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'ALPHA BETA');
});

test('straightens quote punctuation across multiple selections as one undoable edit', () => {
  const source = '“first” and ‘second’';
  let state = stateWithRanges(source, [
    EditorSelection.range(0, 7),
    EditorSelection.range(12, source.length)
  ], [history()]);
  const original = state;
  const transaction = textTransformationTransaction(state, straightenCurlyQuotes);
  state = state.update({ ...transaction, userEvent: 'input.format' }).state;
  assert.equal(state.doc.toString(), '"first" and \'second\'');

  const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), original.doc.toString());
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '"first" and \'second\'');
});

test('replaces paired straight quotes across multiple selections as one undoable edit', () => {
  const source = '"first" and "second"';
  const secondFrom = source.indexOf('"second"');
  let state = stateWithRanges(source, [
    EditorSelection.range(0, 7),
    EditorSelection.range(secondFrom, source.length)
  ], [history()]);
  const original = state;
  const transaction = textTransformationTransaction(state, replacePairedStraightQuotes);
  state = state.update({ ...transaction, userEvent: 'input.format' }).state;
  assert.equal(state.doc.toString(), '“first” and “second”');

  const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), original.doc.toString());
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '“first” and “second”');
});

test('replaces selected ASCII double-hyphens across multiple selections as one undoable edit', () => {
  const source = 'alpha -- beta ---- gamma';
  const firstFrom = source.indexOf('--');
  const secondFrom = source.indexOf('----');
  let state = stateWithRanges(source, [
    EditorSelection.range(firstFrom, firstFrom + 2),
    EditorSelection.range(secondFrom, secondFrom + 4)
  ], [history()]);
  const original = state;
  const transaction = textTransformationTransaction(state, replaceDoubleHyphensWithEmDash, { selectionRequired: true });
  assert.ok(transaction);
  state = state.update({ ...transaction, userEvent: 'input.format' }).state;
  assert.equal(state.doc.toString(), 'alpha — beta —— gamma');

  const view = { get state() { return state; }, dispatch: value => { state = state.update(value).state; } };
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), original.doc.toString());
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'alpha — beta —— gamma');
});
