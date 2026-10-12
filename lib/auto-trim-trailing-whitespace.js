import { ChangeSet, EditorState, Transaction } from '@codemirror/state';
import { trailingWhitespaceChanges } from './text-tools.js';

function changedLineRanges(transaction) {
  const ranges = [];
  const doc = transaction.newDoc;
  transaction.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    const startLine = doc.lineAt(fromB).number;
    const endLine = doc.lineAt(toB).number;
    ranges.push([startLine, endLine]);
  });
  return ranges;
}

/** Trim trailing spaces/tabs on edited lines as part of the same undoable transaction. */
export function automaticTrailingWhitespaceExtension(getPreferences) {
  return EditorState.transactionFilter.of(transaction => {
    if (!transaction.docChanged || transaction.isUserEvent('undo') || transaction.isUserEvent('redo')
        || transaction.annotation(Transaction.remote) === true) return transaction;
    if (!transaction.isUserEvent('input') && !transaction.isUserEvent('delete') && !transaction.isUserEvent('move')) return transaction;

    const preferences = typeof getPreferences === 'function' ? getPreferences() : null;
    if (!preferences || preferences.autoTrimsTrailingWhitespace !== true) return transaction;

    const changes = trailingWhitespaceChanges(transaction.newDoc, {
      lineRanges: changedLineRanges(transaction),
      includeWhitespaceOnlyLines: preferences.trimsWhitespaceOnlyLines === true
    });
    if (!changes.length) return transaction;

    const trimmingChanges = ChangeSet.of(changes, transaction.newDoc.length);
    const annotations = [];
    for (const annotationType of [Transaction.time, Transaction.userEvent, Transaction.addToHistory, Transaction.remote]) {
      const value = transaction.annotation(annotationType);
      if (value !== undefined) annotations.push(annotationType.of(value));
    }

    return {
      changes: transaction.changes.compose(trimmingChanges),
      selection: transaction.newSelection.map(trimmingChanges),
      effects: transaction.effects.flatMap(effect => {
        const mapped = effect.map(trimmingChanges);
        return mapped ? [mapped] : [];
      }),
      annotations,
      scrollIntoView: transaction.scrollIntoView
    };
  });
}
