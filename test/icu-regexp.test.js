import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchQuery } from '@codemirror/search';
import { findMatchingLineIndices, instrumentIcuWordBoundaries, translateIcuRegex } from '../lib/icu-regexp.js';
import { compileCotSyntaxRegex } from '../lib/cot-syntax-regexp.js';

const backslash = String.fromCharCode(92);

test('Unicode word-boundary instrumentation ignores character classes and ICU quoted literals', () => {
  const source = String.raw`[\b](?<word>\w+)\b-\1-\Q\b\E`;
  const instrumented = instrumentIcuWordBoundaries(source);
  assert.equal(instrumented.pattern, String.raw`[\b](?<word>\w+)()-\1-\Q\b\E`);
  assert.deepEqual(instrumented.boundaryGroups, [{ group: 2, positive: true }]);
  assert.deepEqual(instrumented.originalCaptureIndexes, [1]);
  const regex = new RegExp(translateIcuRegex(instrumented.pattern), 'dgu');
  const match = regex.exec(`\bword-word-${String.raw`\b`}`);
  assert.equal(match?.[1], 'word');
  assert.equal(match?.[2], '');
});

test('translates ICU \\R to all supported line-break sequences', () => {
  const regex = new RegExp(translateIcuRegex(`^a${backslash}Rb$`), 'u');
  for (const separator of ['\n', '\r\n', '\r', '\v', '\f', '\u0085', '\u2028', '\u2029']) {
    assert.equal(regex.test(`a${separator}b`), true, JSON.stringify(separator));
  }
});

test('translates ICU horizontal and vertical whitespace escapes', () => {
  const horizontal = new RegExp(translateIcuRegex(`^[${backslash}h]+$`), 'u');
  for (const value of [' \t', '\u00a0', '\u2007', '\u3000']) assert.equal(horizontal.test(value), true);
  const vertical = new RegExp(translateIcuRegex(`^[${backslash}v]+$`), 'u');
  for (const value of ['\n\v\f\r', '\u0085', '\u2028\u2029']) assert.equal(vertical.test(value), true);
  const horizontalClass = new RegExp(translateIcuRegex(`[a${backslash}h]+`), 'u');
  const verticalClass = new RegExp(translateIcuRegex(`[a${backslash}v]+`), 'u');
  assert.equal(horizontalClass.test('a\u3000'), true);
  assert.equal(verticalClass.test('a\u2028'), true);
});

test('CodeMirror accepts translated ICU line-break and Unicode property patterns', () => {
  for (const source of [`alpha${backslash}Rbeta`, `${backslash}w+`, `${backslash}b猫${backslash}b`, `${backslash}d+`]) {
    const query = new SearchQuery({ search: translateIcuRegex(source), regexp: true });
    assert.equal(query.valid, true, source);
  }
});

test('quotes literal patterns between ICU \\Q and \\E', () => {
  const translated = translateIcuRegex(`${backslash}Q.+[word]${backslash}E`);
  assert.equal(new RegExp(`^${translated}$`, 'u').test('.+[word]'), true);
  assert.equal(new RegExp(`^${translated}$`, 'u').test('any word'), false);
  const unterminated = translateIcuRegex(`${backslash}Qliteral+`);
  assert.equal(new RegExp(`^${unterminated}$`, 'u').test('literal+'), true);
});

test('preserves escaped backslashes and rejects ICU line breaks in classes', () => {
  const literalSlashR = new RegExp(`^${translateIcuRegex(`${backslash}${backslash}R`)}$`, 'u');
  assert.equal(literalSlashR.test(`${backslash}R`), true);
  assert.throws(() => translateIcuRegex(`[${backslash}R]`), /character class/);
});

test('does not close a character class at an escaped right bracket', () => {
  const translated = translateIcuRegex(`[a${backslash}]b]`);
  const regex = new RegExp(`^${translated}$`, 'u');
  assert.equal(regex.test(']'), true);
  assert.equal(regex.test('a'), true);
  assert.equal(regex.test('b'), true);
  assert.equal(regex.test('x'), false);
});

test('quotes metacharacters safely inside a character class and rejects malformed classes', () => {
  const quoted = new RegExp(translateIcuRegex(`[${backslash}Q]-^${backslash}E]`), 'u');
  for (const value of [']', '-', '^']) assert.equal(quoted.test(value), true);
  const nonWord = new RegExp(`^[${backslash}W]+$`, 'u');
  assert.equal(nonWord.test('!'), true);
  assert.equal(nonWord.test('a'), false);
  const posix = new RegExp(translateIcuRegex(`^[[:alpha:]_]+$`), 'u');
  assert.equal(posix.test('café_name'), true);
  assert.equal(posix.test('name2'), false);
  const whitespace = new RegExp(translateIcuRegex(`^[[:space:]]+$`), 'u');
  assert.equal(whitespace.test('\u00a0\t'), true);
  const hexadecimal = new RegExp(translateIcuRegex(`^[[:xdigit:]]+$`), 'u');
  assert.equal(hexadecimal.test('0Aaf'), true);
  assert.equal(hexadecimal.test('G'), false);
  const nonHexadecimal = new RegExp(translateIcuRegex(`^[[:^xdigit:]]+$`), 'u');
  assert.equal(nonHexadecimal.test('G猫'), true);
  assert.equal(nonHexadecimal.test('0'), false);
  assert.equal(nonHexadecimal.test('A'), false);
  assert.throws(() => translateIcuRegex('[g[:^xdigit:]]'), /only member of a character class/);
  assert.throws(() => translateIcuRegex('[[:^xdigit:]0]'), /only member of a character class/);
  assert.throws(() => translateIcuRegex('[^[:^xdigit:]]'), /only member of a character class/);
  const anchors = new RegExp(translateIcuRegex(`${backslash}Afoo${backslash}z`), 'u');
  assert.equal(anchors.test('foo'), true);
  assert.equal(anchors.test('xfoo'), false);
  assert.equal(anchors.test('foo\n'), false);
  const absoluteStart = new RegExp(translateIcuRegex(`${backslash}Afoo`), 'mu');
  assert.equal(absoluteStart.test('x\nfoo'), false);
  const beforeFinalBreak = new RegExp(translateIcuRegex(`foo${backslash}Z`), 'u');
  assert.equal(beforeFinalBreak.test('foo\n'), true);
  assert.equal(new RegExp(translateIcuRegex(`${backslash}&`), 'u').test('&'), true);
  assert.throws(() => translateIcuRegex('[abc'), /Unterminated character class/);
  assert.throws(() => translateIcuRegex('[[abc]]'), /Nested ICU character classes/);
});

test('maps multiline matches to distinct zero-based source lines', () => {
  const source = 'head\nalpha\nbeta\nfoo foo';
  const crossLine = new RegExp(translateIcuRegex(`alpha${backslash}Rbeta`), 'gmu');
  assert.deepEqual(findMatchingLineIndices(source, crossLine), [1]);
  assert.deepEqual(findMatchingLineIndices(source, /foo/gmu), [3]);
  assert.deepEqual(findMatchingLineIndices(source, /^/gmu), [0, 1, 2, 3]);
});

test('maps search hits across all supported line endings without splitting CRLF', () => {
  const source = 'zero\r\none\rtwo\u0085three\u2028four\u2029five';
  const regex = new RegExp(translateIcuRegex('one|two|three|four|five'), 'gmu');
  assert.deepEqual(findMatchingLineIndices(source, regex), [1, 2, 3, 4, 5]);
  assert.deepEqual(findMatchingLineIndices('a\r\nb', /^/gmu), [0, 1]);
});

test('advances zero-width Unicode matches and requires a global regex', () => {
  assert.deepEqual(findMatchingLineIndices('a😀\nb', /(?:)/gmu), [0, 1]);
  assert.throws(() => findMatchingLineIndices('text', /text/u), /global/);
});

test('preserves simple ICU possessive repetition without allowing backtracking', () => {
  const possessiveWhitespace = new RegExp(translateIcuRegex('\\s*+(?==)'), 'u');
  assert.equal(possessiveWhitespace.test('   ='), true);
  assert.equal(new RegExp(translateIcuRegex('\\s*+\\s'), 'u').test('  '), false);
  assert.equal(new RegExp(translateIcuRegex('a*+a'), 'u').test('aaa'), false);
  assert.equal(new RegExp(translateIcuRegex('a++b'), 'u').test('aaab'), true);
  assert.equal(new RegExp(translateIcuRegex('[\\d]*+x'), 'u').test('12x'), true);
  assert.equal(new RegExp(translateIcuRegex('\\R*+x'), 'u').test('\r\nx'), true);
  assert.equal(new RegExp(translateIcuRegex('\\*++x'), 'u').test('***x'), true);
  const possessiveOptional = new RegExp(`^${translateIcuRegex('a?+a')}$`, 'u');
  assert.equal(possessiveOptional.test('a'), false);
  assert.equal(possessiveOptional.test('aa'), true);
  assert.equal(new RegExp(translateIcuRegex('\\w?+x'), 'u').test('ax'), true);
  const groupedOptional = new RegExp(`^${translateIcuRegex('(?:[0-9_])?+5')}$`, 'u');
  assert.equal(groupedOptional.test('5'), false);
  assert.equal(groupedOptional.test('55'), true);
});

test('compiles the two single-class optional possessive patterns used by PowerShell', () => {
  const patterns = [
    [String.raw`(?<!\w)([-+]?[0-9_]+\.e(?:[0-9_])?+[fdm]?)((?:[kmgtp]b)?)\b`, '1.e3'],
    [String.raw`(?<!\w)([-+]?[0-9_]+e(?:[0-9_])?+[fdm]?)((?:[kmgtp]b)?)\b`, '1e3']
  ];
  for (const [pattern, sample] of patterns) {
    const regex = compileCotSyntaxRegex(pattern, { global: false, ignoreCase: true, allowSimpleBackreferences: true });
    assert.equal(regex.test(sample), true, pattern);
  }
});

test('rejects bounded or compound ICU possessive quantifiers instead of changing semantics', () => {
  assert.throws(() => translateIcuRegex('a{2}+b'), /possessive quantifiers are not supported/);
  assert.throws(() => translateIcuRegex('(ab)*+c'), /possessive quantifiers are not supported/);
  assert.throws(() => translateIcuRegex('(ab)?+c'), /possessive quantifiers are not supported/);
  assert.throws(() => translateIcuRegex('(?:[0-9_]+)?+5'), /possessive quantifiers are not supported/);
  assert.throws(() => translateIcuRegex('\\R?+x'), /variable-width atoms are not supported/);
  assert.equal(new RegExp(translateIcuRegex('[*+]'), 'u').test('+'), true);
  const lookbehind = new RegExp(translateIcuRegex('(?<=])name'), 'u');
  assert.equal(lookbehind.test(']name'), true);
});

test('translates fixed-width atomic groups and rejects groups whose atomicity matters', () => {
  const regex = new RegExp(translateIcuRegex('\\s".*?"(?>:)'), 'u');
  assert.equal(regex.test(' "label":'), true);
  assert.equal(new RegExp(translateIcuRegex('(?>[a-z])x'), 'u').test('ax'), true);
  assert.throws(() => translateIcuRegex('(?>a|ab)c'), /backtracking-dependent/);
  assert.throws(() => translateIcuRegex('(?>a+)b'), /backtracking-dependent/);
});
