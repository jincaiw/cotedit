import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadCotEditorSyntax, loadCotEditorSyntaxPackages, normalizeCotEditorSyntax, normalizeDroppedCotEditorSyntaxPaths } = require('../electron/cot-syntax.cjs');

const baseInfo = {
  kind: 'code',
  fileMap: { extensions: ['awk', '.AWK', 'bad/ext'], filenames: ['Makefile'], interpreters: ['awk'] },
  metadata: { version: '1' }
};

test('normalizes real CotEditor package metadata, comments, delimiters and literal rules', () => {
  const syntax = normalizeCotEditorSyntax('AWK.cotsyntax', baseInfo, {
    comment: { inlines: [{ begin: '#', leadingOnly: true }], blocks: [{ begin: '/*', end: '*/', isNestable: true }] },
    stringDelimiters: [{ begin: '"', end: '"', escapeCharacter: '\\', prefixes: ['f', 'raw', 'f'] }],
    indentation: { blockDelimiters: [{ begin: '{', end: '}', description: 'block' }] }
  }, {
    keywords: [{ begin: 'BEGIN' }, { begin: 'if' }],
    variables: [{ begin: 'ARGC' }],
    numbers: [{ begin: '\\d+', regularExpression: true }]
  }, [{ kind: 'function', pattern: 'function[ \\t]+(\\w+)', template: '$1' }]);

  assert.equal(syntax.format, 'cotsyntax');
  assert.equal(syntax.name, 'AWK');
  assert.match(syntax.id, /^cot-syntax-awk-[a-f0-9]{10}$/);
  assert.deepEqual(syntax.extensions, ['awk']);
  assert.deepEqual(syntax.filenames, ['makefile']);
  assert.deepEqual(syntax.comments.inline, [{ begin: '#', leadingOnly: true }]);
  assert.deepEqual(syntax.comments.blocks, [{ begin: '/*', end: '*/', escapeCharacter: '', isMultiline: false, isNestable: true }]);
  assert.deepEqual(syntax.strings, [{ begin: '"', end: '"', escapeCharacter: '\\', isMultiline: false, isNestable: false, prefixes: ['raw', 'f'] }]);
  assert.deepEqual(syntax.rules.map(rule => [rule.category, rule.begin, rule.regularExpression]), [
    ['keywords', 'BEGIN', false], ['keywords', 'if', false], ['variables', 'ARGC', false], ['numbers', '\\d+', true]
  ]);
  assert.deepEqual(syntax.outlines, [{
    pattern: 'function[ \\t]+(\\w+)', template: '$1', ignoreCase: false, kind: 'function', description: ''
  }]);
  assert.deepEqual(syntax.indentation.blockDelimiters, [{ begin: '{', end: '}', ignoreCase: false, description: 'block' }]);
  assert.deepEqual(syntax.unsupported, { highlightRules: 0, outlineRules: 0, indentationRules: 0 });
});

test('rejects malformed syntax metadata and caps imported patterns', () => {
  assert.throws(() => normalizeCotEditorSyntax('Broken.cotsyntax', null), /Info.json/);
  assert.throws(() => normalizeCotEditorSyntax('Broken.cotsyntax', { fileMap: [] }), /Info.json/);
  const syntax = normalizeCotEditorSyntax('Name<script>.cotsyntax', baseInfo);
  assert.doesNotMatch(syntax.name, /[\u0000-\u001f]/);
});

test('loads only bounded JSON files from a real .cotsyntax package directory', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'cotedit-cotsyntax-'));
  const packageDir = path.join(parent, 'Sample.cotsyntax');
  try {
    await mkdir(path.join(packageDir, 'Regex'), { recursive: true });
    await writeFile(path.join(packageDir, 'Info.json'), JSON.stringify(baseInfo));
    await writeFile(path.join(packageDir, 'Edit.json'), JSON.stringify({ comment: { inlines: [{ begin: '#' }] } }));
    await writeFile(path.join(packageDir, 'Regex', 'Highlights.json'), JSON.stringify({ keywords: [{ begin: 'BEGIN' }] }));
    await writeFile(path.join(packageDir, 'Regex', 'Outlines.json'), '[]');
    const syntax = await loadCotEditorSyntax(packageDir);
    assert.equal(syntax.name, 'Sample');
    assert.deepEqual(syntax.extensions, ['awk']);
    assert.deepEqual(syntax.rules.map(rule => rule.begin), ['BEGIN']);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('rejects symlinked syntax package files', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'cotedit-cotsyntax-link-'));
  const packageDir = path.join(parent, 'Link.cotsyntax');
  const outside = path.join(parent, 'outside.json');
  try {
    await mkdir(packageDir);
    await writeFile(outside, JSON.stringify(baseInfo));
    await symlink(outside, path.join(packageDir, 'Info.json'));
    await assert.rejects(loadCotEditorSyntax(packageDir), /ordinary|普通文件/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('rejects an oversized package JSON before parsing it', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'cotedit-cotsyntax-large-'));
  const packageDir = path.join(parent, 'Large.cotsyntax');
  try {
    await mkdir(packageDir);
    await writeFile(path.join(packageDir, 'Info.json'), ' '.repeat(1024 * 1024 + 1));
    await assert.rejects(loadCotEditorSyntax(packageDir), /超过 1 MB/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('normalizes CotEditor completion terms, removes duplicates and ignores malformed entries', () => {
  const control = String.fromCharCode(2, 0);
  const syntax = normalizeCotEditorSyntax('Completion.cotsyntax', baseInfo, {}, {}, [], [
    { text: 'AcceptFilter' }, { text: 'AcceptFilter' }, { text: `caf${control}2` }, null, { text: '  ' }, { text: 'next\nline' }
  ]);
  assert.deepEqual(syntax.completions, ['AcceptFilter', 'caf2', 'nextline']);
});

test('loads multiple dropped syntax packages in order and deduplicates repeated paths', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'cotedit-cotsyntax-drop-'));
  const first = path.join(parent, 'First.cotsyntax');
  const second = path.join(parent, 'Second.cotsyntax');
  try {
    await mkdir(first);
    await mkdir(second);
    await writeFile(path.join(first, 'Info.json'), JSON.stringify({ kind: 'code', fileMap: { extensions: ['one'] } }));
    await writeFile(path.join(second, 'Info.json'), JSON.stringify({ kind: 'code', fileMap: { extensions: ['two'] } }));
    assert.deepEqual(normalizeDroppedCotEditorSyntaxPaths([first, first, second]), [first, second]);
    const packages = await loadCotEditorSyntaxPackages([first, second]);
    assert.deepEqual(packages.map(item => [item.name, item.extensions]), [['First', ['one']], ['Second', ['two']]]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('dropped syntax path validation rejects empty, excessive, relative and non-package inputs', async () => {
  assert.throws(() => normalizeDroppedCotEditorSyntaxPaths([]), /最多拖入 20/);
  assert.throws(() => normalizeDroppedCotEditorSyntaxPaths(Array(21).fill('/tmp/Sample.cotsyntax')), /最多拖入 20/);
  assert.throws(() => normalizeDroppedCotEditorSyntaxPaths(['Sample.cotsyntax']), /路径无效/);
  assert.throws(() => normalizeDroppedCotEditorSyntaxPaths(['/tmp/Sample.json']), /必须是/);
});
