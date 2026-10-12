export function adjacentOutlineItem(items, currentLine, direction) {
  if (!Array.isArray(items) || !Number.isSafeInteger(currentLine) || currentLine < 1 || ![-1, 1].includes(direction)) return null;
  const candidates = items.filter(item => item && Number.isSafeInteger(item.line) && item.line >= 1);
  if (direction < 0) {
    return candidates.filter(item => item.line < currentLine).sort((a, b) => b.line - a.line)[0] || null;
  }
  return candidates.filter(item => item.line > currentLine).sort((a, b) => a.line - b.line)[0] || null;
}

export function nearestOutlineItemAtOrBefore(items, currentLine) {
  if (!Array.isArray(items) || !Number.isSafeInteger(currentLine) || currentLine < 1) return null;
  return items
    .filter(item => item && Number.isSafeInteger(item.line) && item.line >= 1 && item.line <= currentLine)
    .sort((a, b) => b.line - a.line)[0] || null;
}
