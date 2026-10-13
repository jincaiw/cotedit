import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { findShortcutConflict, formatShortcut, matchesShortcut, resolveShortcut } from '../lib/shortcuts.js';

const require = createRequire(import.meta.url);
const shortcuts = require('../lib/shortcuts.json');
const get = id => shortcuts.find(item => item.id === id);

test('Jump to Selection and Join Lines use their distinct CotEditor chords', () => {
  const jump = get('jumpToSelection');
  const join = get('joinCurrentLines');
  const macJump = { key: 'j', code: 'KeyJ', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false };
  const macJoin = { ...macJump, shiftKey: true };
  assert.equal(matchesShortcut(macJump, jump, 'darwin'), true);
  assert.equal(matchesShortcut(macJoin, jump, 'darwin'), false);
  assert.equal(matchesShortcut(macJump, join, 'darwin'), false);
  assert.equal(matchesShortcut(macJoin, join, 'darwin'), true);
  assert.equal(resolveShortcut(macJump, shortcuts, 'darwin')?.id, 'jumpToSelection');
  assert.equal(resolveShortcut(macJoin, shortcuts, 'darwin')?.id, 'joinCurrentLines');

  const linuxJump = { ...macJump, ctrlKey: true, metaKey: false };
  const linuxJoin = { ...linuxJump, shiftKey: true };
  assert.equal(resolveShortcut(linuxJump, shortcuts, 'linux')?.id, 'jumpToSelection');
  assert.equal(resolveShortcut(linuxJoin, shortcuts, 'linux')?.id, 'joinCurrentLines');
});

test('split editor focus shortcuts match CotEditor macOS backquote equivalents and conflict-free platform mappings', () => {
  const macNext = { key: '`', code: 'Backquote', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false };
  const macPrevious = { ...macNext, altKey: true };
  const otherNext = { ...macNext, ctrlKey: true, metaKey: false };
  const otherPrevious = { ...otherNext, shiftKey: true };
  const next = get('focusNextEditor');
  const previous = get('focusPreviousEditor');
  assert.equal(next.acceleratorMac, 'Command+`');
  assert.equal(previous.acceleratorMac, 'Alt+Command+`');
  assert.equal(resolveShortcut(macNext, shortcuts, 'darwin')?.id, 'focusNextEditor');
  assert.equal(resolveShortcut(macPrevious, shortcuts, 'darwin')?.id, 'focusPreviousEditor');
  assert.equal(resolveShortcut(otherNext, shortcuts, 'linux')?.id, 'focusNextEditor');
  assert.equal(resolveShortcut(otherPrevious, shortcuts, 'linux')?.id, 'focusPreviousEditor');
  for (const platform of ['darwin', 'linux']) {
    assert.equal(findShortcutConflict(next, shortcuts, platform), null);
    assert.equal(findShortcutConflict(previous, shortcuts, platform), null);
  }
  assert.equal(get('toggleSplit'), undefined, 'Split Editor has no upstream static shortcut');
});

test('CotEditor Sidebar shortcuts match only Control-Command on macOS and Ctrl-Alt elsewhere', () => {
  const browser = get('folderBrowser');
  const folderFind = get('folderFind');
  assert.equal(matchesShortcut({ key: '1', code: 'Digit1', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false }, browser, 'darwin'), true);
  assert.equal(matchesShortcut({ key: '2', code: 'Digit2', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false }, folderFind, 'darwin'), true);
  assert.equal(matchesShortcut({ key: '1', code: 'Digit1', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, browser, 'linux'), true);
  assert.equal(matchesShortcut({ key: '2', code: 'Digit2', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }, folderFind, 'linux'), true);
});

test('Inspect Character uses CotEditor Option-Command-I and a distinct non-macOS mapping', () => {
  const inspect = get('inspectCharacter');
  assert.ok(inspect);
  assert.equal(inspect.accelerator, 'CmdOrCtrl+Alt+I');
  const macEvent = { key: 'i', code: 'KeyI', ctrlKey: false, metaKey: true, altKey: true, shiftKey: false };
  const otherEvent = { key: 'i', code: 'KeyI', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false };
  assert.equal(resolveShortcut(macEvent, shortcuts, 'darwin')?.id, 'inspectCharacter');
  assert.equal(resolveShortcut(otherEvent, shortcuts, 'linux')?.id, 'inspectCharacter');
  assert.equal(findShortcutConflict(inspect, shortcuts, 'darwin'), null);
  assert.equal(findShortcutConflict(inspect, shortcuts, 'linux'), null);
});

test('Move Line uses CotEditor Control-Command arrows on macOS and a conflict-free platform mapping elsewhere', () => {
  const up = get('moveLineUp');
  const down = get('moveLineDown');
  const macUp = { key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false };
  const macDown = { ...macUp, key: 'ArrowDown', code: 'ArrowDown' };
  const otherUp = { ...macUp, ctrlKey: true, metaKey: false, altKey: true };
  const otherDown = { ...otherUp, key: 'ArrowDown', code: 'ArrowDown' };
  assert.equal(up.acceleratorMac, 'Control+Command+Up');
  assert.equal(down.acceleratorMac, 'Control+Command+Down');
  assert.equal(resolveShortcut(macUp, shortcuts, 'darwin')?.id, 'moveLineUp');
  assert.equal(resolveShortcut(macDown, shortcuts, 'darwin')?.id, 'moveLineDown');
  assert.equal(resolveShortcut(otherUp, shortcuts, 'linux')?.id, 'moveLineUp');
  assert.equal(resolveShortcut(otherDown, shortcuts, 'linux')?.id, 'moveLineDown');
});

test('Insert Yen Mark follows CotEditor Command-Y and inserts through the shared action dispatcher', async () => {
  const yen = get('insertYenMark');
  assert.equal(yen.accelerator, 'CmdOrCtrl+Y');
  assert.equal(resolveShortcut({ key: 'y', code: 'KeyY', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }, shortcuts, 'darwin')?.id, 'insertYenMark');
  assert.equal(resolveShortcut({ key: 'y', code: 'KeyY', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, shortcuts, 'linux')?.id, 'insertYenMark');
  const renderer = (await import('node:fs')).readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const menu = (await import('node:fs')).readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(menu, /id: 'menu-insert-yen-mark',[^\n]*accelerator: accelerator\('insertYenMark'\)/);
  assert.match(renderer, /insertYenMark: \(\) => insertLiteralText\('¥'\)/);
});

test('View toolbar and sidebar shortcuts use CotEditor macOS defaults and platform-safe alternatives', () => {
  const tabBar = get('toggleTabBar');
  const toolbar = get('toggleToolbar');
  const sidebar = get('toggleSidebar');
  assert.equal(formatShortcut(tabBar, 'darwin'), '⇧⌘T');
  assert.equal(formatShortcut(toolbar, 'darwin'), '⌥⌘T');
  assert.equal(formatShortcut(sidebar, 'darwin'), '⌃⌘S');
  const mac = (key, ctrlKey = false, altKey = false, shiftKey = false) => ({ key, code: `Key${key.toUpperCase()}`, ctrlKey, metaKey: true, altKey, shiftKey });
  assert.equal(resolveShortcut(mac('t', false, false, true), shortcuts, 'darwin')?.id, 'toggleTabBar');
  assert.equal(resolveShortcut(mac('t', false, true), shortcuts, 'darwin')?.id, 'toggleToolbar');
  assert.equal(resolveShortcut(mac('s', true), shortcuts, 'darwin')?.id, 'toggleSidebar');
  const linux = (key, altKey = false, shiftKey = false) => ({ key, code: `Key${key.toUpperCase()}`, ctrlKey: true, metaKey: false, altKey, shiftKey });
  assert.equal(resolveShortcut(linux('t', false, true), shortcuts, 'linux')?.id, 'toggleTabBar');
  assert.equal(resolveShortcut(linux('t', true), shortcuts, 'linux')?.id, 'toggleToolbar');
  assert.equal(resolveShortcut(linux('s', true, true), shortcuts, 'linux')?.id, 'toggleSidebar');
});

test('Outline item navigation matches CotEditor Option-Command arrows without colliding with line movement', () => {
  const previous = get('selectPreviousOutlineItem');
  const next = get('selectNextOutlineItem');
  assert.equal(formatShortcut(previous, 'darwin'), '⌥⌘↑');
  assert.equal(formatShortcut(next, 'darwin'), '⌥⌘↓');
  const macUp = { key: 'ArrowUp', code: 'ArrowUp', ctrlKey: false, metaKey: true, altKey: true, shiftKey: false };
  const macDown = { ...macUp, key: 'ArrowDown', code: 'ArrowDown' };
  assert.equal(resolveShortcut(macUp, shortcuts, 'darwin')?.id, 'selectPreviousOutlineItem');
  assert.equal(resolveShortcut(macDown, shortcuts, 'darwin')?.id, 'selectNextOutlineItem');
  const linuxUp = { ...macUp, ctrlKey: true, metaKey: false, shiftKey: true };
  const linuxDown = { ...linuxUp, key: 'ArrowDown', code: 'ArrowDown' };
  assert.equal(resolveShortcut(linuxUp, shortcuts, 'linux')?.id, 'selectPreviousOutlineItem');
  assert.equal(resolveShortcut(linuxDown, shortcuts, 'linux')?.id, 'selectNextOutlineItem');
  assert.equal(findShortcutConflict(previous, shortcuts, 'darwin'), null);
  assert.equal(findShortcutConflict(next, shortcuts, 'darwin'), null);
  assert.equal(findShortcutConflict(previous, shortcuts, 'linux'), null);
  assert.equal(findShortcutConflict(next, shortcuts, 'linux'), null);
});

test('Quick Actions uses CotEditor Command-K and is routed from the native View menu', async () => {
  const quickActions = get('quickActions');
  assert.ok(quickActions);
  assert.equal(quickActions.accelerator, 'CmdOrCtrl+K');
  assert.equal(formatShortcut(quickActions, 'darwin'), '⌘K');
  const mac = { key: 'k', code: 'KeyK', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false };
  const linux = { ...mac, ctrlKey: true, metaKey: false };
  assert.equal(resolveShortcut(mac, shortcuts, 'darwin')?.id, 'quickActions');
  assert.equal(resolveShortcut(linux, shortcuts, 'linux')?.id, 'quickActions');
  assert.equal(findShortcutConflict(quickActions, shortcuts, 'darwin'), null);
  assert.equal(findShortcutConflict(quickActions, shortcuts, 'linux'), null);

  const fs = await import('node:fs');
  const renderer = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const menu = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const preload = fs.readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
  assert.match(menu, /id: 'menu-quick-actions', label: '快速操作…', accelerator: accelerator\('quickActions'\)/);
  assert.match(renderer, /quickActions: showQuickActions/);
  assert.match(preload, /getQuickActionItems: \(\) => ipcRenderer\.invoke\('quick-actions:list'\)/);
  assert.match(preload, /'menu:quick-actions'/);
});
