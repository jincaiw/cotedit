'use strict';

const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { resolveRegularFileInRoot } = require('./directory-search.cjs');

const MAX_GIO_OUTPUT_BYTES = 96 * 1024;
const MAX_DESKTOP_FILE_BYTES = 128 * 1024;
const MAX_DESKTOP_INDEX_ENTRIES = 15000;
const MAX_DESKTOP_INDEX_DEPTH = 5;
const MAX_REGISTERED_APPLICATIONS = 64;
const INDEX_CACHE_MS = 60 * 1000;
const desktopIndexCache = new Map();

function isDesktopId(value) {
  return typeof value === 'string'
    && value.length > 8
    && value.length <= 255
    && value.endsWith('.desktop')
    && !/[\s\u0000-\u001f\u007f/\\]/u.test(value);
}

function parseGioMimeApplications(output) {
  if (typeof output !== 'string') return { defaultId: null, ids: [] };
  const lines = output.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  const defaultLine = lines.find(line => /^Default application for .+?:\s*\S+\.desktop$/u.test(line));
  const defaultMatch = defaultLine?.match(/:\s*(\S+\.desktop)$/u);
  const defaultId = isDesktopId(defaultMatch?.[1]) ? defaultMatch[1] : null;
  const ids = [];
  const seen = new Set();
  for (const line of lines) {
    if (!isDesktopId(line) || seen.has(line)) continue;
    seen.add(line);
    ids.push(line);
  }
  if (defaultId) {
    const index = ids.indexOf(defaultId);
    if (index > 0) ids.unshift(...ids.splice(index, 1));
    else if (index < 0) ids.unshift(defaultId);
  }
  return { defaultId, ids };
}

function unescapeDesktopValue(value) {
  return value.replace(/\\([sntr\\])/gu, (_match, escaped) => ({
    s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\'
  })[escaped]);
}

function localeNameKeys(locale) {
  const normalized = typeof locale === 'string' ? locale.trim().split(/[.@]/u, 1)[0] : '';
  const base = normalized.replace(/-/gu, '_');
  const keys = [];
  if (base) {
    keys.push(`Name[${base}]`);
    const language = base.split('_', 1)[0];
    if (language && language !== base) keys.push(`Name[${language}]`);
  }
  keys.push('Name');
  return [...new Set(keys)];
}

function parseDesktopEntry(contents, locale = 'en-US') {
  if (typeof contents !== 'string') return null;
  const fields = new Map();
  let inDesktopEntry = false;
  for (const rawLine of contents.replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inDesktopEntry = line === '[Desktop Entry]';
      continue;
    }
    if (!inDesktopEntry) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!fields.has(key)) fields.set(key, line.slice(separator + 1));
  }
  if (fields.get('Type') !== 'Application'
      || fields.get('Hidden')?.toLowerCase() === 'true'
      || fields.get('NoDisplay')?.toLowerCase() === 'true') return null;
  let rawName;
  for (const key of localeNameKeys(locale)) {
    if (fields.has(key)) { rawName = fields.get(key); break; }
  }
  const displayName = unescapeDesktopValue(rawName || '').trim();
  if (!displayName || displayName.length > 160 || /[\u0000-\u001f\u007f]/u.test(displayName)) return null;
  const version = unescapeDesktopValue(fields.get('X-CotEdit-Version') || fields.get('Version') || '').trim();
  if (version.length > 80 || /[\u0000-\u001f\u007f]/u.test(version)) return null;
  return { displayName, version };
}

function applicationDirectories(env = process.env, home = os.homedir()) {
  const userData = typeof env.XDG_DATA_HOME === 'string' && path.isAbsolute(env.XDG_DATA_HOME)
    ? env.XDG_DATA_HOME
    : path.join(home, '.local', 'share');
  const systemData = typeof env.XDG_DATA_DIRS === 'string' && env.XDG_DATA_DIRS.trim()
    ? env.XDG_DATA_DIRS.split(path.delimiter).filter(item => path.isAbsolute(item))
    : ['/usr/local/share', '/usr/share'];
  return [...new Set([userData, ...systemData].map(directory => path.join(path.resolve(directory), 'applications')))];
}

async function buildDesktopFileIndex(directories) {
  const index = new Map();
  let visited = 0;
  for (const applicationsDirectory of directories) {
    const root = path.resolve(applicationsDirectory);
    const stack = [{ directory: root, depth: 0 }];
    while (stack.length && visited < MAX_DESKTOP_INDEX_ENTRIES) {
      const current = stack.pop();
      let entries;
      try { entries = await fs.readdir(current.directory, { withFileTypes: true }); } catch { continue; }
      entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
      for (const entry of entries) {
        if (++visited > MAX_DESKTOP_INDEX_ENTRIES) break;
        const filePath = path.join(current.directory, entry.name);
        if (entry.isDirectory() && current.depth < MAX_DESKTOP_INDEX_DEPTH) {
          stack.push({ directory: filePath, depth: current.depth + 1 });
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.desktop')) continue;
        const relative = path.relative(root, filePath);
        const id = relative.split(path.sep).join('-');
        if (!isDesktopId(id) || index.has(id)) continue;
        index.set(id, { filePath, applicationsDirectory: root });
      }
    }
    if (visited >= MAX_DESKTOP_INDEX_ENTRIES) break;
  }
  return index;
}

async function getDesktopFileIndex(directories) {
  const key = directories.join('\u0000');
  const now = Date.now();
  const cached = desktopIndexCache.get(key);
  if (cached && now - cached.createdAt < INDEX_CACHE_MS) return cached.promise;
  const promise = buildDesktopFileIndex(directories);
  desktopIndexCache.set(key, { createdAt: now, promise });
  if (desktopIndexCache.size > 8) {
    for (const [entryKey, entry] of desktopIndexCache) {
      if (now - entry.createdAt >= INDEX_CACHE_MS || entryKey !== key) desktopIndexCache.delete(entryKey);
      if (desktopIndexCache.size <= 8) break;
    }
  }
  return promise;
}

function executeFile(executable, args, execFileImpl = execFile, extraOptions = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      encoding: 'utf8',
      timeout: 1500,
      maxBuffer: MAX_GIO_OUTPUT_BYTES,
      windowsHide: true,
      shell: false,
      ...extraOptions
    };
    try {
      execFileImpl(executable, args, options, (error, stdout) => {
        if (error) reject(error);
        else resolve(typeof stdout === 'string' ? stdout : '');
      });
    } catch (error) {
      reject(error);
    }
  });
}

function contentTypeFromGioInfo(output) {
  if (typeof output !== 'string') return null;
  const match = output.match(/^\s*standard::content-type:\s*([A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+)\s*$/mu);
  return match?.[1] || null;
}

async function loadRegisteredApplications(filePath, {
  env = process.env,
  home = os.homedir(),
  locale = 'en-US',
  execFileImpl = execFile
} = {}) {
  let info;
  try {
    info = await executeFile('gio', ['info', '--attributes=standard::content-type', filePath], execFileImpl, {
      env: { ...env, LC_ALL: 'C', LANG: 'C' }
    });
  } catch {
    return [];
  }
  const contentType = contentTypeFromGioInfo(info);
  if (!contentType) return [];
  let listing;
  try {
    listing = await executeFile('gio', ['mime', contentType], execFileImpl, {
      env: { ...env, LC_ALL: 'C', LANG: 'C' }
    });
  } catch {
    return [];
  }
  const { defaultId, ids } = parseGioMimeApplications(listing);
  if (!ids.length) return [];
  const index = await getDesktopFileIndex(applicationDirectories(env, home));
  const applications = [];
  for (const id of ids.slice(0, MAX_REGISTERED_APPLICATIONS)) {
    const entry = index.get(id);
    if (!entry) continue;
    let stat;
    let contents;
    try {
      stat = await fs.stat(entry.filePath);
      if (!stat.isFile() || stat.size > MAX_DESKTOP_FILE_BYTES) continue;
      // Containment is checked on canonical paths so that applications
      // registered under a symlinked data directory (e.g. macOS `/var`) still
      // resolve; the lexical path is kept for launching.
      const realDirectory = await fs.realpath(entry.applicationsDirectory);
      const realPath = await fs.realpath(entry.filePath);
      if (realPath === realDirectory || !realPath.startsWith(`${realDirectory}${path.sep}`)) continue;
      contents = await fs.readFile(entry.filePath, 'utf8');
    } catch {
      continue;
    }
    const metadata = parseDesktopEntry(contents, locale);
    if (!metadata) continue;
    applications.push({
      id,
      ...metadata,
      isDefault: id === defaultId,
      desktopPath: entry.filePath
    });
  }
  const collator = new Intl.Collator(locale || 'en', { numeric: true, sensitivity: 'base' });
  applications.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)
    || collator.compare(a.displayName, b.displayName)
    || a.id.localeCompare(b.id, 'en'));
  return applications;
}

async function listExternalApplicationsInRoot(rootPath, requestedPath, options = {}) {
  const { path: filePath } = await resolveRegularFileInRoot(rootPath, requestedPath);
  if ((options.platform || process.platform) !== 'linux') return [];
  const applications = await loadRegisteredApplications(filePath, options);
  return applications.map(({ id, displayName, version, isDefault }) => ({ id, displayName, version, isDefault }));
}

function launchWithGio(desktopPath, filePath, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess('gio', ['launch', desktopPath, filePath], {
        detached: true,
        stdio: 'ignore',
        shell: false,
        windowsHide: true
      });
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

async function openFileWithRegisteredApplicationInRoot(rootPath, requestedPath, applicationId, {
  platform = process.platform,
  spawnProcess = spawn,
  ...options
} = {}) {
  if (platform !== 'linux') throw new Error('此平台暂不支持列出已注册的外部应用。');
  if (!isDesktopId(applicationId)) throw new Error('所选应用标识无效。');
  const { path: filePath } = await resolveRegularFileInRoot(rootPath, requestedPath);
  const applications = await loadRegisteredApplications(filePath, { ...options, platform });
  const application = applications.find(candidate => candidate.id === applicationId);
  if (!application) throw new Error('所选应用已不可用，或不再适用于此文件。');
  const realPath = await fs.realpath(application.desktopPath);
  const stat = await fs.stat(realPath);
  if (!stat.isFile()) throw new Error('所选应用桌面条目已更改。');
  return launchWithGio(application.desktopPath, filePath, spawnProcess);
}

module.exports = {
  applicationDirectories,
  contentTypeFromGioInfo,
  isDesktopId,
  launchWithGio,
  listExternalApplicationsInRoot,
  loadRegisteredApplications,
  openFileWithRegisteredApplicationInRoot,
  parseDesktopEntry,
  parseGioMimeApplications
};
