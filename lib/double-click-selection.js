import { EditorSelection } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { findEnclosingSymbolRange } from './text-tools.js';
import { isSingleGrapheme } from './unicode-grapheme.js';

const STANDARD_QUOTE_CHARACTERS = new Set(['"', "'", '`']);
const PAIR_SEARCH_MARGIN = 50_000;
const GRAPHEME_BOUNDARY_CONTEXT = 4_096;
const pairSearchGraphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('und', { granularity: 'grapheme' })
  : null;

export function findEnclosingSymbolRangeNearPosition(document, position) {
  if (!Number.isSafeInteger(document?.length) || !Number.isSafeInteger(position)
    || position < 0 || position > document.length) return null;

  const from = Math.max(0, position - PAIR_SEARCH_MARGIN);
  const to = Math.min(document.length, position + PAIR_SEARCH_MARGIN + 1);
  const contextFrom = pairSearchGraphemeSegmenter
    ? Math.max(0, from - GRAPHEME_BOUNDARY_CONTEXT)
    : from;
  const contextTo = pairSearchGraphemeSegmenter
    ? Math.min(document.length, to + GRAPHEME_BOUNDARY_CONTEXT)
    : to;
  const source = typeof document.sliceString === 'function'
    ? document.sliceString(contextFrom, contextTo)
    : String(document.toString()).slice(contextFrom, contextTo);
  let localFrom = from - contextFrom;
  let localTo = to - contextFrom;

  if (pairSearchGraphemeSegmenter) {
    for (const item of pairSearchGraphemeSegmenter.segment(source)) {
      const segmentTo = item.index + item.segment.length;
      if (item.index < localFrom && segmentTo > localFrom) {
        // If the context itself starts inside this grapheme, its true start is unknown.
        if (item.index === 0 && contextFrom > 0) return null;
        localFrom = item.index;
      }
      if (item.index < localTo && segmentTo > localTo) {
        // Likewise, do not search a window whose final grapheme may be truncated.
        if (segmentTo === source.length && contextTo < document.length) return null;
        localTo = segmentTo;
      }
      if (item.index >= localTo) break;
    }
  }

  const searchFrom = contextFrom + localFrom;
  const searchSource = source.slice(localFrom, localTo);
  const localRange = findEnclosingSymbolRange(searchSource, position - searchFrom, position - searchFrom);
  return localRange ? { from: localRange.from + searchFrom, to: localRange.to + searchFrom } : null;
}

function isPythonTripleQuoteDelimiter(value) {
  return value === '"""' || value === "'''";
}

function isStringSyntaxToken(token) {
  return /string|character/i.test(token?.name || '');
}

function stringSyntaxTokenAt(state, position) {
  if (typeof state.doc?.sliceString !== 'function') return null;
  const tree = ensureSyntaxTree(state, Math.min(state.doc.length, position + 1), 25) || syntaxTree(state);
  let token = tree.resolveInner(position, -1);
  if (!isStringSyntaxToken(token)) token = tree.resolveInner(position, 1);
  return isStringSyntaxToken(token) ? token : null;
}

function customSyntaxQuoteRulesAt(state, position) {
  if (typeof state.languageDataAt !== 'function') return [];
  return state.languageDataAt('coteditQuotePairs', position).flat().slice(0, 512)
    .filter(rule => (isSingleGrapheme(rule?.begin) || isPythonTripleQuoteDelimiter(rule?.begin))
      && (isSingleGrapheme(rule?.end) || isPythonTripleQuoteDelimiter(rule?.end))
      && (!rule.escapeCharacter || isSingleGrapheme(rule.escapeCharacter)));
}

function customSyntaxQuoteRange(state, position) {
  if (typeof state.doc?.sliceString !== 'function') return null;
  const quoteRules = customSyntaxQuoteRulesAt(state, position);
  if (!quoteRules.length) return null;

  const token = stringSyntaxTokenAt(state, position);
  if (!token) return null;
  const source = state.doc.sliceString(token.from, token.to);
  const context = state.doc.sliceString(Math.max(0, token.from - 128), token.from);
  const tripleQuoteRules = quoteRules.filter(rule => isPythonTripleQuoteDelimiter(rule.begin)
    && isPythonTripleQuoteDelimiter(rule.end)
    && source.length >= rule.begin.length + rule.end.length
    && source.startsWith(rule.begin)
    && source.endsWith(rule.end));
  const candidateRules = tripleQuoteRules.length ? tripleQuoteRules : quoteRules;
  const clickedQuoteBoundary = candidateRules.some(rule => {
    if (!source.startsWith(rule.begin) || !source.endsWith(rule.end)) return false;
    const openingEnd = token.from + rule.begin.length;
    const closingStart = token.to - rule.end.length;
    const clickedOpening = isSingleGrapheme(rule.begin)
      ? position >= token.from && position < openingEnd
      : position === token.from;
    const clickedClosing = isSingleGrapheme(rule.end)
      ? position >= closingStart && position < token.to
      : position === token.to - 1;
    return clickedOpening || clickedClosing;
  });
  if (!clickedQuoteBoundary) return null;
  let prefixRejected = false;
  const matches = candidateRules.flatMap(rule => {
    const { begin, end } = rule;
    if (!source.startsWith(begin) || !source.endsWith(end) || source.length < begin.length + end.length) return [];
    const prefixes = Array.isArray(rule.prefixes) ? rule.prefixes.slice(0, 256) : [];
    const hasPrefix = prefixes.some(prefix => typeof prefix === 'string' && prefix.length > 0 && context.endsWith(prefix));
    if (prefixes.length && !hasPrefix) {
      prefixRejected = true;
      return [];
    }
    return [{ from: token.from, to: token.to, hasPrefix }];
  });
  matches.sort((left, right) => Number(right.hasPrefix) - Number(left.hasPrefix) || (left.to - left.from) - (right.to - right.from));
  return matches[0] || (prefixRejected ? false : null);
}

function builtInSyntaxQuoteRange(state, position) {
  if (typeof state.doc?.sliceString !== 'function') return null;
  if (customSyntaxQuoteRulesAt(state, position).length) return null;
  const token = stringSyntaxTokenAt(state, position);
  if (!token) return null;

  const source = state.doc.sliceString(token.from, token.to);
  const quote = source[0];
  if (!STANDARD_QUOTE_CHARACTERS.has(quote) || source.at(-1) !== quote) return null;
  if (position !== token.from && position !== token.to - 1) return null;
  return { from: token.from, to: token.to };
}

/**
 * Select an active syntax quote token when its delimiter is double-clicked,
 * or the innermost balanced built-in pair when its content is double-clicked.
 * Returns false when CodeMirror's default behavior should remain in effect.
 */
export function selectEnclosingPairAtDoubleClick(view, position, event) {
  if (!view?.state || typeof view.dispatch !== 'function') return false;
  if (event?.button !== 0 || event?.detail !== 2 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (!Number.isInteger(position) || position < 0 || position > view.state.doc.length) return false;

  const syntaxPair = customSyntaxQuoteRange(view.state, position);
  const builtInQuotePair = syntaxPair === null ? builtInSyntaxQuoteRange(view.state, position) : null;
  const pair = syntaxPair === false
    ? null
    : syntaxPair || builtInQuotePair || findEnclosingSymbolRangeNearPosition(view.state.doc, position);
  if (!pair || pair.to <= pair.from) return false;

  view.dispatch({
    selection: EditorSelection.range(pair.from, pair.to),
    scrollIntoView: true,
    userEvent: 'select.pointer'
  });
  event.preventDefault?.();
  return true;
}
