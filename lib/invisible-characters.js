const LINE_ENDING_CODE_POINTS = new Set([0x000a, 0x000d, 0x0085, 0x2028, 0x2029]);
const SPECIAL_FORMAT_CONTROLS = new Set([
  0x061c,
  0x200b, 0x200c, 0x200e, 0x200f,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2065,
  0x2066, 0x2067, 0x2068, 0x2069, 0x206a, 0x206b, 0x206c, 0x206d, 0x206e, 0x206f,
  0xfeff, 0xfff9, 0xfffa, 0xfffb
]);

function codePointLabel(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(codePoint <= 0xffff ? 4 : 6, '0')}`;
}

function presentation(category, glyph, width = 1, title = '') {
  return { category, glyph, width, ...(title ? { title } : {}) };
}

export function invisibleLineEndingPresentation(settings) {
  return settings?.showInvisibleNewLine ? presentation('line-ending', '↩') : null;
}

/** Return a visible replacement for a selected invisible scalar, or null when that category is hidden. */
export function invisibleCharacterPresentation(codePoint, settings) {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return null;

  if (LINE_ENDING_CODE_POINTS.has(codePoint)) return invisibleLineEndingPresentation(settings);
  if (codePoint === 0x0009) return settings?.showInvisibleTab ? presentation('tab', '→') : null;
  if (codePoint === 0x0020) return settings?.showInvisibleSpace ? presentation('space', '·') : null;

  if (codePoint === 0x00a0 || codePoint === 0x2007 || codePoint === 0x202f) {
    return settings?.showInvisibleWhitespaces ? presentation('other-whitespace', '·̂') : null;
  }
  if (codePoint === 0x3000) {
    return settings?.showInvisibleWhitespaces ? presentation('other-whitespace', '□', 2) : null;
  }
  if ((codePoint >= 0x2000 && codePoint <= 0x200a) || codePoint === 0x205f) {
    return settings?.showInvisibleWhitespaces ? presentation('other-whitespace', '⹀') : null;
  }

  const isC0Control = codePoint <= 0x001f && codePoint !== 0x0009 && codePoint !== 0x000a && codePoint !== 0x000d;
  const isDeleteOrC1Control = codePoint >= 0x007f && codePoint <= 0x009f && codePoint !== 0x0085;
  if (settings?.showInvisibleControl && (isC0Control || isDeleteOrC1Control || SPECIAL_FORMAT_CONTROLS.has(codePoint))) {
    const glyph = isC0Control ? String.fromCodePoint(0x2400 + codePoint) : codePoint === 0x007f ? '␡' : '◇';
    return presentation('control', glyph, 1, codePointLabel(codePoint));
  }

  return null;
}
