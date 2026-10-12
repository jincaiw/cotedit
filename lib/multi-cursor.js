import { EditorSelection } from '@codemirror/state';

/** Collapse a multi-cursor insertion-point selection to its first document-order cursor. */
export function collapseMultipleInsertionPoints(view) {
  const selection = view?.state?.selection;
  const ranges = selection?.ranges;
  if (!Array.isArray(ranges) || ranges.length < 2) return false;
  if (ranges.some(range => !range?.empty || !Number.isSafeInteger(range.head))) return false;

  view.dispatch({
    selection: EditorSelection.cursor(ranges[0].head),
    userEvent: 'select'
  });
  return true;
}
