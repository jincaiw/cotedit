function isMacPlatform(platform = '') {
  return platform === 'darwin' || /Mac/i.test(String(platform));
}

const KEY_LABELS = {
  backspace: platform => isMacPlatform(platform) ? '⌫' : 'Backspace',
  escape: () => 'Escape',
  arrowup: () => '↑',
  arrowdown: () => '↓',
  arrowleft: () => '←',
  arrowright: () => '→',
  pageup: () => 'Page Up',
  pagedown: () => 'Page Down',
  space: () => 'Space',
  enter: () => 'Enter',
  delete: () => 'Delete',
  tab: () => 'Tab',
  home: () => 'Home',
  end: () => 'End'
};

const EVENT_CODE_KEYS = {
  Backspace: 'backspace', Delete: 'delete', Escape: 'escape', Tab: 'tab', Enter: 'enter', Space: 'space',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
  PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Comma: ',', Period: '.', Slash: '/',
  Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Backquote: '`'
};
const NON_CHARACTER_KEYS = new Set(['shift', 'control', 'ctrl', 'alt', 'altgraph', 'meta', 'os', 'dead', 'process', 'unidentified', 'compose', 'capslock', 'numlock', 'scrolllock', 'fn', 'fnlock', 'hyper', 'super']);
const SUPPORTED_NAMED_KEYS = new Set(['backspace', 'delete', 'escape', 'tab', 'enter', 'space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown', 'home', 'end']);
const INTENTIONAL_SHARED_BINDING = new Set(['goToLine:surroundCustom', 'surroundCustom:goToLine']);
export const MAX_PRINTABLE_SHORTCUT_KEY_SCALARS = 16_384;
const EXTENDED_PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;
const GRAPHEME_EXTEND = /^\p{Grapheme_Extend}$/u;
const EMOJI_MODIFIER = /^\p{Emoji_Modifier}$/u;

/** Allow ZWJ only inside a valid Extended_Pictographic … ZWJ … Extended_Pictographic sequence. */
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

/** Normalize named/single-character keys; preserve case for multi-character key outputs. */
export function normalizeShortcutKey(value) {
  const raw = typeof value === 'string' ? value : '';
  if (raw.length > MAX_PRINTABLE_SHORTCUT_KEY_SCALARS * 2) return '';
  const normalized = raw.normalize('NFC');
  const folded = normalized.toLowerCase();
  if (/^[a-z0-9]$/.test(folded) || /^f(?:[1-9]|1[0-9]|2[0-4])$/.test(folded) || SUPPORTED_NAMED_KEYS.has(folded)
    || /^[,./\\\[\]=;`'-]$/.test(folded)) return folded;
  const length = Array.from(normalized).length;
  if (length > MAX_PRINTABLE_SHORTCUT_KEY_SCALARS) return '';
  const singleUnicodeCharacter = length === 1 && /[^\x00-\x7F]/u.test(normalized);
  if (singleUnicodeCharacter && !NON_CHARACTER_KEYS.has(folded) && isSafePrintableShortcutOutput(folded)) return folded;
  return length >= 2
    && !NON_CHARACTER_KEYS.has(folded) && isSafePrintableShortcutOutput(normalized) ? normalized : '';
}

/** True while the platform is composing text through an input method editor. */
export function isShortcutCompositionEvent(event) {
  return event?.isComposing === true || event?.keyCode === 229;
}

function canonicalShortcutKey(value) {
  const raw = typeof value === 'string' ? value.normalize('NFC') : '';
  return normalizeShortcutKey(raw) || raw;
}

export function shortcutKeyFromEvent(event) {
  if (isShortcutCompositionEvent(event)) return null;
  const eventKey = String(event?.key || '').normalize('NFC');
  const logicalKey = eventKey.toLowerCase();
  if (NON_CHARACTER_KEYS.has(logicalKey)) return null;
  const normalizedEventKey = normalizeShortcutKey(eventKey);
  const hasUnicodeOutput = /[^\x00-\x7F]/u.test(normalizedEventKey);
  if (normalizedEventKey && (Array.from(eventKey).length > 1 || hasUnicodeOutput)
    && !/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(logicalKey)) return normalizedEventKey;
  const code = String(event?.code || '');
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/i.test(code)) return code.toLowerCase();
  if (EVENT_CODE_KEYS[code]) return EVENT_CODE_KEYS[code];
  const key = String(event?.key || '').toLowerCase();
  return /^[a-z0-9]$/.test(key) || /^[,./\\\[\]=;`'-]$/.test(key) || /^(?:f(?:[1-9]|1[0-9]|2[0-4])|arrow(?:up|down|left|right)|backspace|delete|escape|tab|enter|space|pageup|pagedown|home|end)$/.test(key)
    ? key
    : null;
}

export function shortcutFromEvent(event, platform = '') {
  const key = shortcutKeyFromEvent(event);
  if (!key) return null;
  const isMac = isMacPlatform(platform);
  const binding = {
    key,
    mod: isMac ? event.metaKey === true : event.ctrlKey === true,
    ctrl: isMac && event.ctrlKey === true,
    alt: event.altKey === true,
    shift: event.shiftKey === true
  };
  const hasModifier = binding.mod || binding.ctrl || binding.alt || binding.shift;
  if (!hasModifier && !/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return null;
  return binding;
}

export function applyShortcutOverrides(shortcuts, keyBindings = {}) {
  return shortcuts.map(shortcut => {
    const binding = keyBindings?.[shortcut.id];
    if (!binding || typeof binding !== 'object') return shortcut;
    return {
      ...shortcut,
      key: binding.key,
      keyMac: binding.key,
      mod: binding.mod === true,
      modMac: undefined,
      ctrl: binding.ctrl === true,
      ctrlMac: undefined,
      ctrlNonMac: undefined,
      alt: binding.alt === true,
      altMac: undefined,
      altNonMac: undefined,
      shift: binding.shift === true,
      shiftMac: undefined,
      shiftNonMac: undefined
    };
  });
}

function shortcutSignature(shortcut, platform = '') {
  const isMac = isMacPlatform(platform);
  const ctrl = isMac ? (shortcut.ctrlMac ?? shortcut.ctrl) : (shortcut.ctrlNonMac ?? shortcut.ctrl);
  const mod = isMac ? (shortcut.modMac ?? shortcut.mod) : shortcut.mod;
  const alt = isMac ? (shortcut.altMac ?? shortcut.alt) : (shortcut.altNonMac ?? shortcut.alt);
  const shift = isMac ? (shortcut.shiftMac ?? shortcut.shift) : (shortcut.shiftNonMac ?? shortcut.shift);
  const key = canonicalShortcutKey(isMac ? (shortcut.keyMac || shortcut.key) : shortcut.key);
  return JSON.stringify([key, ctrl === true || (mod === true && !isMac), mod === true && isMac, alt === true, shift === true]);
}

export function findShortcutConflict(candidate, shortcuts, platform = '') {
  const signature = shortcutSignature(candidate, platform);
  return shortcuts.find(shortcut => {
    if (shortcut.id === candidate.id || shortcutSignature(shortcut, platform) !== signature) return false;
    return !INTENTIONAL_SHARED_BINDING.has(`${candidate.id}:${shortcut.id}`);
  }) || null;
}

/** Omit overrides that are equivalent to the built-in shortcut on every supported platform. */
export function removeDefaultShortcutOverrides(shortcuts, keyBindings = {}) {
  const result = {};
  for (const [id, binding] of Object.entries(keyBindings || {})) {
    const base = shortcuts.find(shortcut => shortcut.id === id);
    if (!base || !binding || typeof binding !== 'object') { result[id] = binding; continue; }
    const candidate = {
      ...base,
      key: binding.key,
      keyMac: binding.key,
      mod: binding.mod === true,
      modMac: undefined,
      ctrl: binding.ctrl === true,
      ctrlMac: undefined,
      ctrlNonMac: undefined,
      alt: binding.alt === true,
      altMac: undefined,
      altNonMac: undefined,
      shift: binding.shift === true,
      shiftMac: undefined,
      shiftNonMac: undefined
    };
    const isDefaultEverywhere = ['darwin', 'win32', 'linux'].every(platform => shortcutSignature(candidate, platform) === shortcutSignature(base, platform));
    if (!isDefaultEverywhere) result[id] = binding;
  }
  return result;
}

/** Match CotEditor's display rule: uppercase the whole key equivalent, even when Unicode casing expands. */
function formatShortcutKeyOutput(value) {
  return String(value).toUpperCase();
}

export function formatShortcut(shortcut, platform = '') {
  const isMac = isMacPlatform(platform);
  const parts = [];
  const usesControl = isMac ? (shortcut.ctrlMac ?? shortcut.ctrl) : (shortcut.ctrlNonMac ?? shortcut.ctrl);
  const usesMod = isMac ? (shortcut.modMac ?? shortcut.mod) : shortcut.mod;
  const usesAlt = isMac ? (shortcut.altMac ?? shortcut.alt) : (shortcut.altNonMac ?? shortcut.alt);
  const usesShift = isMac ? (shortcut.shiftMac ?? shortcut.shift) : (shortcut.shiftNonMac ?? shortcut.shift);
  if (isMac) {
    if (usesControl) parts.push('⌃');
    if (usesAlt) parts.push('⌥');
    if (usesShift) parts.push('⇧');
    if (usesMod) parts.push('⌘');
  } else {
    if (usesMod || usesControl) parts.push('Ctrl');
    if (usesAlt) parts.push('Alt');
    if (usesShift) parts.push('Shift');
  }
  const key = isMac ? (shortcut.keyMac || shortcut.key) : shortcut.key;
  const keyText = String(key);
  const label = KEY_LABELS[keyText.toLowerCase()]?.(platform)
    || formatShortcutKeyOutput(keyText);
  return [...parts, label].join(isMac ? '' : ' + ');
}

export function matchesShortcut(event, shortcut, platform = '') {
  const isMac = isMacPlatform(platform);
  const key = shortcutKeyFromEvent(event);
  const expectedKey = canonicalShortcutKey(isMac ? (shortcut.keyMac || shortcut.key) : shortcut.key);
  const explicitCtrl = isMac ? (shortcut.ctrlMac ?? shortcut.ctrl) : (shortcut.ctrlNonMac ?? shortcut.ctrl);
  const expectedMod = isMac ? (shortcut.modMac ?? shortcut.mod) : shortcut.mod;
  const expectedCtrl = explicitCtrl === true || (expectedMod === true && !isMac);
  const expectedMeta = expectedMod === true && isMac;
  const expectedAlt = (isMac ? (shortcut.altMac ?? shortcut.alt) : (shortcut.altNonMac ?? shortcut.alt)) === true;
  const expectedShift = (isMac ? (shortcut.shiftMac ?? shortcut.shift) : (shortcut.shiftNonMac ?? shortcut.shift)) === true;
  return key === expectedKey
    && event.ctrlKey === expectedCtrl
    && event.metaKey === expectedMeta
    && event.altKey === expectedAlt
    && event.shiftKey === expectedShift;
}

/** Resolve CotEditor's shared ⌘L command by editor focus and selection state. */
export function resolveShortcut(event, shortcuts, platform = '', context = {}) {
  const matches = shortcuts.filter(shortcut => matchesShortcut(event, shortcut, platform));
  if (!matches.length) return null;

  const ids = new Set(matches.map(shortcut => shortcut.id));
  if (ids.has('goToLine') && ids.has('surroundCustom')) {
    const contextualId = context.editorFocused && context.hasSelection ? 'surroundCustom' : 'goToLine';
    return matches.find(shortcut => shortcut.id === contextualId) || matches[0];
  }
  return matches[0];
}
