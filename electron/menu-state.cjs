'use strict';

/**
 * Compute native menu enabled/checked state from the editor state snapshot.
 * Kept pure so menu behavior can be covered without launching Electron.
 */
function getMenuItemStates(payload = {}) {
  const hasDocument = payload.hasDocument === true;
  const canEdit = hasDocument && payload.preventEditing !== true;
  const hasSelection = payload.hasSelection === true;
  const hasAnySelection = payload.hasAnySelection === true || hasSelection;
  const hasRichTextSelection = payload.hasRichTextSelection === true || hasSelection;
  const toggleCommentUncommentable = payload.toggleCommentUncommentable === true;
  const hasSearchQuery = payload.hasSearchQuery === true;
  const documentCount = Number.isInteger(payload.documentCount) ? Math.max(0, payload.documentCount) : 0;
  const saveableDocumentCount = Number.isInteger(payload.saveableDocumentCount) ? Math.max(0, payload.saveableDocumentCount) : 0;
  return {
    'menu-save': { enabled: hasDocument && payload.canSave === true },
    'menu-save-as': { enabled: hasDocument },
    'menu-save-all': { enabled: saveableDocumentCount > 0 },
    'menu-close-document': { enabled: hasDocument },
    'menu-revert': { enabled: canEdit && payload.dirty === true },
    'menu-reveal-file': { enabled: hasDocument && payload.hasPath === true },
    'menu-copy-path': { enabled: hasDocument && (payload.hasPath === true || payload.hasRemotePath === true) },
    'menu-recover-drafts': { enabled: Number.isInteger(payload.recoveryDraftCount) && payload.recoveryDraftCount > 0 },
    'menu-print': { enabled: hasDocument },
    'menu-copy-as-rich-text': { enabled: hasDocument && hasRichTextSelection },
    'menu-paste-exactly': { enabled: canEdit },
    'menu-toggle-spelling': { enabled: hasDocument, checked: payload.continuousSpellChecking === true },
    'menu-spelling-panel': { enabled: false },
    'menu-check-spelling-now': { enabled: false },
    'menu-toggle-grammar': { enabled: false },
    'menu-toggle-auto-correct': { enabled: false },
    'menu-smart-quotes': { enabled: hasDocument, checked: payload.smartQuotes === true },
    'menu-smart-dashes': { enabled: hasDocument, checked: payload.smartDashes === true },
    'menu-automatic-text-replacement': { enabled: hasDocument, checked: payload.automaticTextReplacement === true },
    'menu-show-substitutions': { enabled: false },
    'menu-smart-copy-paste': { enabled: false },
    'menu-automatic-period': { enabled: false },
    'menu-speech-start': { enabled: hasDocument && payload.speechAvailable === true && payload.hasSpeechText === true },
    'menu-speech-stop': { enabled: hasDocument && payload.speechActive === true },
    'menu-undo': { enabled: canEdit && payload.canUndo === true },
    'menu-redo': { enabled: canEdit && payload.canRedo === true },
    'menu-find': { enabled: hasDocument },
    'menu-multiple-replace': { enabled: true },
    'menu-find-next': { enabled: hasDocument && hasSearchQuery },
    'menu-find-previous': { enabled: hasDocument && hasSearchQuery },
    'menu-find-all': { enabled: hasDocument && hasSearchQuery },
    'menu-select-all-find-matches': { enabled: hasDocument && hasSearchQuery },
    'menu-highlight-all': { enabled: hasDocument && hasSearchQuery },
    'menu-remove-highlights': { enabled: hasDocument && payload.hasSearchHighlights === true },
    'menu-replace': { enabled: hasDocument },
    'menu-replace-next': { enabled: canEdit && hasSearchQuery },
    'menu-replace-all': { enabled: canEdit && hasSearchQuery },
    'menu-use-selection-for-find': { enabled: hasDocument && hasSelection },
    'menu-use-selection-for-replace': { enabled: canEdit && hasSelection },
    'menu-jump-to-selection': { enabled: hasDocument && hasSelection },
    'menu-go-to-line': { enabled: hasDocument },
    'menu-select-previous-outline-item': { enabled: hasDocument },
    'menu-select-next-outline-item': { enabled: hasDocument },
    'menu-select-line': { enabled: hasDocument },
    'menu-select-word': { enabled: hasDocument },
    'menu-select-enclosing-symbols': { enabled: hasDocument },
    'menu-delete': { enabled: canEdit },
    'menu-insert-backslash': { enabled: canEdit },
    'menu-insert-yen-mark': { enabled: canEdit },
    'menu-insert-unicode-code-point': { enabled: canEdit },
    'menu-edit-color-code': { enabled: canEdit },
    'menu-duplicate-line': { enabled: canEdit },
    'menu-delete-line': { enabled: canEdit },
    'menu-move-line-up': { enabled: canEdit },
    'menu-move-line-down': { enabled: canEdit },
    'menu-join-current-lines': { enabled: canEdit },
    'menu-split-selection-lines': { enabled: canEdit && hasSelection },
    'menu-select-column-up': { enabled: hasDocument },
    'menu-select-column-down': { enabled: hasDocument },
    'menu-indent-more': { enabled: canEdit },
    'menu-indent-less': { enabled: canEdit },
    'menu-indent-to-spaces': { enabled: canEdit },
    'menu-indent-to-tabs': { enabled: canEdit },
    'menu-indent-width-custom': { enabled: hasDocument },
    'menu-tab-width-custom': { enabled: true },
    'menu-comment-out': { enabled: canEdit },
    'menu-inline-comment': { enabled: canEdit },
    'menu-block-comment': { enabled: canEdit },
    'menu-uncomment': { enabled: canEdit },
    'menu-complete': { enabled: canEdit },
    'menu-toggle-comment': { enabled: canEdit, label: toggleCommentUncommentable ? '取消注释' : '注释掉' },
    'menu-trim-trailing-whitespace': { enabled: canEdit },
    'menu-uppercase': { enabled: canEdit },
    'menu-lowercase': { enabled: canEdit },
    'menu-capitalize': { enabled: canEdit },
    'menu-replace-quotes': { enabled: canEdit },
    'menu-straighten-quotes': { enabled: canEdit },
    'menu-replace-dashes': { enabled: canEdit && hasAnySelection },
    'menu-replace-text': { enabled: canEdit && hasAnySelection && payload.hasTextReplacements === true },
    'menu-url-encode': { enabled: canEdit },
    'menu-url-decode': { enabled: canEdit },
    'menu-normalize-nfc': { enabled: canEdit },
    'menu-normalize-nfd': { enabled: canEdit },
    'menu-normalize-nfkc': { enabled: canEdit },
    'menu-normalize-nfkd': { enabled: canEdit },
    'menu-normalize-nfkc-casefold': { enabled: canEdit },
    'menu-normalize-modified-nfd': { enabled: canEdit },
    'menu-normalize-modified-nfc': { enabled: canEdit },
    'menu-fullwidth': { enabled: canEdit },
    'menu-halfwidth': { enabled: canEdit },
    'menu-fullwidth-roman': { enabled: canEdit },
    'menu-halfwidth-roman': { enabled: canEdit },
    'menu-surround-single-quotes': { enabled: canEdit && hasSelection },
    'menu-surround-double-quotes': { enabled: canEdit && hasSelection },
    'menu-surround-parentheses': { enabled: canEdit && hasSelection },
    'menu-surround-braces': { enabled: canEdit && hasSelection },
    'menu-surround-brackets': { enabled: canEdit && hasSelection },
    'menu-surround-custom': { enabled: canEdit && hasSelection },
    'menu-sort-lines': { enabled: canEdit },
    'menu-sort-by-pattern': { enabled: canEdit },
    'menu-reverse-lines': { enabled: canEdit },
    'menu-shuffle-lines': { enabled: canEdit },
    'menu-delete-duplicates': { enabled: canEdit },
    'menu-join-lines': { enabled: canEdit && hasAnySelection },
    'menu-reset-syntax': { enabled: hasDocument },
    'menu-show-file-mapping-conflicts': { enabled: payload.hasMappingConflicts === true },
    'menu-toggle-wrap': { enabled: hasDocument, checked: payload.wrap === true },
    'menu-toggle-line-numbers': { enabled: hasDocument, checked: payload.showLineNumbers === true },
    'menu-toggle-invisibles': { enabled: hasDocument, checked: payload.showInvisibles === true },
    'menu-toggle-indent-guides': { enabled: hasDocument, checked: payload.showIndentGuides === true },
    'menu-toggle-page-guide': { enabled: hasDocument, checked: payload.showPageGuide === true },
    'menu-indent-width-global': { enabled: hasDocument, checked: payload.hasIndentOverride !== true },
    'menu-auto-expand-tab': { enabled: true, checked: payload.autoExpandTab === true },
    'menu-toggle-ligatures': { enabled: true, checked: payload.ligatures !== false },
    'menu-font-type-standard': { enabled: true, checked: payload.fontType === 'standard' },
    'menu-font-type-monospaced': { enabled: true, checked: payload.fontType !== 'standard' },
    'menu-toggle-utf8-bom': { enabled: hasDocument && payload.encoding === 'utf8', checked: hasDocument && payload.encoding === 'utf8' && payload.bom === true },
    'menu-toggle-sidebar': { enabled: true, checked: payload.showSidebar !== false },
    'menu-toggle-status-bar': { enabled: true, checked: payload.showStatusBar !== false },
    'menu-toggle-tab-bar': { enabled: true, checked: payload.showTabBar !== false },
    'menu-toggle-toolbar': { enabled: true, checked: payload.showToolbar !== false },
    'menu-toggle-navigation-bar': { enabled: true, checked: payload.showNavigationBar !== false },
    'menu-toggle-split': { enabled: hasDocument, checked: payload.splitEnabled === true },
    'menu-close-split': { enabled: payload.splitEnabled === true },
    'menu-stack-editors-vertically': { enabled: payload.splitEnabled === true, checked: payload.splitEditorsVertically === true },
    'menu-prevent-editing': { enabled: hasDocument, checked: payload.preventEditing === true },
    'menu-orientation-horizontal': { enabled: hasDocument, checked: payload.verticalText !== true },
    'menu-orientation-vertical': { enabled: hasDocument, checked: payload.verticalText === true },
    'menu-writing-direction-ltr': { enabled: hasDocument, checked: payload.writingDirection !== 'rtl' },
    'menu-writing-direction-rtl': { enabled: hasDocument, checked: payload.writingDirection === 'rtl' },
    'menu-focus-next-editor': { enabled: payload.splitEnabled === true },
    'menu-focus-previous-editor': { enabled: payload.splitEnabled === true },
    'menu-toggle-inspector': { enabled: hasDocument, checked: payload.inspectorVisible === true },
    'menu-outline': { enabled: hasDocument },
    'menu-open-outline-menu': { enabled: hasDocument && payload.hasOutlineItems === true },
    'menu-inspect-character': { enabled: hasDocument && payload.canInspectCharacter === true },
    'menu-advanced-character-count': {
      enabled: hasDocument,
      label: payload.advancedCountActive === true ? '停止高级字符计数' : '高级字符计数…'
    },
    'menu-inspector': { enabled: hasDocument },
    'menu-warnings': { enabled: hasDocument },
    'menu-document-inspector': { enabled: hasDocument },
    'menu-folder-browser': { enabled: true },
    'menu-folder-find': { enabled: true },
    'menu-search-folder': { enabled: true },
    'menu-manage-snippets': { enabled: true },
    'menu-keep-on-top': { enabled: true, checked: payload.alwaysOnTop === true },
    'menu-previous-document': { enabled: documentCount > 1 },
    'menu-next-document': { enabled: documentCount > 1 }
  };
}

function getSyntaxMenuItemStates(menuItemIds = [], payload = {}) {
  const hiddenSyntaxes = new Set(
    (Array.isArray(payload.hiddenSyntaxes) ? payload.hiddenSyntaxes : [])
      .filter(id => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,80}$/i.test(id))
      .slice(0, 200)
      .map(id => id.toLowerCase())
  );
  const ids = Array.isArray(menuItemIds) ? [...new Set(menuItemIds)] : [];
  return Object.fromEntries(ids
    .filter(id => typeof id === 'string' && id.startsWith('menu-syntax-'))
    .map(id => {
      const syntaxId = id.slice('menu-syntax-'.length);
      return [id, {
        enabled: payload.hasDocument === true,
        checked: syntaxId === payload.language,
        visible: !hiddenSyntaxes.has(syntaxId)
      }];
    }));
}

function getSnippetMenuItemStates(menuItemIds = [], payload = {}) {
  const enabled = payload.hasDocument === true && payload.preventEditing !== true;
  const ids = Array.isArray(menuItemIds) ? [...new Set(menuItemIds)] : [];
  return Object.fromEntries(ids
    .filter(id => typeof id === 'string' && /^menu-snippet-[a-z0-9][a-z0-9_-]{0,79}$/i.test(id))
    .map(id => [id, { enabled }]));
}

function normalizeMultipleReplaceMenuEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  return entries.slice(0, 100).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(entry.id) || seen.has(entry.id)) return [];
    const label = typeof entry.label === 'string' ? entry.label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 96) : '';
    if (!label) return [];
    seen.add(entry.id);
    return [{ id: entry.id, label }];
  });
}

function getMultipleReplaceMenuItemStates(menuItemIds = [], payload = {}) {
  const enabled = payload.hasDocument === true && payload.preventEditing !== true;
  const ids = Array.isArray(menuItemIds) ? [...new Set(menuItemIds)] : [];
  return Object.fromEntries(ids
    .filter(id => typeof id === 'string' && /^menu-multiple-replace-run-[a-z0-9][a-z0-9_-]{0,79}$/i.test(id))
    .map(id => [id, { enabled }]));
}

module.exports = { getMenuItemStates, getSyntaxMenuItemStates, getSnippetMenuItemStates, normalizeMultipleReplaceMenuEntries, getMultipleReplaceMenuItemStates };
