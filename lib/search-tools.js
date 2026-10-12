import { SearchQuery } from '@codemirror/search';
import { normalizeLineEndings } from './text-tools.js';

const DIACRITIC_CHARACTER = /^\p{Diacritic}$/u;
const NO_MATCH = Object.freeze({ from: -1, to: -1, precise: true });

function canonicalSearchText(value, caseSensitive, ignoreDiacritics = false) {
  let normalized = String(value).normalize('NFD');
  if (ignoreDiacritics) normalized = normalized.replace(/\p{Diacritic}/gu, '');
  if (caseSensitive) return normalized;
  // Match CodeMirror's locale-insensitive, per-scalar case folding without
  // admitting compatibility decompositions from its default NFKD search.
  return [...normalized].map(character => character.toLowerCase()).join('');
}

function foldSearchCharacter(character, caseSensitive) {
  const codePoint = character.codePointAt(0);
  if (codePoint <= 0x7f) {
    return !caseSensitive && codePoint >= 0x41 && codePoint <= 0x5a
      ? String.fromCharCode(codePoint + 0x20)
      : character;
  }
  const normalized = [...character.normalize('NFD')].filter(item => !DIACRITIC_CHARACTER.test(item));
  return (caseSensitive ? normalized : normalized.map(item => item.toLowerCase())).join('');
}

function foldSearchTextWithOffsets(value, caseSensitive) {
  const source = String(value);
  const segments = [];
  let folded = '';
  let lastOutput = null;

  for (let sourceFrom = 0; sourceFrom < source.length;) {
    const character = String.fromCodePoint(source.codePointAt(sourceFrom));
    const sourceTo = sourceFrom + character.length;
    const valueForCharacter = foldSearchCharacter(character, caseSensitive);
    const foldedFrom = folded.length;
    folded += valueForCharacter;

    if (valueForCharacter) {
      const segment = valueForCharacter === character
        ? null
        : { foldedFrom, foldedTo: folded.length, sourceFrom, sourceTo, deltaBefore: 0, deltaAfter: 0 };
      if (segment) segments.push(segment);
      lastOutput = { foldedFrom, foldedTo: folded.length, sourceFrom, sourceTo, segment };
    } else if (lastOutput) {
      // Keep removed marks inside the preceding match's source range. This
      // prevents Replace from leaving a combining accent behind in the text.
      if (!lastOutput.segment) {
        lastOutput.segment = {
          foldedFrom: lastOutput.foldedFrom,
          foldedTo: lastOutput.foldedTo,
          sourceFrom: lastOutput.sourceFrom,
          sourceTo,
          deltaBefore: 0,
          deltaAfter: 0
        };
        segments.push(lastOutput.segment);
      } else {
        lastOutput.segment.sourceTo = sourceTo;
      }
      lastOutput.sourceTo = sourceTo;
    }

    sourceFrom = sourceTo;
  }

  let delta = 0;
  for (const segment of segments) {
    segment.deltaBefore = delta;
    delta += (segment.sourceTo - segment.sourceFrom) - (segment.foldedTo - segment.foldedFrom);
    segment.deltaAfter = delta;
  }

  return { text: folded, segments };
}

function mapFoldedBoundary(index, segments, side) {
  let low = 0;
  let high = segments.length - 1;
  let previous = null;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const segment = segments[middle];
    if (index < segment.foldedFrom) {
      high = middle - 1;
    } else if (index >= segment.foldedTo) {
      previous = segment;
      low = middle + 1;
    } else {
      return side === 'start' ? segment.sourceFrom : segment.sourceTo;
    }
  }

  return index + (side === 'end' ? 1 : 0) + (previous?.deltaAfter || 0);
}

function characterBefore(state, position) {
  if (position <= 0) return '';
  let from = position - 1;
  const last = state.sliceDoc(from, position);
  const unit = last.charCodeAt(0);
  if (unit >= 0xdc00 && unit <= 0xdfff && from > 0) {
    const first = state.sliceDoc(from - 1, from);
    const lead = first.charCodeAt(0);
    if (lead >= 0xd800 && lead <= 0xdbff) return first + last;
  }
  return last;
}

function characterAfter(state, position) {
  if (position >= state.doc.length) return '';
  let to = position + 1;
  const first = state.sliceDoc(position, to);
  const lead = first.charCodeAt(0);
  if (lead >= 0xd800 && lead <= 0xdbff && to < state.doc.length) {
    const last = state.sliceDoc(to, to + 1);
    const trail = last.charCodeAt(0);
    if (trail >= 0xdc00 && trail <= 0xdfff) return first + last;
  }
  return first;
}

function isWholeWordRange(state, from, to) {
  const categorize = state.charCategorizer(state.selection.main.head);
  const wordCategory = categorize('a');
  const isWord = character => Boolean(character) && categorize(character) === wordCategory;
  return (!isWord(characterBefore(state, from)) || !isWord(characterAfter(state, from)))
    && (!isWord(characterAfter(state, to)) || !isWord(characterBefore(state, to)));
}

function diacriticInsensitiveCursor(state, query, from = 0, to = state.doc.length) {
  const documentLength = state.doc.length;
  const start = Math.max(0, Math.min(documentLength, Number.isInteger(from) ? from : 0));
  const end = Math.max(start, Math.min(documentLength, Number.isInteger(to) ? to : documentLength));
  const source = state.doc.sliceString(start, end);
  const foldedSource = foldSearchTextWithOffsets(source, query.caseSensitive);
  const needle = foldSearchTextWithOffsets(query.unquoted, query.caseSensitive).text;
  let nextFrom = 0;
  let done = !needle;
  let value = NO_MATCH;

  return {
    get done() { return done; },
    get value() { return value; },
    next() {
      while (!done) {
        const index = foldedSource.text.indexOf(needle, nextFrom);
        if (index < 0) {
          done = true;
          value = NO_MATCH;
          return this;
        }
        const foldedTo = index + needle.length;
        const localFrom = mapFoldedBoundary(index, foldedSource.segments, 'start');
        const localTo = mapFoldedBoundary(foldedTo - 1, foldedSource.segments, 'end');
        const matchFrom = start + localFrom;
        const matchTo = start + localTo;
        if (query.wholeWord && !isWholeWordRange(state, matchFrom, matchTo)) {
          nextFrom = index + 1;
          if (foldedSource.text.charCodeAt(index) >= 0xd800 && foldedSource.text.charCodeAt(index) <= 0xdbff
              && foldedSource.text.charCodeAt(index + 1) >= 0xdc00 && foldedSource.text.charCodeAt(index + 1) <= 0xdfff) nextFrom++;
          continue;
        }
        nextFrom = index + needle.length;
        value = { from: matchFrom, to: matchTo, precise: true };
        return this;
      }
      return this;
    }
  };
}

function includeTrailingDiacritics(match, state, from, to) {
  if (!state?.doc || !Number.isInteger(to)) return match;
  let end = to;
  while (end < state.doc.length) {
    const character = characterAfter(state, end);
    if (!character || !DIACRITIC_CHARACTER.test(character)) break;
    end += character.length;
  }
  return end === to ? match : state.sliceDoc(from, end);
}

/**
 * Build the shared CodeMirror query. Literal searches use canonical equivalence
 * (NFD) rather than compatibility decompositions; the opt-in diacritic mode
 * scans a folded copy and maps every result back to its original text range.
 * Regular-expression queries keep CodeMirror's normal regexp behavior.
 */
export function createSearchQuery(config) {
  const query = new SearchQuery(config);
  if (!query.regexp) {
    const ignoreDiacritics = config?.diacriticInsensitive === true;
    const expected = canonicalSearchText(query.unquoted, query.caseSensitive, ignoreDiacritics);
    query.test = (match, state, from, to) => {
      const actual = includeTrailingDiacritics(match, state, from, to);
      return canonicalSearchText(actual, query.caseSensitive, ignoreDiacritics) === expected;
    };
    if (ignoreDiacritics) {
      const originalGetCursor = query.getCursor.bind(query);
      query.getCursor = (state, from = 0, to) => {
        if (!state?.doc?.sliceString) return originalGetCursor(state, from, to);
        return diacriticInsensitiveCursor(state, query, from, to);
      };
    }
  }
  return query;
}

/**
 * Collect the same matches the CodeMirror search panel highlights, including
 * zero-width matches. Returned RegExp match arrays use document-wide offsets.
 */
export function collectSearchMatches(state, query) {
  if (!state?.doc || !(query instanceof SearchQuery)) {
    throw new TypeError('A CodeMirror EditorState and SearchQuery are required.');
  }
  if (!query.valid) throw new SyntaxError('Invalid search query.');

  const source = state.doc.toString();
  const cursor = query.getCursor(state);
  const matches = [];
  while (!cursor.next().done) {
    const { from, match: rawMatch } = cursor.value;
    const match = rawMatch ? [...rawMatch] : [state.sliceDoc(from, cursor.value.to)];
    if (rawMatch?.groups !== undefined) match.groups = rawMatch.groups;
    if (rawMatch?.indices !== undefined) match.indices = rawMatch.indices;
    match.index = from;
    match.input = source;
    matches.push(match);
  }
  return matches;
}

/** Build disjoint literal/regexp replacement edits with normalized LF insertions. */
export function createSearchReplacementChanges(matches, replacementForMatch) {
  if (!Array.isArray(matches) || typeof replacementForMatch !== 'function') {
    throw new TypeError('Search matches and a replacement function are required.');
  }
  return matches.map(match => {
    if (!Number.isSafeInteger(match?.index) || typeof match?.[0] !== 'string') {
      throw new TypeError('Each search match must include a document offset and matched text.');
    }
    return {
      from: match.index,
      to: match.index + match[0].length,
      insert: normalizeLineEndings(replacementForMatch(match), 'LF')
    };
  });
}

/** Return the next sorted match index, wrapping at either end of the document. */
export function nextSearchMatchIndex(matches, selection, backwards = false, currentIndex = -1) {
  if (!matches.length) return -1;

  const current = Number.isInteger(currentIndex) ? matches[currentIndex] : null;
  if (current
      && current.index === selection.from
      && current.index + current[0].length === selection.to) {
    return (currentIndex + (backwards ? -1 : 1) + matches.length) % matches.length;
  }

  if (backwards) {
    for (let index = matches.length - 1; index >= 0; index--) {
      if (matches[index].index + matches[index][0].length <= selection.from) return index;
    }
    return matches.length - 1;
  }

  for (let index = 0; index < matches.length; index++) {
    if (matches[index].index >= selection.to) return index;
  }
  return 0;
}

/** Convert raw line separators in a user query to CodeMirror's internal LF. */
export function normalizeSearchLineEndings(search = '') {
  return String(search).replace(/\r\n|\r|\n|\u0085|\u2028|\u2029/g, '\n');
}
