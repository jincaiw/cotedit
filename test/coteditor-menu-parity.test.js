import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { formatShortcut } from '../lib/shortcuts.js';

const require = createRequire(import.meta.url);
const shortcuts = require('../lib/shortcuts.json');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const printHtml = readFileSync(new URL('../electron/print-html.cjs', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const shortcut = id => shortcuts.find(item => item.id === id);

test('CotEditor common selection, line and sidebar shortcuts use distinct upstream keys', () => {
  assert.equal(formatShortcut(shortcut('jumpToSelection'), 'darwin'), '⌘J');
  assert.equal(formatShortcut(shortcut('joinCurrentLines'), 'darwin'), '⇧⌘J');
  assert.equal(formatShortcut(shortcut('duplicateLine'), 'darwin'), '⇧⌘D');
  assert.equal(formatShortcut(shortcut('selectWord'), 'darwin'), '⌘D');
  assert.equal(formatShortcut(shortcut('folderBrowser'), 'darwin'), '⌃⌘1');
  assert.equal(formatShortcut(shortcut('folderFind'), 'darwin'), '⌃⌘2');
  assert.equal(shortcut('jumpToSelection').accelerator, 'CmdOrCtrl+J');
  assert.equal(shortcut('joinCurrentLines').accelerator, 'CmdOrCtrl+Shift+J');
});

test('View menu routes Sidebar and Inspector commands through preload to renderer', () => {
  for (const [id, channel, action] of [
    ['menu-folder-browser', 'menu:folder-browser', 'folderBrowser: openFolderNavigation'],
    ['menu-folder-find', 'menu:folder-find', 'folderFind: openFolderSearch'],
    ['menu-document-inspector', 'menu:document-inspector', "'menu:document-inspector': toggleDocumentInspector"],
    ['menu-outline', 'menu:outline', "'menu:outline': () => togglePanel('outline-panel')"]
  ]) {
    assert.ok(main.includes(`id: '${id}'`), `native menu is missing ${id}`);
    assert.ok(main.includes(`sendCommand('${channel}')`), `native menu does not emit ${channel}`);
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(action), `renderer is missing ${action}`);
  }
  const inspectorItem = main.match(/id: 'menu-document-inspector',[^\n]*/)?.[0];
  assert.ok(inspectorItem, 'Document Inspector menu item exists');
  assert.doesNotMatch(inspectorItem, /accelerator:/, 'CotEditor assigns no default key equivalent to Document Inspector');
  assert.ok(!shortcuts.some(item => item.id === 'showInspector'), 'do not invent a default inspector shortcut');
  for (const id of ['document-inspector-panel', 'document-inspector-name', 'document-inspector-path', 'document-inspector-fileSize', 'document-inspector-filePermissions', 'document-inspector-fileOwner', 'document-inspector-encoding', 'document-inspector-lineEnding', 'document-inspector-syntax', 'document-inspector-lineCount', 'document-inspector-wordCount', 'document-inspector-characterCount', 'document-inspector-length', 'document-inspector-cursorPosition', 'document-inspector-selectionCharacters', 'document-inspector-saveState', 'document-inspector-character-state', 'document-inspector-character-code-points', 'document-inspector-character-name', 'document-inspector-character-block', 'document-inspector-character-category']) {
    assert.ok(index.includes(`id="${id}"`), `document inspector is missing ${id}`);
  }
  assert.match(index, /<aside id="document-inspector-panel"[\s\S]*?<details class="document-inspector-section" open>[\s\S]*?<summary>文件<\/summary>[\s\S]*?<summary>文本设置<\/summary>[\s\S]*?<summary>计数<\/summary>[\s\S]*?<summary>字符<\/summary>/);
  assert.doesNotMatch(index, /<dialog id="document-inspector-/);
  assert.match(renderer, /function refreshDocumentInspector\(\)/);
  assert.match(renderer, /document-inspector-panel'\) && !\$\('#document-inspector-panel'\)\.classList\.contains\('hidden'\)\) refreshDocumentInspector\(\)/);
  assert.match(renderer, /getDocumentInspectorCharacter\(text, view\?\.state\.selection\.ranges\?\.\[0\]\)/);
  assert.match(renderer, /refreshDocumentInspectorCharacter\(inspectorCharacter\)/);
  const inspectorRefresh = renderer.slice(renderer.indexOf('function refreshDocumentInspector()'), renderer.indexOf('function toggleDocumentInspector()'));
  for (const key of ['syntax', 'lineCount', 'wordCount', 'characterCount', 'cursorPosition', 'selectionCharacters']) {
    assert.match(inspectorRefresh, new RegExp(`\\b${key}:`), `document inspector does not refresh ${key}`);
  }
  assert.match(inspectorRefresh, /fileSize: formatDocumentFileSize\(activeDoc\.fileSizeBytes\)/);
  assert.match(renderer, /doc\.fileSizeBytes = Number\.isSafeInteger\(metadata\.fileSizeBytes\)/);
  assert.match(renderer, /activeDoc\.fileSizeBytes = Number\.isSafeInteger\(result\.fileSizeBytes\)/);
  assert.match(main, /fileSizeBytes: buffer\.length/);
  assert.match(main, /const fileSizeBytes = await atomicWrite\(filePath, text, encoding, payload\?\.bom === true\)/);
});

test('CotEditor Text > Display Character uses Option-Command-I and a single-selection information popover', () => {
  const inspectCharacter = shortcut('inspectCharacter');
  assert.ok(inspectCharacter);
  assert.equal(inspectCharacter.accelerator, 'CmdOrCtrl+Alt+I');
  assert.equal(formatShortcut(inspectCharacter, 'darwin'), '⌥⌘I');
  const textMenu = main.slice(main.indexOf("label: '文本', submenu:"), main.indexOf("label: '查找', submenu:"));
  assert.ok(textMenu.includes("id: 'menu-inspect-character', label: '显示字符'"));
  assert.ok(textMenu.includes("accelerator: accelerator('inspectCharacter')"));
  assert.ok(textMenu.includes("sendCommand('menu:inspect-character')"));
  assert.ok(preload.includes("'menu:inspect-character'"));
  assert.ok(renderer.includes("'menu:inspect-character': showSelectedCharacterInfo"));
  assert.ok(renderer.includes('inspectCharacter: showSelectedCharacterInfo'));
  assert.ok(renderer.includes('canInspectCharacter'));
  assert.ok(renderer.includes("panel.dataset.mode = 'selection'"));
  assert.ok(renderer.includes('positionCharacterPopover(selected.view, selected.from)'));
});

test('CotEditor Text > Advanced Character Count has configurable units and no invented shortcut', () => {
  const textMenu = main.slice(main.indexOf("label: '文本', submenu:"), main.indexOf("label: '查找', submenu:"));
  assert.ok(textMenu.includes("id: 'menu-advanced-character-count', label: '高级字符计数…'"));
  assert.ok(textMenu.includes("sendCommand('menu:advanced-character-count')"));
  assert.ok(preload.includes("'menu:advanced-character-count'"));
  assert.ok(renderer.includes("'menu:advanced-character-count': toggleAdvancedCharacterCount"));
  assert.ok(renderer.includes('countAdvancedCharacterStrings(strings, countOptionsFromSettings())'));
  assert.ok(main.includes("ipcMain.handle('document:count-encoded-bytes'"));
  assert.ok(preload.includes("ipcRenderer.invoke('document:count-encoded-bytes', payload)"));
  for (const id of ['character-count-dialog', 'count-unit', 'count-ignores-newlines', 'count-ignores-whitespaces', 'count-collapse-whitespace', 'count-normalization-form', 'count-encoding']) {
    assert.ok(index.includes(`id="${id}"`), `advanced count options are missing ${id}`);
  }
  assert.ok(!shortcuts.some(item => item.id === 'advancedCharacterCount'), 'CotEditor has no default shortcut for this command');
  assert.ok(main.includes("label: '高级字符计数…'"));
  assert.match(menuState, /label: payload\.advancedCountActive === true \? '停止高级字符计数' : '高级字符计数…'/);
});

test('CotEditor Text > Edit Color Code uses Control-Command-H and inserts the chosen CSS representation', () => {
  const item = shortcut('editColorCode');
  assert.ok(item);
  assert.equal(item.acceleratorMac, 'Control+Command+H');
  assert.equal(formatShortcut(item, 'darwin'), '⌃⌘H');
  const textMenu = main.slice(main.indexOf("label: '文本', submenu:"), main.indexOf("label: '查找', submenu:"));
  assert.ok(textMenu.includes("id: 'menu-edit-color-code', label: '编辑颜色代码…'"));
  assert.ok(textMenu.includes("accelerator: accelerator('editColorCode')"));
  assert.ok(textMenu.includes("sendCommand('menu:edit-color-code')"));
  assert.ok(preload.includes("'menu:edit-color-code'"));
  assert.ok(renderer.includes("'menu:edit-color-code': showColorCodeEditor"));
  assert.ok(renderer.includes('editColorCode: showColorCodeEditor'));
  assert.ok(renderer.includes('insertEditedColorCode'));
  assert.ok(renderer.includes("userEvent: 'input.type'"));
  assert.match(menuState, /'menu-edit-color-code': \{ enabled: canEdit \}/);
  for (const id of ['color-code-dialog', 'color-code-value', 'color-code-picker', 'color-code-alpha', 'color-code-format', 'color-code-swatch', 'color-code-insert']) {
    assert.ok(index.includes(`id="${id}"`), `color code editor is missing ${id}`);
  }
  assert.ok(renderer.includes("import { COLOR_CODE_FORMATS, colorPickerHex, formatColorCode, parseColorCode, withColorAlpha } from '../lib/color-code.js'"));
});

test('Unicode normalization menu follows CotEditor order and routes standard and Modified forms safely', () => {
  const menu = main.slice(main.indexOf("label: 'Unicode 规范化', submenu:"), main.indexOf("label: '查找', submenu:"));
  const ids = ['menu-normalize-nfd', 'menu-normalize-nfc', 'menu-normalize-nfkd', 'menu-normalize-nfkc', 'menu-normalize-nfkc-casefold', 'menu-normalize-modified-nfd', 'menu-normalize-modified-nfc'];
  const positions = ids.map(id => menu.indexOf(`id: '${id}'`));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(menu.indexOf("{ type: 'separator' }") < positions[5], 'Modified forms should be separated from standard forms');
  assert.ok(main.includes("sendCommand('menu:unicode-nfkc-casefold')"));
  assert.ok(preload.includes("'menu:unicode-nfkc-casefold'"));
  assert.ok(renderer.includes("'menu:unicode-nfkc-casefold': () => transformSelectedText(text => normalizeUnicode(text, 'NFKC_CF')"));
  for (const [command, form] of [['menu:unicode-modified-nfd', 'MODIFIED_NFD'], ['menu:unicode-modified-nfc', 'MODIFIED_NFC']]) {
    assert.ok(main.includes(`sendCommand('${command}')`));
    assert.ok(preload.includes(`'${command}'`));
    assert.ok(renderer.includes(`normalizeUnicode(text, '${form}')`));
  }
});

test('upper- and lower-case menu commands use locale-aware Unicode transformations', () => {
  assert.ok(renderer.includes("'menu:uppercase': () => transformSelectedText(uppercaseText)"));
  assert.ok(renderer.includes("'menu:lowercase': () => transformSelectedText(lowercaseText)"));
  assert.match(renderer, /import \{[^\n]*lowercaseText[^\n]*uppercaseText[^\n]*from '\.\.\/lib\/text-tools\.js'/);
});

test('printing transmits each document writing direction to the RTL-capable print template', () => {
  assert.match(renderer, /pageSetup: \{ \.\.\.settings, fontType: fontTypeForDocument\(\), writingDirection: activeDoc\.writingDirection \}/);
  assert.match(printHtml, /writingDirection: value\.writingDirection === 'rtl' \? 'rtl' : 'ltr'/);
  assert.match(printHtml, /body\.rtl \.print-line \{ direction: rtl; \}/);
});

test('Format Font Type matches CotEditor Standard/Monospaced actions without inventing a shortcut', () => {
  const fontMenu = main.slice(main.indexOf("{ label: '字体', submenu:"), main.indexOf("{ label: '界面外观', submenu:"));
  assert.ok(fontMenu.includes("label: '字体类型', submenu:"));
  assert.ok(fontMenu.includes("id: 'menu-font-type-standard', label: '标准', type: 'radio'"));
  assert.ok(fontMenu.includes("id: 'menu-font-type-monospaced', label: '等宽', type: 'radio'"));
  assert.ok(fontMenu.includes("sendCommand('menu:font-type', 'standard')"));
  assert.ok(fontMenu.includes("sendCommand('menu:font-type', 'monospaced')"));
  assert.ok(preload.includes("'menu:font-type'"));
  assert.ok(renderer.includes("'menu:font-type': setEditorFontType"));
  assert.match(renderer, /function setEditorFontType\(value\)[\s\S]*?persistSettings\(\)[\s\S]*?applySettings\(\)/);
  assert.match(renderer, /root\.dataset\.fontType = fontType/);
  assert.match(renderer, /fontType: fontTypeForDocument\(\)/);
  assert.match(main, /fontType: payload\.fontType === 'standard' \? 'standard' : 'monospaced'/);
  assert.match(menuState, /'menu-font-type-standard': \{ enabled: true, checked: payload\.fontType === 'standard' \}/);
  assert.match(menuState, /'menu-font-type-monospaced': \{ enabled: true, checked: payload\.fontType !== 'standard' \}/);
  const editorStyles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(editorStyles, /--editor-font-family: var\(--editor-font-monospace\)/);
  assert.match(editorStyles, /--editor-font-standard:/);
  assert.match(renderer, /root\.style\.setProperty\('--editor-font-family', editorFontFamilyStack\(settings\.fontFamily, fontType\)\)/);
  assert.ok(!shortcuts.some(item => item.id === 'fontType'), 'CotEditor declares no default shortcut for Font Type');
});

test('Format Tab Width includes CotEditor Use Spaces for Indentation without a shortcut', () => {
  const menu = main.slice(main.indexOf('const tabWidthItems ='), main.indexOf('const themeItems ='));
  assert.match(menu, /id: 'menu-auto-expand-tab', label: '使用空格缩进', type: 'checkbox'/);
  assert.ok(menu.indexOf("id: 'menu-auto-expand-tab'") > menu.indexOf("id: 'menu-tab-width-custom'"));
  assert.ok(main.includes("sendCommand('menu:auto-expand-tab')"));
  assert.ok(preload.includes("'menu:auto-expand-tab'"));
  assert.match(renderer, /'menu:auto-expand-tab': \(\) => \{[\s\S]*activeDoc\.detectedIndentStyle = null[\s\S]*settings\.autoExpandTab = !current/);
  assert.doesNotMatch(menu.match(/\{ id: 'menu-auto-expand-tab'[^\n]*/)?.[0] || '', /accelerator:/);
});

test('Window menu actions call tested native window helpers', () => {
  assert.match(main, /id: 'menu-keep-on-top',[\s\S]*?toggleAlwaysOnTop\(window\)/);
  assert.match(main, /id: 'menu-bring-all-to-front',[\s\S]*?bringAllWindowsToFront\(BrowserWindow\.getAllWindows\(\)\)/);
  assert.match(main, /alwaysOnTop: Boolean\(window && !window\.isDestroyed\(\) && window\.isAlwaysOnTop\(\)\)/);
});

test('Text Lines menu orders movement, transforms, duplicate/delete and join actions', () => {
  const lineMenu = main.slice(main.indexOf("label: '行', submenu:"), main.indexOf("label: '补全'"));
  const ids = ['menu-move-line-up', 'menu-move-line-down', 'menu-sort-lines', 'menu-sort-by-pattern', 'menu-reverse-lines', 'menu-shuffle-lines', 'menu-delete-duplicates', 'menu-duplicate-line', 'menu-delete-line', 'menu-join-current-lines'];
  const positions = ids.map(id => lineMenu.indexOf(`id: '${id}'`));
  assert.ok(positions.every(position => position >= 0), 'all expected line operations exist in the Text menu');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('Text Complete and UTF-8 BOM actions are routed through native menu and preload', () => {
  assert.ok(main.includes("id: 'menu-complete', label: '文本补全'"));
  assert.ok(main.includes("accelerator('complete')"));
  assert.equal(shortcut('complete').accelerator, 'Alt+Escape');
  assert.equal(formatShortcut(shortcut('complete'), 'darwin'), '⌥Escape');
  assert.ok(main.includes("id: 'menu-toggle-utf8-bom', label: 'UTF-8 BOM'"));
  assert.ok(main.includes("sendCommand('menu:toggle-utf8-bom')"));
  assert.ok(preload.includes("'menu:toggle-utf8-bom'"));
  assert.ok(renderer.includes("'menu:toggle-utf8-bom': toggleUtf8Bom"));
  assert.match(renderer, /function toggleUtf8Bom\(\)[\s\S]*activeDoc\.encoding !== 'utf8'[\s\S]*activeDoc\.bom = !activeDoc\.bom/);
});

test('Print passes an active selection to the native range chooser and respects cancellation', () => {
  assert.match(renderer, /selectionText:\s*selection && !selection\.empty \? view\.state\.sliceDoc\(selection\.from, selection\.to\) : ''/);
  assert.match(renderer, /selectionStartLine:\s*selection && !selection\.empty \? view\.state\.doc\.lineAt\(selection\.from\)\.number : 1/);
  assert.match(main, /buttons: \['打印整个文稿', '仅打印选中内容', '取消'\]/);
  assert.match(main, /if \(scope\.response === 1\) \{\s*text = selectionText;\s*startLine = Number\.isSafeInteger\(payload\?\.selectionStartLine\)/);
  assert.match(main, /scope\.response === 2\) return \{ success: false, canceled: true \}/);
  assert.match(renderer, /if \(result\?\.canceled\) return/);
});

test('saved document direction, new-document default, and mixed-ending open notices have explicit routes', () => {
  assert.match(renderer, /function defaultDocumentWritingDirection\(filePath\)[\s\S]*resolveDocumentWritingDirection/);
  assert.match(renderer, /rememberDocumentWritingDirection\(activeDoc\.path, value\)/);
  assert.match(renderer, /const writingDirection = metadata\.writingDirection === 'rtl' \|\| metadata\.writingDirection === 'ltr'[\s\S]*defaultDocumentWritingDirection\(path\)/);
  assert.match(renderer, /mixedCount = openedDocuments\.filter\(doc => getLineEndingSummary\(doc\)\.mixed\)\.length/);
  assert.ok(index.includes('id="writing-direction-setting"'));
});

test('automatically detected syntax and changed selections share the bounded recent-syntax history', () => {
  assert.match(renderer, /function createDocument[\s\S]*?languageForDocument\(name, originalText\);\s*if \(metadata\.remoteFileType\) language = languageForRemoteFileType\(metadata\.remoteFileType, name, originalText\);\s*if \(!metadata\.plainText\) noteRecentSyntax\(language\)/);
  assert.match(renderer, /function noteRecentSyntax\(id\)[\s\S]*?id === 'plaintext'[\s\S]*?recentSyntaxes\.at\(-1\) === id[\s\S]*?recentSyntaxes\.filter\(item => item !== id\)[\s\S]*?slice\(-6\)/);
  assert.match(renderer, /function changeLanguage\(id\)[\s\S]*?if \(didChange\) noteRecentSyntax\(id\)/);
});

test('CotEditor Copy as Rich Text matches its Edit-menu placement, selection requirement and default key', () => {
  const richCopy = shortcut('copyAsRichText');
  assert.ok(richCopy);
  assert.equal(formatShortcut(richCopy, 'darwin'), '⇧⌘C');
  assert.equal(richCopy.accelerator, 'CmdOrCtrl+Shift+C');
  assert.ok(main.includes("id: 'menu-copy-as-rich-text'"));
  assert.ok(main.includes("sendCommand('menu:copy-as-rich-text')"));
  assert.ok(renderer.includes('function copySelectionAsRichText(view = activeEditor())'));
  assert.ok(renderer.includes("'menu:copy-as-rich-text': () => copySelectionAsRichText(activeEditor())"));
});

test('Format visibility preferences follow CotEditor menu grouping and View shortcuts use the shared registry', () => {
  const formatMenu = main.slice(main.indexOf("label: '格式', submenu:"), main.indexOf("label: '显示', submenu:"));
  const viewMenu = main.slice(main.indexOf("label: '显示', submenu:"), main.indexOf("label: '文本', submenu:"));
  for (const id of ['menu-toggle-invisibles', 'menu-toggle-indent-guides', 'menu-toggle-page-guide']) {
    assert.ok(formatMenu.includes(`id: '${id}'`), `${id} belongs to Format`);
    assert.ok(!viewMenu.includes(`id: '${id}'`), `${id} must not be duplicated under View`);
  }
  for (const [id, shortcutId] of [['menu-toggle-tab-bar', 'toggleTabBar'], ['menu-toggle-toolbar', 'toggleToolbar'], ['menu-toggle-sidebar', 'toggleSidebar']]) {
    assert.match(main, new RegExp(`id: '${id}'[^\\n]*accelerator: accelerator\\('${shortcutId}'\\)`));
  }
});

test('Find > Open Outline Menu is distinct from the View outline inspector and has no invented default key', () => {
  const openMenu = main.match(/id: 'menu-open-outline-menu'[^\n]*/)?.[0] || '';
  assert.match(openMenu, /label: '打开大纲菜单'/);
  assert.match(openMenu, /accelerator: accelerator\('openOutlineMenu'\)/);
  assert.ok(main.includes("sendCommand('menu:open-outline-menu')"));
  assert.ok(preload.includes("'menu:open-outline-menu'"));
  assert.match(renderer, /'menu:open-outline-menu': openOutlineNavigationMenu/);
  assert.doesNotMatch(openMenu, /accelerator:\s*['"]/);
  const shortcut = shortcuts.find(item => item.id === 'openOutlineMenu');
  assert.equal(shortcut.key, '');
  assert.equal(shortcut.accelerator, undefined);
});

test('outline previous/next commands route to caret-relative navigation and retain CotEditor chords', () => {
  assert.equal(formatShortcut(shortcut('selectPreviousOutlineItem'), 'darwin'), '⌥⌘↑');
  assert.equal(formatShortcut(shortcut('selectNextOutlineItem'), 'darwin'), '⌥⌘↓');
  for (const [id, channel] of [
    ['menu-select-previous-outline-item', 'menu:select-previous-outline-item'],
    ['menu-select-next-outline-item', 'menu:select-next-outline-item']
  ]) {
    assert.ok(main.includes(`id: '${id}'`));
    assert.ok(main.includes(`sendCommand('${channel}')`));
    assert.ok(preload.includes(`'${channel}'`));
  }
  assert.match(renderer, /function navigateOutlineItem\(direction\)[\s\S]*adjacentOutlineItem\(items, currentLine, direction\)[\s\S]*jumpToLine\(target\.line\)/);
});

test('Insert Backslash follows CotEditor 7.1.1 Command-Yen and uses safe renderer dispatch', () => {
  const backslash = shortcut('insertBackslash');
  assert.ok(backslash);
  assert.equal(formatShortcut(backslash, 'darwin'), '⌘¥');
  const menuItem = main.match(/id: 'menu-insert-backslash',[^\n]*/)?.[0];
  assert.ok(menuItem);
  assert.match(menuItem, /accelerator: accelerator\('insertBackslash'\)/);
  assert.match(menuItem, /registerAccelerator: false/);
  assert.match(main, /if \(requiresCustomKeyDispatch\(key\)\) return undefined/);
  assert.match(main, /function defaultMenuShortcutBindings\(\)/);
  assert.match(main, /decorateMenuShortcutLabels\(template, \{ \.\.\.defaultMenuShortcutBindings\(\), \.\.\.userShortcutBindings \}/);
  assert.ok(renderer.includes("insertBackslash: () => insertLiteralText('\\\\')"));
  assert.match(renderer, /shortcut\?\.id === 'insertBackslash' && !view\?\.hasFocus/);
  assert.ok(renderer.includes("'quickActions', 'insertBackslash'].includes(shortcut.id)"));
});


test('Toggle Comment routes keyboard, native menu and configurable shortcut through visual indentation', () => {
  assert.match(renderer, /import \{[^}]*toggleCommentAtVisualIndent[^}]*\} from '\.\.\/lib\/comment-commands\.js';/);
  assert.match(renderer, /key: 'Mod-\/', run: view => toggleCommentAtVisualIndent\(view, settings\.tabWidth, settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /'menu:toggle-comment': \(\) => toggleCommentAtVisualIndent\(activeEditor\(\), settings\.tabWidth, settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /toggleComment: \(\) => toggleCommentAtVisualIndent\(activeEditor\(\), settings\.tabWidth, settings\.appendsCommentSpacer\)/);
});

test('comment spacer preference has a labeled control, persists, and reaches every comment menu action', () => {
  assert.match(index, /<span>注释符后添加空格<\/span><input type="checkbox" id="comment-spacer-setting" \/>/);
  assert.match(renderer, /\$\('#comment-spacer-setting'\)\.checked = settings\.appendsCommentSpacer/);
  assert.match(renderer, /\$\('#comment-spacer-setting'\)\.addEventListener\('change', event => \{ settings\.appendsCommentSpacer = event\.target\.checked; persistSettings\(\); \}\)/);
  assert.match(renderer, /'menu:comment-out': \(\) => commentOutSelection\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /'menu:inline-comment': \(\) => lineCommentSelection\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /'menu:block-comment': \(\) => blockCommentSelection\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /'menu:uncomment': \(\) => uncommentSelectionCommand\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
});

test('automatic indentation preference follows CotEditor Return behavior without adding a menu shortcut', () => {
  assert.match(index, /<span>自动缩进<\/span><input type="checkbox" id="auto-indent-setting" \/>/);
  assert.match(renderer, /\$\('#auto-indent-setting'\)\.checked = settings\.autoIndent/);
  assert.match(renderer, /\$\('#auto-indent-setting'\)\.addEventListener\('change', event => \{ settings\.autoIndent = event\.target\.checked; persistSettings\(\); applySettings\(\); \}\)/);
  assert.ok(renderer.includes("return settings.autoIndent ? [] : Prec.highest(keymap.of([{ key: 'Enter', run: insertNewline }]))"));
  assert.ok(renderer.includes('autoIndentCompartment.of(autoIndentExtension())'));
  assert.equal((renderer.match(/autoIndentCompartment\.reconfigure\(autoIndentExtension\(\)\)/g) || []).length, 2);
  assert.ok(!shortcuts.some(item => item.id === 'autoIndent'), 'CotEditor has no default shortcut for this setting');
});

test('Toggle Comment menu title follows selected-line comment state and refreshes on edits', () => {
  assert.match(renderer, /canUncommentToggleSelection as canUncommentToggleSelectionForState/);
  assert.match(renderer, /toggleCommentUncommentable,\s*canInspectCharacter/);
  assert.match(renderer, /if \(update\.docChanged \|\| update\.selectionSet\) syncMenuState\(\)/);
  assert.match(main, /toggleCommentUncommentable: payload\.toggleCommentUncommentable === true/);
  assert.match(menuState, /'menu-toggle-comment': \{ enabled: canEdit, label: toggleCommentUncommentable \? '取消注释' : '注释掉' \}/);
  assert.match(main, /id: 'menu-toggle-comment', label: '注释掉', accelerator: accelerator\('toggleComment'\)/);
});

test('Application menu exposes the upstream 7.1.2 Donate item between About and Settings', () => {
  // CotEditor 7.1.2 Main.storyboard: "Donate to CotEditor…" sits after About and
  // before Settings…, with no key equivalent; it opens the Donation panel.
  assert.match(main, /\{ role: 'about' \}, \{ label: '捐赠 CotEdit…', click: \(\) => sendCommand\('menu:donate'\) \}/);
  assert.doesNotMatch(main, /\{ label: '捐赠 CotEdit…', click: \(\) => sendCommand\('menu:donate'\), accelerator:/);
  assert.match(renderer, /'menu:donate': showDonationDialog/);
  assert.match(renderer, /function showDonationDialog\(\)/);
  assert.match(index, /<dialog id="donation-dialog"[^>]*aria-labelledby="donation-title"/);
  assert.match(renderer, /openDonationLink\('https:\/\/apps\.apple\.com\/app\/id1024640650'\)/);
  assert.match(renderer, /openDonationLink\('https:\/\/github\.com\/sponsors\/1024jp\/'\)/);
});
