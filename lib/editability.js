import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** Keep editor input and programmatic document changes read-only in lock mode. */
export function editabilityExtensions(preventEditing = false) {
  const locked = preventEditing === true;
  return [
    EditorState.readOnly.of(locked),
    EditorView.editable.of(!locked),
    EditorState.changeFilter.of(transaction => !locked || !transaction.docChanged)
  ];
}
