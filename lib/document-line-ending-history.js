import { EditorState, Facet, StateEffect, StateField } from '@codemirror/state';
import { invertedEffects } from '@codemirror/commands';
import { mapLineEndings } from './text-tools.js';

const initialLineEndings = Facet.define({ combine: values => values.at(-1) || [] });
const initialFallbackLineEnding = Facet.define({ combine: values => values.at(-1) || 'LF' });

export const setDocumentLineEndings = StateEffect.define();
export const setDocumentLineEndingFallback = StateEffect.define();
const fallbackLineEnding = StateField.define({
  create: state => state.facet(initialFallbackLineEnding),
  update(value, transaction) {
    for (let index = transaction.effects.length - 1; index >= 0; index--) {
      const effect = transaction.effects[index];
      if (effect.is(setDocumentLineEndingFallback)) return effect.value;
    }
    return value;
  }
});
export const documentLineEndingsField = StateField.define({
  create: state => [...state.facet(initialLineEndings)],
  update(value, transaction) {
    for (let index = transaction.effects.length - 1; index >= 0; index--) {
      const effect = transaction.effects[index];
      if (effect.is(setDocumentLineEndings)) return [...effect.value];
    }
    if (!transaction.docChanged) return value;
    return mapLineEndings(
      transaction.changes,
      transaction.startState.doc.toString(),
      transaction.newDoc.toString(),
      value,
      transaction.startState.field(fallbackLineEnding)
    );
  }
});

/** Keep line-ending metadata inside CodeMirror history so undo/redo restores exact separators. */
export function documentLineEndingExtensions(lineEndings = [], fallback = 'LF') {
  return [
    initialLineEndings.of(Array.isArray(lineEndings) ? [...lineEndings] : []),
    initialFallbackLineEnding.of(typeof fallback === 'string' ? fallback : 'LF'),
    fallbackLineEnding,
    documentLineEndingsField,
    invertedEffects.of(transaction => {
      const effects = [];
      for (const effect of transaction.effects) {
        if (effect.is(setDocumentLineEndings)) effects.push(setDocumentLineEndings.of(transaction.startState.field(documentLineEndingsField)));
        if (effect.is(setDocumentLineEndingFallback)) effects.push(setDocumentLineEndingFallback.of(transaction.startState.field(fallbackLineEnding)));
      }
      return effects;
    }),
    EditorState.transactionExtender.of(transaction => {
      if (!transaction.docChanged || transaction.effects.some(effect => effect.is(setDocumentLineEndings))) return null;
      const current = transaction.startState.field(documentLineEndingsField);
      const next = mapLineEndings(
        transaction.changes,
        transaction.startState.doc.toString(),
        transaction.newDoc.toString(),
        current,
        transaction.startState.field(fallbackLineEnding)
      );
      return { effects: setDocumentLineEndings.of(next) };
    })
  ];
}

function sameLineEndings(left, right) {
  return left === right || (Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((ending, index) => ending === right[index]));
}

/** Synchronize document-model metadata after edits and metadata-only history transactions. */
export function synchronizeDocumentLineEndingMetadata(document, update) {
  if (!document || !update?.startState || !update?.state) return false;
  const lineEndings = update.state.field(documentLineEndingsField);
  const previousLineEndings = update.startState.field(documentLineEndingsField);
  const fallback = update.state.field(fallbackLineEnding);
  const previousFallback = update.startState.field(fallbackLineEnding);
  const lineEndingsChanged = !sameLineEndings(lineEndings, previousLineEndings);
  const fallbackChanged = fallback !== previousFallback;
  if (lineEndingsChanged) document.lineEndings = [...lineEndings];
  if (fallbackChanged) document.eol = fallback;
  return lineEndingsChanged || fallbackChanged;
}
