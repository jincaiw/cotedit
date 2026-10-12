import test from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_TOKEN, MAX_SNIPPETS, MAX_SNIPPET_FORMAT_BYTES, SELECTION_TOKEN, expandSnippetFormat, normalizeSnippets, snippetsForSyntax } from '../lib/snippets.js';

const snippet = (id, name, scope = '', format = '') => ({ id, name, scope, format });

test('snippet preferences sanitize ids, names, scope, format and duplicate records', () => {
  assert.deepEqual(normalizeSnippets([
    snippet('x1', '  Example  ', 'JAVASCRIPT', `a${SELECTION_TOKEN}`),
    snippet('x1', 'Duplicate'),
    snippet('x2', '   '),
    snippet('../bad', 'Unsafe id'),
    { id: 'x3', name: 'No format', scope: '' }
  ]), [snippet('x1', 'Example', 'javascript', `a${SELECTION_TOKEN}`)]);
});

test('snippet list and text sizes are bounded for local storage and settings export', () => {
  const tooLong = 'x'.repeat(MAX_SNIPPET_FORMAT_BYTES + 1);
  assert.deepEqual(normalizeSnippets([snippet('too-long', 'Too long', '', tooLong)]), []);
  const many = Array.from({ length: MAX_SNIPPETS + 1 }, (_, index) => snippet(`id-${index}`, `Name ${index}`));
  assert.equal(normalizeSnippets(many).length, MAX_SNIPPETS);
});

test('snippet shortcuts retain bounded key/modifier data and reject unmodified characters', () => {
  const entry = normalizeSnippets([
    { ...snippet('with-key', 'With Key'), shortcut: { key: 'Q', mod: true, ctrl: false, alt: true, shift: true, ignored: 'drop' } },
    { ...snippet('invalid-key', 'Invalid Key'), shortcut: { key: 'x' } },
    { ...snippet('bad-key', 'Bad Key'), shortcut: { key: 'not a key', mod: true } }
  ]);
  assert.deepEqual(entry[0].shortcut, { key: 'q', mod: true, ctrl: false, alt: true, shift: true });
  assert.equal(Object.hasOwn(entry[1], 'shortcut'), false);
  assert.equal(Object.hasOwn(entry[2], 'shortcut'), false);
});

test('snippet multi-character shortcuts preserve case beyond the former 16-scalar limit', () => {
  const key = 'Sß'.repeat(9);
  const accepted = normalizeSnippets([
    { ...snippet('long-key', 'Long Key'), shortcut: { key, mod: true } }
  ]);
  assert.equal(accepted[0].shortcut.key, key);
  assert.equal(Array.from(accepted[0].shortcut.key).length, 18);
});

test('syntax-scoped snippets are available only to the matching syntax plus global snippets', () => {
  const entries = [snippet('global', 'Global'), snippet('js', 'JavaScript', 'javascript'), snippet('py', 'Python', 'python')];
  assert.deepEqual(snippetsForSyntax(entries, 'JavaScript').map(item => item.id), ['global', 'js']);
  assert.deepEqual(snippetsForSyntax(entries, 'plaintext').map(item => item.id), ['global']);
});

test('selection and cursor tokens expand with multiple cursor stops', () => {
  const format = `before ${SELECTION_TOKEN}${CURSOR_TOKEN} after ${CURSOR_TOKEN}`;
  assert.deepEqual(expandSnippetFormat(format, { selection: 'picked', indent: '' }), {
    text: 'before picked after ', cursorOffsets: [13, 20]
  });
});

test('cursor token inside selected text stays literal and selection text is not reparsed', () => {
  const format = `${CURSOR_TOKEN}${SELECTION_TOKEN}${CURSOR_TOKEN}`;
  assert.deepEqual(expandSnippetFormat(format, { selection: CURSOR_TOKEN }), {
    text: CURSOR_TOKEN, cursorOffsets: [0, CURSOR_TOKEN.length]
  });
});

test('new lines inherit insertion indentation while selected text is preserved verbatim', () => {
  assert.deepEqual(expandSnippetFormat(`if (x) {\n${SELECTION_TOKEN}\n}${CURSOR_TOKEN}`, {
    selection: 'one\ntwo', indent: '\t  '
  }), {
    text: 'if (x) {\n\t  one\ntwo\n\t  }', cursorOffsets: [24]
  });
});
