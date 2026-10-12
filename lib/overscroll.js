export function calculateOverscrollPadding(editorHeight, lineHeight, documentPaddingTop, rate) {
  if (![editorHeight, lineHeight, documentPaddingTop, rate].every(Number.isFinite)) return 0;
  const clampedRate = Math.max(0, Math.min(1, rate));
  if (clampedRate === 0) return 0;
  const availableHeight = Math.max(0, editorHeight - lineHeight - Math.max(0, documentPaddingTop) - 0.5);
  return availableHeight * clampedRate;
}
