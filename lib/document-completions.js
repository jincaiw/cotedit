const DOCUMENT_WORD = /[\p{L}\p{N}\p{M}_]+/gu;
const DOCUMENT_WORD_PREFIX = /^[\p{L}\p{N}\p{M}_]+$/u;
const COMPLETION_LIMIT = 250;

/** Collect unique words that extend the current prefix, without materializing the whole document. */
export function collectDocumentWordCompletions(lines, partialWord, limit = COMPLETION_LIMIT) {
  if (typeof partialWord !== 'string' || !DOCUMENT_WORD_PREFIX.test(partialWord)) return [];
  const prefixLength = Array.from(partialWord).length;
  if (!prefixLength || (prefixLength === 1 && !/^\p{L}/u.test(partialWord))) return [];

  const foldedPrefix = partialWord.toLocaleLowerCase();
  const maximum = Number.isSafeInteger(limit) ? Math.max(0, Math.min(COMPLETION_LIMIT, limit)) : COMPLETION_LIMIT;
  if (!maximum) return [];

  const seen = new Set();
  const completions = [];
  for (const line of lines) {
    if (typeof line !== 'string') continue;
    for (const match of line.matchAll(DOCUMENT_WORD)) {
      const word = match[0];
      const foldedWord = word.toLocaleLowerCase();
      if (foldedWord === foldedPrefix || !foldedWord.startsWith(foldedPrefix) || seen.has(foldedWord)) continue;
      seen.add(foldedWord);
      completions.push(word);
      if (completions.length >= maximum) return completions;
    }
  }
  return completions;
}

/** Offer document words explicitly or during typing when selected, bounding automatic document scans. */
export function documentWordCompletionSource(context, { includeWhileTyping = false, automaticScanLimit = 250_000 } = {}) {
  if (!context?.explicit && !includeWhileTyping) return null;
  const match = context.matchBefore(/[\p{L}\p{N}\p{M}_]+/u);
  if (!match) return null;
  if (!context.explicit && Array.from(match.text).length < 3) return null;

  const lines = context.explicit ? context.state.doc.iterLines() : boundedDocumentLines(context.state.doc, automaticScanLimit);
  const options = collectDocumentWordCompletions(lines, match.text)
    .map(label => ({ label, type: 'text', section: { name: '文稿', rank: 20 } }));
  return options.length ? {
    from: match.from,
    options,
    validFor: /^[\p{L}\p{N}\p{M}_]*$/u
  } : null;
}

function* boundedDocumentLines(doc, scanLimit) {
  const maximum = Number.isSafeInteger(scanLimit) ? Math.max(0, Math.min(1_000_000, scanLimit)) : 250_000;
  let scanned = 0;
  for (const line of doc.iterLines()) {
    if (scanned >= maximum) break;
    const remaining = maximum - scanned;
    yield line.length > remaining ? line.slice(0, remaining) : line;
    scanned += Math.min(line.length + 1, remaining);
  }
}
