import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getMenuItemStates } = require('../electron/menu-state.cjs');
const shortcuts = require('../lib/shortcuts.json');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const shortcutMenu = readFileSync(new URL('../electron/shortcut-menu.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const directorySearch = readFileSync(new URL('../electron/directory-search.cjs', import.meta.url), 'utf8');

function menuChannels(source) {
  const block = source.match(/const channels = \[([\s\S]*?)\];/);
  assert.ok(block, 'preload menu channel list exists');
  return new Set([...block[1].matchAll(/'(menu:[^']+)'/g)].map(match => match[1]));
}

test('every Electron menu event is exposed by preload and handled by the renderer', () => {
  const emitted = new Set([...main.matchAll(/sendCommand\('(menu:[^']+)'/g)].map(match => match[1]));
  const exposed = menuChannels(preload);
  for (const channel of emitted) assert.ok(exposed.has(channel), `preload is missing ${channel}`);
  for (const channel of exposed) {
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
});

test('automatic completion suggestions are configurable without removing manual completion', () => {
  assert.match(index, /id="suggest-completions-setting"/);
  assert.match(renderer, /\$\('#suggest-completions-setting'\)\.checked = settings\.suggestCompletionsWhileTyping/);
  assert.match(index, /id="suggest-completions-language-setting" aria-label="当前语法自动补全策略"/);
  assert.match(renderer, /function completionExtension\(doc = activeDoc\)[\s\S]*activateOnTyping: autoCompletionEnabledForLanguage\(settings, doc\?\.language\)/);
  assert.match(renderer, /activateOnTypingDelay: 250/);
  assert.match(renderer, /override\s*\}/);
  assert.match(renderer, /completionCompartment\.reconfigure\(completionExtension\(activeDoc\)\)/);
  assert.match(renderer, /'menu:complete': \(\) => startCompletion\(activeEditor\(\)\)/);
  const documentCompletions = readFileSync(new URL('../lib/document-completions.js', import.meta.url), 'utf8');
  assert.match(documentCompletions, /includeWhileTyping = false/);
  assert.match(documentCompletions, /boundedDocumentLines\(context\.state\.doc, automaticScanLimit\)/);
  assert.match(index, /id="completion-document-setting"/);
  assert.match(index, /id="completion-syntax-setting"/);
});

test('every fixed native menu ID has state mapping or an explicit always-on policy', () => {
  const menuIds = new Set([...main.matchAll(/\bid:\s*['"](menu-[^'"]+)['"]/g)].map(match => match[1]));
  const stateIds = new Set(Object.keys(getMenuItemStates({})));
  const manuallySynchronized = new Set(['menu-inspect-line-endings']);
  const alwaysEnabled = new Set([
    'menu-open-recent', 'menu-font-up', 'menu-font-down', 'menu-font-reset',
    'menu-customize-toolbar', 'menu-bring-all-to-front', 'menu-quick-actions'
  ]);
  const accountedFor = new Set([...stateIds, ...manuallySynchronized, ...alwaysEnabled]);
  assert.deepEqual([...menuIds].filter(id => !accountedFor.has(id)), []);
  assert.deepEqual([...stateIds].filter(id => !menuIds.has(id)), []);
  assert.match(main, /setItem\('menu-inspect-line-endings', \{ enabled: state\.hasDocument && state\.eol === 'Mixed' \}\)/);
  for (const id of alwaysEnabled) assert.ok(menuIds.has(id), `${id} should remain an explicit always-enabled menu item`);
});

test('every documented shortcut has an application action', () => {
  const actionBlock = renderer.match(/function runShortcut\(id\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(actionBlock, 'shortcut dispatcher exists');
  const menuAccelerators = new Set([...main.matchAll(/accelerator\('([^']+)'\)/g)].map(match => match[1]));
  for (const shortcut of shortcuts) {
    const rendererAction = new RegExp(`\\b${shortcut.id}(?:\\s*:|\\s*,)`).test(actionBlock[1]);
    assert.ok(rendererAction || menuAccelerators.has(shortcut.id), `missing application or native-menu action for ${shortcut.id}`);
  }
});

test('native menu accelerators resolve through the shared registry with no unregistered literals', () => {
  const registered = new Set(shortcuts.map(shortcut => shortcut.id));
  const referenced = new Set([...main.matchAll(/accelerator\('([^']+)'\)/g)].map(match => match[1]));
  for (const id of referenced) assert.ok(registered.has(id), `menu references unknown shortcut ${id}`);
  for (const shortcut of shortcuts) assert.ok(referenced.has(shortcut.id), `menu does not use registered shortcut ${shortcut.id}`);
  assert.doesNotMatch(main, /accelerator:\s*['"]/u, 'all explicit menu accelerators should use the shared registry');
});

test('the shared CotEditor Command/Control+L is displayed twice but handled contextually once', () => {
  assert.match(main, /id: 'menu-surround-custom',[^\n]*accelerator: accelerator\('surroundCustom'\), registerAccelerator: false/);
  assert.match(main, /id: 'menu-go-to-line',[^\n]*accelerator: accelerator\('goToLine'\), registerAccelerator: false/);
  assert.match(renderer, /resolveShortcut\(event, applyShortcutOverrides\(SHORTCUTS, settings\.keyBindings\), platform, \{[\s\S]*editorFocused: Boolean\(view\?\.hasFocus\)[\s\S]*hasSelection: Boolean\(selection && !selection\.empty\)/);
  assert.match(main, /userShortcutBindings\[id\].*customAccelerator/s);
  assert.match(main, /function disableCustomAcceleratorRegistration\(template\)[\s\S]*?item\.registerAccelerator = false/);
  assert.match(main, /ipcMain\.on\('shortcuts:update'/);
  assert.match(preload, /setShortcutBindings: \(bindings\) => ipcRenderer\.send\('shortcuts:update', bindings\)/);
});

test('custom Unicode shortcuts are labelled in native menus without invalid Electron accelerators', () => {
  assert.match(main, /function defaultMenuShortcutBindings\(\)/);
  assert.match(main, /decorateMenuShortcutLabels\(template, \{ \.\.\.defaultMenuShortcutBindings\(\), \.\.\.userShortcutBindings \}, process\.platform, shortcutCaptureActive\)/);
  assert.match(main, /if \(requiresCustomKeyDispatch\(key\)\) return undefined/);
  assert.match(main, /id: 'menu-search-folder', label: '在文件夹中查找…', accelerator: accelerator\('searchFolder'\)/);
  assert.match(shortcutMenu, /if \(!binding \|\| requiresCustomKeyDispatch\(binding\.key\)\) return undefined/);
  assert.match(shortcutMenu, /Array\.from\(value\)\.length > 1 \|\| \/\[\^\\x00-\\x7F\]\/u\.test\(value\)/);
  assert.match(shortcutMenu, /item\.label = `\$\{item\.label\}\\t\$\{formatCustomShortcutLabel\(binding, platform\)\}`/);
});

test('desktop menu exposes parity-oriented Format and Find groups', () => {
  for (const label of ['格式', '显示', '文本', '查找']) {
    assert.ok(main.includes(`label: '${label}'`), `native menu is missing ${label}`);
  }
  assert.ok(main.includes("label: '打开大纲菜单'"), 'Find menu exposes the Outline Menu command');
  assert.match(main, /id: 'menu-open-outline-menu',[^\n]*accelerator: accelerator\('openOutlineMenu'\)/);
  assert.ok(preload.includes("'menu:open-outline-menu'"));
  assert.match(renderer, /'menu:open-outline-menu': openOutlineNavigationMenu/);
  assert.ok(index.includes('id="outline-navigation-select"'));
  assert.ok(index.includes('id="outline-previous"'));
  assert.ok(index.includes('id="outline-next"'));
  assert.match(renderer, /nearestOutlineItemAtOrBefore\(items, currentLine\)/);
  assert.match(renderer, /outline-navigation-select'\)\.addEventListener\('change'/);
  assert.match(renderer, /navigation-bar'\)\.classList\.toggle\('hidden', !settings\.showNavigationBar\)/);
  for (const command of ['menu:new-tab', 'menu:encoding', 'menu:find-all', 'menu:replace-all', 'menu:go-to-line']) {
    assert.ok(preload.includes(`'${command}'`), `preload is missing ${command}`);
    assert.ok(renderer.includes(`'${command}'`), `renderer is missing ${command}`);
  }
  assert.ok(main.includes('当前语法的缩进宽度'), 'indent width is explicit about its per-syntax scope');
  assert.ok(main.includes("label: '制表符宽度', submenu: tabWidthItems"), 'Tab display width has a separate Format submenu');
  assert.ok(main.includes('menu-tab-width-custom'), 'Tab Width provides a custom value');
  assert.ok(main.includes('menu-indent-width-custom'), 'per-syntax indentation provides a custom value');
  assert.match(main, /id: 'menu-indent-width-global', label: '跟随全局设置', type: 'radio'[\s\S]*menu:indent-follow-global/);
  assert.ok(preload.includes("'menu:indent-follow-global'"), 'the inheritance action is allowlisted through preload');
  assert.match(main, /menu-indent-width-global', \{ enabled: state\.hasDocument, checked: !state\.hasIndentOverride \}/);
  assert.match(renderer, /function useGlobalIndentForActiveLanguage\(\)[\s\S]*settings\.indentByLanguage = clearIndentOverride\(settings\.indentByLanguage, language\)[\s\S]*applySettings\(\)/);
  assert.match(readFileSync(new URL('../lib/settings.js', import.meta.url), 'utf8'), /export function clearIndentOverride[\s\S]*delete overrides\[language\]/);
  assert.match(renderer, /hasIndentOverride: Boolean\(activeDoc\?\.language && Object\.prototype\.hasOwnProperty\.call\(settings\.indentByLanguage, activeDoc\.language\)\)/);
  assert.match(renderer, /'menu:indent-follow-global': useGlobalIndentForActiveLanguage/);
  assert.doesNotMatch(main.slice(main.indexOf("id: 'menu-indent-width-global'"), main.indexOf("const tabWidthItems =")), /accelerator:/);
  assert.match(main, /label: '检查器', submenu: \[[\s\S]*?label: '警告'/);
  assert.match(main, /ipcMain\.handle\('document:check-encoding'/);
  assert.match(preload, /checkEncodingCompatibility: \(payload\) => ipcRenderer\.invoke\('document:check-encoding', payload\)/);
  assert.match(renderer, /'menu:warnings': \(\) => togglePanel\('warnings-panel'\)/);
  assert.match(renderer, /textContent = `\$\{item\.codePoint\} · 第/);
});

test('Text > Insert Snippet is a dynamic syntax-scoped menu and retains its manager route', () => {
  assert.match(main, /label: '插入片段', submenu: \[\.\.\.snippetItems/);
  assert.match(main, /menu-snippet-\$\{id\}.*menu:insert-snippet/s);
  assert.match(main, /ipcMain\.on\('snippet:menu-update'/);
  assert.match(main, /normalizeShortcutBindings\(\{ snippet: rawShortcut \}, \[\{ id: 'snippet' \}\]\)\.snippet/);
  assert.ok(preload.includes("updateSnippetMenu: (items) => ipcRenderer.send('snippet:menu-update', items)"));
  assert.ok(preload.includes("'menu:insert-snippet'"));
  assert.ok(preload.includes("'menu:manage-snippets'"));
  assert.match(renderer, /snippetsForSyntax\(settings\.snippets, activeDoc\.language\)/);
  assert.match(renderer, /'menu:insert-snippet': insertSnippetById/);
  assert.match(renderer, /'menu:manage-snippets': showSnippetManager/);
});

test('Substitutions exposes manual and opt-in automatic local Replace Text rules', () => {
  assert.match(main, /id: 'menu-replace-text', label: '替换文本', click: \(\) => sendCommand\('menu:replace-text'\)/);
  assert.ok(preload.includes("'menu:replace-text'"));
  assert.match(renderer, /'menu:replace-text': replaceTextInSelection/);
  assert.match(renderer, /function replaceTextInSelection\(\)[\s\S]*?textTransformationTransaction\([\s\S]*?selectionRequired: true/);
  assert.match(renderer, /hasTextReplacements: settings\.textReplacements\.some\(rule => rule\.enabled\)/);
  assert.match(index, /id="text-replacements-open"/);
  assert.match(index, /id="text-replacement-manager-dialog"/);
  assert.match(index, /勾选“输入时自动应用”的规则[\s\S]*?不读取或同步 macOS 系统替换词/);
  assert.match(index, /id="text-replacement-automatic"/);
  assert.match(renderer, /automatic: \$\('#text-replacement-automatic'\)\.checked/);
  assert.match(renderer, /textReplacement: substitutionModeEnabled\('textReplacement', language\)/);
  assert.match(renderer, /\$\('#text-replacement-form'\)\.addEventListener\('submit', saveTextReplacementManager\)/);
  assert.match(renderer, /\$\('#text-replacement-manager-dialog'\)\.addEventListener\('cancel',[\s\S]*?confirmDiscardTextReplacementDraft/);
  assert.match(renderer, /function saveTextReplacementManager\([\s\S]*?normalizeTextReplacements\(next\)/);
});

test('Tab Width and per-syntax custom indentation route through the native Format menu', () => {
  for (const channel of ['menu:custom-indent-width', 'menu:tab-width', 'menu:custom-tab-width']) {
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(channel), `renderer is missing ${channel}`);
  }
  assert.match(renderer, /EditorState\.tabSize\.of\(settings\.tabWidth\)/);
  assert.match(renderer, /convertIndentation\(indentation, target, view\.state\.tabSize\)/);
  assert.match(renderer, /function setTabWidth\(value\)/);
  assert.match(renderer, /function showCustomWidthDialog\(mode = 'tab'\)/);
  assert.match(main, /menu-tab-width-\$\{value\}/);
});

test('View menu exposes CotEditor Page Guide and routes its preference without a shortcut', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(main, /id: 'menu-toggle-page-guide', label: '显示页导引', type: 'checkbox', click: \(\) => sendCommand\('menu:toggle-page-guide'\)/);
  assert.ok(preload.includes("'menu:toggle-page-guide'"));
  assert.match(renderer, /'menu:toggle-page-guide': \(\) => toggleSetting\('showPageGuide'\)/);
  assert.match(menuState, /'menu-toggle-page-guide': \{ enabled: hasDocument, checked: payload\.showPageGuide === true \}/);
  assert.match(index, /id="page-guide-setting"/);
  assert.match(index, /id="page-guide-column" min="1" max="999"/);
  assert.doesNotMatch(main.match(/id: 'menu-toggle-page-guide'[^\n]*/)?.[0] || '', /accelerator/);
});

test('View menu exposes persistent tab/toolbar/navigation visibility and vertically stacked split editors', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  for (const [id, channel] of [['menu-toggle-tab-bar', 'menu:toggle-tab-bar'], ['menu-toggle-toolbar', 'menu:toggle-toolbar'], ['menu-toggle-navigation-bar', 'menu:toggle-navigation-bar'], ['menu-close-split', 'menu:toggle-split'], ['menu-stack-editors-vertically', 'menu:stack-editors-vertically']]) {
    assert.ok(main.includes(id), `native menu is missing ${id}`);
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
  assert.match(renderer, /editorShell\.classList\.toggle\('split-vertical', settings\.splitEditorsVertically\)/);
  assert.match(renderer, /\$\('\.tabbar'\)\.classList\.toggle\('hidden', !settings\.showTabBar\)/);
  assert.match(renderer, /\$\('\.document-toolbar'\)\.classList\.toggle\('hidden', !settings\.showToolbar\)/);
  assert.match(renderer, /\$\('\#navigation-bar'\)\.classList\.toggle\('hidden', !settings\.showNavigationBar\)/);
  assert.match(main, /id: 'menu-customize-toolbar', label: '自定义工具栏…', click: \(\) => sendCommand\('menu:customize-toolbar'\)/);
  assert.ok(preload.includes("'menu:customize-toolbar'"));
  assert.match(renderer, /'menu:customize-toolbar': showToolbarCustomizationDialog/);
  assert.ok(index.includes('id="toolbar-customization-dialog"'));
  assert.ok(index.includes('id="toolbar-customize-open"'));
  assert.match(renderer, /button\.hidden = hidden\.has\(id\)[\s\S]*container\.append\(button\)/);
  assert.match(menuState, /'menu-stack-editors-vertically': \{ enabled: payload\.splitEnabled === true, checked: payload\.splitEditorsVertically === true \}/);
  assert.match(menuState, /'menu-close-split': \{ enabled: payload\.splitEnabled === true \}/);
  for (const id of ['tabbar-setting', 'toolbar-setting', 'navigation-bar-setting', 'split-orientation-setting']) assert.ok(index.includes(`id="${id}"`));
  assert.match(main, /id: 'menu-toggle-tab-bar', label: '显示标签栏', type: 'checkbox'/);
  assert.match(main, /id: 'menu-toggle-toolbar', label: '显示工具栏', type: 'checkbox'/);
  assert.match(main, /id: 'menu-toggle-navigation-bar', label: '显示导航栏', type: 'checkbox'/);
  assert.match(menuState, /'menu-toggle-navigation-bar': \{ enabled: true, checked: payload\.showNavigationBar !== false \}/);
  assert.match(main, /id: 'menu-stack-editors-vertically', label: '垂直堆叠编辑器', type: 'checkbox'/);
});

test('File menu exposes the local recovery manager through a gated native command', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(main, /id: 'menu-recover-drafts', label: '恢复未保存文稿…', enabled: false, click: \(\) => sendCommand\('menu:recover-drafts'\)/);
  assert.ok(preload.includes("'menu:recover-drafts'"));
  assert.match(renderer, /'menu:recover-drafts': showRecoveryManagerDialog/);
  assert.match(menuState, /'menu-recover-drafts': \{ enabled: Number\.isInteger\(payload\.recoveryDraftCount\) && payload\.recoveryDraftCount > 0 \}/);
  for (const id of ['recovery-dialog', 'recovery-list', 'recovery-restore-selected', 'recovery-restore-all', 'recovery-delete-selected', 'recovery-clear-all']) {
    assert.ok(index.includes(`id="${id}"`), `recovery manager is missing ${id}`);
  }
  assert.match(main, /did-finish-load', \(\) => \{[\s\S]*?recoveryOwnership\.release\(window\.id\)[\s\S]*?notifyRecoveryStoreChanged\(\)/);
  assert.match(renderer, /recoveryStartupPending && availableRecoveryDrafts\(\)\.length/);
  assert.match(renderer, /await window\.cotedit\.importLegacyRecoveryDrafts\(legacy\.sessions\);[\s\S]*?const verified = await window\.cotedit\.listRecoveryDrafts\(\);[\s\S]*?for \(const key of legacy\.keys\) localStorage\.removeItem\(key\)/);
  assert.match(renderer, /recovery-clear-all'\)\.disabled = recoveryDrafts\.length === 0 \|\| inUse > 0/);
  assert.match(renderer, /草稿不会按时间自动过期/);
  for (const method of ['listRecoveryDrafts', 'saveRecoveryDrafts', 'importLegacyRecoveryDrafts', 'deleteRecoveryDrafts', 'clearRecoveryDrafts']) {
    assert.ok(preload.includes(`${method}:`), `preload is missing ${method}`);
  }
});

test('Text Trim Trailing Whitespace routes to the tested all-line transform without an invented shortcut', () => {
  const item = main.match(/id: 'menu-trim-trailing-whitespace'[^\n]*/)?.[0] || '';
  assert.match(item, /label: '删除行尾空格'/);
  assert.doesNotMatch(item, /accelerator/);
  assert.ok(preload.includes("'menu:trim-trailing-whitespace'"));
  assert.match(renderer, /function trimTrailingWhitespace\(\)[\s\S]*trailingWhitespaceChanges\(view\.state\.doc\)[\s\S]*userEvent: 'input\.trim\.trailing-whitespace'/);
  assert.match(renderer, /'menu:trim-trailing-whitespace': trimTrailingWhitespace/);
});

test('Edit > Substitutions exposes quote and dash replacements without invented shortcuts', () => {
  const replaceItem = main.match(/id: 'menu-replace-quotes'[^\n]*/)?.[0] || '';
  const item = main.match(/id: 'menu-straighten-quotes'[^\n]*/)?.[0] || '';
  const dashesItem = main.match(/id: 'menu-replace-dashes'[^\n]*/)?.[0] || '';
  assert.match(main, /label: '替换', submenu: \[[\s\S]*?id: 'menu-replace-quotes', label: '替换直引号为弯引号'[\s\S]*?id: 'menu-straighten-quotes', label: '弯引号转为直引号'[\s\S]*?id: 'menu-replace-dashes', label: '将双连字符替换为长破折号'/);
  assert.doesNotMatch(replaceItem, /accelerator/);
  assert.doesNotMatch(item, /accelerator/);
  assert.doesNotMatch(dashesItem, /accelerator/);
  assert.ok(preload.includes("'menu:replace-quotes'"));
  assert.ok(preload.includes("'menu:straighten-quotes'"));
  assert.ok(preload.includes("'menu:replace-dashes'"));
  assert.match(renderer, /'menu:replace-quotes': \(\) => transformSelectedText\(replacePairedStraightQuotes\)/);
  assert.match(renderer, /'menu:straighten-quotes': \(\) => transformSelectedText\(straightenCurlyQuotes\)/);
  assert.match(renderer, /'menu:replace-dashes': \(\) => transformSelectedText\(replaceDoubleHyphensWithEmDash, '破折号转换失败', true\)/);
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(menuState, /'menu-replace-dashes': \{ enabled: canEdit && hasAnySelection \}/);
  assert.deepEqual(getMenuItemStates({ hasDocument: true })['menu-replace-quotes'], { enabled: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, preventEditing: true })['menu-replace-quotes'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ hasDocument: true })['menu-straighten-quotes'], { enabled: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, preventEditing: true })['menu-straighten-quotes'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ hasDocument: true })['menu-replace-dashes'], { enabled: false });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasSelection: true })['menu-replace-dashes'], { enabled: true });
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasAnySelection: true })['menu-replace-dashes'], { enabled: true }, 'a secondary nonempty selection should enable the command');
  assert.deepEqual(getMenuItemStates({ hasDocument: true, hasSelection: true, preventEditing: true })['menu-replace-dashes'], { enabled: false });
});

test('Text Comment submenu routes toggle, line, block and uncomment commands without invented shortcuts', () => {
  assert.match(main, /label: '注释', submenu: \[[\s\S]*?id: 'menu-toggle-comment'[\s\S]*?id: 'menu-inline-comment'[\s\S]*?id: 'menu-block-comment'[\s\S]*?id: 'menu-uncomment'/);
  for (const channel of ['menu:toggle-comment', 'menu:inline-comment', 'menu:block-comment', 'menu:uncomment']) {
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
  assert.match(renderer, /'menu:inline-comment': \(\) => lineCommentSelection\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /'menu:block-comment': \(\) => blockCommentSelection\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
  assert.match(renderer, /uncommentSelection as uncommentSelectionCommand[^\n]*from '\.\.\/lib\/comment-commands\.js'/);
  assert.match(renderer, /'menu:uncomment': \(\) => uncommentSelectionCommand\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
  for (const id of ['menu-inline-comment', 'menu-block-comment', 'menu-uncomment']) {
    const item = main.match(new RegExp(`id: '${id}'[^\\n]*`))?.[0] || '';
    assert.doesNotMatch(item, /accelerator/);
  }
});

test('Find menu routes Jump to Selection and enables it only for a nonempty selection', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(main, /id: 'menu-jump-to-selection', label: '跳转到选区'/);
  assert.ok(preload.includes("'menu:jump-to-selection'"));
  assert.match(renderer, /function jumpToSelection\(\)[\s\S]*selection\.empty\) return[\s\S]*editorScrollIntoView\(selection\.from\)/);
  assert.match(renderer, /'menu:jump-to-selection': jumpToSelection/);
  assert.match(menuState, /'menu-jump-to-selection': \{ enabled: hasDocument && hasSelection \}/);
});

test('Find All, Select All Find Matches and Multiple Replace remain distinct menu actions', () => {
  assert.match(main, /id: 'menu-find-all', label: '查找全部匹配项', accelerator: accelerator\('findAll'\)/);
  assert.match(main, /id: 'menu-select-all-find-matches', label: '选择所有查找匹配项'/);
  assert.match(main, /label: '多重替换', submenu: \[[\s\S]*?\.\.\.multipleReplaceItems,[\s\S]*?id: 'menu-multiple-replace', label: '管理多重替换…', click: \(\) => sendCommand\('menu:multiple-replace'\)/);
  assert.match(main, /id: `menu-multiple-replace-run-\$\{id\}`[\s\S]*?sendCommand\('menu:multiple-replace-definition', id\)/);
  assert.ok(preload.includes("'multiple-replace:menu-update'"));
  assert.ok(preload.includes("'menu:multiple-replace-definition'"));
  assert.ok(preload.includes("'menu:select-all-find-matches'"));
  assert.ok(preload.includes("'menu:multiple-replace'"));
  assert.match(renderer, /'menu:find-all': findAllMatches/);
  assert.match(renderer, /'menu:select-all-find-matches': selectAllSearchMatches/);
  assert.match(renderer, /'menu:multiple-replace': showMultipleReplaceManager/);
  assert.match(renderer, /'menu:multiple-replace-definition': runMultipleReplaceDefinitionById/);
  assert.match(renderer, /function syncMultipleReplaceMenu\(\)[\s\S]*?settings\.multipleReplaceDefinitions\.map\(\(\{ id, name \}\) => \(\{ id, label: name \}\)\)/);
  assert.match(renderer, /function executeMultipleReplaceDefinition\([\s\S]*?applyMultipleReplace\([\s\S]*?userEvent: 'input\.replace\.all'/);
  assert.match(renderer, /findAll: findAllMatches/);
  assert.match(main, /id: 'menu-highlight-all', label: '高亮全部匹配项', accelerator: accelerator\('highlightAll'\)/);
  assert.match(main, /id: 'menu-remove-highlights', label: '移除高亮', accelerator: accelerator\('removeHighlights'\)/);
  assert.ok(preload.includes("'menu:highlight-all'"));
  assert.ok(preload.includes("'menu:remove-highlights'"));
  assert.match(renderer, /'menu:highlight-all': highlightAllSearchMatches/);
  assert.match(renderer, /'menu:remove-highlights': removeSearchHighlights/);
  assert.match(renderer, /highlightAll: highlightAllSearchMatches/);
});

test('native menu follows CotEditor open grouping and exposes Delete under Edit', () => {
  assert.match(main, /label: '新建标签页'[\s\S]*?\{ type: 'separator' \},[\s\S]*?label: '打开…'/);
  assert.match(main, /role: 'paste'[\s\S]*?id: 'menu-delete', label: '删除'[\s\S]*?label: '选择', submenu: \[[\s\S]*?role: 'selectAll'/);
  assert.ok(preload.includes("'menu:delete'"));
  assert.ok(renderer.includes("'menu:delete'"));
});

test('Edit menu exposes CotEditor exact paste with literal clipboard text', () => {
  assert.match(main, /id: 'menu-paste-exactly'[\s\S]*?click: async \(\) => \{[\s\S]*?const text = await clipboard\.readText\(\);[\s\S]*?sendCommand\('menu:paste-exactly'/);
  assert.ok(preload.includes("'menu:paste-exactly'"));
  assert.match(renderer, /'menu:paste-exactly': text => pasteExactText\(activeEditor\(\), text\)/);
  assert.match(renderer, /else commands\[channel\]\?\.\(value\)/);
});

test('file and text menus expose routed window, recent, print and line movement actions', () => {
  for (const channel of ['menu:open-recent', 'menu:print', 'menu:move-line-up', 'menu:move-line-down', 'menu:select-enclosing-symbols']) {
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
  for (const label of ['新建窗口', '打开最近使用', '打印…', '上移行', '下移行', '选择包围符号内容']) assert.ok(main.includes(label), `native menu is missing ${label}`);
  assert.match(main, /ipcMain\.handle\('window:new'/);
  assert.match(main, /ipcMain\.handle\('document:print'/);
});

test('View menu exposes CotEditor split editor focus navigation only while split is active', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(main, /id: 'menu-focus-next-editor', label: '将焦点移至下一个编辑器', accelerator: accelerator\('focusNextEditor'\), registerAccelerator: false/);
  assert.match(main, /id: 'menu-focus-previous-editor', label: '将焦点移至上一个编辑器', accelerator: accelerator\('focusPreviousEditor'\), registerAccelerator: false/);
  assert.ok(preload.includes("'menu:focus-next-editor'"));
  assert.ok(preload.includes("'menu:focus-previous-editor'"));
  assert.match(renderer, /'menu:focus-next-editor': focusOtherSplitEditor/);
  assert.match(renderer, /'menu:focus-previous-editor': focusOtherSplitEditor/);
  assert.match(renderer, /focusNextEditor: focusOtherSplitEditor/);
  assert.match(renderer, /focusPreviousEditor: focusOtherSplitEditor/);
  assert.match(renderer, /function activeEditor\(\) \{\s*if \(secondaryView\?\.hasFocus\) return secondaryView;\s*if \(editorView\?\.hasFocus\) return editorView;/);
  assert.match(menuState, /'menu-focus-next-editor': \{ enabled: payload\.splitEnabled === true \}/);
  assert.match(menuState, /'menu-focus-previous-editor': \{ enabled: payload\.splitEnabled === true \}/);
});

test('Format menu exposes CotEditor Prevent Editing through transaction-safe editor locking', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(main, /id: 'menu-prevent-editing', label: '防止编辑', type: 'checkbox'/);
  assert.ok(main.includes("sendCommand('menu:prevent-editing')"));
  assert.ok(preload.includes("'menu:prevent-editing'"));
  assert.match(renderer, /'menu:prevent-editing': togglePreventEditing/);
  assert.match(renderer, /readOnlyCompartment\.reconfigure\(editabilityExtensions\(activeDoc\.preventEditing\)\)/);
  assert.match(renderer, /setAttribute\('aria-readonly', String\(activeDoc\?\.preventEditing === true\)\)/);
  assert.match(renderer, /\$\('#replace-one'\)\.disabled = !canReplace/);
  assert.match(menuState, /'menu-prevent-editing': \{ enabled: hasDocument, checked: payload\.preventEditing === true \}/);
});

test('Format menu exposes horizontal/vertical orientation and per-document LTR/RTL writing direction', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(main, /label: '书写方向', submenu: \[[\s\S]*?id: 'menu-orientation-horizontal',[\s\S]*?id: 'menu-orientation-vertical',[\s\S]*?id: 'menu-writing-direction-ltr',[\s\S]*?id: 'menu-writing-direction-rtl'/);
  for (const channel of ['menu:orientation-horizontal', 'menu:orientation-vertical', 'menu:writing-direction-ltr', 'menu:writing-direction-rtl']) {
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
  assert.match(renderer, /directionCompartment\.of\(EditorView\.contentAttributes\.of\(\{ dir: doc\.writingDirection/);
  assert.match(renderer, /directionCompartment\.reconfigure\(EditorView\.contentAttributes\.of\(\{ dir: value \}\)\)/);
  assert.match(menuState, /'menu-writing-direction-rtl': \{ enabled: hasDocument, checked: payload\.writingDirection === 'rtl' \}/);
  assert.doesNotMatch(main, /id: 'menu-toggle-vertical-text', label:/);
});

test('File menu keeps CotEditor core Close and Save command ordering', () => {
  const fileStart = main.indexOf("label: '文件', submenu:");
  const editStart = main.indexOf("label: '编辑', submenu:");
  assert.ok(fileStart >= 0 && editStart > fileStart, 'File and Edit menus exist');
  const fileMenu = main.slice(fileStart, editStart);
  const position = id => fileMenu.indexOf(`id: '${id}'`);
  assert.ok(position('menu-open-recent') < position('menu-close-document'));
  assert.ok(position('menu-close-document') < position('menu-save'));
  assert.ok(position('menu-save') < position('menu-save-as'));
  assert.ok(position('menu-save-as') < position('menu-revert'));
});

test('mixed line-ending diagnostics have a routed Format menu item only for mixed documents', () => {
  assert.match(main, /id: 'menu-inspect-line-endings', label: '检查混合换行符…'/);
  assert.match(main, /menu:inspect-line-endings/);
  assert.match(main, /'Mixed'\]\.includes\(payload\.eol\)/);
  assert.match(main, /state\.hasDocument && state\.eol === 'Mixed'/);
  assert.match(preload, /'menu:inspect-line-endings'/);
  assert.match(renderer, /menu:inspect-line-endings'\) showLineEndingDiagnostics\(\)/);
});

test('changing the document line ending synchronizes editor metadata and inserted-line fallback', () => {
  const handler = renderer.match(/function setLineEnding\(value\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(handler, 'line-ending setter exists');
  assert.match(renderer, /setDocumentLineEndingFallback/);
  assert.match(handler[1], /activeDoc\.eol = value/);
  assert.match(handler[1], /setDocumentLineEndings\.of\(activeDoc\.lineEndings\)/);
  assert.match(handler[1], /setDocumentLineEndingFallback\.of\(value\)/);
});

test('metadata-only line-ending history synchronizes the renderer document model', () => {
  assert.match(renderer, /const lineEndingMetadataChanged = synchronizeDocumentLineEndingMetadata\(activeDoc, update\)/);
  assert.match(renderer, /if \(update\.docChanged \|\| lineEndingMetadataChanged\)/);
});

test('revert-to-saved restores line-ending styles and fallback in the editor transaction', () => {
  const handler = renderer.match(/function revertToSaved\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(handler, 'revert-to-saved handler exists');
  assert.match(handler[1], /const savedLineEndings =/);
  assert.match(handler[1], /const savedEol =/);
  assert.match(handler[1], /effects: \[setDocumentLineEndings\.of\(savedLineEndings\), setDocumentLineEndingFallback\.of\(savedEol\)\]/);
});

test('native menus route revert, file path, selection, font and display preferences', () => {
  for (const channel of ['menu:revert', 'menu:reveal-file', 'menu:copy-path', 'menu:select-word', 'menu:font-up', 'menu:font-down', 'menu:font-reset', 'menu:toggle-ligatures', 'menu:toggle-invisibles', 'menu:toggle-indent-guides', 'menu:toggle-sidebar', 'menu:toggle-status-bar', 'menu:orientation-horizontal', 'menu:orientation-vertical']) {
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
    assert.ok(main.includes(`sendCommand('${channel}')`), `native menu is missing ${channel}`);
  }
  for (const label of ['恢复到已保存版本', '在文件管理器中显示', '复制文件路径', '显示不可见字符', '显示缩进参考线', '显示状态栏', '书写方向', '水平', '垂直']) {
    assert.ok(main.includes(label), `native menu is missing ${label}`);
  }
  assert.match(main, /registerAccelerator: false/, 'font shortcuts remain visible but are routed through the renderer on Windows/Linux');
  assert.match(main, /ipcMain\.handle\('document:reveal'/);
  assert.match(main, /ipcMain\.handle\('document:copy-path'/);
  const ligatureItem = main.match(/id: 'menu-toggle-ligatures'[^\n]*/)?.[0] || '';
  assert.match(main, /label: '字体', submenu: \[[\s\S]*?id: 'menu-show-fonts', label: '显示字体…'[\s\S]*?id: 'menu-toggle-ligatures', label: '使用字体连字', type: 'checkbox'/);
  assert.doesNotMatch(ligatureItem, /accelerator/);
  const fontPickerItem = main.match(/id: 'menu-show-fonts'[^\n]*/)?.[0] || '';
  assert.doesNotMatch(fontPickerItem, /accelerator/);
  assert.match(preload, /'menu:show-fonts'/);
  assert.match(renderer, /'menu:show-fonts': showFontPicker/);
  assert.match(renderer, /'menu:toggle-ligatures': \(\) => toggleSetting\('ligatures'\)/);
  assert.match(renderer, /ligatures: Boolean\(settings\.ligatures\)/);
});

test('Script menu follows Window, loads user scripts, and uses a time-bounded Worker', () => {
  const windowPosition = main.indexOf("{ label: '窗口'");
  const scriptPosition = main.indexOf("{ label: '脚本'");
  const helpPosition = main.indexOf("{ label: '帮助'");
  assert.ok(windowPosition >= 0 && windowPosition < scriptPosition && scriptPosition < helpPosition, 'Script menu follows CotEditor top-level order');
  assert.match(main, /loadUserScripts\(scriptsDirectory\)/);
  assert.match(main, /ipcMain\.handle\('script:get'/);
  assert.match(main, /ipcMain\.handle\('theme:import'/);
  assert.match(preload, /getScript: \(id\) => ipcRenderer\.invoke\('script:get', id\)/);
  assert.match(preload, /importCotEditorTheme: \(\) => ipcRenderer\.invoke\('theme:import'\)/);
  assert.match(renderer, /window\.cotedit\.getScript\(id\)/);
  assert.match(renderer, /new Worker\(workerUrl\)/);
  assert.match(renderer, /1500\)/, 'script execution is terminated after a short timeout');
});

test('CotEditor syntax packages are imported through the native menu and safe IPC', () => {
  assert.match(main, /label: '导入 CotEditor 语法…'/);
  assert.match(main, /ipcMain\.handle\('syntax:import'/);
  assert.match(main, /loadCotEditorSyntax\(result\.filePaths\[0\]\)/);
  assert.match(main, /ipcMain\.on\('syntax:menu-update'/);
  assert.match(preload, /importCotEditorSyntax: \(\) => ipcRenderer\.invoke\('syntax:import'\)/);
  assert.match(preload, /updateCustomSyntaxMenu: \(items\) => ipcRenderer\.send\('syntax:menu-update', items\)/);
  assert.match(renderer, /function importCotEditorSyntax\(\)/);
  assert.match(renderer, /createCotSyntaxMode\(customSyntax\)/);
});

test('file menu exposes page setup, preferences, and external integration settings', () => {
  for (const channel of ['menu:page-setup', 'menu:export-settings', 'menu:import-settings', 'menu:integration-settings']) {
    assert.ok(main.includes(`sendCommand('${channel}')`), `native menu is missing ${channel}`);
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
  assert.match(main, /ipcMain\.handle\('settings:export'/);
  assert.match(main, /ipcMain\.handle\('settings:import'/);
  assert.match(main, /MAX_SETTINGS_FILE_BYTES/);
  assert.match(renderer, /function showPageSetup\(\)/);
  assert.match(renderer, /function applyPageSetup\(event\)/);
  assert.match(index, /id="print-line-numbers" type="checkbox"/);
  assert.match(renderer, /printLineNumbers: \$\('#print-line-numbers'\)\.checked/);
  assert.match(renderer, /pageSetup: \{ \.\.\.settings, writingDirection: activeDoc\.writingDirection \}/);
  assert.match(main, /printOptions\(pageSetup\)/);
  assert.match(preload, /exportSettings: \(settings\) => ipcRenderer\.invoke\('settings:export', settings\)/);
  assert.match(preload, /importSettings: \(\) => ipcRenderer\.invoke\('settings:import'\)/);
  assert.match(preload, /printDocument: \(payload\) => ipcRenderer\.invoke\('document:print', payload\)/);
});

test('folder navigation is exposed through safe IPC and the Open Folder menu route', () => {
  assert.match(preload, /listDirectory: \(payload\) => ipcRenderer\.invoke\('directory:list', payload\)/);
  assert.match(main, /ipcMain\.handle\('directory:list'/);
  assert.match(main, /const directoryRoots = new WeakMap\(\)/);
  assert.match(main, /function directoryRootFor\(event\)/);
  assert.match(renderer, /'menu:open-folder': openFolderNavigation/);
  assert.match(renderer, /function renderFolderNavigation\(\)/);
  assert.match(renderer, /function navigateFolderDocumentHistory\(delta\)/);
});

test('folder browser Plus menu creates new files or folders through root-scoped exclusive filesystem operations', () => {
  const mutations = readFileSync(new URL('../electron/directory-mutations.cjs', import.meta.url), 'utf8');
  assert.match(index, /id="folder-add-toggle"[^>]*aria-haspopup="menu"/);
  assert.match(index, /id="folder-add-file"[^>]*role="menuitem"[^>]*>新建文件/);
  assert.match(index, /id="folder-add-folder"[^>]*role="menuitem"[^>]*>新建文件夹/);
  assert.match(index, /class="folder-browser-footer"[\s\S]*id="directory-name-filter"[\s\S]*id="folder-add-menu"/);
  assert.match(preload, /createDirectoryEntry: \(payload\) => ipcRenderer\.invoke\('directory:create-entry', payload\)/);
  assert.match(main, /ipcMain\.handle\('directory:create-entry',[\s\S]*?directoryRootFor\(event\)[\s\S]*?createFileInRoot\(selectedRoot, requestedPath, locale, payload\.extension\)[\s\S]*?createFolderInRoot\(selectedRoot, requestedPath, locale\)/);
  assert.match(main, /const locale = app\.getLocale\(\)[\s\S]*?createFileInRoot\(selectedRoot, requestedPath, locale, payload\.extension\)[\s\S]*?createFolderInRoot\(selectedRoot, requestedPath, locale\)/);
  assert.match(mutations, /resolveWithinRoot\(rootPath, requestedPath, \{[\s\S]*?操作路径超出已选文件夹范围[\s\S]*?操作路径通过符号链接离开了已选文件夹/);
  assert.match(mutations, /fs\.open\(filePath, 'wx'/);
  assert.match(mutations, /fs\.mkdir\(folderPath/);
  assert.match(renderer, /function createFolderNavigationEntry\(kind\)[\s\S]*?createEntry\([\s\S]*?defaultSyntaxExtension\(\)/);
  assert.ok(index.includes('id="default-syntax-setting"'), 'settings expose the default syntax preference');
  assert.match(renderer, /function newDocument\(\)[\s\S]*?defaultSyntaxId\(\)[\s\S]*?defaultSyntaxExtension\(\)[\s\S]*?newDocumentLanguage: syntax/);
  assert.match(renderer, /\$\('#folder-add-file'\)\.addEventListener\('click',[\s\S]*createFolderNavigationEntry\('file'\)/);
  assert.match(renderer, /\$\('#folder-add-folder'\)\.addEventListener\('click',[\s\S]*createFolderNavigationEntry\('directory'\)/);
  assert.equal(shortcuts.some(item => item.id === 'newFolderEntry' || item.id === 'newFileEntry'), false, 'CotEditor adds no default shortcut for these actions');
});

test('folder browser filters filenames through the root-scoped listing and keeps the preview selection', () => {
  assert.match(index, /id="directory-name-filter" type="search" aria-label="筛选当前文件夹中的文件和子文件夹名称" aria-controls="folder-navigation-items"[^>]*maxlength="512"[^>]*disabled/);
  assert.match(renderer, /window\.cotedit\.listDirectory\(\{ path: folderNavigationPath \|\| folderNavigationRoot, nameFilter \}\)/);
  assert.match(renderer, /Array\.from\(input\.value\)[\s\S]*?characters\.length > 256[\s\S]*?characters\.slice\(0, 256\)/);
  assert.match(main, /return listDirectory\(selectedRoot, requestedPath, \{ nameFilter: options\.nameFilter \}\)/);
  assert.match(renderer, /aria-current="\$\{entry\.kind === 'file' && entry\.path === folderPreviewPath \? 'true' : 'false'\}"/);
  assert.match(renderer, /function syncFolderNavigationSelection\(\)[\s\S]*?button\.dataset\.path === folderPreviewPath/);
  assert.match(renderer, /function hideFolderPreview\(\)[\s\S]*?syncFolderNavigationSelection\(\)/);
  assert.match(renderer, /folderNameFilterTimer = setTimeout\([\s\S]*?void renderFolderNavigation\(\)/);
  assert.equal(shortcuts.some(item => item.id === 'directoryNameFilter'), false, 'filename filtering does not invent a shortcut');
});

test('folder search is integrated in the sidebar and previews only files inside its selected root', () => {
  assert.match(index, /id="folder-search-form"[\s\S]*id="directory-query"/);
  assert.match(index, /id="directory-results" class="folder-search-results/);
  assert.match(index, /id="folder-preview-open-plain"[^>]*>以纯文本打开/);
  assert.doesNotMatch(index, /id="directory-panel"/);
  assert.match(preload, /previewFile: \(filePath\) => ipcRenderer\.invoke\('directory:preview', filePath\)/);
  assert.match(preload, /openPath: \(filePath, options\) => ipcRenderer\.invoke\('document:open-path', filePath, options\)/);
  assert.match(main, /ipcMain\.handle\('directory:preview'/);
  assert.match(main, /previewFileInRoot\(selectedRoot, requestedPath\)/);
  assert.match(main, /const plainText = options\?\.plainText === true/);
  assert.match(main, /readDocument\(editable\.path, \{ allowBinaryText: plainText \}\)/);
  assert.match(main, /return \{ \.\.\.document, plainText \}/);
  assert.match(renderer, /function openFolderSearch\(\)/);
  assert.match(renderer, /window\.cotedit\.previewFile\(filePath\)/);
  assert.match(renderer, /options\.plainText === true/);
  assert.match(renderer, /'menu:search-folder': openFolderSearch/);
});

test('folder preview avoids default text-opening executables, binary property lists, images, audio and ISO BMFF while retaining explicit overrides', () => {
  assert.match(main, /ipcMain\.handle\('document:open-path',[\s\S]*?resolveWithinRoot\(selectedRoot, requestedPath[\s\S]*?options\?\.plainText === true[\s\S]*?resolveRegularFileInRoot\(openedRoot\.root, openedRoot\.path\)[\s\S]*?: await resolveEditableFileInRoot\(openedRoot\.root, openedRoot\.path\)/);
  assert.match(main, /async function readDocument\(filePath, \{ allowBinaryText = false \} = \{\}\)/);
  assert.match(main, /const plainText = options\?\.plainText === true[\s\S]*?readDocument\(editable\.path, \{ allowBinaryText: plainText \}\)/);
  assert.match(main, /ipcMain\.handle\('directory:open-in-new-window',[\s\S]*?resolveEditableFileInRoot\(selectedRoot, requestedPath\)/);
  assert.match(directorySearch, /function isBinaryPropertyListSignature\(header\)/);
  assert.match(directorySearch, /isBinaryPropertyListSignature\(signature\)/);
  assert.match(directorySearch, /isBinaryPropertyListSignature\(buffer\)/);
  assert.match(directorySearch, /require\('\.\/image-dimensions\.cjs'\)/);
  assert.match(directorySearch, /MAX_FILE_TYPE_SIGNATURE_BYTES = 24/);
  assert.match(directorySearch, /isIsoBmffContainer\(signature, opened\.stat\.size\)/);
  assert.match(directorySearch, /const visibleBuffer = buffer\.subarray\(0, limit\);[\s\S]*?parseImageDimensions\(visibleBuffer\)[\s\S]*?imageDimensions[\s\S]*?const decoded = decodeBuffer\(visibleBuffer\)/);
  assert.match(directorySearch, /parseImageDpi\(visibleBuffer\)[\s\S]*?imageDpi/);
  assert.match(directorySearch, /parseImageColorAttributes\(visibleBuffer\)[\s\S]*?imageColorModel:[\s\S]*?imageColorProfile:/);
  assert.match(directorySearch, /isWaveContainer\(visibleBuffer\)[\s\S]*?parseWavePcmDuration\(visibleBuffer, stat\.size\)/);
  assert.match(directorySearch, /parseWavePcmDuration\(visibleBuffer, stat\.size\)[\s\S]*?audioDurationSeconds/);
  assert.match(directorySearch, /const aiffAudio = isAiffContainer\(visibleBuffer\)[\s\S]*?parseAiffPcmDuration\(visibleBuffer, stat\.size\)[\s\S]*?audioKind/);
  assert.match(directorySearch, /isIsoBmffContainer\(visibleBuffer, stat\.size\)[\s\S]*?parseIsoBmffMovieAttributes\(visibleBuffer, stat\.size\)[\s\S]*?movieDurationSeconds/);
  assert.match(renderer, /const executable = result\.executable === true/);
  assert.match(renderer, /const binaryPropertyList = result\.binaryPropertyList === true/);
  assert.match(renderer, /const image = result\.image === true[\s\S]*?Number\.isSafeInteger\(dimensions\?\.height\)/);
  assert.match(renderer, /const imageDpi = image && Number\.isFinite\(result\.imageDpi\)/);
  assert.match(renderer, /const imageColorModel = image && \['RGB', 'Gray'\]\.includes\(result\.imageColorModel\)/);
  assert.match(renderer, /const imageColorProfile = image && \['sRGB', 'Display P3'\]\.includes\(result\.imageColorProfile\)/);
  assert.match(renderer, /const audioFile = result\.audio === true/);
  assert.match(renderer, /\['WAVE', 'AIFF', 'AIFF-C'\]\.includes\(result\.audioKind\)/);
  assert.match(renderer, /const audio = audioFile && Number\.isFinite\(result\.audioDurationSeconds\)/);
  assert.match(renderer, /RIFF\/WAVE PCM fmt\/data 块字段与样本帧对齐计算时长/);
  assert.match(renderer, /超出 512 KiB 前缀的尾部结构不完整验证/);
  assert.match(renderer, /经典 AIFF 的 COMM\/SSND 头、采样帧数和扩展精度采样率计算未压缩 PCM 时长/);
  assert.match(renderer, /audioKind === 'AIFF-C'[\s\S]*?唯一有效 FVER\/COMM、合法 Pascal 压缩名[\s\S]*?NONE 或 sowt（未压缩整数 PCM）/);
  assert.match(renderer, /其它 codec、未知版本、采样率或数据边界不满足条件时不推测时长/);
  assert.match(renderer, /const isoBmff = result\.isoBmff === true/);
  assert.match(renderer, /const movie = isoBmff && result\.movie === true/);
  assert.match(renderer, /const blockedPlainText = executable \|\| binaryPropertyList \|\| image \|\| audioFile \|\| isoBmff/);
  assert.match(renderer, /folder-preview-open-plain'\)\.disabled = false/);
  assert.match(renderer, /folder-preview-open'\)\.disabled = blockedPlainText/);
  assert.match(renderer, /folder-preview-open-new-window'\)\.disabled = blockedPlainText[\s\S]*?folder-preview-open-external'\)\.disabled = false/);
  assert.match(renderer, /renderFolderPreviewAttributes\(buildFolderPreviewAttributes\(result\)\)/);
  assert.ok(index.includes('id="folder-preview-attributes"'), 'preview attributes have a semantic definition-list container');
  assert.match(renderer, /function renderFolderPreviewAttributes\(attributes\)[\s\S]*?term\.textContent = attribute\.label[\s\S]*?value\.textContent = attribute\.value/);
  assert.match(renderer, /图像字节不会按文本解码；这里只显示从受限文件头识别出的像素尺寸\$\{imageDpi === null \? '' : '、水平 DPI'\}\$\{imageColorModel === null && imageColorProfile === null \? '' : '及有限的色彩模型\/配置文件名'\}/);
  assert.match(renderer, /明确要查看或编辑，可选择“以纯文本打开”/);
  assert.match(renderer, /保存可能改写原始二进制内容/);
});

test('View Sidebar adds the CotEditor file-browser and folder-search menu routes', () => {
  assert.match(main, /label: '侧栏', submenu: \[[\s\S]*?id: 'menu-folder-browser',[\s\S]*?accelerator: accelerator\('folderBrowser'\)[\s\S]*?id: 'menu-folder-find',[\s\S]*?accelerator: accelerator\('folderFind'\)/);
  assert.match(renderer, /'menu:folder-browser': openFolderNavigation, 'menu:folder-find': openFolderSearch/);
  assert.match(renderer, /folderBrowser: openFolderNavigation, folderFind: openFolderSearch/);
});

test('Window menu exposes tested Keep on Top and Bring All to Front actions', () => {
  assert.match(main, /id: 'menu-keep-on-top',[\s\S]*?type: 'checkbox'[\s\S]*?toggleAlwaysOnTop\(window\)/);
  assert.match(main, /id: 'menu-bring-all-to-front',[\s\S]*?bringAllWindowsToFront\(BrowserWindow\.getAllWindows\(\)\)/);
  assert.match(main, /alwaysOnTop: Boolean\(window && !window\.isDestroyed\(\) && window\.isAlwaysOnTop\(\)\)/);
});

test('Help menu opens an in-app guide and the inspector group includes document details and outline', () => {
  assert.match(main, /label: 'CotEdit 使用说明',[^\n]*sendCommand\('menu:help'\)/);
  assert.match(renderer, /'menu:help': showHelp/);
  assert.match(index, /id="help-dialog"/);
  assert.match(index, /id="help-open-shortcuts"/);
  assert.match(main, /label: '检查器', submenu: \[[\s\S]*?id: 'menu-document-inspector',[\s\S]*?id: 'menu-outline'/);
  const documentInspector = main.match(/id: 'menu-document-inspector',[^\n]*/)?.[0];
  assert.ok(documentInspector);
  assert.doesNotMatch(documentInspector, /accelerator:/, 'CotEditor Document Inspector has no static default key equivalent');
  assert.match(main, /id: 'menu-document-inspector',[^\n]*/);
  assert.doesNotMatch(documentInspector, /accelerator:/, 'CotEditor Document Inspector has no static default key equivalent');
  assert.ok(!shortcuts.some(shortcut => shortcut.id === 'showInspector'), 'do not invent a Document Inspector default shortcut');
  assert.match(main, /home: 'https:\/\/github\.com\/jincaiw\/cotedit'/);
  assert.match(main, /releases: 'https:\/\/github\.com\/jincaiw\/cotedit\/releases'/);
  assert.match(main, /issues: 'https:\/\/github\.com\/jincaiw\/cotedit\/issues\/new'/);
  for (const page of ['releases', 'issues', 'home']) assert.match(main, new RegExp(`openProjectHelpPage\\('${page}'\\)`));
});

test('folder preview opens in a new window only after resolving a regular file inside the selected root', () => {
  assert.match(index, /id="folder-preview-open-new-window"[^>]*>在新窗口打开/);
  assert.match(preload, /openPathInNewWindow: \(filePath\) => ipcRenderer\.invoke\('directory:open-in-new-window', filePath\)/);
  assert.match(main, /const \{ previewFileInRoot, resolveEditableFileInRoot, resolveRegularFileInRoot, searchDirectory \} = require\('\.\/directory-search\.cjs'\)/);
  assert.match(main, /ipcMain\.handle\('directory:open-in-new-window',[\s\S]*?directoryRootFor\(event\)[\s\S]*?resolveEditableFileInRoot\(selectedRoot, requestedPath\)[\s\S]*?const window = createWindow\(\)[\s\S]*?queueExternalOpenPath\(filePath, window\)/);
  assert.match(main, /pendingExternalPathsByWindow\.get\(window\)/);
  assert.match(renderer, /function openFolderPreviewInNewWindow\(filePath\)[\s\S]*?window\.cotedit\.openPathInNewWindow\(filePath\)/);
  assert.match(renderer, /\$\('#folder-preview-open-new-window'\)\.addEventListener\('click'/);
});

test('folder preview opens with the system default app only after root and file validation', () => {
  assert.match(index, /id="folder-preview-open-external"[^>]*aria-label="使用系统默认应用打开"[^>]*>外部编辑器/);
  assert.match(index, /id="folder-preview-external-menu-toggle"[^>]*aria-haspopup="menu"[^>]*aria-controls="folder-preview-external-menu"/);
  assert.match(index, /id="folder-preview-open-default"[^>]*role="menuitem"[^>]*>默认应用/);
  assert.match(preload, /openFileExternally: \(filePath\) => ipcRenderer\.invoke\('directory:open-external', filePath\)/);
  assert.match(main, /ipcMain\.handle\('directory:open-external',[\s\S]*?directoryRootFor\(event\)[\s\S]*?openExternalFileInRoot\(selectedRoot, requestedPath, filePath => shell\.openPath\(filePath\)\)/);
  assert.match(renderer, /function openFolderPreviewExternally\(filePath\)[\s\S]*?window\.cotedit\.openFileExternally\(filePath\)[\s\S]*?无法使用系统默认应用打开/);
  assert.match(renderer, /\$\('#folder-preview-open-external'\)\.addEventListener\('click'/);
  assert.match(renderer, /\$\('#folder-preview-open-default'\)\.addEventListener\('click'/);
});

test('folder preview can select another application through a root-validated main-process route', () => {
  assert.match(index, /id="folder-preview-external-menu"[^>]*role="menu"[^>]*aria-label="外部编辑器选项"[\s\S]*?id="folder-preview-open-with"[^>]*role="menuitem"[^>]*>其他应用…/);
  assert.match(preload, /openFileWithApplication: \(filePath\) => ipcRenderer\.invoke\('directory:open-with-application', filePath\)/);
  assert.match(main, /ipcMain\.handle\('directory:open-with-application',[\s\S]*?directoryRootFor\(event\)[\s\S]*?resolveRegularFileInRoot\(selectedRoot, requestedPath\)[\s\S]*?dialog\.showOpenDialog\(windowForEvent\(event\), options\)[\s\S]*?openFileWithApplicationInRoot\(selectedRoot, requestedPath, result\.filePaths\[0\]\)/);
  assert.match(main, /const options = createExternalApplicationDialogOptions\(\);/);
  assert.match(renderer, /function openFolderPreviewWithApplication\(filePath\)[\s\S]*?window\.cotedit\.openFileWithApplication\(filePath\)[\s\S]*?result\?\.canceled !== true/);
  assert.match(renderer, /\$\('#folder-preview-open-with'\)\.addEventListener\('click'/);
  assert.match(renderer, /function setFolderPreviewExternalMenuOpen\(open,[\s\S]*?aria-expanded[\s\S]*?restoreToggleFocus/);
  assert.match(renderer, /function handleFolderPreviewExternalMenuKeydown\(event\)[\s\S]*?ArrowDown[\s\S]*?ArrowUp[\s\S]*?Home[\s\S]*?End[\s\S]*?Escape/);
});

test('Text menu exposes selection wrapping and indentation conversion through safe command routes', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  const commands = [
    'menu:indent-to-spaces', 'menu:indent-to-tabs', 'menu:surround-single-quotes',
    'menu:surround-double-quotes', 'menu:surround-parentheses', 'menu:surround-braces', 'menu:surround-brackets', 'menu:surround-custom'
  ];
  for (const command of commands) {
    assert.ok(main.includes(`sendCommand('${command}')`), `native menu is missing ${command}`);
    assert.ok(preload.includes(`'${command}'`), `preload is missing ${command}`);
    assert.ok(renderer.includes(`'${command}'`), `renderer is missing ${command}`);
  }
  for (const label of ['将缩进转换为空格', '将缩进转换为制表符', '包围所选内容', '单引号', '双引号', '圆括号', '花括号', '方括号', '自定义…']) {
    assert.ok(main.includes(label), `native menu is missing ${label}`);
  }
  assert.match(renderer, /function convertSelectedIndentation\(target\)/);
  assert.match(renderer, /function surroundSelection\(opening, closing = opening\)/);
  assert.match(renderer, /function showCustomSurroundDialog\(\)/);
  assert.match(menuState, /'menu-surround-parentheses': \{ enabled: canEdit && hasSelection \}/);
});

test('Text menu routes URL, Unicode and CotEditor width transformations through safe commands', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  const commands = ['menu:uppercase', 'menu:lowercase', 'menu:capitalize', 'menu:url-encode', 'menu:url-decode', 'menu:unicode-nfc', 'menu:unicode-nfd', 'menu:unicode-nfkc', 'menu:unicode-nfkd', 'menu:unicode-modified-nfd', 'menu:unicode-modified-nfc', 'menu:fullwidth', 'menu:halfwidth', 'menu:fullwidth-roman', 'menu:halfwidth-roman'];
  const ids = ['menu-uppercase', 'menu-lowercase', 'menu-capitalize', 'menu-url-encode', 'menu-url-decode', 'menu-normalize-nfc', 'menu-normalize-nfd', 'menu-normalize-nfkc', 'menu-normalize-nfkd', 'menu-normalize-modified-nfd', 'menu-normalize-modified-nfc', 'menu-fullwidth', 'menu-halfwidth', 'menu-fullwidth-roman', 'menu-halfwidth-roman'];
  for (const command of commands) {
    assert.ok(main.includes(`sendCommand('${command}')`), `native menu is missing ${command}`);
    assert.ok(preload.includes(`'${command}'`), `preload is missing ${command}`);
    assert.ok(renderer.includes(`'${command}'`), `renderer is missing ${command}`);
  }
  for (const id of ids) assert.ok(menuState.includes(`'${id}': { enabled: canEdit }`), `${id} should work on the word at the caret or a selection`);
  for (const label of ['文本转换', '首字母大写', 'URL 编码', 'URL 解码', 'Unicode 规范化', 'NFC（规范分解后合成）', 'NFKD（兼容分解）', 'Modified NFD（HFS+ 规范分解）', 'Modified NFC（HFS+ 规范合成）', '转换为全角', '转换为半角', '字母数字转换为全角', '字母数字转换为半角']) {
    assert.ok(main.includes(label), `native menu is missing ${label}`);
  }
  assert.match(renderer, /function transformSelectedText\(transform, errorLabel = '文本转换失败', selectionRequired = false\)/);
  assert.match(renderer, /textTransformationTransaction\(view\.state, transform, \{ selectionRequired \}\)/);
  assert.match(renderer, /'menu:url-decode': \(\) => transformSelectedText\(decodeURLComponent\)/);
  assert.doesNotMatch(renderer, /menu:url-decode.*有效的 URL 编码文本/);
  assert.match(renderer, /decodeURLComponent/);
  assert.match(renderer, /normalizeUnicode\(text, 'NFKC'\)/);
  assert.match(renderer, /normalizeUnicode\(text, 'MODIFIED_NFD'\)/);
  assert.match(renderer, /normalizeUnicode\(text, 'MODIFIED_NFC'\)/);
  assert.match(renderer, /convertToFullWidth/);
  assert.match(renderer, /convertToHalfWidth/);
  assert.match(renderer, /convertRomanToFullWidth/);
  assert.match(renderer, /convertRomanToHalfWidth/);
});


test('line transformations are exposed through native menus, IPC and the renderer', () => {
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  const lineChannels = ['menu:sort-lines', 'menu:sort-by-pattern', 'menu:reverse-lines', 'menu:shuffle-lines', 'menu:delete-duplicates'];
  for (const channel of lineChannels) {
    assert.ok(main.includes(`sendCommand('${channel}')`), `native menu is missing ${channel}`);
    assert.ok(preload.includes(`'${channel}'`), `preload is missing ${channel}`);
    assert.ok(renderer.includes(`'${channel}'`), `renderer is missing ${channel}`);
  }
  for (const label of ['排序', '按模式排序…', '反转', '随机打乱', '删除重复项']) assert.ok(main.includes(label), `line menu is missing ${label}`);
  const lineItemIds = ['menu-sort-lines', 'menu-sort-by-pattern', 'menu-reverse-lines', 'menu-shuffle-lines', 'menu-delete-duplicates'];
  const menuLines = main.split('\n');
  const positions = lineItemIds.map(id => menuLines.findIndex(line => line.includes(`id: '${id}'`)));
  assert.ok(positions.every(position => position >= 0), 'all line menu item declarations should exist');
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right), 'line commands should follow the upstream storyboard order');
  for (const id of lineItemIds) {
    const declaration = menuLines.find(line => line.includes(`id: '${id}'`));
    assert.doesNotMatch(declaration, /accelerator:/, `${id} has no static CotEditor shortcut`);
  }
  assert.match(menuState, /'menu-sort-by-pattern': \{ enabled: canEdit \}/);
  assert.match(renderer, /function transformActiveLineBlock\([\s\S]*effects: setDocumentLineEndings\.of\(nextEndings\)/);
  assert.match(renderer, /sortSelectedLines\(draft\.options\)/);
  assert.match(index, /id="pattern-sort-preview"[\s\S]*id="pattern-sort-key"[\s\S]*id="pattern-sort-regexp"/);
});

test('Copy as Rich Text uses CotEditor menu routing and the isolated multi-format clipboard bridge', () => {
  const shortcut = shortcuts.find(item => item.id === 'copyAsRichText');
  assert.ok(shortcut, 'the default CotEditor rich-text shortcut is registered');
  assert.equal(shortcut.accelerator, 'CmdOrCtrl+Shift+C');
  assert.ok(main.includes("id: 'menu-copy-as-rich-text'"));
  assert.ok(main.includes("accelerator: accelerator('copyAsRichText')"));
  assert.ok(main.includes("sendCommand('menu:copy-as-rich-text')"));
  assert.ok(main.includes("ipcMain.handle('clipboard:write-rich-text'"));
  assert.ok(main.includes('new ClipboardItem(formats)'));
  assert.ok(preload.includes("'menu:copy-as-rich-text'"));
  assert.ok(preload.includes("ipcRenderer.invoke('clipboard:write-rich-text', payload)"));
  assert.ok(renderer.includes("'menu:copy-as-rich-text': () => copySelectionAsRichText(activeEditor())"));
  assert.ok(renderer.includes('copyAsRichText: () => copySelectionAsRichText(activeEditor())'));
  const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
  assert.match(menuState, /'menu-copy-as-rich-text': \{ enabled: hasDocument && hasRichTextSelection \}/);
  assert.match(renderer, /function createRichTextClipboardPayload\(view\)/);
});

test('Format > Tab Width exposes CotEditor Use Spaces for Indentation as a persisted checkbox', () => {
  const tabWidthMenu = main.slice(main.indexOf('const tabWidthItems ='), main.indexOf('const themeItems ='));
  assert.match(tabWidthMenu, /id: 'menu-tab-width-custom'[\s\S]*?id: 'menu-auto-expand-tab', label: '使用空格缩进', type: 'checkbox'/);
  assert.match(tabWidthMenu, /sendCommand\('menu:auto-expand-tab'\)/);
  assert.ok(preload.includes("'menu:auto-expand-tab'"));
  assert.match(renderer, /'menu:auto-expand-tab': \(\) => \{[\s\S]*activeDoc\.detectedIndentStyle = null[\s\S]*settings\.autoExpandTab = !current/);
  assert.match(renderer, /autoExpandTab: effectiveAutoExpandTab\(activeDoc\?\.detectedIndentStyle, settings\.autoExpandTab\)/);
  assert.match(renderer, /if \(insertionMode === 'soft-tabs'\) return insertSoftTab\(view, settings\.tabWidth\)/);
  assert.match(renderer, /Prec\.highest\(keymap\.of\(\[\s*\{ key: 'Backspace', run: view => tabInsertionMode\(\) === 'soft-tabs' && deleteSoftTab\(view, settings\.tabWidth\) \},\s*\{ key: 'Shift-Tab', run: view => handleSelectedLinesTab\(view, settings\.indentWithTabKey, true\) \}\s*\]\)\)/);
  assert.match(renderer, /if \(handleSelectedLinesTab\(view, settings\.indentWithTabKey\)\) return true/);
  assert.match(readFileSync(new URL('../lib/settings.js', import.meta.url), 'utf8'), /indentWithTabKey: typeof value\.indentWithTabKey === 'boolean' \? value\.indentWithTabKey : DEFAULT_SETTINGS\.indentWithTabKey/);
  assert.match(readFileSync(new URL('../lib/settings.js', import.meta.url), 'utf8'), /autoExpandTab: typeof value\.autoExpandTab === 'boolean' \? value\.autoExpandTab : DEFAULT_SETTINGS\.autoExpandTab/);
  assert.match(readFileSync(new URL('../lib/settings.js', import.meta.url), 'utf8'), /detectsIndentStyle: typeof value\.detectsIndentStyle === 'boolean' \? value\.detectsIndentStyle : DEFAULT_SETTINGS\.detectsIndentStyle/);
  const item = tabWidthMenu.match(/\{ id: 'menu-auto-expand-tab'[^\n]*/)?.[0] || '';
  assert.doesNotMatch(item, /accelerator:/, 'CotEditor declares no default shortcut for this preference');
});

test('standalone Comment Out menu item is routed through preload to the shared editor command', () => {
  assert.match(main, /id: 'menu-comment-out', label: '注释所选内容',[^\n]*sendCommand\('menu:comment-out'\)/);
  assert.ok(preload.includes("'menu:comment-out'"), 'the preload menu channel is allowlisted');
  assert.match(renderer, /'menu:comment-out': \(\) => commentOutSelection\(activeEditor\(\), settings\.appendsCommentSpacer\)/);
});
