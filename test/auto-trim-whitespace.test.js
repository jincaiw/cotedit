import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, StateEffect, Transaction } from '@codemirror/state';
import { history, redo, undo } from '@codemirror/commands';
import { readFileSync } from 'node:fs';
import { automaticTrailingWhitespaceExtension } from '../lib/auto-trim-trailing-whitespace.js';
import { parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js';
import { trailingWhitespaceChanges } from '../lib/text-tools.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function stateWithPreferences(text, preferences, extensions = []) {
  return EditorState.create({
    doc: text,
    extensions: [...extensions, automaticTrailingWhitespaceExtension(() => preferences)]
  });
}

test('automatic trailing-whitespace preferences match CotEditor defaults and round-trip in settings files', () => {
  assert.equal(DEFAULT_SETTINGS.autoTrimsTrailingWhitespace, false);
  assert.equal(DEFAULT_SETTINGS.trimsWhitespaceOnlyLines, false);
  assert.equal(normalizeSettings({}).autoTrimsTrailingWhitespace, false);
  assert.equal(normalizeSettings({}).trimsWhitespaceOnlyLines, false);
  assert.deepEqual(normalizeSettings({ autoTrimsTrailingWhitespace: true, trimsWhitespaceOnlyLines: true }), {
    ...DEFAULT_SETTINGS,
    autoTrimsTrailingWhitespace: true,
    trimsWhitespaceOnlyLines: true
  });
  assert.equal(normalizeSettings({ autoTrimsTrailingWhitespace: 'yes' }).autoTrimsTrailingWhitespace, false);
  assert.equal(normalizeSettings({ trimsWhitespaceOnlyLines: 'yes' }).trimsWhitespaceOnlyLines, false);
  const exported = serializeSettingsFile({ autoTrimsTrailingWhitespace: true, trimsWhitespaceOnlyLines: true });
  assert.deepEqual(parseSettingsFile(exported), {
    ...DEFAULT_SETTINGS,
    autoTrimsTrailingWhitespace: true,
    trimsWhitespaceOnlyLines: true
  });
});

test('automatic trimming edits only touched lines and leaves untouched trailing whitespace alone', () => {
  const preferences = { autoTrimsTrailingWhitespace: true, trimsWhitespaceOnlyLines: false };
  let state = stateWithPreferences('keep  \nedit \t\nblank  ', preferences);
  const targetLine = state.doc.line(2);
  const at = targetLine.from + 4;
  const transaction = state.update({
    changes: { from: at, insert: 'X' },
    selection: { anchor: at + 1 },
    userEvent: 'input.type'
  });
  state = transaction.state;
  assert.equal(state.doc.toString(), 'keep  \neditX\nblank  ');
  assert.equal(state.selection.main.head, at + 1);
  assert.equal(transaction.annotation(Transaction.userEvent), 'input.type');
});

test('editing at the start of a line does not trim an untouched preceding line', () => {
  const preferences = { autoTrimsTrailingWhitespace: true, trimsWhitespaceOnlyLines: false };
  const state = stateWithPreferences('prev  \nnext  ', preferences);
  const at = state.doc.line(2).from;
  const updated = state.update({ changes: { from: at, insert: 'x' }, userEvent: 'input.type' });
  assert.equal(updated.state.doc.toString(), 'prev  \nxnext');
});

test('automatic cleanup drops a state effect when its mapping deletes that effect', () => {
  const preferences = { autoTrimsTrailingWhitespace: true, trimsWhitespaceOnlyLines: false };
  const state = stateWithPreferences('code  ', preferences);
  const removableEffect = StateEffect.define({ map: () => undefined });
  const transaction = state.update({
    changes: { from: 4, insert: 'X' },
    effects: removableEffect.of('mapped away'),
    userEvent: 'input.type'
  });
  assert.equal(transaction.state.doc.toString(), 'codeX');
  assert.equal(transaction.effects.length, 0);
});

test('whitespace-only lines are retained by default and trimmed only when explicitly enabled', () => {
  const run = includeWhitespaceOnlyLines => {
    const initial = stateWithPreferences('   ', {
      autoTrimsTrailingWhitespace: true,
      trimsWhitespaceOnlyLines: includeWhitespaceOnlyLines
    });
    const at = initial.doc.length;
    return initial.update({ changes: { from: at, insert: ' ' }, selection: { anchor: at + 1 }, userEvent: 'input.type' });
  };
  assert.equal(run(false).state.doc.toString(), '    ');
  assert.equal(run(true).state.doc.toString(), '');
});

test('automatic trimming is one undoable edit and does not interfere with undo/redo', () => {
  const preferences = { autoTrimsTrailingWhitespace: true, trimsWhitespaceOnlyLines: false };
  let state = stateWithPreferences('code  \nkeep', preferences, [history()]);
  const view = {
    get state() { return state; },
    dispatch(transaction) { state = state.update(transaction).state; }
  };
  view.dispatch({ changes: { from: 4, insert: 'X' }, selection: { anchor: 5 }, userEvent: 'input.type' });
  assert.equal(view.state.doc.toString(), 'codeX\nkeep');
  assert.equal(undo(view), true);
  assert.equal(view.state.doc.toString(), 'code  \nkeep', 'undo restores the pre-edit whitespace exactly');
  assert.equal(redo(view), true);
  assert.equal(view.state.doc.toString(), 'codeX\nkeep', 'redo restores the single combined edit');
});

test('manual trailing-whitespace changes can target edited line ranges without changing the whole-document default', () => {
  const state = EditorState.create({ doc: 'one  \ntwo \t\n   ' });
  assert.deepEqual(trailingWhitespaceChanges(state.doc, { lineRanges: [[2, 2]], includeWhitespaceOnlyLines: false }), [
    { from: 9, to: 11, insert: '' }
  ]);
  assert.deepEqual(trailingWhitespaceChanges(state.doc), [
    { from: 3, to: 5, insert: '' },
    { from: 9, to: 11, insert: '' },
    { from: 12, to: 15, insert: '' }
  ]);
});

test('editor settings expose accessible automatic cleanup controls and persist preference changes', () => {
  assert.ok(html.includes('id="auto-trim-whitespace-setting"'));
  assert.ok(html.includes('id="trim-whitespace-only-lines-setting"'));
  assert.ok(renderer.includes('automaticTrailingWhitespaceExtension(() => ({'));
  assert.ok(renderer.includes("settings.autoTrimsTrailingWhitespace = event.target.checked;"));
  assert.ok(renderer.includes("settings.trimsWhitespaceOnlyLines = event.target.checked;"));
  assert.ok(renderer.includes("$('#trim-whitespace-only-lines-setting').disabled = !settings.autoTrimsTrailingWhitespace"));
});
