'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const FLAGS_WITH_VALUES = new Set([
  '--user-data-dir', '--app-path', '--remote-debugging-port', '--inspect-port',
  '--proxy-server', '--host-rules', '--log-file'
]);

async function collectExternalFilePaths(argv, workingDirectory = process.cwd()) {
  if (!Array.isArray(argv)) return [];
  const cwd = typeof workingDirectory === 'string' ? workingDirectory : process.cwd();
  const paths = [];
  let skipNext = false;

  for (const argument of argv.slice(1)) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (typeof argument !== 'string' || !argument) continue;
    if (FLAGS_WITH_VALUES.has(argument)) {
      skipNext = true;
      continue;
    }
    if (argument.startsWith('-') || !argument.trim()) continue;

    const filePath = path.resolve(cwd, argument);
    try {
      if ((await fs.stat(filePath)).isFile()) paths.push(filePath);
    } catch {
      // Ignore switches, missing files, and directories; only existing files open as documents.
    }
  }

  return [...new Set(paths)];
}

module.exports = { collectExternalFilePaths };
