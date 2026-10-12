'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_SCRIPT_FILES = 100;
const MAX_SCRIPT_BYTES = 256 * 1024;
const NAME_PATTERN = /^\/\/\s*@name:\s*(.+?)\s*$/m;

async function loadUserScripts(directory) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const candidates = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.js') && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, MAX_SCRIPT_FILES);
  const scripts = [];
  for (const entry of candidates) {
    const filename = path.join(directory, entry.name);
    try {
      const stat = await fs.stat(filename);
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_SCRIPT_BYTES) continue;
      const source = await fs.readFile(filename, 'utf8');
      if (!source.trim()) continue;
      const headerName = source.match(NAME_PATTERN)?.[1];
      const name = (headerName || path.basename(entry.name, '.js')).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
      if (!name) continue;
      scripts.push({ id: entry.name, name, source });
    } catch {
      // Ignore unreadable or concurrently removed script files.
    }
  }
  return scripts;
}

function findUserScript(scripts, requestedId) {
  if (typeof requestedId !== 'string' || requestedId.length > 180 || path.basename(requestedId) !== requestedId || !requestedId.toLowerCase().endsWith('.js')) {
    return null;
  }
  return scripts.find(script => script.id === requestedId) || null;
}

module.exports = { MAX_SCRIPT_BYTES, MAX_SCRIPT_FILES, findUserScript, loadUserScripts };
