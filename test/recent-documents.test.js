import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MAX_RECENT_DOCUMENTS, normalizeRecentDocuments, addRecentDocument, filterExistingRecentDocuments } = require('../lib/recent-documents.cjs');

test('recent document list drops malformed entries, normalizes and deduplicates paths', () => {
  assert.deepEqual(normalizeRecentDocuments(['/tmp/a.txt', '/tmp/../tmp/a.txt', null, '', 4]), ['/tmp/a.txt']);
});

test('adding a recent document moves it to the front and enforces a bounded list', () => {
  const items = Array.from({ length: MAX_RECENT_DOCUMENTS }, (_, index) => `/tmp/${index}.txt`);
  const updated = addRecentDocument(items, '/tmp/5.txt');
  assert.equal(updated[0], '/tmp/5.txt');
  assert.equal(updated.length, MAX_RECENT_DOCUMENTS);
  assert.equal(updated.filter(item => item === '/tmp/5.txt').length, 1);
  assert.equal(addRecentDocument(updated, '').length, MAX_RECENT_DOCUMENTS);
});

test('Windows recent paths deduplicate without case sensitivity', () => {
  assert.deepEqual(normalizeRecentDocuments(['C:\\work\\File.txt', 'c:\\work\\file.txt'], 'win32').length, 1);
});

test('filters unavailable recent paths while preserving the order of regular files', async () => {
  const filtered = await filterExistingRecentDocuments(['/tmp/a.txt', '/tmp/missing.txt', '/tmp/folder', '/tmp/b.txt'], async filePath => {
    if (filePath.endsWith('missing.txt')) throw new Error('gone');
    return filePath.endsWith('.txt');
  });
  assert.deepEqual(filtered, ['/tmp/a.txt', '/tmp/b.txt']);
});
