import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { listDirectory, MAX_DIRECTORY_ENTRIES, MAX_DIRECTORY_FILTER_LENGTH } = require('../electron/directory-navigation.cjs');

async function temporaryDirectories(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-folder-nav-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-folder-outside-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  return { root, outside };
}

test('lists directories before files and does not expose symlinks', async t => {
  const { root, outside } = await temporaryDirectories(t);
  await fs.mkdir(path.join(root, 'Zed'));
  await fs.mkdir(path.join(root, 'Alpha'));
  await fs.writeFile(path.join(root, 'z.txt'), 'text');
  await fs.writeFile(path.join(root, 'a.md'), '# note');
  await fs.writeFile(path.join(outside, 'secret.txt'), 'private');
  await fs.symlink(outside, path.join(root, 'outside-link'), 'dir');
  await fs.symlink(path.join(root, 'z.txt'), path.join(root, 'file-link'));

  const result = await listDirectory(root, root);
  assert.equal(result.root, root);
  assert.equal(result.path, root);
  assert.equal(result.parentPath, null);
  assert.deepEqual(result.entries.map(entry => `${entry.kind}:${entry.name}`), [
    'directory:Alpha', 'directory:Zed', 'file:a.md', 'file:z.txt'
  ]);
  const nested = await listDirectory(root, path.join(root, 'Alpha'));
  assert.equal(nested.parentPath, root);
});

test('rejects lexical traversal and symlink escapes from the selected root', async t => {
  const { root, outside } = await temporaryDirectories(t);
  await fs.mkdir(path.join(root, 'safe'));
  await fs.writeFile(path.join(outside, 'secret.txt'), 'private');
  await fs.symlink(outside, path.join(root, 'escape'), 'dir');

  await assert.rejects(listDirectory(root, outside), /超出已选文件夹范围/);
  await assert.rejects(listDirectory(root, path.join(root, 'escape')), /符号链接离开/);
  await assert.rejects(listDirectory(root, path.join(root, 'missing')), /ENOENT/);
});

test('filename filter searches normalized names across files and directories without case sensitivity', async t => {
  const { root } = await temporaryDirectories(t);
  await fs.mkdir(path.join(root, 'Source Café'));
  await fs.writeFile(path.join(root, 'README.MD'), 'text');
  await fs.writeFile(path.join(root, 'cafe\u0301-notes.txt'), 'text');
  await fs.writeFile(path.join(root, 'other.txt'), 'text');

  const result = await listDirectory(root, root, { nameFilter: 'CAFÉ' });
  assert.deepEqual(result.entries.map(entry => [entry.kind, entry.name]), [
    ['directory', 'Source Café'],
    ['file', 'cafe\u0301-notes.txt']
  ]);
  assert.equal(result.truncated, false);
  assert.equal(result.truncatedByEntries, false);
  assert.equal(result.truncatedByScan, false);
  assert.equal(result.scanned, 4);
});

test('filename filter searches beyond the unfiltered list limit but keeps bounded result limits', async t => {
  const { root } = await temporaryDirectories(t);
  const names = Array.from({ length: MAX_DIRECTORY_ENTRIES + 7 }, (_, index) => `entry-${String(index).padStart(4, '0')}.txt`);
  for (const name of names) await fs.writeFile(path.join(root, name), 'text');

  const unfiltered = await listDirectory(root, root);
  assert.equal(unfiltered.entries.length, MAX_DIRECTORY_ENTRIES);
  assert.equal(unfiltered.truncatedByEntries, true);
  const visibleNames = new Set(unfiltered.entries.map(entry => entry.name));
  const omittedName = names.find(name => !visibleNames.has(name));
  assert.ok(omittedName, 'the fixture contains an entry beyond the unfiltered display limit');

  const found = await listDirectory(root, root, { nameFilter: omittedName });
  assert.deepEqual(found.entries.map(entry => entry.name), [omittedName]);
  assert.equal(found.truncated, false);
  assert.equal(found.scanned, names.length);

  const commonNameFilter = await listDirectory(root, root, { nameFilter: 'entry-' });
  assert.equal(commonNameFilter.entries.length, MAX_DIRECTORY_ENTRIES);
  assert.equal(commonNameFilter.truncatedByEntries, true);
});

test('filename filter input is type-checked and bounded by Unicode characters', async t => {
  const { root } = await temporaryDirectories(t);
  await fs.writeFile(path.join(root, 'note.txt'), 'text');

  await assert.rejects(listDirectory(root, root, { nameFilter: 42 }), /筛选条件无效/);
  await assert.rejects(listDirectory(root, root, { nameFilter: 'x'.repeat(MAX_DIRECTORY_FILTER_LENGTH + 1) }), /不能超过/);
  assert.equal((await listDirectory(root, root, { nameFilter: 'x'.repeat(MAX_DIRECTORY_FILTER_LENGTH) })).entries.length, 0);
});
