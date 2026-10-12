/**
 * Resolve a screen point through the browser's writing-mode-aware caret API,
 * then map the resulting DOM position back to the editor document.
 */
export function verticalTextPositionAtPoint(view, x, y, documentObject = globalThis.document) {
  if (!view?.contentDOM || !documentObject) return null;
  let node;
  let offset;
  try {
    const caret = documentObject.caretPositionFromPoint?.(x, y);
    if (caret) {
      node = caret.offsetNode;
      offset = caret.offset;
    } else {
      const range = documentObject.caretRangeFromPoint?.(x, y);
      node = range?.startContainer;
      offset = range?.startOffset;
    }
    if (!node || !view.contentDOM.contains(node)) return null;
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element?.closest?.('.cm-line')) return null;
    const position = view.posAtDOM(node, offset);
    return Number.isInteger(position) ? position : null;
  } catch {
    return null;
  }
}
