import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { applyShortcutOverrides, findShortcutConflict, formatShortcut, isShortcutCompositionEvent, matchesShortcut, MAX_PRINTABLE_SHORTCUT_KEY_SCALARS, normalizeShortcutKey, removeDefaultShortcutOverrides, resolveShortcut, shortcutFromEvent, shortcutKeyFromEvent } from '../lib/shortcuts.js';
import { normalizeKeyBindings } from '../lib/settings.js';
const require = createRequire(import.meta.url);
const shortcuts = require('../lib/shortcuts.json');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('shortcut registry has unique ids and only CotEditor’s intentional shared ⌘L accelerator', () => {
  assert.equal(new Set(shortcuts.map(item => item.id)).size, shortcuts.length);
  assert.ok(shortcuts.every(item => item.group && item.label && typeof item.key === 'string'));
  assert.ok(shortcuts.filter(item => item.id !== 'openOutlineMenu').every(item => item.accelerator));
  assert.equal(shortcuts.find(item => item.id === 'openOutlineMenu').key, '');
  assert.equal(shortcuts.find(item => item.id === 'openOutlineMenu').accelerator, undefined);
  for (const id of ['newTab', 'newWindow', 'print', 'goToLine', 'surroundCustom', 'findAll', 'jumpToSelection', 'folderBrowser', 'folderFind', 'selectPreviousOutlineItem', 'selectNextOutlineItem', 'openOutlineMenu', 'toggleSidebar', 'toggleTabBar', 'toggleToolbar', 'insertYenMark', 'selectLine', 'selectWord', 'copyAsRichText', 'useSelectionForFind', 'useSelectionForReplace', 'toggleComment', 'duplicateLine', 'deleteLine', 'moveLineUp', 'moveLineDown', 'joinCurrentLines', 'splitSelectionLines', 'selectColumnUp', 'selectColumnDown', 'indentMore', 'indentLess', 'complete', 'fontUp', 'fontDown', 'fontReset', 'resetSyntax']) {
    assert.ok(shortcuts.some(item => item.id === id), `missing documented editing shortcut: ${id}`);
  }
  for (const platform of ['darwin', 'win32', 'linux']) {
    const accelerators = shortcuts.map(item => platform === 'darwin' ? (item.acceleratorMac || item.accelerator) : item.accelerator);
    const groups = new Map();
    for (const [index, accelerator] of accelerators.entries()) if (accelerator) groups.set(accelerator, [...(groups.get(accelerator) || []), shortcuts[index].id]);
    const collisions = [...groups.values()].filter(group => group.length > 1).map(group => group.sort());
    assert.deepEqual(collisions, [['goToLine', 'surroundCustom']], `${platform} accelerator collision`);
    assert.equal(accelerators[shortcuts.findIndex(item => item.id === 'goToLine')], accelerators[shortcuts.findIndex(item => item.id === 'surroundCustom')]);
  }
});

test('Open Outline Menu is customizable without an invented default shortcut', () => {
  const base = shortcuts.find(item => item.id === 'openOutlineMenu');
  assert.equal(formatShortcut(base, 'darwin'), '');
  const binding = normalizeKeyBindings({ openOutlineMenu: { key: 'x', mod: true } }).openOutlineMenu;
  assert.deepEqual(binding, { key: 'x', mod: true, ctrl: false, alt: false, shift: false });
  const customized = applyShortcutOverrides(shortcuts, { openOutlineMenu: binding }).find(item => item.id === 'openOutlineMenu');
  assert.equal(formatShortcut(customized, 'darwin'), '⌘X');
  assert.equal(matchesShortcut({ key: 'x', code: 'KeyX', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }, customized, 'darwin'), true);
  assert.equal(findShortcutConflict(customized, shortcuts, 'darwin'), null);
  assert.match(renderer, /openOutlineMenu: openOutlineNavigationMenu/);
});

test('platform labels distinguish macOS Command/Option from Control/Alt', () => {
  const save = shortcuts.find(item => item.id === 'save');
  const complete = shortcuts.find(item => item.id === 'complete');
  assert.equal(formatShortcut(save, 'darwin'), '⌘S');
  assert.equal(formatShortcut(save, 'win32'), 'Ctrl + S');
  assert.equal(formatShortcut(complete, 'darwin'), '⌥Escape');
  assert.equal(formatShortcut(complete, 'linux'), 'Alt + Escape');
  const selectWord = shortcuts.find(item => item.id === 'selectWord');
  const copyAsRichText = shortcuts.find(item => item.id === 'copyAsRichText');
  const duplicateLine = shortcuts.find(item => item.id === 'duplicateLine');
  assert.equal(formatShortcut(selectWord, 'darwin'), '⌘D');
  assert.equal(formatShortcut(copyAsRichText, 'darwin'), '⇧⌘C');
  assert.equal(formatShortcut(copyAsRichText, 'linux'), 'Ctrl + Shift + C');
  assert.equal(formatShortcut(duplicateLine, 'darwin'), '⇧⌘D');
  assert.equal(formatShortcut(duplicateLine, 'linux'), 'Alt + Shift + ↓');
  const fontUp = shortcuts.find(item => item.id === 'fontUp');
  assert.equal(fontUp.accelerator, 'CmdOrCtrl+Plus');
  assert.equal(formatShortcut(fontUp, 'darwin'), '⇧⌘=');
  const split = shortcuts.find(item => item.id === 'splitSelectionLines');
  assert.equal(formatShortcut(split, 'darwin'), '⌃L');
  assert.equal(formatShortcut(split, 'linux'), 'Alt + Shift + L');
  assert.equal(formatShortcut(shortcuts.find(item => item.id === 'folderBrowser'), 'darwin'), '⌃⌘1');
  assert.equal(formatShortcut(shortcuts.find(item => item.id === 'folderFind'), 'darwin'), '⌃⌘2');
  assert.equal(formatShortcut(shortcuts.find(item => item.id === 'jumpToSelection'), 'darwin'), '⌘J');
  assert.equal(formatShortcut(shortcuts.find(item => item.id === 'joinCurrentLines'), 'darwin'), '⇧⌘J');
});

test('exact paste uses the CotEditor Option/Command shortcut and platform labels', () => {
  const paste = shortcuts.find(item => item.id === 'pasteExactly');
  assert.ok(paste);
  assert.equal(formatShortcut(paste, 'darwin'), '⌥⌘V');
  assert.equal(formatShortcut(paste, 'win32'), 'Ctrl + Alt + V');
  assert.equal(matchesShortcut({ key: 'v', code: 'KeyV', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, paste, 'linux'), true);
  assert.equal(matchesShortcut({ key: 'v', code: 'KeyV', ctrlKey: false, metaKey: true, altKey: true, shiftKey: false }, paste, 'darwin'), true);
});

test('shortcut matching handles platform modifiers and physical punctuation keys', () => {
  const save = shortcuts.find(item => item.id === 'save');
  assert.equal(matchesShortcut({ key: 's', code: 'KeyS', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, save, 'linux'), true);
  assert.equal(matchesShortcut({ key: 's', code: 'KeyS', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }, save, 'darwin'), true);
  assert.equal(matchesShortcut({ key: 's', code: 'KeyS', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, save, 'darwin'), false);
  const indent = shortcuts.find(item => item.id === 'indentMore');
  assert.equal(matchesShortcut({ key: '}', code: 'BracketRight', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, indent, 'linux'), true);
  const column = shortcuts.find(item => item.id === 'selectColumnDown');
  assert.equal(matchesShortcut({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, column, 'linux'), true);
  const split = shortcuts.find(item => item.id === 'splitSelectionLines');
  assert.equal(matchesShortcut({ key: 'l', code: 'KeyL', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, split, 'darwin'), true);
  assert.equal(matchesShortcut({ key: 'l', code: 'KeyL', ctrlKey: false, metaKey: false, altKey: true, shiftKey: true }, split, 'linux'), true);
  assert.equal(matchesShortcut({ key: 'l', code: 'KeyL', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, split, 'linux'), false);
  const selectWord = shortcuts.find(item => item.id === 'selectWord');
  const duplicateLine = shortcuts.find(item => item.id === 'duplicateLine');
  const fontUp = shortcuts.find(item => item.id === 'fontUp');
  assert.equal(matchesShortcut({ key: 'd', code: 'KeyD', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }, selectWord, 'darwin'), true);
  assert.equal(matchesShortcut({ key: 'D', code: 'KeyD', ctrlKey: false, metaKey: true, altKey: false, shiftKey: true }, duplicateLine, 'darwin'), true);
  assert.equal(matchesShortcut({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: false, metaKey: false, altKey: true, shiftKey: true }, duplicateLine, 'linux'), true);
  assert.equal(matchesShortcut({ key: '+', code: 'Equal', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, fontUp, 'linux'), true);
  const resetSyntax = shortcuts.find(item => item.id === 'resetSyntax');
  assert.equal(matchesShortcut({ key: 'r', code: 'KeyR', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, resetSyntax, 'linux'), true);
});

test('CotEditor shared Command/Control+L routes by editor focus and selection', () => {
  const event = { key: 'l', code: 'KeyL', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
  const macEvent = { ...event, ctrlKey: false, metaKey: true };
  assert.equal(resolveShortcut(event, shortcuts, 'linux', { editorFocused: true, hasSelection: true }).id, 'surroundCustom');
  assert.equal(resolveShortcut(event, shortcuts, 'linux', { editorFocused: true, hasSelection: false }).id, 'goToLine');
  assert.equal(resolveShortcut(event, shortcuts, 'linux', { editorFocused: false, hasSelection: true }).id, 'goToLine');
  assert.equal(resolveShortcut(macEvent, shortcuts, 'darwin', { editorFocused: true, hasSelection: true }).id, 'surroundCustom');
  assert.equal(formatShortcut(shortcuts.find(item => item.id === 'surroundCustom'), 'darwin'), '⌘L');
});

test('Find All and folder search use distinct non-macOS accelerators', () => {
  const findAll = shortcuts.find(item => item.id === 'findAll');
  const folderSearch = shortcuts.find(item => item.id === 'searchFolder');
  assert.equal(matchesShortcut({ key: 'f', code: 'KeyF', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, findAll, 'linux'), true);
  assert.equal(matchesShortcut({ key: 'f', code: 'KeyF', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, folderSearch, 'linux'), true);
  assert.equal(matchesShortcut({ key: 'f', code: 'KeyF', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, folderSearch, 'linux'), false);
});

test('Highlight All and Remove Highlights use platform-specific CotEditor keys', () => {
  const highlight = shortcuts.find(item => item.id === 'highlightAll');
  const remove = shortcuts.find(item => item.id === 'removeHighlights');
  assert.equal(formatShortcut(highlight, 'darwin'), '⇧⌘H');
  assert.equal(formatShortcut(remove, 'darwin'), '⌃⇧⌘H');
  assert.equal(formatShortcut(remove, 'linux'), 'Ctrl + Alt + Shift + H');
});

test('custom key bindings display and dispatch consistently across supported platforms', () => {
  const custom = { key: 'x', mod: true, ctrl: false, alt: true, shift: false };
  const configured = applyShortcutOverrides(shortcuts, { save: custom });
  const save = configured.find(item => item.id === 'save');
  assert.equal(formatShortcut(save, 'linux'), 'Ctrl + Alt + X');
  assert.equal(formatShortcut(save, 'darwin'), '⌥⌘X');
  assert.equal(matchesShortcut({ key: 'x', code: 'KeyX', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, save, 'linux'), true);
  assert.equal(matchesShortcut({ key: 'x', code: 'KeyX', ctrlKey: false, metaKey: true, altKey: true, shiftKey: false }, save, 'darwin'), true);
  assert.equal(resolveShortcut({ key: 'x', code: 'KeyX', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, configured, 'linux').id, 'save');
});

test('shortcut capture normalizes physical keys and rejects unmodified typing', () => {
  assert.deepEqual(shortcutFromEvent({ key: 'X', code: 'KeyX', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, 'linux'), {
    key: 'x', mod: true, ctrl: false, alt: true, shift: false
  });
  assert.deepEqual(shortcutFromEvent({ key: 'F2', code: 'F2', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, 'linux'), {
    key: 'f2', mod: false, ctrl: false, alt: false, shift: false
  });
  assert.equal(shortcutFromEvent({ key: 'a', code: 'KeyA', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, 'linux'), null);
  assert.equal(shortcutFromEvent({ key: '+', code: 'Equal', ctrlKey: false, metaKey: true, altKey: false, shiftKey: true }, 'darwin').key, '=');
});

test('shortcut capture accepts printable multi-character key outputs and ignores composition/control keys', () => {
  const event = { key: 'SS', code: 'KeyS', ctrlKey: true, metaKey: false, altKey: true, shiftKey: true };
  assert.deepEqual(shortcutFromEvent(event, 'linux'), { key: 'SS', mod: true, ctrl: false, alt: true, shift: true });
  const custom = { id: 'save', key: 'SS', mod: true, ctrl: false, alt: true, shift: true };
  assert.equal(matchesShortcut(event, custom, 'linux'), true);
  assert.equal(matchesShortcut(event, { ...custom, key: 'ss' }, 'linux'), false);
  const lowercaseEvent = { ...event, key: 'ss', shiftKey: false };
  assert.equal(matchesShortcut(lowercaseEvent, { ...custom, key: 'ss', shift: false }, 'linux'), true);
  assert.equal(findShortcutConflict({ ...custom, id: 'other', key: 'ss' }, [custom], 'linux'), null);
  assert.equal(findShortcutConflict({ ...custom, id: 'other' }, [custom], 'linux')?.id, 'save');
  assert.equal(formatShortcut(custom, 'linux'), 'Ctrl + Alt + Shift + SS');
  assert.equal(shortcutKeyFromEvent({ key: 'Shift', code: 'ShiftLeft' }), null);
  assert.equal(shortcutKeyFromEvent({ key: 'Process', code: 'KeyA' }), null);
  assert.equal(normalizeShortcutKey('Aß'), 'Aß');
  assert.equal(normalizeShortcutKey('A\u0308B'), 'ÄB');
  assert.equal(normalizeShortcutKey('bad key'), '');
  assert.equal(normalizeShortcutKey('x'.repeat(17)), 'x'.repeat(17));
  assert.equal(normalizeShortcutKey('x'.repeat(MAX_PRINTABLE_SHORTCUT_KEY_SCALARS)), 'x'.repeat(MAX_PRINTABLE_SHORTCUT_KEY_SCALARS));
  assert.equal(normalizeShortcutKey('x'.repeat(MAX_PRINTABLE_SHORTCUT_KEY_SCALARS + 1)), '');
});

test('multi-character shortcut output uses a shared total Unicode-scalar budget across capture, matching, and settings', () => {
  const key = '😀'.repeat(MAX_PRINTABLE_SHORTCUT_KEY_SCALARS);
  const event = { key, code: 'KeyS', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
  const binding = { id: 'save', key, mod: true, ctrl: false, alt: false, shift: false };
  assert.equal(Array.from(key).length, MAX_PRINTABLE_SHORTCUT_KEY_SCALARS);
  assert.equal(key.length, MAX_PRINTABLE_SHORTCUT_KEY_SCALARS * 2, 'supplementary characters occupy two UTF-16 code units each');
  assert.equal(normalizeShortcutKey(key), key);
  assert.equal(normalizeShortcutKey('😀'.repeat(MAX_PRINTABLE_SHORTCUT_KEY_SCALARS + 1)), '');
  assert.equal(shortcutKeyFromEvent(event), key);
  assert.deepEqual(shortcutFromEvent(event, 'linux'), { key, mod: true, ctrl: false, alt: false, shift: false });
  assert.equal(matchesShortcut(event, binding, 'linux'), true);
  assert.equal(normalizeKeyBindings({ save: { key, mod: true } }).save.key, key);
  assert.equal(normalizeKeyBindings({ save: { key, mod: true }, find: { key: 'x', mod: true } }).find, undefined,
    'settings preserve earlier valid bindings but do not exceed the aggregate scalar budget');
});

test('single non-ASCII printable key outputs are captured and matched instead of falling back to the physical code', () => {
  const event = { key: 'ß', code: 'Minus', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
  const binding = { key: 'ß', mod: true, ctrl: false, alt: false, shift: false };
  assert.equal(normalizeShortcutKey('ẞ'), 'ß');
  assert.equal(shortcutKeyFromEvent(event), 'ß');
  assert.deepEqual(shortcutFromEvent(event, 'linux'), binding);
  assert.equal(matchesShortcut(event, { id: 'save', ...binding }, 'linux'), true);
  assert.equal(resolveShortcut(event, [{ id: 'save', ...binding }], 'linux')?.id, 'save');
  const persisted = normalizeKeyBindings({ save: { key: 'ẞ', mod: true } }).save;
  assert.equal(persisted.key, 'ß');
  assert.equal(formatShortcut(persisted, 'linux'), 'Ctrl + SS', 'CotEditor uppercases the displayed key even when Unicode casing expands');
  assert.equal(formatShortcut(persisted, 'darwin'), '⌘SS');

  const dottedI = { ...event, key: 'İ', code: 'KeyI' };
  assert.equal(shortcutKeyFromEvent(dottedI), normalizeShortcutKey('İ'));
});

test('single-press emoji ZWJ key outputs remain usable without allowing orphan joiners or bidi controls', () => {
  const emoji = '👩🏽‍💻';
  const event = { key: emoji, code: 'KeyK', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false };
  const binding = { id: 'emojiShortcut', key: emoji, mod: true, ctrl: false, alt: true, shift: false };

  assert.equal(normalizeShortcutKey(emoji), emoji);
  assert.equal(shortcutKeyFromEvent(event), emoji, 'the produced text wins over the physical fallback key');
  assert.deepEqual(shortcutFromEvent(event, 'linux'), { key: emoji, mod: true, ctrl: false, alt: true, shift: false });
  assert.equal(matchesShortcut(event, binding, 'linux'), true);
  assert.equal(formatShortcut(binding, 'linux'), `Ctrl + Alt + ${emoji}`);
  assert.equal(findShortcutConflict({ ...binding, id: 'duplicate' }, [binding], 'linux')?.id, 'emojiShortcut');
  assert.equal(normalizeKeyBindings({ emojiShortcut: { key: emoji, mod: true, alt: true } }).emojiShortcut.key, emoji);

  for (const invalid of ['👩‍', '‍👩', 'a‍b', '👩‍\u202e💻', '👩‍💻\u202e']) {
    assert.equal(normalizeShortcutKey(invalid), '', `reject unsafe or malformed sequence ${JSON.stringify(invalid)}`);
  }
});

test('IME composition events bypass shortcut matching, capture, and global handling', () => {
  const binding = { id: 'save', key: 'SS', mod: true, ctrl: false, alt: false, shift: false };
  const composing = { key: 'SS', code: 'KeyS', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, isComposing: true };
  assert.equal(isShortcutCompositionEvent(composing), true);
  assert.equal(shortcutKeyFromEvent(composing), null);
  assert.equal(shortcutFromEvent(composing, 'linux'), null);
  assert.equal(matchesShortcut(composing, binding, 'linux'), false);
  assert.equal(resolveShortcut(composing, [binding], 'linux'), null);

  const legacyComposing = { ...composing, isComposing: false, keyCode: 229 };
  assert.equal(isShortcutCompositionEvent(legacyComposing), true);
  assert.equal(shortcutKeyFromEvent(legacyComposing), null);
  assert.equal(shortcutFromEvent(legacyComposing, 'linux'), null);

  const ordinary = { ...composing, isComposing: false, keyCode: 83 };
  assert.equal(isShortcutCompositionEvent(ordinary), false);
  assert.equal(shortcutKeyFromEvent(ordinary), 'SS');
  assert.equal(matchesShortcut(ordinary, binding, 'linux'), true, 'the CotEditor 7.1.1 multi-character shortcut path remains active outside composition');

  const keydownStart = renderer.indexOf("document.addEventListener('keydown', async event => {");
  assert.notEqual(keydownStart, -1, 'the renderer global keydown handler exists');
  assert.match(renderer.slice(keydownStart, keydownStart + 180), /if \(isShortcutCompositionEvent\(event\)\) return;/, 'composition is left to the IME before capture, Escape handling, or shortcuts');
});

test('shortcut labels uppercase complete key strings, including expanding Unicode mappings, while conflicts remain case-sensitive', () => {
  const upper = { id: 'upper', key: 'SS', mod: true, ctrl: false, alt: false, shift: false };
  const lower = { id: 'lower', key: 'ss', mod: true, ctrl: false, alt: false, shift: false };
  assert.equal(formatShortcut(upper, 'linux'), 'Ctrl + SS');
  assert.equal(formatShortcut(lower, 'linux'), 'Ctrl + SS');
  assert.equal(formatShortcut(upper, 'darwin'), '⌘SS');
  assert.equal(formatShortcut(lower, 'darwin'), '⌘SS');
  assert.equal(formatShortcut({ key: 'aB', mod: true }, 'linux'), 'Ctrl + AB');
  assert.equal(formatShortcut({ key: 'aß', mod: true }, 'linux'), 'Ctrl + ASS');
  assert.equal(formatShortcut({ key: 'ß', mod: true }, 'linux'), 'Ctrl + SS');
  assert.equal(formatShortcut({ key: 'ﬃ', mod: true }, 'linux'), 'Ctrl + FFI', 'the complete key-equivalent label uses Unicode uppercase mapping');
  assert.equal(findShortcutConflict(lower, [upper], 'linux'), null);
  assert.equal(findShortcutConflict({ ...lower, id: 'duplicate' }, [lower], 'linux')?.id, 'lower');
  assert.equal(formatShortcut({ key: 'x', mod: true }, 'linux'), 'Ctrl + X');
  assert.equal(formatShortcut({ key: 'escape', mod: true }, 'linux'), 'Ctrl + Escape');
  assert.equal(formatShortcut({ key: 'f12', mod: true }, 'linux'), 'Ctrl + F12');
});

test('Escape key descriptions use the full name across shortcut and quick-action UI', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((renderer.match(/按 Escape 键取消/g) || []).length, 2);
  assert.match(renderer, /Escape: 'Escape'/);
  assert.match(renderer, /Enter 执行 · Escape 关闭/);
  assert.match(html, /<kbd aria-hidden="true">Escape<\/kbd>/);
  assert.match(html, /Enter 执行 · Escape 关闭/);
  assert.doesNotMatch(renderer, /按 Esc 取消/);
  assert.doesNotMatch(html, />Esc<\/kbd>|· Esc 关闭/);
});

test('default-equivalent custom bindings are omitted without erasing cross-platform differences', () => {
  const compressed = removeDefaultShortcutOverrides(shortcuts, {
    save: { key: 'S', mod: true, ctrl: false, alt: false, shift: false },
    duplicateLine: { key: 'd', mod: true, ctrl: false, alt: false, shift: true },
    highlightAll: { key: 'x', mod: true, ctrl: false, alt: false, shift: true }
  });
  assert.deepEqual(compressed, {
    duplicateLine: { key: 'd', mod: true, ctrl: false, alt: false, shift: true },
    highlightAll: { key: 'x', mod: true, ctrl: false, alt: false, shift: true }
  });
});

test('custom shortcut conflicts are rejected except CotEditor’s intentional ⌘L pair', () => {
  const defaults = applyShortcutOverrides(shortcuts);
  const duplicate = { id: 'save', key: 'o', mod: true, ctrl: false, alt: false, shift: false };
  assert.equal(findShortcutConflict(duplicate, defaults, 'linux')?.id, 'open');
  const goToLine = defaults.find(item => item.id === 'goToLine');
  assert.equal(findShortcutConflict(goToLine, defaults, 'darwin'), null);
});

test('Insert Backslash matches CotEditor 7.1.1 Command-Yen on macOS and a distinct platform fallback', () => {
  const backslash = shortcuts.find(item => item.id === 'insertBackslash');
  assert.ok(backslash);
  assert.equal(formatShortcut(backslash, 'darwin'), '⌘¥');
  assert.equal(formatShortcut(backslash, 'linux'), 'Ctrl + Alt + Y');
  assert.equal(backslash.acceleratorMac, 'Cmd+¥');
  assert.equal(backslash.accelerator, 'CmdOrCtrl+Alt+Y');

  const macEvent = { key: '¥', code: 'Backslash', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false };
  const linuxEvent = { key: 'y', code: 'KeyY', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false };
  assert.equal(matchesShortcut(macEvent, backslash, 'darwin'), true);
  assert.equal(resolveShortcut(macEvent, shortcuts, 'darwin')?.id, 'insertBackslash');
  assert.equal(matchesShortcut(linuxEvent, backslash, 'linux'), true);
  assert.equal(resolveShortcut(linuxEvent, shortcuts, 'linux')?.id, 'insertBackslash');
  assert.equal(findShortcutConflict(backslash, shortcuts, 'darwin'), null);
  assert.equal(findShortcutConflict(backslash, shortcuts, 'linux'), null);
});
