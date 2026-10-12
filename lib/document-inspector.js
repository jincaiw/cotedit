import { countCharacters, getTextStats } from './document.js';
import { getSingleGraphemeSelectionInText } from './character-selection.js';

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.trunc(number) : fallback;
}

/** Return the lightweight text and selection statistics shown by the document inspector. */
export function getDocumentInspectorStats({
  text = '',
  lineCount,
  lineNumber = 1,
  linePrefix = '',
  selectionText = null
} = {}) {
  const source = String(text);
  const stats = getTextStats(source);
  return {
    words: stats.words,
    characters: stats.characters,
    lineCount: positiveInteger(lineCount, stats.lines),
    cursorLine: positiveInteger(lineNumber, 1),
    cursorColumn: countCharacters(linePrefix) + 1,
    selectionCharacters: selectionText == null ? null : countCharacters(selectionText)
  };
}

/** Return the selected text only when the supplied range is exactly one complete grapheme. */
export function getDocumentInspectorCharacter(text = '', range = null) {
  if (!range || typeof range !== 'object') return null;
  return getSingleGraphemeSelectionInText(String(text), range.from, range.to, 1)?.text ?? null;
}

/** Format a saved local-file byte count with a readable decimal unit and exact byte total. */
export function formatDocumentFileSize(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return null;
  const exact = `${new Intl.NumberFormat('zh-CN').format(bytes)} 字节`;
  if (bytes < 1000) return exact;
  const units = ['kB', 'MB', 'GB', 'TB', 'PB'];
  const unitIndex = Math.min(Math.floor(Math.log10(bytes) / 3), units.length);
  const scaled = bytes / (1000 ** unitIndex);
  const readable = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(scaled);
  return `${readable} ${units[unitIndex - 1]}（${exact}）`;
}

/** Format a validated local-file timestamp for the document inspector. */
export function formatDocumentFileTimestamp(timestamp, locale = 'zh-CN') {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > 8_640_000_000_000_000) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** Normalize numeric POSIX owner/group IDs without treating platform mode bits as identities. */
export function normalizeDocumentFileOwnerIds(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { uid, gid } = value;
  if (!Number.isSafeInteger(uid) || uid < 0 || !Number.isSafeInteger(gid) || gid < 0) return null;
  return { uid, gid };
}

/** Format validated numeric POSIX owner/group IDs for the document inspector. */
export function formatDocumentFileOwnerIds(value) {
  const ids = normalizeDocumentFileOwnerIds(value);
  return ids ? `UID ${ids.uid} · GID ${ids.gid}` : null;
}

const DOCUMENT_FILE_TAG_COLORS = new Set(['none', 'gray', 'green', 'purple', 'blue', 'yellow', 'red', 'orange']);

/** Keep only a bounded list of plain Finder tag labels and known color names. */
export function normalizeDocumentFileTags(value) {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 32).flatMap(tag => {
    if (!tag || typeof tag !== 'object' || Array.isArray(tag)
        || typeof tag.name !== 'string' || !tag.name.length || tag.name.length > 256) return [];
    return [{
      name: tag.name,
      color: DOCUMENT_FILE_TAG_COLORS.has(tag.color) ? tag.color : 'none'
    }];
  });
}
