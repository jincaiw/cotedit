'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { constants: fsConstants } = require('node:fs');
const path = require('node:path');
const { resolveRegularFileInRoot } = require('./directory-search.cjs');

async function openExternalFileInRoot(rootPath, requestedPath, openPath) {
  if (typeof openPath !== 'function') throw new Error('系统默认应用启动器不可用。');
  const { path: filePath } = await resolveRegularFileInRoot(rootPath, requestedPath);
  const error = await openPath(filePath);
  if (typeof error === 'string' && error.trim()) throw new Error(error.trim().slice(0, 500));
  return true;
}

async function validateSelectedApplication(applicationPath, platform) {
  if (typeof applicationPath !== 'string' || !applicationPath.trim()) throw new Error('所选应用路径无效。');
  const selectedPath = path.resolve(applicationPath);
  const realPath = await fs.realpath(selectedPath);
  const stat = await fs.stat(realPath);

  if (platform === 'darwin') {
    if (!stat.isDirectory() || !selectedPath.toLowerCase().endsWith('.app')) {
      throw new Error('请选择有效的 macOS 应用程序（.app）。');
    }
  } else if (platform === 'win32') {
    if (!stat.isFile() || path.extname(selectedPath).toLowerCase() !== '.exe') {
      throw new Error('请选择 Windows 可执行应用（.exe）。');
    }
  } else {
    if (!stat.isFile()) throw new Error('所选应用不是普通文件。');
    try {
      await fs.access(realPath, fsConstants.X_OK);
    } catch {
      throw new Error('所选文件不可执行。');
    }
  }

  return { selectedPath, realPath };
}

function launchSelectedApplication(platform, selectedPath, realPath, filePath, spawnProcess) {
  const executable = platform === 'darwin' ? 'open' : (platform === 'win32' ? selectedPath : realPath);
  const args = platform === 'darwin' ? ['-a', selectedPath, filePath] : [filePath];
  const childOptions = { detached: true, stdio: 'ignore', shell: false, windowsHide: platform === 'win32' };

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess(executable, args, childOptions);
    } catch (error) {
      reject(error);
      return;
    }
    if (!child || typeof child.once !== 'function') {
      reject(new Error('无法启动所选应用。'));
      return;
    }
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref?.();
      resolve(true);
    });
  });
}

async function openFileWithApplicationInRoot(rootPath, requestedPath, applicationPath, {
  platform = process.platform,
  spawnProcess = spawn
} = {}) {
  if (typeof spawnProcess !== 'function') throw new Error('所选应用启动器不可用。');
  const { path: filePath } = await resolveRegularFileInRoot(rootPath, requestedPath);
  const application = await validateSelectedApplication(applicationPath, platform);
  return launchSelectedApplication(platform, application.selectedPath, application.realPath, filePath, spawnProcess);
}

module.exports = {
  openExternalFileInRoot,
  openFileWithApplicationInRoot
};
