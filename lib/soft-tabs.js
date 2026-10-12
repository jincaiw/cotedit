import { countColumn, EditorSelection } from '@codemirror/state';

function validTabWidth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 99;
}

function spacesToNextTabStop(state, position, tabWidth) {
  const line = state.doc.lineAt(position);
  const prefix = state.doc.sliceString(line.from, position);
  const column = countColumn(prefix, tabWidth);
  return ' '.repeat(tabWidth - column % tabWidth);
}

/** Insert spaces to the next logical tab stop at every cursor/selection. */
export function insertSoftTab(view, tabWidth = 4) {
  if (!view?.state || !validTabWidth(tabWidth)) return false;
  const state = view.state;
  const transaction = state.changeByRange(range => {
    const insert = spacesToNextTabStop(state, range.from, tabWidth);
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length)
    };
  });
  view.dispatch(state.update({
    changes: transaction.changes,
    selection: transaction.selection,
    userEvent: 'input.type'
  }));
  return true;
}

/** Delete the preceding soft-tab run; return false to let the default keymap handle other cases. */
export function deleteSoftTab(view, tabWidth = 4) {
  if (!view?.state || !validTabWidth(tabWidth)) return false;
  const state = view.state;
  const deletionWidths = state.selection.ranges.map(range => {
    if (!range.empty) return null;
    const line = state.doc.lineAt(range.head);
    const prefix = state.doc.sliceString(line.from, range.head);
    const trailingSpaces = / +$/u.exec(prefix)?.[0].length || 0;
    if (!trailingSpaces) return null;
    const column = countColumn(prefix, tabWidth);
    const previousStopWidth = column % tabWidth || tabWidth;
    return Math.min(trailingSpaces, previousStopWidth);
  });
  if (!deletionWidths.length || deletionWidths.some(width => !width)) return false;

  let rangeIndex = 0;
  const transaction = state.changeByRange(range => {
    const width = deletionWidths[rangeIndex++];
    return {
      changes: { from: range.head - width, to: range.head, insert: '' },
      range: EditorSelection.cursor(range.head - width)
    };
  });
  view.dispatch(state.update({
    changes: transaction.changes,
    selection: transaction.selection,
    userEvent: 'delete.backward'
  }));
  return true;
}
