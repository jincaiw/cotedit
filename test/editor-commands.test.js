import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { history, indentMore, insertNewline, insertNewlineAndIndent, moveLineUp, moveLineDown, lineComment, blockComment, lineUncomment, blockUncomment, undo, redo } from '@codemirror/commands';
import { createCotSyntaxMode } from '../lib/cot-syntax-mode.js';
import { blockCommentSelection, canUncommentToggleSelection, commentOutSelection, lineCommentSelection, toggleCommentAtVisualIndent, toggleLineCommentAtVisualIndent, uncommentSelection } from '../lib/comment-commands.js';
import { applyLineEndings } from '../lib/text-tools.js';
import { documentLineEndingExtensions, documentLineEndingsField, synchronizeDocumentLineEndingMetadata } from '../lib/document-line-ending-history.js';

function applyCommand(command, text, position, extensions = []) {
  const selection = typeof position === 'number' ? { anchor: position } : position;
  let state = EditorState.create({ doc: text, selection, extensions });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  const changed = command(view);
  return { changed, text: state.doc.toString(), selection: state.selection.main };
}

function applyMultiRangeCommand(command, text, selectedLineNumbers) {
  const initialDoc = EditorState.create({ doc: text }).doc;
  const selection = EditorSelection.create(selectedLineNumbers.map(number => {
    const line = initialDoc.line(number);
    return EditorSelection.range(line.from, line.to);
  }));
  let state = EditorState.create({
    doc: text,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true), history(), javascript()]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  return { changed: command(view), view };
}

test('plain Return inserts a newline without inherited indentation while auto-indent keeps it', () => {
  const noIndent = applyCommand(insertNewline, '  sample', 8, [indentUnit.of('  ')]);
  const withIndent = applyCommand(insertNewlineAndIndent, '  sample', 8, [indentUnit.of('  ')]);
  assert.equal(noIndent.changed, true);
  assert.equal(noIndent.text, '  sample\n');
  assert.equal(withIndent.changed, true);
  assert.equal(withIndent.text, '  sample\n  ');
});

test('moves the active line up and down while preserving the cursor position', () => {
  const up = applyCommand(moveLineUp, 'first\nsecond\nthird', 8);
  assert.equal(up.changed, true);
  assert.equal(up.text, 'second\nfirst\nthird');
  assert.equal(up.selection.head, 2);

  const down = applyCommand(moveLineDown, 'first\nsecond\nthird', 2);
  assert.equal(down.changed, true);
  assert.equal(down.text, 'second\nfirst\nthird');
  assert.equal(down.selection.head, 9);
});

test('mixed line-ending metadata remains stable when moving a line up or down through undo and redo', () => {
  const originalText = 'one\ntwo\nthree';
  const originalEndings = ['CRLF', 'PS'];
  const fallback = 'NEL';
  const expectedText = 'two\none\nthree';
  const expectedEndings = ['NEL', 'PS'];

  for (const [command, position] of [[moveLineUp, 6], [moveLineDown, 1]]) {
    const document = { text: originalText, eol: fallback, lineEndings: [...originalEndings] };
    let state = EditorState.create({
      doc: originalText,
      selection: { anchor: position },
      extensions: [history(), ...documentLineEndingExtensions(originalEndings, fallback)]
    });
    const view = {
      get state() { return state; },
      dispatch(transaction) {
        const startState = state;
        state = state.update(transaction).state;
        if (transaction.docChanged) document.text = state.doc.toString();
        synchronizeDocumentLineEndingMetadata(document, { startState, state });
      }
    };

    assert.equal(command(view), true);
    assert.equal(document.text, expectedText);
    assert.deepEqual(state.field(documentLineEndingsField), expectedEndings,
      'the recreated separator uses the configured NEL fallback while the untouched PS separator stays intact');
    assert.deepEqual(document.lineEndings, expectedEndings);
    assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'two\u0085one\u2029three');

    assert.equal(undo(view), true);
    assert.equal(document.text, originalText);
    assert.deepEqual(document.lineEndings, originalEndings);
    assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'one\r\ntwo\u2029three');

    assert.equal(redo(view), true);
    assert.equal(document.text, expectedText);
    assert.deepEqual(document.lineEndings, expectedEndings);
    assert.equal(applyLineEndings(document.text, document.lineEndings, document.eol), 'two\u0085one\u2029three');
  }
});

test('line movement is a no-op at the first and last line boundaries', () => {
  const up = applyCommand(moveLineUp, 'first\nsecond', 2);
  const down = applyCommand(moveLineDown, 'first\nsecond', 8);
  assert.equal(up.changed, false);
  assert.equal(up.text, 'first\nsecond');
  assert.equal(down.changed, false);
  assert.equal(down.text, 'first\nsecond');
});

test('line and block comment commands use the active language delimiters and can be undone semantically', () => {
  const line = applyCommand(lineComment, 'const x=1;', { anchor: 0, head: 10 }, [javascript()]);
  assert.equal(line.changed, true);
  assert.equal(line.text, '// const x=1;');

  const block = applyCommand(blockComment, 'const x=1;', { anchor: 0, head: 10 }, [javascript()]);
  assert.equal(block.changed, true);
  assert.equal(block.text, '/* const x=1; */');

  const undoBlock = applyCommand(blockUncomment, block.text, { anchor: 0, head: block.text.length }, [javascript()]);
  assert.equal(undoBlock.changed, true);
  assert.equal(undoBlock.text, 'const x=1;');
  const undoLine = applyCommand(lineUncomment, line.text, { anchor: 0, head: line.text.length }, [javascript()]);
  assert.equal(undoLine.changed, true);
  assert.equal(undoLine.text, 'const x=1;');
});

test('multi-range line comments, indentation and line movement affect every selection and undo/redo', () => {
  const source = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;';
  const cases = [
    [lineComment, [1, 3], '// const a = 1;\nconst b = 2;\n// const c = 3;\nconst d = 4;'],
    [indentMore, [1, 3], '  const a = 1;\nconst b = 2;\n  const c = 3;\nconst d = 4;'],
    [moveLineUp, [2, 4], 'const b = 2;\nconst a = 1;\nconst d = 4;\nconst c = 3;']
  ];
  for (const [command, selectedLines, expected] of cases) {
    const result = applyMultiRangeCommand(command, source, selectedLines);
    assert.equal(result.changed, true, `${command.name || 'lineComment'} changes every selected range`);
    assert.equal(result.view.state.doc.toString(), expected);
    assert.equal(result.view.state.selection.ranges.length, 2, 'both selections remain available after the command');
    assert.equal(undo(result.view), true);
    assert.equal(result.view.state.doc.toString(), source, 'undo restores the original document');
    assert.equal(redo(result.view), true);
    assert.equal(result.view.state.doc.toString(), expected, 'redo restores the multi-range edit');
  }
});


test('toggle comment aligns mixed tabs and spaces by visual indentation and roundtrips through history', () => {
  const source = '    one\n\t  two\n \n    three';
  const selection = { anchor: 0, head: source.length };
  let state = EditorState.create({ doc: source, selection, extensions: [history(), javascript()] });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  const command = target => toggleLineCommentAtVisualIndent(target, 2);
  const commented = '    // one\n\t  // two\n \n    // three';

  assert.equal(command(view), true);
  assert.equal(state.doc.toString(), commented,
    'a tab counts as two visual columns here, so the comment follows the same four-column indent as the spaces-only lines');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), commented);

  const uncommented = applyCommand(command, commented, selection, [javascript()]);
  assert.equal(uncommented.changed, true);
  assert.equal(uncommented.text, source, 'uncomment removes only the delimiter and its inserted spacer');

  const tabBoundarySource = '  alpha\n\tbeta';
  const tabBoundary = applyCommand(target => toggleLineCommentAtVisualIndent(target, 4), tabBoundarySource, { anchor: 0, head: tabBoundarySource.length }, [javascript()]);
  assert.equal(tabBoundary.text, '  // alpha\n// \tbeta',
    'when the common visual column falls inside a tab, place the delimiter before the indivisible tab');
});

test('toggle comment computes one common visual indent across disjoint selections and ignores blank lines', () => {
  const source = '    alpha\n\n  beta\n        untouched';
  const result = applyMultiRangeCommand(
    target => toggleLineCommentAtVisualIndent(target, 4),
    source,
    [1, 2, 3]
  );
  const commented = '  //   alpha\n\n  // beta\n        untouched';
  assert.equal(result.changed, true);
  assert.equal(result.view.state.doc.toString(), commented,
    'the selected ranges share the minimum indent; the selected empty line remains unchanged');
  assert.equal(result.view.state.selection.ranges.length, 3,
    'each disjoint selection is preserved');
  assert.equal(undo(result.view), true);
  assert.equal(result.view.state.doc.toString(), source);
  assert.equal(redo(result.view), true);
  assert.equal(result.view.state.doc.toString(), commented);
});

test('toggle comment across disjoint selections does not split a tab at the shared visual boundary', () => {
  const source = '  alpha\n\tbeta\n  untouched';
  const result = applyMultiRangeCommand(
    target => toggleLineCommentAtVisualIndent(target, 4),
    source,
    [1, 2]
  );
  assert.equal(result.view.state.doc.toString(), '  // alpha\n// \tbeta\n  untouched');
  assert.equal(toggleLineCommentAtVisualIndent(result.view, 4), true);
  assert.equal(result.view.state.doc.toString(), source,
    'a second toggle removes both inserted delimiters without changing indentation');
});

test('toggle comment reports uncomment state only when all actionable selected lines are commented', () => {
  const commentedWithBlank = '  // alpha\n\n// beta';
  const fullSelection = EditorState.create({
    doc: commentedWithBlank,
    selection: { anchor: 0, head: commentedWithBlank.length },
    extensions: [javascript()]
  });
  assert.equal(canUncommentToggleSelection(fullSelection), true,
    'blank lines do not force the toggle command into its comment-out branch');

  const mixed = EditorState.create({
    doc: '  // alpha\n\n beta',
    selection: { anchor: 0, head: '  // alpha\n\n beta'.length },
    extensions: [javascript()]
  });
  assert.equal(canUncommentToggleSelection(mixed), false,
    'an uncommented nonblank target keeps the action in comment-out mode');

  const disjointText = '// first\nuntouched\n// third';
  const disjointDoc = EditorState.create({ doc: disjointText }).doc;
  const disjoint = EditorState.create({
    doc: disjointText,
    selection: EditorSelection.create([1, 3].map(number => {
      const line = disjointDoc.line(number);
      return EditorSelection.range(line.from, line.to);
    })),
    extensions: [EditorState.allowMultipleSelections.of(true), javascript()]
  });
  assert.equal(canUncommentToggleSelection(disjoint), true,
    'all disjoint nonblank target lines participate in the same state decision');

  const blank = EditorState.create({ doc: '', extensions: [javascript()] });
  assert.equal(canUncommentToggleSelection(blank), false,
    'a lone empty line is still eligible for comment-out, not uncomment');
});

test('toggle comment gives complete block wrappers priority over inline comments when both styles exist', () => {
  const source = '/* // alpha\n// beta */';
  let state = EditorState.create({
    doc: source,
    selection: { anchor: 0, head: source.length },
    extensions: [history(), javascript()]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = transaction.state; }
  };

  assert.equal(canUncommentToggleSelection(state), true,
    'the menu state checks the selected block wrapper before inner line-comment tokens');
  assert.equal(toggleCommentAtVisualIndent(view, 4), true);
  assert.equal(state.doc.toString(), '// alpha\n// beta',
    'the toggle removes the surrounding block pair instead of toggling the inner line comments');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '// alpha\n// beta');

  const partialSource = '/* // wrapped */\n// plain';
  const partialDoc = EditorState.create({ doc: partialSource }).doc;
  const partialSelection = EditorSelection.create([1, 2].map(number => {
    const line = partialDoc.line(number);
    return EditorSelection.range(line.from, line.to);
  }));
  let partialState = EditorState.create({
    doc: partialSource,
    selection: partialSelection,
    extensions: [EditorState.allowMultipleSelections.of(true), javascript()]
  });
  const partialView = {
    get state() { return partialState; },
    dispatch(transaction) { partialState = transaction.state; }
  };

  assert.equal(canUncommentToggleSelection(partialState), false,
    'one wrapped range is insufficient to label a mixed multi-selection as fully uncommentable');
  assert.equal(toggleCommentAtVisualIndent(partialView, 4), true);
  assert.equal(partialState.doc.toString(), '// /* // wrapped */\n// // plain',
    'a partial block match follows CotEditor’s comment-out branch rather than removing only part');
});

test('toggle comment tries custom block variants in declaration order when both styles exist', () => {
  const source = '<!-- <% alpha %> -->\n// untouched';
  const syntax = createCotSyntaxMode({
    name: 'Multiple block comments with inline comments',
    comments: {
      inline: [{ begin: '//' }],
      blocks: [
        { begin: '/*', end: '*/' },
        { begin: '<!--', end: '-->' },
        { begin: '<%', end: '%>' }
      ]
    },
    strings: [],
    characters: [],
    rules: []
  });
  const doc = EditorState.create({ doc: source }).doc;
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.range(doc.line(1).from, doc.line(1).to),
    extensions: [history(), syntax]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(canUncommentToggleSelection(state), true,
    'the menu state probes later block variants after the preferred pair misses');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), '<% alpha %>\n// untouched',
    'the first matching declared block pair is removed, leaving the nested later pair intact');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '<% alpha %>\n// untouched');
});

test('toggle comment expands empty carets to current-line contents for block uncomment', () => {
  const source = '/* alpha */\n/* beta */';
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.create([
      EditorSelection.cursor(source.indexOf('alpha') + 2),
      EditorSelection.cursor(source.indexOf('alpha') + 4),
      EditorSelection.cursor(source.indexOf('beta') + 2)
    ]),
    extensions: [history(), javascript(), EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(canUncommentToggleSelection(state), true,
    'menu state checks each unique current line rather than the zero-width caret ranges');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), 'alpha\nbeta',
    'duplicate caret targets on one line are probed once and every wrapped target is uncommented');
  assert.equal(state.selection.ranges.length, 3, 'all original caret positions are mapped through the edit');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'alpha\nbeta');
});

test('toggle comment keeps all empty-caret targets in comment-out mode after a partial block match', () => {
  const source = '/* wrapped */\nplain';
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.create([
      EditorSelection.cursor(source.indexOf('wrapped') + 2),
      EditorSelection.cursor(source.indexOf('plain') + 2)
    ]),
    extensions: [history(), javascript(), EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(canUncommentToggleSelection(state), false,
    'a single block-wrapped caret target does not make a mixed selection fully uncommentable');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), '// /* wrapped */\n// plain',
    'partial block matches do not remove only the wrapped target');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
});

test('toggle comment validates balanced nesting for imported nestable block delimiters', () => {
  const syntax = createCotSyntaxMode({
    name: 'Nestable comments',
    comments: { inline: [{ begin: '//' }], blocks: [{ begin: '/*', end: '*/', isNestable: true }] },
    strings: [], characters: [], rules: []
  });
  const balanced = '/* outer /* inner */ tail */';
  let state = EditorState.create({
    doc: balanced,
    selection: { anchor: 0, head: balanced.length },
    extensions: [history(), syntax]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(canUncommentToggleSelection(state), true);
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), 'outer /* inner */ tail',
    'a balanced nested pair removes only the selected outer delimiters');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), balanced);

  const unbalanced = '/* outer /* inner */ tail';
  state = EditorState.create({
    doc: unbalanced,
    selection: { anchor: 0, head: unbalanced.length },
    extensions: [history(), syntax]
  });
  assert.equal(canUncommentToggleSelection(state), false,
    'an unmatched nested opener is not a valid outer block wrapper');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), `// ${unbalanced}`,
    'Toggle Comment follows its comment branch instead of deleting the inner close as the outer close');

  const surplusClose = '/* outer */ tail */';
  state = EditorState.create({
    doc: surplusClose,
    selection: { anchor: 0, head: surplusClose.length },
    extensions: [history(), syntax]
  });
  assert.equal(canUncommentToggleSelection(state), false,
    'an unmatched nested closer also invalidates the apparent outer wrapper');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), `// ${surplusClose}`,
    'an unmatched inner closer is not treated as a valid outer close');
});

test('explicit Uncomment does not remove an unbalanced nestable block wrapper', () => {
  const syntax = createCotSyntaxMode({
    name: 'Nestable comments',
    comments: { inline: [{ begin: '//' }], blocks: [{ begin: '/*', end: '*/', isNestable: true }] },
    strings: [], characters: [], rules: []
  });
  const source = '/* outer /* inner */ tail';
  const result = applyCommand(uncommentSelection, source, { anchor: 0, head: source.length }, [syntax]);
  assert.equal(result.changed, false);
  assert.equal(result.text, source);

  const balanced = '/* outer /* inner */ tail */';
  const valid = applyCommand(uncommentSelection, balanced, { anchor: 0, head: balanced.length }, [syntax]);
  assert.equal(valid.changed, true);
  assert.equal(valid.text, 'outer /* inner */ tail');
});

test('toggle comment treats the first partially matching block variant as comment-out state', () => {
  const source = '<!-- wrapped -->\n<% plain %>';
  const syntax = createCotSyntaxMode({
    name: 'Ordered partial block comments with inline comments',
    comments: {
      inline: [{ begin: '//' }],
      blocks: [
        { begin: '/*', end: '*/' },
        { begin: '<!--', end: '-->' },
        { begin: '<%', end: '%>' }
      ]
    },
    strings: [],
    characters: [],
    rules: []
  });
  const doc = EditorState.create({ doc: source }).doc;
  const selection = EditorSelection.create([1, 2].map(number => {
    const line = doc.line(number);
    return EditorSelection.range(line.from, line.to);
  }));
  let state = EditorState.create({
    doc: source,
    selection,
    extensions: [history(), syntax, EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(canUncommentToggleSelection(state), false,
    'the first block variant with any hit determines full-selection status');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), '// <!-- wrapped -->\n// <% plain %>',
    'a partial block hit does not skip to a later pair or silently uncomment only one range');
});

test('toggle comment falls back to block comments when selected syntax has no line-comment token', () => {
  const blockOnlyComments = EditorState.languageData.of(() => [{
    commentTokens: { block: { open: '<!--', close: '-->' } }
  }]);
  const source = '  alpha\n  beta';
  let state = EditorState.create({
    doc: source,
    selection: { anchor: 0, head: source.length },
    extensions: [history(), blockOnlyComments]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = transaction.state; }
  };

  assert.equal(canUncommentToggleSelection(state), false,
    'plain block-only text initially offers the comment-out branch');
  assert.equal(toggleCommentAtVisualIndent(view, 4), true);
  assert.equal(state.doc.toString(), '  <!-- alpha\n  beta -->',
    'the selection is wrapped as one block after its leading indentation');
  assert.equal(canUncommentToggleSelection(state), true,
    'the menu state recognizes the complete block-comment wrapper');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '  <!-- alpha\n  beta -->');
  assert.equal(toggleCommentAtVisualIndent(view, 4), true);
  assert.equal(state.doc.toString(), source,
    'a second toggle removes the block delimiters instead of adding a line comment');

  const disjointSource = 'alpha\nuntouched\nbeta';
  const disjointDoc = EditorState.create({ doc: disjointSource }).doc;
  const disjointSelection = EditorSelection.create([1, 3].map(number => {
    const line = disjointDoc.line(number);
    return EditorSelection.range(line.from, line.to);
  }));
  let disjointState = EditorState.create({
    doc: disjointSource,
    selection: disjointSelection,
    extensions: [EditorState.allowMultipleSelections.of(true), blockOnlyComments]
  });
  const disjointView = {
    get state() { return disjointState; },
    dispatch(transaction) { disjointState = transaction.state; }
  };
  assert.equal(toggleCommentAtVisualIndent(disjointView), true);
  assert.equal(disjointState.doc.toString(), '<!-- alpha -->\nuntouched\n<!-- beta -->');
  assert.equal(disjointState.selection.ranges.length, 2,
    'the block fallback preserves disjoint selections');
  assert.equal(canUncommentToggleSelection(disjointState), true);
  assert.equal(toggleCommentAtVisualIndent(disjointView), true);
  assert.equal(disjointState.doc.toString(), disjointSource);

  const unsupported = EditorState.create({ doc: 'text', selection: { anchor: 0, head: 4 } });
  const unsupportedView = { state: unsupported, dispatch() { assert.fail('unsupported syntax must not dispatch'); } };
  assert.equal(canUncommentToggleSelection(unsupported), false);
  assert.equal(toggleCommentAtVisualIndent(unsupportedView), false,
    'the fallback remains a no-op when the syntax defines neither comment style');
});

test('generic Comment Out prefers inline comments and falls back to block-only syntax', () => {
  const javascriptState = EditorState.create({
    doc: 'const value = 1;',
    selection: { anchor: 0, head: 'const value = 1;'.length },
    extensions: [history(), javascript()]
  });
  let state = javascriptState;
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  assert.equal(commentOutSelection(view), true);
  assert.equal(state.doc.toString(), '// const value = 1;',
    'the generic action chooses inline comments when the syntax offers both styles');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), 'const value = 1;');
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '// const value = 1;');

  const blockOnly = EditorState.languageData.of(() => [{
    commentTokens: { block: { open: '<!--', close: '-->' } }
  }]);
  const blockText = 'alpha\nbeta';
  state = EditorState.create({
    doc: blockText,
    selection: { anchor: 0, head: blockText.length },
    extensions: [history(), blockOnly]
  });
  assert.equal(commentOutSelection(view), true);
  assert.equal(state.doc.toString(), '<!-- alpha\nbeta -->',
    'block-only syntaxes receive the fallback wrapper around the selected text');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), blockText);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '<!-- alpha\nbeta -->');

  state = EditorState.create({ doc: 'plain', selection: { anchor: 0, head: 5 }, extensions: [history()] });
  assert.equal(commentOutSelection(view), false,
    'unsupported syntax does not make a speculative document edit');
  assert.equal(state.doc.toString(), 'plain');
});

test('comment spacer preference covers toggle, explicit line/block comments and uncommenting', () => {
  let state = EditorState.create({
    doc: '  alpha',
    selection: { anchor: 0, head: 7 },
    extensions: [history(), javascript()]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(toggleCommentAtVisualIndent(view, 4, false), true);
  assert.equal(state.doc.toString(), '  //alpha', 'Toggle Comment omits the configured spacer');
  assert.equal(toggleCommentAtVisualIndent(view, 4, false), true);
  assert.equal(state.doc.toString(), '  alpha', 'toggle removes only the delimiter when spacer insertion is disabled');

  state = EditorState.create({ doc: 'alpha', selection: { anchor: 0, head: 5 }, extensions: [history(), javascript()] });
  assert.equal(commentOutSelection(view, false), true);
  assert.equal(state.doc.toString(), '//alpha');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), 'alpha');
  assert.equal(lineCommentSelection(view, false), true);
  assert.equal(state.doc.toString(), '//alpha');
  assert.equal(uncommentSelection(view, false), true);
  assert.equal(state.doc.toString(), 'alpha');

  state = EditorState.create({ doc: 'alpha', selection: { anchor: 0, head: 5 }, extensions: [history(), javascript()] });
  assert.equal(blockCommentSelection(view, false), true);
  assert.equal(state.doc.toString(), '/*alpha*/');
  assert.equal(uncommentSelection(view, false), true);
  assert.equal(state.doc.toString(), 'alpha');

  state = EditorState.create({ doc: '', selection: { anchor: 0 }, extensions: [history(), javascript()] });
  assert.equal(blockCommentSelection(view, false), true);
  assert.equal(state.doc.toString(), '/**/', 'empty block comments omit both spacer characters');

  state = EditorState.create({ doc: '// alpha', selection: { anchor: 0, head: 8 }, extensions: [history(), javascript()] });
  assert.equal(uncommentSelection(view, false), true);
  assert.equal(state.doc.toString(), ' alpha', 'disabling spacer insertion preserves existing comment whitespace on uncomment');

  state = EditorState.create({ doc: '/* alpha */', selection: { anchor: 0, head: 11 }, extensions: [history(), javascript()] });
  assert.equal(uncommentSelection(view, false), true);
  assert.equal(state.doc.toString(), ' alpha ', 'block uncomment likewise preserves the existing spacer characters');
});

test('explicit Uncomment expands empty carets to unique current lines for block wrappers', () => {
  const source = '  /* alpha */  \n/* beta */';
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.create([7, 11, source.indexOf('beta') + 1].map(position => EditorSelection.cursor(position))),
    extensions: [history(), javascript(), EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(uncommentSelection(view), true);
  assert.equal(state.doc.toString(), '  alpha  \nbeta');
  assert.equal(state.selection.ranges.length, 3, 'all caret positions are mapped through the edit after duplicate line targets are collapsed');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '  alpha  \nbeta');
});

test('explicit Uncomment probes block wrappers across mixed empty and non-empty selections', () => {
  const source = '/* alpha */\n/* beta */\nplain';
  const betaStart = source.indexOf('/* beta */');
  const plainStart = source.indexOf('plain');
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.create([
      EditorSelection.cursor(source.indexOf('alpha') + 2),
      EditorSelection.range(betaStart, betaStart + '/* beta */'.length),
      EditorSelection.range(plainStart, plainStart + 'plain'.length)
    ]),
    extensions: [history(), javascript(), EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(uncommentSelection(view), true);
  assert.equal(state.doc.toString(), 'alpha\nbeta\nplain');
  assert.equal(state.selection.ranges.length, 3, 'all original selection ranges survive mapped edits');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'alpha\nbeta\nplain');
});

test('explicit Uncomment tries custom block-comment variants in declared order', () => {
  const source = '<!-- alpha -->\n<% beta %>\nplain';
  const doc = EditorState.create({ doc: source }).doc;
  const selection = EditorSelection.create([
    EditorSelection.cursor(doc.line(1).from + 5),
    EditorSelection.range(doc.line(2).from, doc.line(2).to),
    EditorSelection.range(doc.line(3).from, doc.line(3).to)
  ]);
  const syntax = createCotSyntaxMode({
    name: 'Multiple block comments',
    comments: {
      inline: [],
      blocks: [
        { begin: '/*', end: '*/' },
        { begin: '<!--', end: '-->' },
        { begin: '<%', end: '%>' }
      ]
    },
    strings: [],
    characters: [],
    rules: []
  });
  let state = EditorState.create({
    doc: source,
    selection,
    extensions: [history(), syntax, EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.deepEqual(state.languageDataAt('coteditCommentTokens', 0)[0].blocks, [
    { open: '/*', close: '*/' },
    { open: '<!--', close: '-->' },
    { open: '<%', close: '%>' }
  ]);
  assert.equal(uncommentSelection(view), true);
  assert.equal(state.doc.toString(), 'alpha\n<% beta %>\nplain',
    'the first matching pair in syntax declaration order is removed, including the empty-caret line target');
  assert.equal(state.selection.ranges.length, 3, 'all original selection ranges remain mapped');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'alpha\n<% beta %>\nplain');
});

test('Toggle Comment and explicit Uncomment recognize ordered custom inline-comment variants', () => {
  const syntax = createCotSyntaxMode({
    name: 'Multiple inline comments',
    comments: { inline: [{ begin: '//' }, { begin: '--' }], blocks: [] },
    strings: [],
    characters: [],
    rules: []
  });
  const toggleSource = '-- alpha';
  let state = EditorState.create({
    doc: toggleSource,
    selection: { anchor: 0, head: toggleSource.length },
    extensions: [history(), syntax]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.deepEqual(state.languageDataAt('coteditCommentTokens', 0)[0].inlines, ['//', '--']);
  assert.equal(canUncommentToggleSelection(state), true,
    'the menu preview finds a later declared line delimiter when the preferred delimiter is absent');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), 'alpha');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), toggleSource);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'alpha');

  const uncommentSource = '-- beta';
  state = EditorState.create({
    doc: uncommentSource,
    selection: EditorSelection.cursor(4),
    extensions: [history(), syntax]
  });
  assert.equal(uncommentSelection(view), true,
    'explicit Uncomment probes declared inline variants after CodeMirror’s primary token misses');
  assert.equal(state.doc.toString(), 'beta');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), uncommentSource);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), 'beta');
});

test('Toggle Comment keeps the first matching inline variant authoritative for partial selections', () => {
  const source = '// first\n-- second';
  const syntax = createCotSyntaxMode({
    name: 'Ordered inline comments',
    comments: { inline: [{ begin: '//' }, { begin: '--' }], blocks: [] },
    strings: [],
    characters: [],
    rules: []
  });
  const doc = EditorState.create({ doc: source }).doc;
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.create([1, 2].map(number => {
      const line = doc.line(number);
      return EditorSelection.range(line.from, line.to);
    })),
    extensions: [history(), syntax, EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };

  assert.equal(canUncommentToggleSelection(state), false,
    'a partial match for the first declared token stops the preview before a later token');
  assert.equal(toggleCommentAtVisualIndent(view), true);
  assert.equal(state.doc.toString(), '// // first\n// -- second');
  assert.equal(undo(view), true);
  assert.equal(state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(state.doc.toString(), '// // first\n// -- second');
});

test('explicit Uncomment preserves mixed-selection line-comment fallback when no block wrapper matches', () => {
  const source = '// first\n// second';
  const secondStart = source.indexOf('// second');
  let state = EditorState.create({
    doc: source,
    selection: EditorSelection.create([
      EditorSelection.cursor(source.indexOf('first') + 1),
      EditorSelection.range(secondStart, source.length)
    ]),
    extensions: [history(), javascript(), EditorState.allowMultipleSelections.of(true)]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  assert.equal(uncommentSelection(view), true);
  assert.equal(state.doc.toString(), 'first\nsecond');
});

test('explicit Uncomment at an empty caret still falls back to a line-comment token', () => {
  const source = '  // first\nplain';
  const result = applyCommand(uncommentSelection, source, { anchor: 6 }, [history(), javascript()]);
  assert.equal(result.changed, true);
  assert.equal(result.text, '  first\nplain');
});
