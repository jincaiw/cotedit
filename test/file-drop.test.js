import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  formatDroppedFilePaths,
  MAX_DROPPED_FILES,
  MAX_DROPPED_INSERT_BYTES,
  MAX_FILE_DROP_CONTENT_BYTES,
  MAX_FILE_DROP_IMAGE_HEADER_BYTES,
  MAX_FILE_DROP_TOTAL_IMAGE_HEADER_BYTES
} = require('../electron/file-drop.cjs');

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cotedit-file-drop-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function pngHeader(width, height) {
  const header = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

function gifHeader(width, height) {
  const header = Buffer.alloc(10);
  header.write('GIF89a', 0, 'ascii');
  header.writeUInt16LE(width, 6);
  header.writeUInt16LE(height, 8);
  return header;
}

function jpegHeader(width, height) {
  const header = Buffer.alloc(21);
  Buffer.from([0xff, 0xd8, 0xff, 0xc0]).copy(header);
  header.writeUInt16BE(17, 4);
  header[6] = 8;
  header.writeUInt16BE(height, 7);
  header.writeUInt16BE(width, 9);
  header[11] = 3;
  Buffer.from([1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]).copy(header, 12);
  return header;
}

function bmpHeader(width, height) {
  const header = Buffer.alloc(54);
  header.write('BM', 0, 'ascii');
  header.writeUInt32LE(header.length, 2);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  return header;
}

function webpVp8xHeader(width, height) {
  const header = Buffer.alloc(30);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(22, 4);
  header.write('WEBP', 8, 'ascii');
  header.write('VP8X', 12, 'ascii');
  header.writeUInt32LE(10, 16);
  header.writeUIntLE(width - 1, 24, 3);
  header.writeUIntLE(height - 1, 27, 3);
  return header;
}

function tiffHeader(width, height, byteOrder = 'II') {
  const littleEndian = byteOrder === 'II';
  const header = Buffer.alloc(38);
  header.write(byteOrder, 0, 'ascii');
  const writeUInt16 = (offset, value) => littleEndian ? header.writeUInt16LE(value, offset) : header.writeUInt16BE(value, offset);
  const writeUInt32 = (offset, value) => littleEndian ? header.writeUInt32LE(value, offset) : header.writeUInt32BE(value, offset);
  writeUInt16(2, 42);
  writeUInt32(4, 8);
  writeUInt16(8, 2);
  writeUInt16(10, 256);
  writeUInt16(12, 3);
  writeUInt32(14, 1);
  writeUInt16(18, width);
  writeUInt16(22, 257);
  writeUInt16(24, 4);
  writeUInt32(26, 1);
  writeUInt32(30, height);
  return header;
}

test('Markdown file drops use the matching image and ordinary-link defaults', async () => {
  assert.deepEqual(await formatDroppedFilePaths(
    ['/work/docs/assets/Logo.PNG', '/work/docs/assets/guide.PDF'],
    '/work/docs/readme.md', 'markdown', 'linux'
  ), {
    text: '![Logo](assets/Logo.PNG)\n[guide](assets/guide.PDF)',
    fileCount: 2
  });
});

test('HTML and CSS file drops use syntax defaults including CotEditor image dimensions', async t => {
  const directory = await temporaryDirectory(t);
  const imagePath = path.join(directory, 'logo.png');
  await writeFile(imagePath, pngHeader(32, 24));
  assert.equal((await formatDroppedFilePaths([imagePath], path.join(directory, 'page.html'), 'html', 'linux')).text,
    '<img src="logo.png" alt="logo" title="logo" width="32" height="24" />');
  assert.equal((await formatDroppedFilePaths(['/project/scripts/app.JS'], '/project/page.html', 'html', 'linux')).text,
    '<script type="text/javascript" src="scripts/app.JS"></script>');
  assert.equal((await formatDroppedFilePaths(['/project/page.HTML'], '/project/index.html', 'html', 'linux')).text,
    '<a href="page.HTML" title="page"></a>');
  assert.equal((await formatDroppedFilePaths(['/project/images/bg.svg'], '/project/site.css', 'css', 'linux')).text,
    'url("images/bg.svg")');
});

test('unsupported syntax falls back to the absolute path and Windows uses native relative paths', async () => {
  assert.equal((await formatDroppedFilePaths(['/home/user/notes.txt'], null, 'plaintext', 'linux')).text,
    '/home/user/notes.txt');
  assert.equal((await formatDroppedFilePaths(['C:\\work\\assets\\img.png'], 'C:\\work\\docs\\page.md', 'markdown', 'win32')).text,
    '![img](..\\assets\\img.png)');
  assert.equal((await formatDroppedFilePaths(['D:\\assets\\img.svg'], 'C:\\work\\page.html', 'html', 'win32')).text,
    'D:\\assets\\img.svg');
});

test('IMAGEWIDTH and IMAGEHEIGHT parse bounded PNG, GIF, JPEG, BMP, WebP, and classic TIFF headers', async t => {
  const directory = await temporaryDirectory(t);
  const samples = [
    ['logo.png', pngHeader(640, 480), '640x480'],
    ['animation.gif', gifHeader(16, 9), '16x9'],
    ['photo.jpg', jpegHeader(1920, 1080), '1920x1080'],
    ['bitmap.bmp', bmpHeader(1024, 768), '1024x768'],
    ['modern.webp', webpVp8xHeader(800, 600), '800x600'],
    ['little-endian.tif', tiffHeader(320, 240, 'II'), '320x240'],
    ['big-endian.tiff', tiffHeader(640, 480, 'MM'), '640x480']
  ];
  const filePaths = [];
  for (const [name, header] of samples) {
    const filePath = path.join(directory, name);
    await writeFile(filePath, header);
    filePaths.push(filePath);
  }
  const result = await formatDroppedFilePaths(filePaths, null, 'html', process.platform, [
    { scope: 'html', extensions: [], format: '<<<FILENAME>>>:<<<IMAGEWIDTH>>>x<<<IMAGEHEIGHT>>>' }
  ]);
  assert.equal(result.text, samples.map(([name, , dimensions]) => `${name}:${dimensions}`).join('\n'));
});

test('image dimensions reject BigTIFF and classic TIFF headers with out-of-bounds IFD offsets', async t => {
  const directory = await temporaryDirectory(t);
  const bigTiff = Buffer.from([0x49, 0x49, 43, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const invalidIfd = Buffer.from([0x49, 0x49, 42, 0, 0xff, 0xff, 0xff, 0x7f]);
  const filePaths = [];
  for (const [name, header] of [['big.tif', bigTiff], ['invalid-ifd.tif', invalidIfd]]) {
    const filePath = path.join(directory, name);
    await writeFile(filePath, header);
    filePaths.push(filePath);
  }
  const rule = [{ scope: 'html', extensions: [], format: '<<<IMAGEWIDTH>>>x<<<IMAGEHEIGHT>>>' }];
  for (const filePath of filePaths) {
    await assert.rejects(formatDroppedFilePaths([filePath], null, 'html', process.platform, rule), /无法从有限文件头识别/);
  }
});

test('image dimensions reject unknown headers and enforce the 1 MiB per-file / 4 MiB per-drop read bounds', async t => {
  const directory = await temporaryDirectory(t);
  const unknown = path.join(directory, 'unknown.png');
  await writeFile(unknown, 'not an image');
  const rule = [{ scope: 'html', extensions: [], format: '<<<IMAGEWIDTH>>>x<<<IMAGEHEIGHT>>>' }];
  await assert.rejects(formatDroppedFilePaths([unknown], null, 'html', process.platform, rule), /无法从有限文件头识别/);

  const paddedHeader = Buffer.alloc(MAX_FILE_DROP_IMAGE_HEADER_BYTES + 1);
  pngHeader(1, 1).copy(paddedHeader);
  const filePaths = [];
  for (let index = 0; index < Math.ceil(MAX_FILE_DROP_TOTAL_IMAGE_HEADER_BYTES / MAX_FILE_DROP_IMAGE_HEADER_BYTES) + 1; index++) {
    const filePath = path.join(directory, `bounded-${index}.png`);
    await writeFile(filePath, paddedHeader);
    filePaths.push(filePath);
  }
  await assert.rejects(formatDroppedFilePaths(filePaths, null, 'html', process.platform, rule), /最多为 4 MiB/);
});

test('file drops reject missing, relative, control-character and excessive path inputs', async () => {
  await assert.rejects(formatDroppedFilePaths([], null, 'markdown', 'linux'), /没有可插入的文件路径/);
  await assert.rejects(formatDroppedFilePaths(['relative/file.txt'], null, 'markdown', 'linux'), /绝对路径/);
  await assert.rejects(formatDroppedFilePaths(['/tmp/bad\nname.txt'], null, 'markdown', 'linux'), /绝对路径/);
  await assert.rejects(formatDroppedFilePaths(Array(MAX_DROPPED_FILES + 1).fill('/tmp/a.txt'), null, 'plaintext', 'linux'), /最多拖放/);
  await assert.rejects(formatDroppedFilePaths([`/${'x'.repeat(4096)}`], null, 'plaintext', 'linux'), /绝对路径/);
});

test('custom File Drop rules match syntax and extensions top-to-bottom and expand file metadata variables', async () => {
  const rules = [
    { id: 'global', scope: '', extensions: [], format: 'GLOBAL <<<FILENAME>>>' },
    { id: 'markdown-image', scope: 'markdown', extensions: ['png'], format: '![<<<FILENAME-NOSUFFIX>>>](<<<RELATIVE-PATH>>>)' },
    { id: 'markdown-any', scope: 'markdown', extensions: [], format: '<<<DIRECTORY>>>/<<<FILEEXTENSION-LOWER>>>/<<<FILEEXTENSION-UPPER>>>/<<<ABSOLUTE-PATH>>>' }
  ];
  assert.equal((await formatDroppedFilePaths(['/work/docs/assets/Logo.PNG'], '/work/docs/readme.md', 'markdown', 'linux', rules)).text,
    'GLOBAL Logo.PNG');
  assert.equal((await formatDroppedFilePaths(['/work/docs/assets/Logo.PNG'], '/work/docs/readme.md', 'markdown', 'linux', rules.slice(1))).text,
    '![Logo](assets/Logo.PNG)');
  assert.equal((await formatDroppedFilePaths(['/work/docs/assets/Logo.txt'], '/work/docs/readme.md', 'markdown', 'linux', rules.slice(1))).text,
    'assets/txt/TXT//work/docs/assets/Logo.txt');
  assert.equal((await formatDroppedFilePaths(['/work/docs/assets/Logo.PNG'], '/work/docs/readme.md', 'html', 'linux', rules.slice(1))).text,
    '/work/docs/assets/Logo.PNG');
  assert.equal((await formatDroppedFilePaths(['/work/docs/assets/Logo.PNG'], '/work/docs/readme.md', 'markdown', 'linux', [])).text,
    '/work/docs/assets/Logo.PNG');
});

test('invalid or oversized custom File Drop rules are ignored by the main-process formatter', async () => {
  const result = await formatDroppedFilePaths(['/tmp/a.md'], null, 'markdown', 'linux', [
    { scope: '../unsafe', extensions: [], format: 'wrong scope' },
    { scope: 'markdown', extensions: ['.md', 'bad extension!'], format: 'must not become a catch-all rule' },
    { scope: 'markdown', extensions: [], format: 'x'.repeat(9 * 1024) }
  ]);
  assert.equal(result.text, '/tmp/a.md', 'invalid rules are discarded rather than becoming a broad all-extension match');
  assert.equal((await formatDroppedFilePaths(['/tmp/a.md'], null, 'markdown', 'linux', [
    { scope: 'other', extensions: [], format: '<<<FILECONTENT>>>' }
  ])).text, '/tmp/a.md', 'a mismatched or unconfigured rule never requests file contents');
});

test('path-only templates do not inspect or read the dropped file', async () => {
  const missingPath = path.join(os.tmpdir(), 'cotedit-file-drop-path-only-file-does-not-exist.txt');
  const result = await formatDroppedFilePaths([missingPath], null, 'markdown', process.platform, [
    { scope: 'markdown', extensions: ['txt'], format: '<<<FILENAME>>>' }
  ]);
  assert.equal(result.text, path.basename(missingPath));
});

test('FILECONTENT inserts bounded strict UTF-8 text, strips a UTF-8 BOM, and does not re-expand inserted tokens', async t => {
  const directory = await temporaryDirectory(t);
  const filePath = path.join(directory, 'sample.txt');
  const content = 'first line\n<<<FILENAME>>> stays literal';
  await writeFile(filePath, `\uFEFF${content}`, 'utf8');
  const result = await formatDroppedFilePaths([filePath], null, 'markdown', process.platform, [
    { scope: 'markdown', extensions: ['txt'], format: '<<<FILENAME>>>:\n<<<FILECONTENT>>>\n<<<FILECONTENT>>>' }
  ]);
  assert.equal(result.text, `sample.txt:\n${content}\n${content}`);
  assert.equal(result.fileCount, 1);
});

test('FILECONTENT rejects invalid UTF-8 and binary control data without returning partial output', async t => {
  const directory = await temporaryDirectory(t);
  const invalidUtf8 = path.join(directory, 'invalid.txt');
  const binary = path.join(directory, 'binary.txt');
  await writeFile(invalidUtf8, Buffer.from([0xc3, 0x28]));
  await writeFile(binary, Buffer.from('text\0binary', 'utf8'));
  const rules = [{ scope: 'markdown', extensions: ['txt'], format: 'prefix <<<FILECONTENT>>>' }];
  await assert.rejects(formatDroppedFilePaths([invalidUtf8], null, 'markdown', process.platform, rules), /有效的 UTF-8/);
  await assert.rejects(formatDroppedFilePaths([binary], null, 'markdown', process.platform, rules), /不支持二进制内容/);
});

test('FILECONTENT refuses directories, symbolic links, and files over 64 KiB', async t => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, 'target.txt');
  const oversized = path.join(directory, 'oversized.txt');
  const link = path.join(directory, 'linked.txt');
  await writeFile(target, 'safe text', 'utf8');
  await writeFile(oversized, Buffer.alloc(MAX_FILE_DROP_CONTENT_BYTES + 1, 0x61));
  const rules = [{ scope: 'markdown', extensions: [], format: '<<<FILECONTENT>>>' }];
  await assert.rejects(formatDroppedFilePaths([directory], null, 'markdown', process.platform, rules), /普通 UTF-8 文本文件/);
  await assert.rejects(formatDroppedFilePaths([oversized], null, 'markdown', process.platform, rules), /最多为 64 KiB/);
  if (process.platform !== 'win32') {
    await symlink(target, link);
    await assert.rejects(formatDroppedFilePaths([link], null, 'markdown', process.platform, rules), /符号链接/);
  }
});

test('FILECONTENT enforces one 64 KiB total read budget across all dropped files', async t => {
  const directory = await temporaryDirectory(t);
  const first = path.join(directory, 'first.txt');
  const second = path.join(directory, 'second.txt');
  await writeFile(first, Buffer.alloc(40 * 1024, 0x61));
  await writeFile(second, Buffer.alloc(40 * 1024, 0x62));
  const rules = [{ scope: 'markdown', extensions: ['txt'], format: '<<<FILECONTENT>>>' }];
  await assert.rejects(formatDroppedFilePaths([first, second], null, 'markdown', process.platform, rules), /最多为 64 KiB/);
});

test('file drops cancel rather than truncate when formatted insertion exceeds 64 KiB', async () => {
  const paths = Array.from({ length: MAX_DROPPED_FILES }, (_, index) => `/${index}-${'x'.repeat(2050)}.txt`);
  assert.ok(Buffer.byteLength(paths.join('\n'), 'utf8') > MAX_DROPPED_INSERT_BYTES);
  await assert.rejects(formatDroppedFilePaths(paths, null, 'plaintext', 'linux'), /超过 64 KiB/);
});
