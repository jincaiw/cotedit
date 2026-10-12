'use strict';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const AIFC_VERSION_1 = 0xa2805140;
const JPEG_START_OF_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function validImageDimensions(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    ? { width, height }
    : null;
}

function jpegImageDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length || marker === 0x00) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      return validImageDimensions(buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3));
    }
    offset += segmentLength;
  }
  return null;
}

function tiffImageDimensions(buffer) {
  if (buffer.length < 8) return null;
  const byteOrder = buffer.toString('ascii', 0, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return null;
  const littleEndian = byteOrder === 'II';
  const readUInt16 = offset => littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const readUInt32 = offset => littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  if (readUInt16(2) !== 42) return null;

  const ifdOffset = readUInt32(4);
  if (ifdOffset > buffer.length - 2) return null;
  const entryCount = readUInt16(ifdOffset);
  const entriesStart = ifdOffset + 2;
  const entriesEnd = entriesStart + entryCount * 12;
  if (!Number.isSafeInteger(entriesEnd) || entriesEnd + 4 > buffer.length) return null;

  let width = null;
  let height = null;
  for (let index = 0; index < entryCount; index++) {
    const entryOffset = entriesStart + index * 12;
    const tag = readUInt16(entryOffset);
    if (tag !== 256 && tag !== 257) continue;
    const type = readUInt16(entryOffset + 2);
    const count = readUInt32(entryOffset + 4);
    if (count !== 1) return null;
    let value;
    if (type === 1) value = buffer[entryOffset + 8];
    else if (type === 3) value = readUInt16(entryOffset + 8);
    else if (type === 4) value = readUInt32(entryOffset + 8);
    else return null;
    if (tag === 256) width = value;
    else height = value;
    if (width !== null && height !== null) return validImageDimensions(width, height);
  }
  return null;
}

function parseImageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)
      && buffer.readUInt32BE(8) === 13 && buffer.toString('ascii', 12, 16) === 'IHDR') {
    return validImageDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
  }
  if (buffer.length >= 10 && (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) {
    return validImageDimensions(buffer.readUInt16LE(6), buffer.readUInt16LE(8));
  }
  if (buffer.length >= 26 && buffer.toString('ascii', 0, 2) === 'BM') {
    const dibHeaderSize = buffer.readUInt32LE(14);
    if (dibHeaderSize === 12 && buffer.length >= 26) {
      return validImageDimensions(buffer.readUInt16LE(18), buffer.readUInt16LE(20));
    }
    if (dibHeaderSize >= 40 && buffer.length >= 30) {
      return validImageDimensions(Math.abs(buffer.readInt32LE(18)), Math.abs(buffer.readInt32LE(22)));
    }
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8X') {
      return validImageDimensions(1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3));
    }
    if (chunkType === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return validImageDimensions(buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
    }
    if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
      const width = 1 + ((b2 & 0x3f) << 8) + b1;
      const height = 1 + ((b4 & 0x0f) << 10) + (b3 << 2) + ((b2 & 0xc0) >> 6);
      return validImageDimensions(width, height);
    }
  }
  return tiffImageDimensions(buffer) || jpegImageDimensions(buffer);
}

function validDpi(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function pixelsPerMeterToDpi(value) {
  return Number.isInteger(value) && value > 0 ? validDpi(value * 0.0254) : null;
}

function pngImageDpi(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
      || buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    if (!Number.isSafeInteger(dataEnd) || dataEnd + 4 > buffer.length) return null;
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    if (chunkType === 'pHYs') {
      if (chunkLength !== 9 || buffer[dataStart + 8] !== 1) return null;
      return pixelsPerMeterToDpi(buffer.readUInt32BE(dataStart));
    }
    if (chunkType === 'IEND') return null;
    offset = dataEnd + 4;
  }
  return null;
}

function jpegImageDpi(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  let jfifDpi = null;
  let exifDpi = null;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) return jfifDpi ?? exifDpi;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length || marker === 0x00) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    const payloadStart = offset + 2;
    if (marker === 0xe0 && segmentLength >= 16 && buffer.toString('ascii', payloadStart, payloadStart + 5) === 'JFIF\0' && jfifDpi === null) {
      const units = buffer[payloadStart + 7];
      const xDensity = buffer.readUInt16BE(payloadStart + 8);
      if (units === 1) jfifDpi = validDpi(xDensity);
      else if (units === 2) jfifDpi = validDpi(xDensity * 2.54);
      if (jfifDpi !== null) return jfifDpi;
    } else if (marker === 0xe1 && segmentLength >= 8
        && buffer.toString('ascii', payloadStart, payloadStart + 6) === 'Exif\0\0'
        && exifDpi === null) {
      // Scope all TIFF offsets, including the XResolution rational, to this APP1 segment.
      exifDpi = tiffImageDpi(buffer.subarray(payloadStart + 6, offset + segmentLength));
    }
    offset += segmentLength;
  }
  return null;
}

function webpImageDpi(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF'
      || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const declaredEnd = buffer.readUInt32LE(4) + 8;
  if (declaredEnd < 12) return null;
  const scanEnd = Math.min(buffer.length, declaredEnd);
  for (let offset = 12; offset + 8 <= scanEnd;) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const nextOffset = dataEnd + (chunkLength & 1);
    if (!Number.isSafeInteger(nextOffset) || dataEnd > declaredEnd || dataEnd > scanEnd
        || nextOffset > declaredEnd || nextOffset > scanEnd) return null;
    if ((chunkLength & 1) && buffer[dataEnd] !== 0) return null;
    if (chunkType === 'EXIF') {
      let exif = buffer.subarray(dataStart, dataEnd);
      if (exif.length >= 6 && exif.toString('binary', 0, 6) === 'Exif\0\0') exif = exif.subarray(6);
      return tiffImageDpi(exif);
    }
    offset = nextOffset;
  }
  return null;
}

function bmpImageDpi(buffer) {
  if (buffer.length < 46 || buffer.toString('ascii', 0, 2) !== 'BM' || buffer.readUInt32LE(14) < 40) return null;
  return pixelsPerMeterToDpi(buffer.readInt32LE(38));
}

function tiffImageDpi(buffer) {
  if (buffer.length < 8) return null;
  const byteOrder = buffer.toString('ascii', 0, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return null;
  const littleEndian = byteOrder === 'II';
  const readUInt16 = offset => littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const readUInt32 = offset => littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  if (readUInt16(2) !== 42) return null;
  const ifdOffset = readUInt32(4);
  if (ifdOffset > buffer.length - 2) return null;
  const entryCount = readUInt16(ifdOffset);
  const entriesStart = ifdOffset + 2;
  const entriesEnd = entriesStart + entryCount * 12;
  if (!Number.isSafeInteger(entriesEnd) || entriesEnd + 4 > buffer.length) return null;

  let xResolution = null;
  let resolutionUnit = null;
  for (let index = 0; index < entryCount; index++) {
    const entryOffset = entriesStart + index * 12;
    const tag = readUInt16(entryOffset);
    const type = readUInt16(entryOffset + 2);
    const count = readUInt32(entryOffset + 4);
    if (tag === 282 && type === 5 && count === 1) {
      const rationalOffset = readUInt32(entryOffset + 8);
      if (rationalOffset > buffer.length - 8) return null;
      const numerator = readUInt32(rationalOffset);
      const denominator = readUInt32(rationalOffset + 4);
      if (!denominator) return null;
      xResolution = numerator / denominator;
    } else if (tag === 296 && type === 3 && count === 1) {
      resolutionUnit = readUInt16(entryOffset + 8);
    }
  }
  if (xResolution === null || (resolutionUnit !== 2 && resolutionUnit !== 3)) return null;
  return validDpi(xResolution * (resolutionUnit === 3 ? 2.54 : 1));
}

function pngChunkCrcMatches(buffer, typeOffset, dataEnd) {
  let crc = 0xffffffff;
  for (let offset = typeOffset; offset < dataEnd; offset++) {
    crc ^= buffer[offset];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0) === buffer.readUInt32BE(dataEnd);
}

function pngImageColorSpace(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
      || buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const allowedBitDepths = colorType === 0 ? [1, 2, 4, 8, 16]
    : colorType === 2 ? [8, 16]
      : colorType === 3 ? [1, 2, 4, 8]
        : colorType === 4 || colorType === 6 ? [8, 16] : [];
  if (width < 1 || height < 1 || !allowedBitDepths.includes(bitDepth)
      || buffer[26] !== 0 || buffer[27] !== 0 || buffer[28] > 1
      || !pngChunkCrcMatches(buffer, 12, 29)) return null;

  let offset = 33;
  let hasSrgb = false;
  let hasPalette = false;
  let hasCicp = false;
  let cicpColorSpace = null;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    if (!Number.isSafeInteger(dataEnd) || dataEnd + 4 > buffer.length) return null;
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    if (chunkType === 'IDAT') {
      if (colorType === 3 && !hasPalette) return null;
      if (hasCicp) return cicpColorSpace;
      if (hasSrgb) return 'sRGB';
      return colorType === 0 || colorType === 4 ? 'Gray' : 'RGB';
    }
    if (chunkType === 'IHDR') return null;
    if (chunkType === 'IEND') return null;
    if (chunkType === 'iCCP') return null;
    if (chunkType === 'PLTE') {
      const paletteEntries = chunkLength / 3;
      if (hasPalette || chunkLength === 0 || chunkLength > 768 || chunkLength % 3 !== 0
          || colorType === 0 || colorType === 4
          || (colorType === 3 && paletteEntries > 2 ** bitDepth)
          || !pngChunkCrcMatches(buffer, offset + 4, dataEnd)) return null;
      hasPalette = true;
    }
    if (chunkType === 'cICP') {
      if (hasPalette || hasCicp || chunkLength !== 4
          || !pngChunkCrcMatches(buffer, offset + 4, dataEnd) || buffer[dataStart + 2] !== 0 || buffer[dataStart + 3] > 1) return null;
      hasCicp = true;
      // PNG cICP: known full-range RGB signals use an identity matrix and sRGB transfer.
      if (buffer[dataStart + 1] === 13 && buffer[dataStart + 3] === 1) {
        if (buffer[dataStart] === 1) cicpColorSpace = 'sRGB';
        else if (buffer[dataStart] === 12) cicpColorSpace = 'Display P3';
      }
    }
    if (chunkType === 'sRGB') {
      if (hasPalette || hasSrgb || chunkLength !== 1 || buffer[dataStart] > 3
          || !pngChunkCrcMatches(buffer, offset + 4, dataEnd)) return null;
      hasSrgb = true;
    }
    offset = dataEnd + 4;
  }
  return null;
}

// CotEditor displays the horizontal resolution only; unknown or absent units stay undisclosed.
function parseImageDpi(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return pngImageDpi(buffer);
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegImageDpi(buffer);
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return webpImageDpi(buffer);
  if (buffer.toString('ascii', 0, 2) === 'BM') return bmpImageDpi(buffer);
  if (buffer.toString('ascii', 0, 2) === 'II' || buffer.toString('ascii', 0, 2) === 'MM') return tiffImageDpi(buffer);
  return null;
}

function isWaveContainer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
}

function isAiffContainer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'FORM') return false;
  const formType = buffer.toString('ascii', 8, 12);
  return formType === 'AIFF' || formType === 'AIFC';
}

function parseWavePcmDuration(buffer, fileSize = buffer?.length) {
  if (!isWaveContainer(buffer) || !Number.isSafeInteger(fileSize) || fileSize < 12) return null;
  const riffEnd = buffer.readUInt32LE(4) + 8;
  if (riffEnd < 12 || riffEnd > fileSize) return null;

  let format = null;
  let dataDuration = null;
  for (let offset = 12; offset + 8 <= buffer.length && offset + 8 <= riffEnd;) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const chunkEnd = dataEnd + (chunkLength & 1);
    if (!Number.isSafeInteger(chunkEnd) || dataEnd > riffEnd || chunkEnd > riffEnd || chunkEnd > fileSize) return null;

    if (chunkType === 'fmt ') {
      if (format || dataDuration !== null || (chunkLength !== 16 && chunkLength !== 18) || dataEnd > buffer.length) return null;
      if (chunkLength === 18 && buffer.readUInt16LE(dataStart + 16) !== 0) return null;
      const formatTag = buffer.readUInt16LE(dataStart);
      const channels = buffer.readUInt16LE(dataStart + 2);
      const sampleRate = buffer.readUInt32LE(dataStart + 4);
      const byteRate = buffer.readUInt32LE(dataStart + 8);
      const blockAlign = buffer.readUInt16LE(dataStart + 12);
      const bitsPerSample = buffer.readUInt16LE(dataStart + 14);
      if (formatTag !== 1 || channels < 1 || sampleRate < 1 || ![8, 16, 24, 32].includes(bitsPerSample)) return null;
      const expectedBlockAlign = channels * (bitsPerSample / 8);
      if (blockAlign !== expectedBlockAlign || byteRate !== sampleRate * blockAlign) return null;
      format = { blockAlign, byteRate };
    } else if (chunkType === 'data') {
      if (!format || dataDuration !== null || chunkLength % format.blockAlign !== 0) return null;
      const duration = chunkLength / format.byteRate;
      if (!Number.isFinite(duration) || duration < 0) return null;
      dataDuration = duration;
    }

    // PCM duration depends on this validated data extent, not on whether optional RIFF chunks follow it.
    // Do not read audio payload or extend the preview prefix just to inspect distant trailing metadata.
    if (chunkEnd > buffer.length) return dataDuration;
    offset = chunkEnd;
  }
  return dataDuration;
}

function extended80SampleRate(buffer, offset) {
  if (offset < 0 || offset + 10 > buffer.length) return null;
  const signExponent = buffer.readUInt16BE(offset);
  const sign = signExponent >>> 15;
  const exponent = signExponent & 0x7fff;
  const mantissa = buffer.readBigUInt64BE(offset + 2);
  if (sign !== 0 || exponent === 0 || exponent === 0x7fff || (mantissa & (1n << 63n)) === 0n) return null;
  const sampleRate = Number(mantissa) * (2 ** (exponent - 16383 - 63));
  return Number.isFinite(sampleRate) && sampleRate > 0 && sampleRate <= 1_000_000 ? sampleRate : null;
}

function parseAiffPcmDuration(buffer, fileSize = buffer?.length) {
  if (!isAiffContainer(buffer) || !Number.isSafeInteger(fileSize) || fileSize < 12) return null;
  const formType = buffer.toString('ascii', 8, 12);
  const isAifc = formType === 'AIFC';
  const formEnd = buffer.readUInt32BE(4) + 8;
  if (!Number.isSafeInteger(formEnd) || formEnd < 12 || formEnd > fileSize) return null;

  let offset = 12;
  let versionSeen = false;
  let common = null;
  let soundDataBytes = null;
  while (offset < formEnd) {
    if (offset + 8 > formEnd || offset + 8 > buffer.length) return null;
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkLength = buffer.readUInt32BE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const nextOffset = dataEnd + (chunkLength & 1);
    if (!Number.isSafeInteger(nextOffset) || dataEnd > formEnd || nextOffset > formEnd) return null;

    if (chunkType === 'FVER' && isAifc) {
      if (versionSeen || chunkLength !== 4 || dataEnd > buffer.length
          || buffer.readUInt32BE(dataStart) !== AIFC_VERSION_1) return null;
      versionSeen = true;
    } else if (chunkType === 'COMM') {
      if (common || dataEnd > buffer.length) return null;
      if (isAifc) {
        if (chunkLength < 24) return null;
        const compressionType = buffer.toString('ascii', dataStart + 18, dataStart + 22);
        const compressionNameLength = buffer[dataStart + 22];
        const unpaddedNameLength = compressionNameLength + 1;
        const paddedNameLength = unpaddedNameLength + (unpaddedNameLength & 1);
        if (chunkLength !== 22 + paddedNameLength || !['NONE', 'sowt'].includes(compressionType)) return null;
        const compressionNameStart = dataStart + 23;
        const compressionNameEnd = compressionNameStart + compressionNameLength;
        for (let index = compressionNameStart; index < compressionNameEnd; index++) {
          if (buffer[index] < 0x20 || buffer[index] === 0x7f) return null;
        }
        if (paddedNameLength !== unpaddedNameLength && buffer[compressionNameEnd] !== 0) return null;
      } else if (chunkLength !== 18) {
        return null;
      }
      const channels = buffer.readUInt16BE(dataStart);
      const sampleFrames = buffer.readUInt32BE(dataStart + 2);
      const sampleBits = buffer.readUInt16BE(dataStart + 6);
      const sampleRate = extended80SampleRate(buffer, dataStart + 8);
      if (channels < 1 || sampleBits < 1 || sampleBits > 32 || sampleRate === null) return null;
      common = { channels, sampleFrames, sampleBits, sampleRate };
    } else if (chunkType === 'SSND') {
      if (soundDataBytes !== null || chunkLength < 8 || dataStart + 8 > buffer.length) return null;
      const soundOffset = buffer.readUInt32BE(dataStart);
      const blockSize = buffer.readUInt32BE(dataStart + 4);
      if (blockSize !== 0 || soundOffset > chunkLength - 8) return null;
      soundDataBytes = chunkLength - 8 - soundOffset;
    }

    if (nextOffset > buffer.length) {
      if (nextOffset !== formEnd) return null;
      offset = nextOffset;
      break;
    }
    offset = nextOffset;
  }
  if (offset !== formEnd || !common || (isAifc && !versionSeen)) return null;

  const bytesPerSample = Math.ceil(common.sampleBits / 8);
  const expectedSoundDataBytes = common.sampleFrames * common.channels * bytesPerSample;
  if (!Number.isSafeInteger(expectedSoundDataBytes)) return null;
  if (common.sampleFrames > 0 && soundDataBytes === null) return null;
  if (soundDataBytes !== null && soundDataBytes !== expectedSoundDataBytes) return null;
  return common.sampleFrames / common.sampleRate;
}

function tiffExifColorSpace(buffer) {
  if (buffer.length < 8) return { status: 'invalid' };
  const byteOrder = buffer.toString('ascii', 0, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return { status: 'invalid' };
  const littleEndian = byteOrder === 'II';
  const readUInt16 = offset => littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const readUInt32 = offset => littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  if (readUInt16(2) !== 42) return { status: 'invalid' };

  const readIfd = (offset, readPhotometricInterpretation = false) => {
    if (!Number.isSafeInteger(offset) || offset < 8 || offset > buffer.length - 2) return null;
    const entryCount = readUInt16(offset);
    const entriesStart = offset + 2;
    const entriesEnd = entriesStart + entryCount * 12;
    if (!Number.isSafeInteger(entriesEnd) || entriesEnd + 4 > buffer.length) return null;
    let hasIccProfile = false;
    let photometricInterpretation = null;
    let foundPhotometricInterpretation = false;
    for (let index = 0; index < entryCount; index++) {
      const entryOffset = entriesStart + index * 12;
      const tag = readUInt16(entryOffset);
      if (tag === 34675) hasIccProfile = true;
      if (readPhotometricInterpretation && tag === 262) {
        if (foundPhotometricInterpretation || readUInt16(entryOffset + 2) !== 3 || readUInt32(entryOffset + 4) !== 1) return null;
        foundPhotometricInterpretation = true;
        photometricInterpretation = readUInt16(entryOffset + 8);
      }
    }
    return { entriesStart, entryCount, hasIccProfile, photometricInterpretation };
  };

  const ifd0 = readIfd(readUInt32(4), true);
  if (!ifd0) return { status: 'invalid' };
  let hasIccProfile = ifd0.hasIccProfile;
  let exifIfdOffset = null;
  for (let index = 0; index < ifd0.entryCount; index++) {
    const entryOffset = ifd0.entriesStart + index * 12;
    if (readUInt16(entryOffset) !== 34665) continue; // ExifIFDPointer
    if (exifIfdOffset !== null || readUInt16(entryOffset + 2) !== 4 || readUInt32(entryOffset + 4) !== 1) {
      return { status: 'invalid' };
    }
    exifIfdOffset = readUInt32(entryOffset + 8);
  }
  if (exifIfdOffset === null) return { status: 'none', hasIccProfile, photometricInterpretation: ifd0.photometricInterpretation };

  const exifIfd = readIfd(exifIfdOffset);
  if (!exifIfd) return { status: 'invalid' };
  hasIccProfile ||= exifIfd.hasIccProfile;
  let colorSpace = null;
  let found = false;
  for (let index = 0; index < exifIfd.entryCount; index++) {
    const entryOffset = exifIfd.entriesStart + index * 12;
    if (readUInt16(entryOffset) !== 40961) continue; // ColorSpace
    if (found || readUInt16(entryOffset + 2) !== 3 || readUInt32(entryOffset + 4) !== 1) {
      return { status: 'invalid' };
    }
    found = true;
    colorSpace = readUInt16(entryOffset + 8) === 1 ? 'sRGB' : null;
  }
  return found
    ? { status: 'found', colorSpace, hasIccProfile, photometricInterpretation: ifd0.photometricInterpretation }
    : { status: 'none', hasIccProfile, photometricInterpretation: ifd0.photometricInterpretation };
}

function tiffImageColorSpace(buffer) {
  const parsed = tiffExifColorSpace(buffer);
  if (parsed.status === 'invalid' || parsed.hasIccProfile) return null;
  if (parsed.status === 'found') {
    if (parsed.colorSpace !== 'sRGB' || (parsed.photometricInterpretation !== null && parsed.photometricInterpretation !== 2)) return null;
    return 'sRGB';
  }
  if (parsed.photometricInterpretation === 0 || parsed.photometricInterpretation === 1) return 'Gray';
  return parsed.photometricInterpretation === 2 ? 'RGB' : null;
}

function jpegExifColorSpace(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  let hasExifColorSpace = false;
  let exifColorSpace = null;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) return hasExifColorSpace ? exifColorSpace : null;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length || marker === 0x00) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    const payloadStart = offset + 2;
    if (marker === 0xe2 && segmentLength >= 14
        && buffer.toString('binary', payloadStart, payloadStart + 12) === 'ICC_PROFILE\0') return null;
    if (marker === 0xe1 && segmentLength >= 8
        && buffer.toString('ascii', payloadStart, payloadStart + 6) === 'Exif\0\0') {
      const parsed = tiffExifColorSpace(buffer.subarray(payloadStart + 6, offset + segmentLength));
      if (parsed.status === 'invalid') return null;
      if (parsed.status === 'found') {
        if (hasExifColorSpace && exifColorSpace !== parsed.colorSpace) return null;
        hasExifColorSpace = true;
        exifColorSpace = parsed.colorSpace;
      }
    }
    offset += segmentLength;
  }
  return null;
}

function jpegJfifGrayColorModel(buffer) {
  if (buffer.length < 20 || buffer[0] !== 0xff || buffer[1] !== 0xd8
      || buffer[2] !== 0xff || buffer[3] !== 0xe0
      || buffer.toString('binary', 6, 11) !== 'JFIF\0') return null;
  const jfifLength = buffer.readUInt16BE(4);
  if (jfifLength < 16 || 4 + jfifLength > buffer.length
      || buffer[11] !== 1 || buffer[12] > 2) return null;
  const thumbnailBytes = 3 * buffer[18] * buffer[19];
  if (jfifLength !== 16 + thumbnailBytes) return null;

  let offset = 4 + jfifLength;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length || marker === 0x00) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 11) return null;
      const precision = buffer[offset + 2];
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      const componentCount = buffer[offset + 7];
      if (precision !== 8 || width < 1 || height < 1 || componentCount !== 1 || segmentLength !== 8 + 3 * componentCount) return null;
      const componentOffset = offset + 8;
      if (buffer[componentOffset] !== 1 || buffer[componentOffset + 1] !== 0x11 || buffer[componentOffset + 2] > 3) return null;
      return 'Gray';
    }
    offset += segmentLength;
  }
  return null;
}

function gifImageColorSpace(buffer) {
  if (buffer.length < 13 || !['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return null;
  const screenWidth = buffer.readUInt16LE(6);
  const screenHeight = buffer.readUInt16LE(8);
  if (screenWidth < 1 || screenHeight < 1) return null;

  let offset = 13;
  let hasGlobalColorTable = (buffer[10] & 0x80) !== 0;
  if (hasGlobalColorTable) {
    const entryCount = 2 ** ((buffer[10] & 0x07) + 1);
    const tableLength = entryCount * 3;
    if (buffer[11] >= entryCount || offset + tableLength > buffer.length) return null;
    offset += tableLength;
  }

  while (offset < buffer.length) {
    const blockType = buffer[offset++];
    if (blockType === 0x3b) return null;
    if (blockType === 0x21) {
      if (offset >= buffer.length) return null;
      offset++; // Extension label; the generic data-sub-block envelope is shared by GIF extensions.
      let terminated = false;
      while (offset < buffer.length) {
        const blockLength = buffer[offset++];
        if (blockLength === 0) {
          terminated = true;
          break;
        }
        if (offset + blockLength > buffer.length) return null;
        offset += blockLength;
      }
      if (!terminated) return null;
      continue;
    }
    if (blockType !== 0x2c || offset + 9 > buffer.length) return null;

    const left = buffer.readUInt16LE(offset);
    const top = buffer.readUInt16LE(offset + 2);
    const width = buffer.readUInt16LE(offset + 4);
    const height = buffer.readUInt16LE(offset + 6);
    const imagePacked = buffer[offset + 8];
    if (width < 1 || height < 1 || left + width > screenWidth || top + height > screenHeight
        || (imagePacked & 0x18) !== 0) return null;
    offset += 9;

    const hasLocalColorTable = (imagePacked & 0x80) !== 0;
    if (hasLocalColorTable) {
      const entryCount = 2 ** ((imagePacked & 0x07) + 1);
      const tableLength = entryCount * 3;
      if (offset + tableLength > buffer.length) return null;
      offset += tableLength;
    }
    if (!hasGlobalColorTable && !hasLocalColorTable) return null;
    if (offset >= buffer.length) return null;

    const minimumCodeSize = buffer[offset++];
    if (minimumCodeSize < 2 || minimumCodeSize > 8) return null;
    let imageDataBytes = 0;
    while (offset < buffer.length) {
      const blockLength = buffer[offset++];
      if (blockLength === 0) return imageDataBytes > 0 ? 'RGB' : null;
      if (offset + blockLength > buffer.length) return null;
      imageDataBytes += blockLength;
      offset += blockLength;
    }
    return null;
  }
  return null;
}

function parseImageColorSpace(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return pngImageColorSpace(buffer);
  if (buffer.toString('ascii', 0, 3) === 'GIF') return gifImageColorSpace(buffer);
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegExifColorSpace(buffer);
  if (buffer.toString('ascii', 0, 2) === 'II' || buffer.toString('ascii', 0, 2) === 'MM') return tiffImageColorSpace(buffer);
  return null;
}

function parseImageColorAttributes(buffer) {
  const colorSpace = parseImageColorSpace(buffer);
  if (colorSpace === 'sRGB' || colorSpace === 'Display P3') {
    return { model: 'RGB', profile: colorSpace };
  }
  if (colorSpace === 'RGB' || colorSpace === 'Gray') {
    return { model: colorSpace, profile: null };
  }
  if (Buffer.isBuffer(buffer) && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const model = jpegJfifGrayColorModel(buffer);
    if (model) return { model, profile: null };
  }
  return null;
}

module.exports = { parseImageDimensions, parseImageDpi, parseImageColorSpace, parseImageColorAttributes, isWaveContainer, parseWavePcmDuration, isAiffContainer, parseAiffPcmDuration };
