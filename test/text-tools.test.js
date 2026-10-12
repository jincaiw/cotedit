import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { history, redo, undo } from '@codemirror/commands';
import { documentLineEndingExtensions, documentLineEndingsField, setDocumentLineEndings, setDocumentLineEndingFallback } from '../lib/document-line-ending-history.js';
import { applyLineEndings, capitalizeWords, characterInfo, convertIndentation, convertRomanToFullWidth, convertRomanToHalfWidth, convertToFullWidth, convertToHalfWidth, decodeURLComponent, detectLineEnding, dominantLineEnding, encodeURLComponent, findEnclosingSymbolRange, getLineEndings, getOutline, lowercaseText, mapLineEndings, normalizeLineEndings, normalizeUnicode, replaceDoubleHyphensWithEmDash, replacePairedStraightQuotes, straightenCurlyQuotes, summarizeLineEndings, transformLineBlock, trailingWhitespaceChanges, uppercaseText } from '../lib/text-tools.js';

function referenceMapLineEndings(changes, oldText, newText, oldLineEndings, fallback) {
  const result = [];
  let oldCursor = 0;
  let newCursor = 0;
  let endingIndex = 0;
  changes.iterGaps((fromA, fromB, length) => {
    while (oldCursor < fromA) if (oldText[oldCursor++] === '\n') endingIndex++;
    while (newCursor < fromB) if (newText[newCursor++] === '\n') result.push(fallback);
    for (let offset = 0; offset < length; offset++) {
      if (oldText[fromA + offset] === '\n') result.push(oldLineEndings[endingIndex++] || fallback);
    }
    oldCursor = fromA + length;
    newCursor = fromB + length;
  });
  while (oldCursor < oldText.length) if (oldText[oldCursor++] === '\n') endingIndex++;
  while (newCursor < newText.length) if (newText[newCursor++] === '\n') result.push(fallback);
  return result;
}

test('detects and preserves common line endings during encoding conversion', () => {
  assert.equal(detectLineEnding('a\r\nb\r\n'), 'CRLF');
  assert.equal(detectLineEnding('a\rb'), 'CR');
  assert.equal(detectLineEnding('a\nb'), 'LF');
  assert.equal(normalizeLineEndings('a\r\nb\rc\nd', 'CRLF'), 'a\r\nb\r\nc\r\nd');
  assert.equal(normalizeLineEndings('a\r\nb', 'CR'), 'a\rb');
  assert.equal(normalizeLineEndings('a\r\nb\rc\nd\u0085e\u2028f\u2029g', 'LF'), 'a\nb\nc\nd\ne\nf\ng');
});

test('trims trailing ASCII spaces and tabs on every line in one undoable edit without altering mixed line endings', () => {
  const source = 'top \t\n\t \nkeep\u00a0 \n';
  const originalEndings = ['CRLF', 'CR', 'PS'];
  let state = EditorState.create({
    doc: source,
    extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LS')]
  });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  const changes = trailingWhitespaceChanges(view.state.doc);
  assert.deepEqual(changes, [
    { from: 3, to: 5, insert: '' },
    { from: 6, to: 8, insert: '' },
    { from: 14, to: 15, insert: '' }
  ]);
  view.dispatch(view.state.update({ changes, userEvent: 'input.trim.trailing-whitespace' }));

  const trimmed = 'top\n\nkeep\u00a0\n';
  assert.equal(view.state.doc.toString(), trimmed);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(applyLineEndings(trimmed, originalEndings), 'top\r\n\rkeep\u00a0\u2029');
  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), trimmed);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
});

test('sorts and transforms whole-line blocks without losing line endings or terminal-newline state', () => {
  const sorted = transformLineBlock('item 10\nitem 2\nHeader\n', ['CRLF', 'CR', 'PS'], 'sort', {
    keepFirstLine: true, fallbackLineEnding: 'LF'
  });
  assert.equal(sorted.text, 'item 10\nHeader\nitem 2\n');
  assert.deepEqual(sorted.lineEndings, ['CRLF', 'PS', 'CR']);

  const reversed = transformLineBlock('a\nb\nc', ['CRLF', 'CR'], 'reverse', { fallbackLineEnding: 'LF' });
  assert.equal(reversed.text, 'c\nb\na');
  assert.deepEqual(reversed.lineEndings, ['LF', 'CR']);
  assert.equal(transformLineBlock('a\nb\n', ['NEL', 'LS'], 'reverse').text, 'b\na\n');

  const shuffled = transformLineBlock('a\nb\nc', ['CR', 'LF'], 'shuffle', { random: () => 0, fallbackLineEnding: 'PS' });
  assert.equal(shuffled.text, 'b\nc\na');
  assert.deepEqual(shuffled.lineEndings, ['LF', 'PS']);

  const unique = transformLineBlock('a\nb\na\n', ['CRLF', 'CR', 'PS'], 'delete-duplicates', { fallbackLineEnding: 'LF' });
  assert.equal(unique.text, 'a\nb\n');
  assert.deepEqual(unique.lineEndings, ['CRLF', 'CR']);
  assert.equal(transformLineBlock('last\nfirst', [], 'sort').text, 'first\nlast');
  assert.throws(() => transformLineBlock('a', [], 'unknown'), RangeError);
});

test('detects, normalizes and round-trips all CotEditor line-ending types', () => {
  const raw = 'a\r\nb\rc\nd\u0085e\u2028f\u2029';
  const styles = ['CRLF', 'CR', 'LF', 'NEL', 'LS', 'PS'];
  assert.deepEqual(getLineEndings(raw), styles);
  assert.equal(detectLineEnding('a\u0085b'), 'NEL');
  assert.equal(detectLineEnding('a\u2028b'), 'LS');
  assert.equal(detectLineEnding('a\u2029b'), 'PS');
  assert.equal(normalizeLineEndings(raw), 'a\nb\nc\nd\ne\nf\n');
  assert.equal(applyLineEndings('a\nb\nc\nd\ne\nf\n', styles), raw);
  for (const type of ['NEL', 'LS', 'PS']) {
    assert.equal(normalizeLineEndings('first\nsecond', type), `first${{ NEL: '\u0085', LS: '\u2028', PS: '\u2029' }[type]}second`);
  }
});

test('converts only leading indentation at tab stops and preserves line content', () => {
  const source = ' \talpha\n\t  beta\n gamma\nplain';
  assert.equal(convertIndentation(source, 'spaces', 4), '    alpha\n      beta\n gamma\nplain');
  assert.equal(convertIndentation('        alpha\n      beta', 'tabs', 4), '\t\talpha\n\t  beta');
  assert.equal(convertIndentation('\tvalue', 'spaces', 0), '    value');
  assert.throws(() => convertIndentation('x', 'unknown'), RangeError);
});

test('converts indentation using the full supported 1–99 column Tab Width range', () => {
  assert.equal(convertIndentation('\t\tvalue', 'spaces', 99), `${' '.repeat(198)}value`);
  assert.equal(convertIndentation(`${' '.repeat(98)}\t\tvalue`, 'tabs', 99), '\t\tvalue');
  assert.equal(convertIndentation('\tvalue', 'spaces', 100), `${' '.repeat(99)}value`);
});

test('capitalizes Unicode words, safely encodes and decodes URL text, and normalizes selected text', () => {
  assert.equal(capitalizeWords('the ÉCOLE 你好-world'), 'The École 你好-world');
  assert.equal(encodeURLComponent('a b/é'), 'a%20b%2F%C3%A9');
  assert.equal(decodeURLComponent('a%20b%2F%C3%A9'), 'a b/é');
  for (const malformed of ['%', '%ZZ', '%E0%A4%A', '%41%20prefix%ZZ', '%ED%A0%80']) {
    assert.equal(decodeURLComponent(malformed), malformed, `malformed URL text should remain unchanged: ${malformed}`);
  }
  assert.throws(() => encodeURLComponent('\uD800'), URIError);
  assert.equal(normalizeUnicode('e\u0301', 'NFC'), 'é');
  assert.equal(normalizeUnicode('é', 'NFD'), 'e\u0301');
  assert.equal(normalizeUnicode('\uFB01', 'NFKC'), 'fi');
  assert.equal(normalizeUnicode('fi', 'NFKD'), 'fi');
  assert.throws(() => normalizeUnicode('x', 'unknown'), RangeError);
});

test('implements CotEditor Modified NFD and Modified NFC using HFS+ and composition-exclusion rules', () => {
  const hfsExcluded = '\u2000\uf900\u{2f800}';
  assert.equal(normalizeUnicode('', 'MODIFIED_NFD'), '');
  assert.equal(normalizeUnicode('É \t 神 ㍑ ＡＢC', 'MODIFIED_NFD'), 'É \t 神 ㍑ ＡＢC');
  assert.equal(normalizeUnicode(hfsExcluded, 'MODIFIED_NFD'), hfsExcluded,
    'HFS+ keeps U+2000–2FFF, U+F900–FAFF and U+2F800–2FAFF undecomposed');
  assert.equal(normalizeUnicode('\u1f71', 'MODIFIED_NFD'), '\u03b1\u0301',
    'Modified NFD uses the Unicode 3.2 canonical decomposition mapping');
  assert.equal(normalizeUnicode('A\u0315\u0300', 'MODIFIED_NFD'), 'A\u0300\u0315',
    'canonical combining marks are stably reordered by the Unicode 3.2 classes');
  assert.equal(normalizeUnicode('각', 'MODIFIED_NFD'), '\u1100\u1161\u11a8',
    'Hangul syllables use algorithmic canonical decomposition');
  assert.equal(normalizeUnicode('\u1f71 \u03b1\u0301', 'MODIFIED_NFC'), '\u1f71 \u03ac');
  assert.equal(normalizeUnicode('\u0344', 'MODIFIED_NFC'), '\u0344',
    'Full_Composition_Exclusion scalars remain segment boundaries');
  assert.equal(normalizeUnicode('\u1100\u1161\u11a8', 'MODIFIED_NFC'), '각');
});

test('capitalized words use whitespace boundaries and keep punctuation inside each word', () => {
  assert.equal(capitalizeWords("can't STOP mother-in-law FOO_BAR"), "Can't Stop Mother-in-law Foo_bar");
  assert.equal(capitalizeWords('(HELLO), [WORLD]!'), '(hello), [world]!');
  assert.equal(capitalizeWords('NASA\tÉCOLE\r\nFOO\u0085BAR\u2028BAZ'), 'Nasa\tÉcole\r\nFoo\u0085Bar\u2028Baz');
});

test('capitalized words lowercase whole whitespace-delimited tokens before uppercasing the first scalar', () => {
  assert.equal(capitalizeWords('ΟΣ ΑΣ'), 'Ος Ας', 'contextual Greek final sigma must see the full token');
  assert.equal(capitalizeWords('FOO_BAR'), 'Foo_bar');
  assert.equal(capitalizeWords('istanbul', 'tr'), 'İstanbul', 'explicit locale casing remains available to callers');
});

test('uses locale-aware Unicode casing for explicit upper- and lower-case transforms', () => {
  assert.equal(uppercaseText('iıß', 'tr'), 'İISS');
  assert.equal(lowercaseText('Iİ', 'tr'), 'ıi');
  assert.equal(lowercaseText('ΟΣ', 'el'), 'ος');
});

test('straightens the eight CotEditor curly quotes and leaves other punctuation unchanged', () => {
  const curlySingle = '‘’‚‛';
  const curlyDouble = '“”„‟';
  assert.equal(straightenCurlyQuotes(`${curlySingle} ${curlyDouble}`), `'''' """"`);
  assert.equal(straightenCurlyQuotes(`plain ' " ‹› 「」`), `plain ' " ‹› 「」`);
});

test('replaces only paired, unescaped straight quotes with English curly quote pairs', () => {
  assert.equal(replacePairedStraightQuotes(`"hello" and 'world'`), `“hello” and ‘world’`);
  assert.equal(replacePairedStraightQuotes(`"She said 'yes'."`), `“She said ‘yes’.”`);
  assert.equal(replacePairedStraightQuotes("don't change rock 'n' roll"), "don't change rock ‘n’ roll");
  assert.equal(replacePairedStraightQuotes(`"unfinished 'also`), `"unfinished 'also`);
  assert.equal(replacePairedStraightQuotes(String.raw`"outer \"inner\""`), String.raw`“outer \"inner\"”`);
  assert.equal(replacePairedStraightQuotes(`"before\nafter"`), `"before\nafter"`, 'quotes do not pair across lines');
  assert.equal(replacePairedStraightQuotes(`“already” ‹preserved›`), `“already” ‹preserved›`);
});

test('replaces each non-overlapping ASCII double-hyphen pair with an em dash only', () => {
  assert.equal(replaceDoubleHyphensWithEmDash('before -- middle ---- after'), 'before — middle —— after');
  assert.equal(replaceDoubleHyphensWithEmDash('--- ---- -----'), '—- —— ——-');
  assert.equal(replaceDoubleHyphensWithEmDash('— – − \u2015\n--'), '— – − \u2015\n—');
  assert.equal(replaceDoubleHyphensWithEmDash('single - hyphen'), 'single - hyphen');
});

test('applies Unicode 17 NFKC Case-Fold mappings including full fold and default ignorables', () => {
  assert.equal(normalizeUnicode('É \t 神 ㍑ ＡＢC', 'NFKC_CF'), 'é \t 神 リットル abc');
  assert.equal(normalizeUnicode('\u00adA\u200bB\ufe0f', 'NFKC_CF'), 'ab');
  assert.equal(normalizeUnicode('Straße Σς İ ①', 'NFKC_CF'), 'strasse σσ i\u0307 1');
  assert.equal(normalizeUnicode('', 'NFKC_CF'), '');
});

test('converts full-width/half-width ASCII and Japanese half-width Katakana safely', () => {
  assert.equal(convertToFullWidth('ABC 123!'), 'ＡＢＣ　１２３！');
  assert.equal(convertToHalfWidth('ＡＢＣ　１２３！'), 'ABC 123!');
  assert.equal(convertToFullWidth('ｶﾞﾊﾟ｡'), 'ガパ。');
  assert.equal(convertToHalfWidth('ガパ。'), 'ｶﾞﾊﾟ｡');
  assert.equal(convertToFullWidth('keep\tline\nwidth'), 'ｋｅｅｐ\tｌｉｎｅ\nｗｉｄｔｈ');
  assert.equal(convertToHalfWidth('漢字　かな'), '漢字 かな');
});

test('converts standalone combining dakuten and handakuten to half-width marks', () => {
  assert.equal(convertToHalfWidth('\u3099\u309a'), '\uff9e\uff9f');
  assert.equal(convertToFullWidth('\uff9e\uff9f'), '\u3099\u309a');
  assert.equal(convertToHalfWidth('か\u3099は\u309a'), 'か\uff9eは\uff9f', 'unmapped Hiragana stays intact while standalone marks convert');
  assert.equal(convertToHalfWidth('ガパ。'), 'ｶﾞﾊﾟ｡', 'marks paired with mapped Katakana still use the paired conversion');
});

test('converts only Roman letters and digits in CotEditor full-width Roman transformations', () => {
  const source = '犬 イヌ いぬ Ｉｎｕ Dog 123 １２３';
  assert.equal(convertRomanToFullWidth(source), '犬 イヌ いぬ Ｉｎｕ Ｄｏｇ １２３ １２３');
  assert.equal(convertRomanToHalfWidth(source), '犬 イヌ いぬ Inu Dog 123 123');
  assert.equal(convertRomanToFullWidth('+-_'), '+-_');
});

test('summarizes mixed line endings with bounded per-type line-number samples', () => {
  const report = summarizeLineEndings(['CRLF', 'LF', 'CRLF', 'PS', 'LF']);
  assert.equal(report.mixed, true);
  assert.equal(report.total, 5);
  assert.deepEqual(report.types, [
    { type: 'CRLF', count: 2, lines: [1, 3] },
    { type: 'LF', count: 2, lines: [2, 5] },
    { type: 'PS', count: 1, lines: [4] }
  ]);
  assert.equal(summarizeLineEndings(['LF', 'LF']).mixed, false);
  assert.deepEqual(summarizeLineEndings(['LF', 'CRLF', 'CR'], 1).types.map(item => item.lines), [[1], [2], [3]]);
});

test('preserves mixed line endings and assigns defaults to newly inserted lines', () => {
  const styles = getLineEndings('a\r\nb\rc\n');
  assert.deepEqual(styles, ['CRLF', 'CR', 'LF']);
  assert.equal(dominantLineEnding(styles), 'CRLF');
  assert.equal(applyLineEndings('a\nb\nc\n', styles, 'LF'), 'a\r\nb\rc\n');
  const state = EditorState.create({ doc: 'a\nb' });
  const transaction = state.update({ changes: { from: 2, to: 2, insert: 'x\n' } });
  const mapped = mapLineEndings(transaction.changes, state.doc.toString(), transaction.newDoc.toString(), ['CRLF'], 'LF');
  assert.deepEqual(mapped, ['CRLF', 'LF']);
  const unicodeStyles = mapLineEndings(transaction.changes, state.doc.toString(), transaction.newDoc.toString(), ['NEL'], 'PS');
  assert.equal(applyLineEndings(transaction.newDoc.toString(), unicodeStyles), 'a\u0085x\u2029b');
});

test('keeps untouched mixed line endings through edits, deletions and inserted lines', () => {
  const source = 'a\nb\nc\nd';
  const endings = ['CRLF', 'CR', 'NEL'];
  const fallback = 'LS';

  const editState = EditorState.create({ doc: source });
  const edit = editState.update({ changes: { from: 2, to: 3, insert: 'B' } });
  const editedEndings = mapLineEndings(edit.changes, source, edit.newDoc.toString(), endings, fallback);
  assert.deepEqual(editedEndings, endings);
  assert.equal(applyLineEndings(edit.newDoc.toString(), editedEndings), 'a\r\nB\rc\u0085d');

  const deleteState = EditorState.create({ doc: source });
  const deletion = deleteState.update({ changes: { from: 1, to: 2, insert: '' } });
  const deletedEndings = mapLineEndings(deletion.changes, source, deletion.newDoc.toString(), endings, fallback);
  assert.deepEqual(deletedEndings, ['CR', 'NEL']);
  assert.equal(applyLineEndings(deletion.newDoc.toString(), deletedEndings), 'ab\rc\u0085d');

  const insertState = EditorState.create({ doc: source });
  const insertion = insertState.update({ changes: { from: 4, to: 4, insert: 'new\n' } });
  const insertedEndings = mapLineEndings(insertion.changes, source, insertion.newDoc.toString(), endings, fallback);
  assert.deepEqual(insertedEndings, ['CRLF', 'CR', 'LS', 'NEL']);
  assert.equal(applyLineEndings(insertion.newDoc.toString(), insertedEndings), 'a\r\nb\rnew\u2028c\u0085d');
});

test('maps line endings equivalently across sparse edits in long Unicode documents', () => {
  const styles = ['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS'];
  for (let seed = 1; seed <= 24; seed++) {
    let source = '';
    for (let index = 0; index < 12_000; index++) {
      if ((index + seed) % 211 === 0) source += '\n';
      else if ((index * 17 + seed) % 389 === 0) source += '🧪';
      else source += String.fromCharCode(97 + (index * 11 + seed) % 26);
    }
    const changes = [
      { from: 17 + seed, to: 31 + seed, insert: 'alpha\nβeta' },
      { from: Math.floor(source.length / 3) + seed, to: Math.floor(source.length / 3) + seed + 19, insert: 'middle' },
      { from: Math.floor(source.length * 2 / 3) + seed, to: Math.floor(source.length * 2 / 3) + seed + 23, insert: '\nend' },
      { from: source.length - 37 - seed, to: source.length - 11 - seed, insert: 'tail\n' }
    ];
    const state = EditorState.create({ doc: source });
    const transaction = state.update({ changes });
    const endingCount = source.split('\n').length - 1;
    const endings = Array.from({ length: endingCount }, (_, index) => styles[(index + seed) % styles.length]);
    const fallback = styles[seed % styles.length];
    const expected = referenceMapLineEndings(transaction.changes, source, transaction.newDoc.toString(), endings, fallback);
    assert.deepEqual(
      mapLineEndings(transaction.changes, source, transaction.newDoc.toString(), endings, fallback),
      expected,
      `line-ending map must preserve the prior ChangeSet semantics (seed ${seed})`
    );
  }
});

test('Replace All preserves untouched mixed line endings through undo and redo', () => {
  const source = 'prefix\nneedle\nmiddle\nneedle\nsuffix';
  const originalEndings = ['CRLF', 'CR', 'PS', 'NEL'];
  let state = EditorState.create({ doc: source, extensions: [history(), ...documentLineEndingExtensions(originalEndings, 'LF')] });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  const matches = [...source.matchAll(/needle/g)].map(match => ({ from: match.index, to: match.index + match[0].length, insert: 'replace\nsecond' }));
  view.dispatch(view.state.update({ changes: matches, userEvent: 'input.replace.all' }));

  const replaced = 'prefix\nreplace\nsecond\nmiddle\nreplace\nsecond\nsuffix';
  const replacedEndings = ['CRLF', 'LF', 'CR', 'PS', 'LF', 'NEL'];
  assert.equal(view.state.doc.toString(), replaced);
  assert.deepEqual(view.state.field(documentLineEndingsField), replacedEndings);
  assert.equal(applyLineEndings(replaced, view.state.field(documentLineEndingsField)), 'prefix\r\nreplace\nsecond\rmiddle\u2029replace\nsecond\u0085suffix');

  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.deepEqual(view.state.field(documentLineEndingsField), originalEndings);
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), replaced);
  assert.deepEqual(view.state.field(documentLineEndingsField), replacedEndings);
});

test('undo and redo restore line-ending styles removed by a line-join edit', () => {
  const source = 'top\nmid\nend';
  let state = EditorState.create({ doc: source, extensions: [history(), ...documentLineEndingExtensions(['CRLF', 'PS'], 'LF')] });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  view.dispatch(view.state.update({ changes: { from: 3, to: 4, insert: '' }, userEvent: 'input.delete' }));
  assert.deepEqual(view.state.field(documentLineEndingsField), ['PS']);
  assert.equal(undo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), ['CRLF', 'PS']);
  assert.equal(redo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), ['PS']);
});

test('choosing a line-ending format updates inserted-line fallback and preserves it through undo and redo', () => {
  let state = EditorState.create({ doc: 'first\nsecond', extensions: [history(), ...documentLineEndingExtensions(['CRLF'], 'CRLF')] });
  const view = { state };
  view.dispatch = transaction => { view.state = transaction.state; };
  view.dispatch(view.state.update({ effects: [
    setDocumentLineEndings.of(['LF']),
    setDocumentLineEndingFallback.of('LF')
  ] }));
  assert.deepEqual(view.state.field(documentLineEndingsField), ['LF']);

  view.dispatch(view.state.update({ changes: { from: 5, to: 5, insert: '\n' }, userEvent: 'input.type' }));
  assert.deepEqual(view.state.field(documentLineEndingsField), ['LF', 'LF']);
  assert.equal(applyLineEndings(view.state.doc.toString(), view.state.field(documentLineEndingsField)), 'first\n\nsecond');
  assert.equal(undo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), ['LF']);
  assert.equal(redo(view), true);
  assert.deepEqual(view.state.field(documentLineEndingsField), ['LF', 'LF']);
});

test('builds a navigable outline for Markdown and code', () => {
  assert.deepEqual(getOutline('# Intro\ntext\n## Details'), [
    { line: 1, level: 1, label: 'Intro' },
    { line: 3, level: 2, label: 'Details' }
  ]);
  assert.deepEqual(getOutline('class Editor {\n  def run(self):\n    pass\n}', 'python'), [
    { line: 1, level: 1, label: 'class Editor' },
    { line: 2, level: 1, label: 'def run(self)' }
  ]);
  assert.deepEqual(getOutline('# First\u2028## Second', 'markdown'), [
    { line: 1, level: 1, label: 'First' },
    { line: 2, level: 2, label: 'Second' }
  ]);
});

test('selects the content of the closest matching enclosing symbols', () => {
  const source = 'call([one, {two: 3}])';
  const cursor = source.indexOf('two') + 1;
  const inner = findEnclosingSymbolRange(source, cursor);
  assert.deepEqual(inner, { from: source.indexOf('{') + 1, to: source.indexOf('}') });
  assert.equal(source.slice(inner.from, inner.to), 'two: 3');

  const selectedOne = source.indexOf('one') + 1;
  const outer = findEnclosingSymbolRange(source, selectedOne);
  assert.equal(source.slice(outer.from, outer.to), 'one, {two: 3}');
  const quoted = 'call("not )", {target})';
  const target = findEnclosingSymbolRange(quoted, quoted.indexOf('target') + 1);
  assert.equal(quoted.slice(target.from, target.to), 'target');
  const quoteRange = findEnclosingSymbolRange('say("hello")', 6);
  assert.equal('say("hello")'.slice(quoteRange.from, quoteRange.to), 'hello');
  assert.equal(findEnclosingSymbolRange('call(value', 7), null);
  const escaped = 'call(escaped\\)';
  assert.equal(findEnclosingSymbolRange(escaped, 8), null);
});

test('reports Unicode scalar information including supplementary characters', () => {
  assert.deepEqual(characterInfo('A😀B', 1), {
    character: '😀', codePoint: 0x1f600, hex: 'U+1F600', decimal: 0x1f600, utf16Length: 2, utf8Bytes: 4
  });
  assert.deepEqual(characterInfo('A😀B', 2), {
    character: '😀', codePoint: 0x1f600, hex: 'U+1F600', decimal: 0x1f600, utf16Length: 2, utf8Bytes: 4
  }, 'an offset inside the low surrogate still identifies the complete Unicode scalar');
  assert.equal(characterInfo('😀', 1).character, '😀');
  assert.equal(characterInfo('A😀B', 3).character, 'B', 'an offset after the pair remains unchanged');
  assert.equal(characterInfo('', 0), null);
});


test('sorts lines by extracted column or regular-expression keys with numeric ordering', () => {
  const byColumn = transformLineBlock('zed,12\nAlpha,2\nbeta,3', ['CRLF', 'CR'], 'sort', {
    getKey: line => line.split(',')[1], numeric: true, ignoreCase: true, fallbackLineEnding: 'PS'
  });
  assert.equal(byColumn.text, 'Alpha,2\nbeta,3\nzed,12');
  assert.deepEqual(byColumn.lineEndings, ['CR', 'PS']);

  const byPattern = transformLineBlock('item10\nitem2', [], 'sort', {
    getKey: line => line.match(/^item(\d+)$/u)?.[1], numeric: true, descending: true
  });
  assert.equal(byPattern.text, 'item10\nitem2');

  const accentSensitive = transformLineBlock('eclair\néclair\nEclair', [], 'sort', {
    localized: false, ignoreCase: true
  });
  assert.equal(accentSensitive.text, 'eclair\nEclair\néclair');
});


test('converts half-width Hangul letters to canonical Jamo and reverses each mapped form', () => {
  const halfWidthHangul = Array.from({ length: 0xffdc - 0xffa0 + 1 }, (_, index) => String.fromCodePoint(0xffa0 + index));
  const converted = halfWidthHangul.map(character => character.normalize('NFKC'));

  assert.equal(convertToFullWidth(halfWidthHangul.join('')), converted.join(''));
  for (let index = 0; index < halfWidthHangul.length; index++) {
    if (converted[index] !== halfWidthHangul[index]) {
      assert.equal(convertToHalfWidth(converted[index]), halfWidthHangul[index], `reverse mapping for U+${(0xffa0 + index).toString(16).toUpperCase()}`);
    }
  }
  assert.equal(convertToFullWidth('ﾡￂ'), '가', 'adjacent Jamo remain separate, as with ICU Fullwidth-Halfwidth');
  assert.equal(convertToHalfWidth('가'), 'ﾡￂ');
  assert.equal(convertToHalfWidth('가ㄱㅏ'), '가ㄱㅏ', 'precomposed syllables and compatibility Jamo are not half-width forms');
});
