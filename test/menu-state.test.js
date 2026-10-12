import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getMenuItemStates, getSnippetMenuItemStates, normalizeMultipleReplaceMenuEntries, getMultipleReplaceMenuItemStates } = require('../electron/menu-state.cjs');

const lineCommands = ['menu-sort-lines', 'menu-sort-by-pattern', 'menu-reverse-lines', 'menu-shuffle-lines', 'menu-delete-duplicates'];

test('disables document commands without an open document', () => {
  const states = getMenuItemStates({});
  for (const id of ['menu-save', 'menu-save-as', 'menu-close-document', 'menu-revert', 'menu-reveal-file', 'menu-copy-path', 'menu-find', 'menu-go-to-line', 'menu-select-previous-outline-item', 'menu-select-next-outline-item', 'menu-select-line', 'menu-delete', 'menu-insert-backslash', 'menu-insert-yen-mark', 'menu-insert-unicode-code-point', 'menu-edit-color-code', 'menu-toggle-split', 'menu-close-split', 'menu-focus-next-editor', 'menu-focus-previous-editor', 'menu-stack-editors-vertically', 'menu-prevent-editing', 'menu-orientation-horizontal', 'menu-orientation-vertical', 'menu-writing-direction-ltr', 'menu-writing-direction-rtl', 'menu-toggle-page-guide', 'menu-warnings', 'menu-document-inspector', 'menu-inspect-character', 'menu-advanced-character-count', 'menu-outline', 'menu-replace-text']) {
    assert.equal(states[id].enabled, false, `${id} should be disabled`);
  }
  assert.equal(states['menu-multiple-replace'].enabled, true, 'the definition manager remains available without an open document');
  for (const id of lineCommands) assert.equal(states[id].enabled, false, `${id} should be disabled without a document`);
  assert.equal(states['menu-previous-document'].enabled, false);
  assert.equal(states['menu-next-document'].enabled, false);
  assert.equal(states['menu-jump-to-selection'].enabled, false);
  assert.deepEqual(states['menu-toggle-page-guide'], { enabled: false, checked: false });
  assert.equal(states['menu-print'].enabled, false);
  assert.equal(states['menu-paste-exactly'].enabled, false);
  assert.equal(states['menu-move-line-up'].enabled, false);
  assert.equal(states['menu-indent-to-spaces'].enabled, false);
  assert.equal(states['menu-surround-parentheses'].enabled, false);
  assert.equal(states['menu-select-line'].enabled, false);
  assert.equal(states['menu-url-decode'].enabled, false);
  assert.equal(states['menu-normalize-nfkc'].enabled, false);
  assert.equal(states['menu-normalize-nfkc-casefold'].enabled, false);
  assert.equal(states['menu-surround-custom'].enabled, false);
  assert.equal(states['menu-search-folder'].enabled, true);
  for (const id of ['menu-fullwidth', 'menu-halfwidth', 'menu-fullwidth-roman', 'menu-halfwidth-roman']) {
    assert.equal(states[id].enabled, false, `${id} should be disabled without a selection`);
  }
});

test('dynamic snippet menu items are enabled only for editable documents', () => {
  const ids = ['menu-snippet-demo', 'menu-snippet-other_1', 'menu-snippet-../bad', 'menu-open'];
  assert.deepEqual(getSnippetMenuItemStates(ids, {}), {
    'menu-snippet-demo': { enabled: false },
    'menu-snippet-other_1': { enabled: false }
  });
  assert.deepEqual(getSnippetMenuItemStates(ids, { hasDocument: true }), {
    'menu-snippet-demo': { enabled: true },
    'menu-snippet-other_1': { enabled: true }
  });
  assert.deepEqual(getSnippetMenuItemStates(ids, { hasDocument: true, preventEditing: true }), {
    'menu-snippet-demo': { enabled: false },
    'menu-snippet-other_1': { enabled: false }
  });
});

test('multiple-replace menu definitions are sanitized and only run in editable documents', () => {
  assert.deepEqual(normalizeMultipleReplaceMenuEntries([
    { id: 'definition-1', label: '  Alpha\u0000 Set  ' },
    { id: '../invalid', label: 'Invalid' },
    { id: 'definition-1', label: 'Duplicate ID' },
    { id: 'empty-label', label: '\u0000  ' },
    null
  ]), [{ id: 'definition-1', label: 'Alpha Set' }]);
  assert.deepEqual(getMultipleReplaceMenuItemStates([
    'menu-multiple-replace-run-definition-1',
    'menu-multiple-replace-run-../invalid',
    'menu-open'
  ], {}), { 'menu-multiple-replace-run-definition-1': { enabled: false } });
  assert.deepEqual(getMultipleReplaceMenuItemStates(['menu-multiple-replace-run-definition-1'], { hasDocument: true }), {
    'menu-multiple-replace-run-definition-1': { enabled: true }
  });
  assert.deepEqual(getMultipleReplaceMenuItemStates(['menu-multiple-replace-run-definition-1'], { hasDocument: true, preventEditing: true }), {
    'menu-multiple-replace-run-definition-1': { enabled: false }
  });
});

test('tracks document, selection and history capabilities', () => {
  const states = getMenuItemStates({
    hasDocument: true, hasSelection: false, canSave: true, canUndo: true, canRedo: false,
    hasSearchQuery: true, hasSearchHighlights: true, saveableDocumentCount: 2, documentCount: 2, alwaysOnTop: true
  });
  for (const id of lineCommands) assert.equal(states[id].enabled, true, `${id} should be enabled for an open document`);
  assert.equal(states['menu-save'].enabled, true);
  assert.equal(states['menu-print'].enabled, true);
  assert.equal(states['menu-paste-exactly'].enabled, true);
  assert.equal(states['menu-delete'].enabled, true);
  assert.equal(states['menu-edit-color-code'].enabled, true);
  assert.equal(states['menu-normalize-nfkc-casefold'].enabled, true);
  assert.equal(states['menu-warnings'].enabled, true);
  assert.equal(states['menu-document-inspector'].enabled, true);
  assert.equal(states['menu-inspect-character'].enabled, false);
  assert.equal(states['menu-outline'].enabled, true);
  assert.equal(states['menu-select-previous-outline-item'].enabled, true);
  assert.equal(states['menu-select-next-outline-item'].enabled, true);
  assert.deepEqual(states['menu-keep-on-top'], { enabled: true, checked: true });
  assert.equal(states['menu-folder-browser'].enabled, true);
  assert.equal(states['menu-folder-find'].enabled, true);
  assert.equal(states['menu-move-line-up'].enabled, true);
  assert.equal(states['menu-move-line-down'].enabled, true);
  assert.equal(states['menu-undo'].enabled, true);
  for (const id of ['menu-inline-comment', 'menu-block-comment', 'menu-uncomment']) assert.equal(states[id].enabled, true);
  assert.equal(states['menu-redo'].enabled, false);
  assert.equal(states['menu-find-next'].enabled, true);
  assert.equal(states['menu-multiple-replace'].enabled, true);
  assert.equal(states['menu-highlight-all'].enabled, true);
  assert.equal(states['menu-remove-highlights'].enabled, true);
  assert.equal(states['menu-jump-to-selection'].enabled, false);
  assert.equal(states['menu-save-all'].enabled, true);
  assert.equal(states['menu-split-selection-lines'].enabled, false);
  assert.equal(states['menu-indent-to-spaces'].enabled, true);
  assert.equal(states['menu-surround-parentheses'].enabled, false);
  assert.equal(states['menu-previous-document'].enabled, true);
});

test('Replace Text requires editable selected text and at least one enabled local rule', () => {
  assert.equal(getMenuItemStates({ hasDocument: true, hasAnySelection: true })['menu-replace-text'].enabled, false);
  assert.equal(getMenuItemStates({ hasDocument: true, hasAnySelection: true, hasTextReplacements: true })['menu-replace-text'].enabled, true);
  assert.equal(getMenuItemStates({ hasDocument: true, hasTextReplacements: true })['menu-replace-text'].enabled, false);
  assert.equal(getMenuItemStates({ hasDocument: true, preventEditing: true, hasAnySelection: true, hasTextReplacements: true })['menu-replace-text'].enabled, false);
});

test('enables Inspect Character only when the renderer reports a single grapheme selection', () => {
  assert.equal(getMenuItemStates({ hasDocument: true, canInspectCharacter: false })['menu-inspect-character'].enabled, false);
  assert.equal(getMenuItemStates({ hasDocument: true, canInspectCharacter: true })['menu-inspect-character'].enabled, true);
  assert.equal(getMenuItemStates({ hasDocument: false, canInspectCharacter: true })['menu-inspect-character'].enabled, false);
});

test('advanced character count menu switches between its start and stop labels', () => {
  assert.deepEqual(getMenuItemStates({})['menu-advanced-character-count'], { enabled: false, label: '高级字符计数…' });
  assert.deepEqual(getMenuItemStates({ hasDocument: true })['menu-advanced-character-count'], { enabled: true, label: '高级字符计数…' });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, advancedCountActive: true })['menu-advanced-character-count'], { enabled: true, label: '停止高级字符计数' });
});

test('Prevent Editing disables mutation commands while preserving read-only workflows', () => {
  const states = getMenuItemStates({
    hasDocument: true, preventEditing: true, dirty: true, canSave: true, canUndo: true, canRedo: true,
    hasSelection: true, hasSearchQuery: true, hasSearchHighlights: true
  });
  for (const id of [
    'menu-revert', 'menu-paste-exactly', 'menu-undo', 'menu-redo', 'menu-replace-next', 'menu-replace-all',
    'menu-use-selection-for-replace', 'menu-delete', 'menu-insert-backslash', 'menu-insert-yen-mark', 'menu-insert-unicode-code-point', 'menu-edit-color-code', 'menu-duplicate-line', 'menu-move-line-up', 'menu-join-current-lines',
    'menu-indent-more', 'menu-toggle-comment', 'menu-inline-comment', 'menu-block-comment', 'menu-uncomment', 'menu-uppercase', 'menu-normalize-nfkc-casefold', 'menu-surround-parentheses', 'menu-sort-lines'
  ]) assert.equal(states[id].enabled, false, `${id} must not modify a protected document`);
  assert.deepEqual(states['menu-prevent-editing'], { enabled: true, checked: true });
  for (const id of ['menu-save', 'menu-print', 'menu-find', 'menu-find-next', 'menu-highlight-all', 'menu-use-selection-for-find', 'menu-select-word', 'menu-jump-to-selection']) {
    assert.equal(states[id].enabled, true, `${id} should remain available for a protected document`);
  }
});

test('synchronizes menu checkmarks with editor view and writing direction', () => {
  const states = getMenuItemStates({ hasDocument: true, hasOutlineItems: true, wrap: true, showLineNumbers: false, splitEnabled: true, splitEditorsVertically: true, verticalText: true, writingDirection: 'rtl', showPageGuide: true, showTabBar: false, showToolbar: false, showNavigationBar: false });
  assert.deepEqual(states['menu-toggle-wrap'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-toggle-line-numbers'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-toggle-split'], { enabled: true, checked: true });
  assert.equal(states['menu-focus-next-editor'].enabled, true);
  assert.equal(states['menu-focus-previous-editor'].enabled, true);
  assert.equal(states['menu-close-split'].enabled, true);
  assert.deepEqual(states['menu-orientation-horizontal'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-orientation-vertical'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-writing-direction-ltr'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-writing-direction-rtl'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-toggle-page-guide'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-toggle-tab-bar'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-toggle-toolbar'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-toggle-navigation-bar'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-open-outline-menu'], { enabled: true });
  assert.deepEqual(states['menu-stack-editors-vertically'], { enabled: true, checked: true });
});

test('navigation, tab and toolbar visibility remain available without a document; outline menu and split orientation do not', () => {
  const states = getMenuItemStates({});
  assert.deepEqual(states['menu-toggle-tab-bar'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-toggle-toolbar'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-toggle-navigation-bar'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-open-outline-menu'], { enabled: false });
  assert.deepEqual(states['menu-stack-editors-vertically'], { enabled: false, checked: false });
  assert.equal(states['menu-close-split'].enabled, false);
});

test('Use Spaces for Indentation remains a global menu preference and reflects its setting', () => {
  assert.deepEqual(getMenuItemStates({})['menu-auto-expand-tab'], { enabled: true, checked: false });
  assert.deepEqual(getMenuItemStates({ autoExpandTab: true })['menu-auto-expand-tab'], { enabled: true, checked: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, autoExpandTab: false })['menu-auto-expand-tab'], { enabled: true, checked: false });
});

test('per-syntax indentation can follow the global setting when no language override exists', () => {
  assert.deepEqual(getMenuItemStates({})['menu-indent-width-global'], { enabled: false, checked: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasIndentOverride: false })['menu-indent-width-global'], { enabled: true, checked: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasIndentOverride: true })['menu-indent-width-global'], { enabled: true, checked: false });
});

test('recovery drafts menu is enabled only when unclaimed drafts exist', () => {
  assert.deepEqual(getMenuItemStates({})['menu-recover-drafts'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ recoveryDraftCount: 0 })['menu-recover-drafts'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ recoveryDraftCount: 2 })['menu-recover-drafts'], { enabled: true });
  assert.deepEqual(getMenuItemStates({ recoveryDraftCount: '2' })['menu-recover-drafts'], { enabled: false });
});

test('tracks reversible file actions and display preference checkmarks', () => {
  const states = getMenuItemStates({
    hasDocument: true, dirty: true, hasPath: true, showInvisibles: true,
    showIndentGuides: false, showSidebar: false, showStatusBar: true, verticalText: true
  });
  assert.equal(states['menu-revert'].enabled, true);
  assert.equal(states['menu-reveal-file'].enabled, true);
  assert.equal(states['menu-copy-path'].enabled, true);
  assert.deepEqual(states['menu-toggle-invisibles'], { enabled: true, checked: true });
  assert.deepEqual(states['menu-toggle-indent-guides'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-toggle-sidebar'], { enabled: true, checked: false });
  assert.deepEqual(states['menu-toggle-status-bar'], { enabled: true, checked: true });
});

test('tracks the global font ligature preference in the Format menu', () => {
  assert.deepEqual(getMenuItemStates({})['menu-toggle-ligatures'], { enabled: true, checked: true });
  assert.deepEqual(getMenuItemStates({ ligatures: false })['menu-toggle-ligatures'], { enabled: true, checked: false });
  assert.deepEqual(getMenuItemStates({ ligatures: true })['menu-toggle-ligatures'], { enabled: true, checked: true });
});

test('Format Font Type menu checks exactly the selected standard or monospaced mode', () => {
  const defaults = getMenuItemStates({});
  assert.deepEqual(defaults['menu-font-type-standard'], { enabled: true, checked: false });
  assert.deepEqual(defaults['menu-font-type-monospaced'], { enabled: true, checked: true });
  const standard = getMenuItemStates({ fontType: 'standard' });
  assert.deepEqual(standard['menu-font-type-standard'], { enabled: true, checked: true });
  assert.deepEqual(standard['menu-font-type-monospaced'], { enabled: true, checked: false });
  const monospaced = getMenuItemStates({ fontType: 'monospaced' });
  assert.deepEqual(monospaced['menu-font-type-standard'], { enabled: true, checked: false });
  assert.deepEqual(monospaced['menu-font-type-monospaced'], { enabled: true, checked: true });
});

test('remote document paths can be copied but are not treated as local reveal targets', () => {
  const states = getMenuItemStates({ hasDocument: true, hasRemotePath: true });
  assert.equal(states['menu-copy-path'].enabled, true);
  assert.equal(states['menu-reveal-file'].enabled, false);
});

test('enables selection-based find and replace only for a nonempty selection', () => {
  const empty = getMenuItemStates({ hasDocument: true, hasSelection: false, hasSearchQuery: false });
  assert.equal(empty['menu-use-selection-for-find'].enabled, false);
  assert.equal(empty['menu-use-selection-for-replace'].enabled, false);
  assert.equal(empty['menu-find-all'].enabled, false);
  assert.equal(empty['menu-select-all-find-matches'].enabled, false);
  assert.equal(empty['menu-highlight-all'].enabled, false);
  assert.equal(empty['menu-remove-highlights'].enabled, false);
  const ready = getMenuItemStates({ hasDocument: true, hasSelection: true, hasSearchQuery: true });
  assert.equal(ready['menu-use-selection-for-find'].enabled, true);
  assert.equal(ready['menu-use-selection-for-replace'].enabled, true);
  assert.equal(ready['menu-find-all'].enabled, true);
  assert.equal(ready['menu-select-all-find-matches'].enabled, true);
  assert.equal(ready['menu-replace-all'].enabled, true);
  for (const id of ['menu-surround-single-quotes', 'menu-surround-double-quotes', 'menu-surround-parentheses', 'menu-surround-braces', 'menu-surround-brackets', 'menu-surround-custom']) {
    assert.equal(ready[id].enabled, true, `${id} should be enabled for a selection`);
  }
  for (const id of ['menu-capitalize', 'menu-url-encode', 'menu-url-decode', 'menu-normalize-nfc', 'menu-normalize-nfd', 'menu-normalize-nfkc', 'menu-normalize-nfkd', 'menu-normalize-modified-nfd', 'menu-normalize-modified-nfc', 'menu-fullwidth', 'menu-halfwidth', 'menu-fullwidth-roman', 'menu-halfwidth-roman']) {
    assert.equal(ready[id].enabled, true, `${id} should be enabled for a selection`);
  }
});

test('enables document-only and selection-only menu commands from their required state', () => {
  const empty = getMenuItemStates({});
  for (const id of ['menu-select-word', 'menu-select-enclosing-symbols', 'menu-join-lines']) {
    assert.equal(empty[id].enabled, false, `${id} should be disabled without a document`);
  }
  const caret = getMenuItemStates({ hasDocument: true, hasSelection: false });
  assert.equal(caret['menu-select-word'].enabled, true);
  assert.equal(caret['menu-select-enclosing-symbols'].enabled, true);
  assert.equal(caret['menu-join-lines'].enabled, false);
  const selection = getMenuItemStates({ hasDocument: true, hasSelection: true });
  assert.equal(selection['menu-jump-to-selection'].enabled, true);
  assert.equal(selection['menu-join-lines'].enabled, true);
});

test('enables text transformations at a caret and limits the BOM toggle to UTF-8 documents', () => {
  const caret = getMenuItemStates({ hasDocument: true, hasSelection: false, encoding: 'utf8', bom: false });
  for (const id of ['menu-uppercase', 'menu-lowercase', 'menu-capitalize', 'menu-url-encode', 'menu-url-decode', 'menu-normalize-nfc', 'menu-normalize-nfd', 'menu-normalize-nfkc', 'menu-normalize-nfkd', 'menu-normalize-modified-nfd', 'menu-normalize-modified-nfc', 'menu-fullwidth', 'menu-halfwidth', 'menu-fullwidth-roman', 'menu-halfwidth-roman']) {
    assert.equal(caret[id].enabled, true, `${id} should support the word at a caret`);
  }
  assert.deepEqual(caret['menu-toggle-utf8-bom'], { enabled: true, checked: false });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, encoding: 'utf8', bom: true })['menu-toggle-utf8-bom'], { enabled: true, checked: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, encoding: 'utf16le', bom: true })['menu-toggle-utf8-bom'], { enabled: false, checked: false });
  assert.equal(getMenuItemStates({ hasDocument: true, preventEditing: true, encoding: 'utf8' })['menu-toggle-utf8-bom'].enabled, true);
});

test('enables Copy as Rich Text only when a nonempty editor selection exists', () => {
  assert.deepEqual(getMenuItemStates({})['menu-copy-as-rich-text'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasSelection: false })['menu-copy-as-rich-text'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasSelection: false, hasRichTextSelection: true })['menu-copy-as-rich-text'], { enabled: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasSelection: true })['menu-copy-as-rich-text'], { enabled: true });
});

test('enables selection-required text transformation for a non-primary selection', () => {
  const states = getMenuItemStates({ hasDocument: true, hasSelection: false, hasAnySelection: true });
  assert.equal(states['menu-join-lines'].enabled, true);
  assert.equal(states['menu-jump-to-selection'].enabled, false, 'primary-selection-only commands retain their existing state');
  assert.equal(states['menu-use-selection-for-find'].enabled, false, 'existing selection commands are not broadened implicitly');
});

test('Toggle Comment menu label reflects whether the renderer can fully uncomment selected lines', () => {
  assert.deepEqual(getMenuItemStates({})['menu-toggle-comment'], {
    enabled: false,
    label: '注释掉'
  });
  assert.deepEqual(getMenuItemStates({
    hasDocument: true,
    toggleCommentUncommentable: true
  })['menu-toggle-comment'], {
    enabled: true,
    label: '取消注释'
  });
  assert.deepEqual(getMenuItemStates({
    hasDocument: true,
    preventEditing: true,
    toggleCommentUncommentable: true
  })['menu-toggle-comment'], {
    enabled: false,
    label: '取消注释'
  }, 'read-only documents keep the contextual label but disable the command');
  assert.equal(getMenuItemStates({
    hasDocument: true,
    toggleCommentUncommentable: 'true'
  })['menu-toggle-comment'].label, '注释掉',
  'non-boolean renderer values cannot change the native menu label');
});

test('Comment Out selection is enabled only for an editable open document', () => {
  assert.equal(getMenuItemStates({})['menu-comment-out'].enabled, false);
  assert.equal(getMenuItemStates({ hasDocument: true })['menu-comment-out'].enabled, true);
  assert.equal(getMenuItemStates({ hasDocument: true, preventEditing: true })['menu-comment-out'].enabled, false);
});
