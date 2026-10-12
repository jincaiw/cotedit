import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MAX_PREVIEW_BYTES, MAX_SEARCH_FILE_BYTES, isBinaryPropertyListSignature, isUnixExecutableFile, isUnixExecutableSignature, previewFileInRoot, readHandleUpTo, resolveEditableFileInRoot, resolveRegularFileInRoot, searchDirectory } = require('../electron/directory-search.cjs');
const { atom: isoBmffAtom, isoBmffMovie: buildIsoBmffMovie } = require('./fixtures/iso-bmff.cjs');

async function temporaryDirectories(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-directory-search-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-directory-outside-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  return { root, outside };
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

function pngHeaderWithDpi(width, height, pixelsPerMeter) {
  const header = Buffer.alloc(54);
  pngHeader(width, height).copy(header);
  header.writeUInt32BE(9, 33);
  header.write('pHYs', 37, 'ascii');
  header.writeUInt32BE(pixelsPerMeter, 41);
  header.writeUInt32BE(pixelsPerMeter, 45);
  header[49] = 1;
  return header;
}

function jpegWithExifDpi(width, height, dpi) {
  const tiff = Buffer.alloc(46);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  tiff.writeUInt16LE(282, 10);
  tiff.writeUInt16LE(5, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(38, 18);
  tiff.writeUInt16LE(296, 22);
  tiff.writeUInt16LE(3, 24);
  tiff.writeUInt32LE(1, 26);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(0, 34);
  tiff.writeUInt32LE(dpi, 38);
  tiff.writeUInt32LE(1, 42);

  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const exifSegment = Buffer.alloc(exifPayload.length + 4);
  exifSegment.set([0xff, 0xe1]);
  exifSegment.writeUInt16BE(exifPayload.length + 2, 2);
  exifPayload.copy(exifSegment, 4);

  const framePayload = Buffer.from([8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]);
  const frameSegment = Buffer.alloc(framePayload.length + 4);
  frameSegment.set([0xff, 0xc0]);
  frameSegment.writeUInt16BE(framePayload.length + 2, 2);
  framePayload.copy(frameSegment, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), exifSegment, frameSegment, Buffer.from([0xff, 0xda])]);
}

function jpegWithExifColorSpace(width, height, colorSpace) {
  const tiff = Buffer.alloc(44);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(34665, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(40961, 28);
  tiff.writeUInt16LE(3, 30);
  tiff.writeUInt32LE(1, 32);
  tiff.writeUInt16LE(colorSpace, 36);

  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const exifSegment = Buffer.alloc(exifPayload.length + 4);
  exifSegment.set([0xff, 0xe1]);
  exifSegment.writeUInt16BE(exifPayload.length + 2, 2);
  exifPayload.copy(exifSegment, 4);
  const framePayload = Buffer.from([8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]);
  const frameSegment = Buffer.alloc(framePayload.length + 4);
  frameSegment.set([0xff, 0xc0]);
  frameSegment.writeUInt16BE(framePayload.length + 2, 2);
  framePayload.copy(frameSegment, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), exifSegment, frameSegment, Buffer.from([0xff, 0xda])]);
}

function jpegWithJfifGrayFrame(width, height) {
  const jfif = Buffer.alloc(18);
  jfif.set([0xff, 0xe0]);
  jfif.writeUInt16BE(16, 2);
  jfif.write('JFIF\0', 4, 'binary');
  jfif[9] = 1;
  jfif[10] = 2;
  jfif.writeUInt16BE(1, 12);
  jfif.writeUInt16BE(1, 14);
  const framePayload = Buffer.from([8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]);
  const frame = Buffer.alloc(framePayload.length + 4);
  frame.set([0xff, 0xc0]);
  frame.writeUInt16BE(framePayload.length + 2, 2);
  framePayload.copy(frame, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, frame, Buffer.from([0xff, 0xda])]);
}

function tiffWithExifColorSpace(width, height, colorSpace) {
  const buffer = Buffer.alloc(68);
  buffer.write('II', 0, 'ascii');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(3, 8);
  const entries = [[256, 4, width], [257, 4, height], [34665, 4, 50]];
  entries.forEach(([tag, type, value], index) => {
    const offset = 10 + index * 12;
    buffer.writeUInt16LE(tag, offset);
    buffer.writeUInt16LE(type, offset + 2);
    buffer.writeUInt32LE(1, offset + 4);
    buffer.writeUInt32LE(value, offset + 8);
  });
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt16LE(1, 50);
  buffer.writeUInt16LE(40961, 52);
  buffer.writeUInt16LE(3, 54);
  buffer.writeUInt32LE(1, 56);
  buffer.writeUInt16LE(colorSpace, 60);
  buffer.writeUInt32LE(0, 64);
  return buffer;
}

function tiffWithPhotometricInterpretation(width, height, photometricInterpretation) {
  const buffer = Buffer.alloc(50);
  buffer.write('II', 0, 'ascii');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(3, 8);
  const entries = [[256, 4, width], [257, 4, height], [262, 3, photometricInterpretation]];
  entries.forEach(([tag, type, value], index) => {
    const offset = 10 + index * 12;
    buffer.writeUInt16LE(tag, offset);
    buffer.writeUInt16LE(type, offset + 2);
    buffer.writeUInt32LE(1, offset + 4);
    if (type === 3) buffer.writeUInt16LE(value, offset + 8);
    else buffer.writeUInt32LE(value, offset + 8);
  });
  buffer.writeUInt32LE(0, 46);
  return buffer;
}

function webpWithExifDpi(width, height, dpi) {
  const tiff = Buffer.alloc(46);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  tiff.writeUInt16LE(282, 10);
  tiff.writeUInt16LE(5, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(38, 18);
  tiff.writeUInt16LE(296, 22);
  tiff.writeUInt16LE(3, 24);
  tiff.writeUInt32LE(1, 26);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(0, 34);
  tiff.writeUInt32LE(dpi, 38);
  tiff.writeUInt32LE(1, 42);

  const chunk = (type, data) => {
    const value = Buffer.alloc(8 + data.length + (data.length & 1));
    value.write(type, 0, 'ascii');
    value.writeUInt32LE(data.length, 4);
    data.copy(value, 8);
    return value;
  };
  const vp8x = Buffer.alloc(10);
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunk('VP8X', vp8x), chunk('EXIF', tiff)]);
  const file = Buffer.alloc(body.length + 8);
  file.write('RIFF', 0, 'ascii');
  file.writeUInt32LE(body.length, 4);
  body.copy(file, 8);
  return file;
}

function wavePcm(dataBytes, formatTag = 1) {
  const sampleRate = 8000;
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(formatTag, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate, 8);
  fmt.writeUInt16LE(1, 12);
  fmt.writeUInt16LE(8, 14);
  const fmtChunk = Buffer.alloc(24);
  fmtChunk.write('fmt ', 0, 'ascii');
  fmtChunk.writeUInt32LE(fmt.length, 4);
  fmt.copy(fmtChunk, 8);
  const dataChunk = Buffer.alloc(8 + dataBytes + (dataBytes & 1));
  dataChunk.write('data', 0, 'ascii');
  dataChunk.writeUInt32LE(dataBytes, 4);
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmtChunk, dataChunk]);
  const wave = Buffer.alloc(body.length + 8);
  wave.write('RIFF', 0, 'ascii');
  wave.writeUInt32LE(body.length, 4);
  body.copy(wave, 8);
  return wave;
}

function aiffPcm(sampleFrames, sampleRate = 8000, { formType = 'AIFF', compressionType = 'NONE', compressionName = 'not compressed' } = {}) {
  const isAifc = formType === 'AIFC';
  const encodedName = Buffer.from(compressionName, 'ascii');
  const unpaddedNameLength = encodedName.length + 1;
  const compressionNameSize = unpaddedNameLength + (unpaddedNameLength & 1);
  const common = Buffer.alloc(isAifc ? 22 + compressionNameSize : 18);
  common.writeUInt16BE(1, 0);
  common.writeUInt32BE(sampleFrames, 2);
  common.writeUInt16BE(16, 6);
  const exponent = Math.floor(Math.log2(sampleRate));
  const mantissa = BigInt(Math.round((sampleRate / (2 ** exponent)) * (2 ** 63)));
  common.writeUInt16BE(exponent + 16383, 8);
  common.writeBigUInt64BE(mantissa, 10);
  if (isAifc) {
    common.write(compressionType, 18, 'ascii');
    common[22] = encodedName.length;
    encodedName.copy(common, 23);
  }

  const samples = Buffer.alloc(sampleFrames * 2);
  const sound = Buffer.alloc(8 + samples.length);
  samples.copy(sound, 8);
  const chunk = (type, data) => {
    const value = Buffer.alloc(8 + data.length + (data.length & 1));
    value.write(type, 0, 'ascii');
    value.writeUInt32BE(data.length, 4);
    data.copy(value, 8);
    return value;
  };
  const chunks = [];
  if (isAifc) {
    const fver = Buffer.alloc(4);
    fver.writeUInt32BE(0xa2805140);
    chunks.push(chunk('FVER', fver));
  }
  chunks.push(chunk('COMM', common), chunk('SSND', sound));
  const body = Buffer.concat([Buffer.from(formType, 'ascii'), ...chunks]);
  const file = Buffer.alloc(body.length + 8);
  file.write('FORM', 0, 'ascii');
  file.writeUInt32BE(body.length, 4);
  body.copy(file, 8);
  return file;
}

test('folder search returns relative paths, line numbers and respects hidden/ignored folders', async t => {
  const { root, outside } = await temporaryDirectories(t);
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'node_modules'));
  await fs.mkdir(path.join(root, '.hidden'));
  await fs.writeFile(path.join(root, 'src', 'note.txt'), 'first\nNeedle here\nlast');
  await fs.writeFile(path.join(root, 'node_modules', 'ignored.txt'), 'Needle');
  await fs.writeFile(path.join(root, '.hidden', 'hidden.txt'), 'Needle');
  await fs.writeFile(path.join(outside, 'secret.txt'), 'Needle');
  await fs.symlink(outside, path.join(root, 'outside-link'), 'dir');

  const result = await searchDirectory(root, { query: 'needle', caseSensitive: false });
  assert.equal(result.root, root);
  assert.equal(result.scanned, 1);
  assert.deepEqual(result.results.map(hit => [hit.relativePath, hit.line, hit.preview]), [['src/note.txt', 2, 'Needle here']]);
  await assert.rejects(previewFileInRoot(root, path.join(outside, 'secret.txt')), /超出已选文件夹范围/);
  await assert.rejects(previewFileInRoot(root, path.join(root, 'outside-link', 'secret.txt')), /符号链接离开/);
  await assert.rejects(resolveEditableFileInRoot(root, path.join(outside, 'secret.txt')), /超出已选文件夹范围/);
  await assert.rejects(resolveEditableFileInRoot(root, path.join(root, 'outside-link', 'secret.txt')), /符号链接离开/);
});

test('file preview is bounded, reports original size and returns normalized plain text', async t => {
  const { root } = await temporaryDirectories(t);
  const filename = path.join(root, 'large.md');
  await fs.writeFile(filename, `# preview\n${'x'.repeat(MAX_PREVIEW_BYTES + 50)}`);

  const preview = await previewFileInRoot(root, filename);
  assert.equal(preview.name, 'large.md');
  assert.equal(preview.size, MAX_PREVIEW_BYTES + 60);
  assert.equal(preview.truncated, true);
  assert.ok(Buffer.byteLength(preview.text, 'utf8') <= MAX_PREVIEW_BYTES);
  assert.match(preview.text, /^# preview\n/);
});

test('UNIX executables are identified and never returned as editable plain-text previews', async t => {
  const { root } = await temporaryDirectories(t);
  const executable = path.join(root, 'run-me');
  const executeOnly = path.join(root, 'execute-only');
  const ordinary = path.join(root, 'notes.txt');
  await fs.writeFile(executable, '#!/bin/sh\necho should-not-be-previewed\n');
  await fs.chmod(executable, 0o755);
  await fs.writeFile(executeOnly, '#!/bin/sh\nexit 0\n');
  await fs.chmod(executeOnly, 0o111);
  await fs.writeFile(ordinary, 'plain text');
  await fs.chmod(ordinary, 0o644);

  assert.equal(isUnixExecutableFile({ mode: 0o100755 }, 'linux'), true);
  assert.equal(isUnixExecutableFile({ mode: 0o100755 }, 'darwin'), true);
  assert.equal(isUnixExecutableFile({ mode: 0o100755 }, 'win32'), false);
  assert.equal(isUnixExecutableFile({ mode: 0o100644 }, 'linux'), false);

  const preview = await previewFileInRoot(root, executable);
  if (process.platform === 'win32') {
    assert.equal(preview.executable, false);
  } else {
    assert.equal(preview.executable, true);
    assert.equal(preview.encoding, null);
    assert.equal(preview.text, '', 'executable bytes are not decoded into the text preview');
    await assert.rejects(resolveEditableFileInRoot(root, executable), /不能作为纯文本打开/);
    const executeOnlyPreview = await previewFileInRoot(root, executeOnly);
    assert.equal(executeOnlyPreview.executable, true, 'execution metadata remains available without read permission');
    assert.equal(executeOnlyPreview.text, '');
  }
  assert.equal((await resolveEditableFileInRoot(root, ordinary)).path, ordinary);
  assert.equal((await resolveRegularFileInRoot(root, executable)).path, executable, 'the explicitly requested plain-text override still has a root-validated file path');
  assert.equal((await resolveEditableFileInRoot(root, executable, { platform: 'win32' })).path, executable);
});

test('ELF and Mach-O signatures protect non-executable-mode binaries within the selected folder', async t => {
  const { root } = await temporaryDirectories(t);
  const elf = path.join(root, 'tool-data');
  const machO = path.join(root, 'native-data');
  const ordinary = path.join(root, 'ordinary.txt');
  await fs.writeFile(elf, Buffer.concat([Buffer.from('7f454c46', 'hex'), Buffer.from('binary payload')]));
  await fs.writeFile(machO, Buffer.concat([Buffer.from('cffaedfe', 'hex'), Buffer.from('binary payload')]));
  await fs.writeFile(ordinary, 'plain text');
  await Promise.all([elf, machO, ordinary].map(filename => fs.chmod(filename, 0o644)));

  assert.equal(isUnixExecutableSignature(Buffer.from('7f454c46', 'hex'), 'linux'), true);
  assert.equal(isUnixExecutableSignature(Buffer.from('feedface', 'hex'), 'darwin'), true);
  assert.equal(isUnixExecutableSignature(Buffer.from('cafebabf', 'hex'), 'darwin'), true);
  assert.equal(isUnixExecutableSignature(Buffer.from('7f454c46', 'hex'), 'win32'), false);
  assert.equal(isUnixExecutableSignature(Buffer.from('text'), 'linux'), false);

  if (process.platform === 'win32') {
    t.skip('POSIX executable-content classification is not applied on Windows.');
    return;
  }

  for (const filename of [elf, machO]) {
    const preview = await previewFileInRoot(root, filename);
    assert.equal(preview.executable, true);
    assert.equal(preview.encoding, null);
    assert.equal(preview.text, '');
    await assert.rejects(resolveEditableFileInRoot(root, filename), /不能作为纯文本打开/);
    assert.equal((await resolveRegularFileInRoot(root, filename)).path, filename,
      'the explicit plain-text override retains the existing root-validated path');
  }

  const textPreview = await previewFileInRoot(root, ordinary);
  assert.equal(textPreview.executable, false);
  assert.equal(textPreview.text, 'plain text');
  assert.equal((await resolveEditableFileInRoot(root, ordinary)).path, ordinary);
});

test('binary property lists are not previewed or opened as plain text by default, while XML plists and explicit overrides remain available', async t => {
  const { root } = await temporaryDirectories(t);
  const binary = path.join(root, 'settings.plist');
  const xml = path.join(root, 'settings.xml');
  const binaryBytes = Buffer.concat([Buffer.from('bplist00', 'ascii'), Buffer.from([0, 1, 2, 3, 0, 255])]);
  await fs.writeFile(binary, binaryBytes);
  await fs.writeFile(xml, '<?xml version="1.0"?><plist><dict/></plist>');
  await fs.chmod(binary, 0o644);

  assert.equal(isBinaryPropertyListSignature(Buffer.from('bplist00', 'ascii')), true);
  assert.equal(isBinaryPropertyListSignature(Buffer.from('bplis', 'ascii')), false);
  assert.equal(isBinaryPropertyListSignature(Buffer.from('prefix-bplist00', 'ascii')), false);

  const preview = await previewFileInRoot(root, binary);
  assert.equal(preview.binaryPropertyList, true);
  assert.equal(preview.executable, false);
  assert.equal(preview.encoding, null);
  assert.equal(preview.text, '', 'binary plist payload is not decoded into the preview');
  assert.equal(preview.size, binaryBytes.length);
  assert.equal(preview.truncated, false);
  await assert.rejects(resolveEditableFileInRoot(root, binary), /二进制 Property List.*以纯文本打开/);
  await assert.rejects(resolveEditableFileInRoot(root, binary, { platform: 'win32' }), /二进制 Property List/);
  assert.equal((await resolveRegularFileInRoot(root, binary)).path, binary,
    'the explicit plain-text path keeps the existing root-scoped file validation');

  const xmlPreview = await previewFileInRoot(root, xml);
  assert.equal(xmlPreview.binaryPropertyList, false);
  assert.match(xmlPreview.text, /<plist>/);
  assert.equal((await resolveEditableFileInRoot(root, xml)).path, xml);
});

test('ISO BMFF containers are blocked from implicit folder-scoped text opening but retain the explicit override', async t => {
  const { root } = await temporaryDirectories(t);
  const moviePath = path.join(root, 'movie.data');
  const movieBytes = buildIsoBmffMovie();
  await fs.writeFile(moviePath, movieBytes);

  await assert.rejects(resolveEditableFileInRoot(root, moviePath), /ISO BMFF.*以纯文本打开/);
  await assert.rejects(resolveEditableFileInRoot(root, moviePath, { platform: 'win32' }), /ISO BMFF/);
  assert.equal((await resolveRegularFileInRoot(root, moviePath)).path, moviePath,
    'the explicit folder-scoped plain-text path remains available to the user');
});

test('directory preview reports bounded image pixel dimensions without decoding or returning image bytes', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'signature-not-extension.bin');
  const header = pngHeaderWithDpi(2048, 1536, 3780);
  const imageBytes = Buffer.concat([header, Buffer.alloc(MAX_PREVIEW_BYTES + 32, 0x7f)]);
  await fs.writeFile(imagePath, imageBytes);

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true, 'image detection is based on a validated header rather than a filename extension');
  assert.deepEqual(preview.imageDimensions, { width: 2048, height: 1536 });
  assert.equal(preview.imageDpi, 3780 * 0.0254, 'supported physical-resolution metadata is returned as a scalar only');
  assert.equal(preview.encoding, null);
  assert.equal(preview.text, '', 'image data is never exposed as decoded preview text');
  assert.equal(preview.size, imageBytes.length);
  assert.equal(preview.truncated, false, 'image metadata is complete even when the image file is larger than the text-preview budget');
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'the binary preview buffer is not returned to the renderer');

  const jpegPath = path.join(root, 'exif-image.jpg');
  await fs.writeFile(jpegPath, jpegWithExifDpi(640, 480, 300));
  const jpegPreview = await previewFileInRoot(root, jpegPath);
  assert.equal(jpegPreview.image, true);
  assert.deepEqual(jpegPreview.imageDimensions, { width: 640, height: 480 });
  assert.equal(jpegPreview.imageDpi, 300, 'EXIF XResolution crosses the preview boundary only as a scalar');
  assert.equal(jpegPreview.text, '');
  assert.equal(Object.hasOwn(jpegPreview, 'buffer'), false);

  const webpPath = path.join(root, 'webp-with-exif.bin');
  await fs.writeFile(webpPath, webpWithExifDpi(320, 200, 144));
  const webpPreview = await previewFileInRoot(root, webpPath);
  assert.equal(webpPreview.image, true);
  assert.deepEqual(webpPreview.imageDimensions, { width: 320, height: 200 });
  assert.equal(webpPreview.imageDpi, 144, 'WebP EXIF crosses the preview boundary only as a scalar DPI');
  assert.equal(webpPreview.text, '');
  assert.equal(Object.hasOwn(webpPreview, 'buffer'), false);

  const invalidPath = path.join(root, 'invalid.png');
  await fs.writeFile(invalidPath, pngHeader(0, 1536));
  await assert.rejects(previewFileInRoot(root, invalidPath), /二进制文件/,
    'invalid zero-sized image headers fall back to existing binary-text protection');
});

test('directory preview reports bounded WAVE PCM duration without decoding or returning audio bytes', async t => {
  const { root } = await temporaryDirectories(t);
  const audioPath = path.join(root, 'recording.wav');
  const pcmBytes = wavePcm(MAX_PREVIEW_BYTES + 4096);
  const trailingInfo = Buffer.alloc(12);
  trailingInfo.write('LIST', 0, 'ascii');
  trailingInfo.writeUInt32LE(4, 4);
  trailingInfo.write('INFO', 8, 'ascii');
  const audioBytes = Buffer.concat([pcmBytes, trailingInfo]);
  audioBytes.writeUInt32LE(audioBytes.length - 8, 4);
  await fs.writeFile(audioPath, audioBytes);

  const preview = await previewFileInRoot(root, audioPath);
  assert.equal(preview.audio, true, 'WAVE identification is based on bounded RIFF and PCM headers');
  assert.equal(preview.audioDurationSeconds, (MAX_PREVIEW_BYTES + 4096) / 8000);
  assert.equal(preview.encoding, null);
  assert.equal(preview.text, '', 'audio bytes are never decoded into text');
  assert.equal(preview.size, audioBytes.length);
  assert.equal(preview.truncated, false);
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'the binary audio buffer is not returned to the renderer');

  const unsupportedPath = path.join(root, 'compressed.wav');
  await fs.writeFile(unsupportedPath, wavePcm(8000, 3));
  const unsupported = await previewFileInRoot(root, unsupportedPath);
  assert.equal(unsupported.audio, true, 'a WAVE container remains protected even when its codec is unsupported');
  assert.equal(unsupported.audioDurationSeconds, null, 'unsupported encoding has no speculative duration');
  assert.equal(unsupported.text, '', 'unsupported WAVE audio is not decoded as preview text');
  assert.equal(Object.hasOwn(unsupported, 'buffer'), false);
});

test('directory preview reports bounded classic AIFF PCM duration without exposing audio data', async t => {
  const { root } = await temporaryDirectories(t);
  const filename = path.join(root, 'recording.aiff');
  const bytes = aiffPcm(400_000, 8000);
  await fs.writeFile(filename, bytes);

  const preview = await previewFileInRoot(root, filename);
  assert.equal(preview.audio, true);
  assert.equal(preview.audioKind, 'AIFF');
  assert.equal(preview.audioDurationSeconds, 50);
  assert.equal(preview.encoding, null);
  assert.equal(preview.text, '', 'audio samples are not decoded as text');
  assert.equal(preview.size, bytes.length);
  assert.equal(preview.truncated, false);
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'audio bytes remain private to the main process');

  const aiffCPath = path.join(root, 'recording.aifc');
  const aiffCBytes = aiffPcm(8000, 8000, { formType: 'AIFC', compressionType: 'sowt', compressionName: '' });
  await fs.writeFile(aiffCPath, aiffCBytes);
  const aiffCPreview = await previewFileInRoot(root, aiffCPath);
  assert.equal(aiffCPreview.audio, true);
  assert.equal(aiffCPreview.audioKind, 'AIFF-C');
  assert.equal(aiffCPreview.audioDurationSeconds, 1);
  assert.equal(aiffCPreview.encoding, null);
  assert.equal(aiffCPreview.text, '', 'AIFF-C PCM samples are not decoded as text');
  assert.equal(aiffCPreview.size, aiffCBytes.length);
  assert.equal(Object.hasOwn(aiffCPreview, 'buffer'), false, 'audio bytes remain private to the main process');

  const compressedPath = path.join(root, 'compressed.aifc');
  await fs.writeFile(compressedPath, aiffPcm(8000, 8000, { formType: 'AIFC', compressionType: 'ulaw', compressionName: 'ULaw 2:1' }));
  const unsupported = await previewFileInRoot(root, compressedPath);
  assert.equal(unsupported.audio, true, 'compressed AIFF-C remains protected as audio');
  assert.equal(unsupported.audioKind, 'AIFF-C');
  assert.equal(unsupported.audioDurationSeconds, null, 'unsupported compression is not assigned a guessed duration');
  assert.equal(unsupported.text, '');
  assert.equal(Object.hasOwn(unsupported, 'buffer'), false);
});

test('directory preview reports bounded ISO BMFF movie attributes without decoding or returning media bytes', async t => {
  const { root } = await temporaryDirectories(t);
  const moviePath = path.join(root, 'clip.mp4');
  const movieBytes = buildIsoBmffMovie({ duration: 90_500, width: 1920, height: 1080 });
  await fs.writeFile(moviePath, movieBytes);

  const preview = await previewFileInRoot(root, moviePath);
  assert.equal(preview.isoBmff, true);
  assert.equal(preview.movie, true);
  assert.deepEqual(preview.movieDimensions, { width: 1920, height: 1080 });
  assert.equal(preview.movieDurationSeconds, 90.5);
  assert.equal(preview.encoding, null);
  assert.equal(preview.text, '', 'movie samples are never decoded as preview text');
  assert.equal(preview.size, movieBytes.length);
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'the media payload never crosses into the renderer');

  const audioOnlyPath = path.join(root, 'audio-only.mp4');
  await fs.writeFile(audioOnlyPath, buildIsoBmffMovie({ mediaType: 'soun' }));
  const audioOnly = await previewFileInRoot(root, audioOnlyPath);
  assert.equal(audioOnly.isoBmff, true);
  assert.equal(audioOnly.movie, false, 'an ISO BMFF container without a video track is not called a movie');
  assert.equal(audioOnly.text, '', 'unrecognized ISO BMFF contents remain protected from text decoding');

  const lateMoovPath = path.join(root, 'late-moov.mp4');
  const lateMoovBytes = buildIsoBmffMovie({ beforeMoov: [isoBmffAtom('mdat', Buffer.alloc(MAX_PREVIEW_BYTES + 2048))] });
  await fs.writeFile(lateMoovPath, lateMoovBytes);
  const lateMoov = await previewFileInRoot(root, lateMoovPath);
  assert.equal(lateMoov.isoBmff, true);
  assert.equal(lateMoov.movie, false, 'a moov atom beyond the bounded prefix is not sought or guessed');
  assert.equal(lateMoov.movieDimensions, null);
  assert.equal(lateMoov.movieDurationSeconds, null);
  assert.equal(lateMoov.text, '');
});

test('bounded handle reads stop at the search limit plus one byte after a file grows', async t => {
  const { root } = await temporaryDirectories(t);
  const filename = path.join(root, 'growing.txt');
  await fs.writeFile(filename, 'small');
  const handle = await fs.open(filename, 'r+');
  try {
    const initialStat = await handle.stat();
    await handle.writeFile(Buffer.alloc(MAX_SEARCH_FILE_BYTES + 128, 0x78));
    const bytes = await readHandleUpTo(handle, MAX_SEARCH_FILE_BYTES);
    assert.equal(initialStat.size, 5);
    assert.equal(bytes.length, MAX_SEARCH_FILE_BYTES + 1);
    assert.ok(bytes.length <= MAX_SEARCH_FILE_BYTES + 1);
  } finally {
    await handle.close();
  }
});

test('preview refuses binary files and paths escaping through symbolic links', async t => {
  const { root, outside } = await temporaryDirectories(t);
  const binary = path.join(root, 'image.bin');
  await fs.writeFile(binary, Buffer.from([0, 0, 1, 2, 3, 0, 255]));
  await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
  await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'));

  await assert.rejects(previewFileInRoot(root, binary), /二进制文件/);
  await assert.rejects(previewFileInRoot(root, path.join(root, 'link.txt')), /符号链接离开/);
  await assert.rejects(previewFileInRoot(root, outside), /超出已选文件夹范围/);
});

test('folder search supports translated ICU line breaks and rejects malformed regex', async t => {
  const { root } = await temporaryDirectories(t);
  await fs.writeFile(path.join(root, 'lines.txt'), 'alpha\nbeta');
  const result = await searchDirectory(root, { query: 'alpha\\Rbeta', regexp: true, caseSensitive: true });
  assert.deepEqual(result.results.map(hit => [hit.line, hit.preview]), [[1, 'alpha']]);
  await assert.rejects(searchDirectory(root, { query: '[', regexp: true }), /正则表达式无效/);
});

test('literal folder search matches canonical equivalents but preserves source previews and regex semantics', async t => {
  const { root } = await temporaryDirectories(t);
  const source = 'precomposed café\ndecomposed cafe\u0301\nuppercase CAFÉ';
  await fs.writeFile(path.join(root, 'unicode.txt'), source);

  const exactCase = await searchDirectory(root, { query: 'café', caseSensitive: true });
  assert.deepEqual(exactCase.results.map(hit => [hit.line, hit.preview]), [
    [1, 'precomposed café'],
    [2, 'decomposed cafe\u0301']
  ]);

  const insensitive = await searchDirectory(root, { query: 'CAFÉ', caseSensitive: false });
  assert.deepEqual(insensitive.results.map(hit => hit.line), [1, 2, 3]);

  const regex = await searchDirectory(root, { query: 'café', regexp: true, caseSensitive: true });
  assert.deepEqual(regex.results.map(hit => hit.line), [1], 'true regex patterns are not canonically normalized');
});

function pngFixtureCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngFixtureChunk(type, data) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(pngFixtureCrc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function pngFixture(width, height, colorChunk, colorType = 2, bitDepth = 8) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  return Buffer.concat([
    signature,
    pngFixtureChunk('IHDR', ihdr),
    colorChunk,
    pngFixtureChunk('IDAT', Buffer.alloc(0))
  ]);
}

function pngFixtureWithSrgb(width, height) {
  return pngFixture(width, height, pngFixtureChunk('sRGB', Buffer.from([0])));
}

function pngFixtureWithCicpSrgb(width, height) {
  return pngFixture(width, height, pngFixtureChunk('cICP', Buffer.from([1, 13, 0, 1])));
}

function pngFixtureWithCicpDisplayP3(width, height) {
  return pngFixture(width, height, pngFixtureChunk('cICP', Buffer.from([12, 13, 0, 1])));
}

function gifFixtureWithRgbPalette(width, height) {
  const header = Buffer.alloc(13);
  header.write('GIF89a', 0, 'ascii');
  header.writeUInt16LE(width, 6);
  header.writeUInt16LE(height, 8);
  header[10] = 0x80;
  const palette = Buffer.from([0, 0, 0, 255, 255, 255]);
  const descriptor = Buffer.alloc(10);
  descriptor[0] = 0x2c;
  descriptor.writeUInt16LE(width, 5);
  descriptor.writeUInt16LE(height, 7);
  return Buffer.concat([header, palette, descriptor, Buffer.from([2, 2, 0x44, 0x01, 0])]);
}

test('directory preview returns only an explicit PNG sRGB scalar within the existing preview limit', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'profiled-image.bin');
  const imageBytes = Buffer.concat([pngFixtureWithSrgb(1280, 720), Buffer.alloc(MAX_PREVIEW_BYTES + 20, 0x7f)]);
  await fs.writeFile(imagePath, imageBytes);

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true);
  assert.deepEqual(preview.imageDimensions, { width: 1280, height: 720 });
  assert.equal(preview.imageColorSpace, 'sRGB');
  assert.equal(preview.imageColorModel, 'RGB');
  assert.equal(preview.imageColorProfile, 'sRGB');
  assert.equal(preview.imageDpi, null);
  assert.equal(preview.text, '');
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'image bytes remain private to the main process');
  assert.equal(preview.size, imageBytes.length, 'metadata parsing does not alter the reported source size');
});

test('directory preview reports a bounded GIF RGB model as a scalar without exposing image bytes', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'indexed.gif');
  const imageBytes = Buffer.concat([gifFixtureWithRgbPalette(320, 240), Buffer.alloc(MAX_PREVIEW_BYTES + 20, 0x7f)]);
  await fs.writeFile(imagePath, imageBytes);

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true);
  assert.deepEqual(preview.imageDimensions, { width: 320, height: 240 });
  assert.equal(preview.imageColorSpace, 'RGB');
  assert.equal(preview.imageColorModel, 'RGB');
  assert.equal(preview.imageColorProfile, null);
  assert.equal(preview.text, '');
  assert.equal(preview.size, imageBytes.length);
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'the GIF bytes remain private to the main process');
});

test('directory preview forwards validated PNG grayscale and RGB models as scalars only', async t => {
  const { root } = await temporaryDirectories(t);
  for (const [colorType, bitDepth, model] of [
    [0, 1, 'Gray'], [2, 8, 'RGB'], [3, 4, 'RGB'], [4, 16, 'Gray'], [6, 8, 'RGB']
  ]) {
    const imagePath = path.join(root, `color-type-${colorType}.png`);
    const palette = colorType === 3 ? pngFixtureChunk('PLTE', Buffer.from([0, 0, 0])) : Buffer.alloc(0);
    await fs.writeFile(imagePath, pngFixture(320, 240, palette, colorType, bitDepth));

    const preview = await previewFileInRoot(root, imagePath);
    assert.equal(preview.image, true);
    assert.deepEqual(preview.imageDimensions, { width: 320, height: 240 });
    assert.equal(preview.imageColorSpace, model);
    assert.equal(preview.imageColorModel, model);
    assert.equal(preview.imageColorProfile, null);
    assert.equal(preview.text, '');
    assert.equal(Object.hasOwn(preview, 'buffer'), false, 'image bytes remain private to the main process');
  }
});

test('directory preview recognizes PNG sRGB signaled by CICP without exposing image bytes', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'cicp-srgb.png');
  await fs.writeFile(imagePath, pngFixtureWithCicpSrgb(640, 360));

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true);
  assert.deepEqual(preview.imageDimensions, { width: 640, height: 360 });
  assert.equal(preview.imageColorSpace, 'sRGB');
  assert.equal(preview.text, '');
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'image bytes remain private to the main process');
});

test('directory preview forwards PNG Display P3 CICP as a fixed scalar only', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'display-p3.png');
  await fs.writeFile(imagePath, pngFixtureWithCicpDisplayP3(640, 360));

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true);
  assert.deepEqual(preview.imageDimensions, { width: 640, height: 360 });
  assert.equal(preview.imageColorSpace, 'Display P3');
  assert.equal(preview.imageColorModel, 'RGB');
  assert.equal(preview.imageColorProfile, 'Display P3');
  assert.equal(preview.text, '');
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'image bytes remain private to the main process');
});

test('directory preview forwards JPEG EXIF sRGB only as a scalar and leaves uncalibrated values unknown', async t => {
  const { root } = await temporaryDirectories(t);
  const srgbPath = path.join(root, 'exif-srgb.jpg');
  const uncalibratedPath = path.join(root, 'exif-uncalibrated.jpg');
  await fs.writeFile(srgbPath, jpegWithExifColorSpace(640, 480, 1));
  await fs.writeFile(uncalibratedPath, jpegWithExifColorSpace(640, 480, 65535));

  const srgbPreview = await previewFileInRoot(root, srgbPath);
  assert.equal(srgbPreview.image, true);
  assert.equal(srgbPreview.imageColorSpace, 'sRGB');
  assert.equal(srgbPreview.imageColorModel, 'RGB');
  assert.equal(srgbPreview.imageColorProfile, 'sRGB');
  assert.deepEqual(srgbPreview.imageDimensions, { width: 640, height: 480 });
  assert.equal(srgbPreview.text, '');
  assert.equal(Object.hasOwn(srgbPreview, 'buffer'), false);

  const uncalibratedPreview = await previewFileInRoot(root, uncalibratedPath);
  assert.equal(uncalibratedPreview.image, true);
  assert.equal(uncalibratedPreview.imageColorSpace, null);
  assert.equal(uncalibratedPreview.text, '');
  assert.equal(Object.hasOwn(uncalibratedPreview, 'buffer'), false);
});

test('directory preview forwards only the JFIF grayscale model within its existing byte budget', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'jfif-gray.jpg');
  const imageBytes = Buffer.concat([jpegWithJfifGrayFrame(640, 480), Buffer.alloc(MAX_PREVIEW_BYTES + 32, 0x7f)]);
  await fs.writeFile(imagePath, imageBytes);

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true);
  assert.deepEqual(preview.imageDimensions, { width: 640, height: 480 });
  assert.equal(preview.imageColorSpace, 'Gray');
  assert.equal(preview.imageColorModel, 'Gray');
  assert.equal(preview.imageColorProfile, null, 'a JFIF model declaration does not invent a profile name');
  assert.equal(preview.text, '');
  assert.equal(preview.size, imageBytes.length);
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'only scalar metadata crosses the preview boundary');
});

test('directory preview forwards TIFF EXIF sRGB only as a scalar', async t => {
  const { root } = await temporaryDirectories(t);
  const srgbPath = path.join(root, 'exif-srgb.tiff');
  const uncalibratedPath = path.join(root, 'exif-uncalibrated.tiff');
  await fs.writeFile(srgbPath, tiffWithExifColorSpace(640, 480, 1));
  await fs.writeFile(uncalibratedPath, tiffWithExifColorSpace(640, 480, 65535));

  const srgbPreview = await previewFileInRoot(root, srgbPath);
  assert.equal(srgbPreview.image, true);
  assert.deepEqual(srgbPreview.imageDimensions, { width: 640, height: 480 });
  assert.equal(srgbPreview.imageColorSpace, 'sRGB');
  assert.equal(srgbPreview.text, '');
  assert.equal(Object.hasOwn(srgbPreview, 'buffer'), false);

  const uncalibratedPreview = await previewFileInRoot(root, uncalibratedPath);
  assert.equal(uncalibratedPreview.image, true);
  assert.equal(uncalibratedPreview.imageColorSpace, null);
  assert.equal(Object.hasOwn(uncalibratedPreview, 'buffer'), false);
});

test('directory preview reports a generic TIFF RGB model without exposing image bytes', async t => {
  const { root } = await temporaryDirectories(t);
  const imagePath = path.join(root, 'rgb-model.tiff');
  await fs.writeFile(imagePath, tiffWithPhotometricInterpretation(320, 240, 2));

  const preview = await previewFileInRoot(root, imagePath);
  assert.equal(preview.image, true);
  assert.deepEqual(preview.imageDimensions, { width: 320, height: 240 });
  assert.equal(preview.imageColorSpace, 'RGB');
  assert.equal(preview.text, '');
  assert.equal(Object.hasOwn(preview, 'buffer'), false, 'image bytes remain private to the main process');
});

test('directory preview reports TIFF grayscale/bilevel models only as a scalar', async t => {
  const { root } = await temporaryDirectories(t);
  const whiteIsZeroPath = path.join(root, 'white-is-zero.tiff');
  const blackIsZeroPath = path.join(root, 'black-is-zero.tiff');
  await fs.writeFile(whiteIsZeroPath, tiffWithPhotometricInterpretation(320, 240, 0));
  await fs.writeFile(blackIsZeroPath, tiffWithPhotometricInterpretation(640, 480, 1));

  for (const [imagePath, dimensions] of [
    [whiteIsZeroPath, { width: 320, height: 240 }],
    [blackIsZeroPath, { width: 640, height: 480 }]
  ]) {
    const preview = await previewFileInRoot(root, imagePath);
    assert.equal(preview.image, true);
    assert.deepEqual(preview.imageDimensions, dimensions);
    assert.equal(preview.imageColorSpace, 'Gray');
    assert.equal(preview.text, '');
    assert.equal(Object.hasOwn(preview, 'buffer'), false, 'image bytes remain private to the main process');
  }
});
