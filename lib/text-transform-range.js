import { EditorSelection } from '@codemirror/state';

/**
 * Resolve the text range a CotEditor-style transformation should operate on.
 * With a selection, preserve the exact selected range. Without one, transform
 * the word at the caret using the active CodeMirror language's word rules.
 */
export function textTransformationRange(state, selection = state?.selection?.main) {
  if (!selection) return null;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  const word = state.wordAt(selection.head);
  return word ? { from: word.from, to: word.to } : null;
}

/**
 * Build one atomic transformation transaction for every selection range.
 * When text is selected, transform all nonempty selections and leave secondary
 * empty cursors mapped in place. With only cursors, transform the word at each
 * cursor. Duplicate cursor targets in the same word are applied only once.
 */
export function textTransformationTransaction(state, transform, { selectionRequired = false } = {}) {
  const selections = state?.selection?.ranges;
  if (!Array.isArray(selections) || !selections.length || typeof transform !== 'function') return null;

  const hasSelectedText = selections.some(range => !range.empty);
  if (selectionRequired && !hasSelectedText) return null;

  const targets = selections.map(selection => {
    if (!selection.empty) return { from: selection.from, to: selection.to };
    if (hasSelectedText) return null;
    return textTransformationRange(state, selection);
  });
  if (!targets.some(Boolean)) return null;

  const appliedTargets = new Set();
  let index = 0;
  return state.changeByRange(range => {
    const target = targets[index++];
    if (!target) return { range };

    const key = `${target.from}:${target.to}`;
    if (appliedTargets.has(key)) return { range };
    appliedTargets.add(key);

    const original = state.doc.sliceString(target.from, target.to);
    const replacement = transform(original);
    if (typeof replacement !== 'string') throw new TypeError('Text transformations must return a string.');

    const reversed = !range.empty && range.anchor > range.head;
    const newFrom = target.from;
    const newTo = newFrom + replacement.length;
    return {
      ...(replacement === original ? {} : { changes: { from: target.from, to: target.to, insert: replacement } }),
      range: EditorSelection.range(reversed ? newTo : newFrom, reversed ? newFrom : newTo)
    };
  });
}
