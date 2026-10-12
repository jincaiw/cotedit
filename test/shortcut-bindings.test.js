import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeShortcutBindings } = require('../electron/shortcut-bindings.cjs');
const shortcuts = require('../lib/shortcuts.json');
const registry = [
  { id: 'save' },
  { id: 'find' },
  { id: 'fontUp' },
  { id: 'moveLineUp' },
  { id: 'insertYenMark' },
  { id: 'badWhitespace' },
  { id: 'badFormat' },
  { id: 'badControl' }
];

test('main-process normalization accepts bounded printable multi-character key outputs', () => {
  const input = {
    save: { key: 'SS', mod: true, alt: true, shift: true, extra: 'discard' },
    find: { key: 'A\u0308B', ctrl: true },
    fontUp: { key: '😀'.repeat(17), mod: true },
    moveLineUp: { key: '😀', mod: true }
  };
  const original = structuredClone(input);
  assert.deepEqual(normalizeShortcutBindings(input, registry), {
    save: { key: 'SS', mod: true, ctrl: false, alt: true, shift: true },
    find: { key: 'ÄB', mod: false, ctrl: true, alt: false, shift: false },
    fontUp: { key: '😀'.repeat(17), mod: true, ctrl: false, alt: false, shift: false },
    moveLineUp: { key: '😀', mod: true, ctrl: false, alt: false, shift: false }
  });
  assert.deepEqual(input, original, 'normalization does not mutate renderer-owned input');
});

test('main-process normalization accepts joined emoji key outputs but rejects malformed or unsafe joiners', () => {
  const emoji = '👩🏽‍💻';
  assert.deepEqual(normalizeShortcutBindings({
    save: { key: emoji, mod: true, alt: true },
    find: { key: '🏳️‍🌈', ctrl: true },
    fontUp: { key: '👩‍', mod: true },
    moveLineUp: { key: 'a‍b', mod: true },
    insertYenMark: { key: `👩‍\u202e💻`, mod: true }
  }, registry), {
    save: { key: emoji, mod: true, ctrl: false, alt: true, shift: false },
    find: { key: '🏳️‍🌈', mod: false, ctrl: true, alt: false, shift: false }
  });
});

test('main-process normalization rejects unknown, malformed, over-budget, and unmodified printable bindings', () => {
  assert.deepEqual(normalizeShortcutBindings({
    unknownCommand: { key: 'q', mod: true },
    save: null,
    find: [],
    fontUp: { key: '😀'.repeat(16_385), mod: true },
    moveLineUp: { key: 'bad key', mod: true },
    insertYenMark: { key: 'ss' },
    badWhitespace: { key: 'a\u00a0b', mod: true },
    badFormat: { key: 'a\u202eb', mod: true },
    badControl: { key: 'a\u0000b', mod: true },
    saveAgain: { key: 'Dead', mod: true }
  }, registry), {});
});

test('main-process normalization enforces one aggregate Unicode-scalar budget across accepted key labels', () => {
  const maximum = '😀'.repeat(16_384);
  const normalized = normalizeShortcutBindings({
    save: { key: maximum, mod: true },
    find: { key: 'x', mod: true }
  }, registry);
  assert.deepEqual(Object.keys(normalized), ['save']);
  assert.equal(normalized.save.key, maximum);
});

test('main-process normalization preserves named-key and function-key exceptions', () => {
  assert.deepEqual(normalizeShortcutBindings({
    save: { key: 'ArrowDown', mod: true },
    find: { key: 'F24' },
    moveLineUp: { key: 'Enter' }
  }, registry), {
    save: { key: 'arrowdown', mod: true, ctrl: false, alt: false, shift: false },
    find: { key: 'f24', mod: false, ctrl: false, alt: false, shift: false }
  });
});

test('main-process normalization ignores unexpected ids without expanding the allowed command set', () => {
  assert.deepEqual(normalizeShortcutBindings({ save: { key: 's', mod: true } }, shortcuts).save, {
    key: 's', mod: true, ctrl: false, alt: false, shift: false
  });
  assert.deepEqual(normalizeShortcutBindings({ notACommand: { key: 's', mod: true } }, shortcuts), {});
  assert.deepEqual(normalizeShortcutBindings([], shortcuts), {});
  assert.deepEqual(normalizeShortcutBindings(null, shortcuts), {});
});
