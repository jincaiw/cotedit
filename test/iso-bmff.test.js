import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isIsoBmffContainer, parseIsoBmffMovieAttributes } = require('../electron/iso-bmff.cjs');
const { atom, ftyp, isoBmffMovie } = require('./fixtures/iso-bmff.cjs');

test('ISO BMFF movie metadata reads movie duration and preferred display dimensions', () => {
  const movie = isoBmffMovie({ timescale: 1000, duration: 90_500, width: 1920, height: 1080 });
  assert.equal(isIsoBmffContainer(movie), true);
  assert.deepEqual(parseIsoBmffMovieAttributes(movie), {
    dimensions: { width: 1920, height: 1080 },
    durationSeconds: 90.5
  });
  const rotated = isoBmffMovie({ rotation: 90, width: 1920, height: 1080 });
  assert.deepEqual(parseIsoBmffMovieAttributes(rotated)?.dimensions, { width: 1080, height: 1920 },
    'the tkhd preferred transform is reflected in display dimensions');
});

test('ISO BMFF parser accepts version-1 headers and extended-size moov boxes', () => {
  const movie = isoBmffMovie({ version: 1, timescale: 48_000, duration: 4_800_000, extendedMoov: true });
  assert.deepEqual(parseIsoBmffMovieAttributes(movie), {
    dimensions: { width: 1920, height: 1080 },
    durationSeconds: 100
  });
});

test('ISO BMFF movie parser keeps unknown values unknown and ignores audio-only files', () => {
  const noDuration = isoBmffMovie({ timescale: 0 });
  assert.deepEqual(parseIsoBmffMovieAttributes(noDuration), {
    dimensions: { width: 1920, height: 1080 },
    durationSeconds: null
  });
  assert.equal(parseIsoBmffMovieAttributes(isoBmffMovie({ mediaType: 'soun' })), null,
    'an audio-only track is not mislabeled as a movie');
  assert.equal(parseIsoBmffMovieAttributes(isoBmffMovie({ duplicateMovieHeader: true }))?.durationSeconds, null,
    'ambiguous duplicate mvhd boxes do not produce a guessed duration');
});

test('ISO BMFF parser rejects malformed boxes, duplicate movie boxes, and metadata beyond the bounded prefix', () => {
  const movie = isoBmffMovie();
  assert.equal(parseIsoBmffMovieAttributes(movie.subarray(0, movie.length - 1), movie.length), null,
    'an incomplete moov box is not parsed');
  assert.equal(parseIsoBmffMovieAttributes(movie, movie.length - 1), null,
    'a moov box exceeding the actual file boundary is rejected');
  const duplicateMoov = Buffer.concat([movie, movie.subarray(movie.indexOf(Buffer.from('moov')) - 4)]);
  assert.equal(parseIsoBmffMovieAttributes(duplicateMoov), null);
  const corruptFtyp = ftyp();
  corruptFtyp.writeUInt32BE(0xfffffff0, 0);
  assert.equal(isIsoBmffContainer(corruptFtyp), false);
  assert.equal(parseIsoBmffMovieAttributes(Buffer.from('not a movie')), null);
  const invalidChild = atom('moov', Buffer.from([0, 0, 0, 2, 0x78, 0x78]));
  const malformed = Buffer.concat([ftyp(), invalidChild]);
  assert.equal(isIsoBmffContainer(malformed), true);
  assert.equal(parseIsoBmffMovieAttributes(malformed), null);
});
