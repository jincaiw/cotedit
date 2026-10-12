import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, getIndentation, indentUnit, syntaxTree } from '@codemirror/language';
import { createCotSyntaxMode, getCotSyntaxOutline, getCotSyntaxSupportSummary } from '../lib/cot-syntax-mode.js';

const definition = {
  name: 'Tiny',
  comments: { inline: [{ begin: '#' }], blocks: [{ begin: '/*', end: '*/' }] },
  strings: [{ begin: '"', end: '"', escapeCharacter: '\\', isMultiline: false }],
  characters: [],
  rules: [
    { category: 'keywords', begin: 'if' },
    { category: 'commands', begin: 'print' },
    { category: 'types', begin: 'café' }
  ],
};

function collectStyledTokens(definition, text) {
  const state = EditorState.create({ doc: text, extensions: [createCotSyntaxMode(definition)] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push([node.type.name, state.sliceDoc(node.from, node.to)]);
  } });
  return tokens;
}

test('builds a CodeMirror mode with CotEditor comment delimiters and literal token rules', () => {
  const mode = createCotSyntaxMode(definition);
  const state = EditorState.create({ doc: 'if ifdef café print "if" /* if */ # if', extensions: [mode] });
  assert.deepEqual(state.languageDataAt('commentTokens', 0)[0], {
    line: '#', block: { open: '/*', close: '*/' }
  });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) { if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push([node.type.name, state.sliceDoc(node.from, node.to)]); } });
  assert.ok(tokens.some(([type, text]) => type.includes('keyword') && text === 'if'));
  assert.ok(tokens.some(([type, text]) => type.includes('function') && text === 'print'));
  assert.ok(tokens.some(([type, text]) => type.includes('typeName') && text === 'café'));
  assert.ok(tokens.some(([type, text]) => type.includes('string') && text === '"if"'));
  assert.ok(tokens.some(([type, text]) => type.includes('comment') && text.includes('/* if */')));
  assert.ok(tokens.some(([type, text]) => type.includes('comment') && text.includes('# if')));
  assert.ok(!tokens.some(([, text]) => text === 'ifdef'), 'word prefix is not highlighted as a full keyword');
});

test('exposes single-grapheme and Python triple-quote pairs as bounded language data', () => {
  const mode = createCotSyntaxMode({
    name: 'Quote pairs', comments: { inline: [], blocks: [] },
    strings: [
      { begin: '«', end: '»', escapeCharacter: '\\', prefixes: ['raw'] },
      { begin: '«', end: '»', escapeCharacter: '\\' },
      { begin: 'e\u0301', end: 'o\u0308', escapeCharacter: '👩‍💻' },
      { begin: '👩🏽‍💻', end: '🧑🏽‍🚀' },
      { begin: 'e\u0301x', end: 'close' },
      { begin: '"""', end: '"""' }
    ],
    characters: [{ begin: '’', end: '’', escapeCharacter: '' }, { begin: 'n\u0303', end: 'n\u0303' }], rules: []
  });
  const state = EditorState.create({ doc: '«value»', extensions: [mode] });
  assert.deepEqual(state.languageDataAt('coteditQuotePairs', 2)[0], [
    { begin: '«', end: '»', escapeCharacter: '\\', prefixes: [] },
    { begin: 'e\u0301', end: 'o\u0308', escapeCharacter: '👩‍💻', prefixes: [] },
    { begin: '👩🏽‍💻', end: '🧑🏽‍🚀', escapeCharacter: '', prefixes: [] },
    { begin: '"""', end: '"""', escapeCharacter: '', prefixes: [] },
    { begin: '’', end: '’', escapeCharacter: '', prefixes: [] },
    { begin: 'n\u0303', end: 'n\u0303', escapeCharacter: '', prefixes: [] }
  ]);
});

test('prefers longer Python-style quote delimiters over the earlier single-quote rule', () => {
  const strings = [
    { begin: '"', end: '"', escapeCharacter: '\\' },
    { begin: '"""', end: '"""', escapeCharacter: '\\', isMultiline: true }
  ];
  const syntax = { name: 'Python quotes', comments: { inline: [], blocks: [] }, strings, characters: [], rules: [] };
  const singleLine = '"""triple-quoted words"""';
  const singleLineTokens = collectStyledTokens(syntax, singleLine).filter(([type]) => type.includes('string'));
  assert.deepEqual(singleLineTokens, [['string', singleLine]]);

  const multiLine = '"""first line\nsecond line"""';
  const multiLineTokens = collectStyledTokens(syntax, multiLine).filter(([type]) => type.includes('string'));
  assert.equal(multiLineTokens.map(([, text]) => text).join('\n'), multiLine);
});

test('retains all ordered CotEditor block-comment variants alongside CodeMirror primary tokens', () => {
  const mode = createCotSyntaxMode({
    ...definition,
    comments: {
      inline: [{ begin: '#' }, { begin: '//' }],
      blocks: [{ begin: '/*', end: '*/', isNestable: true }, { begin: '<!--', end: '-->' }]
    }
  });
  const state = EditorState.create({ doc: 'text', extensions: [mode] });

  assert.deepEqual(state.languageDataAt('commentTokens', 0)[0], {
    line: '#',
    block: { open: '/*', close: '*/', isNestable: true }
  }, 'existing CodeMirror commands keep using the first declared delimiter');
  assert.deepEqual(state.languageDataAt('coteditCommentTokens', 0)[0], {
    inlines: ['#', '//'],
    blocks: [
      { open: '/*', close: '*/', isNestable: true },
      { open: '<!--', close: '-->' }
    ]
  }, 'CotEdit commands can iterate every imported inline and block delimiter in source order');
});

test('preserves the imported nestable marker in both comment-token language data paths', () => {
  const mode = createCotSyntaxMode({
    ...definition,
    comments: { inline: [], blocks: [{ begin: '/*', end: '*/', isNestable: true }] }
  });
  const state = EditorState.create({ doc: 'text', extensions: [mode] });
  assert.equal(state.languageDataAt('commentTokens', 0)[0].block.isNestable, true);
  assert.deepEqual(state.languageDataAt('coteditCommentTokens', 0)[0].blocks, [
    { open: '/*', close: '*/', isNestable: true }
  ]);
});

test('exposes imported completion terms through CodeMirror language data', () => {
  const mode = createCotSyntaxMode({ ...definition, completions: ['AcceptFilter', 'AllowOverride'] });
  const state = EditorState.create({ doc: 'Ac', extensions: [mode] });
  const source = state.languageDataAt('autocomplete', 2)[0];
  assert.equal(typeof source, 'function');
  const result = source(new CompletionContext(state, 2, true));
  assert.deepEqual(result.options.map(option => option.label), ['AcceptFilter', 'AllowOverride']);
});

test('derives syntax completion words from literal keyword rules only when no explicit list exists', () => {
  const rules = [
    { category: 'keywords', begin: 'while' },
    { category: 'commands', begin: 'print' },
    { category: 'types', begin: 'Widget' },
    { category: 'strings', begin: 'stringLiteral' },
    { category: 'keywords', begin: 'word|another', regularExpression: true },
    { category: 'keywords', begin: 'closedWord', end: 'end' },
    { category: 'keywords', begin: 'WHILE' }
  ];
  const mode = createCotSyntaxMode({ ...definition, rules, completions: [] });
  const state = EditorState.create({ doc: 'wh', extensions: [mode] });
  const source = state.languageDataAt('autocomplete', 2)[0];
  const result = source(new CompletionContext(state, 2, true));
  assert.deepEqual(result.options.map(option => option.label), ['while', 'print', 'Widget']);

  const explicitMode = createCotSyntaxMode({ ...definition, rules, completions: ['onlyExplicit'] });
  const explicitState = EditorState.create({ doc: 'only', extensions: [explicitMode] });
  const explicitSource = explicitState.languageDataAt('autocomplete', 4)[0];
  const explicitResult = explicitSource(new CompletionContext(explicitState, 4, true));
  assert.deepEqual(explicitResult.options.map(option => option.label), ['onlyExplicit']);
});

test('respects CotEditor leadingOnly line comments', () => {
  const mode = createCotSyntaxMode({ name: 'Leading only', comments: { inline: [{ begin: '#', leadingOnly: true }], blocks: [] }, strings: [], characters: [], rules: [] });
  const state = EditorState.create({ doc: 'code # not-a-comment\n  # comment', extensions: [mode] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) { if (node.type.name.includes('comment')) tokens.push(state.sliceDoc(node.from, node.to)); } });
  assert.ok(!tokens.some(text => text.includes('not-a-comment')));
  assert.ok(tokens.some(text => text.includes('# comment')));
});

test('applies safe ICU-style regular-expression highlight rules', () => {
  const mode = createCotSyntaxMode({
    name: 'Regex', comments: { inline: [], blocks: [] }, strings: [], characters: [],
    rules: [
      { category: 'numbers', begin: '(?<![$\\w])[+-]?\\d+(?:\\.\\d+)?', regularExpression: true },
      { category: 'variables', begin: '\\$\\d\\b', regularExpression: true }
    ], outlines: [], indentation: { blockDelimiters: [] }
  });
  const state = EditorState.create({ doc: 'value = 42.5\n$3 + 4', extensions: [mode] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push([node.type.name, state.sliceDoc(node.from, node.to)]);
  } });
  assert.ok(tokens.some(([type, text]) => type.includes('number') && text === '42.5'));
  assert.ok(tokens.some(([type, text]) => type.includes('variableName') && text === '$3'));
  assert.ok(!tokens.some(([type, text]) => type.includes('number') && text === '3'), 'number embedded in a variable should not be highlighted');
});

test('tokenizes bounded-backreference Markdown emphasis rules in CodeMirror', () => {
  const rules = [
    String.raw`(?<!\\)(\*{2,3})[^ \t*]((?!\R{2})(?:.|\R))*?(?<![\\ ])\1`,
    String.raw`(?<!\\)(_{2,3})[^ \t_]((?!\R{2})(?:.|\R))*?(?<![\\ ])\1`
  ].map(begin => ({ category: 'commands', begin, regularExpression: true }));
  const mode = createCotSyntaxMode({
    name: 'Markdown emphasis', comments: { inline: [], blocks: [] }, strings: [], characters: [], rules
  });
  const state = EditorState.create({ doc: '**bold** and __italic__', extensions: [mode] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push([node.type.name, state.sliceDoc(node.from, node.to)]);
  } });
  assert.ok(tokens.some(([type, text]) => type.includes('function') && text === '**bold**'));
  assert.ok(tokens.some(([type, text]) => type.includes('function') && text === '__italic__'));
});

test('rejects multiline regular-expression rules that can consume line breaks', () => {
  for (const begin of ['BEGIN.*END', 'BEGIN\\s*END', 'BEGIN\\R.*END', 'BEGIN[^x]+END', 'BEGIN\\p{Z}']) {
    const rule = { category: 'strings', begin, end: 'END', regularExpression: true, isMultiline: true };
    const definition = { name: 'Multiline regex', comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [rule] };
    assert.equal(getCotSyntaxSupportSummary(definition).highlightRules, 1, `unsafe multiline regex accepted: ${begin}`);

    const mode = createCotSyntaxMode(definition);
    const state = EditorState.create({ doc: 'BEGIN\ninside\nEND', extensions: [mode] });
    ensureSyntaxTree(state, state.doc.length, 200);
    const tokens = [];
    syntaxTree(state).iterate({ enter(node) {
      if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push(state.sliceDoc(node.from, node.to));
    } });
    assert.ok(!tokens.some(text => text.includes('BEGIN') || text.includes('inside') || text.includes('END')));
  }
});

test('supports line-scoped multiline regex ranges for PowerShell here-strings', () => {
  for (const [begin, end] of [['@"$', '^"@$'], ["@'$", "^'@$"]]) {
    const rule = { category: 'strings', begin, end, regularExpression: true, isMultiline: true };
    const definition = { name: 'PowerShell here-string', comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [rule] };
    assert.equal(getCotSyntaxSupportSummary(definition).highlightRules, 0);

    const opening = begin.slice(0, -1);
    const closing = end.slice(1, -1);
    const doc = `${opening}\nbody text\n${closing}`;
    const state = EditorState.create({ doc, extensions: [createCotSyntaxMode(definition)] });
    ensureSyntaxTree(state, state.doc.length, 200);
    const stringTokens = [];
    syntaxTree(state).iterate({ enter(node) {
      if (node.type.name.includes('string')) stringTokens.push(state.sliceDoc(node.from, node.to));
    } });
    assert.equal(stringTokens.join('\n'), doc);
  }
});

test('reports the upstream Markdown fenced-code regex as unsupported instead of silently enabling a no-op', () => {
  const begin = String.raw`^[~]{3,}[{[:space:]](?!~~~)(?:.|\R)*?\R[\t ]*[~]{3,}[\t ]*$`;
  const rule = { category: 'strings', begin, regularExpression: true };
  const definition = { name: 'Markdown fenced code', comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [rule] };
  assert.equal(getCotSyntaxSupportSummary(definition).highlightRules, 1);

  const state = EditorState.create({ doc: '~~~js\nconst answer = 42;\n~~~', extensions: [createCotSyntaxMode(definition)] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const stringTokens = [];
  syntaxTree(state).iterate({ enter(node) {
    if (node.type.name.includes('string')) stringTokens.push(state.sliceDoc(node.from, node.to));
  } });
  assert.deepEqual(stringTokens, [], 'the cross-line begin cannot match CodeMirror’s per-line stream');
});

test('keeps the eight unsafe or semantically cross-line official highlight rules disabled at runtime', () => {
  const cases = [
    { label: 'Markdown strings[0] indented code block', category: 'strings', begin: String.raw`(?:\R{2,}|\A)((?:([ ]{4}|\t)(.*(?:\R+|\Z)))+)((?=^[ ]{0,4}\S)|\Z)`, text: '\n\n    code\n' },
    { label: 'Markdown strings[1] FrontMatter', category: 'strings', begin: String.raw`\A([-+]{3})\R.*?\R\1$`, isMultiline: true, text: '---\ntitle: sample\n---' },
    { label: 'Perl characters[0] single-quoted here-doc', category: 'characters', begin: String.raw`(?s)<<\s*'([0-9a-zA-Z_]+)'\s*;.+?\R\1\R`, text: "print <<'EOF';\nbody\nEOF\n" },
    { label: 'Perl strings[0] here-doc', category: 'strings', begin: String.raw`(?s)<<[ \t]*"?([0-9a-zA-Z_]+)"?[ \t]*;.+?\R\1\R`, text: 'print <<EOF;\nbody\nEOF\n' },
    { label: 'reStructuredText characters[1] code block', category: 'characters', begin: String.raw`(?<!^[\t ]{0,4}\.\. [a-z]{1,10} ?)::\R[\t ]*(?:\R(?:[\t ]*\R)?([\t ]+).*)(?:\R(?:[\t ]*\R)?\1.*)*`, text: '::\n\n    code\n' },
    { label: 'reStructuredText keywords[4] definition term', category: 'keywords', begin: String.raw`\R{2}([\t ]*)(?!(?:[#a-z]|[ivxlxcdm]+|\d+)\.)\w.*\R\1[\t ]+(?=\w)`, text: '\n\nTerm\n  definition' },
    { label: 'reStructuredText numbers[4] table', category: 'numbers', begin: String.raw`^\R(={4,} [= ]{4,}\R)(?:.|\R)+\1(?=$\R)`, text: '\n==== ====\nrow\n==== ====\n' },
    { label: 'reStructuredText types[0] overline heading', category: 'types', begin: String.raw`^([-=${String.fromCharCode(96)}` + String.raw`:.'"~^_*+#]{3,})\R.+\R\1$`, text: '---\nHeading\n---' }
  ];
  for (const item of cases) {
    const rule = { category: item.category, begin: item.begin, end: item.end || null, regularExpression: true, isMultiline: item.isMultiline === true };
    const definition = { name: item.label, comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [rule] };
    assert.equal(getCotSyntaxSupportSummary(definition).highlightRules, 1, `${item.label} remains explicitly unsupported`);
    assert.deepEqual(collectStyledTokens(definition, item.text), [], `${item.label} must not silently produce partial tokens`);
  }
});

test('highlights the exact CotEditor Markdown blockquote rule through a paragraph and stops before blank lines', () => {
  const rule = {
    category: 'keywords',
    begin: String.raw`^([ ]{4}|\t)?>[\t ]`,
    end: String.raw`(\R[ \t]*\R)|\z`,
    description: 'blockquote',
    regularExpression: true,
    isMultiline: true
  };
  const definition = { name: 'Markdown blockquote', comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [rule] };
  assert.equal(getCotSyntaxSupportSummary(definition).highlightRules, 0);

  const text = '> quoted\nlazy continuation\n  indented continuation\n\noutside\n>no-space\nplain\n    > indented quote\ncontinuation\n   \n\t> tab quote\ntab continuation';
  const quoteTokens = collectStyledTokens(definition, text)
    .filter(([type]) => type.includes('keyword'))
    .map(([, value]) => value);
  assert.deepEqual(quoteTokens, [
    '> quoted',
    'lazy continuation',
    '  indented continuation',
    '    > indented quote',
    'continuation',
    '\t> tab quote',
    'tab continuation'
  ]);
});

test('keeps all eight required-line-break highlight rules out of the line tokenizer', () => {
  const cases = [
    { label: 'Markdown keywords[1] horizontal rule', category: 'keywords', begin: String.raw`\R[\t ]*\R(?:\- *){3,}$`, text: '\n\n---' },
    { label: 'Markdown keywords[2] definition term', category: 'keywords', begin: String.raw`\R[^: \t\r\n].*+(?=\R[ ]{0,3}:[ \t])`, text: '\nTerm\n: definition' },
    { label: 'Markdown strings[2] fenced code block', category: 'strings', begin: String.raw`^[~]{3,}[{[:space:]](?!~~~)(?:.|\R)*?\R[\t ]*[~]{3,}[\t ]*$`, text: '~~~{yaml}\nkey: value\n~~~' },
    { label: 'Markdown types[1] setext level two', category: 'types', begin: String.raw`^(?!-(?:[\t ]|$)|(?:-[\t ]*){3,}$).+\R\-+[\t ]*$`, text: 'Heading\n---' },
    { label: 'Markdown types[2] setext level one', category: 'types', begin: String.raw`^.+\R\=+[\t ]*$`, text: 'Heading\n===' },
    { label: 'reStructuredText keywords[5] section separator', category: 'keywords', begin: String.raw`\R{2}[-=${String.fromCharCode(96)}` + String.raw`:.'"~^_*+#]{4,}\R{2}`, text: '\n\n----\n\n' },
    { label: 'reStructuredText numbers[5] grid table', category: 'numbers', begin: String.raw`^\R\+[-+]{3,}\+\R(?:(?!\R{2})(?:.|\R))+\+[-+]{3,}\+(?=$\R)`, text: '\n+---+\n| x |\n+---+\n' },
    { label: 'reStructuredText types[1] underline heading', category: 'types', begin: String.raw`^.+\R([-=${String.fromCharCode(96)}` + String.raw`:.'"~^_*+#])\1{2,}$`, text: 'Heading\n------' }
  ];
  for (const item of cases) {
    const definition = { name: item.label, comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [{ category: item.category, begin: item.begin, regularExpression: true }] };
    assert.equal(getCotSyntaxSupportSummary(definition).highlightRules, 1, `${item.label} requires a cross-line match`);
    assert.deepEqual(collectStyledTokens(definition, item.text), [], `${item.label} must not be treated as a line-local match`);
  }
});

test('highlights literal begin/end ranges across lines', () => {
  const mode = createCotSyntaxMode({
    name: 'Range', comments: { inline: [], blocks: [] }, strings: [], characters: [],
    rules: [{ category: 'strings', begin: 'BEGIN', end: 'END', isMultiline: true }],
    outlines: [], indentation: { blockDelimiters: [] }
  });
  const state = EditorState.create({ doc: 'BEGIN\ninside\nEND after', extensions: [mode] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push([node.type.name, state.sliceDoc(node.from, node.to)]);
  } });
  assert.ok(tokens.some(([type, text]) => type.includes('string') && text === 'BEGIN'));
  assert.ok(tokens.some(([type, text]) => type.includes('string') && text === 'inside'));
  assert.ok(tokens.some(([type, text]) => type.includes('string') && text === 'END'));
  assert.ok(!tokens.some(([type, text]) => type.includes('string') && text.includes('after')));
});

test('uses original Unicode offsets for case-insensitive literal range endings', () => {
  const mode = createCotSyntaxMode({
    name: 'Unicode ending', comments: { inline: [], blocks: [] }, strings: [], characters: [],
    rules: [{ category: 'strings', begin: 'A', end: 'END', ignoreCase: true, isMultiline: true }],
    outlines: [], indentation: { blockDelimiters: [] }
  });
  const state = EditorState.create({ doc: 'AİxEND rest', extensions: [mode] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const stringText = [];
  syntaxTree(state).iterate({ enter(node) {
    if (node.type.name.includes('string')) stringText.push(state.sliceDoc(node.from, node.to));
  } });
  assert.equal(stringText.join(''), 'AİxEND');

  const mixedCase = createCotSyntaxMode({
    name: 'Unicode ending case', comments: { inline: [], blocks: [] }, strings: [], characters: [],
    rules: [{ category: 'strings', begin: 'A', end: 'eNd', ignoreCase: true, isMultiline: true }],
    outlines: [], indentation: { blockDelimiters: [] }
  });
  const secondState = EditorState.create({ doc: 'AİxEND rest', extensions: [mixedCase] });
  ensureSyntaxTree(secondState, secondState.doc.length, 200);
  const secondStringText = [];
  syntaxTree(secondState).iterate({ enter(node) {
    if (node.type.name.includes('string')) secondStringText.push(secondState.sliceDoc(node.from, node.to));
  } });
  assert.equal(secondStringText.join(''), 'AİxEND');
});

test('extracts CotEditor outline templates and kinds', () => {
  const syntax = { outlines: [{ pattern: '^([ \\t]*)function\\s+(\\w+)', template: '$1$2', kind: 'function' }] };
  assert.deepEqual(getCotSyntaxOutline('function alpha() {}\n    function beta() {}', syntax), [
    { line: 1, level: 0, label: 'alpha', kind: 'function' },
    { line: 2, level: 1, label: 'beta', kind: 'function' }
  ]);
});

test('runs the official reStructuredText overline outline through the real outline extractor', () => {
  const markers = "[-=`:.'\"~^_*+#]";
  const pattern = `(?<=${markers}{3}\\R)(.+)(?=\\R(${markers})\\2{2,}+$)`;
  const syntax = { outlines: [{ pattern, template: '$1', kind: 'heading' }] };
  assert.equal(getCotSyntaxSupportSummary(syntax).outlineRules, 0);
  assert.deepEqual(getCotSyntaxOutline('=======\nAn overlined section\n=======\n', syntax), [
    { line: 2, level: 0, label: 'An overlined section', kind: 'heading' }
  ]);
  assert.deepEqual(getCotSyntaxOutline('=======\r\nAn overlined section\r\n=======\r\n', syntax), [
    { line: 2, level: 0, label: 'An overlined section', kind: 'heading' }
  ]);
  assert.deepEqual(getCotSyntaxOutline('==\nToo short\n==\n', syntax), []);
  const changedPattern = pattern.replace('{2,}+', '{2,}?+');
  assert.equal(getCotSyntaxSupportSummary({ outlines: [{ pattern: changedPattern }] }).outlineRules, 1,
    'the compatibility exception must not generalize to altered possessive expressions');
});

test('keeps the four unsafe or untranslated official outlines disabled under a bounded runtime probe', () => {
  const rules = [
    { description: 'Haskell class', kind: 'container', pattern: String.raw`^[\t ]*class\s*([A-Z].*\s+[a-z].*|\([\t ]*[A-Z].*[\t ]+[a-z].*([\t ]*,[\t ]*[A-Z][\w']*[\t ]+[A-Z][\w']*)*[\t ]*\))?[\t ]*=>[\t ]*[A-Z].*(where|$)`, sample: 'class Eq a => Ord a where\n' },
    { description: 'Pascal Type', kind: 'container', pattern: String.raw`(^\s*)(?:\T)(?:.*)(?<!\:)\=(?:.*)`, sample: 'type TSample = Integer;\n' },
    { description: 'Pascal Function', kind: 'function', ignoreCase: true, pattern: String.raw`^([ \t]*)(?:[a-z]* )*function(.*)(?:\;|\()`, sample: 'function Sample;\n' },
    { description: 'Pascal Procedure', kind: 'function', ignoreCase: true, pattern: String.raw`^([ \t]*)(?:[a-z]* )*procedure(.*)(?:\;|\()`, sample: 'procedure Sample;\n' }
  ];
  const moduleUrl = new URL('../lib/cot-syntax-mode.js', import.meta.url).href;
  const probe = `
    import { getCotSyntaxOutline, getCotSyntaxSupportSummary } from ${JSON.stringify(moduleUrl)};
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const payload = JSON.parse(raw);
    const results = payload.rules.map(rule => ({
      unsupported: getCotSyntaxSupportSummary({ outlines: [rule] }).outlineRules,
      items: getCotSyntaxOutline(rule.sample, { outlines: [rule] })
    }));
    results.push({
      unsupported: getCotSyntaxSupportSummary({ outlines: payload.rules }).outlineRules,
      items: getCotSyntaxOutline(payload.pressureText, { outlines: payload.rules })
    });
    process.stdout.write(JSON.stringify(results));
  `;
  const pressureText = `program Sample;\n${'a '.repeat(22_000)}functionX\n${'b '.repeat(22_000)}procedureX\n`;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
    input: JSON.stringify({ rules, pressureText }), encoding: 'utf8', timeout: 2000, maxBuffer: 128 * 1024
  });
  assert.equal(child.error, undefined, `the bounded outline probe must not time out: ${child.error?.message || ''}`);
  assert.equal(child.status, 0, child.stderr);
  const results = JSON.parse(child.stdout);
  assert.deepEqual(results.slice(0, rules.length), rules.map(() => ({ unsupported: 1, items: [] })));
  assert.deepEqual(results.at(-1), { unsupported: 4, items: [] }, 'all four official outline rules remain disabled on a 44KB near-miss document');
});

test('uses imported block delimiters for automatic indentation and dedent', () => {
  const mode = createCotSyntaxMode({
    name: 'Braces', comments: { inline: [], blocks: [] }, strings: [], characters: [], rules: [], outlines: [],
    indentation: { blockDelimiters: [{ begin: '{', end: '}' }] }
  });
  const state = EditorState.create({ doc: 'if (x) {\n', extensions: [mode, indentUnit.of('  ')] });
  assert.equal(getIndentation(state, state.doc.length), 2);
  const closeState = EditorState.create({ doc: 'if (x) {\n  }', extensions: [mode, indentUnit.of('  ')] });
  assert.equal(getIndentation(closeState, closeState.doc.length), 0);
});

test('honors CotEditor nestable block comments', () => {
  const mode = createCotSyntaxMode({
    name: 'Nested comments', comments: { inline: [], blocks: [{ begin: '/*', end: '*/', isNestable: true }] },
    strings: [], characters: [], rules: [], outlines: [], indentation: { blockDelimiters: [] }
  });
  const state = EditorState.create({ doc: '/* outer /* inner */ tail */ code', extensions: [mode] });
  ensureSyntaxTree(state, state.doc.length, 200);
  const tokens = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!['Document', 'Line', '⚠'].includes(node.type.name)) tokens.push([node.type.name, state.sliceDoc(node.from, node.to)]);
  } });
  assert.ok(tokens.some(([type, text]) => type.includes('comment') && text.includes('tail */')));
  assert.ok(!tokens.some(([type, text]) => type.includes('comment') && text.includes('code')));
});
