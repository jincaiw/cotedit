'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { constants: fsConstants } = require('node:fs');
const DEFAULT_FILE_DROP_RULES = require('../lib/file-drop-defaults.json');
const { parseImageDimensions } = require('./image-dimensions.cjs');

const MAX_DROPPED_FILES = 32;
const MAX_DROPPED_PATH_BYTES = 4096;
const MAX_DROPPED_INSERT_BYTES = 64 * 1024;
const MAX_FILE_DROP_CONTENT_BYTES = 64 * 1024;
const MAX_FILE_DROP_TOTAL_CONTENT_BYTES = 64 * 1024;
const MAX_FILE_DROP_IMAGE_HEADER_BYTES = 1024 * 1024;
const MAX_FILE_DROP_TOTAL_IMAGE_HEADER_BYTES = 4 * 1024 * 1024;
const MAX_FILE_DROP_RULES = 100;
const MAX_FILE_DROP_FORMAT_BYTES = 8 * 1024;
const MAX_FILE_DROP_TOTAL_BYTES = 64 * 1024;
const MAX_FILE_DROP_EXTENSIONS = 32;
const FILE_DROP_SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,80}$/i;
const FILE_DROP_EXTENSION_PATTERN = /^[a-z0-9][a-z0-9_+-]{0,31}$/i;
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const FORBIDDEN_TEXT_CONTROL = /[\u0000-\u0008\u000e-\u001f\u007f]/u;

function pathApi(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function requireSafeAbsolutePath(value, label, api) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > MAX_DROPPED_PATH_BYTES
      || /[\u0000\r\n]/.test(value) || !api.isAbsolute(value)) {
    throw new TypeError(`${label}不是有效的绝对路径`);
  }
  return api.normalize(value);
}

function sanitizeFileDropRules(value) {
  if (value === undefined || value === null) return DEFAULT_FILE_DROP_RULES;
  if (!Array.isArray(value)) return [];
  const rules = [];
  let totalBytes = 0;
  for (const candidate of value.slice(0, MAX_FILE_DROP_RULES)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const format = typeof candidate.format === 'string' ? candidate.format : typeof candidate.formatString === 'string' ? candidate.formatString : null;
    const rawScope = candidate.scope == null || candidate.scope === '' ? '' : candidate.scope;
    const scope = typeof rawScope === 'string' ? rawScope.trim().toLowerCase() : null;
    if (format === null || !format.length || format.includes('\0') || Buffer.byteLength(format, 'utf8') > MAX_FILE_DROP_FORMAT_BYTES
        || scope === null || (scope && !FILE_DROP_SCOPE_PATTERN.test(scope))) continue;
    if (candidate.extensions != null && !Array.isArray(candidate.extensions) && typeof candidate.extensions !== 'string') continue;
    const sourceExtensions = Array.isArray(candidate.extensions) ? candidate.extensions : typeof candidate.extensions === 'string' ? candidate.extensions.split(',') : [];
    const extensions = [];
    let invalidExtension = false;
    for (const value of sourceExtensions.slice(0, MAX_FILE_DROP_EXTENSIONS * 2)) {
      if (typeof value !== 'string') { invalidExtension = true; break; }
      const extension = value.trim();
      if (!extension) continue;
      if (!FILE_DROP_EXTENSION_PATTERN.test(extension)) { invalidExtension = true; break; }
      if (!extensions.some(item => item.toLowerCase() === extension.toLowerCase())) extensions.push(extension.toLowerCase());
      if (extensions.length >= MAX_FILE_DROP_EXTENSIONS) break;
    }
    if (invalidExtension) continue;
    const normalized = { scope, extensions, format };
    const size = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
    if (totalBytes + size > MAX_FILE_DROP_TOTAL_BYTES) break;
    totalBytes += size;
    rules.push(normalized);
  }
  return rules;
}

function fileDropValues(filePath, documentPath, api) {
  const rawExtension = api.extname(filePath).replace(/^\./, '');
  const extension = rawExtension.toLowerCase();
  const name = api.basename(filePath);
  const nameWithoutExtension = api.parse(name).name;
  let relativePath = filePath;
  if (documentPath) {
    const relative = api.relative(api.dirname(documentPath), filePath);
    if (relative) relativePath = relative;
  }
  const directory = api.basename(api.dirname(filePath));
  return {
    'ABSOLUTE-PATH': filePath,
    'RELATIVE-PATH': relativePath,
    FILENAME: name,
    'FILENAME-NOSUFFIX': nameWithoutExtension,
    FILEEXTENSION: rawExtension,
    'FILEEXTENSION-LOWER': extension,
    'FILEEXTENSION-UPPER': extension.toUpperCase(),
    DIRECTORY: directory
  };
}

function matchingRule(filePath, syntax, api, rules) {
  const extension = api.extname(filePath).replace(/^\./, '').toLowerCase();
  return rules.find(candidate => (!candidate.scope || candidate.scope === syntax)
    && (!candidate.extensions.length || candidate.extensions.includes(extension)));
}

function decodeDroppedUtf8Text(buffer) {
  const data = buffer.subarray(buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM) ? UTF8_BOM.length : 0);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    throw new Error('FILECONTENT 仅支持有效的 UTF-8 文本文件。');
  }
  if (FORBIDDEN_TEXT_CONTROL.test(text)) throw new Error('FILECONTENT 仅支持普通 UTF-8 文本文件，不支持二进制内容。');
  return text;
}

async function readDroppedUtf8Text(filePath, remainingBytes) {
  let handle;
  try {
    const before = await fs.lstat(filePath);
    if (before.isSymbolicLink() || !before.isFile()) {
      throw new Error('FILECONTENT 仅支持普通 UTF-8 文本文件，不支持目录或符号链接。');
    }
    if (before.size > MAX_FILE_DROP_CONTENT_BYTES || before.size > remainingBytes) {
      throw new RangeError('FILECONTENT 每个文件及每次拖放的正文总量最多为 64 KiB；未插入任何内容。');
    }

    const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0);
    handle = await fs.open(filePath, flags);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error('拖入文件在打开期间已更改或不是普通文件；未插入任何内容。');
    }
    if (opened.size > MAX_FILE_DROP_CONTENT_BYTES || opened.size > remainingBytes) {
      throw new RangeError('FILECONTENT 每个文件及每次拖放的正文总量最多为 64 KiB；未插入任何内容。');
    }

    const buffer = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, Math.min(16 * 1024, buffer.length - offset), offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (offset !== buffer.length || after.size !== opened.size) {
      throw new Error('拖入文件在读取期间已更改；未插入任何内容。');
    }
    return { text: decodeDroppedUtf8Text(buffer), bytesRead: offset };
  } catch (error) {
    if (error instanceof RangeError || !error?.code) throw error;
    if (error.code === 'ELOOP') throw new Error('FILECONTENT 不支持符号链接；未插入任何内容。');
    if (['ENOENT', 'EACCES', 'EPERM', 'EBUSY', 'EMFILE'].includes(error.code)) {
      throw new Error('无法安全读取拖入文件正文；文件可能已移动或当前不可访问。');
    }
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function readDroppedImageDimensions(filePath, remainingBytes) {
  let handle;
  try {
    const before = await fs.lstat(filePath);
    if (before.isSymbolicLink() || !before.isFile()) {
      throw new Error('图片尺寸变量仅支持普通图像文件，不支持目录或符号链接。');
    }
    const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0);
    handle = await fs.open(filePath, flags);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error('拖入图像在打开期间已更改或不是普通文件；未插入任何内容。');
    }
    const readLength = Math.min(opened.size, MAX_FILE_DROP_IMAGE_HEADER_BYTES);
    if (readLength > remainingBytes) throw new RangeError('一次拖放读取的图像文件头总量最多为 4 MiB；未插入任何内容。');
    const buffer = Buffer.alloc(readLength);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, Math.min(16 * 1024, buffer.length - offset), offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (offset !== buffer.length || after.size !== opened.size) {
      throw new Error('拖入图像在读取期间已更改；未插入任何内容。');
    }
    const dimensions = parseImageDimensions(buffer);
    if (!dimensions) throw new Error('无法从有限文件头识别 PNG、GIF、JPEG、BMP、WebP 或经典 TIFF 尺寸；未插入任何内容。');
    return { ...dimensions, bytesRead: offset };
  } catch (error) {
    if (error instanceof RangeError || !error?.code) throw error;
    if (error.code === 'ELOOP') throw new Error('图片尺寸变量不支持符号链接；未插入任何内容。');
    if (['ENOENT', 'EACCES', 'EPERM', 'EBUSY', 'EMFILE'].includes(error.code)) {
      throw new Error('无法安全读取拖入图像文件头；文件可能已移动或当前不可访问。');
    }
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

/**
 * Format explicitly dropped file paths using CotEditor's File Drop rules.
 * File content and image metadata are read only when the first matching rule
 * requests them, through bounded regular-file handles and safe decoders.
 */
async function formatDroppedFilePaths(paths, documentPath = null, syntaxId = '', platform = process.platform, customRules) {
  if (!Array.isArray(paths) || paths.length === 0) throw new TypeError('没有可插入的文件路径');
  if (paths.length > MAX_DROPPED_FILES) throw new RangeError(`一次最多拖放 ${MAX_DROPPED_FILES} 个文件`);
  if (!['win32', 'darwin', 'linux', 'freebsd', 'openbsd', 'sunos', 'aix'].includes(platform)) {
    throw new TypeError('当前平台的文件路径格式不可用');
  }

  const api = pathApi(platform);
  const normalizedPaths = paths.map((value, index) => requireSafeAbsolutePath(value, `第 ${index + 1} 个文件路径`, api));
  let normalizedDocumentPath = null;
  if (typeof documentPath === 'string' && documentPath.length > 0) {
    try { normalizedDocumentPath = requireSafeAbsolutePath(documentPath, '当前文稿路径', api); }
    catch { normalizedDocumentPath = null; }
  }

  const syntax = typeof syntaxId === 'string' && syntaxId.length <= 80 ? syntaxId.trim().toLowerCase() : '';
  const rules = sanitizeFileDropRules(customRules);
  const output = [];
  let totalContentBytes = 0;
  let totalImageHeaderBytes = 0;
  for (const filePath of normalizedPaths) {
    const values = fileDropValues(filePath, normalizedDocumentPath, api);
    const rule = matchingRule(filePath, syntax, api, rules);
    const format = rule?.format || '<<<ABSOLUTE-PATH>>>';
    if (format.includes('<<<FILECONTENT>>>')) {
      const { text, bytesRead } = await readDroppedUtf8Text(filePath, MAX_FILE_DROP_TOTAL_CONTENT_BYTES - totalContentBytes);
      totalContentBytes += bytesRead;
      values.FILECONTENT = text;
    }
    if (format.includes('<<<IMAGEWIDTH>>>') || format.includes('<<<IMAGEHEIGHT>>>')) {
      const dimensions = await readDroppedImageDimensions(filePath, MAX_FILE_DROP_TOTAL_IMAGE_HEADER_BYTES - totalImageHeaderBytes);
      totalImageHeaderBytes += dimensions.bytesRead;
      values.IMAGEWIDTH = String(dimensions.width);
      values.IMAGEHEIGHT = String(dimensions.height);
    }
    output.push(format.replace(/<<<([A-Z-]+)>>>/g, (token, key) => Object.hasOwn(values, key) ? values[key] : token));
  }

  const text = output.join('\n');
  if (Buffer.byteLength(text, 'utf8') > MAX_DROPPED_INSERT_BYTES) throw new RangeError('拖放结果超过 64 KiB，已取消插入');
  return { text, fileCount: normalizedPaths.length };
}

module.exports = {
  MAX_DROPPED_FILES,
  MAX_DROPPED_PATH_BYTES,
  MAX_DROPPED_INSERT_BYTES,
  MAX_FILE_DROP_CONTENT_BYTES,
  MAX_FILE_DROP_TOTAL_CONTENT_BYTES,
  MAX_FILE_DROP_IMAGE_HEADER_BYTES,
  MAX_FILE_DROP_TOTAL_IMAGE_HEADER_BYTES,
  DEFAULT_FILE_DROP_RULES,
  sanitizeFileDropRules,
  formatDroppedFilePaths
};
