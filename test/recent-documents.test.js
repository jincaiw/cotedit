import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MAX_RECENT_DOCUMENTS, normalizeRecentDocuments, addRecentDocument, filterExistingRecentDocuments } = require('../lib/recent-documents.cjs');

test('recent document list drops malformed entries, normalizes and deduplicates paths', () => {
  const first = path.join(path.resolve('tmp'), 'a.txt');
  const alias = path.join(path.dirname(first), '..', 'tmp', 'a.txt');
  assert.deepEqual(normalizeRecentDocuments([first, alias, null, '', 4]), [first]);
});

test('adding a recent document moves it to the front and enforces a bounded list', () => {
  const root = path.resolve('tmp');
  const items = Array.from({ length: MAX_RECENT_DOCUMENTS }, (_, index) => path.join(root, `${index}.txt`));
  const target = path.join(root, '5.txt');
  const updated = addRecentDocument(items, target);
  assert.equal(updated[0], target);
  assert.equal(updated.length, MAX_RECENT_DOCUMENTS);
  assert.equal(updated.filter(item => item === target).length, 1);
  assert.equal(addRecentDocument(updated, '').length, MAX_RECENT_DOCUMENTS);
});

test('Windows recent paths deduplicate without case sensitivity', () => {
  assert.deepEqual(normalizeRecentDocuments(['C:\\work\\File.txt', 'c:\\work\\file.txt'], 'win32').length, 1);
});

test('filters unavailable recent paths while preserving the order of regular files', async () => {
  const root = path.resolve('tmp');
  const first = path.join(root, 'a.txt');
  const missing = path.join(root, 'missing.txt');
  const folder = path.join(root, 'folder');
  const second = path.join(root, 'b.txt');
  const filtered = await filterExistingRecentDocuments([first, missing, folder, second], async filePath => {
    if (filePath === missing) throw new Error('gone');
    return filePath.endsWith('.txt');
  });
  assert.deepEqual(filtered, [first, second]);
});
