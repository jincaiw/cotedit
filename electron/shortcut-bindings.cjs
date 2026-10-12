'use strict';

const { requiresCustomKeyDispatch } = require('./shortcut-menu.cjs');

const SHORTCUT_KEYS = new Set([
  ',', '.', '/', '\\', '[', ']', '=', '-', ';', "'", '`',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'backspace', 'delete', 'escape', 'tab', 'enter', 'space', 'pageup', 'pagedown', 'home', 'end'
]);
const MAX_PRINTABLE_SHORTCUT_KEY_SCALARS = 16_384;
const EXTENDED_PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;
const GRAPHEME_EXTEND = /^\p{Grapheme_Extend}$/u;
const EMOJI_MODIFIER = /^\p{Emoji_Modifier}$/u;

/** Keep ZWJ only when it joins two Extended_Pictographic sequences. */
function isSafePrintableShortcutOutput(value) {
  const characters = Array.from(value);
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    if (character === '\u200d') {
      let previous = index - 1;
      while (previous >= 0 && (GRAPHEME_EXTEND.test(characters[previous]) || EMOJI_MODIFIER.test(characters[previous]))) previous--;
      if (previous < 0 || !EXTENDED_PICTOGRAPHIC.test(characters[previous])
        || !EXTENDED_PICTOGRAPHIC.test(characters[index + 1] || '')) return false;
    } else if (/^[\p{C}\s]$/u.test(character)) return false;
  }
  return true;
}

/** Normalize untrusted renderer shortcut updates against the active command registry. */
function normalizeShortcutBindings(value, shortcuts = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowedIds = new Set(shortcuts.map(shortcut => shortcut?.id).filter(id => typeof id === 'string'));
  const bindings = {};
  let totalKeyScalars = 0;
  for (const [id, binding] of Object.entries(value).slice(0, 100)) {
    if (!allowedIds.has(id) || !binding || typeof binding !== 'object' || Array.isArray(binding)) continue;
    if (typeof binding.key !== 'string' || binding.key.length > MAX_PRINTABLE_SHORTCUT_KEY_SCALARS * 2) continue;
    const rawKey = binding.key.normalize('NFC');
    const foldedKey = rawKey.toLowerCase();
    const keyLength = Array.from(rawKey).length;
    const isPrintableSequence = requiresCustomKeyDispatch(rawKey)
      && keyLength <= MAX_PRINTABLE_SHORTCUT_KEY_SCALARS - totalKeyScalars
      && isSafePrintableShortcutOutput(rawKey);
    const key = isPrintableSequence && keyLength >= 2 ? rawKey : foldedKey;
    if (!(/^[a-z0-9]$/.test(key)
      || /^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)
      || SHORTCUT_KEYS.has(key)
      || isPrintableSequence)) continue;
    const keyScalars = Array.from(key).length;
    if (totalKeyScalars + keyScalars > MAX_PRINTABLE_SHORTCUT_KEY_SCALARS) continue;
    const entry = {
      key,
      mod: binding.mod === true,
      ctrl: binding.ctrl === true,
      alt: binding.alt === true,
      shift: binding.shift === true
    };
    if (!entry.mod && !entry.ctrl && !entry.alt && !entry.shift && !/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) continue;
    bindings[id] = entry;
    totalKeyScalars += keyScalars;
  }
  return bindings;
}

module.exports = { normalizeShortcutBindings };
