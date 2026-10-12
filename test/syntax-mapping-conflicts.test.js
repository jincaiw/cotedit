import test from 'node:test';
import assert from 'node:assert/strict';
import { findSyntaxMappingConflicts, languageForMappedFilename } from '../lib/syntax-mapping-conflicts.js';

const builtins = [
  { id: 'javascript', label: 'JavaScript', extensions: ['js'], filenames: [], interpreters: [] },
  { id: 'plaintext', label: 'Plain Text', extensions: ['txt'], filenames: [], interpreters: [] }
];
const custom = [
  { id: 'custom-z', name: 'Zed Custom', extensions: ['.js', 'awk'], filenames: ['Makefile'], interpreters: ['node', 'python3'] },
  { id: 'custom-a', name: 'Alpha Custom', extensions: ['js'], filenames: ['makefile'], interpreters: ['node'] }
];

test('findSyntaxMappingConflicts reports duplicate extensions, filenames and interpreters with priority', () => {
  assert.deepEqual(findSyntaxMappingConflicts(custom, builtins), {
    extensions: [
      { name: 'js', primarySyntax: 'Alpha Custom', duplicatedSyntaxes: ['Zed Custom', 'JavaScript'] }
    ],
    filenames: [
      { name: 'makefile', primarySyntax: 'Alpha Custom', duplicatedSyntaxes: ['Zed Custom'] }
    ],
    interpreters: [
      { name: 'node', primarySyntax: 'Alpha Custom', duplicatedSyntaxes: ['Zed Custom'] }
    ]
  });
});

test('languageForMappedFilename uses the same ordered mapping table as conflict diagnostics', () => {
  assert.equal(languageForMappedFilename('app.js', custom, builtins), 'custom-a');
  assert.equal(languageForMappedFilename('MAKEFILE', custom, builtins), 'custom-a');
  assert.equal(languageForMappedFilename('script', custom, builtins, '#!/usr/bin/env node\necho ok'), 'custom-a');
  assert.equal(languageForMappedFilename('notes.txt', custom, builtins), 'plaintext');
  assert.equal(languageForMappedFilename('unknown.xyz', custom, builtins), 'plaintext');
});

test('conflict scanner ignores malformed entries and repeated aliases from the same syntax', () => {
  const result = findSyntaxMappingConflicts([
    { id: 'user', name: 'User Mode', extensions: ['.bad', 'bad', 3, '../oops'], filenames: ['NAME', 'name'], interpreters: [] }
  ], [{ id: 'builtin', label: 'Built-in', extensions: ['bad'], filenames: ['name'], interpreters: [] }]);
  assert.deepEqual(result.extensions, [{ name: 'bad', primarySyntax: 'User Mode', duplicatedSyntaxes: ['Built-in'] }]);
  assert.deepEqual(result.filenames, [{ name: 'name', primarySyntax: 'User Mode', duplicatedSyntaxes: ['Built-in'] }]);
  assert.deepEqual(result.interpreters, []);
});
