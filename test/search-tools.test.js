import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { history, redo, undo } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { SearchQuery } from '@codemirror/search';
import { applyLineEndings } from '../lib/text-tools.js';
import { documentLineEndingExtensions, documentLineEndingsField, synchronizeDocumentLineEndingMetadata } from '../lib/document-line-ending-history.js';
import { collectSearchMatches, createSearchQuery, createSearchReplacementChanges, nextSearchMatchIndex, normalizeSearchLineEndings } from '../lib/search-tools.js';
import { collectVisibleSearchHighlights } from '../lib/search-highlights.js';
import { translateIcuRegex } from '../lib/icu-regexp.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function find(source, pattern, { regexp = true, caseSensitive = true, wholeWord = false, diacriticInsensitive = false } = {}) {
  const state = EditorState.create({ doc: source });
  const search = regexp ? translateIcuRegex(pattern) : pattern;
  const query = createSearchQuery({ search, regexp, caseSensitive, wholeWord, diacriticInsensitive });
  assert.equal(query.valid, true, `query should be valid: ${search}`);
  return collectSearchMatches(state, query);
}

test('normalizes literal and regex search queries with every supported document line separator', () => {
  const state = EditorState.create({ doc: 'top\nbottom' });
  for (const separator of ['\n', '\r\n', '\r', '\u0085', '\u2028', '\u2029']) {
      const normalized = normalizeSearchLineEndings(`top${separator}bottom`);
      assert.equal(normalized, 'top\nbottom');
      for (const regexp of [false, true]) {
      const query = createSearchQuery({ search: regexp ? translateIcuRegex(normalized) : normalized, regexp });
      assert.deepEqual(collectSearchMatches(state, query).map(match => match[0]), ['top\nbottom']);
    }
  }
  assert.equal(normalizeSearchLineEndings(String.raw`top\r?\nbottom`), String.raw`top\r?\nbottom`, 'escaped regex tokens remain unchanged');
  assert.ok(renderer.includes("const query = normalizeSearchLineEndings($('#search-query').value);"), 'the actual renderer normalizes query input before constructing SearchQuery');
  assert.match(renderer, /return createSearchQuery\(\{ search: searchOptions\.regexp \? translateIcuRegex\(query\) : query/);
});

test('literal editor search accepts canonical equivalents but rejects compatibility-only matches', () => {
  const source = '😀 cafe\u0301 café | ① 1 | · ·';
  const state = EditorState.create({ doc: source });
  const rawCodeMirrorMatches = collectSearchMatches(state, new SearchQuery({ search: '1', regexp: false, caseSensitive: true }));
  assert.deepEqual(rawCodeMirrorMatches.map(match => match[0]), ['①', '1'], 'CodeMirror NFKD also matches compatibility decompositions');

  const accents = collectSearchMatches(state, createSearchQuery({ search: 'café', regexp: false, caseSensitive: true }));
  assert.deepEqual(accents.map(match => source.slice(match.index, match.index + match[0].length)), ['cafe\u0301', 'café']);
  assert.deepEqual(accents.map(match => match.index), [source.indexOf('cafe\u0301'), source.indexOf('café')]);

  const compatibility = collectSearchMatches(state, createSearchQuery({ search: '1', regexp: false, caseSensitive: true }));
  assert.deepEqual(compatibility.map(match => match[0]), ['1']);
  const changes = compatibility.map(match => ({ from: match.index, to: match.index + match[0].length, insert: 'one' }));
  assert.equal(state.update({ changes }).state.doc.toString(), '😀 cafe\u0301 café | ① one | · ·');

  const punctuation = collectSearchMatches(state, createSearchQuery({ search: '·', regexp: false, caseSensitive: true }));
  assert.deepEqual(punctuation.map(match => match[0]), ['·', '·']);
});

test('literal canonical validation honors case-insensitive matching while regex is unchanged', () => {
  const state = EditorState.create({ doc: 'e\u0301 É ① 1' });
  assert.deepEqual(
    collectSearchMatches(state, createSearchQuery({ search: 'É', regexp: false, caseSensitive: false })).map(match => match[0]),
    ['e\u0301', 'É']
  );
  assert.deepEqual(
    collectSearchMatches(state, createSearchQuery({ search: '1', regexp: true, caseSensitive: true })).map(match => match[0]),
    ['1']
  );
});

test('uses ICU Unicode word and decimal-digit classes in editor search', () => {
  const words = find('café 猫 e\u0301 _ ١٢ ²', '\\w+');
  assert.deepEqual(words.map(match => match[0]), ['café', '猫', 'e\u0301', '_', '١٢']);

  const digits = find('42 ١٢ ²', '\\d+');
  assert.deepEqual(digits.map(match => match[0]), ['42', '١٢']);
  assert.equal(new RegExp(`^${translateIcuRegex('\\D')}$`, 'u').test('猫'), true);
  assert.equal(new RegExp(`^${translateIcuRegex('\\D')}$`, 'u').test('١'), false);
});

test('whole-word matching excludes embedded Latin and Unicode/CJK words in literal and regex searches', () => {
  assert.deepEqual(
    find('Cat scatter cat1 _cat cat_ cat!', 'cat', { regexp: false, caseSensitive: false, wholeWord: true }).map(match => match[0]),
    ['Cat', 'cat']
  );
  assert.deepEqual(
    find('猫 猫猫 猫a a猫 猫!', '猫', { regexp: false, wholeWord: true }).map(match => match[0]),
    ['猫', '猫']
  );
  assert.deepEqual(
    find('catdog cat! dogma dog!', '(cat|dog)', { wholeWord: true }).map(match => match[0]),
    ['cat', 'dog']
  );
});

test('ICU word boundaries include non-ASCII letters and combining marks', () => {
  assert.deepEqual(find('猫! 猫a e\u0301!', '\\b猫\\b').map(match => match[0]), ['猫']);
  assert.deepEqual(find('é猫', '\\B猫').map(match => match[0]), ['猫']);
  assert.equal(new RegExp(`^${translateIcuRegex('[\\w]')}$`, 'u').test('猫'), true);
  assert.equal(new RegExp(translateIcuRegex('[\\W]'), 'u').test('!'), true);
  assert.equal(new RegExp(translateIcuRegex('[\\W]'), 'u').test('a'), false);
});

test('collects CodeMirror zero-width matches and advances through them without looping', () => {
  const state = EditorState.create({ doc: 'alpha\nbeta' });
  const query = new SearchQuery({ search: '^', regexp: true });
  const matches = collectSearchMatches(state, query);
  assert.deepEqual(matches.map(match => [match.index, match[0]]), [[0, ''], [6, '']]);

  const first = nextSearchMatchIndex(matches, { from: 0, to: 0 }, false);
  assert.equal(first, 0);
  const second = nextSearchMatchIndex(matches, { from: 0, to: 0 }, false, first);
  assert.equal(second, 1);
  const wrapped = nextSearchMatchIndex(matches, { from: 6, to: 6 }, false, second);
  assert.equal(wrapped, 0);
});

test('preserves capture groups and full-document offsets for replacement templates', () => {
  const source = 'prefix café suffix';
  const matches = find(source, '(?<word>\\w+)');
  assert.equal(matches[1].index, 7);
  assert.equal(matches[1].input, source);
  assert.equal(matches[1].groups.word, 'café');
});

test('supports replacing every zero-width match with independent CodeMirror changes', () => {
  const state = EditorState.create({ doc: 'alpha\nbeta' });
  const matches = collectSearchMatches(state, new SearchQuery({ search: '^', regexp: true }));
  const changes = matches.map(match => ({ from: match.index, to: match.index, insert: '> ' }));
  assert.equal(state.update({ changes }).state.doc.toString(), '> alpha\n> beta');
});

test('ordinary Replace All preserves untouched mixed line endings through undo and redo', () => {
  const source = 'top\nneedle\nuntouched\nneedle\nbottom';
  const originalEndings = ['CRLF', 'CR', 'PS', 'NEL'];
  const state = EditorState.create({
    doc: source,
    extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LF')]
  });
  const query = createSearchQuery({ search: 'needle', regexp: false, caseSensitive: true });
  const matches = collectSearchMatches(state, query);
  const changes = createSearchReplacementChanges(matches, match => (
    match.index === source.indexOf('needle') ? 'replacement\r\ninside' : 'second\u2028line'
  ));

  assert.deepEqual(changes, [
    { from: 4, to: 10, insert: 'replacement\ninside' },
    { from: 21, to: 27, insert: 'second\nline' }
  ]);
  assert.match(renderer, /createSearchReplacementChanges\(matches, match => expandReplacement\(match, replacement\)\)/,
    'the renderer must route ordinary Replace All through the tested change builder');

  const view = { state, dispatch: transaction => { view.state = transaction.state; } };
  view.dispatch(view.state.update({ changes, userEvent: 'input.replace.all' }));
  const expectedText = 'top\nreplacement\ninside\nuntouched\nsecond\nline\nbottom';
  const expectedEndings = ['CRLF', 'LF', 'CR', 'PS', 'LF', 'NEL'];
  assert.equal(view.state.doc.toString(), expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), expectedEndings),
    'top\r\nreplacement\ninside\runtouched\u2029second\nline\u0085bottom');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
});

test('Replace All removing repeated newline prefixes preserves every untouched mixed ending', () => {
  const source = '<key>one</key>\n\t<string>LF-value</string>\n<key>two</key>\n\t<string>CR-value</string>\n<key>three</key>\n\t<string>LS-value</string>\n<tail/>';
  const originalEndings = ['LF', 'CRLF', 'LS', 'CR', 'NEL', 'PS'];
  const state = EditorState.create({
    doc: source,
    extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'VT')]
  });
  const query = createSearchQuery({ search: String.raw`\n\t<string>`, regexp: true, caseSensitive: true });
  const matches = collectSearchMatches(state, query);
  assert.equal(matches.length, 3);

  const changes = createSearchReplacementChanges(matches, () => '<string>');
  const view = { state, dispatch: transaction => { view.state = transaction.state; } };
  view.dispatch(view.state.update({ changes, userEvent: 'input.replace.all' }));

  const expectedText = '<key>one</key><string>LF-value</string>\n<key>two</key><string>CR-value</string>\n<key>three</key><string>LS-value</string>\n<tail/>';
  const expectedEndings = ['CRLF', 'CR', 'PS'];
  assert.equal(view.state.doc.toString(), expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(expectedText, expectedEndings),
    '<key>one</key><string>LF-value</string>\r\n<key>two</key><string>CR-value</string>\r<key>three</key><string>LS-value</string>\u2029<tail/>');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
});

test('ordinary multiline regex Replace All preserves outside mixed endings through undo and redo', () => {
  const source = 'head\nstart\nmiddle\nend\ntail';
  const originalEndings = ['CRLF', 'CR', 'PS', 'NEL'];
  const state = EditorState.create({
    doc: source,
    extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LF')]
  });
  const query = createSearchQuery({ search: String.raw`start\nmiddle\nend`, regexp: true, caseSensitive: true });
  const matches = collectSearchMatches(state, query);
  assert.deepEqual(matches.map(match => match[0]), ['start\nmiddle\nend']);
  const changes = createSearchReplacementChanges(matches, () => 'left\r\nright');
  assert.deepEqual(changes, [{ from: 5, to: 21, insert: 'left\nright' }]);

  const document = { text: source, eol: 'LF', lineEndings: [...originalEndings] };
  const view = { state };
  view.dispatch = transaction => {
    const startState = view.state;
    view.state = transaction.state;
    if (transaction.docChanged) document.text = view.state.doc.toString();
    synchronizeDocumentLineEndingMetadata(document, { startState, state: view.state });
  };

  view.dispatch(view.state.update({ changes, userEvent: 'input.replace.all' }));
  const expectedText = 'head\nleft\nright\ntail';
  const expectedEndings = ['CRLF', 'LF', 'NEL'];
  assert.equal(document.text, expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.deepEqual(document.lineEndings, expectedEndings);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'head\r\nleft\nright\u0085tail');

  assert.equal(undo(view), true);
  assert.equal(document.text, source);
  assert.deepEqual(document.lineEndings, originalEndings);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'head\r\nstart\rmiddle\u2029end\u0085tail');

  assert.equal(redo(view), true);
  assert.equal(document.text, expectedText);
  assert.deepEqual(document.lineEndings, expectedEndings);
  assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'head\r\nleft\nright\u0085tail');
});

test('ordinary Replace preserves untouched mixed line endings through undo and redo', () => {
  const source = 'top\nneedle\nuntouched\nneedle\nbottom';
  const originalEndings = ['CRLF', 'CR', 'PS', 'NEL'];
  const state = EditorState.create({
    doc: source,
    extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LF')]
  });
  const query = createSearchQuery({ search: 'needle', regexp: false, caseSensitive: true });
  const matches = collectSearchMatches(state, query);
  const match = matches[1];
  const replacement = 'replacement\r\ninside';
  const [change] = createSearchReplacementChanges([match], () => replacement);

  assert.deepEqual(change, {
    from: source.lastIndexOf('needle'),
    to: source.lastIndexOf('needle') + 'needle'.length,
    insert: 'replacement\ninside'
  });
  assert.match(renderer, /createSearchReplacementChanges\(\[match\], currentMatch => expandReplacement\(currentMatch, replacement\)\)/,
    'the renderer must route ordinary Replace through the shared change builder');

  const view = { state, dispatch: transaction => { view.state = transaction.state; } };
  view.dispatch(view.state.update({
    changes: change,
    selection: { anchor: change.from + change.insert.length },
    userEvent: 'input.replace'
  }));
  const expectedText = 'top\nneedle\nuntouched\nreplacement\ninside\nbottom';
  const expectedEndings = ['CRLF', 'CR', 'PS', 'LF', 'NEL'];
  assert.equal(view.state.doc.toString(), expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
  assert.equal(applyLineEndings(view.state.doc.toString(), expectedEndings),
    'top\r\nneedle\runtouched\u2029replacement\ninside\u0085bottom');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), expectedText);
  assert.deepEqual(view.state.field(documentLineEndingsField), expectedEndings);
});


test('literal diacritic-insensitive search finds composed, decomposed, and interior accents with source-aligned Replace ranges', () => {
  const source = '😀 café cafe\u0301 | naïve coöperate | ① 1 | Ａ A';
  assert.deepEqual(find(source, 'cafe', { regexp: false }).map(match => match[0]), [],
    'the default literal mode must not silently ignore accents or match only the base before a decomposed mark');

  const state = EditorState.create({ doc: source });
  const query = createSearchQuery({ search: 'cafe', regexp: false, caseSensitive: true, diacriticInsensitive: true });
  const matches = collectSearchMatches(state, query);
  assert.deepEqual(matches.map(match => match[0]), ['café', 'cafe\u0301']);
  const changes = createSearchReplacementChanges(matches, () => 'tea');
  assert.equal(state.update({ changes }).newDoc.toString(), '😀 tea tea | naïve coöperate | ① 1 | Ａ A',
    'replacement must consume trailing combining marks instead of orphaning them');

  assert.deepEqual(find(source, 'naive', { regexp: false, diacriticInsensitive: true }).map(match => match[0]), ['naïve']);
  assert.deepEqual(find(source, 'cooperate', { regexp: false, diacriticInsensitive: true }).map(match => match[0]), ['coöperate']);
  assert.deepEqual(find(source, '1', { regexp: false, diacriticInsensitive: true }).map(match => match[0]), ['1'],
    'NFD mark stripping must not introduce compatibility matches such as circled digits or fullwidth Latin');
  assert.deepEqual(find(source, 'A', { regexp: false, diacriticInsensitive: true }).map(match => match[0]), ['A'],
    'diacritic-insensitive mode does not also enable width-insensitive matching');
});

test('diacritic-insensitive literal search composes with case sensitivity and whole-word boundaries', () => {
  assert.deepEqual(find('École e\u0301COLE ecole', 'ECOLE', {
    regexp: false, caseSensitive: false, diacriticInsensitive: true
  }).map(match => match[0]), ['École', 'e\u0301COLE', 'ecole']);

  assert.deepEqual(find('caféine, café! cafe\u0301x, cafe.', 'cafe', {
    regexp: false, caseSensitive: false, wholeWord: true, diacriticInsensitive: true
  }).map(match => match[0]), ['café', 'cafe\u0301', 'cafe']);
});

test('diacritic-insensitive preference does not alter regexp matching and drives the same visible highlight ranges', () => {
  assert.deepEqual(find('naïve naïve naive', 'naive', {
    regexp: true, caseSensitive: true, diacriticInsensitive: true
  }).map(match => match[0]), ['naive'], 'regexp mode continues to use the explicit pattern unchanged');

  const state = EditorState.create({ doc: 'café cafe\u0301' });
  const query = createSearchQuery({ search: 'cafe', regexp: false, caseSensitive: true, diacriticInsensitive: true });
  const highlights = collectVisibleSearchHighlights(state, query, [{ from: 0, to: state.doc.length }]);
  assert.deepEqual(highlights.map(({ from, to }) => state.sliceDoc(from, to)), ['café', 'cafe\u0301']);

  assert.match(index, /id="match-diacritics"[^>]*aria-label="忽略变音符号"[^>]*aria-pressed="false"/);
  assert.match(renderer, /diacriticInsensitive: searchOptions\.diacriticInsensitive/);
  assert.match(renderer, /settings\.findIgnoresDiacritics = searchOptions\.diacriticInsensitive/);
  assert.match(renderer, /button\.disabled = searchOptions\.regexp/,
    'the literal-only option is visibly unavailable in regular-expression mode');
});
