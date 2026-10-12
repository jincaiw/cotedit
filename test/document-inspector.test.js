import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { formatDocumentFileOwnerIds, formatDocumentFileSize, formatDocumentFileTimestamp, getDocumentInspectorCharacter, getDocumentInspectorStats, normalizeDocumentFileOwnerIds } from '../lib/document-inspector.js';

const require = createRequire(import.meta.url);
const { documentFileOwnerIds, documentFilePermissions, documentFileTimestamps } = require('../electron/document-file-metadata.cjs');
const electronMain = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('document inspector counts text, cursor position and selected grapheme clusters', () => {
  const result = getDocumentInspectorStats({
    text: 'one two\nHi 👨‍👩‍👧‍👦',
    lineCount: 2,
    lineNumber: 2,
    linePrefix: 'Hi 👨‍👩‍👧‍👦',
    selectionText: 'é😀'
  });

  assert.deepEqual(result, {
    words: 3,
    characters: 12,
    lineCount: 2,
    cursorLine: 2,
    cursorColumn: 5,
    selectionCharacters: 2
  });
});

test('document inspector distinguishes an empty selection from no selection', () => {
  const withoutSelection = getDocumentInspectorStats({ text: '' });
  const emptySelection = getDocumentInspectorStats({ text: '', selectionText: '' });

  assert.deepEqual(withoutSelection, {
    words: 0,
    characters: 0,
    lineCount: 1,
    cursorLine: 1,
    cursorColumn: 1,
    selectionCharacters: null
  });
  assert.equal(emptySelection.selectionCharacters, 0);
});

test('document inspector falls back to safe one-based locations when inputs are invalid', () => {
  const result = getDocumentInspectorStats({
    text: 'x',
    lineCount: 0,
    lineNumber: Number.NaN,
    linePrefix: 'x'
  });

  assert.equal(result.lineCount, 1);
  assert.equal(result.cursorLine, 1);
  assert.equal(result.cursorColumn, 2);
});

test('document inspector exposes only one complete selected grapheme for Character details', () => {
  const text = 'A é 👨‍👩‍👧‍👦 Z';
  const accentFrom = text.indexOf('é');
  const familyFrom = text.indexOf('👨‍👩‍👧‍👦');

  assert.equal(getDocumentInspectorCharacter(text, { from: 0, to: 1 }), 'A');
  assert.equal(getDocumentInspectorCharacter(text, { from: accentFrom, to: accentFrom + 2 }), 'é');
  assert.equal(getDocumentInspectorCharacter(text, { from: familyFrom, to: familyFrom + '👨‍👩‍👧‍👦'.length }), '👨‍👩‍👧‍👦');
  assert.equal(getDocumentInspectorCharacter(text, { from: accentFrom, to: accentFrom + 1 }), null,
    'a partial selection of a combining grapheme is not presented as a complete character');
  assert.equal(getDocumentInspectorCharacter(text, { from: 0, to: 2 }), null,
    'a selection containing two graphemes has no single-character details');
  assert.equal(getDocumentInspectorCharacter(text, null), null);
});

test('document inspector formats exact local-file byte sizes and rejects invalid values', () => {
  assert.equal(formatDocumentFileSize(0), '0 字节');
  assert.equal(formatDocumentFileSize(999), '999 字节');
  assert.equal(formatDocumentFileSize(1234), '1.2 kB（1,234 字节）');
  assert.equal(formatDocumentFileSize(1_234_567), '1.2 MB（1,234,567 字节）');
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(formatDocumentFileSize(value), null);
  }
});

test('document file metadata returns safe creation and modification timestamps from an existing stat result', () => {
  assert.deepEqual(documentFileTimestamps({ birthtimeMs: 1_800_000_000_123.9, mtimeMs: 1_800_000_100_456.7 }), {
    fileCreatedAtMs: 1_800_000_000_123,
    fileModifiedAtMs: 1_800_000_100_456
  });
  assert.deepEqual(documentFileTimestamps(null), { fileCreatedAtMs: null, fileModifiedAtMs: null });
  assert.deepEqual(documentFileTimestamps({ birthtimeMs: 0, mtimeMs: Number.POSITIVE_INFINITY }), {
    fileCreatedAtMs: null, fileModifiedAtMs: null
  });
  assert.deepEqual(documentFileTimestamps({ birthtimeMs: '1800000000000', mtimeMs: -1 }), {
    fileCreatedAtMs: null, fileModifiedAtMs: null
  });
});

test('document file metadata formats POSIX permission bits without changing or overstating them', () => {
  assert.equal(documentFilePermissions({ mode: 0o100644 }, 'linux'), '644 (-rw-r--r--)');
  assert.equal(documentFilePermissions({ mode: 0o100755 }, 'darwin'), '755 (-rwxr-xr-x)');
  assert.equal(documentFilePermissions({ mode: 0o104755 }, 'linux'), '4755 (-rwsr-xr-x)');
  assert.equal(documentFilePermissions({ mode: 0o102644 }, 'linux'), '2644 (-rw-r-Sr--)');
  assert.equal(documentFilePermissions({ mode: 0o101777 }, 'linux'), '1777 (-rwxrwxrwt)');
  assert.equal(documentFilePermissions({ mode: 0o100644 }, 'win32'), null,
    'Windows mode bits are not presented as if they represented POSIX permissions or ACLs');
  for (const mode of [undefined, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
    assert.equal(documentFilePermissions({ mode }, 'linux'), null);
  }
  assert.equal(documentFilePermissions(null, 'linux'), null);
});

test('document file metadata returns only valid numeric POSIX owner and group IDs', () => {
  assert.deepEqual(documentFileOwnerIds({ uid: 0, gid: 0 }, 'linux'), { uid: 0, gid: 0 });
  assert.deepEqual(documentFileOwnerIds({ uid: 501, gid: 20 }, 'darwin'), { uid: 501, gid: 20 });
  assert.equal(documentFileOwnerIds({ uid: 501, gid: 20 }, 'win32'), null,
    'Windows stat identity fields are not treated as POSIX ownership');
  for (const stat of [null, {}, { uid: -1, gid: 0 }, { uid: 0, gid: -1 }, { uid: 1.5, gid: 0 }, { uid: Number.MAX_SAFE_INTEGER + 1, gid: 0 }]) {
    assert.equal(documentFileOwnerIds(stat, 'linux'), null);
  }
});

test('document inspector validates and formats numeric owner/group IDs without inventing account names', () => {
  assert.deepEqual(normalizeDocumentFileOwnerIds({ uid: 501, gid: 20, ignored: 'account' }), { uid: 501, gid: 20 });
  assert.equal(formatDocumentFileOwnerIds({ uid: 501, gid: 20 }), 'UID 501 · GID 20');
  for (const value of [null, [], { uid: -1, gid: 0 }, { uid: 0, gid: 1.2 }, { uid: 0, gid: Number.NaN }]) {
    assert.equal(normalizeDocumentFileOwnerIds(value), null);
    assert.equal(formatDocumentFileOwnerIds(value), null);
  }
});

test('document inspector formats valid local timestamps and hides invalid values', () => {
  const timestamp = Date.UTC(2026, 9, 12, 3, 49);
  const expected = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  assert.equal(formatDocumentFileTimestamp(timestamp), expected);
  for (const value of [null, '1800000000000', 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 8_640_000_000_000_001]) {
    assert.equal(formatDocumentFileTimestamp(value), null);
  }
});

test('local file metadata is wired through existing open/save stats into the inspector without new file APIs', () => {
  assert.match(electronMain, /fileSizeBytes: buffer\.length,[\s\S]*?\.\.\.documentFileTimestamps\(stat\)/,
    'the existing readDocument stat result supplies the creation and modification dates');
  assert.match(electronMain, /\.\.\.documentFileTimestamps\(stat\),\s*filePermissions: documentFilePermissions\(stat\)/,
    'the existing readDocument stat result supplies POSIX permissions');
  assert.match(electronMain, /\.\.\.documentFileTimestamps\(stat\),\s*filePermissions: documentFilePermissions\(stat\),\s*fileOwnerIds: documentFileOwnerIds\(stat\)/,
    'the existing readDocument stat result supplies numeric owner/group IDs');
  assert.match(electronMain, /atomicWrite\(filePath,[\s\S]*?const stat = await fs\.stat\(filePath\);[\s\S]*?filePermissions: documentFilePermissions\(stat\), fileOwnerIds: documentFileOwnerIds\(stat\)/,
    'post-save metadata reuses the existing best-effort stat after the atomic write');
  assert.match(renderer, /fileCreatedAtMs = .*metadata\.fileCreatedAtMs/);
  assert.match(renderer, /fileModifiedAtMs = .*metadata\.fileModifiedAtMs/);
  assert.match(renderer, /doc\.filePermissions = typeof metadata\.filePermissions/);
  assert.match(renderer, /activeDoc\.filePermissions = typeof result\.filePermissions/);
  assert.match(renderer, /doc\.fileOwnerIds = normalizeDocumentFileOwnerIds\(metadata\.fileOwnerIds\)/);
  assert.match(renderer, /activeDoc\.fileOwnerIds = normalizeDocumentFileOwnerIds\(result\.fileOwnerIds\)/);
  assert.match(renderer, /fileCreated: formatDocumentFileTimestamp\(activeDoc\.fileCreatedAtMs\)/);
  assert.match(renderer, /fileModified: formatDocumentFileTimestamp\(activeDoc\.fileModifiedAtMs\)/);
  assert.match(renderer, /filePermissions: activeDoc\.filePermissions \|\|/);
  assert.match(renderer, /fileOwner: formatDocumentFileOwnerIds\(activeDoc\.fileOwnerIds\)/);
  for (const id of ['document-inspector-fileCreated', 'document-inspector-fileModified', 'document-inspector-filePermissions', 'document-inspector-fileOwner']) {
    assert.ok(html.includes(`id="${id}"`), `inspector is missing ${id}`);
  }
  assert.match(html, /仅表示传统权限位，不代表 ACL/);
});

test('document inspector reveals only local desktop files through the existing Finder/file-manager action', () => {
  assert.match(html, /<dd class="document-inspector-path-row"><span id="document-inspector-path" class="document-inspector-path-value">[\s\S]*?<button id="document-inspector-reveal"[^>]*aria-label="在文件管理器中显示当前文稿"[^>]*hidden>/);
  assert.match(renderer, /revealButton\.hidden = !\(window\.cotedit\?\.isDesktop === true && Boolean\(activeDoc\.path\) && !activeDoc\.remoteSessionId\)/,
    'new, remote, and non-desktop documents must not expose a local reveal action');
  assert.match(renderer, /document-inspector-reveal'\)\.addEventListener\('click', \(\) => \{ void revealActiveFile\(\); \}\)/);
  assert.match(renderer, /async function revealActiveFile\(\)[\s\S]*?window\.cotedit\.revealFile\(activeDoc\.path\)/);
  assert.match(preload, /revealFile: \(filePath\) => ipcRenderer\.invoke\('document:reveal', filePath\)/);
  assert.match(electronMain, /ipcMain\.handle\('document:reveal'[\s\S]*?await fs\.access\(resolved\);[\s\S]*?shell\.showItemInFolder\(resolved\)/,
    'the action must reuse the existing access check and native item-reveal API');
});


function binaryPlistArray(strings) {
  const encodeInteger = (value, width) => {
    const result = Buffer.alloc(width);
    for (let index = width - 1; index >= 0; index--) {
      result[index] = value & 0xff;
      value = Math.floor(value / 256);
    }
    return result;
  };
  const integerWidth = value => value <= 0xff ? 1 : value <= 0xffff ? 2 : value <= 0xffffffff ? 4 : 8;
  const encodeLength = (type, length) => {
    if (length < 15) return Buffer.from([(type << 4) | length]);
    const width = integerWidth(length);
    const exponent = Math.log2(width);
    return Buffer.concat([Buffer.from([(type << 4) | 0x0f, 0x10 | exponent]), encodeInteger(length, width)]);
  };
  const encodeString = value => {
    if (/^[\x00-\x7f]*$/.test(value)) {
      const bytes = Buffer.from(value, 'ascii');
      return Buffer.concat([encodeLength(0x05, bytes.length), bytes]);
    }
    const littleEndian = Buffer.from(value, 'utf16le');
    const bigEndian = Buffer.allocUnsafe(littleEndian.length);
    for (let index = 0; index < littleEndian.length; index += 2) {
      bigEndian[index] = littleEndian[index + 1];
      bigEndian[index + 1] = littleEndian[index];
    }
    return Buffer.concat([encodeLength(0x06, value.length), bigEndian]);
  };
  const referenceSize = integerWidth(strings.length);
  const arrayObject = Buffer.concat([
    encodeLength(0x0a, strings.length),
    ...strings.map((_, index) => encodeInteger(index + 1, referenceSize))
  ]);
  const objects = [arrayObject, ...strings.map(encodeString)];
  const offsets = [];
  let objectOffset = 8;
  for (const object of objects) {
    offsets.push(objectOffset);
    objectOffset += object.length;
  }
  const offsetTableOffset = objectOffset;
  const offsetSize = integerWidth(offsetTableOffset);
  const offsetTable = Buffer.concat(offsets.map(offset => encodeInteger(offset, offsetSize)));
  const trailer = Buffer.alloc(32);
  trailer[6] = offsetSize;
  trailer[7] = referenceSize;
  encodeInteger(objects.length, 8).copy(trailer, 8);
  encodeInteger(0, 8).copy(trailer, 16);
  encodeInteger(offsetTableOffset, 8).copy(trailer, 24);
  return Buffer.concat([Buffer.from('bplist00', 'ascii'), ...objects, offsetTable, trailer]);
}

test('Finder tag parser reads CotEditor binary plist names and maps all documented color IDs', () => {
  const { parseFinderTags } = require('../electron/finder-tags.cjs');
  assert.deepEqual(parseFinderTags(binaryPlistArray([
    'gray\n1', 'green\n2', 'purple\n3', 'blue\n4', 'yellow\n5', 'red\n6', 'orange\n7', '无颜色\n0', '普通标签'
  ])), [
    { name: 'gray', color: 'gray' }, { name: 'green', color: 'green' },
    { name: 'purple', color: 'purple' }, { name: 'blue', color: 'blue' },
    { name: 'yellow', color: 'yellow' }, { name: 'red', color: 'red' },
    { name: 'orange', color: 'orange' }, { name: '无颜色', color: 'none' },
    { name: '普通标签', color: 'none' }
  ]);
});

test('Finder tag plist parsing rejects malformed, oversized, non-string and over-count data', () => {
  const { MAX_ATTRIBUTE_BYTES, parseFinderTags } = require('../electron/finder-tags.cjs');
  assert.deepEqual(parseFinderTags(Buffer.from('not a plist')), []);
  assert.deepEqual(parseFinderTags(Buffer.alloc(MAX_ATTRIBUTE_BYTES + 1)), []);
  assert.deepEqual(parseFinderTags(binaryPlistArray(Array.from({ length: 33 }, (_, index) => `tag ${index}`))), []);
  assert.deepEqual(parseFinderTags(binaryPlistArray(['', '\n6', 'too large\n8'])), [
    { name: '6', color: 'none' }, { name: 'too large', color: 'none' }
  ]);
  const nonStringItem = binaryPlistArray(['not a string after mutation']);
  nonStringItem[10] = 0x00;
  assert.deepEqual(parseFinderTags(nonStringItem), [], 'non-string plist array members are rejected');
  const corrupted = binaryPlistArray(['valid\n6']);
  corrupted[0] = 0;
  assert.deepEqual(parseFinderTags(corrupted), []);
});

test('Finder tag reader is macOS-only, bounds xattr execution and never invokes a shell', async () => {
  const { readFinderTags } = require('../electron/finder-tags.cjs');
  const fixture = binaryPlistArray(['Research\n6', '项目\n4']);
  let invocation;
  const tags = await readFinderTags('/Users/example/notes.txt', {
    platform: 'darwin',
    execFileImpl: (executable, args, options, callback) => {
      invocation = { executable, args, options };
      callback(null, fixture);
    }
  });
  assert.deepEqual(tags, [{ name: 'Research', color: 'red' }, { name: '项目', color: 'blue' }]);
  assert.equal(invocation.executable, '/usr/bin/xattr');
  assert.deepEqual(invocation.args, ['-p', 'com.apple.metadata:_kMDItemUserTags', '/Users/example/notes.txt']);
  assert.equal(invocation.options.encoding, null);
  assert.equal(invocation.options.timeout, 1000);
  assert.equal(invocation.options.maxBuffer, 64 * 1024);
  assert.equal(Object.hasOwn(invocation.options, 'shell'), false,
    'execFile uses its no-shell default and passes the path as a separate argument');
  assert.equal(await readFinderTags('/tmp/notes.txt', { platform: 'linux' }), null);
  assert.deepEqual(await readFinderTags('relative.txt', { platform: 'darwin' }), []);
  assert.deepEqual(await readFinderTags('/Users/example/notes.txt', {
    platform: 'darwin', execFileImpl: (_executable, _args, _options, callback) => callback(new Error('missing xattr'))
  }), []);
});

test('Finder tags are normalized and routed through existing open/save results into the inspector', async () => {
  const { normalizeDocumentFileTags } = await import('../lib/document-inspector.js');
  const tags = normalizeDocumentFileTags([
    { name: '<img src=x onerror=alert(1)>', color: 'red', ignored: true },
    { name: 'unknown color', color: 'not-a-finder-color' },
    { name: '', color: 'blue' },
    { name: 'x'.repeat(257), color: 'blue' }
  ]);
  assert.deepEqual(tags, [
    { name: '<img src=x onerror=alert(1)>', color: 'red' },
    { name: 'unknown color', color: 'none' }
  ]);
  assert.equal(normalizeDocumentFileTags(null), null,
    'null indicates the Finder-only field is unavailable on this platform');
  assert.match(electronMain, /const fileTags = await readFinderTags\(filePath\)/);
  assert.match(renderer, /doc\.fileTags = normalizeDocumentFileTags\(metadata\.fileTags\)/);
  assert.match(renderer, /activeDoc\.fileTags = normalizeDocumentFileTags\(result\.fileTags\)/);
  assert.match(renderer, /name\.textContent = tag\.name/,
    'Finder tag text is inserted as text, not interpreted as markup');
  assert.match(html, /<dt>Finder 标签<\/dt><dd id="document-inspector-fileTags"/);
});
