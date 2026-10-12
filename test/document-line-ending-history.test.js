import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { history, redo, undo, undoDepth } from '@codemirror/commands';
import { documentLineEndingExtensions, documentLineEndingsField, setDocumentLineEndings, setDocumentLineEndingFallback, synchronizeDocumentLineEndingMetadata } from '../lib/document-line-ending-history.js';
import { applyLineEndings, transformLineBlock } from '../lib/text-tools.js';

function createView(doc, endings, fallback = 'LF') {
  const view = {
    state: EditorState.create({
      doc,
      extensions: [history(), ...documentLineEndingExtensions(endings, fallback)]
    })
  };
  view.dispatch = transaction => { view.state = transaction.state; };
  return view;
}

test('grouped adjacent typing restores exact mixed line endings on undo and redo', () => {
  const originalText = 'a\nb\nc';
  const originalEndings = ['CRLF', 'PS'];
  const view = createView(originalText, originalEndings);

  view.dispatch(view.state.update({
    changes: { from: 1, to: 1, insert: '\nx' },
    selection: { anchor: 3 },
    userEvent: 'input.type'
  }));
  const afterFirstEdit = 'a\nx\nb\nc';
  const afterFirstEndings = ['LF', 'CRLF', 'PS'];
  assert.equal(view.state.doc.toString(), afterFirstEdit);
  assert.deepEqual(view.state.field(documentLineEndingsField), afterFirstEndings);
  assert.equal(applyLineEndings(afterFirstEdit, afterFirstEndings), 'a\nx\r\nb\u2029c');

  view.dispatch(view.state.update({
    changes: { from: 2, to: 3, insert: 'xy' },
    selection: { anchor: 4 },
    userEvent: 'input.type'
  }));
  assert.equal(view.state.doc.toString(), 'a\nxy\nb\nc');
  assert.deepEqual(view.state.field(documentLineEndingsField), afterFirstEndings);
  assert.equal(undoDepth(view.state), 1, 'adjacent input transactions should form one undo group');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), originalText);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(applyLineEndings(originalText, originalEndings), 'a\r\nb\u2029c');

  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), 'a\nxy\nb\nc');
  assert.deepEqual(view.state.field(documentLineEndingsField), afterFirstEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), afterFirstEndings), 'a\nxy\r\nb\u2029c');
});

test('metadata-only line-ending undo and redo synchronize the document model before saving', () => {
  const text = 'a\nb\nc';
  const savedEndings = ['CRLF', 'PS'];
  const document = { text, eol: 'CRLF', lineEndings: [...savedEndings] };
  const view = createView(text, savedEndings, 'CRLF');
  const synchronize = startState => synchronizeDocumentLineEndingMetadata(document, { startState, state: view.state });

  let startState = view.state;
  view.dispatch(view.state.update({ effects: [
    setDocumentLineEndings.of(['LF', 'LF']),
    setDocumentLineEndingFallback.of('LF')
  ] }));
  assert.equal(synchronize(startState), true);
  assert.deepEqual(document.lineEndings, ['LF', 'LF']);
  assert.equal(document.eol, 'LF');

  startState = view.state;
  assert.equal(undo(view), true);
  assert.equal(synchronize(startState), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), savedEndings);
  assert.deepEqual(document.lineEndings, savedEndings);
  assert.equal(document.eol, 'CRLF');
  assert.equal(applyLineEndings(text, document.lineEndings, document.eol), 'a\r\nb\u2029c');

  startState = view.state;
  assert.equal(redo(view), true);
  assert.equal(synchronize(startState), true);
  assert.deepEqual(document.lineEndings, ['LF', 'LF']);
  assert.equal(applyLineEndings(text, document.lineEndings, document.eol), 'a\nb\nc');
});

test('same line-ending values in a copied metadata array are not reported as a model change', () => {
  const text = 'a\nb\nc';
  const endings = ['CRLF', 'PS'];
  const document = { text, eol: 'CRLF', lineEndings: [...endings] };
  const view = createView(text, endings, 'CRLF');
  const startState = view.state;

  view.dispatch(view.state.update({ effects: [
    setDocumentLineEndings.of([...endings]),
    setDocumentLineEndingFallback.of('CRLF')
  ] }));

  assert.notEqual(view.state.field(documentLineEndingsField), startState.field(documentLineEndingsField),
    'the StateField can hold a fresh immutable array with identical values');
  assert.equal(synchronizeDocumentLineEndingMetadata(document, { startState, state: view.state }), false,
    'identical EOL metadata must not trigger renderer persistence or UI refresh work');
  assert.deepEqual(document.lineEndings, endings);
  assert.equal(document.eol, 'CRLF');
});

test('line-reordering transactions with explicit mixed line endings restore through undo and redo', () => {
  const originalText = 'first\nsecond\nthird';
  const originalEndings = ['CRLF', 'PS'];
  const fallback = 'NEL';
  const transformed = transformLineBlock(originalText, originalEndings, 'reverse', { fallbackLineEnding: fallback });
  assert.equal(transformed.text, 'third\nsecond\nfirst');
  assert.deepEqual(transformed.lineEndings, ['NEL', 'PS']);

  const document = { text: originalText, eol: fallback, lineEndings: [...originalEndings] };
  const view = createView(originalText, originalEndings, fallback);
  const sync = startState => {
    document.text = view.state.doc.toString();
    return synchronizeDocumentLineEndingMetadata(document, { startState, state: view.state });
  };

  let startState = view.state;
  view.dispatch(view.state.update({
    changes: { from: 0, to: originalText.length, insert: transformed.text },
    effects: setDocumentLineEndings.of(transformed.lineEndings),
    userEvent: 'input.format.lines.reverse'
  }));
  assert.equal(sync(startState), true);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'third\u0085second\u2029first');
  assert.equal(document.eol, fallback);

  startState = view.state;
  assert.equal(undo(view), true);
  assert.equal(sync(startState), true);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'first\r\nsecond\u2029third');

  startState = view.state;
  assert.equal(redo(view), true);
  assert.equal(sync(startState), true);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'third\u0085second\u2029first');

  startState = view.state;
  view.dispatch(view.state.update({
    changes: { from: view.state.doc.length, to: view.state.doc.length, insert: '\nnext' },
    userEvent: 'input.type'
  }));
  assert.equal(sync(startState), true);
  assert.deepEqual(document.lineEndings, ['NEL', 'PS', 'NEL']);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'third\u0085second\u2029first\u0085next');
});

test('restore-to-saved effects replace stale line-ending metadata even when text is unchanged', () => {
  const text = 'a\nb\nc';
  const savedEndings = ['CRLF', 'PS'];
  const view = createView(text, savedEndings, 'CRLF');
  view.dispatch(view.state.update({ effects: [
    setDocumentLineEndings.of(['LF', 'LF']),
    setDocumentLineEndingFallback.of('LF')
  ] }));

  const startState = view.state;
  const transaction = view.state.update({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    effects: [setDocumentLineEndings.of(savedEndings), setDocumentLineEndingFallback.of('CRLF')]
  });
  assert.equal(transaction.newDoc.toString(), text, 'the restored text can be identical to the current text');
  view.dispatch(transaction);
  assert.equal(synchronizeDocumentLineEndingMetadata({}, { startState, state: view.state }), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), savedEndings);
  assert.equal(applyLineEndings(text, view.state.field(documentLineEndingsField)), 'a\r\nb\u2029c');

  view.dispatch(view.state.update({ changes: { from: 1, to: 1, insert: '\nx' }, userEvent: 'input.type' }));
  const expectedEndings = ['CRLF', 'CRLF', 'PS'];
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), expectedEndings), 'a\r\nx\r\nb\u2029c');
});
