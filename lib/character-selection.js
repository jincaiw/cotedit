import { countCharacters } from './document.js';

import { hasIndicConjunctBreak } from './unicode-incb.js';

const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;
const GRAPHEME_EXTEND = /^\p{Grapheme_Extend}$/u;
const EXTENDED_PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;

function isRegionalIndicator(codePoint) {
  return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
}

/** Return whether a bounded context begins in a contiguous regional-indicator run. */
export function startsInsideRegionalIndicatorRun(previousContext = '', context = '') {
  const previousCodePoint = Array.from(String(previousContext)).at(-1)?.codePointAt(0);
  const firstCodePoint = String(context).codePointAt(0);
  return isRegionalIndicator(previousCodePoint) && isRegionalIndicator(firstCodePoint);
}

function previousCodePoint(text, offset) {
  let start = offset - 1;
  const lastUnit = text.charCodeAt(start);
  if (lastUnit >= 0xdc00 && lastUnit <= 0xdfff && start > 0) {
    const previousUnit = text.charCodeAt(start - 1);
    if (previousUnit >= 0xd800 && previousUnit <= 0xdbff) start--;
  }
  return { from: start, codePoint: text.codePointAt(start) };
}

function hasUnicodeProperty(codePoint, property) {
  return Number.isInteger(codePoint) && property.test(String.fromCodePoint(codePoint));
}

/** Return whether a bounded context cuts an existing GB11 emoji ZWJ prefix. */
export function startsInsideExtendedPictographicZwjSequence(documentText = '', contextFrom = 0) {
  const text = String(documentText);
  const from = Number(contextFrom);
  if (!Number.isInteger(from) || from <= 0 || from >= text.length) return false;

  let extendRunFrom = from;
  while (extendRunFrom > 0) {
    const previous = previousCodePoint(text, extendRunFrom);
    if (!hasUnicodeProperty(previous.codePoint, GRAPHEME_EXTEND)) break;
    extendRunFrom = previous.from;
  }
  const preceding = previousCodePoint(text, extendRunFrom);
  if (!hasUnicodeProperty(preceding.codePoint, EXTENDED_PICTOGRAPHIC)) return false;

  let cursor = from;
  while (cursor < text.length) {
    const codePoint = text.codePointAt(cursor);
    if (!hasUnicodeProperty(codePoint, GRAPHEME_EXTEND)) break;
    cursor += codePoint > 0xFFFF ? 2 : 1;
  }
  if (text.codePointAt(cursor) !== 0x200D) return false;
  cursor++;
  return hasUnicodeProperty(text.codePointAt(cursor), EXTENDED_PICTOGRAPHIC);
}

/** Return whether a bounded context cuts a valid Unicode 17 GB9c prefix. */
export function startsInsideIndicConjunctSequence(documentText = '', contextFrom = 0, selectionFrom = contextFrom) {
  const text = String(documentText);
  const from = Number(contextFrom);
  const target = Number(selectionFrom);
  if (!Number.isInteger(from) || !Number.isInteger(target) || from <= 0
      || target <= from || target >= text.length) return false;

  const selectedCodePoint = text.codePointAt(target);
  if (!hasIndicConjunctBreak(selectedCodePoint, 'Consonant')) return false;

  let cursor = target;
  let hasLinker = false;
  while (cursor > 0) {
    const previous = previousCodePoint(text, cursor);
    if (hasIndicConjunctBreak(previous.codePoint, 'Linker')) hasLinker = true;
    else if (!hasIndicConjunctBreak(previous.codePoint, 'Extend')) break;
    cursor = previous.from;
  }
  if (cursor === 0 || !hasLinker) return false;

  const precedingConsonant = previousCodePoint(text, cursor);
  return precedingConsonant.from < from
    && hasIndicConjunctBreak(precedingConsonant.codePoint, 'Consonant');
}

function regionalIndicatorContextPrefix(text, contextFrom) {
  if (contextFrom === 0 || !isRegionalIndicator(text.codePointAt(contextFrom))) return '';
  let cursor = contextFrom;
  let precedingCount = 0;
  while (cursor > 0) {
    const previous = previousCodePoint(text, cursor);
    if (!isRegionalIndicator(previous.codePoint)) break;
    precedingCount++;
    cursor = previous.from;
  }
  return precedingCount % 2 ? String.fromCodePoint(0x1f1e6) : '';
}

/** Check one grapheme using a bounded context while preserving regional-indicator pairing. */
export function getSingleGraphemeSelectionInText(documentText = '', from = 0, to = from, rangeCount = 1) {
  const text = String(documentText);
  const start = Number(from);
  const end = Number(to);
  if (rangeCount !== 1 || !Number.isInteger(start) || !Number.isInteger(end)
      || start < 0 || end <= start || end > text.length) return null;

  let contextFrom = Math.max(0, start - 16);
  if (contextFrom > 0) {
    const firstUnit = text.charCodeAt(contextFrom);
    const previousUnit = text.charCodeAt(contextFrom - 1);
    if (firstUnit >= 0xdc00 && firstUnit <= 0xdfff && previousUnit >= 0xd800 && previousUnit <= 0xdbff) {
      contextFrom--;
    }
  }
  let contextTo = Math.min(text.length, end + 16);
  if (contextTo < text.length) {
    const nextUnit = text.charCodeAt(contextTo);
    const previousUnit = text.charCodeAt(contextTo - 1);
    if (nextUnit >= 0xdc00 && nextUnit <= 0xdfff && previousUnit >= 0xd800 && previousUnit <= 0xdbff) {
      contextTo++;
    }
  }

  if (startsInsideExtendedPictographicZwjSequence(text, contextFrom)) {
    const selected = getSingleGraphemeSelection(text, start, end, rangeCount);
    return selected ? { from: start, to: end, text: selected.text } : null;
  }

  if (startsInsideIndicConjunctSequence(text, contextFrom, start)) {
    const selected = getSingleGraphemeSelection(text, start, end, rangeCount);
    return selected ? { from: start, to: end, text: selected.text } : null;
  }

  const prefix = regionalIndicatorContextPrefix(text, contextFrom);
  const context = prefix + text.slice(contextFrom, contextTo);
  const relativeFrom = prefix.length + start - contextFrom;
  const relativeTo = prefix.length + end - contextFrom;
  const selected = getSingleGraphemeSelection(context, relativeFrom, relativeTo, rangeCount);
  return selected ? { from: start, to: end, text: selected.text } : null;
}

/** Return one complete grapheme selection from a text context, or null. */
export function getSingleGraphemeSelection(context = '', from = 0, to = from, rangeCount = 1) {
  const text = String(context);
  const start = Number(from);
  const end = Number(to);
  if (rangeCount !== 1 || !Number.isInteger(start) || !Number.isInteger(end)
      || start < 0 || end <= start || end > text.length) return null;

  const selected = text.slice(start, end);
  if (countCharacters(selected) !== 1) return null;
  if (segmenter) {
    const segment = [...segmenter.segment(text)].find(item => item.index === start);
    if (!segment || segment.index + segment.segment.length !== end) return null;
  }
  return { from: start, to: end, text: selected };
}
