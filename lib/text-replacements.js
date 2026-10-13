export const MAX_TEXT_REPLACEMENTS = 100;
export const MAX_TEXT_REPLACEMENT_FIELD_BYTES = 4096;
export const MAX_TEXT_REPLACEMENTS_TOTAL_BYTES = 32 * 1024;

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

/** Normalize local, explicit text-replacement rules without importing OS dictionaries. */
export function normalizeTextReplacements(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const ids = new Set();
  const triggers = new Set();
  let totalBytes = 0;

  for (const item of value) {
    if (result.length >= MAX_TEXT_REPLACEMENTS) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const { id, trigger, replacement } = item;
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)
        || ids.has(id) || typeof trigger !== 'string' || trigger.length === 0
        || typeof replacement !== 'string' || trigger.includes('\0') || replacement.includes('\0')) continue;
    const fieldBytes = byteLength(trigger) + byteLength(replacement);
    if (fieldBytes > MAX_TEXT_REPLACEMENT_FIELD_BYTES || totalBytes + fieldBytes > MAX_TEXT_REPLACEMENTS_TOTAL_BYTES) continue;
    if (triggers.has(trigger)) continue;
    ids.add(id);
    triggers.add(trigger);
    totalBytes += fieldBytes;
    result.push({ id, trigger, replacement, enabled: item.enabled !== false, ...(item.automatic === true ? { automatic: true } : {}) });
  }
  return result;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Apply local rules once, literally and case-sensitively, without cascading replacements. */
export function applyTextReplacements(text = '', replacements = []) {
  const source = String(text);
  const rules = normalizeTextReplacements(replacements).filter(rule => rule.enabled);
  if (!rules.length) return source;
  const ordered = rules
    .map((rule, index) => ({ ...rule, index, length: Array.from(rule.trigger).length }))
    .sort((left, right) => right.length - left.length || left.index - right.index);
  const byTrigger = new Map(ordered.map(rule => [rule.trigger, rule.replacement]));
  const pattern = new RegExp(ordered.map(rule => escapeRegExp(rule.trigger)).join('|'), 'gu');
  return source.replace(pattern, match => byTrigger.get(match));
}
