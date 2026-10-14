import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { automaticSubstitutionsExtension } from '../lib/automatic-substitutions.js';

function typeText({ doc = '', insert, from = doc.length, options, userEvent = 'input.type', cursor } = {}) {
  const state = EditorState.create({
    doc,
    extensions: [automaticSubstitutionsExtension(() => options)]
  });
  const transaction = state.update({
    changes: { from, to: from, insert },
    selection: { anchor: cursor ?? from + insert.length },
    userEvent
  });
  return { text: transaction.newDoc.toString(), cursor: transaction.newSelection.main.head };
}

test('smart quotes use context to choose opening and closing English curly punctuation', () => {
  const options = { smartQuotes: true };
  assert.deepEqual(typeText({ insert: '"', options }), { text: '“', cursor: 1 });
  assert.deepEqual(typeText({ doc: 'word', insert: "'", options }), { text: 'word’', cursor: 5 });
  assert.deepEqual(typeText({ doc: 'word ', insert: '"', options }), { text: 'word “', cursor: 6 });
});

test('smart paired quotes preserve the caret between opening and closing punctuation', () => {
  const options = { smartQuotes: true };
  assert.deepEqual(typeText({ insert: '""', cursor: 1, options }), { text: '“”', cursor: 1 });
  assert.deepEqual(typeText({ insert: "''", cursor: 1, options }), { text: '‘’', cursor: 1 });
});

test('smart dashes replace the second typed hyphen with one em dash', () => {
  const options = { smartDashes: true };
  assert.deepEqual(typeText({ doc: '-', insert: '-', options }), { text: '—', cursor: 1 });
  assert.deepEqual(typeText({ insert: '-', options }), { text: '-', cursor: 1 });
  assert.deepEqual(typeText({ doc: '—', insert: '-', from: 1, options }), { text: '—-', cursor: 2 });
});

test('double-space period substitution requires a second typed space after word or closing punctuation', () => {
  const options = { automaticPeriodSubstitution: true };
  assert.deepEqual(typeText({ doc: 'hello ', insert: ' ', options }), { text: 'hello. ', cursor: 7 });
  assert.deepEqual(typeText({ doc: '你好 ', insert: ' ', options }), { text: '你好. ', cursor: 4 });
  assert.deepEqual(typeText({ doc: 'word) ', insert: ' ', options }), { text: 'word). ', cursor: 7 });
  assert.equal(typeText({ doc: 'hello ', insert: ' ', options: { automaticPeriodSubstitution: false } }).text, 'hello  ');
  assert.equal(typeText({ doc: 'hello. ', insert: ' ', options }).text, 'hello.  ');
  assert.equal(typeText({ doc: 'hello', insert: '  ', options }).text, 'hello  ');
  assert.equal(typeText({ doc: 'hello ', insert: ' ', userEvent: 'input.paste', options }).text, 'hello  ');
});

test('automatic local text rules apply on a delimiter, longest first, without cascading', () => {
  const options = {
    textReplacement: true,
    rules: [
      { trigger: 'foo', replacement: 'bar', enabled: true, automatic: true },
      { trigger: 'bar', replacement: 'baz', enabled: true, automatic: true }
    ]
  };
  assert.deepEqual(typeText({ insert: 'foo ', options }), { text: 'bar ', cursor: 4 });
  assert.deepEqual(typeText({ insert: 'foo.', options }), { text: 'bar.', cursor: 4 });
});

test('automatic text replacement respects rule opt-in, mode state, boundaries and input source', () => {
  const rule = { trigger: 'foo', replacement: 'bar', enabled: true, automatic: true };
  assert.equal(typeText({ insert: 'foo ', options: { textReplacement: false, rules: [rule] } }).text, 'foo ');
  assert.equal(typeText({ insert: 'foo ', options: { textReplacement: true, rules: [{ ...rule, automatic: false }] } }).text, 'foo ');
  assert.equal(typeText({ insert: 'xfoo ', options: { textReplacement: true, rules: [rule] } }).text, 'xfoo ');
  assert.equal(typeText({ insert: 'foo ', userEvent: 'input.paste', options: { textReplacement: true, rules: [rule] } }).text, 'foo ');
});
