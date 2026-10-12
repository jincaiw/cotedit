import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { collectExternalFilePaths } = require('../electron/external-open.cjs');

 test('collects only existing file arguments and deduplicates them', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cotedit-external-open-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const documentPath = path.join(root, 'notes with spaces.txt');
  const optionValuePath = path.join(root, 'debug.log');
  const directoryPath = path.join(root, 'folder');
  await writeFile(documentPath, 'notes');
  await writeFile(optionValuePath, 'log');
  await mkdir(directoryPath);

  const paths = await collectExternalFilePaths([
    '/Applications/CotEdit.app/Contents/MacOS/CotEdit', documentPath,
    '--user-data-dir', optionValuePath, '--no-sandbox', path.join(root, 'missing.txt'),
    directoryPath, documentPath
  ], root);
  assert.deepEqual(paths, [documentPath]);
});

test('returns no candidates for invalid argument lists or when no file exists', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cotedit-external-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await collectExternalFilePaths(null, root), []);
  assert.deepEqual(await collectExternalFilePaths(['CotEdit', '--no-sandbox', '.', 'missing.txt'], root), []);
});

test('registers external document routing on macOS and second-instance launch paths', async () => {
  const [main, preload, renderer] = await Promise.all([
    readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../electron/preload.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  ]);
  assert.match(main, /app\.requestSingleInstanceLock\(\)/);
  assert.match(main, /app\.on\('open-file'/);
  assert.match(main, /app\.on\('second-instance'/);
  assert.match(main, /collectExternalFilePaths\(/);
  assert.match(preload, /onOpenExternalDocument:/);
  assert.match(renderer, /onOpenExternalDocument\(/);
});
