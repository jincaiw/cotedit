import { indentLess, indentMore } from '@codemirror/commands';

/**
 * Route Tab/Shift-Tab on a non-empty selection to whole-line indentation when
 * the user preference is enabled. CotEditor leaves Tab's normal replacement
 * behavior intact when disabled, while Shift-Tab does not indent a selection.
 *
 * @param {object} view CodeMirror EditorView-like object.
 * @param {boolean} enabled Whether selected-line indentation is enabled.
 * @param {boolean} reverse Whether this is the Shift-Tab (outdent) action.
 * @returns {boolean} Whether the key was handled by this helper.
 */
export function handleSelectedLinesTab(view, enabled, reverse = false) {
  const hasTextSelection = view?.state?.selection?.ranges?.some(range => !range.empty) === true;
  if (!hasTextSelection) return false;

  if (!enabled) return reverse;

  (reverse ? indentLess : indentMore)(view);
  return true;
}
