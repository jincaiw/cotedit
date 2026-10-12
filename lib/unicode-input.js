const CODE_POINT_INPUT = /^(?:u\+|0x|\\u)?([0-9a-f]{1,6})$/i;
const MAX_UNICODE_CODE_POINT = 0x10ffff;
const SURROGATE_START = 0xd800;
const SURROGATE_END = 0xdfff;
export const MAX_RECENT_UNICODE_CODE_POINTS = 10;

function isUnicodeScalar(codePoint) {
  return Number.isSafeInteger(codePoint)
    && codePoint >= 0
    && codePoint <= MAX_UNICODE_CODE_POINT
    && (codePoint < SURROGATE_START || codePoint > SURROGATE_END);
}

/** Normalize a newest-first history of valid Unicode scalar values. */
export function normalizeRecentUnicodeCodePoints(value) {
  if (!Array.isArray(value)) return [];
  const recent = [];
  for (const codePoint of value) {
    if (!isUnicodeScalar(codePoint) || recent.includes(codePoint)) continue;
    recent.push(codePoint);
    if (recent.length === MAX_RECENT_UNICODE_CODE_POINTS) break;
  }
  return recent;
}

/** Record one successfully inserted scalar at the front of the bounded history. */
export function recordRecentUnicodeCodePoint(value, codePoint) {
  const recent = normalizeRecentUnicodeCodePoints(value);
  if (!isUnicodeScalar(codePoint)) return recent;
  return [codePoint, ...recent.filter(item => item !== codePoint)].slice(0, MAX_RECENT_UNICODE_CODE_POINTS);
}

/**
 * Parse CotEditor-style hexadecimal Unicode scalar input.
 * Accepts `U+1F600`, `0x1F600`, `\u1F600`, or bare hexadecimal digits.
 * Returns null for malformed input, surrogate code points, and values above U+10FFFF.
 */
export function parseUnicodeCodePoint(value) {
  if (typeof value !== 'string') return null;
  const match = CODE_POINT_INPUT.exec(value.trim());
  if (!match) return null;

  const codePoint = Number.parseInt(match[1], 16);
  if (codePoint > MAX_UNICODE_CODE_POINT || (codePoint >= SURROGATE_START && codePoint <= SURROGATE_END)) return null;
  return codePoint;
}

export function unicodeCharacterFromCodePointInput(value) {
  const codePoint = parseUnicodeCodePoint(value);
  return codePoint === null ? null : String.fromCodePoint(codePoint);
}
