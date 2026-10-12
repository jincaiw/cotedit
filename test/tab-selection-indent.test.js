import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EditorSelection, EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { history, redo, undo } from '@codemirror/commands';
import { handleSelectedLinesTab } from '../lib/tab-selection-indent.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function createView(text, selectedLineNumbers = []) {
  const initialDoc = EditorState.create({ doc: text }).doc;
  const selection = selectedLineNumbers.length
    ? EditorSelection.create(selectedLineNumbers.map(number => {
      const line = initialDoc.line(number);
      return EditorSelection.range(line.from, line.to);
    }))
    : EditorSelection.cursor(0);
  let state = EditorState.create({
    doc: text,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true), history(), javascript()]
  });
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  return view;
}

test('Tab on a selection keeps replacement behavior off; Shift-Tab on that selection is consumed without editing', () => {
  const view = createView('first\nsecond', [1]);
  assert.equal(handleSelectedLinesTab(view, false), false, 'Tab falls through to the existing selection-replacement handler');
  assert.equal(handleSelectedLinesTab(view, false, true), true, 'Shift-Tab does not outdent selected lines while the option is off');
  assert.equal(view.state.doc.toString(), 'first\nsecond');
});

test('Tab indents every selected line across disjoint ranges and undo/redo remains one editor transaction', () => {
  const source = 'const a = 1;\nconst b = 2;\nconst c = 3;';
  const expected = '  const a = 1;\nconst b = 2;\n  const c = 3;';
  const view = createView(source, [1, 3]);

  assert.equal(handleSelectedLinesTab(view, true), true);
  assert.equal(view.state.doc.toString(), expected);
  assert.equal(view.state.selection.ranges.length, 2);
  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), source);
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), expected);
});

test('Shift-Tab outdents all selected lines when the option is enabled', () => {
  const source = '  first\n    second\nthird';
  const expected = 'first\n  second\nthird';
  const view = createView(source, [1, 2]);

  assert.equal(handleSelectedLinesTab(view, true, true), true);
  assert.equal(view.state.doc.toString(), expected);
});

test('collapsed carets are left to the existing Tab and Shift-Tab commands', () => {
  const view = createView('first\nsecond');
  assert.equal(handleSelectedLinesTab(view, true), false);
  assert.equal(handleSelectedLinesTab(view, true, true), false);
  assert.equal(view.state.doc.toString(), 'first\nsecond');
});

test('the editor setting is visible, persisted, and connected to both Tab key paths', () => {
  assert.match(html, /<label class="setting-row" title="启用后，Tab 和 Shift-Tab 会缩进或减少选中行的缩进；关闭时 Tab 会替换选区。"><span>Tab 键缩进选中行<\/span><input type="checkbox" id="indent-with-tab-setting" \/><\/label>/);
  assert.match(renderer, /\$\('#indent-with-tab-setting'\)\.checked = settings\.indentWithTabKey/);
  assert.match(renderer, /\$\('#indent-with-tab-setting'\)\.addEventListener\('change', event => \{ settings\.indentWithTabKey = event\.target\.checked; persistSettings\(\); applySettings\(\); \}\)/);
  assert.match(renderer, /key: 'Shift-Tab', run: view => handleSelectedLinesTab\(view, settings\.indentWithTabKey, true\)/);
  assert.match(renderer, /if \(handleSelectedLinesTab\(view, settings\.indentWithTabKey\)\) return true/);
});
