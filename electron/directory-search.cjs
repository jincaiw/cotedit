const fs = require('node:fs/promises');
const { constants: fsConstants } = require('node:fs');
const path = require('node:path');
const { isWithin, resolveWithinRoot } = require('./root-path.cjs');
const { decodeBuffer, normalizeLineEndings } = require('./codec.cjs');
const { parseImageDimensions, parseImageDpi, parseImageColorAttributes, isWaveContainer, parseWavePcmDuration, isAiffContainer, parseAiffPcmDuration } = require('./image-dimensions.cjs');
const { isIsoBmffContainer, parseIsoBmffMovieAttributes } = require('./iso-bmff.cjs');

const MAX_SEARCH_FILE_BYTES = 1024 * 1024;
const MAX_SEARCH_FILES = 2500;
const MAX_SEARCH_RESULTS = 500;
const MAX_PREVIEW_BYTES = 512 * 1024;
const MAX_EXECUTABLE_SIGNATURE_BYTES = 4;
const MAX_FILE_TYPE_SIGNATURE_BYTES = 24;
const BINARY_PROPERTY_LIST_SIGNATURE = Buffer.from('bplist', 'ascii');
const UNIX_EXECUTABLE_SIGNATURES = new Set([
  '7f454c46', // ELF
  'feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', // Mach-O
  'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca' // FAT Mach-O
]);
const IGNORED_DIRS = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'release', 'target', '.next', '.venv', 'venv']);

async function resolveRegularFileInRoot(rootPath, requestedPath) {
  const resolved = await resolveWithinRoot(rootPath, requestedPath, {
    invalid: '文件路径无效。',
    outOfRange: '文件路径超出已选文件夹范围。',
    escaped: '文件路径通过符号链接离开了已选文件夹。'
  });
  const stat = await fs.stat(resolved.path);
  if (!stat.isFile()) throw new Error('所选路径不是文件。');
  return { root: resolved.root, path: resolved.path, stat };
}

function isUnixExecutableFile(stat, platform = process.platform) {
  return platform !== 'win32' && Number.isInteger(stat?.mode) && (stat.mode & 0o111) !== 0;
}

function isUnixExecutableSignature(header, platform = process.platform) {
  return platform !== 'win32'
    && Buffer.isBuffer(header)
    && header.length >= MAX_EXECUTABLE_SIGNATURE_BYTES
    && UNIX_EXECUTABLE_SIGNATURES.has(header.subarray(0, MAX_EXECUTABLE_SIGNATURE_BYTES).toString('hex'));
}

function isBinaryPropertyListSignature(header) {
  return Buffer.isBuffer(header)
    && header.length >= BINARY_PROPERTY_LIST_SIGNATURE.length
    && header.subarray(0, BINARY_PROPERTY_LIST_SIGNATURE.length).equals(BINARY_PROPERTY_LIST_SIGNATURE);
}

async function resolveEditableFileInRoot(rootPath, requestedPath, { platform = process.platform } = {}) {
  const resolved = await resolveRegularFileInRoot(rootPath, requestedPath);
  if (isUnixExecutableFile(resolved.stat, platform)) throw new Error('UNIX 可执行文件不能作为纯文本打开。');
  const opened = await openRegularFileInRoot(rootPath, requestedPath);
  try {
    const signature = await readFileSignature(opened.handle);
    if (isUnixExecutableFile(opened.stat, platform) || isUnixExecutableSignature(signature, platform)) {
      throw new Error('UNIX 可执行文件不能作为纯文本打开。');
    }
    if (isBinaryPropertyListSignature(signature)) {
      throw new Error('二进制 Property List 默认不会作为纯文本打开；如需查看原始内容，请显式选择“以纯文本打开”。');
    }
    if (isIsoBmffContainer(signature, opened.stat.size)) {
      throw new Error('ISO BMFF 媒体容器默认不会作为纯文本打开；如需查看原始内容，请显式选择“以纯文本打开”。');
    }
    return { root: opened.root, path: opened.path, stat: opened.stat };
  } finally {
    await opened.handle.close();
  }
}

async function openRegularFileInRoot(rootPath, requestedPath) {
  const resolved = await resolveRegularFileInRoot(rootPath, requestedPath);
  // Open the canonical path so that O_NOFOLLOW is never defeated by an
  // in-root symlink; containment was already validated against both.
  const canonicalRoot = await fs.realpath(resolved.root);
  const canonicalPath = await fs.realpath(resolved.path);
  if (!isWithin(canonicalRoot, canonicalPath)) throw new Error('所选路径不是根目录内的普通文件。');
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0);
  const handle = await fs.open(canonicalPath, flags);
  try {
    const stat = await handle.stat();
    const currentPath = await fs.realpath(canonicalPath);
    if (!stat.isFile() || !isWithin(canonicalRoot, currentPath)) throw new Error('所选路径不是根目录内的普通文件。');
    const currentStat = await fs.stat(currentPath);
    if (stat.ino && currentStat.ino && (stat.dev !== currentStat.dev || stat.ino !== currentStat.ino)) {
      throw new Error('文件路径在读取前已更改，请重新尝试。');
    }
    return { root: resolved.root, path: resolved.path, stat, handle };
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

async function readHandleUpTo(handle, byteLimit) {
  const limit = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER - 1, Math.trunc(Number(byteLimit) || 0)));
  const buffer = Buffer.alloc(limit + 1);
  let bytesRead = 0;
  while (bytesRead < buffer.length) {
    const result = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
    if (!result.bytesRead) break;
    bytesRead += result.bytesRead;
  }
  return buffer.subarray(0, bytesRead);
}

async function readFileSignature(handle) {
  const buffer = Buffer.alloc(MAX_FILE_TYPE_SIGNATURE_BYTES);
  let bytesRead = 0;
  while (bytesRead < buffer.length) {
    const result = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
    if (!result.bytesRead) break;
    bytesRead += result.bytesRead;
  }
  return buffer.subarray(0, bytesRead);
}

function executablePreview(filePath, stat) {
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stat.size,
    encoding: null,
    text: '',
    truncated: false,
    executable: true
  };
}

function binaryPropertyListPreview(filePath, stat) {
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stat.size,
    encoding: null,
    text: '',
    truncated: false,
    executable: false,
    binaryPropertyList: true
  };
}

async function previewFileInRoot(rootPath, requestedPath, maxBytes = MAX_PREVIEW_BYTES) {
  const initial = await resolveRegularFileInRoot(rootPath, requestedPath);
  if (isUnixExecutableFile(initial.stat)) return executablePreview(initial.path, initial.stat);
  const { path: filePath, stat, handle } = await openRegularFileInRoot(rootPath, requestedPath);
  const limit = Math.max(1, Math.min(MAX_PREVIEW_BYTES, Number(maxBytes) || MAX_PREVIEW_BYTES));
  let buffer;
  try {
    if (isUnixExecutableFile(stat)) return executablePreview(filePath, stat);
    buffer = await readHandleUpTo(handle, limit);
    if (isUnixExecutableSignature(buffer)) return executablePreview(filePath, stat);
    if (isBinaryPropertyListSignature(buffer)) return binaryPropertyListPreview(filePath, stat);
  } finally {
    await handle.close();
  }
  const visibleBuffer = buffer.subarray(0, limit);
  const imageDimensions = parseImageDimensions(visibleBuffer);
  if (imageDimensions) {
    const imageDpi = parseImageDpi(visibleBuffer);
    const imageColorAttributes = parseImageColorAttributes(visibleBuffer);
    const imageColorSpace = imageColorAttributes?.profile ?? imageColorAttributes?.model ?? null;
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      encoding: null,
      text: '',
      truncated: false,
      executable: false,
      binaryPropertyList: false,
      image: true,
      imageDimensions,
      imageDpi,
      imageColorSpace,
      imageColorModel: imageColorAttributes?.model ?? null,
      imageColorProfile: imageColorAttributes?.profile ?? null
    };
  }
  const waveAudio = isWaveContainer(visibleBuffer);
  const aiffAudio = isAiffContainer(visibleBuffer);
  if (waveAudio || aiffAudio) {
    const audioKind = waveAudio ? 'WAVE' : visibleBuffer.toString('ascii', 8, 12) === 'AIFC' ? 'AIFF-C' : 'AIFF';
    const audioDurationSeconds = waveAudio
      ? parseWavePcmDuration(visibleBuffer, stat.size)
      : parseAiffPcmDuration(visibleBuffer, stat.size);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      encoding: null,
      text: '',
      truncated: false,
      executable: false,
      binaryPropertyList: false,
      audio: true,
      audioKind,
      audioDurationSeconds
    };
  }
  if (isIsoBmffContainer(visibleBuffer, stat.size)) {
    const movie = parseIsoBmffMovieAttributes(visibleBuffer, stat.size);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      encoding: null,
      text: '',
      truncated: false,
      executable: false,
      binaryPropertyList: false,
      isoBmff: true,
      movie: movie !== null,
      movieDimensions: movie?.dimensions ?? null,
      movieDurationSeconds: movie?.durationSeconds ?? null
    };
  }
  const decoded = decodeBuffer(visibleBuffer);
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stat.size,
    encoding: decoded.encoding,
    text: normalizeLineEndings(decoded.text).replace(/^\uFEFF/, ''),
    truncated: stat.size > visibleBuffer.length || buffer.length > limit,
    executable: false,
    binaryPropertyList: false
  };
}

async function searchDirectory(rootPath, options = {}) {
  const root = path.resolve(rootPath);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('所选路径不是文件夹。');
  const query = options.query;
  if (typeof query !== 'string' || query.length > 1000) throw new Error('查找内容过长或格式无效。');
  if (!query) return { root, results: [], scanned: 0, truncated: false };

  const usesRegularExpression = Boolean(options.regexp);
  const canonicalEquivalence = !usesRegularExpression;
  let regex;
  let findMatchingLineIndices;
  try {
    const { translateIcuRegex: translate, findMatchingLineIndices: findLines } = await import('../lib/icu-regexp.js');
    const pattern = usesRegularExpression
      ? translate(query)
      : query.normalize('NFD').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(pattern, options.caseSensitive === true ? 'gmu' : 'gimu');
    findMatchingLineIndices = findLines;
  } catch {
    throw new Error('正则表达式无效。');
  }
  return scanDirectory(root, regex, findMatchingLineIndices, canonicalEquivalence);
}

async function scanDirectory(root, regex, findMatchingLineIndices, canonicalEquivalence = false) {
  const results = [];
  let scanned = 0;
  let truncated = false;
  const queue = [root];
  while (queue.length && scanned < MAX_SEARCH_FILES && results.length < MAX_SEARCH_RESULTS) {
    const current = queue.pop();
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (results.length >= MAX_SEARCH_RESULTS || scanned >= MAX_SEARCH_FILES) { truncated = true; break; }
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !IGNORED_DIRS.has(entry.name.toLowerCase())) queue.push(target);
        continue;
      }
      if (!entry.isFile()) continue;
      let handle;
      try {
        const opened = await openRegularFileInRoot(root, target);
        handle = opened.handle;
        const stat = opened.stat;
        if (stat.size > MAX_SEARCH_FILE_BYTES || stat.size === 0) continue;
        scanned++;
        const fileBuffer = await readHandleUpTo(handle, MAX_SEARCH_FILE_BYTES);
        if (fileBuffer.length > MAX_SEARCH_FILE_BYTES) continue;
        const decoded = decodeBuffer(fileBuffer);
        const text = normalizeLineEndings(decoded.text);
        const lines = text.split('\n');
        const searchableText = canonicalEquivalence ? text.normalize('NFD') : text;
        for (const lineIndex of findMatchingLineIndices(searchableText, regex)) {
          results.push({
            path: target,
            relativePath: path.relative(root, target),
            line: lineIndex + 1,
            preview: lines[lineIndex].trim().slice(0, 280)
          });
          if (results.length >= MAX_SEARCH_RESULTS) { truncated = true; break; }
        }
      } catch { /* Skip binary, unreadable, or malformed candidates. */ }
      finally { await handle?.close().catch(() => {}); }
    }
  }
  if (queue.length || scanned >= MAX_SEARCH_FILES) truncated = true;
  return { root, results, scanned, truncated };
}

module.exports = {
  MAX_PREVIEW_BYTES,
  MAX_SEARCH_FILE_BYTES,
  MAX_SEARCH_FILES,
  MAX_SEARCH_RESULTS,
  readHandleUpTo,
  isUnixExecutableFile,
  isUnixExecutableSignature,
  isBinaryPropertyListSignature,
  previewFileInRoot,
  resolveEditableFileInRoot,
  resolveRegularFileInRoot,
  searchDirectory
};
