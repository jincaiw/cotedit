import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCotSyntaxOutline, compileCotSyntaxRegex, compileCotSyntaxRule, cotSyntaxRegexSafetyReason } from '../lib/cot-syntax-regexp.js';

test('flattens equivalent nested single-character repeats before highlighting', () => {
  const compiled = compileCotSyntaxRule({ category: 'types', begin: '([a-zA-Z0-9._-]+)+', regularExpression: true });
  assert.ok(compiled);
  compiled.begin.lastIndex = 0;
  assert.equal(compiled.begin.exec('name-42')?.[0], 'name-42');
});

test('rejects ambiguous exponential repetition while allowing safe simple capture references', () => {
  assert.equal(cotSyntaxRegexSafetyReason('(a|aa)+$'), 'repeated-alternation');
  assert.throws(() => compileCotSyntaxRegex('(a|aa)+$'), /Unsafe or unsupported/);
  const outline = compileCotSyntaxOutline({ pattern: '^([-=_])\\1{2}\\R.+\\R\\1{3}$', template: '$1' });
  assert.ok(outline);
  outline.lastIndex = 0;
  assert.equal(outline.test('---\nsection\n---'), true);
});

test('allows simple numeric backreferences in CotEditor highlight rules only', () => {
  const rule = compileCotSyntaxRule({ category: 'keywords', begin: '([A-Z])\\1{2}', regularExpression: true });
  assert.ok(rule);
  rule.begin.lastIndex = 0;
  assert.equal(rule.begin.exec('AAA')?.[0], 'AAA');
  assert.equal(compileCotSyntaxRule({ category: 'keywords', begin: '(a+)\\1', regularExpression: true }), null);
});

test('supports bounded single-atom backreferences in upstream Markdown highlight rules', () => {
  const boldPattern = String.raw`(?<!\\)(\*{2,3})[^ \t*]((?!\R{2})(?:.|\R))*?(?<![\\ ])\1`;
  const bold = compileCotSyntaxRule({ category: 'commands', begin: boldPattern, regularExpression: true });
  assert.ok(bold, 'the upstream Markdown bold rule uses a bounded delimiter capture');
  assert.equal(bold.begin.exec('**bold**')?.[0], '**bold**');

  const italicPattern = String.raw`(?<!\\)(_{2,3})[^ \t_]((?!\R{2})(?:.|\R))*?(?<![\\ ])\1`;
  const italic = compileCotSyntaxRule({ category: 'commands', begin: italicPattern, regularExpression: true });
  assert.ok(italic, 'the upstream Markdown italic rule uses the same bounded delimiter shape');
  assert.equal(italic.begin.exec('__italic__')?.[0], '__italic__');

  const boundedReference = compileCotSyntaxRule({ category: 'keywords', begin: String.raw`([A-Z]{1,8})\1`, regularExpression: true });
  assert.ok(boundedReference);
  assert.equal(boundedReference.begin.exec('ABAB')?.[0], 'ABAB');
  assert.equal(compileCotSyntaxRule({ category: 'keywords', begin: String.raw`([A-Z]{1,9})\1`, regularExpression: true }), null);
  assert.equal(compileCotSyntaxRule({ category: 'keywords', begin: String.raw`([A-Z]{1,8})\1+`, regularExpression: true }), null);
  assert.equal(cotSyntaxRegexSafetyReason(String.raw`([A-Z]{1,9})\1`, { allowSimpleBackreferences: true }), 'backreference');
  assert.equal(cotSyntaxRegexSafetyReason(String.raw`([A-Z]{1,8})\1+`, { allowSimpleBackreferences: true }), 'backreference');
});

test('simplifies only a proven digit-subset-of-word branch in repeated alternatives', () => {
  const pattern = String.raw`\b[^-=_ \t\r\n](?:\w|\d|[-=])*_(?!_)\b`;
  const rule = compileCotSyntaxRule({ category: 'values', begin: pattern, regularExpression: true });
  assert.ok(rule, 'the upstream reStructuredText reference rule should compile');
  rule.begin.lastIndex = 0;
  assert.equal(rule.begin.exec('sample-name_')?.[0], 'sample-name_');
  assert.equal(cotSyntaxRegexSafetyReason(pattern), '');
  assert.equal(cotSyntaxRegexSafetyReason('(a|aa)+$'), 'repeated-alternation');
  assert.throws(() => compileCotSyntaxRegex('(a|aa)+$'), /Unsafe or unsupported/);
});

test('rejects line-scoped begins that require ICU line breaks on every alternative', () => {
  const upstreamFence = String.raw`^[~]{3,}[{[:space:]](?!~~~)(?:.|\R)*?\R[\t ]*[~]{3,}[\t ]*$`;
  assert.equal(compileCotSyntaxRule({ category: 'strings', begin: upstreamFence, regularExpression: true }), null);

  const mixed = compileCotSyntaxRule({ category: 'keywords', begin: String.raw`^foo\R|bar`, regularExpression: true });
  assert.ok(mixed, 'a line-only alternative remains usable');
  mixed.begin.lastIndex = 0;
  assert.equal(mixed.begin.exec('bar')?.[0], 'bar');
  assert.equal(compileCotSyntaxRule({ category: 'keywords', begin: String.raw`^foo\R|^bar\R`, regularExpression: true }), null);

  const optional = compileCotSyntaxRule({ category: 'keywords', begin: String.raw`^foo\R?`, regularExpression: true });
  assert.ok(optional, 'an optional line break does not make every match cross-line');
  optional.begin.lastIndex = 0;
  assert.equal(optional.begin.exec('foo')?.[0], 'foo');
});

test('adapts only CotEditor’s official Markdown blockquote range to blank-line termination', () => {
  const rule = {
    category: 'keywords',
    begin: String.raw`^([ ]{4}|\t)?>[\t ]`,
    end: String.raw`(\R[ \t]*\R)|\z`,
    regularExpression: true,
    isMultiline: true
  };
  const compiled = compileCotSyntaxRule(rule);
  assert.ok(compiled);
  assert.equal(compiled.endOnBlankLine, true);
  assert.equal(compiled.begin.exec('> quoted text')?.[0], '> ');
  assert.equal(compileCotSyntaxRule({ ...rule, end: `${rule.end}x` }), null, 'a near-match keeps the generic cross-line rule rejection');
  assert.equal(compileCotSyntaxRule({ ...rule, category: 'strings' }), null, 'the adapter is limited to the upstream keyword rule');
});
