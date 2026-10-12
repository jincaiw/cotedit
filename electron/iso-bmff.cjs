'use strict';

const MAX_BOXES = 4096;
const MAX_DISPLAY_DIMENSION = 1_000_000;

function safeFileSize(fileSize) {
  return Number.isSafeInteger(fileSize) && fileSize >= 0;
}

function parseBoxHeader(buffer, offset, parentEnd) {
  if (!Buffer.isBuffer(buffer) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(parentEnd)
      || offset < 0 || parentEnd - offset < 8 || offset + 8 > buffer.length) return null;

  const size32 = buffer.readUInt32BE(offset);
  const type = buffer.toString('ascii', offset + 4, offset + 8);
  let headerSize = 8;
  let size;
  if (size32 === 1) {
    if (parentEnd - offset < 16 || offset + 16 > buffer.length) return null;
    const extendedSize = buffer.readBigUInt64BE(offset + 8);
    if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(extendedSize);
    headerSize = 16;
  } else if (size32 === 0) {
    size = parentEnd - offset;
  } else {
    size = size32;
  }

  if (!Number.isSafeInteger(size) || size < headerSize || size > parentEnd - offset) return null;
  const end = offset + size;
  if (!Number.isSafeInteger(end)) return null;
  return { type, start: offset, payloadStart: offset + headerSize, end, headerSize };
}

function readChildBoxes(buffer, start, end) {
  if (!Buffer.isBuffer(buffer) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start < 0 || end < start || end > buffer.length) return null;
  const boxes = [];
  for (let offset = start; offset < end;) {
    if (boxes.length >= MAX_BOXES) return null;
    const box = parseBoxHeader(buffer, offset, end);
    if (!box || box.end <= offset) return null;
    boxes.push(box);
    offset = box.end;
  }
  return boxes;
}

function validFtypBox(buffer, box) {
  const payloadLength = box.end - box.payloadStart;
  if (box.type !== 'ftyp' || payloadLength < 8 || (payloadLength - 8) % 4 !== 0) return false;
  const availableEnd = Math.min(box.end, buffer.length);
  const brandRanges = [[box.payloadStart, box.payloadStart + 4]];
  for (let offset = box.payloadStart + 8; offset + 4 <= availableEnd; offset += 4) {
    brandRanges.push([offset, offset + 4]);
  }
  for (const [start, end] of brandRanges) {
    for (let offset = start; offset < end; offset++) {
      const byte = buffer[offset];
      if (byte < 0x20 || byte > 0x7e) return false;
    }
  }
  return true;
}

function isIsoBmffContainer(buffer, fileSize = buffer?.length) {
  if (!Buffer.isBuffer(buffer) || !safeFileSize(fileSize) || buffer.length < 16 || fileSize < 16) return false;
  const ftyp = parseBoxHeader(buffer, 0, fileSize);
  return Boolean(ftyp && ftyp.end <= fileSize && ftyp.payloadStart + 8 <= buffer.length && validFtypBox(buffer, ftyp));
}

function parseMovieDuration(buffer, box) {
  const length = box.end - box.payloadStart;
  if (length < 4) return null;
  const version = buffer[box.payloadStart];
  let timescale;
  let duration;
  if (version === 0) {
    if (length < 20) return null;
    timescale = buffer.readUInt32BE(box.payloadStart + 12);
    const rawDuration = buffer.readUInt32BE(box.payloadStart + 16);
    if (rawDuration === 0xffffffff) return null;
    duration = rawDuration;
  } else if (version === 1) {
    if (length < 32) return null;
    timescale = buffer.readUInt32BE(box.payloadStart + 20);
    const rawDuration = buffer.readBigUInt64BE(box.payloadStart + 24);
    if (rawDuration === 0xffffffffffffffffn || rawDuration > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    duration = Number(rawDuration);
  } else {
    return null;
  }
  if (!timescale) return null;
  const seconds = duration / timescale;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function parseTrackDimensions(buffer, box) {
  const length = box.end - box.payloadStart;
  if (length < 4) return null;
  const version = buffer[box.payloadStart];
  const matrixOffset = version === 0 ? 40 : version === 1 ? 52 : -1;
  if (matrixOffset < 0 || length < matrixOffset + 44) return null;
  const payload = box.payloadStart;
  const rawWidth = buffer.readUInt32BE(payload + matrixOffset + 36) / 65536;
  const rawHeight = buffer.readUInt32BE(payload + matrixOffset + 40) / 65536;
  if (!(rawWidth > 0) || !(rawHeight > 0)) return null;

  // tkhd's 16.16 affine coefficients include the preferred orientation transform.
  const a = buffer.readInt32BE(payload + matrixOffset) / 65536;
  const b = buffer.readInt32BE(payload + matrixOffset + 4) / 65536;
  const c = buffer.readInt32BE(payload + matrixOffset + 12) / 65536;
  const d = buffer.readInt32BE(payload + matrixOffset + 16) / 65536;
  const width = Math.round(Math.abs(a) * rawWidth + Math.abs(c) * rawHeight);
  const height = Math.round(Math.abs(b) * rawWidth + Math.abs(d) * rawHeight);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 1 || height < 1 || width > MAX_DISPLAY_DIMENSION || height > MAX_DISPLAY_DIMENSION) return null;
  return { width, height };
}

function parseHandlerType(buffer, mdia) {
  const boxes = readChildBoxes(buffer, mdia.payloadStart, mdia.end);
  if (!boxes) return null;
  const handlers = boxes.filter(box => box.type === 'hdlr');
  if (handlers.length !== 1) return null;
  const handler = handlers[0];
  if (handler.end - handler.payloadStart < 12 || buffer[handler.payloadStart] !== 0) return null;
  return buffer.toString('ascii', handler.payloadStart + 8, handler.payloadStart + 12);
}

function parseTrack(buffer, track) {
  const boxes = readChildBoxes(buffer, track.payloadStart, track.end);
  if (!boxes) return null;
  const headers = boxes.filter(box => box.type === 'tkhd');
  const mediaBoxes = boxes.filter(box => box.type === 'mdia');
  if (headers.length > 1 || mediaBoxes.length !== 1) return null;
  const handlerType = parseHandlerType(buffer, mediaBoxes[0]);
  if (handlerType === null) return null;
  if (handlerType !== 'vide') return { isVideo: false, dimensions: null };
  return {
    isVideo: true,
    dimensions: headers.length === 1 ? parseTrackDimensions(buffer, headers[0]) : null
  };
}

function parseMovieBox(buffer, moov) {
  const boxes = readChildBoxes(buffer, moov.payloadStart, moov.end);
  if (!boxes) return null;
  const movieHeaders = boxes.filter(box => box.type === 'mvhd');
  const durationSeconds = movieHeaders.length === 1 ? parseMovieDuration(buffer, movieHeaders[0]) : null;
  const videoTracks = [];
  for (const trackBox of boxes) {
    if (trackBox.type !== 'trak') continue;
    const track = parseTrack(buffer, trackBox);
    if (!track) return null;
    if (track.isVideo) videoTracks.push(track);
  }
  if (!videoTracks.length) return null;
  return {
    dimensions: videoTracks[0].dimensions,
    durationSeconds
  };
}

function parseIsoBmffMovieAttributes(buffer, fileSize = buffer?.length) {
  if (!isIsoBmffContainer(buffer, fileSize)) return null;
  const firstBox = parseBoxHeader(buffer, 0, fileSize);
  let offset = firstBox.end;
  let movieBox = null;
  let scanned = 0;
  while (offset < fileSize && offset < buffer.length) {
    if (scanned++ >= MAX_BOXES) return null;
    const box = parseBoxHeader(buffer, offset, fileSize);
    if (!box || box.end > buffer.length) return null;
    if (box.type === 'moov') {
      if (movieBox) return null;
      movieBox = box;
    }
    offset = box.end;
  }
  if (!movieBox) return null;
  return parseMovieBox(buffer, movieBox);
}

module.exports = { isIsoBmffContainer, parseIsoBmffMovieAttributes };
