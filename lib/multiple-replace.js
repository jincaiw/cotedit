import { instrumentIcuWordBoundaries, translateIcuRegex } from './icu-regexp.js';
import { normalizeLineEndings } from './text-tools.js';

export const MAX_MULTIPLE_REPLACE_DEFINITIONS = 50;
export const MAX_MULTIPLE_REPLACE_RULES = 100;
export const MAX_MULTIPLE_REPLACE_TEXT_BYTES = 4096;
export const MAX_MULTIPLE_REPLACE_TOTAL_BYTES = 48 * 1024;
export const MAX_MULTIPLE_REPLACE_MATCHES = 200_000;
export const COTEDITOR_TEXTUAL_CASE_INSENSITIVE_OPTION = 1;
export const COTEDITOR_TEXTUAL_LITERAL_OPTION = 2;
export const COTEDITOR_TEXTUAL_ANCHORED_OPTION = 8;
export const COTEDITOR_REGEX_CASE_INSENSITIVE_OPTION = 1;
export const COTEDITOR_REGEX_ALLOW_COMMENTS_AND_WHITESPACE_OPTION = 2;
export const COTEDITOR_REGEX_IGNORE_METACHARACTERS_OPTION = 4;
export const COTEDITOR_REGEX_DOT_MATCHES_LINE_SEPARATORS_OPTION = 8;
export const COTEDITOR_REGEX_ANCHORS_MATCH_LINES_OPTION = 16;
export const COTEDITOR_REGEX_UNIX_LINE_SEPARATORS_OPTION = 32;
export const COTEDITOR_REGEX_UNICODE_WORD_BOUNDARIES_OPTION = 64;

// Defaults for newly created definitions; stored definitions keep their own flags.
export const DEFAULT_MULTIPLE_REPLACE_OPTIONS = Object.freeze({
  matchesFullWord: false,
  textualCaseInsensitive: false,
  textualLiteral: false,
  textualAnchored: false,
  regexCaseInsensitive: false,
  regexAllowCommentsAndWhitespace: false,
  regexIgnoreMetacharacters: false,
  regexDotMatchesLineSeparators: false,
  regexAnchorsMatchLines: true,
  regexUnixLineSeparators: false,
  regexUseUnicodeWordBoundaries: false,
  unescapesReplacementString: false
});

const encoder = new TextEncoder();
const utf8Size = value => encoder.encode(value).byteLength;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

function normalizeRule(candidate, index) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const findString = typeof candidate.findString === 'string' ? candidate.findString : '';
  const replacementString = typeof candidate.replacementString === 'string' ? candidate.replacementString : '';
  const description = typeof candidate.description === 'string' ? candidate.description.trim().slice(0, 120) : '';
  if (utf8Size(findString) > MAX_MULTIPLE_REPLACE_TEXT_BYTES || utf8Size(replacementString) > MAX_MULTIPLE_REPLACE_TEXT_BYTES) return null;
  return {
    id: typeof candidate.id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(candidate.id) ? candidate.id : `rule-${index + 1}`,
    isEnabled: candidate.isEnabled !== false,
    findString,
    replacementString,
    usesRegularExpression: candidate.usesRegularExpression === true,
    ignoresCase: candidate.ignoresCase === true,
    ...(description ? { description } : {})
  };
}

/** Keep persisted replacement definitions bounded and predictable. */
export function normalizeMultipleReplaceDefinitions(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  const result = [];
  let totalBytes = 0;
  for (const candidate of value.slice(0, MAX_MULTIPLE_REPLACE_DEFINITIONS * 2)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 80) : '';
    if (!ID_PATTERN.test(id) || ids.has(id) || !name) continue;
    const replacements = (Array.isArray(candidate.replacements) ? candidate.replacements : [])
    .slice(0, MAX_MULTIPLE_REPLACE_RULES)
    .map(normalizeRule)
    .filter(Boolean);
    const matchesFullWord = candidate.matchesFullWord === true;
    const textualCaseInsensitive = candidate.textualCaseInsensitive === true;
    const textualLiteral = candidate.textualLiteral === true;
    const textualAnchored = candidate.textualAnchored === true;
    const regexCaseInsensitive = candidate.regexCaseInsensitive === true;
    const regexAllowCommentsAndWhitespace = candidate.regexAllowCommentsAndWhitespace === true;
    const regexIgnoreMetacharacters = candidate.regexIgnoreMetacharacters === true;
    const regexDotMatchesLineSeparators = candidate.regexDotMatchesLineSeparators === true;
    const regexAnchorsMatchLines = candidate.regexAnchorsMatchLines === true;
    const regexUnixLineSeparators = candidate.regexUnixLineSeparators === true;
    const regexUseUnicodeWordBoundaries = candidate.regexUseUnicodeWordBoundaries === true;
    const unescapesReplacementString = candidate.unescapesReplacementString === true;
    const definitionBytes = utf8Size(id) + utf8Size(name)
      + (matchesFullWord ? utf8Size('"matchesFullWord":true') : 0)
      + (textualCaseInsensitive ? utf8Size('"textualCaseInsensitive":true') : 0)
      + (textualLiteral ? utf8Size('"textualLiteral":true') : 0)
      + (textualAnchored ? utf8Size('"textualAnchored":true') : 0)
      + (regexCaseInsensitive ? utf8Size('"regexCaseInsensitive":true') : 0)
      + (regexAllowCommentsAndWhitespace ? utf8Size('"regexAllowCommentsAndWhitespace":true') : 0)
      + (regexIgnoreMetacharacters ? utf8Size('"regexIgnoreMetacharacters":true') : 0)
      + (regexDotMatchesLineSeparators ? utf8Size('"regexDotMatchesLineSeparators":true') : 0)
      + (regexAnchorsMatchLines ? utf8Size('"regexAnchorsMatchLines":true') : 0)
      + (regexUnixLineSeparators ? utf8Size('"regexUnixLineSeparators":true') : 0)
      + (regexUseUnicodeWordBoundaries ? utf8Size('"regexUseUnicodeWordBoundaries":true') : 0)
      + (unescapesReplacementString ? utf8Size('"unescapesReplacementString":true') : 0)
      + replacements.reduce((sum, rule) => sum + utf8Size(JSON.stringify(rule)), 0);
    if (totalBytes + definitionBytes > MAX_MULTIPLE_REPLACE_TOTAL_BYTES) break;
    totalBytes += definitionBytes;
    ids.add(id);
    result.push({ id, name, ...(matchesFullWord ? { matchesFullWord: true } : {}), ...(textualCaseInsensitive ? { textualCaseInsensitive: true } : {}), ...(textualLiteral ? { textualLiteral: true } : {}), ...(textualAnchored ? { textualAnchored: true } : {}), ...(regexCaseInsensitive ? { regexCaseInsensitive: true } : {}), ...(regexAllowCommentsAndWhitespace ? { regexAllowCommentsAndWhitespace: true } : {}), ...(regexIgnoreMetacharacters ? { regexIgnoreMetacharacters: true } : {}), ...(regexDotMatchesLineSeparators ? { regexDotMatchesLineSeparators: true } : {}), ...(regexAnchorsMatchLines ? { regexAnchorsMatchLines: true } : {}), ...(regexUnixLineSeparators ? { regexUnixLineSeparators: true } : {}), ...(regexUseUnicodeWordBoundaries ? { regexUseUnicodeWordBoundaries: true } : {}), ...(unescapesReplacementString ? { unescapesReplacementString: true } : {}), replacements });
    if (result.length >= MAX_MULTIPLE_REPLACE_DEFINITIONS) break;
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ICU_PATTERN_WHITESPACE = new Set(['\u0009', '\u000a', '\u000b', '\u000c', '\u000d', '\u0020', '\u0085', '\u200e', '\u200f', '\u2028', '\u2029']);
const ICU_LINE_TERMINATORS = new Set(['\u000a', '\u000b', '\u000c', '\u000d', '\u0085', '\u2028', '\u2029']);

function escapeRegexPatternLiteral(character) {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

/** Approximate ICU COMMENTS mode without touching escaped or quoted literal text and character-class contents. */
function stripIcuCommentsAndWhitespace(source, unixLineSeparators = false) {
  let output = '';
  let inCharacterClass = false;
  let classCanClose = false;
  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (character === '\\') {
      const next = source[index + 1];
      if (next === undefined) { output += '\\\\'; index++; continue; }
      if (next === 'Q') {
        const end = source.indexOf('\\E', index + 2);
        if (end < 0) { output += source.slice(index); break; }
        output += source.slice(index, end + 2);
        index = end + 2;
        if (inCharacterClass) classCanClose = true;
        continue;
      }
      const codePoint = source.codePointAt(index + 1);
      const escaped = String.fromCodePoint(codePoint);
      if (ICU_PATTERN_WHITESPACE.has(escaped) || escaped === '#') output += escapeRegexPatternLiteral(escaped);
      else output += `\\${escaped}`;
      index += 1 + escaped.length;
      if (inCharacterClass) classCanClose = true;
      continue;
    }
    if (inCharacterClass) {
      output += character;
      if (character === ']') {
        if (classCanClose) { inCharacterClass = false; classCanClose = false; }
        else classCanClose = true;
      } else if (character !== '^' || classCanClose) {
        classCanClose = true;
      }
      index++;
      continue;
    }
    if (character === '[') {
      output += character;
      inCharacterClass = true;
      classCanClose = false;
      index++;
      continue;
    }
    if (character === '#') {
      while (index < source.length && !(unixLineSeparators ? source[index] === '\n' : ICU_LINE_TERMINATORS.has(source[index]))) index++;
      continue;
    }
    if (ICU_PATTERN_WHITESPACE.has(character)) { index++; continue; }
    output += character;
    index++;
  }
  return output;
}

function transformRegexLineBehavior(source, { anchorsMatchLines = false, unixLineSeparators = false, dotMatchesLineSeparators = false } = {}) {
  const lineStart = unixLineSeparators
    ? String.raw`(?:(?<![\s\S])|(?<=\n))`
    : String.raw`(?:(?<![\s\S])|(?<=[\n\v\f\r\u0085\u2028\u2029])(?!(?<=\r)\n))`;
  const lineEnd = unixLineSeparators
    ? String.raw`(?:(?![\s\S])|(?=\n))`
    : String.raw`(?:(?![\s\S])|(?=[\n\v\f\r\u0085\u2028\u2029])(?!(?<=\r)\n))`;
  let output = '';
  let inCharacterClass = false;
  let classCanClose = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '\\') {
      output += character;
      if (index + 1 < source.length) {
        output += source[++index];
        if (inCharacterClass) classCanClose = true;
      }
      continue;
    }
    if (inCharacterClass) {
      output += character;
      if (character === ']') {
        if (classCanClose) { inCharacterClass = false; classCanClose = false; }
        else classCanClose = true;
      } else if (character !== '^' || classCanClose) {
        classCanClose = true;
      }
      continue;
    }
    if (character === '[') {
      output += character;
      inCharacterClass = true;
      classCanClose = false;
    } else if (character === '.' && dotMatchesLineSeparators && !unixLineSeparators) {
      // ICU treats CRLF as one line terminator, so dotAll must consume the pair atomically.
      output += String.raw`(?:\r\n|(?<!\r)(?!\r\n)[\s\S])`;
    } else if (!dotMatchesLineSeparators && character === '.') {
      output += unixLineSeparators ? String.raw`[^\n]` : String.raw`[^\n\v\f\r\u0085\u2028\u2029]`;
    } else if (anchorsMatchLines && character === '^') {
      output += lineStart;
    } else if (anchorsMatchLines && character === '$') {
      output += lineEnd;
    } else {
      output += character;
    }
  }
  return output;
}

function compileRuleExpression(rule, textualCaseInsensitive = false, regexCaseInsensitive = false, regexDotMatchesLineSeparators = false, regexAnchorsMatchLines = false, regexIgnoreMetacharacters = false, regexAllowCommentsAndWhitespace = false, textualAnchored = false, regexUnixLineSeparators = false, regexUseUnicodeWordBoundaries = false) {
  try {
    const regexSource = regexAllowCommentsAndWhitespace
      ? stripIcuCommentsAndWhitespace(rule.findString, regexUnixLineSeparators)
      : rule.findString;
    const isRegexPattern = rule.usesRegularExpression && !regexIgnoreMetacharacters;
    const boundaryInstrumentation = isRegexPattern && regexUseUnicodeWordBoundaries
      ? instrumentIcuWordBoundaries(regexSource)
      : null;
    const translatedPattern = isRegexPattern
      ? translateIcuRegex(boundaryInstrumentation?.pattern ?? regexSource)
      : escapeRegExp(rule.findString);
    const anchorsMatchLines = rule.usesRegularExpression && regexAnchorsMatchLines;
    const pattern = isRegexPattern
      ? transformRegexLineBehavior(translatedPattern, {
        anchorsMatchLines,
        unixLineSeparators: regexUnixLineSeparators,
        dotMatchesLineSeparators: regexDotMatchesLineSeparators
      })
      : translatedPattern;
    const searchPattern = textualAnchored && !rule.usesRegularExpression ? `^(?:${pattern})` : pattern;
    const ignoresCase = rule.ignoresCase || (rule.usesRegularExpression ? regexCaseInsensitive : textualCaseInsensitive);
    const dotAll = rule.usesRegularExpression && regexDotMatchesLineSeparators;
    const hasBoundaryAssertions = (boundaryInstrumentation?.boundaryGroups.length || 0) > 0;
    const expression = new RegExp(searchPattern, `${hasBoundaryAssertions ? 'd' : ''}gu${ignoresCase ? 'i' : ''}${dotAll ? 's' : ''}${anchorsMatchLines ? 'm' : ''}`);
    if (hasBoundaryAssertions) {
      expression.unicodeWordBoundaryGroups = boundaryInstrumentation.boundaryGroups;
      expression.originalCaptureIndexes = boundaryInstrumentation.originalCaptureIndexes;
    }
    return expression;
  } catch {
    return null;
  }
}

function expandRegexReplacement(match, replacement) {
  return replacement.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>|\{[^}]+\})/g, (token, key) => {
    if (key === '$') return '$';
    if (key === '&' || key === '0') return match[0];
    if (key === '`') return match.input.slice(0, match.index);
    if (key === "'") return match.input.slice(match.index + match[0].length);
    if (key.startsWith('<') || key.startsWith('{')) {
      const name = key.slice(1, -1);
      if (!Object.prototype.hasOwnProperty.call(match.groups || {}, name)) return token;
      return match.groups[name] ?? '';
    }
    const group = Number(key);
    return group > 0 && group < match.length ? (match[group] ?? '') : token;
  });
}

function unescapeRegexReplacement(value) {
  const escapes = { '0': '\0', t: '\t', n: '\n', r: '\r', '"': '"', "'": "'", '\\': '\\' };
  return value.replace(/\\([0tnr"'\\])/g, (_, character) => escapes[character]);
}

function appendPiece(pieces, piece) {
  if (!piece.text) return;
  const previous = pieces.at(-1);
  const contiguousSource = previous?.sourceFrom !== null && previous?.sourceFrom !== undefined
    && piece.sourceFrom === previous.sourceFrom + previous.text.length;
  if (previous && (previous.sourceFrom === null && piece.sourceFrom === null || contiguousSource)) {
    previous.text += piece.text;
  } else {
    pieces.push({ ...piece });
  }
}

function appendPieceSlice(pieces, from, to, output, position = { index: 0, offset: 0 }) {
  if (to <= from) return position;
  let { index, offset } = position;
  while (index < pieces.length) {
    const piece = pieces[index];
    const end = offset + piece.text.length;
    const startInPiece = Math.max(from, offset);
    const endInPiece = Math.min(to, end);
    if (endInPiece > startInPiece) {
      const localStart = startInPiece - offset;
      appendPiece(output, {
        text: piece.text.slice(localStart, endInPiece - offset),
        sourceFrom: piece.sourceFrom === null ? null : piece.sourceFrom + localStart
      });
    }
    if (end <= to) {
      offset = end;
      index++;
    } else {
      break;
    }
    if (offset >= to) break;
  }
  return { index, offset };
}

function advancePiecePosition(pieces, to, position) {
  let { index, offset } = position;
  while (index < pieces.length && offset < to) {
    const end = offset + pieces[index].text.length;
    if (end <= to) {
      offset = end;
      index++;
    } else break;
  }
  return { index, offset };
}

const ICU_WORD_CHARACTER = /^[\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\u200c\u200d]$/u;
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const UNICODE_WORD_SEGMENTER = new Intl.Segmenter('und', { granularity: 'word' });

function unicodeWordBoundaries(source, leftContext = '', rightContext = '') {
  const prefix = leftContext || '';
  const value = `${prefix}${source}${rightContext || ''}`;
  const boundaries = new Set();
  for (const segment of UNICODE_WORD_SEGMENTER.segment(value)) {
    if (!segment.isWordLike) continue;
    for (const position of [segment.index, segment.index + segment.segment.length]) {
      const relative = position - prefix.length;
      if (relative >= 0 && relative <= source.length) boundaries.add(relative);
    }
  }
  return boundaries;
}

function codePointBefore(source, offset) {
  if (offset <= 0) return '';
  let start = offset - 1;
  const last = source.charCodeAt(start);
  if (last >= 0xdc00 && last <= 0xdfff && start > 0) {
    const previous = source.charCodeAt(start - 1);
    if (previous >= 0xd800 && previous <= 0xdbff) start--;
  }
  return source.slice(start, offset);
}

function codePointAt(source, offset) {
  if (offset < 0 || offset >= source.length) return '';
  return String.fromCodePoint(source.codePointAt(offset));
}

function isIcuWordCharacter(character) {
  return character !== '' && ICU_WORD_CHARACTER.test(character);
}

function hasIcuWordBoundary(source, offset, leftContext = '', rightContext = '') {
  const left = offset > 0 ? codePointBefore(source, offset) : leftContext;
  const right = offset < source.length ? codePointAt(source, offset) : rightContext;
  return isIcuWordCharacter(left) !== isIcuWordCharacter(right);
}

function matchesWholeWord(source, from, to, leftContext = '', rightContext = '') {
  return hasIcuWordBoundary(source, from, leftContext, rightContext)
    && hasIcuWordBoundary(source, to, leftContext, rightContext);
}

function canonicalSearchRepresentation(source) {
  if (!/[^\x00-\x7f]/u.test(source)) return { text: source, sourceOffsetAtBoundary: null };
  const sourceOffsetAtBoundary = new Map([[0, 0]]);
  let text = '';
  for (const { index, segment } of GRAPHEME_SEGMENTER.segment(source)) {
    text += segment.normalize('NFD');
    sourceOffsetAtBoundary.set(text.length, index + segment.length);
  }
  return { text, sourceOffsetAtBoundary };
}

function* findRuleMatches(source, rule, options = {}) {
  const {
    matchesFullWord = false,
    textualCaseInsensitive = false,
    textualLiteral = false,
    textualAnchored = false,
    regexCaseInsensitive = false,
    regexDotMatchesLineSeparators = false,
    regexAnchorsMatchLines = false,
    regexUnixLineSeparators = false,
    regexIgnoreMetacharacters = false,
    regexAllowCommentsAndWhitespace = false,
    regexUseUnicodeWordBoundaries = false
  } = options;
  const canonicalEquivalence = !rule.usesRegularExpression ? !textualLiteral : regexIgnoreMetacharacters;
  const searchRule = canonicalEquivalence
    ? { ...rule, findString: rule.findString.normalize('NFD') }
    : rule;
  const expression = compileRuleExpression(
    searchRule,
    textualCaseInsensitive,
    regexCaseInsensitive,
    regexDotMatchesLineSeparators,
    regexAnchorsMatchLines,
    regexIgnoreMetacharacters,
    regexAllowCommentsAndWhitespace,
    textualAnchored,
    regexUnixLineSeparators,
    regexUseUnicodeWordBoundaries
  );
  if (!expression) return;
  const representation = canonicalEquivalence
    ? canonicalSearchRepresentation(source)
    : { text: source, sourceOffsetAtBoundary: null };
  const boundarySet = expression.unicodeWordBoundaryGroups
    ? unicodeWordBoundaries(representation.text, options.leftContext || '', options.rightContext || '')
    : null;
  for (const match of representation.text.matchAll(expression)) {
    if (boundarySet && !expression.unicodeWordBoundaryGroups.every(({ group, positive }) => {
      const range = match.indices?.[group];
      return Boolean(range && range[0] === range[1] && boundarySet.has(range[0]) === positive);
    })) continue;
    const normalizedTo = match.index + match[0].length;
    const from = representation.sourceOffsetAtBoundary?.get(match.index) ?? match.index;
    const to = representation.sourceOffsetAtBoundary?.get(normalizedTo) ?? normalizedTo;
    if (representation.sourceOffsetAtBoundary
        && (!representation.sourceOffsetAtBoundary.has(match.index)
          || !representation.sourceOffsetAtBoundary.has(normalizedTo))) continue;
    if (matchesFullWord && !rule.usesRegularExpression
        && !matchesWholeWord(source, from, to, options.leftContext || '', options.rightContext || '')) continue;
    let sourceMatch = match;
    if (expression.originalCaptureIndexes) {
      sourceMatch = [match[0], ...expression.originalCaptureIndexes.map(group => match[group])];
      sourceMatch.index = match.index;
      sourceMatch.input = representation.text;
      if (match.groups !== undefined) sourceMatch.groups = match.groups;
    }
    if (representation.sourceOffsetAtBoundary) {
      sourceMatch = [...match];
      sourceMatch[0] = source.slice(from, to);
      sourceMatch.index = from;
      sourceMatch.input = source;
      if (match.groups !== undefined) sourceMatch.groups = match.groups;
    }
    yield { match: sourceMatch, from, to };
  }
}

function replaceTrackedSegment(source, pieces, rule, { matchesFullWord = false, textualCaseInsensitive = false, textualLiteral = false, textualAnchored = false, regexCaseInsensitive = false, regexDotMatchesLineSeparators = false, regexAnchorsMatchLines = false, regexUnixLineSeparators = false, regexIgnoreMetacharacters = false, regexAllowCommentsAndWhitespace = false, regexUseUnicodeWordBoundaries = false, unescapesReplacementString = false, leftContext = '', rightContext = '' } = {}) {
  if (!rule.findString) return { text: source, pieces, count: 0 };
  const output = [];
  let cursor = 0;
  let piecePosition = { index: 0, offset: 0 };
  let count = 0;
  for (const { match, from, to: matchEnd } of findRuleMatches(source, rule, {
    matchesFullWord, textualCaseInsensitive, textualLiteral, textualAnchored, regexCaseInsensitive,
    regexDotMatchesLineSeparators, regexAnchorsMatchLines, regexUnixLineSeparators,
    regexIgnoreMetacharacters, regexAllowCommentsAndWhitespace, regexUseUnicodeWordBoundaries, leftContext, rightContext
  })) {
    if (++count > MAX_MULTIPLE_REPLACE_MATCHES) throw new Error(`单条规则匹配超过 ${MAX_MULTIPLE_REPLACE_MATCHES} 项，已取消。`);
    piecePosition = appendPieceSlice(pieces, cursor, from, output, piecePosition);
    const replacementTemplate = unescapesReplacementString && rule.usesRegularExpression
      ? unescapeRegexReplacement(rule.replacementString)
      : rule.replacementString;
    const replacement = normalizeLineEndings(rule.usesRegularExpression
      ? expandRegexReplacement(match, replacementTemplate)
      : rule.replacementString, 'LF');
    appendPiece(output, { text: replacement, sourceFrom: null });
    cursor = matchEnd;
    piecePosition = advancePiecePosition(pieces, cursor, piecePosition);
  }
  if (!count) return { text: source, pieces, count: 0 };
  appendPieceSlice(pieces, cursor, source.length, output, piecePosition);
  return { text: output.map(piece => piece.text).join(''), pieces: output, count };
}

function appendOriginalSlice(source, from, to, pieces) {
  if (to > from) appendPiece(pieces, { text: source.slice(from, to), sourceFrom: from });
}

function changesFromPieces(source, pieces) {
  const changes = [];
  let sourceOffset = 0;
  let pendingInsert = '';
  for (const piece of pieces) {
    if (piece.sourceFrom === null) {
      pendingInsert += piece.text;
      continue;
    }
    if (piece.sourceFrom < sourceOffset) throw new Error('多重替换变更映射无效。');
    if (piece.sourceFrom !== sourceOffset || pendingInsert) {
      changes.push({ from: sourceOffset, to: piece.sourceFrom, insert: pendingInsert });
    }
    sourceOffset = piece.sourceFrom + piece.text.length;
    pendingInsert = '';
  }
  if (sourceOffset < source.length || pendingInsert) {
    changes.push({ from: sourceOffset, to: source.length, insert: pendingInsert });
  }
  return changes;
}

/** Apply enabled rules in order and return the single resulting document text. */
export function applyMultipleReplace(text, definition, { ranges = [], inSelection = false } = {}) {
  const source = typeof text === 'string' ? text : '';
  const normalized = normalizeMultipleReplaceDefinitions([definition])[0];
  if (!normalized) throw new Error('多重替换定义无效。');
  let segments;
  if (inSelection) {
    const safeRanges = (Array.isArray(ranges) ? ranges : [])
      .map(range => ({ from: Math.max(0, Math.min(source.length, Math.trunc(range?.from))), to: Math.max(0, Math.min(source.length, Math.trunc(range?.to))) }))
      .filter(range => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
      .sort((a, b) => a.from - b.from);
    const disjoint = [];
    for (const range of safeRanges) {
      const previous = disjoint.at(-1);
      if (previous && range.from < previous.to) previous.to = Math.max(previous.to, range.to);
      else disjoint.push(range);
    }
    if (!disjoint.length) return { text: source, matchCount: 0, selectedRanges: [], changes: [] };
    segments = disjoint.map(range => ({
      ...range,
      text: source.slice(range.from, range.to),
      pieces: [{ text: source.slice(range.from, range.to), sourceFrom: range.from }],
      leftContext: codePointBefore(source, range.from),
      rightContext: codePointAt(source, range.to)
    }));
  } else {
    segments = [{ from: 0, to: source.length, text: source, pieces: [{ text: source, sourceFrom: 0 }] }];
  }

  let matchCount = 0;
  for (const rule of normalized.replacements) {
    if (!rule.isEnabled || !rule.findString) continue;
    for (const segment of segments) {
      const result = replaceTrackedSegment(segment.text, segment.pieces, rule, {
        matchesFullWord: normalized.matchesFullWord === true,
        textualCaseInsensitive: normalized.textualCaseInsensitive === true,
        textualLiteral: normalized.textualLiteral === true,
        textualAnchored: normalized.textualAnchored === true,
        regexCaseInsensitive: normalized.regexCaseInsensitive === true,
        regexDotMatchesLineSeparators: normalized.regexDotMatchesLineSeparators === true,
        regexAnchorsMatchLines: normalized.regexAnchorsMatchLines === true,
        regexUnixLineSeparators: normalized.regexUnixLineSeparators === true,
        regexIgnoreMetacharacters: normalized.regexIgnoreMetacharacters === true,
        regexAllowCommentsAndWhitespace: normalized.regexAllowCommentsAndWhitespace === true,
        regexUseUnicodeWordBoundaries: normalized.regexUseUnicodeWordBoundaries === true,
        unescapesReplacementString: normalized.unescapesReplacementString === true,
        leftContext: segment.leftContext,
        rightContext: segment.rightContext
      });
      segment.text = result.text;
      segment.pieces = result.pieces;
      matchCount += result.count;
    }
  }

  const pieces = [];
  const selectedRanges = [];
  let sourceOffset = 0;
  let outputOffset = 0;
  for (const segment of segments) {
    appendOriginalSlice(source, sourceOffset, segment.from, pieces);
    outputOffset += segment.from - sourceOffset;
    const from = outputOffset;
    for (const piece of segment.pieces) appendPiece(pieces, piece);
    outputOffset += segment.text.length;
    if (inSelection) selectedRanges.push({ from, to: outputOffset });
    sourceOffset = segment.to;
  }
  appendOriginalSlice(source, sourceOffset, source.length, pieces);
  const outputText = pieces.map(piece => piece.text).join('');
  return { text: outputText, matchCount, selectedRanges, changes: changesFromPieces(source, pieces) };
}

/** Collect matches for every enabled rule against the same source text. */
export function findMultipleReplaceMatches(text, definition, { ranges = [], inSelection = false } = {}) {
  const source = typeof text === 'string' ? text : '';
  const normalized = normalizeMultipleReplaceDefinitions([definition])[0];
  if (!normalized) throw new Error('多重替换定义无效。');

  let segments;
  if (inSelection) {
    const safeRanges = (Array.isArray(ranges) ? ranges : [])
      .map(range => ({ from: Math.max(0, Math.min(source.length, Math.trunc(range?.from))), to: Math.max(0, Math.min(source.length, Math.trunc(range?.to))) }))
      .filter(range => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
      .sort((a, b) => a.from - b.from);
    const disjoint = [];
    for (const range of safeRanges) {
      const previous = disjoint.at(-1);
      if (previous && range.from < previous.to) previous.to = Math.max(previous.to, range.to);
      else disjoint.push(range);
    }
    segments = disjoint;
  } else {
    segments = [{ from: 0, to: source.length }];
  }

  const matches = [];
  let totalMatches = 0;
  for (const rule of normalized.replacements) {
    if (!rule.isEnabled || !rule.findString) continue;
    for (const segment of segments) {
      const textSegment = source.slice(segment.from, segment.to);
      for (const { from: relativeFrom, to: relativeTo } of findRuleMatches(textSegment, rule, {
        matchesFullWord: normalized.matchesFullWord === true,
        textualCaseInsensitive: normalized.textualCaseInsensitive === true,
        textualLiteral: normalized.textualLiteral === true,
        textualAnchored: normalized.textualAnchored === true,
        regexCaseInsensitive: normalized.regexCaseInsensitive === true,
        regexDotMatchesLineSeparators: normalized.regexDotMatchesLineSeparators === true,
        regexAnchorsMatchLines: normalized.regexAnchorsMatchLines === true,
        regexUnixLineSeparators: normalized.regexUnixLineSeparators === true,
        regexIgnoreMetacharacters: normalized.regexIgnoreMetacharacters === true,
        regexAllowCommentsAndWhitespace: normalized.regexAllowCommentsAndWhitespace === true,
        regexUseUnicodeWordBoundaries: normalized.regexUseUnicodeWordBoundaries === true,
        leftContext: codePointBefore(source, segment.from),
        rightContext: codePointAt(source, segment.to)
      })) {
        if (relativeTo <= relativeFrom) continue;
        const from = segment.from + relativeFrom;
        const to = segment.from + relativeTo;
        if (++totalMatches > MAX_MULTIPLE_REPLACE_MATCHES) {
          throw new Error(`单条规则匹配超过 ${MAX_MULTIPLE_REPLACE_MATCHES} 项，已取消。`);
        }
        matches.push({ from, to });
      }
    }
  }

  matches.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged = [];
  for (const match of matches) {
    const previous = merged.at(-1);
    if (previous && match.from < previous.to) previous.to = Math.max(previous.to, match.to);
    else merged.push({ ...match });
  }
  return merged;
}
