import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseImageDpi, parseImageColorSpace, parseImageColorAttributes, isWaveContainer, parseWavePcmDuration, isAiffContainer, parseAiffPcmDuration } = require('../electron/image-dimensions.cjs');

function pngWithPhysicalResolution(pixelsPerMeter, unit = 1) {
  const buffer = Buffer.alloc(54);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(320, 16);
  buffer.writeUInt32BE(240, 20);
  buffer.writeUInt32BE(9, 33);
  buffer.write('pHYs', 37, 'ascii');
  buffer.writeUInt32BE(pixelsPerMeter, 41);
  buffer.writeUInt32BE(pixelsPerMeter, 45);
  buffer[49] = unit;
  return buffer;
}

function jpegWithJfifResolution(units, xDensity, yDensity = xDensity) {
  const buffer = Buffer.alloc(22);
  buffer.set([0xff, 0xd8, 0xff, 0xe0]);
  buffer.writeUInt16BE(16, 4);
  buffer.write('JFIF\0', 6, 'ascii');
  buffer[11] = 1;
  buffer[12] = 2;
  buffer[13] = units;
  buffer.writeUInt16BE(xDensity, 14);
  buffer.writeUInt16BE(yDensity, 16);
  buffer.set([0xff, 0xda], 20);
  return buffer;
}

function jpegWithSegments(...segments) {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments, Buffer.from([0xff, 0xda])]);
}

function jpegWithJfifFrame(componentIds) {
  const jfif = Buffer.alloc(18);
  jfif.set([0xff, 0xe0]);
  jfif.writeUInt16BE(16, 2);
  jfif.write('JFIF\0', 4, 'binary');
  jfif[9] = 1;
  jfif[10] = 2;
  jfif.writeUInt16BE(1, 12);
  jfif.writeUInt16BE(1, 14);

  const framePayload = Buffer.alloc(6 + componentIds.length * 3);
  framePayload[0] = 8;
  framePayload.writeUInt16BE(480, 1);
  framePayload.writeUInt16BE(640, 3);
  framePayload[5] = componentIds.length;
  componentIds.forEach((id, index) => {
    const offset = 6 + index * 3;
    framePayload[offset] = id;
    framePayload[offset + 1] = 0x11;
    framePayload[offset + 2] = 0;
  });
  const frame = Buffer.alloc(framePayload.length + 4);
  frame.set([0xff, 0xc0]);
  frame.writeUInt16BE(framePayload.length + 2, 2);
  framePayload.copy(frame, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, frame, Buffer.from([0xff, 0xda])]);
}

function jpegExifSegment(tiff) {
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const segment = Buffer.alloc(payload.length + 4);
  segment.set([0xff, 0xe1]);
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

function riffChunk(type, data) {
  const chunk = Buffer.alloc(8 + data.length + (data.length & 1));
  chunk.write(type, 0, 'ascii');
  chunk.writeUInt32LE(data.length, 4);
  data.copy(chunk, 8);
  return chunk;
}

function webpWithChunks(...chunks) {
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks]);
  const buffer = Buffer.alloc(body.length + 8);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(body.length, 4);
  body.copy(buffer, 8);
  return buffer;
}

function wavePcm({ sampleRate = 8000, channels = 1, bitsPerSample = 8, dataBytes = 8000, formatTag = 1, fmtSize = 16, trailingChunk = '' } = {}) {
  const fmt = Buffer.alloc(fmtSize);
  if (fmtSize >= 16) {
    fmt.writeUInt16LE(formatTag, 0);
    fmt.writeUInt16LE(channels, 2);
    fmt.writeUInt32LE(sampleRate, 4);
    fmt.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 8);
    fmt.writeUInt16LE(channels * (bitsPerSample / 8), 12);
    fmt.writeUInt16LE(bitsPerSample, 14);
  }
  const data = Buffer.alloc(dataBytes);
  const chunks = [riffChunk('fmt ', fmt), riffChunk('data', data)];
  if (trailingChunk) chunks.push(riffChunk(trailingChunk, Buffer.alloc(0)));
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), ...chunks]);
  const buffer = Buffer.alloc(body.length + 8);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(body.length, 4);
  body.copy(buffer, 8);
  return buffer;
}

function aiffChunk(type, data) {
  const chunk = Buffer.alloc(8 + data.length + (data.length & 1));
  chunk.write(type, 0, 'ascii');
  chunk.writeUInt32BE(data.length, 4);
  data.copy(chunk, 8);
  return chunk;
}

function extended80(value) {
  const exponent = Math.floor(Math.log2(value));
  const mantissa = BigInt(Math.round((value / (2 ** exponent)) * (2 ** 63)));
  const bytes = Buffer.alloc(10);
  bytes.writeUInt16BE(exponent + 16383, 0);
  bytes.writeBigUInt64BE(mantissa, 2);
  return bytes;
}

function aiffPcm({ channels = 1, sampleFrames = 8000, sampleBits = 16, sampleRate = 8000, offset = 0, blockSize = 0, formType = 'AIFF', compressionType = 'NONE', compressionName = 'not compressed', includeVersion = true, version = 0xa2805140, extraChunks = [], includeSound = true } = {}) {
  const isAifc = formType === 'AIFC';
  const encodedName = Buffer.from(compressionName, 'ascii');
  const unpaddedNameLength = encodedName.length + 1;
  const compressionNameSize = unpaddedNameLength + (unpaddedNameLength & 1);
  const common = Buffer.alloc(isAifc ? 22 + compressionNameSize : 18);
  common.writeUInt16BE(channels, 0);
  common.writeUInt32BE(sampleFrames, 2);
  common.writeUInt16BE(sampleBits, 6);
  extended80(sampleRate).copy(common, 8);
  if (isAifc) {
    common.write(compressionType, 18, 'ascii');
    common[22] = encodedName.length;
    encodedName.copy(common, 23);
  }
  const samples = Buffer.alloc(sampleFrames * channels * Math.ceil(sampleBits / 8));
  const sound = Buffer.alloc(8 + offset + samples.length);
  sound.writeUInt32BE(offset, 0);
  sound.writeUInt32BE(blockSize, 4);
  samples.copy(sound, 8 + offset);
  const chunks = [];
  if (isAifc && includeVersion) {
    const formatVersion = Buffer.alloc(4);
    formatVersion.writeUInt32BE(version);
    chunks.push(aiffChunk('FVER', formatVersion));
  }
  chunks.push(aiffChunk('COMM', common), ...extraChunks);
  if (includeSound) chunks.push(aiffChunk('SSND', sound));
  const body = Buffer.concat([Buffer.from(formType, 'ascii'), ...chunks]);
  const buffer = Buffer.alloc(body.length + 8);
  buffer.write('FORM', 0, 'ascii');
  buffer.writeUInt32BE(body.length, 4);
  body.copy(buffer, 8);
  return buffer;
}

function bmpWithPixelsPerMeter(xPixelsPerMeter) {
  const buffer = Buffer.alloc(46);
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(320, 18);
  buffer.writeInt32LE(240, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeInt32LE(xPixelsPerMeter, 38);
  buffer.writeInt32LE(xPixelsPerMeter, 42);
  return buffer;
}

function tiffWithXResolution(numerator, denominator, unit = 2, littleEndian = true) {
  const buffer = Buffer.alloc(70);
  const write16 = littleEndian ? 'writeUInt16LE' : 'writeUInt16BE';
  const write32 = littleEndian ? 'writeUInt32LE' : 'writeUInt32BE';
  buffer.write(littleEndian ? 'II' : 'MM', 0, 'ascii');
  buffer[write16](42, 2);
  buffer[write32](8, 4);
  buffer[write16](4, 8);
  const entries = [
    { tag: 256, type: 4, count: 1, value: 320 },
    { tag: 257, type: 4, count: 1, value: 240 },
    { tag: 282, type: 5, count: 1, value: 62 },
    { tag: 296, type: 3, count: 1, value: unit }
  ];
  entries.forEach((entry, index) => {
    const offset = 10 + index * 12;
    buffer[write16](entry.tag, offset);
    buffer[write16](entry.type, offset + 2);
    buffer[write32](entry.count, offset + 4);
    if (entry.type === 3) buffer[write16](entry.value, offset + 8);
    else buffer[write32](entry.value, offset + 8);
  });
  buffer[write32](0, 58);
  buffer[write32](numerator, 62);
  buffer[write32](denominator, 66);
  return buffer;
}

function tiffWithExifColorSpace(colorSpace, littleEndian = true, includeIccProfile = false, photometric = null) {
  const write16 = littleEndian ? 'writeUInt16LE' : 'writeUInt16BE';
  const write32 = littleEndian ? 'writeUInt32LE' : 'writeUInt32BE';
  const ifd0Entries = 1 + Number(includeIccProfile) + Number(photometric !== null);
  const exifIfdOffset = 8 + 2 + ifd0Entries * 12 + 4;
  const iccProfileOffset = exifIfdOffset + 18;
  const buffer = Buffer.alloc(iccProfileOffset + (includeIccProfile ? 4 : 0));
  buffer.write(littleEndian ? 'II' : 'MM', 0, 'ascii');
  buffer[write16](42, 2);
  buffer[write32](8, 4);
  buffer[write16](ifd0Entries, 8);
  buffer[write16](34665, 10);
  buffer[write16](4, 12);
  buffer[write32](1, 14);
  buffer[write32](exifIfdOffset, 18);
  let nextIfdEntry = 1;
  if (photometric !== null) {
    const offset = 10 + nextIfdEntry++ * 12;
    buffer[write16](262, offset);
    buffer[write16](3, offset + 2);
    buffer[write32](1, offset + 4);
    buffer[write16](photometric, offset + 8);
  }
  if (includeIccProfile) {
    const offset = 10 + nextIfdEntry * 12;
    buffer[write16](34675, offset);
    buffer[write16](7, offset + 2);
    buffer[write32](4, offset + 4);
    buffer[write32](iccProfileOffset, offset + 8);
  }
  buffer[write32](0, 10 + ifd0Entries * 12);
  buffer[write16](1, exifIfdOffset);
  buffer[write16](40961, exifIfdOffset + 2);
  buffer[write16](3, exifIfdOffset + 4);
  buffer[write32](1, exifIfdOffset + 6);
  buffer[write16](colorSpace, exifIfdOffset + 10);
  buffer[write32](0, exifIfdOffset + 14);
  if (includeIccProfile) buffer.write('ICC!', iccProfileOffset, 'ascii');
  return buffer;
}

function tiffWithPhotometricInterpretation(value, { type = 3, count = 1, duplicate = false, includeIccProfile = false } = {}) {
  const entryCount = 1 + Number(duplicate) + Number(includeIccProfile);
  const buffer = Buffer.alloc(8 + 2 + entryCount * 12 + 4);
  buffer.write('II', 0, 'ascii');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(entryCount, 8);
  const writeEntry = (index, tag, fieldType, fieldCount, fieldValue) => {
    const offset = 10 + index * 12;
    buffer.writeUInt16LE(tag, offset);
    buffer.writeUInt16LE(fieldType, offset + 2);
    buffer.writeUInt32LE(fieldCount, offset + 4);
    if (fieldType === 3) buffer.writeUInt16LE(fieldValue, offset + 8);
    else buffer.writeUInt32LE(fieldValue, offset + 8);
  };
  writeEntry(0, 262, type, count, value);
  if (duplicate) writeEntry(1, 262, 3, 1, value);
  if (includeIccProfile) writeEntry(entryCount - 1, 34675, 7, 4, 0);
  return buffer;
}

test('RIFF/WAVE PCM duration uses aligned sample data and permits trailing metadata chunks', () => {
  assert.equal(isWaveContainer(wavePcm()), true);
  assert.equal(parseWavePcmDuration(wavePcm()), 1);
  assert.equal(parseWavePcmDuration(wavePcm({ trailingChunk: 'JUNK' })), 1,
    'an empty ancillary chunk may follow the audio data');
  const metadata = Buffer.concat([wavePcm(), riffChunk('LIST', Buffer.from([0x49, 0x4e, 0x46]))]);
  metadata.writeUInt32LE(metadata.length - 8, 4);
  assert.equal(parseWavePcmDuration(metadata), 1, 'odd-length metadata and its RIFF pad byte may follow the audio data');
  assert.equal(parseWavePcmDuration(wavePcm({ sampleRate: 8000, channels: 2, bitsPerSample: 16, dataBytes: 32000 })), 1,
    'stereo 16-bit data is divided by the interleaved PCM byte rate');
  assert.equal(parseWavePcmDuration(wavePcm({ sampleRate: 44100, channels: 2, bitsPerSample: 16, dataBytes: 176400 })), 1,
    'common 44.1 kHz stereo PCM reports seconds as a scalar');
  assert.equal(parseWavePcmDuration(wavePcm({ dataBytes: 0 })), 0, 'a well-formed empty PCM data chunk has zero duration');
});

test('RIFF/WAVE duration rejects unsupported encodings, contradictory fmt fields, and malformed trailing chunks', () => {
  assert.equal(parseWavePcmDuration(wavePcm({ formatTag: 3 })), null, 'IEEE float is outside the integer PCM subset');
  assert.equal(parseWavePcmDuration(wavePcm({ formatTag: 0xfffe, fmtSize: 40 })), null, 'WAVE_FORMAT_EXTENSIBLE is not guessed');
  const dataFileLength = wavePcm().length;
  const malformedTail = Buffer.concat([wavePcm(), riffChunk('JUNK', Buffer.alloc(0))]);
  malformedTail.writeUInt32LE(malformedTail.length - 8, 4);
  malformedTail.writeUInt32LE(100, dataFileLength + 4);
  assert.equal(parseWavePcmDuration(malformedTail), null, 'a visible trailing chunk extending beyond RIFF is rejected');
  const duplicateData = Buffer.concat([wavePcm(), riffChunk('data', Buffer.from([0]))]);
  duplicateData.writeUInt32LE(duplicateData.length - 8, 4);
  assert.equal(parseWavePcmDuration(duplicateData), null, 'a second visible data chunk is rejected');
  assert.equal(parseWavePcmDuration(wavePcm({ bitsPerSample: 12 })), null, 'unsupported packed bit depths are rejected');

  const badByteRate = wavePcm();
  badByteRate.writeUInt32LE(1, 28);
  assert.equal(parseWavePcmDuration(badByteRate), null, 'nAvgBytesPerSec must equal sample rate times block alignment');
  const badBlockAlign = wavePcm();
  badBlockAlign.writeUInt16LE(2, 32);
  assert.equal(parseWavePcmDuration(badBlockAlign), null, 'nBlockAlign must agree with channels and sample width');
});

test('RIFF/WAVE duration rejects truncated buffers and container/data lengths beyond the file boundary', () => {
  const wave = wavePcm();
  assert.equal(isWaveContainer(Buffer.from('RIFF\x04\x00\x00\x00WAVE', 'binary')), true,
    'the container signature can protect an unsupported or incomplete WAVE from text decoding');
  assert.equal(isWaveContainer(Buffer.from('RIFFWAVE')), false);
  assert.equal(parseWavePcmDuration(wave.subarray(0, 43)), null, 'a truncated data header is ignored');
  assert.equal(parseWavePcmDuration(wave, wave.length - 1), null, 'declared RIFF length cannot exceed the opened file size');
  const oversizedRiff = Buffer.from(wave);
  oversizedRiff.writeUInt32LE(0xffffffff, 4);
  assert.equal(parseWavePcmDuration(oversizedRiff), null, '32-bit RIFF length overflow is rejected against file size');
  assert.equal(parseWavePcmDuration(Buffer.from('RF64\0\0\0\0WAVE')), null, 'RF64 requires a different ds64 size model');
  assert.equal(parseWavePcmDuration(null), null);
});

test('AIFF classic PCM duration uses COMM sample frames and the 80-bit sample rate', () => {
  const mono = aiffPcm();
  assert.equal(isAiffContainer(mono), true);
  assert.equal(parseAiffPcmDuration(mono), 1);
  assert.equal(parseAiffPcmDuration(aiffPcm({ channels: 2, sampleFrames: 44100, sampleBits: 24, sampleRate: 44100 })), 1,
    'interleaved stereo sample points are represented by sample frames, not bytes');
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 22050, sampleRate: 44100 })), 0.5);
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 0, sampleRate: 48000 })), 0,
    'a zero-frame AIFF reports zero duration');
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 0, sampleRate: 48000, includeSound: false })), 0,
    'the AIFF specification does not require SSND for a zero-frame sound');
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 1, sampleBits: 8, sampleRate: 1_000_000 })), 1 / 1_000_000,
    'the documented upper sample-rate bound is inclusive');
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 1, sampleBits: 8, offset: 4 })), 1 / 8000,
    'a declared SSND offset is skipped when the sample extent remains exact');
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 1, sampleBits: 8, extraChunks: [aiffChunk('ANNO', Buffer.from('ok'))] })), 1 / 8000,
    'bounded optional chunks before SSND are skipped');
});

test('AIFF-C reports duration only for the uncompressed NONE and byte-swapped sowt PCM types', () => {
  assert.equal(parseAiffPcmDuration(aiffPcm({ formType: 'AIFC' })), 1,
    'the standard NONE compression type stores uncompressed PCM');
  assert.equal(parseAiffPcmDuration(aiffPcm({
    formType: 'AIFC', compressionType: 'sowt', compressionName: '', channels: 2,
    sampleFrames: 44100, sampleBits: 24, sampleRate: 44100
  })), 1, 'sowt is byte-swapped PCM; the duration remains the sample-frame count divided by rate');
  assert.equal(parseAiffPcmDuration(aiffPcm({ formType: 'AIFC', compressionType: 'sowt', sampleFrames: 0, includeSound: false })), 0,
    'a valid empty AIFC PCM file does not require SSND');
});

test('AIFF duration refuses unsupported compression, malformed chunks, and inconsistent sample extents', () => {
  const compressed = aiffPcm({ formType: 'AIFC', compressionType: 'ulaw' });
  assert.equal(isAiffContainer(compressed), true, 'AIFF-C is classified as audio even when its codec is unsupported');
  assert.equal(parseAiffPcmDuration(compressed), null, 'compressed codecs are never inferred from sample-frame counts');
  assert.equal(parseAiffPcmDuration(aiffPcm({ formType: 'AIFC', compressionType: 'fl32', sampleBits: 32 })), null,
    'AIFC floating-point encodings are outside the integer PCM subset');
  assert.equal(parseAiffPcmDuration(aiffPcm({ formType: 'AIFC', includeVersion: false })), null,
    'AIFC requires exactly one recognized FVER chunk');
  assert.equal(parseAiffPcmDuration(aiffPcm({ formType: 'AIFC', version: 0 })), null,
    'unknown AIFC versions are not parsed');
  assert.equal(parseAiffPcmDuration(aiffPcm({ formType: 'AIFC', extraChunks: [aiffChunk('FVER', Buffer.from([0xa2, 0x80, 0x51, 0x40]))] })), null,
    'duplicate FVER chunks are rejected');
  const badCompressionNameLength = aiffPcm({ formType: 'AIFC' });
  badCompressionNameLength[54]--;
  assert.equal(parseAiffPcmDuration(badCompressionNameLength), null, 'COMM length must agree with its Pascal compression name');
  const badCompressionNamePad = aiffPcm({ formType: 'AIFC' });
  badCompressionNamePad[69] = 1;
  assert.equal(parseAiffPcmDuration(badCompressionNamePad), null, 'an odd-length compression name must use its specified zero pad');
  const malformedVersion = aiffPcm({ formType: 'AIFC' });
  malformedVersion.writeUInt32BE(3, 16);
  assert.equal(parseAiffPcmDuration(malformedVersion), null, 'FVER has exactly four data bytes');
  assert.equal(parseAiffPcmDuration(aiffPcm({ blockSize: 512 })), null, 'block-aligned sound data is outside this subset');
  assert.equal(parseAiffPcmDuration(aiffPcm({ sampleFrames: 0, sampleRate: 1_000_001 })), null,
    'sample rates above the local sanity bound are not used');
  const zeroRate = aiffPcm({ sampleFrames: 0 });
  zeroRate.writeUInt16BE(0, 28);
  zeroRate.writeBigUInt64BE(0n, 30);
  assert.equal(parseAiffPcmDuration(zeroRate), null, 'zero/unnormalized extended sample rates are rejected');
  const negativeRate = aiffPcm({ sampleFrames: 0 });
  negativeRate.writeUInt16BE(negativeRate.readUInt16BE(28) | 0x8000, 28);
  assert.equal(parseAiffPcmDuration(negativeRate), null, 'negative extended sample rates are rejected');

  const original = aiffPcm();
  const comm = original.subarray(12, 38);
  const soundChunkOffset = original.length - (8 + 8 + 8000 * 2);
  const duplicateBody = Buffer.concat([Buffer.from('AIFF', 'ascii'), comm, comm, original.subarray(soundChunkOffset)]);
  const duplicate = Buffer.alloc(duplicateBody.length + 8);
  duplicate.write('FORM', 0, 'ascii');
  duplicate.writeUInt32BE(duplicateBody.length, 4);
  duplicateBody.copy(duplicate, 8);
  assert.equal(parseAiffPcmDuration(duplicate), null, 'duplicate COMM chunks are rejected');

  const wrongSampleExtent = aiffPcm({ sampleFrames: 8, sampleBits: 16 });
  wrongSampleExtent.writeUInt32BE(1, 22);
  assert.equal(parseAiffPcmDuration(wrongSampleExtent), null, 'COMM frame count must match the SSND sample-byte extent');
  assert.equal(parseAiffPcmDuration(aiffPcm().subarray(0, -1)), null, 'a truncated FORM is rejected against actual file size');
  const valid = aiffPcm();
  assert.equal(parseAiffPcmDuration(valid, valid.length - 1), null, 'declared FORM size cannot exceed file size');
  assert.equal(parseAiffPcmDuration(Buffer.from('FORM\0\0\0\0AIFF')), null);
  assert.equal(parseAiffPcmDuration(null), null);
});

test('JPEG JFIF reports the horizontal density in pixels per inch', () => {
  assert.equal(parseImageDpi(jpegWithJfifResolution(1, 300, 150)), 300);
  assert.equal(parseImageDpi(jpegWithJfifResolution(2, 118, 59)), 118 * 2.54);
  assert.equal(parseImageDpi(jpegWithJfifResolution(0, 300)), null, 'aspect-ratio units do not imply physical DPI');
  assert.equal(parseImageDpi(jpegWithJfifResolution(1, 0)), null);
  assert.equal(parseImageDpi(jpegWithJfifResolution(1, 300).subarray(0, 12)), null, 'truncated APP0 is ignored');
  assert.equal(parseImageDpi(Buffer.concat([jpegWithJfifResolution(1, 300).subarray(0, 20), Buffer.from([0xff])])), 300,
    'a later incomplete segment does not invalidate previously verified JFIF density');
});

test('JPEG EXIF reports horizontal XResolution only with an explicit physical unit', () => {
  assert.equal(parseImageDpi(jpegWithSegments(jpegExifSegment(tiffWithXResolution(300, 1)))), 300);
  assert.equal(parseImageDpi(jpegWithSegments(jpegExifSegment(tiffWithXResolution(72, 1, 3)))), 72 * 2.54);
  assert.equal(parseImageDpi(jpegWithSegments(jpegExifSegment(tiffWithXResolution(300, 1, 2, false)))), 300, 'big-endian EXIF TIFF is supported');
  assert.equal(parseImageDpi(jpegWithSegments(jpegExifSegment(tiffWithXResolution(300, 1, 1)))), null, 'unitless EXIF resolution is not DPI');
  assert.equal(parseImageDpi(jpegWithSegments(jpegExifSegment(tiffWithXResolution(300, 0)))), null, 'zero rational denominator is rejected');
});

test('JPEG DPI prefers valid JFIF density and falls back to explicit EXIF resolution', () => {
  const exif = jpegExifSegment(tiffWithXResolution(240, 1));
  const jfifSegment = (units, density) => jpegWithJfifResolution(units, density).subarray(2, 20);
  assert.equal(parseImageDpi(jpegWithSegments(exif, jfifSegment(1, 300))), 300);
  assert.equal(parseImageDpi(jpegWithSegments(jfifSegment(0, 300), exif)), 240);
  assert.equal(parseImageDpi(jpegWithSegments(jfifSegment(1, 0), exif)), 240);
});

test('JPEG EXIF DPI rejects incomplete APP1 segments and TIFF offsets escaping the segment', () => {
  const exif = jpegExifSegment(tiffWithXResolution(300, 1));
  assert.equal(parseImageDpi(jpegWithSegments(exif.subarray(0, exif.length - 3))), null, 'a truncated APP1 segment is ignored');

  const escapedOffsetTiff = tiffWithXResolution(300, 1);
  escapedOffsetTiff.writeUInt32LE(0xfffffff0, 10 + 2 * 12 + 8);
  assert.equal(parseImageDpi(jpegWithSegments(jpegExifSegment(escapedOffsetTiff))), null, 'rational data cannot escape its APP1 segment');

  const wrongSignature = Buffer.from(exif);
  wrongSignature[4] = 0x58;
  assert.equal(parseImageDpi(jpegWithSegments(wrongSignature)), null, 'non-Exif APP1 data is not parsed as TIFF');
});

test('WebP EXIF chunk reports horizontal DPI from bounded RIFF metadata', () => {
  const tiff = tiffWithXResolution(300, 1);
  const oddExifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff, Buffer.from([0x7f])]);
  assert.equal(parseImageDpi(webpWithChunks(riffChunk('JUNK', Buffer.from([1, 2, 3])), riffChunk('EXIF', tiff))), 300,
    'raw TIFF EXIF payload is found after an odd-sized padded chunk');
  assert.equal(parseImageDpi(webpWithChunks(riffChunk('EXIF', oddExifPayload))), 300,
    'an optional Exif identifier and RIFF odd-byte padding are accepted');
  const oddChunk = webpWithChunks(riffChunk('EXIF', oddExifPayload));
  assert.equal(parseImageDpi(oddChunk.subarray(0, oddChunk.length - 1)), null, 'a missing RIFF pad byte makes the chunk incomplete');
  const invalidPadding = Buffer.from(oddChunk);
  invalidPadding[invalidPadding.length - 1] = 1;
  assert.equal(parseImageDpi(invalidPadding), null, 'RIFF padding must be zero');
  assert.equal(parseImageDpi(webpWithChunks(riffChunk('EXIF', tiffWithXResolution(72, 1, 3)))), 72 * 2.54,
    'centimeter resolution is converted to pixels per inch');
});

test('WebP EXIF DPI rejects malformed RIFF bounds, truncated chunks, and TIFF offsets escaping EXIF data', () => {
  const tiff = tiffWithXResolution(300, 1);
  const complete = webpWithChunks(riffChunk('EXIF', tiff));
  assert.equal(parseImageDpi(complete.subarray(0, complete.length - 1)), null, 'truncated payload is ignored');

  const escapedOffsetTiff = Buffer.from(tiff);
  escapedOffsetTiff.writeUInt32LE(0xfffffff0, 10 + 2 * 12 + 8);
  assert.equal(parseImageDpi(webpWithChunks(riffChunk('EXIF', escapedOffsetTiff))), null,
    'TIFF rational offsets cannot escape the EXIF chunk');

  const outsideDeclaredRiff = Buffer.from(complete);
  outsideDeclaredRiff.writeUInt32LE(4, 4);
  assert.equal(parseImageDpi(outsideDeclaredRiff), null, 'chunks beyond the declared RIFF extent are not inspected');

  const invalidChunkLength = Buffer.from(complete);
  invalidChunkLength.writeUInt32LE(0xffffffff, 16);
  assert.equal(parseImageDpi(invalidChunkLength), null, 'oversized chunk lengths are rejected');
});

test('PNG pHYs is reported only when its unit explicitly means pixels per meter', () => {
  assert.equal(parseImageDpi(pngWithPhysicalResolution(3780)), 3780 * 0.0254);
  assert.equal(parseImageDpi(pngWithPhysicalResolution(3780, 0)), null, 'unitless aspect ratio is not DPI');
  assert.equal(parseImageDpi(pngWithPhysicalResolution(0)), null);

  const malformed = pngWithPhysicalResolution(3780);
  malformed.writeUInt32BE(0xffffffff, 33);
  assert.equal(parseImageDpi(malformed), null, 'out-of-bounds chunk lengths are rejected without throwing');
  assert.equal(parseImageDpi(pngWithPhysicalResolution(3780).subarray(0, 45)), null, 'truncated pHYs data is ignored');
});

test('BMP resolution uses the horizontal pixels-per-meter header field', () => {
  assert.equal(parseImageDpi(bmpWithPixelsPerMeter(11811)), 11811 * 0.0254);
  assert.equal(parseImageDpi(bmpWithPixelsPerMeter(0)), null);
  assert.equal(parseImageDpi(bmpWithPixelsPerMeter(-100)), null);
  assert.equal(parseImageDpi(bmpWithPixelsPerMeter(11811).subarray(0, 45)), null);
});

test('classic TIFF requires a valid XResolution rational and an inch or centimeter unit', () => {
  assert.equal(parseImageDpi(tiffWithXResolution(300, 1)), 300);
  assert.equal(parseImageDpi(tiffWithXResolution(72, 1, 3)), 72 * 2.54);
  assert.equal(parseImageDpi(tiffWithXResolution(300, 1, 2, false)), 300, 'big-endian TIFF is supported');
  assert.equal(parseImageDpi(tiffWithXResolution(300, 1, 1)), null, 'unit 1 has no physical scale');
  assert.equal(parseImageDpi(tiffWithXResolution(300, 0)), null, 'zero rational denominators are rejected');
  assert.equal(parseImageDpi(tiffWithXResolution(300, 1).subarray(0, 65)), null, 'truncated rational data is ignored');
});

test('unknown, unsupported, and non-buffer inputs do not produce speculative DPI values', () => {
  assert.equal(parseImageDpi(null), null);
  assert.equal(parseImageDpi(Buffer.from('plain text')), null);
  assert.equal(parseImageDpi(Buffer.from('GIF89a\x10\x00\x10\x00', 'binary')), null);
  assert.equal(parseImageDpi(Buffer.from('RIFF\x18\x00\x00\x00WEBPVP8X', 'ascii')), null);
});

test('PNG reports explicit named color spaces or a validated generic color model before image data', () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    result.write(type, 4, 'ascii');
    data.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
    return result;
  };
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(640, 0);
  ihdrData.writeUInt32BE(480, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const pngWithHeader = (header, ...chunks) => Buffer.concat([signature, chunk('IHDR', header), ...chunks]);
  const png = (...chunks) => pngWithHeader(ihdrData, ...chunks);
  const srgb = intent => chunk('sRGB', Buffer.from([intent]));
  const cicp = (...values) => chunk('cICP', Buffer.from(values));
  const imageData = chunk('IDAT', Buffer.alloc(0));

  for (const [colorType, bitDepth, expected] of [
    [0, 1, 'Gray'], [0, 16, 'Gray'], [2, 8, 'RGB'], [2, 16, 'RGB'],
    [3, 1, 'RGB'], [3, 8, 'RGB'], [4, 8, 'Gray'], [4, 16, 'Gray'], [6, 8, 'RGB'], [6, 16, 'RGB']
  ]) {
    const header = Buffer.from(ihdrData);
    header[8] = bitDepth;
    header[9] = colorType;
    const palette = colorType === 3 ? [chunk('PLTE', Buffer.from([0, 0, 0]))] : [];
    assert.equal(parseImageColorSpace(pngWithHeader(header, ...palette, imageData)), expected,
      `color type ${colorType} with ${bitDepth}-bit samples has a generic ${expected} model`);
  }

  const indexedHeader = Buffer.from(ihdrData);
  indexedHeader[8] = 1;
  indexedHeader[9] = 3;
  assert.equal(parseImageColorSpace(pngWithHeader(indexedHeader, imageData)), null,
    'indexed-color PNG requires a preceding palette');
  assert.equal(parseImageColorSpace(pngWithHeader(indexedHeader, chunk('PLTE', Buffer.alloc(9)), imageData)), null,
    'indexed-color palette entries cannot exceed the selected bit depth');
  assert.equal(parseImageColorSpace(pngWithHeader(indexedHeader,
    chunk('PLTE', Buffer.from([0, 0, 0])), chunk('PLTE', Buffer.from([255, 255, 255])), imageData)), null,
  'duplicate palettes are rejected');
  const badPalette = chunk('PLTE', Buffer.from([0, 0, 0]));
  badPalette[badPalette.length - 1] ^= 1;
  assert.equal(parseImageColorSpace(pngWithHeader(indexedHeader, badPalette, imageData)), null,
    'palette CRC must verify before inferring RGB');
  const grayscaleHeader = Buffer.from(ihdrData);
  grayscaleHeader[9] = 0;
  assert.equal(parseImageColorSpace(pngWithHeader(grayscaleHeader, chunk('PLTE', Buffer.from([0, 0, 0])), imageData)), null,
    'grayscale PNG cannot contain a palette chunk');
  const invalidTruecolorDepth = Buffer.from(ihdrData);
  invalidTruecolorDepth[8] = 4;
  assert.equal(parseImageColorSpace(pngWithHeader(invalidTruecolorDepth, imageData)), null,
    'invalid color type and bit-depth combinations are not labeled');
  const badHeaderCrc = Buffer.from(png(imageData));
  badHeaderCrc[29] ^= 1;
  assert.equal(parseImageColorSpace(badHeaderCrc), null, 'the IHDR CRC must verify');
  assert.equal(parseImageColorSpace(png()), null, 'a model is not inferred before the first IDAT');

  for (let intent = 0; intent <= 3; intent++) {
    assert.equal(parseImageColorSpace(png(srgb(intent), imageData)), 'sRGB', `rendering intent ${intent} retains the same declared color space`);
  }
  assert.deepEqual(parseImageColorAttributes(png(srgb(0), imageData)), { model: 'RGB', profile: 'sRGB' });
  assert.equal(parseImageColorSpace(png(cicp(1, 13, 0, 1), imageData)), 'sRGB',
    'the explicit full-range BT.709 / sRGB-transfer CICP tuple identifies sRGB');
  assert.equal(parseImageColorSpace(png(cicp(12, 13, 0, 1), imageData)), 'Display P3',
    'the PNG Third Edition full-range Display P3 CICP example is identified by its exact tuple');
  assert.deepEqual(parseImageColorAttributes(png(cicp(12, 13, 0, 1), imageData)), { model: 'RGB', profile: 'Display P3' });
  assert.equal(parseImageColorSpace(png(cicp(12, 13, 0, 1), srgb(0), imageData)), 'Display P3',
    'higher-priority Display P3 CICP remains distinct from a lower-priority sRGB chunk');
  assert.equal(parseImageColorSpace(png(cicp(1, 1, 0, 1), srgb(0), imageData)), null,
    'higher-priority HDTV-transfer CICP is not mislabeled by a lower-priority sRGB chunk');
  assert.equal(parseImageColorSpace(png(cicp(12, 13, 0, 0), imageData)), null,
    'narrow-range Display P3 is not mislabeled as the registered full-range Display P3 encoding');
  assert.equal(parseImageColorSpace(png(cicp(12, 1, 0, 1), imageData)), null,
    'Display P3 primaries with a non-sRGB transfer are not mislabeled as Display P3');
  assert.equal(parseImageColorSpace(png(cicp(1, 13, 0, 0), imageData)), null,
    'narrow-range RGB is not mislabeled as full-range sRGB');
  assert.equal(parseImageColorSpace(png(cicp(1, 13, 1, 1), imageData)), null,
    'non-identity matrix coefficients are rejected for PNG RGB signaling');
  assert.equal(parseImageColorSpace(png(cicp(1, 13, 0, 1), cicp(1, 13, 0, 1), imageData)), null,
    'duplicate cICP chunks are rejected');
  assert.equal(parseImageColorSpace(png(chunk('PLTE', Buffer.alloc(3)), cicp(1, 13, 0, 1), imageData)), null,
    'cICP after PLTE violates PNG ordering');
  const badCicp = png(cicp(1, 13, 0, 1), imageData);
  badCicp[48] ^= 1;
  assert.equal(parseImageColorSpace(badCicp), null, 'the cICP chunk CRC must verify');
  assert.equal(parseImageColorSpace(png(cicp(1, 13, 0), imageData)), null,
    'truncated cICP values are ignored');
  assert.equal(parseImageColorSpace(png(cicp(1, 13, 0, 1))), null,
    'a bounded metadata prefix without IDAT is not enough to confirm a complete pre-IDAT declaration');
  assert.equal(parseImageColorSpace(png(chunk('gAMA', Buffer.alloc(4)), chunk('cHRM', Buffer.alloc(32)), imageData)), 'RGB',
    'gamma/chromaticity values do not create a named profile, but IHDR still establishes the generic RGB model');
  assert.equal(parseImageColorSpace(png(chunk('iCCP', Buffer.from([0])), imageData)), null,
    'an embedded ICC profile is not parsed or replaced by a generic model guess');
  assert.equal(parseImageColorSpace(png(srgb(0), chunk('iCCP', Buffer.from([0])), imageData)), null,
    'an ICC profile prevents labeling the stream from sRGB alone');
  assert.equal(parseImageColorSpace(png(srgb(0), chunk('cICP', Buffer.alloc(4)), imageData)), null,
    'a separate cICP declaration is not flattened to sRGB');
  assert.equal(parseImageColorSpace(png(chunk('PLTE', Buffer.alloc(3)), srgb(0), imageData)), null,
    'sRGB after PLTE violates the required metadata ordering');
  assert.equal(parseImageColorSpace(png(srgb(0), srgb(0), imageData)), null, 'duplicate sRGB chunks are rejected');
  assert.equal(parseImageColorSpace(png(srgb(4), imageData)), null, 'undefined rendering intents are rejected');
  assert.equal(parseImageColorSpace(png(chunk('sRGB', Buffer.alloc(0)), imageData)), null, 'wrong sRGB chunk length is rejected');

  const badCrc = png(srgb(0), imageData);
  badCrc[42] ^= 1;
  assert.equal(parseImageColorSpace(badCrc), null, 'the sRGB chunk CRC must verify');
  assert.equal(parseImageColorSpace(png(imageData, srgb(0))), 'RGB', 'metadata after IDAT cannot upgrade the generic model');
  assert.equal(parseImageColorSpace(png(srgb(0))), null, 'an unbounded pre-IDAT prefix is not enough to rule out a conflicting profile');
  const truncated = png(srgb(0), imageData).subarray(0, -2);
  assert.equal(parseImageColorSpace(truncated), null, 'truncated chunk data is ignored');
  assert.equal(parseImageColorSpace(null), null);
  assert.equal(parseImageColorSpace(Buffer.from('plain text')), null);
});

test('separates a known generic color model from a named image color profile', () => {
  assert.deepEqual(parseImageColorAttributes(tiffWithPhotometricInterpretation(2)), { model: 'RGB', profile: null });
  assert.deepEqual(parseImageColorAttributes(tiffWithPhotometricInterpretation(1)), { model: 'Gray', profile: null });
  assert.deepEqual(parseImageColorAttributes(tiffWithExifColorSpace(1)), { model: 'RGB', profile: 'sRGB' });
  assert.equal(parseImageColorAttributes(tiffWithPhotometricInterpretation(2, { includeIccProfile: true })), null,
    'an unsupported embedded ICC profile remains unknown rather than being labeled generically');
  assert.equal(parseImageColorAttributes(tiffWithExifColorSpace(65535)), null,
    'uncalibrated or reserved color-space values remain unknown');
  assert.equal(parseImageColorAttributes(Buffer.from('plain text')), null);
});

test('GIF reports a generic RGB model only after a complete first-frame palette and data envelope', () => {
  const palette = Buffer.from([0, 0, 0, 255, 255, 255]);
  const gif = ({ globalPalette = null, localPalette = null, extension = Buffer.alloc(0), backgroundIndex = 0,
    left = 0, top = 0, width = 8, height = 6, minimumCodeSize = 2, imageData = Buffer.from([2, 0x44, 0x01, 0]) } = {}) => {
    const header = Buffer.alloc(13);
    header.write('GIF89a', 0, 'ascii');
    header.writeUInt16LE(8, 6);
    header.writeUInt16LE(6, 8);
    header[10] = globalPalette ? 0x80 | (Math.log2(globalPalette.length / 3) - 1) : 0;
    header[11] = backgroundIndex;
    const descriptor = Buffer.alloc(10);
    descriptor[0] = 0x2c;
    descriptor.writeUInt16LE(left, 1);
    descriptor.writeUInt16LE(top, 3);
    descriptor.writeUInt16LE(width, 5);
    descriptor.writeUInt16LE(height, 7);
    descriptor[9] = localPalette ? 0x80 | (Math.log2(localPalette.length / 3) - 1) : 0;
    return Buffer.concat([
      header,
      globalPalette ?? Buffer.alloc(0),
      extension,
      descriptor,
      localPalette ?? Buffer.alloc(0),
      Buffer.from([minimumCodeSize]),
      imageData
    ]);
  };
  const commentExtension = Buffer.from([0x21, 0xfe, 3, 0x43, 0x6f, 0x74, 0]);

  assert.equal(parseImageColorSpace(gif({ globalPalette: palette })), 'RGB', 'a complete global RGB palette supports the generic model');
  assert.equal(parseImageColorSpace(gif({ localPalette: palette })), 'RGB', 'a complete first-frame local RGB palette works without a global palette');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette, localPalette: palette, extension: commentExtension })), 'RGB',
    'extension data blocks and a frame-local palette are bounded before labeling');
  assert.equal(parseImageColorSpace(gif()), null, 'an image frame without either active color table stays unknown');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette, imageData: Buffer.from([0]) })), null,
    'a frame with no non-empty image-data sub-block is not labeled');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette, imageData: Buffer.from([2, 2, 0x44, 0x01]) })), null,
    'an unterminated image-data sub-block sequence stays unknown');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette.subarray(0, -1) })), null, 'a truncated global color table is rejected');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette, backgroundIndex: 2 })), null,
    'a background index outside the declared global table is rejected');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette, left: 1, width: 8 })), null,
    'a first-frame rectangle extending beyond the logical screen is rejected');
  assert.equal(parseImageColorSpace(gif({ globalPalette: palette, minimumCodeSize: 1 })), null,
    'an out-of-range GIF LZW minimum code size is rejected');
  assert.equal(parseImageColorSpace(gif({ extension: Buffer.from([0x21, 0xfe, 4, 0x43]) })), null,
    'truncated extension sub-blocks are rejected');
  assert.equal(parseImageColorSpace(Buffer.from('GIF89a')), null, 'an incomplete logical screen descriptor is not labeled');
});

test('TIFF reports only explicit EXIF sRGB without an embedded ICC profile', () => {
  for (const littleEndian of [true, false]) {
    assert.equal(parseImageColorSpace(tiffWithExifColorSpace(1, littleEndian)), 'sRGB',
      `${littleEndian ? 'little' : 'big'}-endian TIFF EXIF sRGB is supported`);
  }
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(65535)), null,
    'uncalibrated EXIF is not labeled sRGB');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(2)), null,
    'reserved EXIF values are not interpreted as sRGB');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(1, true, true)), null,
    'a TIFF ICC profile suppresses a possibly conflicting EXIF label');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(1).subarray(0, 32)), null,
    'truncated TIFF EXIF IFDs are rejected');
});

test('TIFF reports only generic Gray or RGB models from valid PhotometricInterpretation tags', () => {
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(0)), 'Gray',
    'WhiteIsZero is a grayscale/bilevel model, not a named color profile');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(1)), 'Gray',
    'BlackIsZero is a grayscale/bilevel model, not a named color profile');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(0, { includeIccProfile: true })), null,
    'an ICC profile suppresses an inferred Gray model');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(1, { duplicate: true })), null,
    'duplicate grayscale photometric tags are rejected');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(2)), 'RGB',
    'PhotometricInterpretation=2 identifies the RGB model, not a specific profile');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(2, { includeIccProfile: true })), null,
    'an ICC profile may define a more specific or conflicting profile');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(3)), null,
    'palette color is not flattened to RGB without interpreting ColorMap');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(5)), null,
    'separated color is not assumed to be CMYK');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(6)), null,
    'YCbCr is not relabeled as RGB');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(2, { type: 4 })), null,
    'PhotometricInterpretation must be SHORT');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(2, { count: 2 })), null,
    'PhotometricInterpretation must contain exactly one value');
  assert.equal(parseImageColorSpace(tiffWithPhotometricInterpretation(2, { duplicate: true })), null,
    'duplicate PhotometricInterpretation tags are rejected');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(1, true, false, 0)), null,
    'a grayscale photometric model conflicts with an EXIF sRGB declaration');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(1, true, false, 1)), null,
    'BlackIsZero also conflicts with an EXIF sRGB declaration');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(65535, true, false, 2)), null,
    'uncalibrated EXIF does not fall back to a generic RGB label');
  assert.equal(parseImageColorSpace(tiffWithExifColorSpace(1, true, false, 2)), 'sRGB',
    'matching EXIF sRGB and TIFF RGB model preserve the more specific label');
});

test('JPEG reports EXIF sRGB only for a valid unconflicted ColorSpace declaration', () => {
  for (const littleEndian of [true, false]) {
    const jpeg = jpegWithSegments(jpegExifSegment(tiffWithExifColorSpace(1, littleEndian)));
    assert.equal(parseImageColorSpace(jpeg), 'sRGB', `${littleEndian ? 'little' : 'big'}-endian EXIF is supported`);
  }

  assert.equal(parseImageColorSpace(jpegWithSegments(jpegExifSegment(tiffWithExifColorSpace(65535)))), null,
    'uncalibrated EXIF does not imply sRGB');
  assert.equal(parseImageColorSpace(jpegWithSegments(jpegExifSegment(tiffWithExifColorSpace(2)))), null,
    'reserved EXIF values are not interpreted as sRGB');
  assert.equal(parseImageColorSpace(jpegWithSegments(jpegExifSegment(tiffWithExifColorSpace(1).subarray(0, 32)))), null,
    'truncated EXIF IFDs are rejected');

  const badPointer = tiffWithExifColorSpace(1);
  badPointer.writeUInt32LE(0xfffffff0, 18);
  assert.equal(parseImageColorSpace(jpegWithSegments(jpegExifSegment(badPointer))), null,
    'Exif IFD offsets cannot escape the APP1 segment');
  const wrongType = tiffWithExifColorSpace(1);
  wrongType.writeUInt16LE(4, 30);
  assert.equal(parseImageColorSpace(jpegWithSegments(jpegExifSegment(wrongType))), null,
    'ColorSpace must be one SHORT value');

  const iccPayload = Buffer.from('ICC_PROFILE\0\x01\x01', 'binary');
  const iccSegment = Buffer.alloc(iccPayload.length + 4);
  iccSegment.set([0xff, 0xe2]);
  iccSegment.writeUInt16BE(iccPayload.length + 2, 2);
  iccPayload.copy(iccSegment, 4);
  const exifSegment = jpegExifSegment(tiffWithExifColorSpace(1));
  assert.equal(parseImageColorSpace(jpegWithSegments(exifSegment, iccSegment)), null,
    'an embedded JPEG ICC profile suppresses a possibly conflicting EXIF label');
  assert.equal(parseImageColorSpace(jpegWithSegments(iccSegment, exifSegment)), null,
    'the ICC conflict is detected regardless of APP segment order');
  assert.equal(parseImageColorSpace(jpegWithSegments(exifSegment.subarray(0, -2))), null,
    'truncated APP1 metadata is not trusted');
});

test('JPEG conflicting EXIF ColorSpace declarations remain unknown', () => {
  const srgb = jpegExifSegment(tiffWithExifColorSpace(1));
  const uncalibrated = jpegExifSegment(tiffWithExifColorSpace(65535));
  assert.equal(parseImageColorSpace(jpegWithSegments(srgb, uncalibrated)), null);
});

test('JPEG exposes only a validated JFIF single-component Gray model without decoding image data', () => {
  assert.equal(parseImageColorAttributes(null), null, 'non-buffer input remains safely unknown');
  const grayJfif = jpegWithJfifFrame([1]);
  assert.equal(parseImageColorSpace(grayJfif), null, 'the legacy field remains reserved for previously recognized color-space labels');
  assert.deepEqual(parseImageColorAttributes(grayJfif), { model: 'Gray', profile: null });
  assert.equal(parseImageColorAttributes(jpegWithJfifFrame([1, 2, 3])), null,
    'three-component JFIF is YCbCr and is not mislabeled as RGB without decoding');
  assert.equal(parseImageColorAttributes(jpegWithJfifFrame([2])), null,
    'a non-standard grayscale component identifier remains unknown');
  assert.equal(parseImageColorAttributes(Buffer.concat([Buffer.from([0xff, 0xd8]), grayJfif.subarray(20)])), null,
    'the single-component frame is not treated as JFIF without its mandatory APP0 identifier');

  const badJfifLength = Buffer.from(grayJfif);
  badJfifLength.writeUInt16BE(15, 4);
  assert.equal(parseImageColorAttributes(badJfifLength), null, 'an undersized JFIF header is rejected');
  const truncatedFrame = grayJfif.subarray(0, -3);
  assert.equal(parseImageColorAttributes(truncatedFrame), null, 'a truncated SOF component specification is rejected');
});
