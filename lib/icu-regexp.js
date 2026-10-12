function escapeQuotedCharacter(character, insideCharacterClass) {
  if (insideCharacterClass) return character.replace(/[\\\]\-^]/g, '\\$&');
  return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HORIZONTAL_CLASS = '\\t\\p{Zs}';
const VERTICAL_CLASS = '\\n\\v\\f\\r\\u0085\\u2028\\u2029';
const WORD_CLASS = '[\\p{Alphabetic}\\p{M}\\p{Nd}\\p{Pc}\\u200C\\u200D]';
const WORD_CLASS_CONTENT = WORD_CLASS.slice(1, -1);
const WORD_BOUNDARY = `(?:(?<=${WORD_CLASS})(?!${WORD_CLASS})|(?<!${WORD_CLASS})(?=${WORD_CLASS}))`;
const NON_WORD_BOUNDARY = `(?:(?<=${WORD_CLASS})(?=${WORD_CLASS})|(?<!${WORD_CLASS})(?!${WORD_CLASS}))`;

const POSIX_CLASSES = {
  alnum: '\\p{Alphabetic}\\p{M}\\p{Nd}',
  alpha: '\\p{Alphabetic}\\p{M}',
  ascii: '\\x00-\\x7F',
  blank: '\\t\\p{Zs}',
  cntrl: '\\p{Cc}',
  digit: '\\p{Nd}',
  lower: '\\p{Ll}',
  print: '\\P{Cc}',
  punct: '\\p{P}',
  space: '\\p{White_Space}',
  upper: '\\p{Lu}',
  word: WORD_CLASS_CONTENT,
  xdigit: 'A-Fa-f0-9'
};
const NEGATABLE_POSIX_CLASSES = new Set(['alpha', 'cntrl', 'digit', 'lower', 'print', 'punct', 'space', 'upper']);

function characterClassStart(source, closeIndex) {
  let inClass = false;
  let start = -1;
  for (let index = 0; index <= closeIndex; index++) {
    if (source[index] === '\\') {
      if ((source[index + 1] === 'p' || source[index + 1] === 'P') && source[index + 2] === '{') {
        const end = source.indexOf('}', index + 3);
        if (end >= 0) index = end;
      } else index++;
      continue;
    }
    if (inClass && source.startsWith('[:', index)) {
      const end = source.indexOf(':]', index + 2);
      if (end >= 0) { index = end + 1; continue; }
    }
    if (!inClass && source[index] === '[') { inClass = true; start = index; }
    else if (inClass && source[index] === ']') {
      if (index === closeIndex) return start;
      inClass = false;
      start = -1;
    }
  }
  return -1;
}

/** Find only a self-contained consuming atom that can safely guard an unbounded possessive repeat. */
function simpleAtomBefore(source, quantifierIndex) {
  const end = quantifierIndex;
  const previous = end - 1;
  if (previous < 0) return null;

  const prefix = source.slice(0, end);
  const multiCharacterEscape = /\\(?:x[\da-f]{2}|u[\da-f]{4}|u\{[\da-f]+\}|c[^\r\n]|N\{[^{}]+\})$/i.exec(prefix);
  if (multiCharacterEscape) return multiCharacterEscape[0];

  let slashCount = 0;
  const slashIndex = source[previous] === '\\' ? previous : previous - 1;
  for (let index = slashIndex; index >= 0 && source[index] === '\\'; index--) slashCount++;
  if (source[previous] !== '\\' && slashCount % 2 === 1) {
    const marker = source[previous];
    if (marker === 'p' || marker === 'P') return null;
    if (/[A-Za-z0-9]/.test(marker)) {
      if (!'wWdDsShvRnrtaf'.includes(marker)) return null;
    } else if (!'\\^$.*+?()[]{}|/-'.includes(marker)) return null;
    return source.slice(previous - 1, end);
  }
  if (source[previous] === '\\') return slashCount >= 2 ? source.slice(end - 2, end) : null;

  if (source[previous] === '}') {
    const brace = source.lastIndexOf('{', previous);
    const start = brace - 2;
    if (start >= 0 && source[start] === '\\' && (source[start + 1] === 'p' || source[start + 1] === 'P')
        && !source.slice(brace + 1, previous).includes('{')) return source.slice(start, end);
  }
  if (source[previous] === ']') {
    const start = characterClassStart(source, previous);
    if (start >= 0) return source.slice(start, end);
    return '\\]';
  }
  if (source[previous] === '.') return '.';
  if ('(){}*+?|^$['.includes(source[previous])) return null;

  let start = previous;
  const code = source.charCodeAt(previous);
  if (code >= 0xdc00 && code <= 0xdfff && previous > 0) {
    const high = source.charCodeAt(previous - 1);
    if (high >= 0xd800 && high <= 0xdbff) start--;
  }
  return source.slice(start, end);
}

function simpleNonCapturingGroupAtomBefore(source, quantifierIndex) {
  if (source[quantifierIndex - 1] !== ')') return null;
  const stack = [];
  for (let index = 0; index < quantifierIndex; index++) {
    if (source[index] === '\\') { index++; continue; }
    if (source[index] === '[') {
      let end = index + 1;
      for (; end < quantifierIndex; end++) {
        if (source[end] === '\\') {
          if ((source[end + 1] === 'p' || source[end + 1] === 'P') && source[end + 2] === '{') {
            const propertyEnd = source.indexOf('}', end + 3);
            if (propertyEnd < 0) return null;
            end = propertyEnd;
          } else end++;
          continue;
        }
        if (source.startsWith('[:', end)) {
          const posixEnd = source.indexOf(':]', end + 2);
          if (posixEnd >= 0) { end = posixEnd + 1; continue; }
        }
        if (source[end] === ']') break;
      }
      if (end >= quantifierIndex) return null;
      index = end;
      continue;
    }
    if (source[index] === '(') stack.push(index);
    else if (source[index] === ')') {
      const start = stack.pop();
      if (index === quantifierIndex - 1) {
        if (start == null || !source.startsWith('(?:', start)) return null;
        const expression = source.slice(start, quantifierIndex);
        const atom = expression.slice(3, -1);
        return atom && simpleAtomBefore(atom, atom.length) === atom ? { atom, expression } : null;
      }
    }
  }
  return null;
}

function posixClass(source, index, output) {
  if (!source.startsWith('[:', index)) return null;
  const end = source.indexOf(':]', index + 2);
  if (end < 0) throw new SyntaxError('Unterminated POSIX character class.');
  const name = source.slice(index + 2, end);
  const negative = name.startsWith('^');
  const key = negative ? name.slice(1) : name;
  const value = POSIX_CLASSES[key];
  if (negative && key === 'xdigit') {
    if (!output.endsWith('[') || source[end + 2] !== ']') throw new SyntaxError('Negated POSIX xdigit must be the only member of a character class.');
    return { value: `^${value}`, end };
  }
  if (!value || (negative && !NEGATABLE_POSIX_CLASSES.has(key))) throw new SyntaxError(`Unsupported POSIX character class: ${name}.`);
  return { value: negative ? value.replaceAll('\\p{', '\\P{') : value, end };
}

function escapedPunctuation(character, insideCharacterClass) {
  const escapable = insideCharacterClass ? '\\\\]-^' : '\\\\^$.*+?()[]{}|/';
  return escapable.includes(character) ? `\\${character}` : character;
}

function fixedWidthAtomicGroupEnd(source, start) {
  let inCharacterClass = false;
  for (let index = start + 3; index < source.length; index++) {
    const character = source[index];
    if (character === '\\') {
      const next = source[index + 1];
      if (next === undefined || next === 'R' || next === 'X' || next === 'k' || /[1-9]/.test(next)) return null;
      if ((next === 'p' || next === 'P') && source[index + 2] === '{') {
        const end = source.indexOf('}', index + 3);
        if (end < 0) return null;
        index = end;
      } else index++;
      continue;
    }
    if (inCharacterClass) {
      if (character === ']') inCharacterClass = false;
      continue;
    }
    if (character === '[') { inCharacterClass = true; continue; }
    if (character === ')') return index;
    if (character === '(' || character === '|' || /[*+?]/.test(character)) return null;
    if (character === '{' && /^\{\d+(?:,\d*)?\}/.test(source.slice(index))) return null;
  }
  return null;
}

/** Instrument ICU \b/\B as empty captures so callers can validate UAX #29 boundaries against the input text. */
export function instrumentIcuWordBoundaries(pattern = '') {
  const source = String(pattern);
  const captures = [];
  const boundaries = [];
  const backreferences = [];
  let inCharacterClass = false;
  let classCanClose = false;
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '\\' && source[index + 1] === 'E') { quoted = false; index++; }
      continue;
    }
    if (character === '\\') {
      const next = source[index + 1];
      if (next === 'Q' && !inCharacterClass) { quoted = true; index++; continue; }
      if (inCharacterClass) { classCanClose = true; index++; continue; }
      if (next === 'b' || next === 'B') {
        boundaries.push({ from: index, to: index + 2, positive: next === 'b' });
        index++;
        continue;
      }
      if (/[1-9]/.test(next || '')) {
        let end = index + 2;
        while (/\d/.test(source[end] || '')) end++;
        backreferences.push({ from: index, to: end, target: Number(source.slice(index + 1, end)) });
        index = end - 1;
        continue;
      }
      if ((next === 'p' || next === 'P') && source[index + 2] === '{') {
        const end = source.indexOf('}', index + 3);
        if (end >= 0) { index = end; continue; }
      }
      if (next !== undefined) index++;
      continue;
    }
    if (inCharacterClass) {
      if (source.startsWith('[:', index)) {
        const end = source.indexOf(':]', index + 2);
        if (end >= 0) { index = end + 1; classCanClose = true; continue; }
      }
      if (character === ']' && classCanClose) { inCharacterClass = false; classCanClose = false; }
      else if (character !== '^' || classCanClose) classCanClose = true;
      continue;
    }
    if (character === '[') { inCharacterClass = true; classCanClose = false; continue; }
    if (character === '(') {
      const namedCapture = source.startsWith('(?<', index)
        && source[index + 3] !== '=' && source[index + 3] !== '!';
      if (source[index + 1] !== '?' || namedCapture) captures.push(index);
    }
  }

  const countBefore = (items, position) => {
    let low = 0;
    let high = items.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (items[middle] < position) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const boundaryPositions = boundaries.map(item => item.from);
  const originalCaptureIndexes = captures.map((position, index) => index + 1 + countBefore(boundaryPositions, position));
  const boundaryGroups = boundaries.map((item, index) => ({
    group: 1 + countBefore(captures, item.from) + countBefore(boundaryPositions, item.from),
    positive: item.positive
  }));
  const replacements = boundaries.map(item => ({ from: item.from, to: item.to, text: '()' }));
  for (const reference of backreferences) {
    const replacement = originalCaptureIndexes[reference.target - 1];
    if (replacement) replacements.push({ from: reference.from, to: reference.to, text: `\\${replacement}` });
  }
  replacements.sort((left, right) => left.from - right.from);
  let instrumented = '';
  let offset = 0;
  for (const replacement of replacements) {
    if (replacement.from < offset) continue;
    instrumented += source.slice(offset, replacement.from) + replacement.text;
    offset = replacement.to;
  }
  instrumented += source.slice(offset);
  return { pattern: instrumented, boundaryGroups, originalCaptureIndexes };
}

/**
 * Translate a practical ICU regular-expression subset to JavaScript syntax.
 * The converter covers CotEditor syntax packages' common line breaks, Unicode
 * classes, quoting, anchors, POSIX classes, and word boundaries. It is not a
 * replacement for ICU's complete regular-expression engine.
 */
export function translateIcuRegex(pattern = '') {
  const source = String(pattern);
  let output = '';
  let inCharacterClass = false;
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];

    if (quoted) {
      if (character === '\\' && source[index + 1] === 'E') {
        quoted = false;
        index++;
      } else {
        output += escapeQuotedCharacter(character, inCharacterClass);
      }
      continue;
    }

    if (character === '\\') {
      const next = source[index + 1];
      if (next === undefined) {
        output += '\\\\';
        continue;
      }
      if (next === 'Q') {
        quoted = true;
        index++;
        continue;
      }
      if (next === 'A') {
        if (inCharacterClass) throw new SyntaxError('ICU anchors cannot be used inside a character class.');
        output += '(?<![\\s\\S])';
        index++;
        continue;
      }
      if (next === 'z') {
        if (inCharacterClass) throw new SyntaxError('ICU anchors cannot be used inside a character class.');
        output += '(?![\\s\\S])';
        index++;
        continue;
      }
      if (next === 'Z') {
        if (inCharacterClass) throw new SyntaxError('ICU anchors cannot be used inside a character class.');
        output += '(?=(?:\\r\\n|[\\n\\r\\u0085\\u2028\\u2029])?(?![\\s\\S]))';
        index++;
        continue;
      }
      if (next === 'R') {
        if (inCharacterClass) throw new SyntaxError('ICU \\R cannot be used inside a character class.');
        output += '(?:\\r\\n|[\\n\\r\\u000B\\u000C\\u0085\\u2028\\u2029])';
        index++;
        continue;
      }
      if (next === 'h' || next === 'v') {
        const characterSet = next === 'h' ? HORIZONTAL_CLASS : VERTICAL_CLASS;
        output += inCharacterClass ? characterSet : `[${characterSet}]`;
        index++;
        continue;
      }
      if (next === 'w') {
        output += inCharacterClass ? WORD_CLASS_CONTENT : WORD_CLASS;
        index++;
        continue;
      }
      if (next === 'W') {
        if (inCharacterClass) {
          if (source.startsWith('[\\W]', index - 1)) {
            output = output.slice(0, -1) + `[^${WORD_CLASS_CONTENT}]`;
            inCharacterClass = false;
            index += 2;
            continue;
          }
          throw new SyntaxError('ICU \\W cannot be combined inside a character class.');
        }
        output += `[^${WORD_CLASS_CONTENT}]`;
        index++;
        continue;
      }
      if (next === 'd' || next === 'D') {
        output += `\\${next === 'd' ? 'p' : 'P'}{Nd}`;
        index++;
        continue;
      }
      if (next === 'b') {
        output += inCharacterClass ? '\\b' : WORD_BOUNDARY;
        index++;
        continue;
      }
      if (next === 'B') {
        if (inCharacterClass) throw new SyntaxError('ICU \\B cannot be used inside a character class.');
        output += NON_WORD_BOUNDARY;
        index++;
        continue;
      }
      if (next === 'G') {
        if (inCharacterClass) throw new SyntaxError('ICU anchors cannot be used inside a character class.');
        throw new SyntaxError('ICU \\G is not supported by this compatibility layer.');
      }
      if (/[A-Za-z0-9]/.test(next)) {
        output += `\\${next}`;
      } else {
        output += escapedPunctuation(next, inCharacterClass);
      }
      index++;
      continue;
    }

    if (!inCharacterClass && ['*', '+', '?'].includes(character) && source[index + 1] === '+') {
      const optionalGroup = character === '?' ? simpleNonCapturingGroupAtomBefore(source, index) : null;
      const atom = simpleAtomBefore(source, index) || optionalGroup?.atom;
      if (!atom) throw new SyntaxError('ICU possessive quantifiers are not supported for compound atoms by this compatibility layer.');
      const translatedAtom = translateIcuRegex(atom);
      if (character === '?') {
        if (atom === '\\R') throw new SyntaxError('ICU possessive optional quantifiers on variable-width atoms are not supported.');
        const emittedAtom = translateIcuRegex(optionalGroup?.expression || atom);
        if (!output.endsWith(emittedAtom)) throw new SyntaxError('ICU possessive optional quantifier could not safely isolate its atom.');
        output = output.slice(0, -emittedAtom.length);
        output += `(?:${translatedAtom}|(?!${translatedAtom}))`;
      } else output += `${character}(?!${translatedAtom})`;
      index++;
      continue;
    }

    if (!inCharacterClass && source.startsWith('(?>', index)) {
      const end = fixedWidthAtomicGroupEnd(source, index);
      if (end == null) throw new SyntaxError('Atomic groups with backtracking-dependent content are not supported.');
      output += '(?:';
      index += 2;
      continue;
    }

    if (!inCharacterClass && ['*', '+', '?', '}'].includes(character) && source[index + 1] === '+') {
      throw new SyntaxError('ICU possessive quantifiers are not supported by this compatibility layer.');
    }
    if (character === ']' && !inCharacterClass) {
      output += '\\]';
      continue;
    }

    if (inCharacterClass && character === '[') {
      const posix = posixClass(source, index, output);
      if (posix) {
        output += posix.value;
        index = posix.end + 1;
        continue;
      }
      throw new SyntaxError('Nested ICU character classes are not supported by this compatibility layer.');
    }

    if (character === '[') {
      inCharacterClass = true;
    } else if (character === ']' && inCharacterClass) {
      inCharacterClass = false;
    }
    output += character;
  }

  if (inCharacterClass) throw new SyntaxError('Unterminated character class.');
  return output;
}

/** Return sorted zero-based line indices containing at least one RegExp match. */
export function findMatchingLineIndices(text = '', regex) {
  const source = String(text);
  if (!(regex instanceof RegExp) || !regex.global) throw new TypeError('A global RegExp is required.');

  const lineStarts = [0];
  for (const match of source.matchAll(/\r\n|[\n\r\u0085\u2028\u2029]/g)) lineStarts.push(match.index + match[0].length);
  const lineIndexAt = offset => {
    let low = 0;
    let high = lineStarts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (lineStarts[middle] <= offset) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  };

  const matchingLines = [];
  const seen = new Set();
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(source))) {
    const lineIndex = lineIndexAt(match.index);
    if (!seen.has(lineIndex)) {
      seen.add(lineIndex);
      matchingLines.push(lineIndex);
    }
    if (match[0].length === 0) {
      const codePoint = source.codePointAt(regex.lastIndex);
      regex.lastIndex += codePoint != null && codePoint > 0xffff ? 2 : 1;
    }
  }
  return matchingLines;
}
