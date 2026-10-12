import test from 'node:test';
import assert from 'node:assert/strict';
import { getTextStats, countCharacters, isDirty, languageForFilename, LANGUAGE_OPTIONS, selectRecoverableDrafts } from '../lib/document.js';

test('languageForFilename selects common text and source formats', () => {
  assert.equal(languageForFilename('/tmp/App.TS'), 'typescript');
  assert.equal(languageForFilename('index.html'), 'html');
  assert.equal(languageForFilename('notes.md'), 'markdown');
  assert.equal(languageForFilename('unknown.xyz'), 'plaintext');
  assert.equal(languageForFilename('Makefile'), 'plaintext');
  assert.equal(languageForFilename('main.go'), 'go');
  assert.equal(languageForFilename('Dockerfile'), 'dockerfile');
  assert.equal(languageForFilename('CMakeLists.txt'), 'cmake');
  assert.equal(languageForFilename('settings.toml'), 'toml');
  assert.ok(LANGUAGE_OPTIONS.length >= 70);
  assert.equal(new Set(LANGUAGE_OPTIONS.map(option => option.id)).size, LANGUAGE_OPTIONS.length);
});

test('GeoJSON files use the built-in JSON syntax while imported mappings retain priority', () => {
  assert.equal(languageForFilename('/tmp/features.geojson'), 'json');
  assert.equal(languageForFilename('/tmp/FEATURES.GEOJSON'), 'json');
  assert.equal(languageForFilename('/tmp/features.geojson', [
    { id: 'cot-syntax-geojson-0123456789', name: 'GeoJSON Custom', extensions: ['geojson'], filenames: [], interpreters: [] }
  ]), 'cot-syntax-geojson-0123456789');
});

test('language mappings cover safe CotEditor filename, extension and shebang aliases', () => {
  assert.equal(languageForFilename('Package.resolved'), 'json');
  assert.equal(languageForFilename('/tmp/.editorconfig'), 'properties');
  assert.equal(languageForFilename('/tmp/.gitmodules'), 'properties');
  assert.equal(languageForFilename('Dockerfile'), 'dockerfile');
  assert.equal(languageForFilename('query.jsonl'), 'json');
  assert.equal(languageForFilename('kernel.cu'), 'cpp');
  assert.equal(languageForFilename('config.svg'), 'xml');
  assert.equal(languageForFilename('module.mts'), 'typescript');
  assert.equal(languageForFilename('measure.f08'), 'fortran');
  assert.equal(languageForFilename('script.mysql'), 'sql');
  assert.equal(languageForFilename('view.erb'), 'ruby');
  assert.equal(languageForFilename('script', [], '#!/usr/bin/env -S python3 -u\nprint(1)'), 'python');
  assert.equal(languageForFilename('script', [], '#!/usr/bin/env csh\necho ready'), 'shell');
  assert.equal(languageForFilename('script', [], '#!/usr/bin/env tclsh\nputs ready'), 'tcl');
  assert.equal(languageForFilename('script', [], '#!/usr/bin/env rdmd\nvoid main() {}'), 'd');
  assert.equal(languageForFilename('script', [], '#!/usr/bin/env protoc\n'), 'protobuf');
  assert.equal(languageForFilename('script', [], '#!/usr/bin/env sbcl\n'), 'commonlisp');
});

test('languageForFilename prioritizes user syntax mappings before bundled modes', () => {
  const custom = [
    { id: 'cot-syntax-awk-0123456789', extensions: ['awk'], filenames: ['makefile'] },
    { id: 'cot-syntax-custom-js-0123456789', extensions: ['js'], filenames: [] },
    { id: 'cot-syntax-plain-0123456789', extensions: ['txt'], filenames: [] }
  ];
  assert.equal(languageForFilename('script.awk', custom), 'cot-syntax-awk-0123456789');
  assert.equal(languageForFilename('/tmp/Makefile', custom), 'cot-syntax-awk-0123456789');
  assert.equal(languageForFilename('app.js', custom), 'cot-syntax-custom-js-0123456789');
  assert.equal(languageForFilename('notes.txt', custom), 'cot-syntax-plain-0123456789');
  assert.equal(languageForFilename('unknown.xyz', custom), 'plaintext');
});

test('languageForFilename resolves custom shebang interpreters after filename and extension rules', () => {
  const custom = [
    { id: 'cot-syntax-python3-0123456789', name: 'Python 3 Custom', extensions: [], filenames: [], interpreters: ['python3'] }
  ];
  assert.equal(languageForFilename('script', custom, '#!/usr/bin/env python3\nprint(1)'), 'cot-syntax-python3-0123456789');
  assert.equal(languageForFilename('CMakeLists.txt', [], ''), 'cmake');
});

test('getTextStats counts Unicode characters, words, lines and line endings', () => {
  assert.deepEqual(getTextStats('你好 world\r\n第二行'), {
    characters: 12, words: 3, lines: 2, eol: 'CRLF'
  });
  assert.deepEqual(getTextStats(''), { characters: 0, words: 0, lines: 1, eol: 'LF' });
  assert.equal(getTextStats('a\rb').eol, 'CR');
  assert.deepEqual(getTextStats('one\u0085two\u2028three\u2029four'), {
    characters: 18, words: 4, lines: 4, eol: 'NEL'
  });
});

test('counts user-perceived Unicode grapheme clusters as characters', () => {
  const text = 'A😀e\u0301👨‍👩‍👧‍👦';
  assert.equal(countCharacters(text), 4);
  assert.equal(getTextStats(text).characters, 4);
});

test('dirty state compares the current draft against the last saved version', () => {
  assert.equal(isDirty({ text: 'edited', savedText: 'original' }), true);
  assert.equal(isDirty({ text: 'same', savedText: 'same' }), false);
});

test('recovery keeps valid drafts after malformed entries and caps the result at twenty', () => {
  const valid = { text: 'recover me', name: 'valid.txt' };
  const recovered = selectRecoverableDrafts([...Array(20).fill(null), valid]);
  assert.deepEqual(recovered, [valid]);

  const many = Array.from({ length: 21 }, (_, index) => ({ text: `draft-${index}` }));
  assert.equal(selectRecoverableDrafts(many).length, 20);
  assert.equal(selectRecoverableDrafts(many)[19].text, 'draft-19');
  assert.deepEqual(selectRecoverableDrafts([null, {}, { text: 42 }, 'bad']), []);
  assert.deepEqual(selectRecoverableDrafts({ text: 'not an array' }), []);
});
