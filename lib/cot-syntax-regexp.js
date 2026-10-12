import { translateIcuRegex } from './icu-regexp.js';

export const MAX_COT_SYNTAX_PATTERN_LENGTH = 512;
const MAX_SAFE_BACKREFERENCE_REPEAT = 8;
const classRegexCache = new Map();

function skipCharacterClass(source, start) {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') { index++; continue; }
    if (source.startsWith('[:', index)) {
      const end = source.indexOf(':]', index + 2);
      if (end >= 0) { index = end + 1; continue; }
    }
    if (source[index] === ']') return index + 1;
  }
  return source.length;
}

function stripEscapesAndClasses(pattern) {
  let result = '';
  for (let index = 0; index < pattern.length; index++) {
    if (pattern[index] === '\\') {
      result += '_';
      index++;
    } else if (pattern[index] === '[') {
      const end = skipCharacterClass(pattern, index);
      result += '_';
      index = end - 1;
    } else result += pattern[index];
  }
  return result;
}

function quantifierAt(source, index) {
  const character = source[index];
  if (character === '*' || character === '+') return { end: index + 1, unbounded: true };
  if (character === '?') return { end: index + 1, unbounded: false };
  if (character !== '{') return null;
  const match = /^\{(\d+)(?:,(\d*)?)?\}/.exec(source.slice(index));
  if (!match) return null;
  return { end: index + match[0].length, unbounded: match[2] === '' };
}

function groupList(source) {
  const stack = [];
  const groups = [];
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\') { index++; continue; }
    if (source[index] === '[') { index = skipCharacterClass(source, index) - 1; continue; }
    if (source[index] === '(') stack.push(index);
    else if (source[index] === ')' && stack.length) {
      const start = stack.pop();
      const quantifier = quantifierAt(source, index + 1);
      if (quantifier?.unbounded) groups.push({ start, end: index, repeatEnd: quantifier.end, body: source.slice(start + 1, index) });
    }
  }
  return groups;
}

function hasUnboundedQuantifier(source) {
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\') { index++; continue; }
    if (source[index] === '[') { index = skipCharacterClass(source, index) - 1; continue; }
    const quantifier = quantifierAt(source, index);
    if (quantifier?.unbounded) return true;
  }
  return false;
}

function atomAt(source, index) {
  if (index >= source.length) return null;
  const character = source[index];
  if (character === '\\') {
    const next = source[index + 1];
    if (!next) return null;
    if ((next === 'p' || next === 'P') && source[index + 2] === '{') {
      const end = source.indexOf('}', index + 3);
      if (end < 0) return null;
      return { kind: 'property', source: source.slice(index, end + 1), end: end + 1 };
    }
    if (next === 'w' || next === 'W') return { kind: 'word', source: source.slice(index, index + 2), end: index + 2 };
    if (next === 'd' || next === 'D') return { kind: 'digit', source: source.slice(index, index + 2), end: index + 2 };
    if (next === 's' || next === 'S' || next === 'h' || next === 'v') return { kind: 'space', source: source.slice(index, index + 2), end: index + 2 };
    if (next === 'R') return { kind: 'linebreak', source: '\\R', end: index + 2 };
    if (!/[A-Za-z0-9]/.test(next)) return { kind: 'literal', value: next, source: source.slice(index, index + 2), end: index + 2 };
    return null;
  }
  if (character === '[') {
    const end = skipCharacterClass(source, index);
    if (end <= source.length && source[end - 1] === ']') return { kind: 'class', source: source.slice(index, end), end };
    return null;
  }
  if (character === '.') return { kind: 'any', source: '.', end: index + 1 };
  if ('(){}*+?|^$'.includes(character)) return null;
  return { kind: 'literal', value: character, source: character, end: index + 1 };
}

function classMatches(source, character) {
  if (!classRegexCache.has(source)) {
    try { classRegexCache.set(source, new RegExp(`^(?:${translateIcuRegex(source)})$`, 'u')); }
    catch { classRegexCache.set(source, null); }
  }
  return classRegexCache.get(source)?.test(character) ?? true;
}

function atomMatches(atom, character) {
  if (atom.kind === 'literal') return atom.value === character;
  if (atom.kind === 'any') return true;
  if (atom.kind === 'word') return /[\p{L}\p{N}\p{M}_$]/u.test(character);
  if (atom.kind === 'digit') return /\p{Nd}/u.test(character);
  if (atom.kind === 'space') return /\s/u.test(character);
  if (atom.kind === 'linebreak') return /[\n\r\u0085\u2028\u2029]/u.test(character);
  if (atom.kind === 'class') return classMatches(atom.source, character);
  if (atom.kind === 'property') {
    try { return new RegExp(`^(?:${translateIcuRegex(atom.source)})$`, 'u').test(character); }
    catch { return true; }
  }
  return true;
}

function propertyName(atom) {
  if (atom.kind !== 'property') return '';
  const match = /^\\p\{([^}]+)\}$/.exec(atom.source);
  if (!match) return '';
  return match[1].replace(/^General_Category=/, '').toLowerCase();
}

function asciiClassDisjointFrom(atom, category) {
  if (atom.kind !== 'class' || /\\[pP]|\\u|\\x/.test(atom.source) || /[^\x00-\x7f]/.test(atom.source)) return false;
  for (let code = 0; code < 128; code++) {
    const character = String.fromCharCode(code);
    if (!classMatches(atom.source, character)) continue;
    if (category === 'word' && /[\p{L}\p{N}\p{M}_$]/u.test(character)) return false;
    if (category === 'digit' && /\p{Nd}/u.test(character)) return false;
    if (category === 'space' && /\s/u.test(character)) return false;
    if (category === 'linebreak' && /[\n\r\u0085\u2028\u2029]/u.test(character)) return false;
  }
  return true;
}

function atomsAreDisjoint(left, right) {
  if (left.kind === 'literal') return !atomMatches(right, left.value);
  if (right.kind === 'literal') return !atomMatches(left, right.value);
  if (left.kind === 'class' && ['word', 'digit', 'space', 'linebreak'].includes(right.kind)) return asciiClassDisjointFrom(left, right.kind);
  if (right.kind === 'class' && ['word', 'digit', 'space', 'linebreak'].includes(left.kind)) return asciiClassDisjointFrom(right, left.kind);
  if (left.kind === 'property' && right.kind === 'digit' && ['l', 'letter'].includes(propertyName(left))) return true;
  if (right.kind === 'property' && left.kind === 'digit' && ['l', 'letter'].includes(propertyName(right))) return true;
  if (left.kind === 'property' && right.kind === 'property') {
    const a = propertyName(left), b = propertyName(right);
    if (['l', 'letter'].includes(a) && ['nd', 'decimalnumber'].includes(b)) return true;
    if (['nd', 'decimalnumber'].includes(a) && ['l', 'letter'].includes(b)) return true;
  }
  if (left.kind === 'any' && right.kind === 'linebreak' || right.kind === 'any' && left.kind === 'linebreak') return true;
  if (left.kind === 'word' && right.kind === 'space' || left.kind === 'space' && right.kind === 'word') return true;
  if (left.kind === 'digit' && right.kind === 'space' || left.kind === 'space' && right.kind === 'digit') return true;
  if (left.kind === 'linebreak' && (right.kind === 'word' || right.kind === 'digit')
      || right.kind === 'linebreak' && (left.kind === 'word' || left.kind === 'digit')) return true;
  return false;
}

function splitAlternatives(body) {
  let start = 0;
  let depth = 0;
  const parts = [];
  for (let index = 0; index < body.length; index++) {
    if (body[index] === '\\') { index++; continue; }
    if (body[index] === '[') { index = skipCharacterClass(body, index) - 1; continue; }
    if (body[index] === '(') depth++;
    else if (body[index] === ')') depth--;
    else if (body[index] === '|' && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  if (!parts.length) return null;
  parts.push(body.slice(start));
  return parts;
}

function safeRepeatedAlternation(body) {
  const source = body.startsWith('?:') ? body.slice(2) : body;
  const alternatives = splitAlternatives(source);
  if (!alternatives) return false;
  const atoms = alternatives.map(part => {
    const atom = atomAt(part, 0);
    return atom && atom.end === part.length ? atom : null;
  });
  if (atoms.some(atom => !atom)) return false;
  for (let left = 0; left < atoms.length; left++) {
    for (let right = left + 1; right < atoms.length; right++) {
      if (!atomsAreDisjoint(atoms[left], atoms[right])) return false;
    }
  }
  return true;
}

function safeDelimitedNestedRepeat(body) {
  const source = body.startsWith('?:') ? body.slice(2) : body;
  if (splitAlternatives(source)) return false;
  const first = atomAt(source, 0);
  if (!first || first.kind !== 'literal' || quantifierAt(source, first.end)) return false;
  let index = first.end;
  while (index < source.length) {
    if (source[index] === '\\') {
      const atom = atomAt(source, index);
      if (!atom) return false;
      const quantifier = quantifierAt(source, atom.end);
      if (quantifier?.unbounded && !atomsAreDisjoint(first, atom)) return false;
      index = quantifier?.end || atom.end;
      continue;
    }
    if (source[index] === '[' || source[index] === '.') {
      const atom = atomAt(source, index);
      if (!atom) return false;
      const quantifier = quantifierAt(source, atom.end);
      if (quantifier?.unbounded && !atomsAreDisjoint(first, atom)) return false;
      index = quantifier?.end || atom.end;
      continue;
    }
    if (source[index] === '(') return false;
    const atom = atomAt(source, index);
    if (atom) {
      const quantifier = quantifierAt(source, atom.end);
      if (quantifier?.unbounded && !atomsAreDisjoint(first, atom)) return false;
      index = quantifier?.end || atom.end;
      continue;
    }
    const quantifier = quantifierAt(source, index);
    if (quantifier) { index = quantifier.end; continue; }
    return false;
  }
  return true;
}

function hasUnsafeNestedRepeat(source) {
  return groupList(source).some(group => hasUnboundedQuantifier(group.body) && !safeDelimitedNestedRepeat(group.body));
}

function hasUnsafeRepeatedAlternation(source) {
  return groupList(source).some(group => splitAlternatives(group.body) && !safeRepeatedAlternation(group.body));
}

function atomIsSubsetOf(left, right) {
  if (left.source === right.source) return true;
  if (left.kind === 'literal') return atomMatches(right, left.value);
  // ICU/CodeMirror word characters include every Unicode decimal digit.
  return left.kind === 'digit' && right.kind === 'word';
}

function simplifyContainedRepeatedAlternations(pattern) {
  let source = String(pattern);
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const group of groupList(source)) {
      const prefix = group.body.startsWith('?:') ? '?:' : '';
      if (!prefix && group.body.startsWith('?')) continue;
      const alternatives = splitAlternatives(group.body.slice(prefix.length));
      if (!alternatives) continue;
      const atoms = alternatives.map(part => {
        const atom = atomAt(part, 0);
        return atom && atom.end === part.length ? atom : null;
      });
      if (atoms.some(atom => !atom)) continue;
      const redundant = atoms.map((atom, index) => atoms.some((other, otherIndex) =>
        index !== otherIndex && atomIsSubsetOf(atom, other) && !atomIsSubsetOf(other, atom)));
      if (!redundant.some(Boolean)) continue;
      const kept = alternatives.filter((_part, index) => !redundant[index]);
      if (!kept.length) continue;
      source = source.slice(0, group.start) + `(${prefix}${kept.join('|')})` + source.slice(group.end + 1);
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return source;
}

// Bound both the captured atom and any direct reference to keep backtracking finite.
function boundedSingleAtomCapture(body) {
  const atom = atomAt(body, 0);
  if (!atom) return null;
  if (atom.end === body.length) return { kind: 'simple' };

  const quantifier = quantifierAt(body, atom.end);
  if (!quantifier || quantifier.unbounded || quantifier.end !== body.length) return null;
  const bounds = /^\{(\d+)(?:,(\d+))?\}$/.exec(body.slice(atom.end, quantifier.end));
  if (!bounds) return null;
  const minimum = Number(bounds[1]);
  const maximum = Number(bounds[2] ?? bounds[1]);
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
      || minimum < 1 || maximum > MAX_SAFE_BACKREFERENCE_REPEAT || minimum > maximum
      || !['literal', 'class', 'property', 'word', 'digit', 'space'].includes(atom.kind)) return null;
  return { kind: 'bounded' };
}

function safeNumericBackreferencesOnly(source) {
  const stack = [];
  const captures = new Map();
  let captureNumber = 0;
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\') { index++; continue; }
    if (source[index] === '[') { index = skipCharacterClass(source, index) - 1; continue; }
    if (source[index] === '(') {
      let capturing = source[index + 1] !== '?';
      let bodyStart = index + (capturing ? 1 : 2);
      if (source.startsWith('(?<', index) && source[index + 3] !== '=' && source[index + 3] !== '!') {
        const end = source.indexOf('>', index + 3);
        if (end > 0) { capturing = true; bodyStart = end + 1; }
      }
      stack.push({ capturing, number: capturing ? ++captureNumber : 0, bodyStart });
    } else if (source[index] === ')' && stack.length) {
      const group = stack.pop();
      if (group.capturing) {
        const body = source.slice(group.bodyStart, index);
        const safeCapture = boundedSingleAtomCapture(body);
        if (safeCapture) {
          captures.set(group.number, {
            ...safeCapture,
            repeated: safeCapture.kind === 'bounded' && Boolean(quantifierAt(source, index + 1))
          });
        }
      }
    }
  }
  let references = 0;
  for (let index = 0; index < source.length; index++) {
    if (source[index] !== '\\') continue;
    const next = source[index + 1];
    if (next === '\\') { index++; continue; }
    if (/[1-9]/.test(next || '')) {
      const hasSecondDigit = /\d/.test(source[index + 2] || '');
      const reference = Number(next + (hasSecondDigit ? source[index + 2] : ''));
      const capture = captures.get(reference);
      if (!capture) return false;
      if (capture.kind === 'bounded') {
        if (capture.repeated) return false;
        const referenceEnd = index + (hasSecondDigit ? 3 : 2);
        const quantifier = quantifierAt(source, referenceEnd);
        if (quantifier) {
          const bounds = /^\{(\d+)(?:,(\d+))?\}$/.exec(source.slice(referenceEnd, quantifier.end));
          const maximum = bounds ? Number(bounds[2] ?? bounds[1]) : Infinity;
          if (!bounds || quantifier.unbounded || !Number.isSafeInteger(maximum) || maximum > MAX_SAFE_BACKREFERENCE_REPEAT
              || source[quantifier.end] === '?' || source[quantifier.end] === '+') return false;
        }
      }
      references++;
      if (hasSecondDigit) index++;
    } else if (next === 'k' && source[index + 2] === '<') {
      return false;
    }
  }
  return references > 0;
}

/**
 * Reject constructs with a high risk of exponential backtracking in JavaScript's
 * synchronous RegExp engine. This intentionally favors responsiveness over
 * accepting every ICU expression; it is not a general-purpose ReDoS proof.
 */
export function cotSyntaxRegexSafetyReason(pattern = '', options = {}) {
  const source = simplifyContainedRepeatedAlternations(String(pattern));
  if (!source || source.length > MAX_COT_SYNTAX_PATTERN_LENGTH) return 'pattern-length';
  if (/\\(?:[1-9]|k<)/.test(source) && !(options.allowSimpleBackreferences && safeNumericBackreferencesOnly(source))) return 'backreference';
  if (hasUnsafeNestedRepeat(source)) return 'nested-quantifier';
  if (hasUnsafeRepeatedAlternation(source)) return 'repeated-alternation';

  const plain = stripEscapesAndClasses(source);
  if (/\.\*[^)]*\.\*/.test(plain)) return 'multiple-wildcards';
  if (/\{\d{5,}(?:,\d*)?\}/.test(plain)) return 'large-repeat';
  return '';
}

function extractLeadingFlags(pattern, options) {
  let source = String(pattern);
  const flags = { ignoreCase: options.ignoreCase === true, multiline: options.multiline === true, dotAll: options.dotAll === true };
  const leading = /^\(\?([ims]+)\)/.exec(source);
  if (leading) {
    for (const flag of leading[1]) {
      if (flag === 'i') flags.ignoreCase = true;
      if (flag === 'm') flags.multiline = true;
      if (flag === 's') flags.dotAll = true;
    }
    source = source.slice(leading[0].length);
  }
  return { source, flags };
}

function flattenRedundantSingleAtomRepeats(pattern) {
  let source = String(pattern);
  if (/\\(?:[1-9]|k<)/.test(source)) return source;
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const group of groupList(source)) {
      const offset = group.body.startsWith('?:') ? 2 : 0;
      const body = group.body.slice(offset);
      const atom = atomAt(body, 0);
      if (!atom) continue;
      const inner = quantifierAt(body, atom.end);
      if (!inner?.unbounded || inner.end !== body.length) continue;
      const innerToken = body.slice(atom.end, inner.end);
      const outerToken = source.slice(group.end + 1, group.repeatEnd);
      const merged = innerToken.includes('*') || outerToken.includes('*') ? '*' : '+';
      source = source.slice(0, group.start) + atom.source + merged + source.slice(group.repeatEnd);
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return source;
}

const lineBreakingEscapes = new Set(['R', 's', 'v', 'D', 'W', 'P', 'p', 'A', 'z', 'Z', 'G', 'X', 'n', 'r', 'N', 'k', 'Q', 'u', 'x', 'c']);

function canMatchLineBreak(pattern) {
  const source = String(pattern || '');
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '\\') {
      const next = source[index + 1];
      if (!next) break;
      if (lineBreakingEscapes.has(next) || /[1-9]/.test(next)) return true;
      index++;
      continue;
    }
    if (character === '[') {
      const end = skipCharacterClass(source, index);
      const group = source.slice(index, end);
      if (group[1] === '^' || group.includes('[:') || /\\(?:R|s|v|D|W|P|n|r|N|p|u|x)/.test(group)
          || /[\r\n\u0085\u2028\u2029]/u.test(group)) return true;
      index = end - 1;
      continue;
    }
    if (character === '.' || /[\r\n\u0085\u2028\u2029]/u.test(character)) return true;
  }
  return false;
}

function supportsLineScopedMultilineRule(rule) {
  return typeof rule.end === 'string' && rule.end.length > 0
    && !canMatchLineBreak(rule.begin) && !canMatchLineBreak(rule.end);
}

function branchRequiresTopLevelLineBreak(source) {
  let depth = 0;
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\') {
      if (source[index + 1] === 'R' && depth === 0) {
        const quantifier = quantifierAt(source, index + 2);
        const token = quantifier ? source.slice(index + 2, quantifier.end) : '';
        const minimum = token.startsWith('{') ? Number(/^\{(\d+)/.exec(token)?.[1])
          : token.startsWith('*') || token.startsWith('?') ? 0 : 1;
        if (minimum > 0) return true;
        if (quantifier) index = quantifier.end - 1;
        else index++;
        continue;
      }
      index++;
      continue;
    }
    if (source[index] === '[') { index = skipCharacterClass(source, index) - 1; continue; }
    if (source[index] === '(') depth++;
    else if (source[index] === ')' && depth) depth--;
  }
  return false;
}

function requiresLineBreakOnEveryTopLevelAlternative(pattern) {
  const source = String(pattern);
  const alternatives = splitAlternatives(source) || [source];
  return alternatives.length > 0 && alternatives.every(branchRequiresTopLevelLineBreak);
}

const COTEDITOR_MARKDOWN_BLOCKQUOTE_BEGIN = String.raw`^([ ]{4}|\t)?>[\t ]`;
const COTEDITOR_MARKDOWN_BLOCKQUOTE_END = String.raw`(\R[ \t]*\R)|\z`;

function isCotEditorMarkdownBlockquoteRule(rule) {
  return rule?.category === 'keywords'
    && rule.regularExpression === true
    && rule.isMultiline === true
    && rule.begin === COTEDITOR_MARKDOWN_BLOCKQUOTE_BEGIN
    && rule.end === COTEDITOR_MARKDOWN_BLOCKQUOTE_END;
}

/** Compile a bounded CotEditor ICU-style expression with explicit options. */
export function compileCotSyntaxRegex(pattern = '', options = {}) {
  const extracted = extractLeadingFlags(pattern, options);
  const source = simplifyContainedRepeatedAlternations(extracted.source);
  const safety = cotSyntaxRegexSafetyReason(source, options);
  if (safety) throw new SyntaxError(`Unsafe or unsupported regular expression (${safety}).`);
  const translated = translateIcuRegex(source);
  const flags = `${options.global === false ? '' : 'g'}u${extracted.flags.ignoreCase ? 'i' : ''}${extracted.flags.multiline ? 'm' : ''}${extracted.flags.dotAll ? 's' : ''}`;
  return new RegExp(translated, flags);
}

export function compileCotSyntaxRule(rule) {
  if (!rule || typeof rule !== 'object' || typeof rule.begin !== 'string' || !rule.begin) return null;
  if (rule.regularExpression !== true) return { begin: null, end: null };
  const endOnBlankLine = isCotEditorMarkdownBlockquoteRule(rule);
  // A required top-level ICU line break cannot match StreamLanguage's per-line input.
  if (rule.isMultiline !== true && requiresLineBreakOnEveryTopLevelAlternative(rule.begin)) return null;
  // StreamLanguage evaluates regular-expression begins one editor line at a time.
  // Keep line-scoped multiline ranges only when neither boundary can consume a line break.
  if (rule.isMultiline === true && !supportsLineScopedMultilineRule(rule) && !endOnBlankLine) return null;
  try {
    const begin = compileCotSyntaxRegex(flattenRedundantSingleAtomRepeats(rule.begin), {
      ignoreCase: rule.ignoreCase === true,
      dotAll: false,
      multiline: false,
      global: true,
      allowSimpleBackreferences: true
    });
    const end = rule.end && !endOnBlankLine ? compileCotSyntaxRegex(flattenRedundantSingleAtomRepeats(rule.end), {
      ignoreCase: rule.ignoreCase === true,
      global: true,
      allowSimpleBackreferences: true
    }) : null;
    return { begin, end, ...(endOnBlankLine ? { endOnBlankLine: true } : {}) };
  } catch {
    return null;
  }
}

const SAFE_RST_OVERLINE_OUTLINE_PATTERN = "(?<=[-=`:.'\"~^_*+#]{3}\\R)(.+)(?=\\R([-=`:.'\"~^_*+#])\\2{2,}+$)";

export function compileCotSyntaxOutline(rule) {
  if (!rule || typeof rule.pattern !== 'string' || !rule.pattern) return null;
  try {
    // In this exact upstream rule, the possessive backreference repeat is
    // immediately followed by an end-of-line assertion. Its repeated character
    // class excludes line breaks and `$` requires the run to reach line end, so
    // backtracking cannot create a match; dropping only this terminal marker
    // preserves the rule's match set.
    const pattern = rule.pattern === SAFE_RST_OVERLINE_OUTLINE_PATTERN
      ? rule.pattern.replace('\\2{2,}+$', '\\2{2,}$')
      : rule.pattern;
    return compileCotSyntaxRegex(pattern, {
      ignoreCase: rule.ignoreCase === true,
      multiline: true,
      global: true,
      allowSimpleBackreferences: true
    });
  } catch {
    return null;
  }
}
