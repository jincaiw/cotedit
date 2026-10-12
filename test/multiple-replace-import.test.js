import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCotEditorReplacementImport, MAX_MULTIPLE_REPLACE_IMPORT_BYTES } from '../lib/multiple-replace-import.js';
import { applyMultipleReplace, findMultipleReplaceMatches } from '../lib/multiple-replace.js';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('imports CotEditor .cotrpl JSON5 definitions and preserves supported rule fields', () => {
  const result = parseCotEditorReplacementImport(`{
    // CotEditor accepts JSON5 in replacement definitions.
    replacements: [{
      findString: 'old', replacementString: '$1', usesRegularExpression: true,
      ignoresCase: true, isEnabled: false, description: 'legacy rule',
    },],
    settings: { textualOptions: 0, regexOptions: 34, matchesFullWord: true, unescapesReplacementString: true, },
  }`, 'cleanup.cotrpl');
  assert.equal(result.definition.name, 'cleanup');
  assert.equal(result.definition.matchesFullWord, true);
  assert.equal(result.definition.unescapesReplacementString, true);
  assert.equal(result.definition.regexAllowCommentsAndWhitespace, true);
  assert.equal(result.definition.regexUnixLineSeparators, true);
  assert.deepEqual(result.definition.replacements, [{
    id: 'rule-1', isEnabled: false, findString: 'old', replacementString: '$1',
    usesRegularExpression: true, ignoresCase: true, description: 'legacy rule'
  }]);
  assert.equal(result.ignoredSettings, false);
});

test('executes ICU-style named capture references in imported .cotrpl replacement templates', () => {
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{
      findString: '(?<name>\\w+)=(\\d+)',
      replacementString: '${name}:$2',
      usesRegularExpression: true
    }],
    settings: { textualOptions: 0, regexOptions: 0 }
  }), 'named-capture.cotrpl');

  assert.equal(imported.ignoredSettings, false);
  assert.equal(applyMultipleReplace('x=4', imported.definition).text, 'x:4');
});

test('both new-definition draft paths use the shared CotEditor-compatible defaults', () => {
  assert.equal([...renderer.matchAll(/\.\.\.DEFAULT_MULTIPLE_REPLACE_OPTIONS/g)].length, 2);
});

test('treats zero CotEditor option masks as neutral but still reports unsupported settings', () => {
  const definition = { replacements: [{ findString: 'x', replacementString: 'y' }] };
  const neutral = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { textualOptions: 0, regexOptions: 0 }
  }), 'neutral-options.cotrpl');
  assert.equal(neutral.ignoredSettings, false);
  assert.notEqual(neutral.definition.regexAnchorsMatchLines, true, 'an explicit zero mask opts out of CotEditor default anchors');

  const nonzero = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { textualOptions: 0, regexOptions: 128 }
  }), 'unsupported-options.cotrpl');
  assert.equal(nonzero.ignoredSettings, true);

  const unknown = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { textualOptions: 0, regexOptions: 0, futureOption: false }
  }), 'future-options.cotrpl');
  assert.equal(unknown.ignoredSettings, true);
});

test('imports the CotEditor case-insensitive textual option without applying it to regex rules', () => {
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [
      { findString: 'cat', replacementString: 'fox', usesRegularExpression: true },
      { findString: 'cat', replacementString: 'dog' }
    ],
    settings: { textualOptions: 1, regexOptions: 0 }
  }), 'case-insensitive.cotrpl');
  assert.equal(imported.definition.textualCaseInsensitive, true);
  assert.equal(imported.ignoredSettings, false);
  const result = applyMultipleReplace('CAT cat', imported.definition);
  assert.equal(result.text, 'dog fox');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'cat', replacementString: 'dog' }],
    settings: { textualOptions: 5 }
  }), 'mixed-options.cotrpl');
  assert.equal(partlySupported.definition.textualCaseInsensitive, true);
  assert.equal(partlySupported.ignoredSettings, true);
});

test('recognizes textualOptions.literal bit 2 as exact character-by-character matching', () => {
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'é', replacementString: 'composed' }],
    settings: { textualOptions: 2 }
  }), 'text-literal.cotrpl');
  assert.equal(imported.ignoredSettings, false);
  assert.equal(imported.definition.textualLiteral, true);
  assert.equal(applyMultipleReplace('é e\u0301', imported.definition).text, 'composed e\u0301');
});

test('textual search uses Unicode canonical equivalence when literal comparison is not requested', () => {
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'é', replacementString: 'composed' }],
    settings: { textualOptions: 0 }
  }), 'canonical-text.cotrpl');
  assert.equal(imported.ignoredSettings, false);
  assert.equal(imported.definition.textualLiteral, undefined);
  assert.equal(applyMultipleReplace('é e\u0301', imported.definition).text, 'composed composed');
});

test('imports textualOptions.anchored bit 8 and combines it with supported case-insensitive matching', () => {
  const replacements = [{ findString: 'cat', replacementString: 'dog' }];
  const anchored = parseCotEditorReplacementImport(JSON.stringify({
    replacements,
    settings: { textualOptions: 8 }
  }), 'text-anchored.cotrpl');
  assert.equal(anchored.definition.textualAnchored, true);
  assert.equal(anchored.ignoredSettings, false);
  assert.equal(applyMultipleReplace('cat cat', anchored.definition).text, 'dog cat');

  const combined = parseCotEditorReplacementImport(JSON.stringify({
    replacements,
    settings: { textualOptions: 9 }
  }), 'text-anchored-case-insensitive.cotrpl');
  assert.equal(combined.definition.textualAnchored, true);
  assert.equal(combined.definition.textualCaseInsensitive, true);
  assert.equal(combined.ignoredSettings, false);
  assert.equal(applyMultipleReplace('CAT cat', combined.definition).text, 'dog cat');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    replacements,
    settings: { textualOptions: 12 }
  }), 'text-anchored-with-unsupported-bit.cotrpl');
  assert.equal(partlySupported.definition.textualAnchored, true);
  assert.equal(partlySupported.ignoredSettings, true);
  assert.equal(applyMultipleReplace('cat cat', partlySupported.definition).text, 'dog cat');
});

test('imports regexOptions.caseInsensitive and applies it only to regular-expression rules', () => {
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [
      { findString: 'cat', replacementString: 'fox', usesRegularExpression: true },
      { findString: 'cat', replacementString: 'dog' }
    ],
    settings: { textualOptions: 0, regexOptions: 1 }
  }), 'regex-case-insensitive.cotrpl');
  assert.equal(imported.definition.regexCaseInsensitive, true);
  assert.equal(imported.ignoredSettings, false);
  assert.equal(applyMultipleReplace('CAT cat', imported.definition).text, 'fox fox');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'cat', replacementString: 'fox', usesRegularExpression: true }],
    settings: { regexOptions: 227 }
  }), 'mixed-regex-options.cotrpl');
  assert.equal(partlySupported.definition.regexCaseInsensitive, true);
  assert.equal(partlySupported.definition.regexAllowCommentsAndWhitespace, true);
  assert.equal(partlySupported.ignoredSettings, true);
  assert.equal(applyMultipleReplace('CAT cat', partlySupported.definition).text, 'fox fox');
});

test('imports regexOptions.allowCommentsAndWhitespace bit 2 and combines it with supported regex flags', () => {
  const pattern = `^ cat \\s+ dog $ # trailing comment
`;
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: pattern, replacementString: 'matched', usesRegularExpression: true }],
    settings: { regexOptions: 2 }
  }), 'regex-comments-whitespace.cotrpl');
  assert.equal(imported.definition.regexAllowCommentsAndWhitespace, true);
  assert.equal(imported.ignoredSettings, false);
  assert.equal(applyMultipleReplace('cat   dog', imported.definition).text, 'matched');

  const combined = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: pattern, replacementString: 'matched', usesRegularExpression: true }],
    settings: { regexOptions: 3 }
  }), 'combined-comments-case.cotrpl');
  assert.equal(combined.definition.regexCaseInsensitive, true);
  assert.equal(combined.definition.regexAllowCommentsAndWhitespace, true);
  assert.equal(combined.ignoredSettings, false);
  assert.equal(applyMultipleReplace('CAT   DOG', combined.definition).text, 'matched');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'x', replacementString: 'y', usesRegularExpression: true }],
    settings: { regexOptions: 194 }
  }), 'mixed-comments-options.cotrpl');
  assert.equal(partlySupported.definition.regexAllowCommentsAndWhitespace, true);
  assert.equal(partlySupported.ignoredSettings, true);
});

test('imports regexOptions.ignoreMetacharacters bit 4 as a literal regex pattern', () => {
  const definition = { replacements: [{ findString: 'cat.*', replacementString: 'hit', usesRegularExpression: true }] };
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 4 }
  }), 'regex-literal-pattern.cotrpl');
  assert.equal(imported.definition.regexIgnoreMetacharacters, true);
  assert.equal(imported.ignoredSettings, false);
  assert.equal(applyMultipleReplace('cat.* cat123', imported.definition).text, 'hit cat123');
  assert.deepEqual(findMultipleReplaceMatches('cat.* cat123', imported.definition), [{ from: 0, to: 5 }]);

  const combined = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 5 }
  }), 'regex-literal-case-insensitive.cotrpl');
  assert.equal(combined.definition.regexCaseInsensitive, true);
  assert.equal(combined.definition.regexIgnoreMetacharacters, true);
  assert.equal(combined.ignoredSettings, false);
  assert.equal(applyMultipleReplace('CAT.* cat123', combined.definition).text, 'hit cat123');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 230 }
  }), 'mixed-literal-options.cotrpl');
  assert.equal(partlySupported.definition.regexIgnoreMetacharacters, true);
  assert.equal(partlySupported.ignoredSettings, true);
  assert.equal(applyMultipleReplace('cat.* cat123', partlySupported.definition).text, 'hit cat123');
});

test('imports regexOptions.dotMatchesLineSeparators bit 8 and reports only unsupported companion bits', () => {
  const definition = { replacements: [{ findString: 'a.*b', replacementString: 'joined', usesRegularExpression: true }] };
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 8 }
  }), 'regex-dot-all.cotrpl');
  assert.equal(imported.definition.regexDotMatchesLineSeparators, true);
  assert.equal(imported.ignoredSettings, false);
  assert.equal(applyMultipleReplace('a\nb', imported.definition).text, 'joined');

  const supportedCombination = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 9 }
  }), 'regex-case-and-dot-all.cotrpl');
  assert.equal(supportedCombination.definition.regexCaseInsensitive, true);
  assert.equal(supportedCombination.definition.regexDotMatchesLineSeparators, true);
  assert.equal(supportedCombination.ignoredSettings, false);
  assert.equal(applyMultipleReplace('A\nB', supportedCombination.definition).text, 'joined');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 234 }
  }), 'mixed-dot-all-options.cotrpl');
  assert.equal(partlySupported.definition.regexDotMatchesLineSeparators, true);
  assert.equal(partlySupported.ignoredSettings, true);
  assert.equal(applyMultipleReplace('a\nb', partlySupported.definition).text, 'joined');
});

test('imports regexOptions.anchorsMatchLines bit 16 and preserves supported bits beside unsupported options', () => {
  const definition = { replacements: [{ findString: '^cat$', replacementString: 'fox', usesRegularExpression: true }] };
  const imported = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 16 }
  }), 'regex-anchors-match-lines.cotrpl');
  assert.equal(imported.definition.regexAnchorsMatchLines, true);
  assert.equal(imported.ignoredSettings, false);
  assert.equal(applyMultipleReplace('head\ncat\ncats', imported.definition).text, 'head\nfox\ncats');
  assert.deepEqual(findMultipleReplaceMatches('head\ncat\ncats', imported.definition), [{ from: 5, to: 8 }]);
  const crlfEmptyLine = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: '^$', replacementString: 'incorrect', usesRegularExpression: true }],
    settings: { regexOptions: 16 }
  }), 'regex-crlf-anchors.cotrpl');
  assert.equal(crlfEmptyLine.ignoredSettings, false);
  assert.equal(applyMultipleReplace('a\r\nb', crlfEmptyLine.definition).text, 'a\r\nb');

  const combined = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: '^a.*b$', replacementString: 'joined', usesRegularExpression: true }],
    settings: { regexOptions: 25 }
  }), 'combined-regex-options.cotrpl');
  assert.equal(combined.definition.regexCaseInsensitive, true);
  assert.equal(combined.definition.regexDotMatchesLineSeparators, true);
  assert.equal(combined.definition.regexAnchorsMatchLines, true);
  assert.equal(combined.ignoredSettings, false);
  assert.equal(applyMultipleReplace('head\nA\nB\nend', combined.definition).text, 'head\njoined\nend');

  const partlySupported = parseCotEditorReplacementImport(JSON.stringify({
    ...definition,
    settings: { regexOptions: 144 }
  }), 'mixed-anchor-options.cotrpl');
  assert.equal(partlySupported.definition.regexAnchorsMatchLines, true);
  assert.equal(partlySupported.ignoredSettings, true);
  assert.equal(applyMultipleReplace('head\ncat\ncats', partlySupported.definition).text, 'head\nfox\ncats');
});

test('imports regexOptions.useUnicodeWordBoundaries bit 64 and applies UAX word-segment edges to regex assertions', () => {
  const unicode = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: String.raw`\b(can)\b`, replacementString: '<$1>', usesRegularExpression: true }],
    settings: { regexOptions: 64 }
  }), 'unicode-word-boundaries.cotrpl');
  assert.equal(unicode.ignoredSettings, false);
  assert.equal(unicode.definition.regexUseUnicodeWordBoundaries, true);
  assert.equal(applyMultipleReplace("can can't", unicode.definition).text, "<can> can't");
  assert.deepEqual(findMultipleReplaceMatches("can can't", unicode.definition), [{ from: 0, to: 3 }]);
  assert.deepEqual(findMultipleReplaceMatches('xcan', unicode.definition, {
    inSelection: true,
    ranges: [{ from: 1, to: 4 }]
  }), [], 'the selected range start is not a boundary inside the surrounding word');

  const traditional = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: String.raw`\b(can)\b`, replacementString: '<$1>', usesRegularExpression: true }],
    settings: { regexOptions: 0 }
  }), 'traditional-word-boundaries.cotrpl');
  assert.equal(applyMultipleReplace("can can't", traditional.definition).text, "<can> <can>'t");
  assert.deepEqual(findMultipleReplaceMatches("can can't", traditional.definition), [{ from: 0, to: 3 }, { from: 4, to: 7 }]);

  const negative = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: String.raw`n\B['’]t`, replacementString: 'X', usesRegularExpression: true }],
    settings: { regexOptions: 64 }
  }), 'unicode-non-boundary.cotrpl');
  assert.equal(applyMultipleReplace("can't", negative.definition).text, 'caX');

  const backreference = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: String.raw`\b(ana)\b-\1`, replacementString: '[$1]', usesRegularExpression: true }],
    settings: { regexOptions: 64 }
  }), 'unicode-boundary-capture.cotrpl');
  assert.equal(applyMultipleReplace('ana-ana', backreference.definition).text, '[ana]');
});

test('imports Unix-line-separator behavior for dot, anchors and comments without changing literal rules', () => {
  const dot = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'a.b', replacementString: 'hit', usesRegularExpression: true }],
    settings: { regexOptions: 32 }
  }), 'unix-dots.cotrpl');
  assert.equal(dot.definition.regexUnixLineSeparators, true);
  assert.equal(dot.ignoredSettings, false);
  assert.equal(applyMultipleReplace('a\rb a\u2028b a\nb', dot.definition).text, 'hit hit a\nb');
  assert.equal(applyMultipleReplace('a.b', {
    ...dot.definition,
    replacements: [{ ...dot.definition.replacements[0], findString: String.raw`a\.b` }]
  }).text, 'hit');
  assert.equal(applyMultipleReplace('a\nb', { ...dot.definition, regexDotMatchesLineSeparators: true }).text, 'hit');

  const anchors = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: '^target$', replacementString: 'found', usesRegularExpression: true }],
    settings: { regexOptions: 48 }
  }), 'unix-anchors.cotrpl');
  assert.equal(anchors.ignoredSettings, false);
  assert.equal(applyMultipleReplace('target\r\nother\ntarget\nend', anchors.definition).text, 'target\r\nother\nfound\nend');
  assert.equal(applyMultipleReplace('head\rtarget\rafter', anchors.definition).text, 'head\rtarget\rafter');
  assert.equal(applyMultipleReplace('head\u2028target\u2028after', anchors.definition).text, 'head\u2028target\u2028after');

  const comments = parseCotEditorReplacementImport(JSON.stringify({
    replacements: [{ findString: 'a # comment\rstill comment\nb', replacementString: 'joined', usesRegularExpression: true }],
    settings: { regexOptions: 34 }
  }), 'unix-comments.cotrpl');
  assert.equal(comments.ignoredSettings, false);
  assert.equal(applyMultipleReplace('ab', comments.definition).text, 'joined');
});

test('rejects invalid CotEditor textualOptions masks instead of silently coercing them', () => {
  for (const textualOptions of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseCotEditorReplacementImport(JSON.stringify({
      replacements: [{ findString: 'x', replacementString: 'y' }],
      settings: { textualOptions }
    }), 'invalid-text-options.cotrpl'), /textualOptions 必须是非负安全整数/);
  }
});

test('rejects invalid CotEditor regexOptions masks instead of silently coercing them', () => {
  for (const regexOptions of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseCotEditorReplacementImport(JSON.stringify({
      replacements: [{ findString: 'x', replacementString: 'y' }],
      settings: { regexOptions }
    }), 'invalid-regex-options.cotrpl'), /regexOptions 必须是非负安全整数/);
  }
});

test('recognizes matchesFullWord by itself and rejects a non-boolean value', () => {
  const result = parseCotEditorReplacementImport(`{
    replacements: [{ findString: 'cat', replacementString: 'dog' }],
    settings: { matchesFullWord: true },
  }`, 'whole-word.cotrpl');
  assert.equal(result.definition.matchesFullWord, true);
  assert.equal(result.ignoredSettings, false);
  assert.throws(() => parseCotEditorReplacementImport(`{
    replacements: [{ findString: 'cat', replacementString: 'dog' }],
    settings: { matchesFullWord: 1 },
  }`, 'invalid-option.cotrpl'), /matchesFullWord 必须是布尔值/);
});
test('recognizes unescapesReplacementString without warning and rejects non-booleans', () => {
  const payload = JSON.stringify({
    replacements: [{ findString: 'x', replacementString: String.raw`\n` }],
    settings: { unescapesReplacementString: true }
  });
  const result = parseCotEditorReplacementImport(payload, 'unescape.cotrpl');
  assert.equal(result.definition.unescapesReplacementString, true);
  assert.equal(result.ignoredSettings, false);
  const invalidPayload = JSON.stringify({
    replacements: [{ findString: 'x', replacementString: 'y' }],
    settings: { unescapesReplacementString: 1 }
  });
  assert.throws(() => parseCotEditorReplacementImport(invalidPayload, 'invalid-unescape.cotrpl'), /unescapesReplacementString 必须是布尔值/);
});

test('imports TSV definitions including empty replacement cells and CRLF line endings', () => {
  const result = parseCotEditorReplacementImport('old\tnew\r\nremove-me\t\r\n', 'cleanup.tsv');
  assert.equal(result.definition.name, 'cleanup');
  assert.deepEqual(result.definition.replacements.map(({ findString, replacementString }) => ({ findString, replacementString })), [
    { findString: 'old', replacementString: 'new' },
    { findString: 'remove-me', replacementString: '' }
  ]);
  assert.equal(result.ignoredSettings, false);
});

test('skips an invalid regex imported from CotEditor without blocking valid rules', () => {
  const imported = parseCotEditorReplacementImport(JSON.stringify({ replacements: [
    { findString: 'foo', replacementString: 'bar' },
    { findString: '(', replacementString: 'bad', usesRegularExpression: true },
    { findString: 'bar', replacementString: 'baz' }
  ] }), 'invalid-regex.cotrpl').definition;
  const result = applyMultipleReplace('foo foo', imported);
  assert.equal(result.text, 'baz baz');
  assert.equal(result.matchCount, 4);
});

test('rejects extra TSV columns instead of silently discarding fields', () => {
  assert.throws(
    () => parseCotEditorReplacementImport('find\treplace\tdescription\n', 'extra-column.tsv'),
    /TSV 第 1 行必须恰好两列/
  );
});

test('rejects malformed, unsupported, empty and oversized definition files without truncation', () => {
  assert.throws(() => parseCotEditorReplacementImport('not json', 'bad.cotrpl'), /有效的 JSON5/);
  assert.throws(() => parseCotEditorReplacementImport('{}', 'empty.cotrpl'), /没有替换规则/);
  assert.throws(() => parseCotEditorReplacementImport('x', 'rules.txt'), /仅支持/);
  assert.throws(() => parseCotEditorReplacementImport('find-only\n', 'bad.tsv'), /第 1 行/);
  assert.throws(() => parseCotEditorReplacementImport(`{replacements:[{findString:'',replacementString:'x'}]}`, 'blank.cotrpl'), /查找文本非空/);
  assert.throws(() => parseCotEditorReplacementImport('x'.repeat(MAX_MULTIPLE_REPLACE_IMPORT_BYTES + 1), 'large.cotrpl'), /超过 64 KiB/);
});

test('rejects too many rules, missing fields and oversized rule text', () => {
  const tooMany = JSON.stringify({ replacements: Array.from({ length: 101 }, (_, index) => ({ findString: `f${index}`, replacementString: 'x' })) });
  assert.throws(() => parseCotEditorReplacementImport(tooMany, 'many.cotrpl'), /超过 100 条/);
  assert.throws(() => parseCotEditorReplacementImport(JSON.stringify({ replacements: [{ findString: 'x' }] }), 'missing.cotrpl'), /缺少字符串类型/);
  assert.throws(() => parseCotEditorReplacementImport(JSON.stringify({ replacements: [{ findString: 'x'.repeat(4097), replacementString: 'y' }] }), 'large-rule.cotrpl'), /单字段大小限制/);
});

test('the multiple-replace manager exposes file import and a keyboard-compatible file drop list', () => {
  assert.match(index, /id="multiple-replace-import"[^>]*>导入/);
  assert.match(index, /id="multiple-replace-import-input"[^>]*type="file"[^>]*accept="[^"]*\.cotrpl,[^"]*\.tsv[^"]*"[^>]*multiple/);
  assert.match(index, /id="multiple-replace-definition-list"[^>]*可拖放/);
  assert.match(renderer, /multiple-replace-definition-list'[\s\S]*?addEventListener\('dragover'/);
  assert.match(renderer, /multiple-replace-definition-list'[\s\S]*?addEventListener\('drop'/);
  assert.match(renderer, /parseCotEditorReplacementImport\(await file\.text\(\), file\.name\)/);
  assert.match(renderer, /matchesFullWord: parsed\.definition\.matchesFullWord === true/);
  assert.match(renderer, /textualCaseInsensitive: parsed\.definition\.textualCaseInsensitive === true/);
  assert.match(renderer, /textualLiteral: parsed\.definition\.textualLiteral === true/);
  assert.match(renderer, /textualAnchored: parsed\.definition\.textualAnchored === true/);
  assert.match(renderer, /regexCaseInsensitive: parsed\.definition\.regexCaseInsensitive === true/);
  assert.match(renderer, /regexAllowCommentsAndWhitespace: parsed\.definition\.regexAllowCommentsAndWhitespace === true/);
  assert.match(renderer, /regexIgnoreMetacharacters: parsed\.definition\.regexIgnoreMetacharacters === true/);
  assert.match(renderer, /regexDotMatchesLineSeparators: parsed\.definition\.regexDotMatchesLineSeparators === true/);
  assert.match(renderer, /regexAnchorsMatchLines: parsed\.definition\.regexAnchorsMatchLines === true/);
  assert.match(renderer, /regexUnixLineSeparators: parsed\.definition\.regexUnixLineSeparators === true/);
  assert.match(index, /id="multiple-replace-matches-full-word"[^>]*type="checkbox"/);
  assert.match(renderer, /target\.id === 'multiple-replace-matches-full-word'/);
  assert.match(index, /id="multiple-replace-textual-case-insensitive"[^>]*type="checkbox"/);
  assert.match(renderer, /target\.id === 'multiple-replace-textual-case-insensitive'/);
  assert.match(index, /id="multiple-replace-textual-literal"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-textual-literal'\)\.checked = multipleReplaceDraft\?\.textualLiteral/);
  assert.match(renderer, /target\.id === 'multiple-replace-textual-literal'/);
  assert.match(index, /id="multiple-replace-textual-anchored"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-textual-anchored'\)\.checked = multipleReplaceDraft\?\.textualAnchored/);
  assert.match(renderer, /target\.id === 'multiple-replace-textual-anchored'/);
  assert.match(index, /id="multiple-replace-regex-case-insensitive"[^>]*type="checkbox"/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-case-insensitive'/);
  assert.match(index, /id="multiple-replace-regex-allow-comments-and-whitespace"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-regex-allow-comments-and-whitespace'\)\.checked = multipleReplaceDraft\?\.regexAllowCommentsAndWhitespace/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-allow-comments-and-whitespace'/);
  assert.match(index, /id="multiple-replace-regex-ignore-metacharacters"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-regex-ignore-metacharacters'\)\.checked = multipleReplaceDraft\?\.regexIgnoreMetacharacters/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-ignore-metacharacters'/);
  assert.match(index, /id="multiple-replace-regex-dot-matches-line-separators"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-regex-dot-matches-line-separators'\)\.checked = multipleReplaceDraft\?\.regexDotMatchesLineSeparators/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-dot-matches-line-separators'/);
  assert.match(index, /id="multiple-replace-regex-anchors-match-lines"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-regex-anchors-match-lines'\)\.checked = multipleReplaceDraft\?\.regexAnchorsMatchLines/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-anchors-match-lines'/);
  assert.match(index, /id="multiple-replace-regex-unix-line-separators"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-regex-unix-line-separators'\)\.checked = multipleReplaceDraft\?\.regexUnixLineSeparators/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-unix-line-separators'/);
  assert.match(renderer, /regexUseUnicodeWordBoundaries: parsed\.definition\.regexUseUnicodeWordBoundaries === true/);
  assert.match(index, /id="multiple-replace-regex-unicode-word-boundaries"[^>]*type="checkbox"/);
  assert.match(renderer, /multiple-replace-regex-unicode-word-boundaries'\)\.checked = multipleReplaceDraft\?\.regexUseUnicodeWordBoundaries/);
  assert.match(renderer, /target\.id === 'multiple-replace-regex-unicode-word-boundaries'/);
  assert.match(renderer, /unescapesReplacementString: parsed\.definition\.unescapesReplacementString === true/);
  assert.match(index, /id="multiple-replace-unescapes-replacement"[^>]*type="checkbox"/);
  assert.match(renderer, /target\.id === 'multiple-replace-unescapes-replacement'/);
});
