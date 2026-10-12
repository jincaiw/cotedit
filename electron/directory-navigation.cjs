const fs = require('node:fs/promises');
const path = require('node:path');
const { resolveWithinRoot } = require('./root-path.cjs');

const MAX_DIRECTORY_ENTRIES = 500;
const MAX_DIRECTORY_SCAN = 10000;
const MAX_DIRECTORY_FILTER_LENGTH = 256;

function normalizeDirectoryNameFilter(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('文件名筛选条件无效。');
  const normalized = value.normalize('NFC');
  if (Array.from(normalized).length > MAX_DIRECTORY_FILTER_LENGTH) throw new Error(`文件名筛选条件不能超过 ${MAX_DIRECTORY_FILTER_LENGTH} 个 Unicode 字符。`);
  return normalized.toLowerCase();
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function listDirectory(rootPath, requestedPath = rootPath, options = {}) {
  if (typeof rootPath !== 'string' || !rootPath || typeof requestedPath !== 'string' || !requestedPath) {
    throw new Error('文件夹路径无效。');
  }
  const nameFilter = normalizeDirectoryNameFilter(options?.nameFilter);
  const resolvedRoot = await resolveWithinRoot(rootPath, requestedPath, {
    invalid: '文件夹路径无效。',
    outOfRange: '导航路径超出已选文件夹范围。',
    escaped: '导航路径通过符号链接离开了已选文件夹。'
  });
  const root = resolvedRoot.root;
  const current = resolvedRoot.path;
  const stat = await fs.stat(current);
  if (!stat.isDirectory()) throw new Error('所选路径不是文件夹。');

  const entries = [];
  let scanned = 0;
  let truncated = false;
  let truncatedByEntries = false;
  let truncatedByScan = false;
  const directory = await fs.opendir(current);
  for await (const entry of directory) {
    if (scanned >= MAX_DIRECTORY_SCAN) {
      truncated = true;
      truncatedByScan = true;
      break;
    }
    scanned++;
    if (entry.isSymbolicLink()) continue;
    const kind = entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : null;
    if (!kind) continue;
    if (nameFilter && !entry.name.normalize('NFC').toLowerCase().includes(nameFilter)) continue;
    entries.push({ name: entry.name, kind, path: path.join(current, entry.name) });
    if (entries.length >= MAX_DIRECTORY_ENTRIES) {
      truncated = true;
      truncatedByEntries = true;
      break;
    }
  }
  entries.sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'directory' ? -1 : 1) || left.name.localeCompare(right.name));
  const parentPath = current === root ? null : path.dirname(current);
  return { root, path: current, parentPath, entries, scanned, truncated, truncatedByEntries, truncatedByScan };
}

module.exports = { listDirectory, MAX_DIRECTORY_ENTRIES, MAX_DIRECTORY_SCAN, MAX_DIRECTORY_FILTER_LENGTH };
