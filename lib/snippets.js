import { normalizeShortcutKey } from './shortcuts.js';

export const SELECTION_TOKEN = '<<<SELECTION>>>';
export const CURSOR_TOKEN = '<<<CURSOR>>>';
export const MAX_SNIPPETS = 100;
export const MAX_SNIPPET_FORMAT_BYTES = 12 * 1024;
export const MAX_SNIPPET_TOTAL_BYTES = 40 * 1024;

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,80}$/i;
const encoder = new TextEncoder();

function utf8Size(value) {
  return encoder.encode(value).byteLength;
}

function normalizeSnippetShortcut(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const key = normalizeShortcutKey(value.key);
  if (!key) return null;
  const shortcut = { key, mod: value.mod === true, ctrl: value.ctrl === true, alt: value.alt === true, shift: value.shift === true };
  if (!shortcut.mod && !shortcut.ctrl && !shortcut.alt && !shortcut.shift && !/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return null;
  return shortcut;
}

/** Keep imported/local settings bounded and safe for menus and the editor. */
export function normalizeSnippets(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const ids = new Set();
  let totalBytes = 0;

  for (const candidate of value.slice(0, MAX_SNIPPETS * 2)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const format = typeof candidate.format === 'string' ? candidate.format : null;
    const scope = candidate.scope == null || candidate.scope === '' ? '' : candidate.scope;
    const shortcut = normalizeSnippetShortcut(candidate.shortcut);
    if (!ID_PATTERN.test(id) || ids.has(id) || !name || name.length > 80 || format === null || utf8Size(format) > MAX_SNIPPET_FORMAT_BYTES) continue;
    if (typeof scope !== 'string' || (scope !== '' && !SCOPE_PATTERN.test(scope))) continue;

    const normalizedScope = scope.toLowerCase();
    const entryBytes = utf8Size(id) + utf8Size(name) + utf8Size(format) + utf8Size(normalizedScope) + (shortcut ? utf8Size(JSON.stringify(shortcut)) : 0);
    if (totalBytes + entryBytes > MAX_SNIPPET_TOTAL_BYTES) break;
    ids.add(id);
    totalBytes += entryBytes;
    result.push({ id, name, scope: normalizedScope, format, ...(shortcut ? { shortcut } : {}) });
    if (result.length >= MAX_SNIPPETS) break;
  }
  return result;
}

export function snippetsForSyntax(snippets, syntaxId) {
  const syntax = typeof syntaxId === 'string' ? syntaxId.toLowerCase() : '';
  return normalizeSnippets(snippets).filter(snippet => !snippet.scope || snippet.scope === syntax);
}

/**
 * Expand CotEditor-compatible SELECTION and CURSOR tokens. New lines in the
 * format inherit the indentation at the insertion point; selected text is
 * substituted after cursor tokenization, so a token in the selection is literal.
 */
export function expandSnippetFormat(format, { selection = '', indent = '' } = {}) {
  const source = typeof format === 'string' ? format : '';
  const selectedText = typeof selection === 'string' ? selection : '';
  const indentation = typeof indent === 'string' && /^[\t ]*$/.test(indent) ? indent : '';
  const indented = source
    .replace(/\r\n|[\r\n\u000b\u000c\u0085\u2028\u2029]/g, '\n')
    .replace(/\n/g, `\n${indentation}`);
  const segments = indented.split(CURSOR_TOKEN);
  const cursorOffsets = [];
  let text = '';
  segments.forEach((segment, index) => {
    if (index > 0) cursorOffsets.push(text.length);
    text += segment.split(SELECTION_TOKEN).join(selectedText);
  });
  return { text, cursorOffsets };
}
