/**
 * Collect non-empty search matches inside CodeMirror's currently rendered ranges.
 * SearchQuery.getCursor is the same public matcher used by the editor's search
 * commands, so literal, regexp, whole-word and Unicode matching stay aligned.
 */
export function collectVisibleSearchHighlights(state, query, visibleRanges = []) {
  if (!state?.doc || !query?.valid || typeof query.getCursor !== 'function' || !Array.isArray(visibleRanges)) return [];
  const documentLength = state.doc.length;
  const highlights = [];

  for (let index = 0; index < visibleRanges.length; index++) {
    const range = visibleRanges[index];
    if (!Number.isInteger(range?.from) || !Number.isInteger(range?.to)) continue;
    const from = Math.max(0, Math.min(documentLength, range.from));
    let to = Math.max(from, Math.min(documentLength, range.to));

    // Merge nearby rendered ranges just as CodeMirror's own search highlighter
    // does, allowing multiline matches close to a viewport boundary.
    while (index < visibleRanges.length - 1 && to > visibleRanges[index + 1].from - 500) {
      const next = visibleRanges[++index];
      if (Number.isInteger(next?.to)) to = Math.max(to, Math.min(documentLength, next.to));
    }

    const cursor = query.getCursor(state, from, to);
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      const matchFrom = next.value.from;
      const matchTo = next.value.to;
      if (matchFrom >= matchTo) continue;
      const selected = state.selection.ranges.some(range => !range.empty && range.from === matchFrom && range.to === matchTo);
      highlights.push({ from: matchFrom, to: matchTo, selected });
    }
  }
  return highlights;
}
