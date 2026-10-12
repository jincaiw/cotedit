import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createFileInRoot, createFolderInRoot } = require('../electron/directory-mutations.cjs');

async function temporaryDirectories(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-create-root-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-create-outside-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  return { root, outside };
}

test('creates empty files with unique names without overwriting an existing item', async t => {
  const { root } = await temporaryDirectories(t);
  const existingFile = path.join(root, 'Untitled.txt');
  const conflictingDirectory = path.join(root, 'Untitled 2.txt');
  await fs.writeFile(existingFile, 'keep this text');
  await fs.mkdir(conflictingDirectory);

  const created = await createFileInRoot(root, root);
  assert.equal(created.kind, 'file');
  assert.equal(created.name, 'Untitled 3.txt');
  assert.equal(created.path, path.join(root, created.name));
  assert.equal(created.parentPath, root);
  assert.equal(await fs.readFile(existingFile, 'utf8'), 'keep this text');
  assert.equal((await fs.readFile(created.path)).length, 0);
});

test('uses localized default names and keeps unique numbering before the file extension', async t => {
  const { root } = await temporaryDirectories(t);
  const localizedFile = await createFileInRoot(root, root, 'zh-CN');
  assert.equal(localizedFile.name, '未命名.txt');
  await fs.writeFile(path.join(root, '未命名 2.txt'), 'keep localized collision');
  const nextFile = await createFileInRoot(root, root, 'zh_Hans_CN');
  assert.equal(nextFile.name, '未命名 3.txt');
  assert.equal(await fs.readFile(path.join(root, '未命名 2.txt'), 'utf8'), 'keep localized collision');

  const localizedFolder = await createFolderInRoot(root, root, 'zh-Hans-CN');
  assert.equal(localizedFolder.name, '未命名文件夹');
  assert.ok((await fs.stat(localizedFolder.path)).isDirectory());
});

test('maps Traditional Chinese locale aliases and falls back to CotEditor source-language names', async t => {
  const { root } = await temporaryDirectories(t);
  const taiwanFolder = await createFolderInRoot(root, root, 'zh_TW');
  const hongKongFolder = await createFolderInRoot(root, root, 'zh-HK');
  const unknownLocaleFile = await createFileInRoot(root, root, 'xx-YY');
  assert.equal(taiwanFolder.name, '未命名檔案夾');
  assert.equal(hongKongFolder.name, '未命名資料夾');
  assert.equal(unknownLocaleFile.name, 'Untitled.txt');
});

test('creates uniquely named folders beside existing files and folders', async t => {
  const { root } = await temporaryDirectories(t);
  const existingFolder = path.join(root, 'untitled folder');
  const conflictingFile = path.join(root, 'untitled folder 2');
  await fs.mkdir(existingFolder);
  await fs.writeFile(conflictingFile, 'keep');

  const created = await createFolderInRoot(root, root);
  assert.equal(created.kind, 'directory');
  assert.equal(created.name, 'untitled folder 3');
  assert.equal(created.path, path.join(root, created.name));
  assert.equal(created.parentPath, root);
  assert.ok((await fs.stat(created.path)).isDirectory());
  assert.equal(await fs.readFile(conflictingFile, 'utf8'), 'keep');
});

test('creates inside an explicitly requested nested directory but rejects traversal and symlink escapes', async t => {
  const { root, outside } = await temporaryDirectories(t);
  const nested = path.join(root, 'nested');
  await fs.mkdir(nested);
  await fs.symlink(outside, path.join(root, 'outside-link'), 'dir');

  const created = await createFileInRoot(root, nested);
  assert.equal(created.parentPath, nested);
  await assert.rejects(createFileInRoot(root, outside), /超出已选文件夹范围/);
  await assert.rejects(createFolderInRoot(root, path.join(root, 'outside-link')), /符号链接离开/);
});

test('rejects file paths as creation parents and invalid root arguments', async t => {
  const { root } = await temporaryDirectories(t);
  const filePath = path.join(root, 'note.txt');
  await fs.writeFile(filePath, 'text');

  await assert.rejects(createFileInRoot(root, filePath), /不是文件夹/);
  await assert.rejects(createFolderInRoot('', root), /路径无效/);
  await assert.rejects(createFileInRoot(root, ''), /路径无效/);
});

test('creates new files with the requested syntax extension and numbers collisions before that extension', async t => {
  const { root } = await temporaryDirectories(t);
  const existing = path.join(root, 'Untitled 2.md');
  await fs.writeFile(existing, 'keep');

  const created = await createFileInRoot(root, root, 'en-US', 'MD');
  assert.equal(created.name, 'Untitled.md');
  const next = await createFileInRoot(root, root, 'en-US', 'md');
  assert.equal(next.name, 'Untitled 3.md');
  assert.equal(await fs.readFile(existing, 'utf8'), 'keep');
});

test('falls back to the plain-text extension when the requested extension is unsafe', async t => {
  const { root } = await temporaryDirectories(t);
  const created = await createFileInRoot(root, root, 'en-US', '../escape');
  assert.equal(created.name, 'Untitled.txt');
  assert.equal(path.dirname(created.path), root);
});
