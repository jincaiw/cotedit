function boundedInteger(value, fallback, minimum, maximum) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

/** Count leading spaces and tab stops as editor columns; stop at the first non-indent character. */
export function leadingIndentColumns(text, tabWidth = 4) {
  if (typeof text !== 'string') return 0;
  const size = boundedInteger(tabWidth, 4, 1, 99);
  let columns = 0;
  for (const character of text) {
    if (character === ' ') columns++;
    else if (character === '\t') columns += size - (columns % size);
    else break;
  }
  return columns;
}

/**
 * Build a CSS line style that keeps soft-wrapped continuation rows aligned with
 * the first non-indent character, plus an optional width measured in spaces.
 */
export function hangingIndentLineStyle(text, {
  tabWidth = 4,
  hangingIndentWidth = 0,
  spaceWidth = 0,
  basePadding = 5,
  contentWidth = Infinity,
  direction = 'ltr'
} = {}) {
  const width = boundedInteger(hangingIndentWidth, 0, 0, 99);
  const columns = leadingIndentColumns(text, tabWidth) + width;
  if (columns <= 0 || !Number.isFinite(spaceWidth) || spaceWidth <= 0) return null;

  const inset = columns * spaceWidth;
  const padding = Math.max(0, Number.isFinite(basePadding) ? basePadding : 5);
  if (Number.isFinite(contentWidth) && contentWidth > 0 && padding + inset + 2 * spaceWidth >= contentWidth) return null;

  const cssNumber = value => String(Number(value.toFixed(3)));
  const continuationInset = cssNumber(inset);
  const paddedInset = cssNumber(padding + inset);
  return direction === 'rtl'
    ? `padding-left:0px;padding-right:${paddedInset}px;text-indent:-${continuationInset}px;`
    : `padding-left:${paddedInset}px;padding-right:0px;text-indent:-${continuationInset}px;`;
}
