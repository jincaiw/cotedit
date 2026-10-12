import { NFKC_CASEFOLD_MAPPINGS } from './unicode-nfkc-casefold.js';
import { HFSPLUS_CANONICAL_DECOMPOSITIONS, HFSPLUS_COMBINING_CLASSES, UNICODE_17_FULL_COMPOSITION_EXCLUSION_RANGES } from './unicode-hfsplus-normalization-data.js';

export const ENCODING_OPTIONS = [
  { id: 'utf8', label: 'UTF-8' },
  { id: 'utf16le', label: 'UTF-16 LE' },
  { id: 'utf16be', label: 'UTF-16 BE' },
  { id: 'shift_jis', label: 'Shift_JIS' },
  { id: 'gbk', label: 'GBK' },
  { id: 'big5', label: 'Big5' },
  { id: 'windows-1252', label: 'Windows-1252' },
  { id: 'iso-8859-1', label: 'ISO-8859-1' }
];

export const LINE_ENDING_TYPES = ['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS'];

const LINE_ENDING_PATTERN = /\r\n|\r|\n|\u0085|\u2028|\u2029/g;
const LINE_ENDING_VALUES = {
  LF: '\n', CRLF: '\r\n', CR: '\r', NEL: '\u0085', LS: '\u2028', PS: '\u2029'
};

function lineEndingLabel(value) {
  return value === '\r\n' ? 'CRLF'
    : value === '\r' ? 'CR'
      : value === '\n' ? 'LF'
        : value === '\u0085' ? 'NEL'
          : value === '\u2028' ? 'LS'
            : value === '\u2029' ? 'PS' : 'LF';
}

export function detectLineEnding(text = '') {
  const first = String(text).match(LINE_ENDING_PATTERN);
  return first?.[0] ? lineEndingLabel(first[0]) : 'LF';
}

export function normalizeLineEndings(text = '', eol = 'LF') {
  const separator = LINE_ENDING_VALUES[eol] || '\n';
  return String(text).replace(LINE_ENDING_PATTERN, '\n').replace(/\n/g, separator);
}

export function getOutline(text = '', language = 'plaintext') {
  const lines = String(text).split(/\r\n|\r|\n|\u0085|\u2028|\u2029/);
  const entries = [];
  const codePattern = /^\s*(?:(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|struct|trait|module|namespace)\s+[\w$]+|(?:async\s+)?def\s+[\w$]+|func\s+[\w$]+|(?:export\s+)?(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)|(?:public|private|protected|static|final|abstract|override|\s)*\s*[\w<>?\[\]]+\s+[\w$]+\s*\([^;]*\)\s*(?:\{|$))/;
  for (let index = 0; index < lines.length && entries.length < 500; index++) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const markdown = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    const rst = /^([-~^])\1{2,}\s*$/.test(trimmed) && index > 0;
    let label = '';
    let level = 0;
    if (markdown) { label = markdown[2]; level = markdown[1].length; }
    else if (rst) { label = lines[index - 1].trim(); level = 2; }
    else if (codePattern.test(raw) && ['plaintext', 'markdown'].includes(language) === false) {
      label = trimmed.replace(/\s*[{:;]\s*$/, '').slice(0, 140);
      level = 1;
    }
    if (label) entries.push({ line: index + 1, level, label });
  }
  return entries;
}

export function findEnclosingSymbolRange(text = '', selectionFrom = 0, selectionTo = selectionFrom) {
  const source = String(text);
  const clamp = value => Math.max(0, Math.min(source.length, Number.isFinite(Number(value)) ? Number(value) : 0));
  const from = Math.min(clamp(selectionFrom), clamp(selectionTo));
  const to = Math.max(clamp(selectionFrom), clamp(selectionTo));
  const closingFor = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const lineBreaks = new Set(['\n', '\r', '\u0085', '\u2028', '\u2029']);
  const stack = [];
  const matches = [];
  const findQuoteEnd = (start, quote) => {
    for (let cursor = start + 1; cursor < source.length; cursor++) {
      if (source[cursor] === '\\') { cursor++; continue; }
      if (quote !== '`' && lineBreaks.has(source[cursor])) return -1;
      if (source[cursor] === quote) return cursor;
    }
    return -1;
  };
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '\\') { index++; continue; }
    if (character === '"' || character === "'" || character === '`') {
      const quoteEnd = findQuoteEnd(index, character);
      if (quoteEnd >= 0) {
        if (index < from && to <= quoteEnd) matches.push({ from: index + 1, to: quoteEnd });
        index = quoteEnd;
        continue;
      }
    }
    if (closingFor[character]) {
      stack.push({ character, close: closingFor[character], index });
      continue;
    }
    const opening = stack.at(-1);
    if (opening?.close === character) {
      stack.pop();
      if (opening.index < from && to <= index) matches.push({ from: opening.index + 1, to: index });
    }
  }
  matches.sort((left, right) => (left.to - left.from) - (right.to - right.from));
  return matches[0] || null;
}

export function characterInfo(text = '', offset = 0) {
  const value = String(text);
  let start = Math.trunc(Math.max(0, Math.min(Number(offset) || 0, value.length)));
  if (start > 0 && start < value.length) {
    const current = value.charCodeAt(start);
    const previous = value.charCodeAt(start - 1);
    if (current >= 0xdc00 && current <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff) start--;
  }
  const codePoint = value.codePointAt(start);
  if (codePoint == null) return null;
  const character = String.fromCodePoint(codePoint);
  const name = codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0) ? '控制字符' : character;
  return {
    character: name,
    codePoint,
    hex: `U+${codePoint.toString(16).toUpperCase().padStart(codePoint <= 0xffff ? 4 : 5, '0')}`,
    decimal: codePoint,
    utf16Length: character.length,
    utf8Bytes: new TextEncoder().encode(character).length
  };
}

export function getLineEndings(text = '') {
  return [...String(text).matchAll(LINE_ENDING_PATTERN)].map(match => lineEndingLabel(match[0]));
}

export function summarizeLineEndings(lineEndings = [], maxLinesPerType = 40) {
  const groups = new Map();
  const lineLimit = Math.max(0, Math.min(500, Math.trunc(Number(maxLinesPerType) || 0)));
  for (let index = 0; index < lineEndings.length; index++) {
    const type = LINE_ENDING_TYPES.includes(lineEndings[index]) ? lineEndings[index] : 'LF';
    let group = groups.get(type);
    if (!group) { group = { type, count: 0, lines: [] }; groups.set(type, group); }
    group.count++;
    if (group.lines.length < lineLimit) group.lines.push(index + 1);
  }
  const types = [...groups.values()];
  return { mixed: types.length > 1, total: lineEndings.length, types };
}

export function dominantLineEnding(lineEndings = [], fallback = 'LF') {
  const counts = new Map();
  for (const value of lineEndings) counts.set(value, (counts.get(value) || 0) + 1);
  let dominant = fallback;
  let max = 0;
  for (const value of lineEndings) {
    const count = counts.get(value) || 0;
    if (count > max) { dominant = value; max = count; }
  }
  return dominant;
}

export function convertIndentation(text = '', target = 'spaces', tabSize = 4) {
  if (target !== 'spaces' && target !== 'tabs') throw new RangeError('Indentation target must be spaces or tabs.');
  const width = Math.max(1, Math.min(99, Math.trunc(Number(tabSize) || 4)));
  return String(text).replace(/^[ \t]+/gm, indentation => {
    let columns = 0;
    for (const character of indentation) {
      columns += character === '\t' ? width - (columns % width) : 1;
    }
    return target === 'spaces'
      ? ' '.repeat(columns)
      : '\t'.repeat(Math.floor(columns / width)) + ' '.repeat(columns % width);
  });
}

/** Return edits removing ASCII spaces and tabs from whole-document or selected CodeMirror lines. */
export function trailingWhitespaceChanges(document, options = {}) {
  const changes = [];
  if (!document || !Number.isSafeInteger(document.lines) || typeof document.line !== 'function') return changes;
  const includeWhitespaceOnlyLines = options.includeWhitespaceOnlyLines !== false;
  const suppliedRanges = Array.isArray(options.lineRanges) ? options.lineRanges : null;
  const ranges = suppliedRanges
    ? suppliedRanges.flatMap(range => Array.isArray(range) && range.length >= 2
      && Number.isSafeInteger(range[0]) && Number.isSafeInteger(range[1])
      ? [[Math.max(1, Math.min(document.lines, range[0])), Math.max(1, Math.min(document.lines, range[1]))]]
      : []).filter(([from, to]) => from <= to).sort((left, right) => left[0] - right[0])
    : [[1, document.lines]];
  const mergedRanges = [];
  for (const range of ranges) {
    const previous = mergedRanges.at(-1);
    if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1]);
    else mergedRanges.push([...range]);
  }
  for (const [from, to] of mergedRanges) {
    for (let number = from; number <= to; number++) {
      const line = document.line(number);
      if (!includeWhitespaceOnlyLines && /^[\t ]*$/.test(line.text)) continue;
      const match = /[\t ]+$/.exec(line.text);
      if (match) changes.push({ from: line.to - match[0].length, to: line.to, insert: '' });
    }
  }
  return changes;
}

/** Transform a whole-line block while carrying its existing line-ending styles with each line. */
export function transformLineBlock(text = '', lineEndings = [], operation = 'sort', options = {}) {
  const source = String(text);
  if (!['sort', 'reverse', 'shuffle', 'delete-duplicates'].includes(operation)) {
    throw new RangeError('Unknown line transformation.');
  }
  const hasTrailingLineEnding = source.endsWith('\n');
  const contents = source.split('\n');
  if (hasTrailingLineEnding) contents.pop();
  if (!contents.length) contents.push('');

  let lines = contents.map((content, index) => ({
    content,
    ending: LINE_ENDING_TYPES.includes(lineEndings[index]) ? lineEndings[index] : null,
    index
  }));
  const header = options.keepFirstLine === true && lines.length > 1 ? lines.shift() : null;

  if (operation === 'sort') {
    const collator = new Intl.Collator(options.localized === false ? 'en' : undefined, {
      numeric: options.numeric !== false,
      sensitivity: options.ignoreCase === false ? 'variant' : 'accent'
    });
    const getKey = typeof options.getKey === 'function' ? options.getKey : line => line;
    const compare = typeof options.compare === 'function' ? options.compare : (left, right) => collator.compare(left, right);
    lines.sort((left, right) => {
      const leftKey = getKey(left.content);
      const rightKey = getKey(right.content);
      let result = leftKey == null ? (rightKey == null ? left.index - right.index : 1)
        : rightKey == null ? -1 : compare(String(leftKey), String(rightKey));
      if (options.descending === true) result *= -1;
      return result;
    });
  } else if (operation === 'reverse') {
    lines.reverse();
  } else if (operation === 'shuffle') {
    const random = typeof options.random === 'function' ? options.random : Math.random;
    for (let index = lines.length - 1; index > 0; index--) {
      const sample = Number(random());
      const target = Math.max(0, Math.min(index, Math.floor((Number.isFinite(sample) ? sample : 0) * (index + 1))));
      [lines[index], lines[target]] = [lines[target], lines[index]];
    }
  } else {
    const seen = new Set();
    lines = lines.filter(line => {
      if (seen.has(line.content)) return false;
      seen.add(line.content);
      return true;
    });
  }

  if (header) lines.unshift(header);
  const fallback = LINE_ENDING_TYPES.includes(options.fallbackLineEnding) ? options.fallbackLineEnding : 'LF';
  let result = '';
  const resultEndings = [];
  lines.forEach((line, index) => {
    result += line.content;
    const hasSeparator = index < lines.length - 1 || hasTrailingLineEnding;
    if (hasSeparator) {
      result += '\n';
      resultEndings.push(line.ending || fallback);
    }
  });
  return { text: result, lineEndings: resultEndings };
}

export function uppercaseText(text = '', locale) {
  return String(text).toLocaleUpperCase(locale);
}

export function lowercaseText(text = '', locale) {
  return String(text).toLocaleLowerCase(locale);
}

export function straightenCurlyQuotes(text = '') {
  return String(text).replace(/[‘’‚‛]/gu, "'").replace(/[“”„‟]/gu, '"');
}

/** Replace only paired, unescaped ASCII quote marks on each line using English curly quotes. */
export function replacePairedStraightQuotes(text = '') {
  const source = String(text);
  const isLineEnding = value => /^(?:\r\n|[\r\n\u0085\u2028\u2029])$/u.test(value);
  const isWordCharacter = value => value != null && /[\p{L}\p{M}\p{N}]/u.test(value);
  const lineEndingPattern = /(\r\n|[\r\n\u0085\u2028\u2029])/gu;

  const replaceLine = line => {
    const characters = [...line];
    const replacements = new Map();
    const isEscaped = index => {
      let backslashes = 0;
      for (let cursor = index - 1; cursor >= 0 && characters[cursor] === '\\'; cursor--) backslashes++;
      return backslashes % 2 === 1;
    };

    for (const [quote, opening, closing] of [["'", '‘', '’'], ['"', '“', '”']]) {
      let pending = -1;
      for (let index = 0; index < characters.length; index++) {
        if (characters[index] !== quote || isEscaped(index)) continue;
        if (quote === "'" && isWordCharacter(characters[index - 1]) && isWordCharacter(characters[index + 1])) continue;
        if (pending < 0) pending = index;
        else {
          replacements.set(pending, opening);
          replacements.set(index, closing);
          pending = -1;
        }
      }
    }

    return characters.map((character, index) => replacements.get(index) || character).join('');
  };

  return source.split(lineEndingPattern).map(segment => isLineEnding(segment) ? segment : replaceLine(segment)).join('');
}

/** Replace each non-overlapping pair of ASCII hyphens with an em dash. */
export function replaceDoubleHyphensWithEmDash(text = '') {
  return String(text).replace(/--/g, '—');
}

export function capitalizeWords(text = '', locale) {
  return String(text).split(/(\p{White_Space}+)/u).map(word => {
    if (!word || /^\p{White_Space}+$/u.test(word)) return word;
    const characters = [...word.toLocaleLowerCase(locale)];
    if (!characters.length) return word;
    return characters[0].toLocaleUpperCase(locale) + characters.slice(1).join('');
  }).join('');
}

export function encodeURLComponent(text = '') {
  return encodeURIComponent(String(text));
}

export function decodeURLComponent(text = '') {
  const source = String(text);
  try { return decodeURIComponent(source); }
  catch { return source; }
}

const HFSPLUS_UNDECOMPOSED_RANGES = Object.freeze([
  Object.freeze([0x2000, 0x2fff]),
  Object.freeze([0xf900, 0xfaff]),
  Object.freeze([0x2f800, 0x2faff])
]);

function isInCodePointRanges(ranges, codePoint) {
  let lower = 0;
  let upper = ranges.length - 1;
  while (lower <= upper) {
    const middle = (lower + upper) >> 1;
    const [start, end] = ranges[middle];
    if (codePoint < start) upper = middle - 1;
    else if (codePoint > end) lower = middle + 1;
    else return true;
  }
  return false;
}

function appendHfsPlusDecomposition(codePoint, append) {
  if (isInCodePointRanges(HFSPLUS_UNDECOMPOSED_RANGES, codePoint)) {
    append(codePoint);
    return;
  }

  if (codePoint >= 0xac00 && codePoint <= 0xd7a3) {
    const syllable = codePoint - 0xac00;
    const trailing = syllable % 28;
    append(0x1100 + Math.floor(syllable / 588));
    append(0x1161 + Math.floor((syllable % 588) / 28));
    if (trailing) append(0x11a7 + trailing);
    return;
  }

  const decomposition = HFSPLUS_CANONICAL_DECOMPOSITIONS.get(codePoint);
  if (decomposition) {
    for (const component of decomposition) appendHfsPlusDecomposition(component, append);
    return;
  }
  append(codePoint);
}

function normalizeModifiedNfd(text) {
  const output = [];
  const combiningMarks = [];
  let order = 0;
  const flushCombiningMarks = () => {
    combiningMarks.sort((left, right) => left[1] - right[1] || left[2] - right[2]);
    for (const [codePoint] of combiningMarks) output.push(String.fromCodePoint(codePoint));
    combiningMarks.length = 0;
  };
  const append = codePoint => {
    const combiningClass = HFSPLUS_COMBINING_CLASSES.get(codePoint) || 0;
    if (combiningClass === 0) {
      flushCombiningMarks();
      output.push(String.fromCodePoint(codePoint));
      return;
    }
    combiningMarks.push([codePoint, combiningClass, order++]);
  };

  for (const character of String(text)) appendHfsPlusDecomposition(character.codePointAt(0), append);
  flushCombiningMarks();
  return output.join('');
}

function normalizeModifiedNfc(text) {
  const output = [];
  let segment = '';
  for (const character of String(text)) {
    if (isInCodePointRanges(UNICODE_17_FULL_COMPOSITION_EXCLUSION_RANGES, character.codePointAt(0))) {
      if (segment) output.push(segment.normalize('NFC'));
      output.push(character);
      segment = '';
    } else {
      segment += character;
    }
  }
  if (segment) output.push(segment.normalize('NFC'));
  return output.join('');
}

function normalizeNfkcCasefold(text) {
  let mapped = '';
  for (const character of String(text)) {
    const codePoint = character.codePointAt(0);
    const replacement = NFKC_CASEFOLD_MAPPINGS.get(codePoint);
    mapped += replacement === undefined ? character : replacement;
  }
  return mapped.normalize('NFC');
}

export function normalizeUnicode(text = '', form = 'NFC') {
  if (form === 'NFKC_CF') return normalizeNfkcCasefold(text);
  if (form === 'MODIFIED_NFD') return normalizeModifiedNfd(text);
  if (form === 'MODIFIED_NFC') return normalizeModifiedNfc(text);
  if (!['NFC', 'NFD', 'NFKC', 'NFKD'].includes(form)) throw new RangeError('Unicode normalization form must be NFC, NFD, NFKC, NFKD, NFKC_CF, MODIFIED_NFD, or MODIFIED_NFC.');
  return String(text).normalize(form);
}

const HALF_WIDTH_MARKS = new Map([['ﾞ', '\u3099'], ['ﾟ', '\u309a']]);
const FULL_WIDTH_TO_HALF_WIDTH_MARKS = new Map(Array.from(HALF_WIDTH_MARKS, ([halfWidthMark, fullWidthMark]) => [fullWidthMark, halfWidthMark]));
const HALF_WIDTH_TO_FULL_WIDTH = new Map();
for (let codePoint = 0xff61; codePoint <= 0xff9d; codePoint++) {
  const halfWidth = String.fromCodePoint(codePoint);
  const fullWidth = halfWidth.normalize('NFKC').normalize('NFC');
  HALF_WIDTH_TO_FULL_WIDTH.set(fullWidth, halfWidth);
  for (const [mark, combiningMark] of HALF_WIDTH_MARKS) {
    const voiced = `${halfWidth.normalize('NFKC')}${combiningMark}`.normalize('NFC');
    if (voiced !== fullWidth) HALF_WIDTH_TO_FULL_WIDTH.set(voiced, `${halfWidth}${mark}`);
  }
}
for (let codePoint = 0xffa0; codePoint <= 0xffdc; codePoint++) {
  const halfWidth = String.fromCodePoint(codePoint);
  const fullWidth = halfWidth.normalize('NFKC');
  if (fullWidth !== halfWidth) HALF_WIDTH_TO_FULL_WIDTH.set(fullWidth, halfWidth);
}

/** Convert ASCII printable/space, half-width Katakana, and half-width Hangul forms to full-width. */
export function convertToFullWidth(text = '') {
  const characters = [...String(text)];
  let result = '';
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    const codePoint = character.codePointAt(0);
    if (codePoint === 0x20) result += '\u3000';
    else if (codePoint >= 0x21 && codePoint <= 0x7e) result += String.fromCodePoint(codePoint + 0xfee0);
    else if (codePoint >= 0xff61 && codePoint <= 0xff9f) {
      let converted = character.normalize('NFKC');
      const mark = HALF_WIDTH_MARKS.get(characters[index + 1]);
      if (codePoint < 0xff9e && mark) {
        converted = `${converted}${mark}`.normalize('NFC');
        index++;
      }
      result += converted;
    } else if (codePoint >= 0xffa0 && codePoint <= 0xffdc) result += character.normalize('NFKC');
    else result += character;
  }
  return result;
}

/** Convert full-width ASCII, mapped Katakana, standalone voicing marks, and canonical Hangul Jamo back to half-width. */
export function convertToHalfWidth(text = '') {
  const characters = [...String(text)];
  let result = '';
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    const codePoint = character.codePointAt(0);
    if (codePoint === 0x3000) result += ' ';
    else if (codePoint >= 0xff01 && codePoint <= 0xff5e) result += String.fromCodePoint(codePoint - 0xfee0);
    else {
      const combiningMark = characters[index + 1];
      if (combiningMark === '\u3099' || combiningMark === '\u309a') {
        const composed = `${character}${combiningMark}`.normalize('NFC');
        const voiced = HALF_WIDTH_TO_FULL_WIDTH.get(composed);
        if (voiced) { result += voiced; index++; continue; }
      }
      result += HALF_WIDTH_TO_FULL_WIDTH.get(character) || FULL_WIDTH_TO_HALF_WIDTH_MARKS.get(character) || character;
    }
  }
  return result;
}

/** Convert only ASCII letters and digits to full-width Roman characters. */
export function convertRomanToFullWidth(text = '') {
  return String(text).replace(/[A-Za-z0-9]/g, character => String.fromCharCode(character.charCodeAt(0) + 0xfee0));
}

/** Convert only full-width Roman letters and digits to ASCII. */
export function convertRomanToHalfWidth(text = '') {
  return String(text).replace(/[０-９Ａ-Ｚａ-ｚ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xfee0));
}

export function applyLineEndings(text = '', lineEndings = [], fallback = 'LF') {
  let index = 0;
  return String(text).replace(LINE_ENDING_PATTERN, () => LINE_ENDING_VALUES[lineEndings[index++] || fallback] || '\n');
}

function countLineFeeds(text, from, to) {
  let count = 0;
  for (let index = text.indexOf('\n', from); index >= 0 && index < to; index = text.indexOf('\n', index + 1)) count++;
  return count;
}

function appendFallbackLineEndings(text, from, to, result, fallback) {
  for (let index = text.indexOf('\n', from); index >= 0 && index < to; index = text.indexOf('\n', index + 1)) result.push(fallback);
}

export function mapLineEndings(changes, oldText, newText, oldLineEndings = [], fallback = 'LF') {
  const result = [];
  let oldCursor = 0;
  let newCursor = 0;
  let endingIndex = 0;

  // A line ending survives only when its LF remains inside an unchanged ChangeSet gap.
  // Any LF introduced by a replacement uses the document's fallback style.
  changes.iterGaps((fromA, fromB, length) => {
    endingIndex += countLineFeeds(oldText, oldCursor, fromA);
    appendFallbackLineEndings(newText, newCursor, fromB, result, fallback);
    const unchangedEnd = fromA + length;
    for (let index = oldText.indexOf('\n', fromA); index >= 0 && index < unchangedEnd; index = oldText.indexOf('\n', index + 1)) {
      result.push(oldLineEndings[endingIndex++] || fallback);
    }
    oldCursor = fromA + length;
    newCursor = fromB + length;
  });

  endingIndex += countLineFeeds(oldText, oldCursor, oldText.length);
  appendFallbackLineEndings(newText, newCursor, newText.length, result, fallback);
  return result;
}
