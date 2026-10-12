import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { atomicWrite } = require('../electron/atomic-write.cjs');

test('atomic replacement retains an existing POSIX file mode', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cotedit-atomic-write-'));
  const filename = path.join(dir, 'script.sh');
  try {
    await writeFile(filename, 'old');
    await chmod(filename, 0o754);
    await atomicWrite(filename, 'new text');
    assert.equal(await readFile(filename, 'utf8'), 'new text');
    assert.equal((await stat(filename)).mode & 0o777, 0o754);
    assert.deepEqual(await readdir(dir), ['script.sh']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('atomic creation keeps new documents private by default', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cotedit-atomic-write-'));
  const filename = path.join(dir, 'new.txt');
  try {
    await atomicWrite(filename, 'new');
    assert.equal(await readFile(filename, 'utf8'), 'new');
    assert.equal((await stat(filename)).mode & 0o077, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('atomic write returns the exact encoded byte length including a BOM', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cotedit-atomic-write-'));
  const filename = path.join(dir, 'unicode.txt');
  try {
    const reportedSize = await atomicWrite(filename, 'é😀', 'utf8', true);
    assert.equal(reportedSize, (await stat(filename)).size);
    assert.equal(reportedSize, Buffer.byteLength('é😀', 'utf8') + 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
