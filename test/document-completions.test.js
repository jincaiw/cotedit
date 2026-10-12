import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { collectDocumentWordCompletions, documentWordCompletionSource } from '../lib/document-completions.js';

test('document completion returns unique case-insensitive prefix matches from the full line stream', () => {
  const result = collectDocumentWordCompletions([
    'needle Needles need NEEDLESS',
    'café caféine café noir',
    'under_score under_scored _under'
  ], 'need');
  assert.deepEqual(result, ['needle', 'Needles', 'NEEDLESS']);
});

test('document completion supports Unicode words and ignores symbol-only one-character prefixes', () => {
  assert.deepEqual(collectDocumentWordCompletions(['你好 你好世界'], '你好'), ['你好世界']);
  assert.deepEqual(collectDocumentWordCompletions(['_under _underscore'], '_'), []);
  assert.deepEqual(collectDocumentWordCompletions(['_under _underscore'], '_u'), ['_under', '_underscore']);
  assert.deepEqual(collectDocumentWordCompletions(['123 1234'], '1'), []);
});

test('document completion bounds the number of suggestions', () => {
  const words = Array.from({ length: 400 }, (_, index) => `prefix${index}`);
  assert.equal(collectDocumentWordCompletions([words.join(' ')], 'prefix', 25).length, 25);
  assert.equal(collectDocumentWordCompletions([words.join(' ')], 'prefix').length, 250);
});

test('document word source runs only on explicit completion and replaces the current prefix', () => {
  const state = EditorState.create({ doc: 'projectName\nprojectN' });
  const pos = state.doc.length;
  const automatic = documentWordCompletionSource(new CompletionContext(state, pos, false));
  assert.equal(automatic, null);

  const explicit = documentWordCompletionSource(new CompletionContext(state, pos, true));
  assert.equal(explicit.from, pos - 'projectN'.length);
  assert.deepEqual(explicit.options.map(option => option.label), ['projectName']);
  assert.equal(explicit.options[0].section.name, '文稿');
});

test('document word source is registered as additive CodeMirror language data', () => {
  const state = EditorState.create({
    doc: 'projectName\nprojectN',
    extensions: EditorState.languageData.of(() => [{ autocomplete: documentWordCompletionSource }])
  });
  const pos = state.doc.length;
  const [source] = state.languageDataAt('autocomplete', pos);
  const result = source(new CompletionContext(state, pos, true));
  assert.deepEqual(result.options.map(option => option.label), ['projectName']);
});
