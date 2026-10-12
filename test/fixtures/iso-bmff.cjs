'use strict';

function atom(type, payload, { extended = false } = {}) {
  const headerSize = extended ? 16 : 8;
  const buffer = Buffer.alloc(headerSize + payload.length);
  if (extended) {
    buffer.writeUInt32BE(1, 0);
    buffer.write(type, 4, 'ascii');
    buffer.writeBigUInt64BE(BigInt(buffer.length), 8);
  } else {
    buffer.writeUInt32BE(buffer.length, 0);
    buffer.write(type, 4, 'ascii');
  }
  payload.copy(buffer, headerSize);
  return buffer;
}

function ftyp(majorBrand = 'isom', compatibleBrands = ['isom', 'mp42']) {
  const payload = Buffer.alloc(8 + compatibleBrands.length * 4);
  payload.write(majorBrand, 0, 'ascii');
  payload.writeUInt32BE(0, 4);
  compatibleBrands.forEach((brand, index) => payload.write(brand, 8 + index * 4, 'ascii'));
  return atom('ftyp', payload);
}

function movieHeader({ version = 0, timescale = 1000, duration = 90000 } = {}) {
  const payload = Buffer.alloc(version === 1 ? 112 : 100);
  payload.writeUInt32BE(version << 24, 0);
  if (version === 0) {
    payload.writeUInt32BE(timescale, 12);
    payload.writeUInt32BE(duration, 16);
  } else {
    payload.writeUInt32BE(timescale, 20);
    payload.writeBigUInt64BE(BigInt(duration), 24);
  }
  return atom('mvhd', payload);
}

function trackHeader({ version = 0, width = 1920, height = 1080, rotation = 0 } = {}) {
  const payload = Buffer.alloc(version === 1 ? 96 : 84);
  payload.writeUInt32BE((version << 24) | 7, 0);
  const matrixOffset = version === 0 ? 40 : 52;
  const matrices = rotation === 90
    ? [0, 65536, 0, -65536, 0, 0, 0, 0, 0x40000000]
    : [65536, 0, 0, 0, 65536, 0, 0, 0, 0x40000000];
  matrices.forEach((value, index) => payload.writeInt32BE(value, matrixOffset + index * 4));
  payload.writeUInt32BE(width * 65536, matrixOffset + 36);
  payload.writeUInt32BE(height * 65536, matrixOffset + 40);
  return atom('tkhd', payload);
}

function handler(type = 'vide') {
  const payload = Buffer.alloc(24);
  payload.writeUInt32BE(0, 0);
  payload.write(type, 8, 'ascii');
  return atom('hdlr', payload);
}

function track({ mediaType = 'vide', version = 0, width = 1920, height = 1080, rotation = 0, includeTrackHeader = true } = {}) {
  const mdia = atom('mdia', handler(mediaType));
  const children = includeTrackHeader ? [trackHeader({ version, width, height, rotation }), mdia] : [mdia];
  return atom('trak', Buffer.concat(children));
}

function isoBmffMovie({ version = 0, timescale = 1000, duration = 90000, width = 1920, height = 1080, rotation = 0, mediaType = 'vide', extendedMoov = false, duplicateMovieHeader = false, beforeMoov = [] } = {}) {
  const children = [movieHeader({ version, timescale, duration })];
  if (duplicateMovieHeader) children.push(movieHeader({ version, timescale, duration }));
  children.push(track({ mediaType, version, width, height, rotation }));
  const moov = atom('moov', Buffer.concat(children), { extended: extendedMoov });
  return Buffer.concat([ftyp(), ...beforeMoov, moov]);
}

module.exports = { atom, ftyp, isoBmffMovie };
