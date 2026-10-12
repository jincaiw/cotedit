'use strict';

const path = require('node:path');
const { execFile } = require('node:child_process');
const { TextDecoder } = require('node:util');

const USER_TAGS_ATTRIBUTE = 'com.apple.metadata:_kMDItemUserTags';
const MAX_ATTRIBUTE_BYTES = 64 * 1024;
const MAX_OBJECTS = 256;
const MAX_TAGS = 32;
const MAX_TAG_NAME_LENGTH = 256;
const TAG_COLORS = ['none', 'gray', 'green', 'purple', 'blue', 'yellow', 'red', 'orange'];
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function readUnsignedInteger(buffer, offset, size) {
  if (!Number.isInteger(offset) || !Number.isInteger(size) || size < 1 || size > 8
      || offset < 0 || offset + size > buffer.length) return null;
  let value = 0;
  for (let index = offset; index < offset + size; index++) {
    const byte = buffer[index];
    if (value > Math.floor((Number.MAX_SAFE_INTEGER - byte) / 256)) return null;
    value = value * 256 + byte;
  }
  return value;
}

function readObjectLength(buffer, markerOffset, info, objectsEnd) {
  if (info < 0x0f) return { length: info, payloadOffset: markerOffset + 1 };
  const integerOffset = markerOffset + 1;
  if (integerOffset >= objectsEnd || buffer[integerOffset] >>> 4 !== 0x01) return null;
  const exponent = buffer[integerOffset] & 0x0f;
  if (exponent > 3) return null;
  const integerSize = 1 << exponent;
  const length = readUnsignedInteger(buffer, integerOffset + 1, integerSize);
  const payloadOffset = integerOffset + 1 + integerSize;
  if (length == null || payloadOffset > objectsEnd) return null;
  return { length, payloadOffset };
}

function readBinaryPlistStringArray(input) {
  if (!Buffer.isBuffer(input) || input.length < 40 || input.length > MAX_ATTRIBUTE_BYTES
      || input.subarray(0, 8).toString('ascii') !== 'bplist00') return null;

  const trailerOffset = input.length - 32;
  const offsetSize = input[trailerOffset + 6];
  const referenceSize = input[trailerOffset + 7];
  if (offsetSize < 1 || offsetSize > 8 || referenceSize < 1 || referenceSize > 8) return null;

  const objectCount = readUnsignedInteger(input, trailerOffset + 8, 8);
  const rootIndex = readUnsignedInteger(input, trailerOffset + 16, 8);
  const offsetTableOffset = readUnsignedInteger(input, trailerOffset + 24, 8);
  if (!objectCount || objectCount > MAX_OBJECTS || rootIndex == null || rootIndex >= objectCount
      || offsetTableOffset == null || offsetTableOffset < 8
      || offsetTableOffset + objectCount * offsetSize > trailerOffset) return null;

  const objectOffset = index => {
    if (!Number.isInteger(index) || index < 0 || index >= objectCount) return null;
    const offset = readUnsignedInteger(input, offsetTableOffset + index * offsetSize, offsetSize);
    return offset != null && offset >= 8 && offset < offsetTableOffset ? offset : null;
  };

  const rootOffset = objectOffset(rootIndex);
  if (rootOffset == null || input[rootOffset] >>> 4 !== 0x0a) return null;
  const arrayLength = readObjectLength(input, rootOffset, input[rootOffset] & 0x0f, offsetTableOffset);
  if (!arrayLength || arrayLength.length > MAX_TAGS
      || arrayLength.payloadOffset + arrayLength.length * referenceSize > offsetTableOffset) return null;

  const strings = [];
  for (let index = 0; index < arrayLength.length; index++) {
    const reference = readUnsignedInteger(input, arrayLength.payloadOffset + index * referenceSize, referenceSize);
    const stringOffset = objectOffset(reference);
    if (stringOffset == null) return null;

    const marker = input[stringOffset];
    const type = marker >>> 4;
    if (type !== 0x05 && type !== 0x06 && type !== 0x07) return null;
    const stringInfo = readObjectLength(input, stringOffset, marker & 0x0f, offsetTableOffset);
    if (!stringInfo) return null;
    const byteLength = type === 0x06 ? stringInfo.length * 2 : stringInfo.length;
    const end = stringInfo.payloadOffset + byteLength;
    if (!Number.isSafeInteger(byteLength) || end > offsetTableOffset) return null;

    const bytes = input.subarray(stringInfo.payloadOffset, end);
    let value;
    try {
      if (type === 0x05) {
        if (bytes.some(byte => byte > 0x7f)) return null;
        value = bytes.toString('ascii');
      } else if (type === 0x06) {
        if (bytes.length % 2) return null;
        const littleEndian = Buffer.allocUnsafe(bytes.length);
        for (let byte = 0; byte < bytes.length; byte += 2) {
          littleEndian[byte] = bytes[byte + 1];
          littleEndian[byte + 1] = bytes[byte];
        }
        value = littleEndian.toString('utf16le');
      } else {
        value = utf8Decoder.decode(bytes);
      }
    } catch {
      return null;
    }
    strings.push(value);
  }
  return strings;
}

/** Parse CotEditor-compatible Finder tag strings from a bounded binary plist array. */
function parseFinderTags(data) {
  const strings = readBinaryPlistStringArray(data);
  if (!strings) return [];
  const tags = [];
  for (const value of strings) {
    const components = value.split('\n').filter(Boolean);
    const name = components[0];
    if (!name || name.length > MAX_TAG_NAME_LENGTH) continue;
    const colorValue = components[1] == null ? -1 : Number(components[1]);
    const color = Number.isInteger(colorValue) && colorValue >= 0 && colorValue < TAG_COLORS.length
      ? TAG_COLORS[colorValue]
      : 'none';
    tags.push({ name, color });
  }
  return tags;
}

/** Read tags only on macOS; missing/unreadable attributes degrade to an empty list. */
function readFinderTags(filePath, { platform = process.platform, execFileImpl = execFile } = {}) {
  if (platform !== 'darwin') return Promise.resolve(null);
  if (typeof filePath !== 'string' || !filePath || filePath.length > 4096
      || filePath.includes('\0') || !path.isAbsolute(filePath)) return Promise.resolve([]);

  return new Promise(resolve => {
    try {
      execFileImpl('/usr/bin/xattr', ['-p', USER_TAGS_ATTRIBUTE, filePath], {
        encoding: null,
        timeout: 1000,
        maxBuffer: MAX_ATTRIBUTE_BYTES,
        windowsHide: true
      }, (error, stdout) => resolve(error ? [] : parseFinderTags(stdout)));
    } catch {
      resolve([]);
    }
  });
}

module.exports = { MAX_ATTRIBUTE_BYTES, MAX_TAGS, parseFinderTags, readFinderTags };
