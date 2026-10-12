'use strict';

const NAMED_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'backspace', 'delete', 'escape', 'tab', 'enter', 'space', 'pageup', 'pagedown', 'home', 'end']);
const NON_CHARACTER_KEYS = new Set(['shift', 'control', 'ctrl', 'alt', 'altgraph', 'meta', 'os', 'dead', 'process', 'unidentified', 'compose', 'capslock', 'numlock', 'scrolllock', 'fn', 'fnlock', 'hyper', 'super']);

function requiresCustomKeyDispatch(key) {
  const value = String(key || '').toLowerCase();
  return (Array.from(value).length > 1 || /[^\x00-\x7F]/u.test(value))
    && !/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(value)
    && !NON_CHARACTER_KEYS.has(value)
    && !NAMED_KEYS.has(value);
}

function customAccelerator(binding, platform = process.platform) {
  if (!binding || requiresCustomKeyDispatch(binding.key)) return undefined;
  const parts = [];
  const isMac = platform === 'darwin';
  if (binding.mod) parts.push('CmdOrCtrl');
  if (binding.ctrl && (isMac || !binding.mod)) parts.push('Control');
  if (binding.alt) parts.push('Alt');
  const implicitPlus = binding.key === '=' && binding.shift;
  if (binding.shift && !implicitPlus) parts.push('Shift');
  const aliases = { arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right', backspace: 'Backspace', delete: 'Delete', escape: 'Escape', tab: 'Tab', enter: 'Enter', space: 'Space', pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End' };
  const key = implicitPlus ? 'Plus' : (aliases[binding.key] || (/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(binding.key) ? binding.key.toUpperCase() : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key));
  return [...parts, key].join('+');
}

/** Match CotEditor's display rule: uppercase the whole key equivalent, including expanding mappings. */
function formatShortcutKeyOutput(value) {
  return String(value).toUpperCase();
}

function formatCustomShortcutLabel(binding, platform = process.platform) {
  const isMac = platform === 'darwin';
  const parts = [];
  if (isMac) {
    if (binding.ctrl) parts.push('⌃');
    if (binding.alt) parts.push('⌥');
    if (binding.shift) parts.push('⇧');
    if (binding.mod) parts.push('⌘');
  } else {
    if (binding.mod || binding.ctrl) parts.push('Ctrl');
    if (binding.alt) parts.push('Alt');
    if (binding.shift) parts.push('Shift');
  }
  const key = String(binding.key);
  parts.push(formatShortcutKeyOutput(key));
  return parts.join(isMac ? '' : ' + ');
}

function menuIdToShortcutId(id = '') {
  return String(id).replace(/^menu-/, '').replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function decorateMenuShortcutLabels(template, bindings = {}, platform = process.platform, captureActive = false) {
  if (captureActive) return template;
  const visit = items => {
    for (const item of items) {
      const id = item.id?.startsWith('menu-') ? menuIdToShortcutId(item.id) : '';
      const binding = id ? bindings[id] : null;
      if (binding && requiresCustomKeyDispatch(binding.key) && item.label && !item.accelerator) {
        item.label = `${item.label}\t${formatCustomShortcutLabel(binding, platform)}`;
      }
      if (Array.isArray(item.submenu)) visit(item.submenu);
    }
  };
  visit(template);
  return template;
}

module.exports = { customAccelerator, decorateMenuShortcutLabels, formatCustomShortcutLabel, requiresCustomKeyDispatch };
