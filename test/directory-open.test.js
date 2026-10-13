import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';

const require = createRequire(import.meta.url);
const { openExternalFileInRoot, openFileWithApplicationInRoot } = require('../electron/directory-open.cjs');

async function makeRoots(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-external-preview-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-external-outside-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  return { root, outside };
}

test('opens only the canonical regular preview file within the selected root', async t => {
  const { root } = await makeRoots(t);
  const directory = path.join(root, 'notes');
  await fs.mkdir(directory);
  const filePath = path.join(directory, 'readme.txt');
  await fs.writeFile(filePath, 'hello');
  const opened = [];

  assert.equal(await openExternalFileInRoot(root, filePath, async target => { opened.push(target); return ''; }), true);
  assert.deepEqual(opened, [filePath]);
});

test('keeps explicit system-default-app opening available for UNIX executable files', async t => {
  const { root } = await makeRoots(t);
  const filePath = path.join(root, 'tool');
  await fs.writeFile(filePath, '#!/bin/sh\nexit 0\n');
  await fs.chmod(filePath, 0o755);
  const opened = [];

  assert.equal(await openExternalFileInRoot(root, filePath, async target => { opened.push(target); return ''; }), true);
  assert.deepEqual(opened, [filePath]);
});

test('rejects outside paths, symlink escapes, and directories before invoking the system opener', async t => {
  const { root, outside } = await makeRoots(t);
  const outsideFile = path.join(outside, 'secret.txt');
  await fs.writeFile(outsideFile, 'secret');
  const linkPath = path.join(root, 'outside.txt');
  await fs.symlink(outsideFile, linkPath);
  let calls = 0;
  const opener = async () => { calls++; return ''; };

  await assert.rejects(openExternalFileInRoot(root, outsideFile, opener), /超出已选文件夹范围/);
  await assert.rejects(openExternalFileInRoot(root, linkPath, opener), /符号链接离开/);
  await assert.rejects(openExternalFileInRoot(root, root, opener), /不是文件/);
  assert.equal(calls, 0);
});

test('surfaces operating-system default-app launch failures to the caller', async t => {
  const { root } = await makeRoots(t);
  const filePath = path.join(root, 'notes.txt');
  await fs.writeFile(filePath, 'notes');

  await assert.rejects(openExternalFileInRoot(root, filePath, async () => 'No application is associated with this file.'), /No application is associated/);
  await assert.rejects(openExternalFileInRoot(root, filePath, null), /启动器不可用/);
});

test('launches a validated Linux application with the canonical preview file as a separate argument', async t => {
  const { root, outside } = await makeRoots(t);
  const filePath = path.join(root, 'notes with spaces.txt');
  const applicationPath = path.join(outside, 'text-editor');
  await fs.writeFile(filePath, 'notes');
  await fs.writeFile(applicationPath, '#!/bin/sh\nexit 0\n');
  await fs.chmod(applicationPath, 0o755);
  let launched;
  const spawnProcess = (executable, args, options) => {
    launched = { executable, args, options };
    const child = new EventEmitter();
    child.unref = () => { launched.unref = true; };
    process.nextTick(() => child.emit('spawn'));
    return child;
  };

  assert.equal(await openFileWithApplicationInRoot(root, filePath, applicationPath, { platform: 'linux', spawnProcess }), true);
  assert.equal(launched.executable, await fs.realpath(applicationPath));
  assert.deepEqual(launched.args, [filePath]);
  assert.equal(launched.options.shell, false);
  assert.equal(launched.options.detached, true);
  assert.equal(launched.unref, true);
});

test('uses platform-specific launch arguments for a macOS app bundle and Windows executable', async t => {
  const { root, outside } = await makeRoots(t);
  const filePath = path.join(root, 'notes.txt');
  const macApplication = path.join(outside, 'Text Editor.app');
  const windowsApplication = path.join(outside, 'TextEditor.exe');
  await fs.writeFile(filePath, 'notes');
  await fs.mkdir(macApplication);
  await fs.writeFile(windowsApplication, 'test executable placeholder');
  const launches = [];
  const spawnProcess = (executable, args, options) => {
    launches.push({ executable, args, options });
    const child = new EventEmitter();
    child.unref = () => {};
    process.nextTick(() => child.emit('spawn'));
    return child;
  };

  assert.equal(await openFileWithApplicationInRoot(root, filePath, macApplication, { platform: 'darwin', spawnProcess }), true);
  assert.equal(await openFileWithApplicationInRoot(root, filePath, windowsApplication, { platform: 'win32', spawnProcess }), true);
  assert.deepEqual(launches[0].executable, 'open');
  assert.deepEqual(launches[0].args, ['-a', macApplication, filePath]);
  assert.equal(launches[1].executable, windowsApplication);
  assert.deepEqual(launches[1].args, [filePath]);
  assert.equal(launches[1].options.windowsHide, true);
});

test('rejects an invalid selected application or a preview path outside the root before launching', async t => {
  const { root, outside } = await makeRoots(t);
  const filePath = path.join(root, 'notes.txt');
  const outsideFile = path.join(outside, 'outside.txt');
  const nonExecutable = path.join(outside, 'not-executable');
  await fs.writeFile(filePath, 'notes');
  await fs.writeFile(outsideFile, 'outside');
  await fs.writeFile(nonExecutable, 'not executable');
  let calls = 0;
  const spawnProcess = () => { calls++; throw new Error('should not launch'); };

  if (process.platform !== 'win32') {
    await assert.rejects(openFileWithApplicationInRoot(root, filePath, nonExecutable, { platform: 'linux', spawnProcess }), /不可执行/);
  }
  await assert.rejects(openFileWithApplicationInRoot(root, outsideFile, nonExecutable, { platform: 'linux', spawnProcess }), /超出已选文件夹范围/);
  await assert.rejects(openFileWithApplicationInRoot(root, filePath, nonExecutable, { platform: 'win32', spawnProcess }), /Windows 可执行应用/);
  assert.equal(calls, 0);
});
