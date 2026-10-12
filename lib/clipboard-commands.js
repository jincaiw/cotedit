export function pasteExactText(view, text) {
  if (!view?.state || typeof text !== 'string' || text.length === 0) return false;
  const spec = view.state.replaceSelection(text);
  view.dispatch({ ...spec, userEvent: 'input.paste', scrollIntoView: true });
  view.focus();
  return true;
}
