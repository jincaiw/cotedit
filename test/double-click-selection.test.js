import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { createCotSyntaxMode } from '../lib/cot-syntax-mode.js';
import { findEnclosingSymbolRangeNearPosition, selectEnclosingPairAtDoubleClick } from '../lib/double-click-selection.js';

function makeView(text, position) {
  return {
    state: { doc: { length: text.length, toString: () => text } },
    dispatch(transaction) { this.transaction = transaction; },
    posAtCoords() { return position; }
  };
}

function makeEvent(overrides = {}) {
  return {
    button: 0,
    detail: 2,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    prevented: false,
    preventDefault() { this.prevented = true; },
    ...overrides
  };
}

function makeCustomSyntaxView(text, position, delimiters) {
  const state = EditorState.create({
    doc: text,
    extensions: [createCotSyntaxMode({
      name: 'Custom quote test', comments: { inline: [], blocks: [] },
      strings: delimiters, characters: [], rules: []
    })]
  });
  ensureSyntaxTree(state, state.doc.length, 200);
  return { state, dispatch(transaction) { this.transaction = transaction; } };
}

function makeBuiltInSyntaxView(text, position, language) {
  const state = EditorState.create({ doc: text, extensions: [language] });
  ensureSyntaxTree(state, state.doc.length, 200);
  return { state, dispatch(transaction) { this.transaction = transaction; } };
}

test('double-click chooses the innermost quoted text instead of only the word', () => {
  const text = 'call({ name: "two words" })';
  const position = text.indexOf('two') + 1;
  const view = makeView(text, position);
  const event = makeEvent();

  assert.equal(selectEnclosingPairAtDoubleClick(view, position, event), true);
  assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to), 'two words');
  assert.equal(view.transaction.userEvent, 'select.pointer');
  assert.equal(view.transaction.scrollIntoView, true);
  assert.equal(event.prevented, true);
});

test('double-click chooses the innermost balanced bracket or angle-bracket interior', () => {
  for (const text of ['call([value])', '<value>']) {
    const position = text.indexOf('value') + 2;
    const view = makeView(text, position);
    assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true, text);
    assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to), 'value', text);
  }
});

test('double-click pair lookup keeps a bounded search context and restores global offsets', () => {
  const prefix = 'x'.repeat(60_000);
  const suffix = 'y'.repeat(60_000);
  const text = `${prefix} call([target]) ${suffix}`;
  const position = text.indexOf('target') + 2;
  const reads = [];
  const document = {
    length: text.length,
    sliceString(from, to) { reads.push({ from, to }); return text.slice(from, to); },
    toString() { assert.fail('CodeMirror documents should be read using the bounded sliceString range.'); }
  };

  assert.deepEqual(findEnclosingSymbolRangeNearPosition(document, position), {
    from: text.indexOf('[') + 1,
    to: text.indexOf(']')
  });
  assert.deepEqual(reads, [{ from: position - 54_096, to: position + 54_097 }]);
  assert.ok(reads[0].to - reads[0].from <= 108_193);
});

test('double-click pair lookup expands a left window edge across a combining grapheme', () => {
  const text = `[\u0301${'x'.repeat(49_997)} target]`;
  const position = text.indexOf('target') + 1;
  const reads = [];
  const document = {
    length: text.length,
    sliceString(from, to) { reads.push({ from, to }); return text.slice(from, to); },
    toString() { assert.fail('CodeMirror documents should be read using a bounded sliceString range.'); }
  };

  assert.deepEqual(findEnclosingSymbolRangeNearPosition(document, position), {
    from: 1,
    to: text.indexOf(']')
  });
  assert.equal(text[reads[0].from], '[', 'the search context includes the grapheme base before the raw window edge');
  assert.ok(reads[0].to - reads[0].from <= 108_193);
});

test('double-click pair lookup expands a right window edge across a combining grapheme', () => {
  const position = 2;
  const rawWindowEnd = position + 50_001;
  const text = `[target${'x'.repeat(rawWindowEnd - 1 - '[target'.length)}]\u0301`;
  const reads = [];
  const document = {
    length: text.length,
    sliceString(from, to) { reads.push({ from, to }); return text.slice(from, to); },
    toString() { assert.fail('CodeMirror documents should be read using a bounded sliceString range.'); }
  };

  assert.deepEqual(findEnclosingSymbolRangeNearPosition(document, position), {
    from: 1,
    to: text.indexOf(']')
  });
  assert.equal(text[rawWindowEnd - 1], ']', 'the raw window ends inside the closer grapheme');
  assert.ok(reads[0].to > rawWindowEnd, 'the complete grapheme is included');
  assert.ok(reads[0].to - reads[0].from <= 108_193);
});

test('double-click pair lookup declines a boundary whose grapheme exceeds its context budget', () => {
  const text = `${'x'.repeat(5_000)}[${'\u0301'.repeat(10_000)}${'x'.repeat(44_999)}target]`;
  const position = text.indexOf('target') + 1;
  const reads = [];
  const document = {
    length: text.length,
    sliceString(from, to) { reads.push({ from, to }); return text.slice(from, to); },
    toString() { assert.fail('CodeMirror documents should be read using a bounded sliceString range.'); }
  };

  assert.equal(findEnclosingSymbolRangeNearPosition(document, position), null);
  assert.equal(reads.length, 1);
  assert.ok(reads[0].to - reads[0].from <= 108_193);
});

test('double-click still selects a nearby pair in a large document when an outer pair is beyond the search window', () => {
  const text = `(${ 'x'.repeat(60_000) } [near target] ${ 'y'.repeat(60_000) })`;
  const position = text.indexOf('target') + 2;
  const view = makeView(text, position);

  assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true);
  assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to), 'near target');
});

test('double-click leaves a pair unmatched when its delimiters exceed the bounded search window', () => {
  const text = `(${ 'x'.repeat(50_001) }target${ 'y'.repeat(50_001) })`;
  const position = text.indexOf('target') + 2;
  const view = makeView(text, position);
  const event = makeEvent();

  assert.equal(selectEnclosingPairAtDoubleClick(view, position, event), false);
  assert.equal(view.transaction, undefined);
  assert.equal(event.prevented, false);
});

test('double-click on a custom-syntax delimiter selects its token, including escaped close delimiters', () => {
  const text = 'value = «left \\» middle words»;';
  const position = text.indexOf('«');
  const view = makeCustomSyntaxView(text, position, [{ begin: '«', end: '»', escapeCharacter: '\\' }]);
  assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true);
  assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to), '«left \\» middle words»');
  const contentPosition = text.indexOf('middle') + 1;
  const contentView = makeCustomSyntaxView(text, contentPosition, [{ begin: '«', end: '»', escapeCharacter: '\\' }]);
  assert.equal(selectEnclosingPairAtDoubleClick(contentView, contentPosition, makeEvent()), false);
});

test('double-click selects single-grapheme and Python triple-quoted tokens at their syntax boundaries', () => {
  const combiningOpen = 'e\u0301';
  const combiningClose = 'o\u0308';
  const emojiOpen = '👩🏽‍💻';
  const emojiClose = '🧑🏽‍🚀';
  const text = `${combiningOpen}combining words${combiningClose} ${emojiOpen}emoji words${emojiClose}`;
  const delimiters = [
    { begin: combiningOpen, end: combiningClose, escapeCharacter: '👩‍💻' },
    { begin: emojiOpen, end: emojiClose }
  ];

  for (const [delimiter, fragment, content] of [
    [combiningOpen, combiningOpen, 'combining words'],
    [emojiOpen, emojiOpen, 'emoji words'],
    [combiningClose, combiningClose, 'combining words'],
    [emojiClose, emojiClose, 'emoji words']
  ]) {
    const delimiterStart = text.indexOf(fragment, fragment === combiningClose || fragment === emojiClose ? text.indexOf(' ') : 0);
    const position = delimiterStart + 1;
    const view = makeCustomSyntaxView(text, position, delimiters);
    assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true, delimiter);
    assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to),
      fragment === combiningOpen || fragment === emojiOpen
        ? `${fragment}${content}${fragment === combiningOpen ? combiningClose : emojiClose}`
        : `${fragment === combiningClose ? combiningOpen : emojiOpen}${content}${fragment}`);
  }

  const multiText = 'abnot selectedcd';
  const multiPosition = 1;
  const multiView = makeCustomSyntaxView(multiText, multiPosition, [{ begin: 'ab', end: 'cd' }]);
  assert.equal(selectEnclosingPairAtDoubleClick(multiView, multiPosition, makeEvent()), false);
  assert.equal(multiView.transaction, undefined);

  const tripleText = '"""triple words"""';
  const tripleDelimiters = [
    { begin: '"', end: '"', escapeCharacter: '\\' },
    { begin: '"""', end: '"""', escapeCharacter: '\\', isMultiline: true }
  ];
  for (const position of [tripleText.indexOf('"""'), tripleText.lastIndexOf('"')]) {
    const view = makeCustomSyntaxView(tripleText, position, tripleDelimiters);
    assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true);
    assert.equal(tripleText.slice(view.transaction.selection.from, view.transaction.selection.to), tripleText);
  }
  for (const position of [1, 2, tripleText.lastIndexOf('"') - 2, tripleText.lastIndexOf('"') - 1]) {
    const view = makeCustomSyntaxView(tripleText, position, tripleDelimiters);
    const selected = selectEnclosingPairAtDoubleClick(view, position, makeEvent());
    if (selected) {
      assert.notEqual(tripleText.slice(view.transaction.selection.from, view.transaction.selection.to), tripleText,
        'only the outer syntax token endpoints take the triple-quote shortcut');
    }
  }
});

test('double-click on built-in JavaScript and Python quote boundaries selects the full syntax token', () => {
  const cases = [
    ['const message = "double words";', javascript(), '"double words"', '"'],
    ['const message = \'single words\';', javascript(), "'single words'", "'"],
    ['const message = `template words`;', javascript(), '`template words`', '`'],
    ['message = "python words"', python(), '"python words"', '"']
  ];

  for (const [text, language, expected, quote] of cases) {
    for (const position of [text.indexOf(quote), text.lastIndexOf(quote)]) {
      const view = makeBuiltInSyntaxView(text, position, language);
      assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true, text);
      assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to), expected, text);
    }
  }
});

test('built-in syntax quote selection remains boundary-only and preserves interior selection', () => {
  const text = 'const message = "two words";';
  const position = text.indexOf('two') + 1;
  const view = makeBuiltInSyntaxView(text, position, javascript());
  assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent()), true);
  assert.equal(text.slice(view.transaction.selection.from, view.transaction.selection.to), 'two words');
});

test('custom syntax quote prefixes gate nonstandard delimiters without affecting a matching prefix', () => {
  const text = 'x = «plain text»; r«raw text»';
  const delimiters = [{ begin: '«', end: '»', prefixes: ['r'] }];
  const plainPosition = text.indexOf('«');
  const plainView = makeCustomSyntaxView(text, plainPosition, delimiters);
  assert.equal(selectEnclosingPairAtDoubleClick(plainView, plainPosition, makeEvent()), false);
  const rawPosition = text.indexOf('«', text.indexOf(';'));
  const rawView = makeCustomSyntaxView(text, rawPosition, delimiters);
  assert.equal(selectEnclosingPairAtDoubleClick(rawView, rawPosition, makeEvent()), true);
  assert.equal(text.slice(rawView.transaction.selection.from, rawView.transaction.selection.to), '«raw text»');
});

test('custom syntax prefix rejection also blocks fallback for standard quote delimiters', () => {
  const text = 'x = "plain text"; r"raw text"';
  const delimiters = [{ begin: '"', end: '"', prefixes: ['r'] }];
  const plainPosition = text.indexOf('"');
  const plainView = makeCustomSyntaxView(text, plainPosition, delimiters);
  assert.equal(selectEnclosingPairAtDoubleClick(plainView, plainPosition, makeEvent()), false);
  const rawPosition = text.indexOf('"', text.indexOf(';'));
  const rawView = makeCustomSyntaxView(text, rawPosition, delimiters);
  assert.equal(selectEnclosingPairAtDoubleClick(rawView, rawPosition, makeEvent()), true);
  assert.equal(text.slice(rawView.transaction.selection.from, rawView.transaction.selection.to), '"raw text"');
});

test('triple-quote prefix rejection is not bypassed by a shorter single-quote rule', () => {
  const delimiters = [
    { begin: '"', end: '"', escapeCharacter: '\\' },
    { begin: '"""', end: '"""', escapeCharacter: '\\', prefixes: ['r'] }
  ];
  const plainText = '"""plain text"""';
  const plainView = makeCustomSyntaxView(plainText, 0, delimiters);
  assert.equal(selectEnclosingPairAtDoubleClick(plainView, 0, makeEvent()), false);
  assert.equal(plainView.transaction, undefined);

  const rawText = 'r"""raw text"""';
  const rawPosition = rawText.indexOf('"""');
  const rawView = makeCustomSyntaxView(rawText, rawPosition, delimiters);
  assert.equal(selectEnclosingPairAtDoubleClick(rawView, rawPosition, makeEvent()), true);
  assert.equal(rawText.slice(rawView.transaction.selection.from, rawView.transaction.selection.to), rawText.slice(rawPosition));
});

test('ordinary text and unmatched delimiters preserve CodeMirror default selection', () => {
  for (const text of ['ordinary', 'call(value']) {
    const position = text.indexOf(text === 'ordinary' ? 'nary' : 'value') + 1;
    const view = makeView(text, position);
    const event = makeEvent();
    assert.equal(selectEnclosingPairAtDoubleClick(view, position, event), false, text);
    assert.equal(view.transaction, undefined, text);
    assert.equal(event.prevented, false, text);
  }
});

test('modified or invalid double-click gestures do not replace the ordinary selection behavior', () => {
  const text = 'call(value)';
  const position = text.indexOf('value') + 1;
  for (const overrides of [{ shiftKey: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }, { button: 1 }, { detail: 1 }]) {
    const view = makeView(text, position);
    assert.equal(selectEnclosingPairAtDoubleClick(view, position, makeEvent(overrides)), false);
    assert.equal(view.transaction, undefined);
  }
  assert.equal(selectEnclosingPairAtDoubleClick(makeView(text, position), null, makeEvent()), false);
  assert.equal(selectEnclosingPairAtDoubleClick(makeView(text, position), text.length + 1, makeEvent()), false);
});

test('the pair-selection helper is routed only through the editor double-click handler', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /const pairedDoubleClickSelection = EditorView\.domEventHandlers\(\{\s*dblclick\(event, view\)/);
  assert.match(source, /return selectEnclosingPairAtDoubleClick\(view, position, event\);/);
  assert.match(source, /crosshairCursor\(\),\s*verticalPointerSelection,\s*pairedDoubleClickSelection,/);
});
