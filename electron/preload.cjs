const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('cotedit', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  openFiles: () => ipcRenderer.invoke('document:open'),
  openPath: (filePath, options) => ipcRenderer.invoke('document:open-path', filePath, options),
  openExternalPath: (filePath) => ipcRenderer.invoke('document:open-external-path', filePath),
  openExternalUrl: (url) => ipcRenderer.invoke('external:open-url', url),
  openRecentPath: (filePath) => ipcRenderer.invoke('document:open-recent', filePath),
  newWindow: () => ipcRenderer.invoke('window:new'),
  printDocument: (payload) => ipcRenderer.invoke('document:print', payload),
  writeRichText: (payload) => ipcRenderer.invoke('clipboard:write-rich-text', payload),
  exportSettings: (settings) => ipcRenderer.invoke('settings:export', settings),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  chooseDirectory: () => ipcRenderer.invoke('directory:choose'),
  listDirectory: (payload) => ipcRenderer.invoke('directory:list', payload),
  createDirectoryEntry: (payload) => ipcRenderer.invoke('directory:create-entry', payload),
  searchDirectory: (payload) => ipcRenderer.invoke('directory:search', payload),
  previewFile: (filePath) => ipcRenderer.invoke('directory:preview', filePath),
  openPathInNewWindow: (filePath) => ipcRenderer.invoke('directory:open-in-new-window', filePath),
  openFileExternally: (filePath) => ipcRenderer.invoke('directory:open-external', filePath),
  openFileWithApplication: (filePath) => ipcRenderer.invoke('directory:open-with-application', filePath),
  listExternalApplications: (filePath) => ipcRenderer.invoke('directory:list-external-applications', filePath),
  openRegisteredApplication: (filePath, applicationId) => ipcRenderer.invoke('directory:open-registered-application', { path: filePath, applicationId }),
  saveFile: (payload) => ipcRenderer.invoke('document:save', payload),
  getRemoteEditingSettings: () => ipcRenderer.invoke('remote:get-settings'),
  configureRemoteEditing: (settings) => ipcRenderer.invoke('remote:configure', settings),
  saveRemoteDocument: (payload) => ipcRenderer.invoke('remote:save', payload),
  closeRemoteDocument: (sessionId) => ipcRenderer.invoke('remote:close', sessionId),
  listRecoveryDrafts: () => ipcRenderer.invoke('recovery:list'),
  saveRecoveryDrafts: (drafts) => ipcRenderer.invoke('recovery:replace-window', drafts),
  importLegacyRecoveryDrafts: (sessions) => ipcRenderer.invoke('recovery:import-legacy', sessions),
  deleteRecoveryDrafts: (ids) => ipcRenderer.invoke('recovery:remove', ids),
  clearRecoveryDrafts: () => ipcRenderer.invoke('recovery:clear'),
  checkEncodingCompatibility: (payload) => ipcRenderer.invoke('document:check-encoding', payload),
  countEncodedBytes: (payload) => ipcRenderer.invoke('document:count-encoded-bytes', payload),
  revealFile: (filePath) => ipcRenderer.invoke('document:reveal', filePath),
  copyFilePath: (filePath) => ipcRenderer.invoke('document:copy-path', filePath),
  copyRemoteFilePath: (filePath) => ipcRenderer.invoke('document:copy-remote-path', filePath),
  listScripts: () => ipcRenderer.invoke('script:list'),
  getScript: (id) => ipcRenderer.invoke('script:get', id),
  openScriptsFolder: () => ipcRenderer.invoke('script:open-folder'),
  importCotEditorTheme: () => ipcRenderer.invoke('theme:import'),
  importCotEditorSyntax: () => ipcRenderer.invoke('syntax:import'),
  onSyntaxPackageDrop: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const targetFor = target => target && typeof target.closest === 'function' ? target.closest('#syntax-menu-list') : null;
    const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files') || Boolean(event.dataTransfer?.files?.length);
    const dragover = event => {
      const list = targetFor(event.target);
      if (!list || !hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      list.classList.add('is-import-drop-target');
    };
    const dragleave = event => {
      const list = targetFor(event.target);
      if (list && (!event.relatedTarget || !list.contains(event.relatedTarget))) list.classList.remove('is-import-drop-target');
    };
    const drop = event => {
      const list = targetFor(event.target);
      if (!list || !hasFiles(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      list.classList.remove('is-import-drop-target');
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) {
        callback({ error: '没有可读取的文件夹路径。请将 `.cotsyntax` 文件夹直接拖到语法列表。' });
        return;
      }
      if (files.length > 20) {
        callback({ error: '一次最多拖入 20 个 `.cotsyntax` 文件夹。' });
        return;
      }
      try {
        const directories = files.map(file => webUtils.getPathForFile(file));
        void ipcRenderer.invoke('syntax:import-dropped', directories)
          .then(packages => callback({ packages }))
          .catch(error => callback({ error: String(error?.message || '语法包导入失败').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240) }));
      } catch {
        callback({ error: '无法读取拖入项目的本机路径。' });
      }
    };
    window.addEventListener('dragover', dragover, true);
    window.addEventListener('dragleave', dragleave, true);
    window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('dragover', dragover, true);
      window.removeEventListener('dragleave', dragleave, true);
      window.removeEventListener('drop', drop, true);
    };
  },
  updateCustomSyntaxMenu: (items) => ipcRenderer.send('syntax:menu-update', items),
  updateSnippetMenu: (items) => ipcRenderer.send('snippet:menu-update', items),
  updateMultipleReplaceMenu: (items) => ipcRenderer.send('multiple-replace:menu-update', items),
  setWindowSize: (size) => ipcRenderer.invoke('window:set-size', size),
  showWindowWhenReady: () => ipcRenderer.invoke('window:show-ready'),
  onWindowSizeChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, size) => callback(size);
    ipcRenderer.on('window:size-changed', handler);
    return () => ipcRenderer.removeListener('window:size-changed', handler);
  },
  setTitle: (title) => ipcRenderer.invoke('window:set-title', title),
  setMenuState: (state) => ipcRenderer.send('menu:update-state', state),
  setShortcutBindings: (bindings) => ipcRenderer.send('shortcuts:update', bindings),
  getQuickActionItems: () => ipcRenderer.invoke('quick-actions:list'),
  executeQuickAction: (id) => ipcRenderer.invoke('quick-actions:execute', id),
  setShortcutCaptureMode: (active) => ipcRenderer.invoke('shortcuts:capture-mode', active === true),
  formatDroppedFilePaths: (paths, documentPath, syntaxId, rules) => ipcRenderer.invoke('file-drop:format', paths, documentPath, syntaxId, rules),
  onFileDrop: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const isEditorTarget = event => Boolean(event.target && typeof event.target.closest === 'function' && event.target.closest('.cm-editor'));
    const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files') || Boolean(event.dataTransfer?.files?.length);
    const dragover = event => {
      if (!isEditorTarget(event) || !hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const drop = event => {
      if (!isEditorTarget(event)) return;
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const paths = files.map(file => webUtils.getPathForFile(file));
        callback({ paths, x: event.clientX, y: event.clientY });
      } catch {
        callback({ error: true, x: event.clientX, y: event.clientY });
      }
    };
    window.addEventListener('dragover', dragover, true);
    window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('dragover', dragover, true);
      window.removeEventListener('drop', drop, true);
    };
  },
  onMenu: (callback) => {
    const channels = [
      'menu:new', 'menu:new-tab', 'menu:open', 'menu:open-recent', 'menu:recover-drafts', 'menu:print', 'menu:open-folder', 'menu:save', 'menu:save-as', 'menu:save-all',
      'menu:close-document', 'menu:revert', 'menu:reveal-file', 'menu:copy-path', 'menu:find', 'menu:find-next', 'menu:find-previous', 'menu:find-all', 'menu:select-all-find-matches', 'menu:highlight-all', 'menu:remove-highlights',
      'menu:paste-exactly', 'menu:copy-as-rich-text', 'menu:insert-backslash', 'menu:insert-yen-mark', 'menu:insert-unicode-code-point',
      'menu:replace', 'menu:replace-next', 'menu:replace-all', 'menu:multiple-replace', 'menu:multiple-replace-definition', 'menu:use-selection-for-find', 'menu:use-selection-for-replace', 'menu:jump-to-selection', 'menu:select-word', 'menu:delete',
      'menu:search-folder', 'menu:folder-browser', 'menu:folder-find', 'menu:document-inspector',
      'menu:go-to-line', 'menu:select-line', 'menu:select-enclosing-symbols', 'menu:undo', 'menu:redo',
      'menu:indent-more', 'menu:indent-less', 'menu:indent-to-spaces', 'menu:indent-to-tabs', 'menu:indent-width', 'menu:indent-follow-global', 'menu:custom-indent-width', 'menu:tab-width', 'menu:custom-tab-width', 'menu:encoding', 'menu:eol', 'menu:inspect-line-endings', 'menu:syntax', 'menu:reset-syntax', 'menu:customize-syntax-menu', 'menu:show-file-mapping-conflicts',
      'menu:theme', 'menu:import-cot-theme', 'menu:run-script', 'menu:uppercase', 'menu:lowercase', 'menu:capitalize', 'menu:url-encode', 'menu:url-decode', 'menu:unicode-nfc', 'menu:unicode-nfd', 'menu:unicode-nfkc', 'menu:unicode-nfkd', 'menu:unicode-nfkc-casefold', 'menu:unicode-modified-nfd', 'menu:unicode-modified-nfc', 'menu:fullwidth', 'menu:halfwidth', 'menu:fullwidth-roman', 'menu:halfwidth-roman', 'menu:surround-single-quotes', 'menu:surround-double-quotes', 'menu:surround-parentheses', 'menu:surround-braces', 'menu:surround-brackets', 'menu:surround-custom', 'menu:sort-lines', 'menu:sort-by-pattern', 'menu:reverse-lines', 'menu:shuffle-lines', 'menu:delete-duplicates', 'menu:join-lines', 'menu:trim-trailing-whitespace', 'menu:toggle-utf8-bom',
      'menu:toggle-comment', 'menu:comment-out', 'menu:inline-comment', 'menu:block-comment', 'menu:uncomment', 'menu:duplicate-line', 'menu:delete-line', 'menu:move-line-up', 'menu:move-line-down', 'menu:join-current-lines', 'menu:split-selection-lines', 'menu:font-type',
      'menu:replace-quotes', 'menu:straighten-quotes', 'menu:replace-dashes', 'menu:replace-text',
      'menu:toggle-spelling', 'menu:toggle-smart-quotes', 'menu:toggle-smart-dashes', 'menu:toggle-text-replacement', 'menu:toggle-inspector', 'menu:speech-start', 'menu:speech-stop', 'menu:complete', 'menu:select-column-up', 'menu:select-column-down', 'menu:toggle-wrap', 'menu:toggle-line-numbers', 'menu:inspect-character', 'menu:advanced-character-count', 'menu:edit-color-code', 'menu:import-cot-syntax',
      'menu:toggle-split', 'menu:focus-next-editor', 'menu:focus-previous-editor', 'menu:stack-editors-vertically', 'menu:prevent-editing', 'menu:orientation-horizontal', 'menu:orientation-vertical', 'menu:writing-direction-ltr', 'menu:writing-direction-rtl', 'menu:toggle-invisibles', 'menu:toggle-indent-guides', 'menu:toggle-page-guide', 'menu:toggle-sidebar', 'menu:toggle-status-bar', 'menu:toggle-tab-bar', 'menu:toggle-toolbar', 'menu:toggle-navigation-bar', 'menu:customize-toolbar', 'menu:outline', 'menu:open-outline-menu', 'menu:select-previous-outline-item', 'menu:select-next-outline-item', 'menu:inspector', 'menu:warnings', 'menu:font-up', 'menu:font-down', 'menu:font-reset', 'menu:toggle-ligatures', 'menu:settings', 'menu:previous-document', 'menu:next-document',
      'menu:help', 'menu:shortcuts', 'menu:page-setup', 'menu:export-settings', 'menu:import-settings', 'menu:integration-settings', 'menu:donate', 'menu:quick-actions', 'menu:insert-snippet', 'menu:manage-snippets', 'menu:auto-expand-tab'
    ];
    const handlers = channels.map(channel => {
      const handler = (_event, value) => callback(channel, value);
      ipcRenderer.on(channel, handler);
      return [channel, handler];
    });
    return () => handlers.forEach(([channel, handler]) => ipcRenderer.removeListener(channel, handler));
  },
  onOpenExternalDocument: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, filePath) => callback(filePath);
    ipcRenderer.on('document:open-external', handler);
    return () => ipcRenderer.removeListener('document:open-external', handler);
  },
  onRecoveryChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = () => callback();
    ipcRenderer.on('recovery:changed', handler);
    return () => ipcRenderer.removeListener('recovery:changed', handler);
  },
  onRemoteDocument: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, document) => callback(document);
    ipcRenderer.on('remote:open', handler);
    return () => ipcRenderer.removeListener('remote:open', handler);
  },
  onRemoteStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('remote:status', handler);
    return () => ipcRenderer.removeListener('remote:status', handler);
  },
  onRemoteDisconnect: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, remoteFile) => callback(remoteFile);
    ipcRenderer.on('remote:disconnect', handler);
    return () => ipcRenderer.removeListener('remote:disconnect', handler);
  },
  onRemoteError: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, error) => callback(error);
    ipcRenderer.on('remote:error', handler);
    return () => ipcRenderer.removeListener('remote:error', handler);
  }
}));
