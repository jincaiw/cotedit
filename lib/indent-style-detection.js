export const MAX_INDENT_STYLE_SAMPLE_CODE_UNITS = 1_000_000;
export const MAX_INDENT_STYLE_SAMPLE_LINES = 10_000;
export const MIN_INDENT_STYLE_LINES = 2;

/** Detect a clear leading-whitespace style from a bounded prefix of a document. */
export function detectIndentStyle(text = '', options = {}) {
  const source = String(text ?? '');
  const requestedCodeUnits = options.maxCodeUnits;
  const requestedLines = options.maxLines;
  const maxCodeUnits = Number.isSafeInteger(requestedCodeUnits) && requestedCodeUnits > 0
    ? Math.min(requestedCodeUnits, MAX_INDENT_STYLE_SAMPLE_CODE_UNITS)
    : MAX_INDENT_STYLE_SAMPLE_CODE_UNITS;
  const maxLines = Number.isSafeInteger(requestedLines) && requestedLines > 0
    ? Math.min(requestedLines, MAX_INDENT_STYLE_SAMPLE_LINES)
    : MAX_INDENT_STYLE_SAMPLE_LINES;
  const sample = source.slice(0, maxCodeUnits);
  let spaces = 0;
  let tabs = 0;
  let cursor = 0;
  let lineCount = 0;

  while (cursor <= sample.length && lineCount < maxLines) {
    let lineEnd = sample.indexOf('\n', cursor);
    const carriageReturn = sample.indexOf('\r', cursor);
    if (carriageReturn !== -1 && (lineEnd === -1 || carriageReturn < lineEnd)) lineEnd = carriageReturn;
    if (lineEnd === -1) lineEnd = sample.length;
    const line = sample.slice(cursor, lineEnd);
    lineCount++;
    const match = /^([ \t]+)\S/u.exec(line);
    if (match) {
      const prefix = match[1];
      const hasSpaces = prefix.includes(' ');
      const hasTabs = prefix.includes('\t');
      if (hasSpaces !== hasTabs) {
        if (hasSpaces) spaces++;
        else tabs++;
      }
    }

    if (lineEnd === sample.length) break;
    cursor = lineEnd + 1;
    if (sample[lineEnd] === '\r' && sample[cursor] === '\n') cursor++;
  }

  if (spaces >= MIN_INDENT_STYLE_LINES && spaces > tabs) return 'spaces';
  if (tabs >= MIN_INDENT_STYLE_LINES && tabs > spaces) return 'tabs';
  return null;
}

/** Resolve whether Tab inserts soft spaces, a literal tab, or the syntax default. */
export function resolveTabInsertionMode(detectedIndentStyle, autoExpandTab, syntaxIndent = 'tab') {
  if (detectedIndentStyle === 'spaces') return 'soft-tabs';
  if (detectedIndentStyle === 'tabs') return 'tab';
  if (autoExpandTab === true) return 'soft-tabs';
  return syntaxIndent === 'tab' ? 'tab' : 'syntax';
}

/** Reflect the detected per-document choice in the existing Use Spaces menu item. */
export function effectiveAutoExpandTab(detectedIndentStyle, fallback = false) {
  if (detectedIndentStyle === 'spaces') return true;
  if (detectedIndentStyle === 'tabs') return false;
  return fallback === true;
}
