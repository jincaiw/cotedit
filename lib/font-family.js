export const EDITOR_FONT_FAMILY_MAX_LENGTH = 80;

export function normalizeEditorFontFamily(value) {
  if (typeof value !== 'string') return '';
  const family = value.trim();
  if (!family || family.length > EDITOR_FONT_FAMILY_MAX_LENGTH || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(family)) return '';
  return family;
}

export function editorFontFamilyStack(family, type = 'monospaced') {
  const fallback = type === 'standard'
    ? 'var(--editor-font-standard)'
    : 'var(--editor-font-monospace)';
  const normalized = normalizeEditorFontFamily(family);
  return normalized ? `"${normalized}", ${fallback}` : fallback;
}
