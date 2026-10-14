const { app, BrowserWindow, ClipboardItem, clipboard, dialog, ipcMain, Menu, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { decodeBuffer, normalizeEncoding, encodeText, findIncompatibleCharacters, getLineEndings, normalizeLineEndings, dominantLineEnding } = require('./codec.cjs');
const { getMenuItemStates, getSyntaxMenuItemStates, getSnippetMenuItemStates, normalizeMultipleReplaceMenuEntries, getMultipleReplaceMenuItemStates } = require('./menu-state.cjs');
const { normalizeRecentDocuments, addRecentDocument, filterExistingRecentDocuments } = require('../lib/recent-documents.cjs');
const { buildPrintHTML, printOptions } = require('./print-html.cjs');
const { buildRichTextClipboardFormats } = require('./rich-text-clipboard.cjs');
const { findUserScript, loadUserScripts } = require('./script-system.cjs');
const { normalizeCotEditorTheme } = require('./cot-theme.cjs');
const { loadCotEditorSyntax, loadCotEditorSyntaxPackages } = require('./cot-syntax.cjs');
const { listDirectory } = require('./directory-navigation.cjs');
const { previewFileInRoot, resolveEditableFileInRoot, resolveRegularFileInRoot, searchDirectory } = require('./directory-search.cjs');
const { createFileInRoot, createFolderInRoot } = require('./directory-mutations.cjs');
const { openExternalFileInRoot, openFileWithApplicationInRoot } = require('./directory-open.cjs');
const { collectExternalFilePaths } = require('./external-open.cjs');
const { normalizeExternalWebUrl } = require('./external-web-url.cjs');
const { createExternalApplicationDialogOptions } = require('./external-application-dialog.cjs');
const { listExternalApplicationsInRoot, openFileWithRegisteredApplicationInRoot } = require('./linux-external-applications.cjs');
const { atomicWrite } = require('./atomic-write.cjs');
const { createRecoveryStore } = require('./recovery-store.cjs');
const { createRecoveryOwnership } = require('./recovery-ownership.cjs');
const { bringAllWindowsToFront, toggleAlwaysOnTop } = require('./window-actions.cjs');
const { DEFAULT_WINDOW_SIZE, WINDOW_SIZE_LIMITS, applyWindowSize } = require('./window-size.cjs');
const { customAccelerator, decorateMenuShortcutLabels, formatCustomShortcutLabel, requiresCustomKeyDispatch } = require('./shortcut-menu.cjs');
const SHORTCUTS = require('../lib/shortcuts.json');
const PROJECT_HELP_URLS = Object.freeze({
  home: 'https://github.com/jincaiw/cotedit',
  releases: 'https://github.com/jincaiw/cotedit/releases',
  issues: 'https://github.com/jincaiw/cotedit/issues/new'
});
const { DEFAULT_RMATE_PORT, MAX_RMATE_FILE_BYTES, RMateServer } = require('./rmate-server.cjs');
const { collectQuickActionMenuItems, executeQuickActionMenuItem } = require('./quick-action-menu.cjs');
const { formatDroppedFilePaths } = require('./file-drop.cjs');
const { normalizeShortcutBindings } = require('./shortcut-bindings.cjs');
const { documentFileOwnerIds, documentFilePermissions, documentFileTimestamps } = require('./document-file-metadata.cjs');
const { readFinderTags } = require('./finder-tags.cjs');
if (process.env.COTEDIT_TEST_USER_DATA_DIR && path.isAbsolute(process.env.COTEDIT_TEST_USER_DATA_DIR)) {
  app.setPath('userData', path.resolve(process.env.COTEDIT_TEST_USER_DATA_DIR));
}
let userShortcutBindings = {};
let shortcutCaptureActive = false;
function defaultMenuShortcutBindings() {
  const isMac = process.platform === 'darwin';
  return Object.fromEntries(SHORTCUTS.map(shortcut => [shortcut.id, {
    key: isMac ? (shortcut.keyMac || shortcut.key) : shortcut.key,
    mod: isMac ? (shortcut.modMac ?? shortcut.mod) : shortcut.mod,
    ctrl: isMac ? (shortcut.ctrlMac ?? shortcut.ctrl) : (shortcut.ctrlNonMac ?? shortcut.ctrl),
    alt: isMac ? (shortcut.altMac ?? shortcut.alt) : (shortcut.altNonMac ?? shortcut.alt),
    shift: isMac ? (shortcut.shiftMac ?? shortcut.shift) : (shortcut.shiftNonMac ?? shortcut.shift)
  }]));
}
function disableCustomAcceleratorRegistration(template) {
  const customAccelerators = new Set(Object.values(userShortcutBindings).map(customAccelerator));
  const visit = items => {
    for (const item of items) {
      if (item.accelerator && customAccelerators.has(item.accelerator)) item.registerAccelerator = false;
      if (Array.isArray(item.submenu)) visit(item.submenu);
    }
  };
  visit(template);
}
const accelerator = id => {
  if (shortcutCaptureActive) return undefined;
  if (userShortcutBindings[id]) return customAccelerator(userShortcutBindings[id]);
  const shortcut = SHORTCUTS.find(item => item.id === id);
  const key = process.platform === 'darwin' ? (shortcut?.keyMac || shortcut?.key) : shortcut?.key;
  if (requiresCustomKeyDispatch(key)) return undefined;
  return process.platform === 'darwin' ? (shortcut?.acceleratorMac || shortcut?.accelerator) : shortcut?.accelerator;
};

const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_THEME_BYTES = 256 * 1024;
let mainWindow;
const appWindows = new Set();
const windowMenuStates = new Map();
const windowSnippetMenuEntries = new Map();
const windowMultipleReplaceMenuEntries = new Map();
const directoryRoots = new WeakMap();
const externalOpenReadyWindows = new WeakSet();
let applicationMenu = null;
let quickActionRegistry = { entries: [], handlers: new Map() };
let currentMenuState = {};
const remoteEditingServer = new RMateServer({ applicationName: 'CotEdit' });
let remoteEditingSettings = { enabled: false, port: DEFAULT_RMATE_PORT };
let remoteEditingStatus = { listening: false, error: '' };
let recentDocuments = [];
let scriptsDirectory = null;
let userScripts = [];
let customSyntaxMenuEntries = [];
let snippetMenuEntries = [];
let multipleReplaceMenuEntries = [];
let pendingExternalPaths = [];
const pendingExternalPathsByWindow = new WeakMap();
let recoveryStore = null;
let recoveryQuitPrepared = false;
const recoveryOwnership = createRecoveryOwnership();
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function remoteEditingSettingsPath() {
  return path.join(app.getPath('userData'), 'remote-editing-settings.json');
}

function normalizeRemoteEditingSettings(value = {}) {
  const port = Number(value.port ?? DEFAULT_RMATE_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('端口号必须在 1–65535 之间。');
  return { enabled: value.enabled === true, port };
}

function getRemoteEditingSettings() {
  return { ...remoteEditingSettings, listening: remoteEditingStatus.listening === true, error: remoteEditingStatus.error || '' };
}

function notifyRemoteStatus() {
  sendRemoteRendererEvent('remote:status', getRemoteEditingSettings());
}

function sendRemoteRendererEvent(channel, payload) {
  let window = targetWindow();
  if (!window || window.isDestroyed()) {
    if (channel !== 'remote:open') return;
    window = createWindow();
  }
  const deliver = () => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, payload);
  };
  if (window.webContents.isLoading()) window.webContents.once('did-finish-load', deliver);
  else deliver();
}

async function configureRemoteEditing(value, { persist = true } = {}) {
  const next = normalizeRemoteEditingSettings(value);
  if (persist) await atomicWrite(remoteEditingSettingsPath(), JSON.stringify(next, null, 2), 'utf8');
  remoteEditingSettings = next;
  if (!next.enabled) {
    remoteEditingServer.stopAccepting();
    remoteEditingStatus = { listening: false, error: '' };
  } else {
    try {
      await remoteEditingServer.listen(next.port);
      remoteEditingStatus = { listening: true, error: '' };
    } catch (error) {
      const message = error?.code === 'EADDRINUSE' ? `端口 ${next.port} 已被占用。` : (error?.message || '无法启动远程编辑服务。');
      remoteEditingStatus = { listening: false, error: message };
    }
  }
  notifyRemoteStatus();
  return getRemoteEditingSettings();
}

async function loadRemoteEditingSettings() {
  try {
    const raw = JSON.parse(await fs.readFile(remoteEditingSettingsPath(), 'utf8'));
    await configureRemoteEditing(normalizeRemoteEditingSettings(raw), { persist: false });
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('Ignoring invalid remote editing settings:', error?.message || error);
    remoteEditingSettings = { enabled: false, port: DEFAULT_RMATE_PORT };
    remoteEditingStatus = { listening: false, error: '' };
  }
}

remoteEditingServer.on('open', file => {
  try {
    const decoded = decodeBuffer(file.data);
    const lineEndings = getLineEndings(decoded.text);
    const name = path.basename(String(file.displayName || file.remotePath || '远程文稿.txt').replace(/\\/g, '/')) || '远程文稿.txt';
    sendRemoteRendererEvent('remote:open', {
      sessionId: file.id,
      name,
      remotePath: file.remotePath,
      lineNumber: file.lineNumber,
      fileType: file.fileType,
      text: decoded.text,
      encoding: decoded.encoding,
      eol: dominantLineEnding(lineEndings, 'LF'),
      lineEndings,
      bom: decoded.bom
    });
  } catch (error) {
    remoteEditingServer.closeFile(file.id);
    sendRemoteRendererEvent('remote:error', { message: error?.message || '远程文稿无法作为文本打开。' });
  }
});

remoteEditingServer.on('disconnect', file => sendRemoteRendererEvent('remote:disconnect', file));

function getRecoveryStore() {
  recoveryStore ||= createRecoveryStore(path.join(app.getPath('userData'), 'recovery-drafts-v1.json.gz'));
  return recoveryStore;
}

function recoveryWindowFromEvent(event) {
  const window = BrowserWindow.fromWebContents(event?.sender);
  if (!window || window.isDestroyed()) throw new Error('恢复库请求来自未知窗口。');
  return window;
}

function notifyRecoveryStoreChanged() {
  for (const window of appWindows) {
    if (!window.isDestroyed()) window.webContents.send('recovery:changed');
  }
}

function markRecoveryDraftUse(drafts) {
  return recoveryOwnership.annotate(drafts);
}

function targetWindow(requestedWindow) {
  if (requestedWindow && !requestedWindow.isDestroyed()) return requestedWindow;
  return BrowserWindow.getFocusedWindow() || mainWindow || null;
}

function windowForEvent(event) {
  return BrowserWindow.fromWebContents(event?.sender) || targetWindow();
}

function directoryRootFor(event) {
  return event?.sender ? directoryRoots.get(event.sender) || null : null;
}

async function loadRecentDocuments() {
  let stored;
  try {
    const filename = path.join(app.getPath('userData'), 'recent-documents.json');
    stored = normalizeRecentDocuments(JSON.parse(await fs.readFile(filename, 'utf8')));
  } catch {
    recentDocuments = [];
    return;
  }
  recentDocuments = await filterExistingRecentDocuments(stored, async filePath => (await fs.stat(filePath)).isFile());
  if (JSON.stringify(recentDocuments) !== JSON.stringify(stored)) {
    try { await persistRecentDocuments(); } catch (error) { console.error('Failed to clean recent documents:', error); }
  }
}

async function persistRecentDocuments() {
  const filename = path.join(app.getPath('userData'), 'recent-documents.json');
  const temp = `${filename}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filename), { recursive: true });
  try {
    await fs.writeFile(temp, JSON.stringify(recentDocuments, null, 2), { flag: 'wx', mode: 0o600 });
    await fs.rename(temp, filename);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

async function recordRecentDocument(filePath) {
  recentDocuments = addRecentDocument(recentDocuments, filePath);
  if (process.platform === 'darwin') app.addRecentDocument(path.resolve(filePath));
  try { await persistRecentDocuments(); } catch (error) { console.error('Failed to save recent documents:', error); }
  if (applicationMenu) buildMenu();
}

async function clearRecentDocuments() {
  recentDocuments = [];
  try { await persistRecentDocuments(); } catch (error) { console.error('Failed to clear recent documents:', error); }
  if (applicationMenu) buildMenu();
}

async function reloadUserScripts() {
  scriptsDirectory ||= path.join(app.getPath('userData'), 'Scripts');
  userScripts = await loadUserScripts(scriptsDirectory);
  if (applicationMenu) buildMenu();
  return userScripts.map(({ id, name }) => ({ id, name }));
}

async function openUserScriptsFolder() {
  scriptsDirectory ||= path.join(app.getPath('userData'), 'Scripts');
  await fs.mkdir(scriptsDirectory, { recursive: true, mode: 0o700 });
  const error = await shell.openPath(scriptsDirectory);
  if (error) throw new Error(error);
  return true;
}

function safeText(value, max = 12_000_000) {
  if (typeof value !== 'string' || value.length > max) throw new Error('文本过长或格式无效。');
  return value;
}

async function readDocument(filePath, { allowBinaryText = false } = {}) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('所选路径不是文件。');
  if (stat.size > MAX_FILE_BYTES) throw new Error(`文件超过 ${MAX_FILE_BYTES / 1024 / 1024} MB 限制。`);
  const buffer = await fs.readFile(filePath);
  const fileTags = await readFinderTags(filePath);
  const decoded = decodeBuffer(buffer, { allowBinaryText });
  const lineEndings = getLineEndings(decoded.text);
  const eol = dominantLineEnding(lineEndings, 'LF');
  return {
    path: filePath,
    name: path.basename(filePath),
    fileSizeBytes: buffer.length,
    ...documentFileTimestamps(stat),
    filePermissions: documentFilePermissions(stat),
    fileOwnerIds: documentFileOwnerIds(stat),
    fileTags,
    text: normalizeLineEndings(decoded.text).replace(/^\uFEFF/, ''),
    encoding: decoded.encoding,
    bom: decoded.bom,
    eol,
    lineEndings
  };
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function createWindow() {
  const window = new BrowserWindow({
    ...DEFAULT_WINDOW_SIZE,
    show: false,
    minWidth: WINDOW_SIZE_LIMITS.minWidth,
    minHeight: WINDOW_SIZE_LIMITS.minHeight,
    title: 'CotEdit',
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow = window;
  appWindows.add(window);
  window.on('resize', () => {
    if (window.isDestroyed() || !window.isVisible() || window.webContents.isDestroyed()) return;
    const [width, height] = window.getSize();
    window.webContents.send('window:size-changed', { width, height });
  });
  window.webContents.on('did-start-loading', () => externalOpenReadyWindows.delete(window));
  window.webContents.on('context-menu', (_event, params) => {
    const word = typeof params.misspelledWord === 'string' ? params.misspelledWord.trim() : '';
    if (!params.isEditable || !word || word.length > 128 || /[\s\u0000-\u001f\u007f]/u.test(word) || window.isDestroyed()) return;
    const suggestions = [...new Set((Array.isArray(params.dictionarySuggestions) ? params.dictionarySuggestions : [])
      .filter(item => typeof item === 'string' && item.length > 0 && item.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(item)))].slice(0, 8);
    const items = suggestions.length
      ? suggestions.map(suggestion => ({ label: suggestion, click: () => { if (!window.isDestroyed()) window.webContents.replaceMisspelling(suggestion); } }))
      : [{ label: '没有拼写建议', enabled: false }];
    items.push({ type: 'separator' }, {
      label: '将“' + word + '”添加到字典',
      click: () => window.webContents.session.addWordToSpellCheckerDictionary(word)
    });
    Menu.buildFromTemplate(items).popup({ window });
  });
  window.webContents.on('did-finish-load', () => {
    externalOpenReadyWindows.add(window);
    if (recoveryOwnership.release(window.id)) notifyRecoveryStoreChanged();
    flushExternalOpenPaths(window);
  });
  window.webContents.on('render-process-gone', () => {
    if (recoveryOwnership.release(window.id)) notifyRecoveryStoreChanged();
  });
  window.on('focus', () => {
    mainWindow = window;
    const focusedSnippetEntries = windowSnippetMenuEntries.get(window.webContents.id) || [];
    if (JSON.stringify(focusedSnippetEntries) !== JSON.stringify(snippetMenuEntries)) {
      snippetMenuEntries = focusedSnippetEntries;
      if (applicationMenu) buildMenu();
    }
    const focusedMultipleReplaceEntries = windowMultipleReplaceMenuEntries.get(window.webContents.id) || [];
    if (JSON.stringify(focusedMultipleReplaceEntries) !== JSON.stringify(multipleReplaceMenuEntries)) {
      multipleReplaceMenuEntries = focusedMultipleReplaceEntries;
      if (applicationMenu) buildMenu();
    }
    updateMenuState(windowMenuStates.get(window.id) || {}, window);
  });
  window.on('closed', () => {
    appWindows.delete(window);
    windowMenuStates.delete(window.id);
    windowSnippetMenuEntries.delete(window.webContents.id);
    windowMultipleReplaceMenuEntries.delete(window.webContents.id);
    const releasedRecoveryDrafts = recoveryOwnership.release(window.id);
    if (shortcutCaptureActive) {
      shortcutCaptureActive = false;
      if (applicationMenu) buildMenu();
    }
    if (mainWindow === window) mainWindow = BrowserWindow.getFocusedWindow() || [...appWindows].at(-1) || null;
    if (releasedRecoveryDrafts) notifyRecoveryStoreChanged();
    if (mainWindow) updateMenuState(windowMenuStates.get(mainWindow.id) || {}, mainWindow);
  });

  const devUrl = process.env.COTEDIT_DEV_URL;
  if (devUrl) {
    const url = new URL(devUrl);
    url.searchParams.set('windowId', String(window.id));
    window.loadURL(url.toString());
  } else window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { windowId: String(window.id) } });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://127.0.0.1:')) event.preventDefault();
  });
  return window;
}

function sendCommand(channel, value, requestedWindow) {
  targetWindow(requestedWindow)?.webContents.send(channel, value);
}

function openProjectHelpPage(page) {
  const url = Object.hasOwn(PROJECT_HELP_URLS, page) ? PROJECT_HELP_URLS[page] : null;
  if (url) shell.openExternal(url).catch(error => console.error('Failed to open CotEdit help link:', error));
}

function queueExternalOpenPath(filePath, requestedWindow = null) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return;
  const resolved = path.normalize(filePath);
  const window = requestedWindow ? (!requestedWindow.isDestroyed() ? requestedWindow : null) : targetWindow();
  if (!window) {
    if (!requestedWindow && !pendingExternalPaths.includes(resolved)) pendingExternalPaths.push(resolved);
    return;
  }
  if (window.isDestroyed()) return;
  if (!externalOpenReadyWindows.has(window)) {
    const pending = pendingExternalPathsByWindow.get(window) || [];
    if (!pending.includes(resolved)) pending.push(resolved);
    pendingExternalPathsByWindow.set(window, pending);
    return;
  }
  window.webContents.send('document:open-external', resolved);
}

function flushExternalOpenPaths(window) {
  if (!window || window.isDestroyed()) return;
  const targetedPaths = pendingExternalPathsByWindow.get(window) || [];
  pendingExternalPathsByWindow.delete(window);
  for (const filePath of targetedPaths) window.webContents.send('document:open-external', filePath);
  if (!pendingExternalPaths.length) return;
  const paths = pendingExternalPaths;
  pendingExternalPaths = [];
  for (const filePath of paths) window.webContents.send('document:open-external', filePath);
}

function buildMenu() {
  const syntaxItems = [
    ['plaintext', '纯文本'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['jsx', 'JSX'],
    ['json', 'JSON'], ['html', 'HTML'], ['css', 'CSS'], ['markdown', 'Markdown'], ['python', 'Python'],
    ['java', 'Java'], ['cpp', 'C / C++'], ['csharp', 'C#'], ['objectivec', 'Objective-C'], ['rust', 'Rust'], ['php', 'PHP'],
    ['go', 'Go'], ['ruby', 'Ruby'], ['swift', 'Swift'], ['kotlin', 'Kotlin'], ['scala', 'Scala'], ['dart', 'Dart'],
    ['shell', 'Shell'], ['powershell', 'PowerShell'], ['perl', 'Perl'], ['lua', 'Lua'], ['r', 'R'], ['clojure', 'Clojure'],
    ['haskell', 'Haskell'], ['groovy', 'Groovy'], ['julia', 'Julia'], ['erlang', 'Erlang'], ['fsharp', 'F#'], ['ocaml', 'OCaml'],
    ['sml', 'Standard ML'], ['fortran', 'Fortran'], ['coffeescript', 'CoffeeScript'], ['dockerfile', 'Dockerfile'],
    ['toml', 'TOML'], ['properties', 'INI / Properties'], ['diff', 'Diff / Patch'], ['protobuf', 'Protocol Buffers'],
    ['cmake', 'CMake'], ['nginx', 'Nginx'], ['verilog', 'Verilog'], ['vhdl', 'VHDL'], ['vb', 'Visual Basic'],
    ['d', 'D'], ['factor', 'Factor'], ['scheme', 'Scheme'], ['pascal', 'Pascal'], ['cobol', 'COBOL'], ['commonlisp', 'Common Lisp'],
    ['crystal', 'Crystal'], ['cypher', 'Cypher'], ['eiffel', 'Eiffel'], ['elm', 'Elm'], ['gherkin', 'Gherkin'], ['haxe', 'Haxe'],
    ['livescript', 'LiveScript'], ['sas', 'SAS'], ['smalltalk', 'Smalltalk'], ['sparql', 'SPARQL'], ['tcl', 'Tcl'], ['webidl', 'WebIDL'],
    ['xquery', 'XQuery'], ['turtle', 'Turtle'], ['pug', 'Pug'], ['vbscript', 'VBScript'], ['z80', 'Z80 Assembly'],
    ['sql', 'SQL'], ['xml', 'XML'], ['yaml', 'YAML']
  ].map(([id, label]) => ({ id: `menu-syntax-${id}`, label, type: 'radio', click: () => sendCommand('menu:syntax', id) }));
  if (customSyntaxMenuEntries.length) syntaxItems.push({ type: 'separator' }, ...customSyntaxMenuEntries.map(({ id, label }) => ({ id: `menu-syntax-${id}`, label, type: 'radio', click: () => sendCommand('menu:syntax', id) })));
  syntaxItems.push(
    { type: 'separator' },
    { label: '导入 CotEditor 语法…', click: () => sendCommand('menu:import-cot-syntax') },
    { label: '自定义语法菜单…', click: () => sendCommand('menu:customize-syntax-menu') },
    { id: 'menu-show-file-mapping-conflicts', label: '显示文件映射冲突…', click: () => sendCommand('menu:show-file-mapping-conflicts') }
  );
  const lineEndingItems = [
    { id: 'menu-inspect-line-endings', label: '检查混合换行符…', click: () => sendCommand('menu:inspect-line-endings') },
    { type: 'separator' },
    ...['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS'].map(value => ({ id: `menu-eol-${value}`, label: value, type: 'radio', click: () => sendCommand('menu:eol', value) }))
  ];
  const encodingItems = [
    ['utf8', 'UTF-8'], ['utf16le', 'UTF-16 LE'], ['utf16be', 'UTF-16 BE'], ['shift_jis', 'Shift_JIS'],
    ['gbk', 'GBK'], ['big5', 'Big5'], ['windows-1252', 'Windows-1252'], ['iso-8859-1', 'ISO-8859-1']
  ].map(([value, label]) => ({ id: `menu-encoding-${value}`, label, type: 'radio', click: () => sendCommand('menu:encoding', value) }));
  encodingItems.push({ type: 'separator' }, { id: 'menu-toggle-utf8-bom', label: 'UTF-8 BOM', type: 'checkbox', click: () => sendCommand('menu:toggle-utf8-bom') });
  const indentWidthItems = [
    { id: 'menu-indent-width-global', label: '跟随全局设置', type: 'radio', click: () => sendCommand('menu:indent-follow-global') },
    ...[['tab', '制表符'], ['2', '2 个空格'], ['4', '4 个空格'], ['8', '8 个空格']]
      .map(([value, label]) => ({ id: `menu-indent-width-${value}`, label, type: 'radio', click: () => sendCommand('menu:indent-width', value) }))
  ];
  indentWidthItems.push({ id: 'menu-indent-width-custom', label: '自定义…', type: 'radio', click: () => sendCommand('menu:custom-indent-width') });
  const tabWidthItems = ['2', '4', '8'].map(value => ({
    id: `menu-tab-width-${value}`, label: `${value} 列`, type: 'radio', click: () => sendCommand('menu:tab-width', Number(value))
  }));
  tabWidthItems.push(
    { type: 'separator' },
    { id: 'menu-tab-width-custom', label: '自定义…', type: 'radio', click: () => sendCommand('menu:custom-tab-width') },
    { type: 'separator' },
    { id: 'menu-auto-expand-tab', label: '使用空格缩进', type: 'checkbox', click: () => sendCommand('menu:auto-expand-tab') }
  );
  const themeItems = [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']]
    .map(([value, label]) => ({ id: `menu-theme-${value}`, label, type: 'radio', click: () => sendCommand('menu:theme', value) }));
  const scriptItems = userScripts.length
    ? userScripts.map((script, index) => ({ id: `menu-script-run-${index}`, label: script.name, click: () => sendCommand('menu:run-script', script.id) }))
    : [{ label: '暂无脚本（在脚本文件夹添加 .js 文件）', enabled: false }];
  const snippetItems = snippetMenuEntries.length
    ? snippetMenuEntries.map(({ id, label, shortcut }) => {
      const acceleratorValue = customAccelerator(shortcut);
      const menuLabel = shortcut && !acceleratorValue ? `${label}\t${formatCustomShortcutLabel(shortcut)}` : label;
      return { id: `menu-snippet-${id}`, label: menuLabel, accelerator: acceleratorValue, registerAccelerator: false, click: () => sendCommand('menu:insert-snippet', id) };
    })
    : [{ label: '暂无可用片段', enabled: false }];
  const multipleReplaceItems = multipleReplaceMenuEntries.length
    ? multipleReplaceMenuEntries.map(({ id, label }) => ({
      id: `menu-multiple-replace-run-${id}`,
      label,
      click: () => sendCommand('menu:multiple-replace-definition', id)
    }))
    : [{ label: '无已保存定义', enabled: false }];
  const template = [
    { label: app.name, submenu: [{ role: 'about' }, { label: '捐赠 CotEdit…', click: () => sendCommand('menu:donate') }, { type: 'separator' }, { label: '设置…', accelerator: accelerator('settings'), click: () => sendCommand('menu:settings') }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: '文件', submenu: [
      { label: '新建文稿', accelerator: accelerator('new'), click: () => sendCommand('menu:new') },
      { label: '新建窗口', accelerator: accelerator('newWindow'), click: () => createWindow() },
      { label: '新建标签页', accelerator: accelerator('newTab'), click: () => sendCommand('menu:new-tab') },
      { type: 'separator' },
      { label: '打开…', accelerator: accelerator('open'), click: () => sendCommand('menu:open') },
      { id: 'menu-open-recent', label: '打开最近使用', submenu: [
        ...(recentDocuments.length
          ? recentDocuments.map((filePath, index) => ({
            id: `menu-recent-${index}`,
            label: path.basename(filePath),
            toolTip: filePath,
            click: (_item, browserWindow) => sendCommand('menu:open-recent', filePath, browserWindow)
          }))
          : [{ label: '无最近文稿', enabled: false }]),
        { type: 'separator' },
        { label: '清除菜单', enabled: recentDocuments.length > 0, click: clearRecentDocuments }
      ] },
      { label: '打开文件夹…', accelerator: accelerator('openFolder'), click: () => sendCommand('menu:open-folder') },
      { type: 'separator' },
      { id: 'menu-recover-drafts', label: '恢复未保存文稿…', enabled: false, click: () => sendCommand('menu:recover-drafts') },
      { type: 'separator' },
      { id: 'menu-close-document', label: '关闭文稿', accelerator: accelerator('close'), click: () => sendCommand('menu:close-document') },
      { type: 'separator' },
      { id: 'menu-save', label: '保存', accelerator: accelerator('save'), click: () => sendCommand('menu:save') },
      { id: 'menu-save-as', label: '另存为…', accelerator: accelerator('saveAs'), click: () => sendCommand('menu:save-as') },
      { id: 'menu-revert', label: '恢复到已保存版本', click: () => sendCommand('menu:revert') },
      { id: 'menu-save-all', label: '全部保存', accelerator: accelerator('saveAll'), click: () => sendCommand('menu:save-all') },
      { type: 'separator' },
      { id: 'menu-reveal-file', label: '在文件管理器中显示', click: () => sendCommand('menu:reveal-file') },
      { id: 'menu-copy-path', label: '复制文件路径', click: () => sendCommand('menu:copy-path') },
      ...(process.platform === 'darwin' ? [{ role: 'shareMenu' }] : []),
      { type: 'separator' },
      { label: '导出设置…', click: () => sendCommand('menu:export-settings') },
      { label: '导入设置…', click: () => sendCommand('menu:import-settings') },
      { label: '外部集成设置…', click: () => sendCommand('menu:integration-settings') },
      { type: 'separator' },
      { label: '页面设置…', accelerator: accelerator('pageSetup'), click: () => sendCommand('menu:page-setup') },
      { type: 'separator' },
      { id: 'menu-print', label: '打印…', accelerator: accelerator('print'), click: () => sendCommand('menu:print') }
    ] },
    { label: '编辑', submenu: [
      { id: 'menu-undo', label: '撤销', accelerator: accelerator('undo'), click: () => sendCommand('menu:undo') },
      { id: 'menu-redo', label: '重做', accelerator: accelerator('redo'), click: () => sendCommand('menu:redo') },
      { type: 'separator' }, { role: 'cut' }, { role: 'copy' },
      { id: 'menu-copy-as-rich-text', label: '以富文本复制', accelerator: accelerator('copyAsRichText'), click: () => sendCommand('menu:copy-as-rich-text') },
      { role: 'paste' },
      { label: '拼写和语法', submenu: [
        { id: 'menu-spelling-panel', label: '显示拼写和语法…', enabled: false, toolTip: 'Electron 不提供 CotEditor 的原生拼写面板。' },
        { id: 'menu-check-spelling-now', label: '立即检查文稿', enabled: false, toolTip: '当前编辑器只支持输入时的系统拼写标记。' },
        { type: 'separator' },
        { id: 'menu-toggle-spelling', label: '输入时检查拼写', type: 'checkbox', click: () => sendCommand('menu:toggle-spelling') },
        { id: 'menu-toggle-grammar', label: '同时检查语法', type: 'checkbox', enabled: false, toolTip: 'Electron 没有可移植的系统语法检查接口。' },
        { id: 'menu-toggle-auto-correct', label: '自动更正拼写', type: 'checkbox', enabled: false, toolTip: 'Electron 不提供与 NSTextView 等价的自动更正开关。' }
      ] },
      { id: 'menu-paste-exactly', label: '精确粘贴', accelerator: accelerator('pasteExactly'), click: async () => {
        const text = await clipboard.readText();
        sendCommand('menu:paste-exactly', typeof text === 'string' ? text : '');
      } },
      { type: 'separator' },
      { id: 'menu-delete', label: '删除', click: () => sendCommand('menu:delete') },
      { id: 'menu-insert-backslash', label: '插入反斜线', accelerator: accelerator('insertBackslash'), registerAccelerator: false, click: () => sendCommand('menu:insert-backslash') },
      { id: 'menu-insert-yen-mark', label: '插入日元符号', accelerator: accelerator('insertYenMark'), click: () => sendCommand('menu:insert-yen-mark') },
      { id: 'menu-insert-unicode-code-point', label: '按 Unicode 码点插入…', click: () => sendCommand('menu:insert-unicode-code-point') },
      { label: '选择', submenu: [
        { role: 'selectAll' },
        { id: 'menu-select-word', label: '选择单词', accelerator: accelerator('selectWord'), click: () => sendCommand('menu:select-word') },
        { id: 'menu-select-line', label: '选择行', accelerator: accelerator('selectLine'), click: () => sendCommand('menu:select-line') },
        { id: 'menu-select-enclosing-symbols', label: '选择包围符号内容', click: () => sendCommand('menu:select-enclosing-symbols') },
        { id: 'menu-split-selection-lines', label: '按行拆分选区', accelerator: accelerator('splitSelectionLines'), click: () => sendCommand('menu:split-selection-lines') },
        { id: 'menu-select-column-up', label: '向上选择列', accelerator: accelerator('selectColumnUp'), click: () => sendCommand('menu:select-column-up') },
        { id: 'menu-select-column-down', label: '向下选择列', accelerator: accelerator('selectColumnDown'), click: () => sendCommand('menu:select-column-down') }
      ] },
      { label: '替换', submenu: [
        { id: 'menu-replace-quotes', label: '替换直引号为弯引号', click: () => sendCommand('menu:replace-quotes') },
        { id: 'menu-straighten-quotes', label: '弯引号转为直引号', click: () => sendCommand('menu:straighten-quotes') },
        { id: 'menu-replace-dashes', label: '将双连字符替换为长破折号', click: () => sendCommand('menu:replace-dashes') },
        { id: 'menu-replace-text', label: '替换文本', click: () => sendCommand('menu:replace-text') },
        { id: 'menu-show-substitutions', label: '显示替换面板…', enabled: false, toolTip: 'Electron 没有 CotEditor 使用的系统替换面板。' },
        { type: 'separator' },
        { id: 'menu-smart-quotes', label: '智能引号', type: 'checkbox', click: () => sendCommand('menu:toggle-smart-quotes') },
        { id: 'menu-smart-dashes', label: '智能破折号', type: 'checkbox', click: () => sendCommand('menu:toggle-smart-dashes') },
        { id: 'menu-automatic-text-replacement', label: '文本替换', type: 'checkbox', click: () => sendCommand('menu:toggle-text-replacement') },
        { id: 'menu-smart-copy-paste', label: '智能复制/粘贴', type: 'checkbox', enabled: false, toolTip: '当前编辑器没有 CotEditor 的文本视图智能空格行为。' },
        { id: 'menu-automatic-period', label: '双击空格插入句点', type: 'checkbox', click: () => sendCommand('menu:toggle-automatic-period') }
      ] },
      { label: '语音', submenu: [
        { id: 'menu-speech-start', label: '开始朗读', click: () => sendCommand('menu:speech-start') },
        { id: 'menu-speech-stop', label: '停止朗读', click: () => sendCommand('menu:speech-stop') }
      ] }
    ] },
    { label: '格式', submenu: [
      { label: '行尾', submenu: lineEndingItems },
      { label: '文本编码', submenu: encodingItems },
      { label: '语法', submenu: syntaxItems },
      { id: 'menu-reset-syntax', label: '重置语法分析', accelerator: accelerator('resetSyntax'), click: () => sendCommand('menu:reset-syntax') },
      { type: 'separator' },
      { label: '制表符宽度', submenu: tabWidthItems },
      { label: '当前语法的缩进宽度', submenu: indentWidthItems },
      { label: '字体', submenu: [
        { label: '字体类型', submenu: [
          { id: 'menu-font-type-standard', label: '标准', type: 'radio', click: () => sendCommand('menu:font-type', 'standard') },
        { id: 'menu-font-type-monospaced', label: '等宽', type: 'radio', click: () => sendCommand('menu:font-type', 'monospaced') }
        ] },
        { id: 'menu-show-fonts', label: '显示字体…', click: () => sendCommand('menu:show-fonts') },
        { type: 'separator' },
        { id: 'menu-font-up', label: '增大字体', accelerator: accelerator('fontUp'), registerAccelerator: false, click: () => sendCommand('menu:font-up') },
        { id: 'menu-font-down', label: '减小字体', accelerator: accelerator('fontDown'), registerAccelerator: false, click: () => sendCommand('menu:font-down') },
        { id: 'menu-font-reset', label: '恢复默认字体大小', accelerator: accelerator('fontReset'), registerAccelerator: false, click: () => sendCommand('menu:font-reset') },
        { type: 'separator' },
        { id: 'menu-toggle-ligatures', label: '使用字体连字', type: 'checkbox', click: () => sendCommand('menu:toggle-ligatures') }
      ] },
      { label: '界面外观', submenu: themeItems },
      { type: 'separator' },
      { label: '导入 CotEditor 主题…', click: () => sendCommand('menu:import-cot-theme') },
      { id: 'menu-toggle-invisibles', label: '显示不可见字符', type: 'checkbox', click: () => sendCommand('menu:toggle-invisibles') },
      { id: 'menu-toggle-indent-guides', label: '显示缩进参考线', type: 'checkbox', click: () => sendCommand('menu:toggle-indent-guides') },
      { id: 'menu-toggle-page-guide', label: '显示页导引', type: 'checkbox', click: () => sendCommand('menu:toggle-page-guide') },
      { id: 'menu-toggle-wrap', label: '自动换行', type: 'checkbox', accelerator: accelerator('toggleWrap'), click: () => sendCommand('menu:toggle-wrap') },
      { label: '书写方向', submenu: [
        { label: '方向', enabled: false },
        { id: 'menu-orientation-horizontal', label: '水平', type: 'radio', click: () => sendCommand('menu:orientation-horizontal') },
        { id: 'menu-orientation-vertical', label: '垂直', type: 'radio', click: () => sendCommand('menu:orientation-vertical') },
        { type: 'separator' },
        { label: '文字方向', enabled: false },
        { id: 'menu-writing-direction-ltr', label: '从左到右', type: 'radio', click: () => sendCommand('menu:writing-direction-ltr') },
        { id: 'menu-writing-direction-rtl', label: '从右到左', type: 'radio', click: () => sendCommand('menu:writing-direction-rtl') }
      ] },
      { type: 'separator' },
      { id: 'menu-prevent-editing', label: '防止编辑', type: 'checkbox', click: () => sendCommand('menu:prevent-editing') }
    ] },
    { label: '显示', submenu: [
      { id: 'menu-toggle-tab-bar', label: '显示标签栏', type: 'checkbox', accelerator: accelerator('toggleTabBar'), click: () => sendCommand('menu:toggle-tab-bar') },
      { id: 'menu-toggle-toolbar', label: '显示工具栏', type: 'checkbox', accelerator: accelerator('toggleToolbar'), click: () => sendCommand('menu:toggle-toolbar') },
      { id: 'menu-toggle-navigation-bar', label: '显示导航栏', type: 'checkbox', click: () => sendCommand('menu:toggle-navigation-bar') },
      { id: 'menu-customize-toolbar', label: '自定义工具栏…', click: () => sendCommand('menu:customize-toolbar') },
      { id: 'menu-quick-actions', label: '快速操作…', accelerator: accelerator('quickActions'), registerAccelerator: false, click: () => sendCommand('menu:quick-actions') },
      { type: 'separator' },
      { id: 'menu-toggle-line-numbers', label: '显示行号', type: 'checkbox', click: () => sendCommand('menu:toggle-line-numbers') },
      { label: '侧栏', submenu: [
        { id: 'menu-toggle-sidebar', label: '显示文稿侧栏', type: 'checkbox', accelerator: accelerator('toggleSidebar'), click: () => sendCommand('menu:toggle-sidebar') },
        { type: 'separator' },
        { id: 'menu-folder-browser', label: '文件浏览器', accelerator: accelerator('folderBrowser'), click: () => sendCommand('menu:folder-browser') },
        { id: 'menu-folder-find', label: '文件夹查找', accelerator: accelerator('folderFind'), click: () => sendCommand('menu:folder-find') }
      ] },
      { id: 'menu-toggle-status-bar', label: '显示状态栏', type: 'checkbox', click: () => sendCommand('menu:toggle-status-bar') },
      { id: 'menu-toggle-split', label: '分屏编辑器', type: 'checkbox', click: () => sendCommand('menu:toggle-split') },
      { id: 'menu-close-split', label: '关闭分屏编辑器', click: () => sendCommand('menu:toggle-split') },
      { id: 'menu-focus-next-editor', label: '将焦点移至下一个编辑器', accelerator: accelerator('focusNextEditor'), registerAccelerator: false, click: () => sendCommand('menu:focus-next-editor') },
      { id: 'menu-focus-previous-editor', label: '将焦点移至上一个编辑器', accelerator: accelerator('focusPreviousEditor'), registerAccelerator: false, click: () => sendCommand('menu:focus-previous-editor') },
      { id: 'menu-stack-editors-vertically', label: '垂直堆叠编辑器', type: 'checkbox', click: () => sendCommand('menu:stack-editors-vertically') },
      { type: 'separator' },
      { label: '检查器', submenu: [
        { id: 'menu-document-inspector', label: '文稿检查器', click: () => sendCommand('menu:document-inspector') },
        { id: 'menu-outline', label: '大纲', click: () => sendCommand('menu:outline') },
        { id: 'menu-inspector', label: 'Unicode 字符', click: () => sendCommand('menu:inspector') },
        { id: 'menu-warnings', label: '警告', click: () => sendCommand('menu:warnings') },
        { id: 'menu-toggle-inspector', label: '显示检查器', type: 'checkbox', accelerator: accelerator('toggleInspector'), registerAccelerator: false, click: () => sendCommand('menu:toggle-inspector') }
      ] },
      { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'toggleDevTools' }
    ] },
    { label: '文本', submenu: [
      { label: '插入片段', submenu: [...snippetItems, { type: 'separator' }, { id: 'menu-manage-snippets', label: '管理片段…', click: () => sendCommand('menu:manage-snippets') }] },
      { type: 'separator' },
      { id: 'menu-indent-more', label: '增加缩进', accelerator: accelerator('indentMore'), click: () => sendCommand('menu:indent-more') },
      { id: 'menu-indent-less', label: '减少缩进', accelerator: accelerator('indentLess'), click: () => sendCommand('menu:indent-less') },
      { label: '缩进', submenu: [
        { id: 'menu-indent-to-spaces', label: '将缩进转换为空格', click: () => sendCommand('menu:indent-to-spaces') },
        { id: 'menu-indent-to-tabs', label: '将缩进转换为制表符', click: () => sendCommand('menu:indent-to-tabs') }
      ] },
      { type: 'separator' },
      { label: '注释', submenu: [
        { id: 'menu-toggle-comment', label: '注释掉', accelerator: accelerator('toggleComment'), click: () => sendCommand('menu:toggle-comment') },
        { id: 'menu-comment-out', label: '注释所选内容', click: () => sendCommand('menu:comment-out') },
        { id: 'menu-inline-comment', label: '行注释', click: () => sendCommand('menu:inline-comment') },
        { id: 'menu-block-comment', label: '块注释', click: () => sendCommand('menu:block-comment') },
        { id: 'menu-uncomment', label: '取消注释', click: () => sendCommand('menu:uncomment') }
      ] },
      { id: 'menu-trim-trailing-whitespace', label: '删除行尾空格', click: () => sendCommand('menu:trim-trailing-whitespace') },
      { label: '包围所选内容', submenu: [
        { id: 'menu-surround-single-quotes', label: '单引号', click: () => sendCommand('menu:surround-single-quotes') },
        { id: 'menu-surround-double-quotes', label: '双引号', click: () => sendCommand('menu:surround-double-quotes') },
        { id: 'menu-surround-parentheses', label: '圆括号', click: () => sendCommand('menu:surround-parentheses') },
        { id: 'menu-surround-braces', label: '花括号', click: () => sendCommand('menu:surround-braces') },
        { id: 'menu-surround-brackets', label: '方括号', click: () => sendCommand('menu:surround-brackets') },
        { type: 'separator' },
        { id: 'menu-surround-custom', label: '自定义…', accelerator: accelerator('surroundCustom'), registerAccelerator: false, click: () => sendCommand('menu:surround-custom') }
      ] },
      { label: '行', submenu: [
        { id: 'menu-move-line-up', label: '上移行', accelerator: accelerator('moveLineUp'), click: () => sendCommand('menu:move-line-up') },
        { id: 'menu-move-line-down', label: '下移行', accelerator: accelerator('moveLineDown'), click: () => sendCommand('menu:move-line-down') },
        { type: 'separator' },
        { id: 'menu-sort-lines', label: '排序', click: () => sendCommand('menu:sort-lines') },
        { id: 'menu-sort-by-pattern', label: '按模式排序…', click: () => sendCommand('menu:sort-by-pattern') },
        { id: 'menu-reverse-lines', label: '反转', click: () => sendCommand('menu:reverse-lines') },
        { id: 'menu-shuffle-lines', label: '随机打乱', click: () => sendCommand('menu:shuffle-lines') },
        { id: 'menu-delete-duplicates', label: '删除重复项', click: () => sendCommand('menu:delete-duplicates') },
        { type: 'separator' },
        { id: 'menu-duplicate-line', label: '复制行', accelerator: accelerator('duplicateLine'), click: () => sendCommand('menu:duplicate-line') },
        { id: 'menu-delete-line', label: '删除行', accelerator: accelerator('deleteLine'), click: () => sendCommand('menu:delete-line') },
        { id: 'menu-join-current-lines', label: '合并当前行与下一行', accelerator: accelerator('joinCurrentLines'), click: () => sendCommand('menu:join-current-lines') },
        { id: 'menu-join-lines', label: '合并所选行', click: () => sendCommand('menu:join-lines') }
      ] },
      { type: 'separator' },
      { id: 'menu-complete', label: '文本补全', accelerator: accelerator('complete'), click: () => sendCommand('menu:complete') },
      { label: '文本转换', submenu: [
        { id: 'menu-uppercase', label: '转换为大写', click: () => sendCommand('menu:uppercase') },
        { id: 'menu-lowercase', label: '转换为小写', click: () => sendCommand('menu:lowercase') },
        { id: 'menu-capitalize', label: '首字母大写', click: () => sendCommand('menu:capitalize') },
        { id: 'menu-fullwidth', label: '转换为全角', click: () => sendCommand('menu:fullwidth') },
        { id: 'menu-halfwidth', label: '转换为半角', click: () => sendCommand('menu:halfwidth') },
        { id: 'menu-fullwidth-roman', label: '字母数字转换为全角', click: () => sendCommand('menu:fullwidth-roman') },
        { id: 'menu-halfwidth-roman', label: '字母数字转换为半角', click: () => sendCommand('menu:halfwidth-roman') },
        { type: 'separator' },
        { label: 'URL', submenu: [
          { id: 'menu-url-encode', label: 'URL 编码', click: () => sendCommand('menu:url-encode') },
          { id: 'menu-url-decode', label: 'URL 解码', click: () => sendCommand('menu:url-decode') }
        ] }
      ] },
      { label: 'Unicode 规范化', submenu: [
        { id: 'menu-normalize-nfd', label: 'NFD（规范分解）', click: () => sendCommand('menu:unicode-nfd') },
        { id: 'menu-normalize-nfc', label: 'NFC（规范分解后合成）', click: () => sendCommand('menu:unicode-nfc') },
        { id: 'menu-normalize-nfkd', label: 'NFKD（兼容分解）', click: () => sendCommand('menu:unicode-nfkd') },
        { id: 'menu-normalize-nfkc', label: 'NFKC（兼容分解后合成）', click: () => sendCommand('menu:unicode-nfkc') },
        { id: 'menu-normalize-nfkc-casefold', label: 'NFKC Case-Fold', click: () => sendCommand('menu:unicode-nfkc-casefold') },
        { type: 'separator' },
        { id: 'menu-normalize-modified-nfd', label: 'Modified NFD（HFS+ 规范分解）', click: () => sendCommand('menu:unicode-modified-nfd') },
        { id: 'menu-normalize-modified-nfc', label: 'Modified NFC（HFS+ 规范合成）', click: () => sendCommand('menu:unicode-modified-nfc') }
      ] },
      { type: 'separator' },
      { id: 'menu-inspect-character', label: '显示字符', accelerator: accelerator('inspectCharacter'), click: () => sendCommand('menu:inspect-character') },
      { id: 'menu-advanced-character-count', label: '高级字符计数…', click: () => sendCommand('menu:advanced-character-count') },
      { id: 'menu-edit-color-code', label: '编辑颜色代码…', accelerator: accelerator('editColorCode'), click: () => sendCommand('menu:edit-color-code') },
    ] },
    { label: '查找', submenu: [
      { id: 'menu-find', label: '查找与替换…', accelerator: accelerator('find'), click: () => sendCommand('menu:find') },
      { id: 'menu-find-next', label: '查找下一个', accelerator: accelerator('findNext'), click: () => sendCommand('menu:find-next') },
      { id: 'menu-find-previous', label: '查找上一个', accelerator: accelerator('findPrevious'), click: () => sendCommand('menu:find-previous') },
      { id: 'menu-find-all', label: '查找全部匹配项', accelerator: accelerator('findAll'), click: () => sendCommand('menu:find-all') },
      { id: 'menu-select-all-find-matches', label: '选择所有查找匹配项', click: () => sendCommand('menu:select-all-find-matches') },
      { type: 'separator' },
      { id: 'menu-use-selection-for-find', label: '将选区用于查找', accelerator: accelerator('useSelectionForFind'), click: () => sendCommand('menu:use-selection-for-find') },
      { id: 'menu-use-selection-for-replace', label: '将选区用于替换', accelerator: accelerator('useSelectionForReplace'), click: () => sendCommand('menu:use-selection-for-replace') },
      { id: 'menu-jump-to-selection', label: '跳转到选区', accelerator: accelerator('jumpToSelection'), click: () => sendCommand('menu:jump-to-selection') },
      { type: 'separator' },
      { id: 'menu-replace', label: '替换…', click: () => sendCommand('menu:replace') },
      { id: 'menu-replace-next', label: '替换并查找下一个', accelerator: accelerator('replaceAndFindNext'), click: () => sendCommand('menu:replace-next') },
      { id: 'menu-replace-all', label: '全部替换', click: () => sendCommand('menu:replace-all') },
      { label: '多重替换', submenu: [
        ...multipleReplaceItems,
        { type: 'separator' },
        { id: 'menu-multiple-replace', label: '管理多重替换…', click: () => sendCommand('menu:multiple-replace') }
      ] },
      { type: 'separator' },
      { id: 'menu-highlight-all', label: '高亮全部匹配项', accelerator: accelerator('highlightAll'), click: () => sendCommand('menu:highlight-all') },
      { id: 'menu-remove-highlights', label: '移除高亮', accelerator: accelerator('removeHighlights'), click: () => sendCommand('menu:remove-highlights') },
      { type: 'separator' },
      { id: 'menu-search-folder', label: '在文件夹中查找…', accelerator: accelerator('searchFolder'), click: () => sendCommand('menu:search-folder') },
      { id: 'menu-open-outline-menu', label: '打开大纲菜单', accelerator: accelerator('openOutlineMenu'), click: () => sendCommand('menu:open-outline-menu') },
      { id: 'menu-select-previous-outline-item', label: '选择上一个大纲项', accelerator: accelerator('selectPreviousOutlineItem'), click: () => sendCommand('menu:select-previous-outline-item') },
      { id: 'menu-select-next-outline-item', label: '选择下一个大纲项', accelerator: accelerator('selectNextOutlineItem'), click: () => sendCommand('menu:select-next-outline-item') },
      { id: 'menu-go-to-line', label: '转到行…', accelerator: accelerator('goToLine'), registerAccelerator: false, click: () => sendCommand('menu:go-to-line') }
    ] },
    { label: '窗口', submenu: [
      { id: 'menu-previous-document', label: '上一个文稿', accelerator: accelerator('previousDocument'), click: () => sendCommand('menu:previous-document') },
      { id: 'menu-next-document', label: '下一个文稿', accelerator: accelerator('nextDocument'), click: () => sendCommand('menu:next-document') },
      { type: 'separator' },
      { id: 'menu-keep-on-top', label: '窗口置顶', type: 'checkbox', click: (_item, browserWindow) => {
        const window = targetWindow(browserWindow);
        if (!window) return;
        toggleAlwaysOnTop(window);
        updateMenuState(windowMenuStates.get(window.id) || {}, window);
      } },
      { id: 'menu-bring-all-to-front', label: '将所有窗口置于前面', click: () => bringAllWindowsToFront(BrowserWindow.getAllWindows()) },
      { type: 'separator' }, { role: 'minimize' }, { role: 'zoom' }
    ] },
    { label: '脚本', submenu: [
      ...scriptItems,
      { type: 'separator' },
      { label: '打开脚本文件夹…', click: () => openUserScriptsFolder().catch(error => console.error('Failed to open script folder:', error)) },
      { label: '重新加载脚本', click: () => reloadUserScripts().catch(error => console.error('Failed to reload scripts:', error)) }
    ] },
    { label: '帮助', submenu: [
      { label: 'CotEdit 使用说明', click: () => sendCommand('menu:help') },
      { label: '键盘快捷键', click: () => sendCommand('menu:shortcuts') },
      { type: 'separator' },
      { label: '新版本动态…', click: () => openProjectHelpPage('releases') },
      { label: '发行说明…', click: () => openProjectHelpPage('releases') },
      { label: '报告问题…', click: () => openProjectHelpPage('issues') },
      { label: 'CotEdit 项目主页', click: () => openProjectHelpPage('home') }
    ] }
  ];
  decorateMenuShortcutLabels(template, { ...defaultMenuShortcutBindings(), ...userShortcutBindings }, process.platform, shortcutCaptureActive);
  disableCustomAcceleratorRegistration(template);
  quickActionRegistry = collectQuickActionMenuItems(template, { ignoreIds: ['menu-quick-actions'], rootLabel: app.name });
  applicationMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(applicationMenu);
  updateMenuState(currentMenuState);
}

function updateMenuState(payload = {}, window = BrowserWindow.getFocusedWindow() || mainWindow) {
  const state = {
    hasDocument: payload.hasDocument === true,
    dirty: payload.dirty === true,
    canSave: payload.canSave === true,
    dirtyDocumentCount: Number.isInteger(payload.dirtyDocumentCount) ? Math.max(0, Math.min(payload.dirtyDocumentCount, 1000)) : 0,
    saveableDocumentCount: Number.isInteger(payload.saveableDocumentCount) ? Math.max(0, Math.min(payload.saveableDocumentCount, 1000)) : 0,
    canUndo: payload.canUndo === true,
    canRedo: payload.canRedo === true,
    hasSelection: payload.hasSelection === true,
    toggleCommentUncommentable: payload.toggleCommentUncommentable === true,
    canInspectCharacter: payload.canInspectCharacter === true,
    continuousSpellChecking: payload.continuousSpellChecking === true,
    smartQuotes: payload.smartQuotes === true,
    smartDashes: payload.smartDashes === true,
    automaticTextReplacement: payload.automaticTextReplacement === true,
    speechAvailable: payload.speechAvailable === true,
    hasSpeechText: payload.hasSpeechText === true,
    speechActive: payload.speechActive === true,
    inspectorVisible: payload.inspectorVisible === true,
    hasAnySelection: payload.hasAnySelection === true,
    hasRichTextSelection: payload.hasRichTextSelection === true,
    hasSearchQuery: payload.hasSearchQuery === true,
    hasSearchHighlights: payload.hasSearchHighlights === true,
    hasMappingConflicts: payload.hasMappingConflicts === true,
    language: typeof payload.language === 'string' ? payload.language : 'plaintext',
    hiddenSyntaxes: Array.isArray(payload.hiddenSyntaxes)
      ? payload.hiddenSyntaxes.filter(id => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,80}$/i.test(id)).slice(0, 200).map(id => id.toLowerCase())
      : [],
    encoding: typeof payload.encoding === 'string' ? payload.encoding : null,
    eol: ['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS', 'Mixed'].includes(payload.eol) ? payload.eol : null,
    indent: payload.indent === 'tab' || (typeof payload.indent === 'string' && /^[1-9]\d?$/.test(payload.indent)) ? payload.indent : 'tab',
    hasIndentOverride: payload.hasIndentOverride === true,
    tabWidth: Number.isInteger(payload.tabWidth) ? Math.max(1, Math.min(payload.tabWidth, 99)) : 4,
    theme: ['system', 'light', 'dark'].includes(payload.theme) ? payload.theme : 'system',
    wrap: payload.wrap === true,
    verticalText: payload.verticalText === true,
    ligatures: payload.ligatures !== false,
    fontType: payload.fontType === 'standard' ? 'standard' : 'monospaced',
    showLineNumbers: payload.showLineNumbers === true,
    writingDirection: payload.writingDirection === 'rtl' ? 'rtl' : 'ltr',
    showInvisibles: payload.showInvisibles === true,
    showIndentGuides: payload.showIndentGuides === true,
    showPageGuide: payload.showPageGuide === true,
    showSidebar: payload.showSidebar !== false,
    showStatusBar: payload.showStatusBar !== false,
    showTabBar: payload.showTabBar !== false,
    showToolbar: payload.showToolbar !== false,
    hasPath: payload.hasPath === true,
    splitEnabled: payload.splitEnabled === true,
    splitEditorsVertically: payload.splitEditorsVertically === true,
    preventEditing: payload.preventEditing === true,
    documentCount: Number.isInteger(payload.documentCount) ? Math.max(0, Math.min(payload.documentCount, 1000)) : 0,
    advancedCountActive: payload.advancedCountActive === true,
    alwaysOnTop: Boolean(window && !window.isDestroyed() && window.isAlwaysOnTop())
  };
  currentMenuState = state;
  const setItem = (id, flags = {}) => {
    const item = applicationMenu?.getMenuItemById(id);
    if (!item) return;
    const { enabled, checked, visible } = flags;
    if (typeof enabled === 'boolean') item.enabled = enabled;
    if (typeof checked === 'boolean') item.checked = checked;
    if (typeof visible === 'boolean') item.visible = visible;
    if (typeof flags.label === 'string') item.label = flags.label;
  };
  for (const [id, flags] of Object.entries(getMenuItemStates(state))) setItem(id, flags);
  for (const [item, flags] of Object.entries(getSyntaxMenuItemStates(menuItemIds('menu-syntax-'), state))) setItem(item, flags);
  for (const [item, flags] of Object.entries(getSnippetMenuItemStates(menuItemIds('menu-snippet-'), state))) setItem(item, flags);
  for (const [item, flags] of Object.entries(getMultipleReplaceMenuItemStates(menuItemIds('menu-multiple-replace-run-'), state))) setItem(item, flags);
  for (const item of menuItemIds('menu-encoding-')) setItem(item, { enabled: state.hasDocument, checked: item === `menu-encoding-${state.encoding}` });
  for (const value of ['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS']) setItem(`menu-eol-${value}`, { enabled: state.hasDocument, checked: value === state.eol });
  setItem('menu-inspect-line-endings', { enabled: state.hasDocument && state.eol === 'Mixed' });
  for (const value of ['tab', '2', '4', '8']) setItem(`menu-indent-width-${value}`, { enabled: state.hasDocument, checked: value === state.indent });
  setItem('menu-indent-width-custom', { enabled: state.hasDocument, checked: !['tab', '2', '4', '8'].includes(state.indent) });
  setItem('menu-indent-width-global', { enabled: state.hasDocument, checked: !state.hasIndentOverride });
  for (const value of ['2', '4', '8']) setItem(`menu-tab-width-${value}`, { enabled: true, checked: Number(value) === state.tabWidth });
  setItem('menu-tab-width-custom', { enabled: true, checked: ![2, 4, 8].includes(state.tabWidth) });
  for (const value of ['system', 'light', 'dark']) setItem(`menu-theme-${value}`, { enabled: true, checked: value === state.theme });
  setItem('menu-previous-document', { enabled: state.documentCount > 1 });
  for (const item of menuItemIds('menu-script-run-')) setItem(item, { enabled: state.hasDocument });
  setItem('menu-next-document', { enabled: state.documentCount > 1 });
}

function menuItemIds(prefix) {
  const ids = [];
  const visit = items => items?.forEach(item => {
    if (typeof item.id === 'string' && item.id.startsWith(prefix)) ids.push(item.id);
    if (item.submenu) visit(item.submenu.items);
  });
  visit(applicationMenu?.items);
  return ids;
}

ipcMain.handle('quick-actions:list', () => quickActionRegistry.entries.map(entry => {
  const item = applicationMenu?.getMenuItemById(entry.id);
  return { ...entry, label: item?.label || entry.label, enabled: Boolean(item && item.enabled !== false && item.visible !== false) };
}));
ipcMain.handle('quick-actions:execute', (event, id) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return false;
  try { return executeQuickActionMenuItem(quickActionRegistry, id, applicationMenu, window); }
  catch (error) { console.error('Failed to run Quick Action:', error); return false; }
});
ipcMain.handle('file-drop:format', (_event, paths, documentPath, syntaxId, rules) => formatDroppedFilePaths(paths, documentPath, syntaxId, process.platform, rules));

ipcMain.handle('document:open', async event => {
  const result = await dialog.showOpenDialog(windowForEvent(event), {
    title: '打开文稿',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '文本与代码', extensions: ['txt','text','md','markdown','mdx','json','js','mjs','cjs','ts','tsx','jsx','html','htm','svg','css','scss','less','py','pyw','rb','rake','php','java','c','h','cc','cpp','hpp','rs','cs','m','mm','go','swift','kt','kts','scala','dart','sh','bash','zsh','ps1','pl','pm','lua','r','clj','hs','groovy','jl','erl','fs','ml','sml','f90','coffee','dockerfile','toml','ini','properties','diff','patch','proto','cmake','vhd','vhdl','sv','sql','xml','yaml','yml','log','conf','vue','svelte','cob','cbl','lisp','cr','cql','e','elm','feature','hx','ls','sas','st','rq','tcl','webidl','xq','xquery','ttl','pug','vbs','z80'] }, { name: '所有文件', extensions: ['*'] }]
  });
  if (result.canceled) return [];
  const documents = await Promise.all(result.filePaths.map(readDocument));
  for (const filePath of result.filePaths) await recordRecentDocument(filePath);
  return documents;
});

ipcMain.handle('document:open-external-path', async (_event, requestedPath) => {
  if (typeof requestedPath !== 'string' || !path.isAbsolute(requestedPath)) throw new Error('外部文稿路径无效。');
  const resolved = path.resolve(requestedPath);
  const document = await readDocument(resolved);
  await recordRecentDocument(resolved);
  return document;
});

ipcMain.handle('external:open-url', async (_event, requestedUrl) => {
  const url = normalizeExternalWebUrl(requestedUrl);
  if (!url) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('document:open-path', async (event, requestedPath, options = {}) => {
  const selectedRoot = directoryRootFor(event);
  if (typeof requestedPath !== 'string' || !selectedRoot) throw new Error('没有可打开的文件夹项目。');
  const openedRoot = await resolveWithinRoot(selectedRoot, requestedPath, {
    invalid: '没有可打开的文件夹项目。',
    outOfRange: '打开路径超出已选文件夹范围。',
    escaped: '打开路径通过符号链接离开了已选文件夹。'
  });
  const plainText = options?.plainText === true;
  const editable = plainText
    ? await resolveRegularFileInRoot(openedRoot.root, openedRoot.path)
    : await resolveEditableFileInRoot(openedRoot.root, openedRoot.path);
  const document = await readDocument(editable.path, { allowBinaryText: plainText });
  await recordRecentDocument(editable.path);
  return { ...document, plainText };
});

ipcMain.handle('document:open-recent', async (_event, requestedPath) => {
  if (typeof requestedPath !== 'string') throw new Error('最近文稿路径无效。');
  const resolved = path.resolve(requestedPath);
  const compare = value => process.platform === 'win32' ? value.toLocaleLowerCase('en-US') : value;
  if (!recentDocuments.some(filePath => compare(path.resolve(filePath)) === compare(resolved))) {
    throw new Error('该路径不在最近文稿列表中。');
  }
  const document = await readDocument(resolved);
  await recordRecentDocument(resolved);
  return document;
});

ipcMain.handle('document:check-encoding', (_event, payload = {}) => {
  const text = safeText(payload?.text);
  const encoding = normalizeEncoding(payload?.encoding || 'utf8');
  return findIncompatibleCharacters(text, encoding);
});

ipcMain.handle('document:count-encoded-bytes', (event, payload = {}) => {
  const window = BrowserWindow.fromWebContents(event?.sender);
  if (!window || !appWindows.has(window) || window.isDestroyed()) throw new Error('字节统计请求来自未知窗口。');
  const strings = payload?.strings;
  if (!Array.isArray(strings) || strings.length > 256) throw new Error('字节统计文本范围无效。');
  const encoding = normalizeEncoding(payload?.encoding || 'utf8');
  let totalCodeUnits = 0;
  let count = 0;
  for (const value of strings) {
    if (typeof value !== 'string') throw new Error('字节统计文本格式无效。');
    totalCodeUnits += value.length;
    if (totalCodeUnits > 12_000_000) return { count: null, error: '一次最多统计 1,200 万个 UTF-16 代码单元。' };
    try {
      count += encodeText(value, encoding).length;
    } catch (error) {
      return { count: null, error: error.message || `文本无法使用 ${encoding} 无损编码。` };
    }
  }
  return { count, error: null };
});

ipcMain.handle('document:reveal', async (_event, requestedPath) => {
  if (typeof requestedPath !== 'string' || !requestedPath) throw new Error('文稿路径无效。');
  const resolved = path.resolve(requestedPath);
  await fs.access(resolved);
  shell.showItemInFolder(resolved);
  return true;
});

ipcMain.handle('document:copy-path', (_event, requestedPath) => {
  if (typeof requestedPath !== 'string' || !requestedPath) throw new Error('文稿路径无效。');
  clipboard.writeText(path.resolve(requestedPath));
  return true;
});
ipcMain.handle('document:copy-remote-path', (_event, remotePath) => {
  if (typeof remotePath !== 'string' || !remotePath) throw new Error('远程文稿路径无效。');
  clipboard.writeText(safeText(remotePath, 4096));
  return true;
});

ipcMain.handle('script:list', async () => reloadUserScripts());
ipcMain.handle('script:get', async (_event, requestedId) => {
  await reloadUserScripts();
  const script = findUserScript(userScripts, requestedId);
  if (!script) throw new Error('脚本不存在或已被移除。');
  return { name: script.name, source: script.source };
});
ipcMain.handle('script:open-folder', () => openUserScriptsFolder());

ipcMain.handle('theme:import', async event => {
  const result = await dialog.showOpenDialog(windowForEvent(event), {
    title: '导入 CotEditor 主题',
    properties: ['openFile'],
    filters: [{ name: 'CotEditor 主题', extensions: ['cottheme', 'json'] }, { name: '所有文件', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filename = result.filePaths[0];
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > MAX_THEME_BYTES) throw new Error('主题文件无效或超过 256 KB。');
  const value = JSON.parse(await fs.readFile(filename, 'utf8'));
  return normalizeCotEditorTheme(value, path.basename(filename, path.extname(filename)));
});

ipcMain.handle('syntax:import', async event => {
  const result = await dialog.showOpenDialog(windowForEvent(event), {
    title: '导入 CotEditor 语法',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return loadCotEditorSyntax(result.filePaths[0]);
});
ipcMain.handle('syntax:import-dropped', async (_event, directories) => loadCotEditorSyntaxPackages(directories));

ipcMain.on('syntax:menu-update', (_event, entries) => {
  const seen = new Set();
  customSyntaxMenuEntries = (Array.isArray(entries) ? entries : []).slice(0, 20).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^cot-syntax-[a-z0-9-]{1,56}$/.test(entry.id) || seen.has(entry.id)) return [];
    const label = typeof entry.label === 'string' ? entry.label.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 96) : '';
    if (!label) return [];
    seen.add(entry.id);
    return [{ id: entry.id, label }];
  });
  if (applicationMenu) buildMenu();
});

ipcMain.on('snippet:menu-update', (event, entries) => {
  const seen = new Set();
  const sanitizedEntries = (Array.isArray(entries) ? entries : []).slice(0, 100).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(entry.id) || seen.has(entry.id)) return [];
    const label = typeof entry.label === 'string' ? entry.label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 96) : '';
    if (!label) return [];
    const rawShortcut = entry.shortcut;
    const shortcut = normalizeShortcutBindings({ snippet: rawShortcut }, [{ id: 'snippet' }]).snippet || null;
    seen.add(entry.id);
    return [{ id: entry.id, label, ...(shortcut ? { shortcut } : {}) }];
  });
  windowSnippetMenuEntries.set(event.sender.id, sanitizedEntries);
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && (senderWindow === BrowserWindow.getFocusedWindow() || senderWindow === mainWindow)) {
    snippetMenuEntries = sanitizedEntries;
    if (applicationMenu) buildMenu();
  }
});

ipcMain.on('multiple-replace:menu-update', (event, entries) => {
  const sanitizedEntries = normalizeMultipleReplaceMenuEntries(entries);
  windowMultipleReplaceMenuEntries.set(event.sender.id, sanitizedEntries);
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && (senderWindow === BrowserWindow.getFocusedWindow() || senderWindow === mainWindow)) {
    multipleReplaceMenuEntries = sanitizedEntries;
    if (applicationMenu) buildMenu();
  }
});

ipcMain.handle('directory:choose', async event => {
  const result = await dialog.showOpenDialog(windowForEvent(event), { title: '打开文件夹', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  const selectedRoot = await fs.realpath(result.filePaths[0]);
  if (!(await fs.stat(selectedRoot)).isDirectory()) throw new Error('所选路径不是文件夹。');
  directoryRoots.set(event.sender, selectedRoot);
  return selectedRoot;
});

ipcMain.handle('directory:list', async (event, payload = {}) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  const options = payload && typeof payload === 'object' ? payload : {};
  const requestedPath = typeof options.path === 'string' ? options.path : selectedRoot;
  return listDirectory(selectedRoot, requestedPath, { nameFilter: options.nameFilter });
});

ipcMain.handle('directory:create-entry', async (event, payload = {}) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('新建项目请求无效。');
  const requestedPath = typeof payload.path === 'string' ? payload.path : '';
  const locale = app.getLocale();
  if (payload.kind === 'file') return createFileInRoot(selectedRoot, requestedPath, locale, payload.extension);
  if (payload.kind === 'directory') return createFolderInRoot(selectedRoot, requestedPath, locale);
  throw new Error('新建项目类型无效。');
});

ipcMain.handle('directory:preview', async (event, requestedPath) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  return previewFileInRoot(selectedRoot, requestedPath);
});

ipcMain.handle('directory:open-in-new-window', async (event, requestedPath) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  const { path: filePath } = await resolveEditableFileInRoot(selectedRoot, requestedPath);
  const window = createWindow();
  queueExternalOpenPath(filePath, window);
  return true;
});

ipcMain.handle('directory:open-external', async (event, requestedPath) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  return openExternalFileInRoot(selectedRoot, requestedPath, filePath => shell.openPath(filePath));
});
ipcMain.handle('directory:open-with-application', async (event, requestedPath) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  await resolveRegularFileInRoot(selectedRoot, requestedPath);
  const options = createExternalApplicationDialogOptions();
  const result = await dialog.showOpenDialog(windowForEvent(event), options);
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  await openFileWithApplicationInRoot(selectedRoot, requestedPath, result.filePaths[0]);
  return { canceled: false };
});
ipcMain.handle('directory:list-external-applications', async (event, requestedPath) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  return listExternalApplicationsInRoot(selectedRoot, requestedPath, {
    platform: process.platform,
    env: process.env,
    home: app.getPath('home'),
    locale: app.getLocale()
  });
});
ipcMain.handle('directory:open-registered-application', async (event, payload = {}) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('外部应用请求无效。');
  return openFileWithRegisteredApplicationInRoot(selectedRoot, payload.path, payload.applicationId, {
    platform: process.platform,
    env: process.env,
    home: app.getPath('home'),
    locale: app.getLocale()
  });
});
ipcMain.handle('directory:search', async (event, payload = {}) => {
  const selectedRoot = directoryRootFor(event);
  if (!selectedRoot) throw new Error('请先打开文件夹。');
  const query = safeText(payload.query || '', 1000);
  return searchDirectory(selectedRoot, { query, regexp: payload.regexp === true, caseSensitive: payload.caseSensitive === true });
});

ipcMain.handle('remote:get-settings', () => getRemoteEditingSettings());
ipcMain.handle('remote:configure', async (_event, value) => configureRemoteEditing(value));
ipcMain.handle('remote:save', async (_event, payload = {}) => {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
  if (!sessionId || sessionId.length > 64) throw new Error('远程文稿会话无效。');
  const text = safeText(payload.text);
  const encoding = normalizeEncoding(payload.encoding || 'utf8');
  const data = encodeText(text, encoding, payload.bom === true);
  if (data.length > MAX_RMATE_FILE_BYTES) throw new Error('远程文稿超过 100 MiB 大小限制。');
  await remoteEditingServer.save(sessionId, data);
  return { success: true };
});
ipcMain.handle('remote:close', (_event, sessionId) => {
  if (typeof sessionId !== 'string' || sessionId.length > 64) return false;
  return remoteEditingServer.closeFile(sessionId);
});

ipcMain.handle('document:save', async (event, payload) => {
  const text = safeText(payload?.text);
  let filePath = typeof payload?.path === 'string' ? payload.path : '';
  if (!filePath) {
    const result = await dialog.showSaveDialog(windowForEvent(event), {
      title: '保存文稿',
      defaultPath: typeof payload?.name === 'string' ? payload.name : '未命名.txt',
      filters: [{ name: '文本文件', extensions: ['txt'] }, { name: '所有文件', extensions: ['*'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    filePath = result.filePath;
  }
  const encoding = normalizeEncoding(payload?.encoding || 'utf8');
  const fileSizeBytes = await atomicWrite(filePath, text, encoding, payload?.bom === true);
  const fileTags = await readFinderTags(filePath);
  let fileMetadata = { ...documentFileTimestamps(null), filePermissions: null, fileOwnerIds: null };
  try {
    const stat = await fs.stat(filePath);
    fileMetadata = { ...documentFileTimestamps(stat), filePermissions: documentFilePermissions(stat), fileOwnerIds: documentFileOwnerIds(stat) };
  } catch {
    // The file is already saved; unavailable optional metadata must not turn it into a failed save.
  }
  await recordRecentDocument(filePath);
  return { canceled: false, path: filePath, name: path.basename(filePath), encoding, bom: payload?.bom === true, fileSizeBytes, ...fileMetadata, fileTags };
});

ipcMain.handle('settings:export', async (event, settings) => {
  const { serializeSettingsFile } = await import('../lib/settings-file.js');
  const result = await dialog.showSaveDialog(windowForEvent(event), {
    title: '导出 CotEdit 设置',
    defaultPath: 'CotEdit-settings.json',
    filters: [{ name: 'CotEdit 设置', extensions: ['json'] }, { name: '所有文件', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await atomicWrite(result.filePath, serializeSettingsFile(settings), 'utf8');
  return { canceled: false, path: result.filePath };
});

ipcMain.handle('settings:import', async event => {
  const { MAX_SETTINGS_FILE_BYTES, parseSettingsFile } = await import('../lib/settings-file.js');
  const result = await dialog.showOpenDialog(windowForEvent(event), {
    title: '导入 CotEdit 设置',
    properties: ['openFile'],
    filters: [{ name: 'CotEdit 设置', extensions: ['json'] }, { name: '所有文件', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > MAX_SETTINGS_FILE_BYTES) throw new Error('设置文件过大或不是普通文件。');
  const source = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  return { canceled: false, settings: parseSettingsFile(source) };
});

ipcMain.handle('recovery:list', async event => {
  recoveryWindowFromEvent(event);
  return markRecoveryDraftUse(await getRecoveryStore().list());
});

ipcMain.handle('recovery:replace-window', async (event, drafts) => {
  const window = recoveryWindowFromEvent(event);
  const result = await getRecoveryStore().replaceWindow(String(window.id), drafts);
  recoveryOwnership.claim(window.id, drafts);
  notifyRecoveryStoreChanged();
  return markRecoveryDraftUse(result);
});

ipcMain.handle('recovery:import-legacy', async (event, sessions) => {
  recoveryWindowFromEvent(event);
  const result = await getRecoveryStore().importLegacy(sessions);
  if (result.imported) notifyRecoveryStoreChanged();
  result.drafts = markRecoveryDraftUse(result.drafts);
  return result;
});

ipcMain.handle('recovery:remove', async (event, ids) => {
  recoveryWindowFromEvent(event);
  const active = recoveryOwnership.activeIds();
  if (Array.isArray(ids) && ids.some(id => active.has(id))) throw new Error('其中有恢复文稿正在其他窗口中编辑；请先保存或关闭它。');
  const result = await getRecoveryStore().remove(ids);
  notifyRecoveryStoreChanged();
  return markRecoveryDraftUse(result);
});

ipcMain.handle('recovery:clear', async event => {
  recoveryWindowFromEvent(event);
  if (recoveryOwnership.activeIds().size) throw new Error('有恢复文稿仍在窗口中编辑；请先保存或关闭它们，再清理全部。');
  const result = await getRecoveryStore().clear();
  notifyRecoveryStoreChanged();
  return markRecoveryDraftUse(result);
});

ipcMain.handle('window:new', () => { createWindow(); return true; });

ipcMain.handle('document:print', async (event, payload = {}) => {
  const parent = windowForEvent(event);
  if (!parent || parent.isDestroyed()) return { success: false, error: '窗口已关闭。' };
  let text = safeText(payload?.text);
  const name = typeof payload?.name === 'string' ? payload.name.slice(0, 512) : 'CotEdit.txt';
  let startLine = 1;
  const printPath = path.join(app.getPath('temp'), `cotedit-print-${crypto.randomUUID()}.html`);
  let printWindow;
  try {
    const pageSetup = payload?.pageSetup && typeof payload.pageSetup === 'object' ? payload.pageSetup : {};
    const selectionText = safeText(payload?.selectionText);
    if (selectionText) {
      const scope = await dialog.showMessageBox(parent, {
        type: 'question', title: '打印范围', message: '当前有选中的文本。选择本次打印范围。',
        buttons: ['打印整个文稿', '仅打印选中内容', '取消'], defaultId: 0, cancelId: 2, noLink: true
      });
      if (scope.response === 2) return { success: false, canceled: true };
      if (scope.response === 1) {
        text = selectionText;
        startLine = Number.isSafeInteger(payload?.selectionStartLine) && payload.selectionStartLine > 0
          ? payload.selectionStartLine
          : 1;
      }
    }
    await fs.writeFile(printPath, buildPrintHTML({ name, text, pageSetup, startLine }), { flag: 'wx', mode: 0o600 });
    printWindow = new BrowserWindow({
      parent,
      show: false,
      width: 800,
      height: 1000,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    await printWindow.loadFile(printPath);
    return await new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      printWindow.once('closed', () => finish({ success: false, error: '打印窗口已关闭。' }));
      printWindow.webContents.print({ silent: false, printBackground: true, ...printOptions(pageSetup) }, (success, failureReason) => {
        finish({ success, error: failureReason || null });
      });
    });
  } catch (error) {
    return { success: false, error: error.message || '打印失败。' };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    await fs.rm(printPath, { force: true }).catch(() => {});
  }
});

ipcMain.handle('clipboard:write-rich-text', async (event, payload = {}) => {
  const window = BrowserWindow.fromWebContents(event?.sender);
  if (!window || !appWindows.has(window) || window.isDestroyed()) return false;
  const formats = buildRichTextClipboardFormats(payload);
  if (!formats) return false;
  try {
    await clipboard.write([new ClipboardItem(formats)]);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle('window:set-title', (event, title) => {
  if (typeof title !== 'string') return;
  windowForEvent(event)?.setTitle(`CotEdit — ${title.slice(0, 180)}`);
});
ipcMain.handle('window:set-size', (event, size) => {
  const window = BrowserWindow.fromWebContents(event?.sender);
  if (!window || !appWindows.has(window) || window.isDestroyed()) return false;
  return applyWindowSize(window, size);
});
ipcMain.handle('window:show-ready', event => {
  const window = BrowserWindow.fromWebContents(event?.sender);
  if (!window || !appWindows.has(window) || window.isDestroyed()) return false;
  const [width, height] = window.getSize();
  window.webContents.send('window:size-changed', { width, height });
  if (!window.isVisible()) window.show();
  return true;
});

ipcMain.on('menu:update-state', (event, state) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !appWindows.has(window) || !state || typeof state !== 'object' || Array.isArray(state)) return;
  windowMenuStates.set(window.id, state);
  if (window === BrowserWindow.getFocusedWindow() || !BrowserWindow.getFocusedWindow()) updateMenuState(state, window);
});

ipcMain.on('shortcuts:update', (event, bindings) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !appWindows.has(window)) return;
  const normalized = normalizeShortcutBindings(bindings, SHORTCUTS);
  if (JSON.stringify(normalized) === JSON.stringify(userShortcutBindings)) return;
  userShortcutBindings = normalized;
  if (applicationMenu) buildMenu();
});

ipcMain.handle('shortcuts:capture-mode', (event, active) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !appWindows.has(window)) return false;
  const next = active === true;
  if (next === shortcutCaptureActive) return true;
  shortcutCaptureActive = next;
  if (applicationMenu) buildMenu();
  return true;
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queueExternalOpenPath(filePath);
});

app.on('second-instance', async (_event, argv, workingDirectory) => {
  if (!hasSingleInstanceLock) return;
  const filePaths = await collectExternalFilePaths(argv, workingDirectory);
  if (!filePaths.length) return;
  let window = targetWindow();
  if (!window || window.isDestroyed()) window = createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  for (const filePath of filePaths) queueExternalOpenPath(filePath, window);
});

function configureSpellChecker() {
  const spellSession = session.defaultSession;
  spellSession.setSpellCheckerEnabled(true);
  if (process.platform === 'darwin') return;
  const available = spellSession.availableSpellCheckerLanguages;
  const locale = app.getLocale().replace(/_/g, '-').toLowerCase();
  const language = available.find(item => item.toLowerCase() === locale)
    || available.find(item => item.split(/[-_]/, 1)[0].toLowerCase() === locale.split('-', 1)[0]);
  spellSession.setSpellCheckerLanguages(language ? [language] : []);
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  await loadRecentDocuments();
  await loadRemoteEditingSettings();
  await reloadUserScripts();
  configureSpellChecker();
  buildMenu();
  createWindow();
  for (const filePath of await collectExternalFilePaths(process.argv, process.cwd())) queueExternalOpenPath(filePath);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', event => {
  if (!recoveryStore || recoveryQuitPrepared) return;
  event.preventDefault();
  recoveryStore.flush().finally(() => {
    recoveryQuitPrepared = true;
    app.quit();
  });
});

app.on('will-quit', () => remoteEditingServer.close());
