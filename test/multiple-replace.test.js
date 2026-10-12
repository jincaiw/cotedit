import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { history, redo, undo } from '@codemirror/commands';
import { applyMultipleReplace, findMultipleReplaceMatches, normalizeMultipleReplaceDefinitions, DEFAULT_MULTIPLE_REPLACE_OPTIONS } from '../lib/multiple-replace.js';
import { applyLineEndings } from '../lib/text-tools.js';
import { documentLineEndingExtensions, documentLineEndingsField } from '../lib/document-line-ending-history.js';

const definition = replacements => ({ id: 'test', name: '测试', replacements });
const applyChanges = (source, changes) => changes.slice().reverse().reduce(
  (text, change) => text.slice(0, change.from) + change.insert + text.slice(change.to),
  source
);

test('new multiple-replace definitions default regex anchors to lines without changing explicit opt-outs', () => {
  assert.equal(DEFAULT_MULTIPLE_REPLACE_OPTIONS.regexAnchorsMatchLines, true);
  assert.equal(DEFAULT_MULTIPLE_REPLACE_OPTIONS.regexUseUnicodeWordBoundaries, false);
  assert.equal(DEFAULT_MULTIPLE_REPLACE_OPTIONS.unescapesReplacementString, false);
  const input = 'head\ncat\ncats';
  const regexDefinition = {
    ...definition([{ findString: '^cat$', replacementString: 'fox', usesRegularExpression: true }]),
    ...DEFAULT_MULTIPLE_REPLACE_OPTIONS
  };
  assert.equal(applyMultipleReplace(input, regexDefinition).text, 'head\nfox\ncats');

  const [storedOptOut] = normalizeMultipleReplaceDefinitions([{
    ...regexDefinition,
    regexAnchorsMatchLines: false
  }]);
  assert.equal(storedOptOut.regexAnchorsMatchLines, undefined);
  assert.equal(applyMultipleReplace(input, storedOptOut).text, input);
});

test('literal multiple-replace matches Unicode canonically equivalent text and maps original ranges', () => {
  const source = 'A·B · café cafe\u0301';
  const result = applyMultipleReplace(source, definition([
    { findString: '·', replacementString: 'dot' },
    { findString: 'cafe\u0301', replacementString: 'coffee' }
  ]));
  assert.equal(result.text, 'AdotB dot coffee coffee');
  assert.equal(result.matchCount, 4);
  assert.equal(applyChanges(source, result.changes), result.text);
  assert.deepEqual(findMultipleReplaceMatches(source, definition([
    { findString: '·', replacementString: 'dot' },
    { findString: 'cafe\u0301', replacementString: 'coffee' }
  ])).map(({ from, to }) => source.slice(from, to)), ['·', '·', 'café', 'cafe\u0301']);
  const supplementaryPrefix = applyMultipleReplace('𝄞·', definition([
    { findString: '·', replacementString: 'dot' }
  ]));
  assert.deepEqual(supplementaryPrefix.changes, [{ from: 2, to: 3, insert: 'dot' }]);

  const selected = applyMultipleReplace(source, definition([
    { findString: 'café', replacementString: 'coffee' }
  ]), { inSelection: true, ranges: [{ from: source.indexOf('cafe\u0301'), to: source.length }] });
  assert.equal(selected.text, 'A·B · café coffee');
  assert.equal(selected.matchCount, 1);
});

test('canonical literal matching does not match only part of a grapheme or normalize regex syntax', () => {
  const source = 'é e\u0301 · ·';
  const partial = applyMultipleReplace(source, definition([
    { findString: 'e', replacementString: 'partial' }
  ]));
  assert.equal(partial.text, source, 'a canonically decomposed grapheme is not partially replaced');
  assert.equal(partial.matchCount, 0);

  const regex = applyMultipleReplace(source, definition([
    { findString: '·', replacementString: 'regex', usesRegularExpression: true }
  ]));
  assert.equal(regex.text, 'é e\u0301 regex ·', 'Unicode equivalence is limited to literal rules');
  assert.equal(regex.matchCount, 1);

  const literalizedRegex = applyMultipleReplace('· ·', {
    ...definition([{ findString: '·', replacementString: 'x', usesRegularExpression: true }]),
    regexIgnoreMetacharacters: true
  });
  assert.equal(literalizedRegex.text, 'x x', 'regex ignore-metacharacters uses the literal search path');
});

test('multiple replacement rules run in order and form one deterministic result', () => {
  const result = applyMultipleReplace('foo foo', definition([
    { findString: 'foo', replacementString: 'bar' },
    { findString: 'bar', replacementString: 'baz' }
  ]));
  assert.equal(result.text, 'baz baz');
  assert.equal(result.matchCount, 4);
  assert.equal(applyChanges('foo foo', result.changes), result.text);
});

test('later rules remap many matches across fragmented source pieces without losing text', () => {
  const source = 'x '.repeat(1000);
  const result = applyMultipleReplace(source, definition([
    { findString: 'x', replacementString: 'a' },
    { findString: 'a', replacementString: 'long' }
  ]));
  assert.equal(result.text, 'long '.repeat(1000));
  assert.equal(result.matchCount, 2000);
  assert.equal(applyChanges(source, result.changes), result.text);
  assert.equal(result.changes.length, 1000);
});

test('disabled rules are skipped and case-insensitive matching is supported', () => {
  const result = applyMultipleReplace('Blue blue BLUE', definition([
    { findString: 'blue', replacementString: 'red', ignoresCase: true },
    { findString: 'red', replacementString: 'wrong', isEnabled: false }
  ]));
  assert.equal(result.text, 'red red red');
  assert.equal(result.matchCount, 3);
});

test('definition-level full-word matching filters literal rules and keeps highlighting in sync', () => {
  const source = 'Cat cat! scatter cat1 _cat cat_ 猫 猫猫 猫a a猫 猫! e\u0301';
  const wholeWordDefinition = {
    ...definition([
      { findString: 'cat', replacementString: 'dog', ignoresCase: true },
      { findString: '猫', replacementString: '犬' },
      { findString: 'e', replacementString: 'accent' }
    ]),
    matchesFullWord: true
  };
  const result = applyMultipleReplace(source, wholeWordDefinition);
  assert.equal(result.text, 'dog dog! scatter cat1 _cat cat_ 犬 猫猫 猫a a猫 犬! e\u0301');
  assert.equal(result.matchCount, 4);
  const highlighted = findMultipleReplaceMatches(source, wholeWordDefinition);
  assert.deepEqual(highlighted.map(({ from, to }) => source.slice(from, to)), ['Cat', 'cat', '猫', '猫']);

  const regex = applyMultipleReplace('scatter cat', {
    ...definition([{ findString: 'cat', replacementString: 'x', usesRegularExpression: true }]),
    matchesFullWord: true
  });
  assert.equal(regex.text, 'sxter x', 'CotEditor applies matchesFullWord to textual rules, not regular expressions');
  assert.equal(regex.matchCount, 2);
});

test('full-word matching follows ICU default word-class transitions at both match boundaries', () => {
  const definitionWithFullWord = {
    ...definition([{ findString: 'cat', replacementString: 'dog' }]),
    matchesFullWord: true
  };
  const source = '‘cat’ !cat cat! Ⅳcat catⅣ ²cat cat² a‿cat cat‿ a\u200ccat cat\u200d';
  const matches = findMultipleReplaceMatches(source, definitionWithFullWord);
  assert.deepEqual(matches.map(({ from, to }) => source.slice(from, to)), ['cat', 'cat', 'cat', 'cat', 'cat']);

  assert.equal(
    applyMultipleReplace(source, definitionWithFullWord).text,
    '‘dog’ !dog dog! Ⅳcat catⅣ ²dog dog² a‿cat cat‿ a\u200ccat cat\u200d'
  );
  assert.equal(
    findMultipleReplaceMatches(' a! b ! ', {
      ...definition([{ findString: '!', replacementString: 'x' }]),
      matchesFullWord: true
    }).length,
    0,
    'a punctuation-only match has no ICU word boundary at either edge'
  );
  assert.deepEqual(
    findMultipleReplaceMatches("can't", {
      ...definition([{ findString: 'can', replacementString: 'x' }]),
      matchesFullWord: true
    }).map(({ from, to }) => [from, to]),
    [[0, 3]],
    'default ICU boundaries treat the apostrophe as non-word rather than applying UAX #29'
  );
});

test('definition-level textual case-insensitivity applies only to literal rules and highlighting', () => {
  const definitionWithOption = {
    ...definition([
      { findString: 'cat', replacementString: 'fox', usesRegularExpression: true },
      { findString: 'cat', replacementString: 'dog' }
    ]),
    textualCaseInsensitive: true
  };
  const result = applyMultipleReplace('CAT cat', definitionWithOption);
  assert.equal(result.text, 'dog fox');
  assert.equal(result.matchCount, 2);
  assert.deepEqual(findMultipleReplaceMatches('CAT cat', definitionWithOption), [
    { from: 0, to: 3 }, { from: 4, to: 7 }
  ]);

  const ruleOptionStillWorks = applyMultipleReplace('CAT cat', definition([
    { findString: 'cat', replacementString: 'dog', ignoresCase: true }
  ]));
  assert.equal(ruleOptionStillWorks.text, 'dog dog');
});

test('definition-level textual anchoring matches only at each target range start for literal rules', () => {
  const anchored = {
    ...definition([{ findString: 'cat', replacementString: 'dog' }]),
    textualAnchored: true
  };
  const result = applyMultipleReplace('cat cat\ncat', anchored);
  assert.equal(result.text, 'dog cat\ncat');
  assert.equal(result.matchCount, 1);
  assert.deepEqual(findMultipleReplaceMatches('cat cat\ncat', anchored), [{ from: 0, to: 3 }]);

  const selectionRanges = [{ from: 0, to: 3 }, { from: 6, to: 9 }];
  const selected = applyMultipleReplace('cat x cat', anchored, { inSelection: true, ranges: selectionRanges });
  assert.equal(selected.text, 'dog x dog');
  assert.equal(selected.matchCount, 2);
  assert.deepEqual(findMultipleReplaceMatches('cat x cat', anchored, { inSelection: true, ranges: selectionRanges }), [
    { from: 0, to: 3 }, { from: 6, to: 9 }
  ]);

  const sequential = {
    ...definition([
      { findString: 'cat', replacementString: 'dog' },
      { findString: 'dog', replacementString: 'fox' }
    ]),
    textualAnchored: true
  };
  assert.equal(applyMultipleReplace('cat cat', sequential).text, 'fox cat', 'each rule searches from the start of the current segment');

  const regexRule = {
    ...definition([{ findString: 'cat', replacementString: 'dog', usesRegularExpression: true }]),
    textualAnchored: true
  };
  assert.equal(applyMultipleReplace('xcat cat', regexRule).text, 'xdog dog', 'textualOptions.anchored does not alter regex rules');
});

test('definition-level regex case-insensitivity applies only to regex rules and highlighting', () => {
  const regexDefinition = {
    ...definition([{ findString: 'cat', replacementString: 'fox', usesRegularExpression: true }]),
    regexCaseInsensitive: true
  };
  const result = applyMultipleReplace('CAT cat', regexDefinition);
  assert.equal(result.text, 'fox fox');
  assert.equal(result.matchCount, 2);
  assert.deepEqual(findMultipleReplaceMatches('CAT cat', regexDefinition), [
    { from: 0, to: 3 }, { from: 4, to: 7 }
  ]);

  const literal = applyMultipleReplace('CAT cat', {
    ...definition([{ findString: 'cat', replacementString: 'dog' }]),
    regexCaseInsensitive: true
  });
  assert.equal(literal.text, 'CAT dog', 'regexOptions must not change textual rules');

  const ruleOption = applyMultipleReplace('CAT cat', definition([
    { findString: 'cat', replacementString: 'dog', usesRegularExpression: true, ignoresCase: true }
  ]));
  assert.equal(ruleOption.text, 'dog dog', 'per-rule ignoresCase remains effective without the definition option');
});

test('definition-level regex ignore-metacharacters treats the entire regex pattern literally', () => {
  const literalPattern = {
    ...definition([{ findString: 'cat.*', replacementString: '<$&>', usesRegularExpression: true }]),
    regexIgnoreMetacharacters: true
  };
  const result = applyMultipleReplace('cat.* cat123', literalPattern);
  assert.equal(result.text, '<cat.*> cat123');
  assert.equal(result.matchCount, 1);
  assert.deepEqual(findMultipleReplaceMatches('cat.* cat123', literalPattern), [{ from: 0, to: 5 }]);

  const combined = {
    ...literalPattern,
    regexCaseInsensitive: true
  };
  assert.equal(applyMultipleReplace('CAT.* cat123', combined).text, '<CAT.*> cat123');

  const literalRule = {
    ...definition([{ findString: 'cat.*', replacementString: 'hit' }]),
    regexIgnoreMetacharacters: true
  };
  assert.equal(applyMultipleReplace('cat123 cat.*', literalRule).text, 'cat123 hit', 'the option only changes regex rules');
});

test('definition-level regex comments-and-whitespace mode preserves escaped, class, and quoted literals', () => {
  const extended = {
    ...definition([{ findString: '^ cat \\s+ dog $ # trailing comment\n', replacementString: 'matched', usesRegularExpression: true }]),
    regexAllowCommentsAndWhitespace: true
  };
  assert.equal(applyMultipleReplace('cat   dog', extended).text, 'matched');
  assert.deepEqual(findMultipleReplaceMatches('cat   dog', extended), [{ from: 0, to: 9 }]);
  assert.equal(applyMultipleReplace('cat   dog', definition(extended.replacements)).text, 'cat   dog', 'extended syntax is opt-in');

  const escaped = {
    ...definition([{ findString: String.raw`foo\ bar\#baz`, replacementString: 'literal', usesRegularExpression: true }]),
    regexAllowCommentsAndWhitespace: true
  };
  assert.equal(applyMultipleReplace('foo bar#baz', escaped).text, 'literal');

  const characterClass = {
    ...definition([{ findString: '[a #]+', replacementString: 'class', usesRegularExpression: true }]),
    regexAllowCommentsAndWhitespace: true
  };
  assert.equal(applyMultipleReplace('a #', characterClass).text, 'class', 'unescaped whitespace and # remain literal inside a character class');

  const quoted = {
    ...definition([{ findString: String.raw`\Q a # b\E`, replacementString: 'quoted', usesRegularExpression: true }]),
    regexAllowCommentsAndWhitespace: true
  };
  assert.equal(applyMultipleReplace(' a # b', quoted).text, 'quoted', '\\Q…\\E text remains quoted and literal');
});

test('definition-level regex dotAll matches line separators in replacement and highlighting only', () => {
  const regexDefinition = {
    ...definition([{ findString: 'A.*B', replacementString: 'joined', usesRegularExpression: true }]),
    regexDotMatchesLineSeparators: true
  };
  for (const separator of ['\n', '\r', '\r\n', '\u000b', '\u000c', '\u0085', '\u2028', '\u2029']) {
    const source = `A${separator}B`;
    assert.equal(applyMultipleReplace(source, regexDefinition).text, 'joined');
    assert.deepEqual(findMultipleReplaceMatches(source, regexDefinition), [{ from: 0, to: source.length }]);
  }

  const withoutOption = definition([{ findString: 'A.*B', replacementString: 'joined', usesRegularExpression: true }]);
  assert.equal(applyMultipleReplace('A\nB', withoutOption).text, 'A\nB');
  const literal = {
    ...definition([{ findString: 'A.B', replacementString: 'literal' }]),
    regexDotMatchesLineSeparators: true
  };
  assert.equal(applyMultipleReplace('A\nB', literal).text, 'A\nB', 'the regex option must not change literal rules');
});

test('default regex dots exclude ICU line terminators unless dotAll is enabled', () => {
  const regexDefinition = definition([{ findString: 'A.B', replacementString: 'joined', usesRegularExpression: true }]);
  for (const separator of ['\n', '\v', '\f', '\r', '\r\n', '\u0085', '\u2028', '\u2029']) {
    const source = `A${separator}B`;
    assert.equal(applyMultipleReplace(source, regexDefinition).text, source, JSON.stringify(separator));
    assert.deepEqual(findMultipleReplaceMatches(source, regexDefinition), [], JSON.stringify(separator));
    const dotAll = {
      ...regexDefinition,
      replacements: [{ findString: 'A.*B', replacementString: 'joined', usesRegularExpression: true }],
      regexDotMatchesLineSeparators: true
    };
    assert.equal(applyMultipleReplace(source, dotAll).text, 'joined', JSON.stringify(separator));
  }

  for (const pattern of [String.raw`A\.B`, 'A[.]B']) {
    assert.equal(applyMultipleReplace('A.B', definition([
      { findString: pattern, replacementString: 'literal', usesRegularExpression: true }
    ])).text, 'literal', JSON.stringify(pattern));
  }
});

test('dotAll treats CRLF as one ICU line terminator outside Unix-lines mode', () => {
  const source = 'A\r\nB';
  const dotAll = {
    ...definition([{ findString: 'A.B', replacementString: 'joined', usesRegularExpression: true }]),
    regexDotMatchesLineSeparators: true
  };
  assert.equal(applyMultipleReplace(source, dotAll).text, 'joined');
  assert.deepEqual(findMultipleReplaceMatches(source, dotAll), [{ from: 0, to: source.length }]);

  const twoDots = {
    ...dotAll,
    replacements: [{ findString: 'A..B', replacementString: 'incorrect', usesRegularExpression: true }]
  };
  assert.equal(applyMultipleReplace(source, twoDots).text, source, 'a CRLF sequence consumes one dot, not two');
  assert.deepEqual(findMultipleReplaceMatches(source, twoDots), []);

  const unixLines = { ...dotAll, regexUnixLineSeparators: true };
  assert.equal(applyMultipleReplace(source, unixLines).text, source, 'Unix mode treats CR and LF as separate input characters');
  assert.equal(applyMultipleReplace(source, { ...unixLines, replacements: twoDots.replacements }).text, 'incorrect');

  for (const separator of ['\n', '\v', '\f', '\r', '\u0085', '\u2028', '\u2029']) {
    assert.equal(applyMultipleReplace(`A${separator}B`, dotAll).text, 'joined', JSON.stringify(separator));
  }
  assert.equal(applyMultipleReplace('A𝄞B', dotAll).text, 'joined', 'dot consumes one supplementary Unicode scalar');
  for (const pattern of [String.raw`A\.B`, 'A[.]B']) {
    assert.equal(applyMultipleReplace('A.B', { ...dotAll, replacements: [{ findString: pattern, replacementString: 'literal', usesRegularExpression: true }] }).text, 'literal');
  }
});

test('definition-level regex multiline anchors match lines in replacement and highlighting only', () => {
  const source = 'head\nCAT\r\nend';
  const regexDefinition = {
    ...definition([{ findString: '^cat$', replacementString: 'fox', usesRegularExpression: true }]),
    regexCaseInsensitive: true,
    regexAnchorsMatchLines: true
  };
  const result = applyMultipleReplace(source, regexDefinition);
  assert.equal(result.text, 'head\nfox\r\nend');
  assert.equal(result.matchCount, 1);
  assert.deepEqual(findMultipleReplaceMatches(source, regexDefinition), [{ from: 5, to: 8 }]);

  const withoutOption = { ...regexDefinition, regexAnchorsMatchLines: false };
  assert.equal(applyMultipleReplace(source, withoutOption).text, source);
  assert.deepEqual(findMultipleReplaceMatches(source, withoutOption), []);

  const literal = {
    ...definition([{ findString: '^CAT$', replacementString: 'exact' }]),
    regexAnchorsMatchLines: true
  };
  assert.equal(applyMultipleReplace('prefix ^CAT$ suffix', literal).text, 'prefix exact suffix');
});

test('regex multiline anchors recognize ICU standard line terminators', () => {
  const regexDefinition = {
    ...definition([{ findString: '^target$', replacementString: 'found', usesRegularExpression: true }]),
    regexAnchorsMatchLines: true
  };
  for (const separator of ['\n', '\r', '\r\n', '\u000b', '\u000c', '\u0085', '\u2028', '\u2029']) {
    const source = `before${separator}target${separator}after`;
    const result = applyMultipleReplace(source, regexDefinition);
    const from = 'before'.length + separator.length;
    assert.equal(result.matchCount, 1, JSON.stringify(separator));
    assert.equal(result.text, `before${separator}found${separator}after`, JSON.stringify(separator));
    assert.deepEqual(findMultipleReplaceMatches(source, regexDefinition), [{ from, to: from + 'target'.length }]);
  }
});

test('multiline regex anchors do not match between CRLF code units', () => {
  const source = 'a\r\nb';
  const lineStart = {
    ...definition([{ findString: '^', replacementString: '|', usesRegularExpression: true }]),
    regexAnchorsMatchLines: true
  };
  assert.equal(applyMultipleReplace(source, lineStart).text, '|a\r\n|b');

  const lineEnd = {
    ...definition([{ findString: '$', replacementString: '|', usesRegularExpression: true }]),
    regexAnchorsMatchLines: true
  };
  assert.equal(applyMultipleReplace(source, lineEnd).text, 'a|\r\nb|');

  const emptyLine = {
    ...definition([{ findString: '^$', replacementString: 'empty', usesRegularExpression: true }]),
    regexAnchorsMatchLines: true
  };
  assert.equal(applyMultipleReplace(source, emptyLine).text, source, 'CRLF itself is not an empty line between two anchors');
  assert.equal(applyMultipleReplace('a\n\nb', emptyLine).text, 'a\nempty\nb', 'a genuine empty LF line still matches');
});

test('Unix regex line separators treat only LF as a separator for dots and multiline anchors', () => {
  const unixDot = {
    ...definition([{ findString: 'a.b', replacementString: 'hit', usesRegularExpression: true }]),
    regexUnixLineSeparators: true
  };
  assert.equal(applyMultipleReplace('a\rb a\u2028b a\nb', unixDot).text, 'hit hit a\nb');
  assert.deepEqual(findMultipleReplaceMatches('a\rb a\u2028b a\nb', unixDot), [
    { from: 0, to: 3 }, { from: 4, to: 7 }
  ]);
  for (const separator of ['\r', '\v', '\f', '\u0085', '\u2028', '\u2029']) {
    assert.equal(applyMultipleReplace(`a${separator}b`, unixDot).text, 'hit', JSON.stringify(separator));
  }
  assert.equal(applyMultipleReplace('a\r\nb', unixDot).text, 'a\r\nb', 'Unix mode excludes LF even when preceded by CR');
  assert.equal(applyMultipleReplace('a\nb', { ...unixDot, regexDotMatchesLineSeparators: true }).text, 'hit');
  assert.equal(applyMultipleReplace('a.b', {
    ...unixDot,
    replacements: [{ findString: String.raw`a\.b`, replacementString: 'literal', usesRegularExpression: true }]
  }).text, 'literal', 'escaped dots remain literal');
  assert.equal(applyMultipleReplace('a.b', {
    ...unixDot,
    replacements: [{ findString: 'a[.]b', replacementString: 'class', usesRegularExpression: true }]
  }).text, 'class', 'dots in character classes remain literal');

  const unixAnchors = {
    ...definition([{ findString: '^target$', replacementString: 'found', usesRegularExpression: true }]),
    regexAnchorsMatchLines: true,
    regexUnixLineSeparators: true
  };
  assert.equal(applyMultipleReplace('target\r\nother\ntarget\nend', unixAnchors).text, 'target\r\nother\nfound\nend');
  assert.deepEqual(findMultipleReplaceMatches('target\r\nother\ntarget\nend', unixAnchors), [{ from: 14, to: 20 }]);
  for (const separator of ['\r', '\r\n', '\u000b', '\u000c', '\u0085', '\u2028', '\u2029']) {
    const source = `head${separator}target${separator}after`;
    assert.equal(applyMultipleReplace(source, unixAnchors).text, source, JSON.stringify(separator));
  }
});

test('full-word selection matching checks characters just outside each selected range', () => {
  const result = applyMultipleReplace('xcat catx cat', {
    ...definition([{ findString: 'cat', replacementString: 'dog' }]),
    matchesFullWord: true
  }, {
    inSelection: true,
    ranges: [{ from: 1, to: 4 }, { from: 5, to: 8 }, { from: 10, to: 13 }]
  });
  assert.equal(result.text, 'xcat catx dog');
  assert.equal(result.matchCount, 1);

  const supplementary = applyMultipleReplace('𐐀cat cat𐐀 cat', {
    ...definition([{ findString: 'cat', replacementString: 'dog' }]),
    matchesFullWord: true
  });
  assert.equal(supplementary.text, '𐐀cat cat𐐀 dog');
});

test('regular-expression replacements expand numbered and named capture groups', () => {
  const result = applyMultipleReplace('x=4', definition([
    { findString: '(?<name>\\w+)=(\\d+)', replacementString: '$2:${name}', usesRegularExpression: true }
  ]));
  assert.equal(result.text, '4:x');
  assert.equal(result.matchCount, 1);

  const legacySyntax = applyMultipleReplace('x=4', definition([
    { findString: '(?<name>\\w+)=(\\d+)', replacementString: '$<name>:$2', usesRegularExpression: true }
  ]));
  assert.equal(legacySyntax.text, 'x:4', 'previously accepted JavaScript-style named reference remains compatible');

  const unmatchedOptionalGroup = applyMultipleReplace('b', definition([
    { findString: '(?<prefix>a)?(?<body>b)', replacementString: '${prefix}-${body}', usesRegularExpression: true }
  ]));
  assert.equal(unmatchedOptionalGroup.text, '-b', 'a defined but unmatched group expands to an empty string');
});

test('regex replacement unescaping follows CotEditor escapes once and does not affect literal rules', () => {
  const replacementStrings = [String.raw`\n`, String.raw`\t`, String.raw`\r`, String.raw`\0`, String.raw`\"`, String.raw`\'`, String.raw`\\n`, String.raw`\\`];
  const rules = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((findString, index) => ({
    findString, replacementString: replacementStrings[index], usesRegularExpression: true
  }));
  const enabled = applyMultipleReplace('abcdefgh', {
    ...definition(rules),
    unescapesReplacementString: true
  });
  assert.equal(enabled.text, ['\n', '\t', '\n', '\0', '"', "'", String.raw`\n`, '\\'].join(''));
  assert.equal(enabled.matchCount, 8);

  const disabled = applyMultipleReplace('a', definition([{ findString: 'a', replacementString: String.raw`\n`, usesRegularExpression: true }]));
  assert.equal(disabled.text, String.raw`\n`);
  const literal = applyMultipleReplace('a', {
    ...definition([{ findString: 'a', replacementString: String.raw`\n` }]),
    unescapesReplacementString: true
  });
  assert.equal(literal.text, String.raw`\n`);
});

test('selection scope only transforms selected segments and remaps their ranges', () => {
  const result = applyMultipleReplace('one foo two foo', definition([
    { findString: 'foo', replacementString: 'longer' }
  ]), { inSelection: true, ranges: [{ from: 4, to: 7 }, { from: 12, to: 15 }] });
  assert.equal(result.text, 'one longer two longer');
  assert.equal(result.matchCount, 2);
  assert.deepEqual(result.selectedRanges, [{ from: 4, to: 10 }, { from: 15, to: 21 }]);
  assert.equal(applyChanges('one foo two foo', result.changes), result.text);
});

test('overlapping or out-of-document selection ranges are normalized safely', () => {
  const result = applyMultipleReplace('abcdef', definition([
    { findString: 'cde', replacementString: 'XYZ' }
  ]), { inSelection: true, ranges: [{ from: 1, to: 4 }, { from: 3, to: 99 }] });
  assert.equal(result.text, 'abXYZf');
  assert.equal(result.matchCount, 1);
  assert.deepEqual(result.selectedRanges, [{ from: 1, to: 6 }]);
});

test('selection scope without a nonempty selection is a no-op', () => {
  const result = applyMultipleReplace('abc', definition([{ findString: 'a', replacementString: 'z' }]), { inSelection: true });
  assert.deepEqual(result, { text: 'abc', matchCount: 0, selectedRanges: [], changes: [] });
});

test('multiple replace emits disjoint edits and preserves untouched mixed line endings through undo and redo', () => {
  const source = 'top\nneedle\nuntouched\nneedle\nbottom';
  const originalEndings = ['CRLF', 'CR', 'PS', 'NEL'];
  const result = applyMultipleReplace(source, definition([
    { findString: 'needle', replacementString: 'replacement\ninside' }
  ]));
  assert.equal(result.text, 'top\nreplacement\ninside\nuntouched\nreplacement\ninside\nbottom');
  assert.equal(result.changes.length, 2, 'separate matches must not include the intervening unchanged text');

  let state = EditorState.create({ doc: source, extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LF')] });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  view.dispatch(view.state.update({ changes: result.changes, userEvent: 'input.replace.all' }));
  const expectedEndings = ['CRLF', 'LF', 'CR', 'PS', 'LF', 'NEL'];
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), expectedEndings), 'top\r\nreplacement\ninside\runtouched\u2029replacement\ninside\u0085bottom');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
});

test('multi-line Replace All keeps the untouched boundary line ending through undo and redo', () => {
  const source = '\nc\nc\nddd\n\ndd';
  const originalEndings = ['CRLF', 'CR', 'PS', 'NEL', 'LS'];
  const result = applyMultipleReplace(source, definition([
    { findString: '\\nddd\\n\\n', replacementString: '\ny\n', usesRegularExpression: true }
  ]));
  assert.equal(result.text, '\nc\nc\ny\ndd');

  let state = EditorState.create({ doc: source, extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LF')] });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  view.dispatch(view.state.update({ changes: result.changes, userEvent: 'input.replace.all' }));
  const expectedEndings = ['CRLF', 'CR', 'LF', 'LF'];
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), expectedEndings), '\r\nc\rc\ny\ndd');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
});

test('multiple replace normalizes inserted separators before tracking mixed document line endings', () => {
  const source = 'before\nneedle\nbetween\nlast';
  const originalEndings = ['CRLF', 'CR', 'PS'];
  const rawReplacement = 'alpha\r\nbeta\rgamma\ndelta\u0085epsilon\u2028zeta\u2029eta';
  const result = applyMultipleReplace(source, definition([
    { findString: 'needle', replacementString: rawReplacement }
  ]));
  assert.equal(result.text, 'before\nalpha\nbeta\ngamma\ndelta\nepsilon\nzeta\neta\nbetween\nlast');

  let state = EditorState.create({ doc: source, extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LS')] });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  view.dispatch(view.state.update({ changes: result.changes, userEvent: 'input.replace.all' }));

  const expectedEndings = ['CRLF', 'LS', 'LS', 'LS', 'LS', 'LS', 'LS', 'CR', 'PS'];
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), expectedEndings), 'before\r\nalpha\u2028beta\u2028gamma\u2028delta\u2028epsilon\u2028zeta\u2028eta\rbetween\u2029last');
  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
});

test('skips invalid regex rules while applying valid neighboring rules', () => {
  const result = applyMultipleReplace('foo foo', definition([
    { findString: 'foo', replacementString: 'bar' },
    { findString: '(', replacementString: 'bad', usesRegularExpression: true },
    { findString: 'bar', replacementString: 'baz' }
  ]));
  assert.equal(result.text, 'baz baz');
  assert.equal(result.matchCount, 4);
});

test('definition normalization filters duplicate/unsafe IDs and oversized rules', () => {
  const normalized = normalizeMultipleReplaceDefinitions([
    { id: 'safe', name: ' Safe ', replacements: [{ findString: 'x', replacementString: 'y' }] },
    { id: 'safe', name: 'duplicate', replacements: [] },
    { id: '../bad', name: 'unsafe', replacements: [] },
    { id: 'oversize', name: 'bad rule', replacements: [{ findString: 'x'.repeat(5000), replacementString: 'y' }] }
  ]);
  assert.deepEqual(normalized, [
    { id: 'safe', name: 'Safe', replacements: [{
      id: 'rule-1', isEnabled: true, findString: 'x', replacementString: 'y', usesRegularExpression: false, ignoresCase: false
    }] },
    { id: 'oversize', name: 'bad rule', replacements: [] }
  ]);
});

test('definition normalization persists text search options', () => {
  const [normalized] = normalizeMultipleReplaceDefinitions([{
    ...definition([{ findString: 'x', replacementString: 'y' }]),
    textualCaseInsensitive: true,
    textualLiteral: true,
    textualAnchored: true
  }]);
  assert.equal(normalized.textualCaseInsensitive, true);
  assert.equal(normalized.textualLiteral, true);
  assert.equal(normalized.textualAnchored, true);
});

test('definition normalization persists regex case-insensitive option and counts its storage size', () => {
  const [normalized] = normalizeMultipleReplaceDefinitions([{
    ...definition([{ findString: 'x', replacementString: 'y' }]),
    regexCaseInsensitive: true
  }]);
  assert.equal(normalized.regexCaseInsensitive, true);
});

test('definition normalization persists regex dot-matches-line-separators option', () => {
  const [normalized] = normalizeMultipleReplaceDefinitions([{
    ...definition([{ findString: 'A.*B', replacementString: 'x', usesRegularExpression: true }]),
    regexDotMatchesLineSeparators: true
  }]);
  assert.equal(normalized.regexDotMatchesLineSeparators, true);
});

test('definition normalization persists regex ignore-metacharacters option', () => {
  const [normalized] = normalizeMultipleReplaceDefinitions([{
    ...definition([{ findString: 'a.*b', replacementString: 'x', usesRegularExpression: true }]),
    regexIgnoreMetacharacters: true
  }]);
  assert.equal(normalized.regexIgnoreMetacharacters, true);
});

test('definition normalization persists the Unicode regex word-boundaries option', () => {
  const [normalized] = normalizeMultipleReplaceDefinitions([{
    ...definition([{ findString: String.raw`\bword\b`, replacementString: 'x', usesRegularExpression: true }]),
    regexUseUnicodeWordBoundaries: true
  }]);
  assert.equal(normalized.regexUseUnicodeWordBoundaries, true);
});

test('multiple-replace highlights enabled rules against the same source and merges overlaps', () => {
  const matches = findMultipleReplaceMatches('foo Foo food', definition([
    { findString: 'foo', replacementString: 'x', ignoresCase: true },
    { findString: 'ood', replacementString: '', usesRegularExpression: false },
    { findString: 'Foo', replacementString: 'ignored', isEnabled: false }
  ]));
  assert.deepEqual(matches, [{ from: 0, to: 3 }, { from: 4, to: 7 }, { from: 8, to: 12 }]);
});

test('multiple-replace highlighting searches each rule in the original text rather than sequential results', () => {
  const replacements = [
    { findString: 'old', replacementString: 'new' },
    { findString: 'new', replacementString: 'done' }
  ];
  const source = 'old new';
  assert.deepEqual(findMultipleReplaceMatches(source, definition(replacements)), [
    { from: 0, to: 3 }, { from: 4, to: 7 }
  ]);
  const replacement = applyMultipleReplace(source, definition(replacements));
  assert.equal(replacement.text, 'done done');
  assert.equal(replacement.matchCount, 3);
});

test('multiple-replace highlights respect disjoint selection ranges and support regular expressions', () => {
  const source = 'one cat two cats';
  const first = source.indexOf('cat');
  const last = source.lastIndexOf('cat');
  const matches = findMultipleReplaceMatches(source, definition([
    { findString: 'cat(s)?', replacementString: '', usesRegularExpression: true }
  ]), { inSelection: true, ranges: [{ from: first, to: first + 3 }, { from: last, to: last + 4 }] });
  assert.deepEqual(matches, [{ from: first, to: first + 3 }, { from: last, to: last + 4 }]);
});

test('multiple-replace highlight ignores zero-length matches and skips invalid regexes', () => {
  const matches = findMultipleReplaceMatches('aba', definition([
    { findString: 'a*', replacementString: '', usesRegularExpression: true },
    { findString: '(', replacementString: '', usesRegularExpression: true },
    { findString: 'b', replacementString: '' }
  ]));
  assert.deepEqual(matches, [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]);
});
