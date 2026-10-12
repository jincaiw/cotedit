import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { customAccelerator, decorateMenuShortcutLabels, formatCustomShortcutLabel, requiresCustomKeyDispatch } = require('../electron/shortcut-menu.cjs');

test('multi-character bindings bypass invalid native accelerators but remain visible in menu labels', () => {
  const binding = { key: 'ss', mod: true, ctrl: false, alt: true, shift: true };
  assert.equal(requiresCustomKeyDispatch(binding.key), true);
  assert.equal(customAccelerator(binding, 'linux'), undefined);
  assert.equal(formatCustomShortcutLabel(binding, 'linux'), 'Ctrl + Alt + Shift + SS');
  assert.equal(formatCustomShortcutLabel(binding, 'darwin'), '⌥⇧⌘SS');
  assert.equal(formatCustomShortcutLabel({ ...binding, key: 'aB' }, 'linux'), 'Ctrl + Alt + Shift + AB');
  assert.equal(formatCustomShortcutLabel({ ...binding, key: 'aB' }, 'darwin'), '⌥⇧⌘AB');
  assert.equal(formatCustomShortcutLabel({ ...binding, key: 'ß' }, 'linux'), 'Ctrl + Alt + Shift + SS');
  assert.equal(formatCustomShortcutLabel({ ...binding, key: 'ﬃ' }, 'darwin'), '⌥⇧⌘FFI');

  const template = [
    { id: 'menu-save', label: '保存' },
    { label: '编辑', submenu: [{ id: 'menu-find-next', label: '查找下一个' }] }
  ];
  decorateMenuShortcutLabels(template, { save: binding, findNext: { key: 'xy', mod: true, ctrl: false, alt: false, shift: false } }, 'linux');
  assert.equal(template[0].label, '保存\tCtrl + Alt + Shift + SS');
  assert.equal(template[1].submenu[0].label, '查找下一个\tCtrl + XY');
  assert.equal(decorateMenuShortcutLabels([{ id: 'menu-save', label: '保存' }], { save: binding }, 'linux', true)[0].label, '保存');
});

test('menu labels display multi-character outputs beyond the former shortcut cap', () => {
  const key = 'Sß'.repeat(9);
  const binding = { key, mod: true, ctrl: false, alt: true, shift: false };
  assert.equal(requiresCustomKeyDispatch(key), true);
  assert.equal(customAccelerator(binding, 'linux'), undefined);
  assert.equal(formatCustomShortcutLabel(binding, 'linux'), `Ctrl + Alt + ${key.toUpperCase()}`);
  const menu = [{ id: 'menu-save', label: '保存' }];
  decorateMenuShortcutLabels(menu, { save: binding }, 'linux');
  assert.equal(menu[0].label, `保存\tCtrl + Alt + ${key.toUpperCase()}`);
});

test('single named keys and function keys retain Electron accelerator syntax', () => {
  assert.equal(requiresCustomKeyDispatch('F12'), false);
  assert.equal(requiresCustomKeyDispatch('ArrowDown'), false);
  assert.equal(customAccelerator({ key: 'arrowdown', mod: true }, 'linux'), 'CmdOrCtrl+Down');
  assert.equal(customAccelerator({ key: 'ss', mod: true }, 'linux'), undefined);
});

test('single Unicode printable keys use renderer dispatch and remain visible in menu labels', () => {
  const binding = { key: 'ß', mod: true, ctrl: false, alt: false, shift: false };
  assert.equal(requiresCustomKeyDispatch(binding.key), true);
  assert.equal(customAccelerator(binding, 'linux'), undefined);
  assert.equal(formatCustomShortcutLabel(binding, 'linux'), 'Ctrl + SS');
  const menu = [{ id: 'menu-save', label: '保存' }];
  decorateMenuShortcutLabels(menu, { save: binding }, 'linux');
  assert.equal(menu[0].label, '保存\tCtrl + SS');
});

test('default Yen character shortcut is shown in the menu and never registered as a native accelerator', () => {
  const binding = { key: '¥', mod: true, ctrl: false, alt: false, shift: false };
  assert.equal(requiresCustomKeyDispatch(binding.key), true);
  assert.equal(customAccelerator(binding, 'darwin'), undefined);
  assert.equal(formatCustomShortcutLabel(binding, 'darwin'), '⌘¥');
  const menu = [{ id: 'menu-insert-backslash', label: '插入反斜线' }];
  decorateMenuShortcutLabels(menu, { insertBackslash: binding }, 'darwin');
  assert.equal(menu[0].label, '插入反斜线\t⌘¥');
});
