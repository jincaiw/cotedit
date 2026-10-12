import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { syntaxWordCompletionSource } from '../lib/completion-word-types.js';
import {
  completionWordTypesForLanguage,
  normalizeSettings,
  setCompletionWordTypesOverride
} from '../lib/settings.js';
import { documentWordCompletionSource } from '../lib/document-completions.js';

function stateWithProvider(doc, autocomplete) {
  return EditorState.create({
    doc,
    extensions: EditorState.languageData.of(() => [{ autocomplete }])
  });
}

test('per-syntax word sources inherit defaults and can be changed or reset independently', () => {
  assert.deepEqual(completionWordTypesForLanguage({}, 'javascript'), {
    standard: false, document: true, syntax: true
  });
  const overrides = setCompletionWordTypesOverride({}, 'javascript', { document: false, syntax: true });
  const settings = normalizeSettings({ completionWordTypesByLanguage: overrides });
  assert.deepEqual(completionWordTypesForLanguage(settings, 'javascript'), {
    standard: false, document: false, syntax: true
  });
  assert.deepEqual(completionWordTypesForLanguage(settings, 'python'), {
    standard: false, document: true, syntax: true
  });
  assert.deepEqual(setCompletionWordTypesOverride(overrides, 'javascript', null), {});
  assert.deepEqual(setCompletionWordTypesOverride(overrides, '../unsafe', { document: true }), overrides);
});

test('source settings reject malformed entries and remain bounded to 200 syntax IDs', () => {
  const malformed = normalizeSettings({ completionWordTypesByLanguage: {
    'bad key': { document: false },
    javascript: { document: 'off', syntax: true, standard: true },
    python: ['document']
  } });
  assert.deepEqual(malformed.completionWordTypesByLanguage, { javascript: { syntax: true } });
  const many = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`syntax-${index}`, { document: true, syntax: false }]));
  const bounded = normalizeSettings({ completionWordTypesByLanguage: many }).completionWordTypesByLanguage;
  assert.equal(Object.keys(bounded).length, 200);
  assert.equal(Object.hasOwn(bounded, 'syntax-0'), false);
  assert.equal(Object.hasOwn(bounded, 'syntax-204'), true);
});

test('syntax completion source filters short automatic prefixes but keeps explicit completion', () => {
  const provider = context => {
    const match = context.matchBefore(/\w+/);
    return match ? { from: match.from, options: [{ label: 'projectName' }] } : null;
  };
  const state = stateWithProvider('pr', provider);
  const automatic = syntaxWordCompletionSource(new CompletionContext(state, state.doc.length, false));
  assert.equal(automatic, null);
  const explicit = syntaxWordCompletionSource(new CompletionContext(state, state.doc.length, true));
  assert.equal(explicit.from, 0);
  assert.deepEqual(explicit.options.map(option => option.label), ['projectName']);
  assert.equal(explicit.options[0].section.name, '语法');
});

test('syntax sources merge providers, deduplicate labels, and tolerate asynchronous results', async () => {
  const first = context => ({ from: 0, options: [{ label: 'projectName' }, { label: 'ProjectName' }] });
  const second = async context => ({ from: 1, options: [{ label: 'projectPath' }, { label: 'projectName' }] });
  const sourcesState = EditorState.create({
    doc: 'project',
    extensions: EditorState.languageData.of(() => [{ autocomplete: first }, { autocomplete: second }])
  });
  const result = await syntaxWordCompletionSource(new CompletionContext(sourcesState, sourcesState.doc.length, true));
  assert.equal(result.from, 0);
  assert.deepEqual(result.options.map(option => option.label), ['projectName', 'projectPath']);
  assert.ok(result.options.every(option => option.section.name === '语法'));
});

test('document words can be used while typing within a bounded scan and explicit completion remains unbounded', () => {
  const filler = 'x'.repeat(40);
  const state = EditorState.create({ doc: `${filler}\nprefixCandidate pre` });
  const pos = state.doc.length;
  const automatic = documentWordCompletionSource(new CompletionContext(state, pos, false), {
    includeWhileTyping: true,
    automaticScanLimit: 20
  });
  assert.equal(automatic, null);
  const explicit = documentWordCompletionSource(new CompletionContext(state, pos, true), {
    includeWhileTyping: true,
    automaticScanLimit: 20
  });
  assert.deepEqual(explicit.options.map(option => option.label), ['prefixCandidate']);
});
