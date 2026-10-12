import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SYNTAX_FILE_EXTENSION,
  DEFAULT_SYNTAX_ID,
  defaultSyntaxFileExtension,
  normalizeDefaultSyntaxId,
  resolveDefaultSyntaxId
} from '../lib/default-syntax.js';

const builtIn = [
  { id: 'plaintext', extensions: ['txt', 'text'] },
  { id: 'markdown', extensions: ['md', 'markdown'] },
  { id: 'javascript', extensions: ['js', 'mjs'] }
];

test('default syntax IDs normalize safely and plain text remains the fallback', () => {
  assert.equal(DEFAULT_SYNTAX_ID, 'plaintext');
  assert.equal(normalizeDefaultSyntaxId(undefined), 'plaintext');
  assert.equal(normalizeDefaultSyntaxId('Markdown'), 'markdown');
  assert.equal(normalizeDefaultSyntaxId('cot-syntax-custom-markup'), 'cot-syntax-custom-markup');
  for (const value of ['', '../markdown', 'bad syntax', '\u0000markdown', 42, {}]) {
    assert.equal(normalizeDefaultSyntaxId(value), 'plaintext');
  }
});

test('resolves installed built-in and imported syntax IDs, with missing syntax falling back to plain text', () => {
  const custom = [{ id: 'cot-syntax-template', extensions: ['tmpl'] }];
  assert.equal(resolveDefaultSyntaxId('markdown', builtIn, custom), 'markdown');
  assert.equal(resolveDefaultSyntaxId('COT-SYNTAX-TEMPLATE', builtIn, custom), 'cot-syntax-template');
  assert.equal(resolveDefaultSyntaxId('cot-syntax-removed', builtIn, custom), 'plaintext');
});

test('uses the syntax file map first extension in its declared order', () => {
  assert.equal(defaultSyntaxFileExtension('markdown', builtIn), 'md');
  assert.equal(defaultSyntaxFileExtension('plaintext', builtIn), 'txt');
  assert.equal(defaultSyntaxFileExtension('cot-syntax-template', builtIn, [{ id: 'cot-syntax-template', extensions: ['tmpl', 'tpl'] }]), 'tmpl');
});

test('skips unsafe extension candidates and falls back to txt when no safe mapping exists', () => {
  const syntax = [
    { id: 'custom-one', extensions: ['../escape', '.md', 'md'] },
    { id: 'custom-two', extensions: [''] },
    { id: 'custom-three', extensions: ['c++'] }
  ];
  assert.equal(defaultSyntaxFileExtension('custom-one', [], syntax), 'md');
  assert.equal(defaultSyntaxFileExtension('custom-two', [], syntax), DEFAULT_SYNTAX_FILE_EXTENSION);
  assert.equal(defaultSyntaxFileExtension('custom-three', [], syntax), 'c++');
});
