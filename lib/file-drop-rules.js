import defaultFileDropRules from './file-drop-defaults.json' with { type: 'json' };

export const MAX_FILE_DROP_RULES = 100;
export const MAX_FILE_DROP_FORMAT_BYTES = 8 * 1024;
export const MAX_FILE_DROP_TOTAL_BYTES = 64 * 1024;
export const MAX_FILE_DROP_EXTENSIONS = 32;

export const DEFAULT_FILE_DROP_RULES = Object.freeze(defaultFileDropRules.map(rule => Object.freeze({
  ...rule,
  extensions: Object.freeze([...rule.extensions])
})));

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,80}$/i;
const EXTENSION_PATTERN = /^[a-z0-9][a-z0-9_+-]{0,31}$/i;
const encoder = new TextEncoder();

function utf8Size(value) {
  return encoder.encode(value).byteLength;
}

function normalizeExtensions(value) {
  if (value == null) return [];
  if (!Array.isArray(value) && typeof value !== 'string') return null;
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const extensions = [];
  for (const entry of entries.slice(0, MAX_FILE_DROP_EXTENSIONS * 2)) {
    if (typeof entry !== 'string') return null;
    const extension = entry.trim();
    if (!extension) continue;
    if (!EXTENSION_PATTERN.test(extension)) return null;
    if (!extensions.some(item => item.toLowerCase() === extension.toLowerCase())) {
      extensions.push(extension);
    }
    if (extensions.length >= MAX_FILE_DROP_EXTENSIONS) break;
  }
  return extensions;
}

/** Validate and bound user/imported rules before they reach menus or IPC. */
export function normalizeFileDropRules(value) {
  if (!Array.isArray(value)) return DEFAULT_FILE_DROP_RULES.map(rule => ({ ...rule, extensions: [...rule.extensions] }));
  const result = [];
  const ids = new Set();
  let totalBytes = 0;

  for (const candidate of value.slice(0, MAX_FILE_DROP_RULES * 2)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : `file-drop-${result.length + 1}`;
    const formatValue = candidate.format ?? candidate.formatString;
    const format = typeof formatValue === 'string' ? formatValue : null;
    const rawScope = candidate.scope == null || candidate.scope === '' ? '' : candidate.scope;
    const scope = typeof rawScope === 'string' ? rawScope.trim().toLowerCase() : null;
    const description = typeof candidate.description === 'string'
      ? candidate.description.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120)
      : '';
    const extensions = normalizeExtensions(candidate.extensions);

    if (!ID_PATTERN.test(id) || ids.has(id) || format === null || !format.length || format.includes('\0')
        || utf8Size(format) > MAX_FILE_DROP_FORMAT_BYTES || scope === null || (scope && !SCOPE_PATTERN.test(scope)) || extensions === null) continue;
    const entry = { id, scope, extensions, description, format };
    const entryBytes = utf8Size(JSON.stringify(entry));
    if (totalBytes + entryBytes > MAX_FILE_DROP_TOTAL_BYTES) break;
    ids.add(id);
    totalBytes += entryBytes;
    result.push(entry);
    if (result.length >= MAX_FILE_DROP_RULES) break;
  }
  return result;
}

export function fileDropExtensionsText(rule) {
  return Array.isArray(rule?.extensions) ? rule.extensions.join(', ') : '';
}
