import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { filterQuickActions } from '../lib/quick-actions.js';

const require = createRequire(import.meta.url);
const { collectQuickActionMenuItems, executeQuickActionMenuItem } = require('../electron/quick-action-menu.cjs');

const actions = [
  { id: 'save', label: '保存', group: '文件' },
  { id: 'saveAs', label: '另存为…', group: '文件' },
  { id: 'toggleWrap', label: '切换自动换行', group: '格式' },
  { id: 'quickActions', label: '快速操作…', group: '显示' }
];

test('quick-action filtering keeps menu order when empty, supports Chinese, categories, IDs, and camel-case terms', () => {
  assert.deepEqual(filterQuickActions(actions).map(item => item.id), ['save', 'saveAs', 'toggleWrap', 'quickActions']);
  assert.deepEqual(filterQuickActions(actions, '保存').map(item => item.id), ['save']);
  assert.deepEqual(filterQuickActions(actions, '文件 另存').map(item => item.id), ['saveAs']);
  assert.deepEqual(filterQuickActions(actions, 'toggle wrap').map(item => item.id), ['toggleWrap']);
});

test('quick-action filtering ranks prefix matches, supports shortcut text, and applies a bounded limit', () => {
  const candidates = [
    { id: 'moveLineUp', label: '上移行', group: '文本', accelerator: 'Ctrl + ↑' },
    { id: 'find', label: '查找与替换…', group: '查找', accelerator: 'Ctrl + F' },
    { id: 'format', label: '格式化文本', group: '文本', accelerator: '' }
  ];
  assert.equal(filterQuickActions(candidates, 'Ctrl + F')[0].id, 'find');
  assert.equal(filterQuickActions(candidates, 'format')[0].id, 'format');
  assert.equal(filterQuickActions(candidates, '', 2).length, 2);
  assert.deepEqual(filterQuickActions(candidates, '', -1), []);
  assert.deepEqual(filterQuickActions(null, 'find'), []);
});

test('native menu collection includes clickable leaf commands, menu paths, and generated IDs but excludes Quick Actions itself', () => {
  const calls = [];
  const template = [
    { label: 'CotEdit', submenu: [
      { label: '设置…', click: (...args) => calls.push(['settings', ...args]) }
    ] },
    { label: '显示', submenu: [
      { type: 'separator' },
      { id: 'menu-quick-actions', label: '快速操作…', click: () => calls.push(['recursive']) },
      { label: '侧栏', submenu: [
        { id: 'menu-folder-browser', label: '文件浏览器', accelerator: 'Ctrl+Alt+1', click: (...args) => calls.push(['browser', ...args]) },
        { role: 'togglefullscreen', label: '全屏' }
      ] }
    ] }
  ];
  const registry = collectQuickActionMenuItems(template, { ignoreIds: ['menu-quick-actions'], rootLabel: 'CotEdit' });
  assert.deepEqual(registry.entries.map(({ label, group }) => [label, group]), [
    ['设置…', ''],
    ['文件浏览器', '显示 › 侧栏']
  ]);
  assert.match(registry.entries[0].id, /^quick-action-generated-/);
  const menuItems = new Map(registry.entries.map(entry => [entry.id, { enabled: true, visible: true, label: entry.label }]));
  const menu = { getMenuItemById: id => menuItems.get(id) };
  assert.equal(executeQuickActionMenuItem(registry, registry.entries[0].id, menu, { id: 7 }), true);
  assert.equal(calls[0][0], 'settings');
  assert.equal(calls[0][1].label, '设置…');
  assert.equal(calls[0][2].id, 7);
  menuItems.get(registry.entries[1].id).enabled = false;
  assert.equal(executeQuickActionMenuItem(registry, registry.entries[1].id, menu, null), false);
  assert.equal(executeQuickActionMenuItem(registry, 'not-registered', menu, null), false);
});
