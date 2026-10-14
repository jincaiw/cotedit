import { ChangeSet, EditorState, Transaction } from '@codemirror/state';

function withAdditionalChanges(transaction, changes, selection) {
  if (!changes.length) return transaction;
  const additional = ChangeSet.of(changes, transaction.newDoc.length);
  return {
    changes: transaction.changes.compose(additional),
    selection: selection ?? transaction.newSelection.map(additional),
    effects: transaction.effects.flatMap(effect => {
      const mapped = effect.map(additional);
      return mapped ? [mapped] : [];
    }),
    annotations: [Transaction.time, Transaction.userEvent, Transaction.addToHistory, Transaction.remote]
      .flatMap(annotation => {
        const value = transaction.annotation(annotation);
        return value === undefined ? [] : [annotation.of(value)];
      }),
    scrollIntoView: transaction.scrollIntoView
  };
}

function previousCharacter(document, position) {
  if (position <= 0) return '';
  const codePoint = document.sliceString(Math.max(0, position - 2), position);
  return Array.from(codePoint).at(-1) || '';
}

function quoteReplacement(document, position, quote) {
  const previous = previousCharacter(document, position);
  const closing = /[\p{L}\p{N}’”)]/u.test(previous);
  if (quote === '"') return closing ? '”' : '“';
  return closing ? '’' : '‘';
}

function textReplacementChange(transaction, range, rules) {
  const inserted = transaction.newDoc.sliceString(range.fromB, range.toB);
  const delimiter = inserted.match(/[\s.,!?;:)\]}]$/u)?.[0];
  if (!delimiter) return null;
  const triggerEnd = range.toB - delimiter.length;
  const ordered = rules.filter(rule => rule.enabled && rule.automatic)
    .slice()
    .sort((left, right) => right.trigger.length - left.trigger.length);
  for (const rule of ordered) {
    const start = triggerEnd - rule.trigger.length;
    if (start < 0 || transaction.newDoc.sliceString(start, triggerEnd) !== rule.trigger) continue;
    const previous = previousCharacter(transaction.newDoc, start);
    if (/[\p{L}\p{N}_]/u.test(previous) && /^[\p{L}\p{N}_]/u.test(rule.trigger)) continue;
    return { from: start, to: triggerEnd, insert: rule.replacement };
  }
  return null;
}

/** Apply opt-in smart punctuation and automatic literal replacements in the typing transaction. */
export function automaticSubstitutionsExtension(getOptions) {
  return EditorState.transactionFilter.of(transaction => {
    if (!transaction.docChanged || !transaction.isUserEvent('input.type')
        || transaction.startState.selection.ranges.length !== 1
        || !transaction.startState.selection.main.empty
        || transaction.newSelection.ranges.length !== 1
        || !transaction.newSelection.main.empty) return transaction;
    const ranges = [];
    transaction.changes.iterChangedRanges((fromA, toA, fromB, toB) => ranges.push({ fromA, toA, fromB, toB }));
    if (ranges.length !== 1) return transaction;
    const range = ranges[0];
    const options = typeof getOptions === 'function' ? getOptions() : {};
    const inserted = transaction.newDoc.sliceString(range.fromB, range.toB);
    const cursor = transaction.newSelection.main.head;
    let change = null;
    let selectionOverride;
    if (options.smartQuotes === true && (inserted === '"' || inserted === "'")) {
      change = { from: range.fromB, to: range.toB, insert: quoteReplacement(transaction.newDoc, range.fromB, inserted) };
    } else if (options.smartQuotes === true && (inserted === '""' || inserted === "''") && cursor === range.fromB + 1) {
      change = { from: range.fromB, to: range.toB, insert: inserted === '""' ? '“”' : '‘’' };
      selectionOverride = { anchor: range.fromB + 1 };
    } else if (cursor !== range.toB) {
      return transaction;
    } else if (options.smartDashes === true && inserted === '-' && range.fromB > 0
        && transaction.newDoc.sliceString(range.fromB - 1, range.fromB) === '-') {
      change = { from: range.fromB - 1, to: range.toB, insert: '—' };
    } else if (options.automaticPeriodSubstitution === true && inserted === ' ' && cursor === range.toB
        && range.fromB > 0 && transaction.newDoc.sliceString(range.fromB - 1, range.fromB) === ' '
        && /[\p{L}\p{N}"'’”)}\]]/u.test(previousCharacter(transaction.newDoc, range.fromB - 1))) {
      change = { from: range.fromB - 1, to: range.fromB, insert: '.' };
    } else if (options.textReplacement === true) {
      change = textReplacementChange(transaction, range, Array.isArray(options.rules) ? options.rules : []);
    }
    return change ? withAdditionalChanges(transaction, [change], selectionOverride) : transaction;
  });
}
