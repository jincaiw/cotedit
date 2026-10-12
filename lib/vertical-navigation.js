function graphemeOffsets(text) {
  const offsets = [0];
  if (globalThis.Intl?.Segmenter) {
    for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
      offsets.push(segment.index + segment.segment.length);
    }
  } else {
    let offset = 0;
    for (const character of Array.from(text)) {
      offset += character.length;
      offsets.push(offset);
    }
  }
  return [...new Set(offsets)];
}

/** Move a caret in the physical reading directions of vertical-rl text. */
export function verticalTextAdjacentPosition(doc, position, direction) {
  if (!doc || !Number.isInteger(position) || !['up', 'down', 'left', 'right'].includes(direction)) return position;
  const line = doc.lineAt(Math.max(0, Math.min(position, doc.length)));
  const offset = Math.max(0, Math.min(line.text.length, position - line.from));
  const currentOffsets = graphemeOffsets(line.text);
  if (direction === 'up' || direction === 'down') {
    if (direction === 'up') {
      for (let index = currentOffsets.length - 1; index >= 0; index--) {
        if (currentOffsets[index] < offset) return line.from + currentOffsets[index];
      }
    } else {
      for (const boundary of currentOffsets) {
        if (boundary > offset) return line.from + boundary;
      }
    }
    return position;
  }
  const targetLineNumber = line.number + (direction === 'left' ? 1 : -1);
  if (targetLineNumber < 1 || targetLineNumber > doc.lines) return position;
  const targetLine = doc.line(targetLineNumber);
  const graphemeColumn = Math.max(0, currentOffsets.findIndex(boundary => boundary >= offset));
  const targetOffsets = graphemeOffsets(targetLine.text);
  const targetOffset = targetOffsets[Math.min(graphemeColumn, targetOffsets.length - 1)] ?? 0;
  return targetLine.from + targetOffset;
}
