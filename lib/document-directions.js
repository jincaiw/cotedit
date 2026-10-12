const MAX_DOCUMENT_DIRECTIONS = 500;
const MAX_PATH_LENGTH = 4096;

export function normalizeDocumentWritingDirections(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const [filePath, direction] of Object.entries(value).slice(-MAX_DOCUMENT_DIRECTIONS * 2)) {
    if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > MAX_PATH_LENGTH) continue;
    if (direction === 'ltr' || direction === 'rtl') normalized[filePath] = direction;
  }
  return Object.fromEntries(Object.entries(normalized).slice(-MAX_DOCUMENT_DIRECTIONS));
}

export function documentWritingDirection(value, filePath, fallback = 'ltr') {
  const normalized = normalizeDocumentWritingDirections(value);
  const defaultDirection = fallback === 'rtl' ? 'rtl' : 'ltr';
  if (typeof filePath !== 'string' || filePath.length === 0) return defaultDirection;
  return normalized[filePath] || defaultDirection;
}

export function withDocumentWritingDirection(value, filePath, direction) {
  const normalized = normalizeDocumentWritingDirections(value);
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > MAX_PATH_LENGTH) return normalized;
  if (direction !== 'ltr' && direction !== 'rtl') return normalized;
  delete normalized[filePath];
  normalized[filePath] = direction;
  return Object.fromEntries(Object.entries(normalized).slice(-MAX_DOCUMENT_DIRECTIONS));
}
