import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('editor panes expose named multiline textboxes and status descriptions', () => {
  assert.match(renderer, /function syncEditorAccessibility\(\)/);
  assert.match(renderer, /setAttribute\('role', 'textbox'\)/);
  assert.match(renderer, /setAttribute\('aria-multiline', 'true'\)/);
  assert.match(renderer, /aria-label', `\$\{label\}：\$\{name\}`/);
  assert.match(renderer, /分屏文本编辑器/);
  assert.match(renderer, /aria-describedby', 'cursor-position selection-info word-count'/);
  assert.match(renderer, /setAttribute\('aria-readonly', String\(activeDoc\?\.preventEditing === true\)\)/);
});

test('icon-only controls and page setup dialog have accessible names and labels', () => {
  assert.match(html, /id="sidebar-new"[^>]*aria-label="新建文稿"/);
  assert.match(html, /<dialog id="page-setup-dialog"[^>]*aria-labelledby="page-setup-title"/);
  assert.match(html, /<dialog id="line-ending-dialog"[^>]*aria-labelledby="line-ending-title"/);
  assert.match(html, /id="line-ending-warning"[^>]*aria-haspopup="dialog"/);
  for (const id of ['print-page-size', 'print-orientation', 'print-margins', 'print-title', 'print-font-size']) {
    assert.match(html, new RegExp(`<label class="page-setting-row">[\\s\\S]*?id="${id}"`), `${id} should be nested in a label`);
  }
});

test('default window dimensions expose labelled pixel inputs and persist changes', () => {
  assert.match(html, /id="window-width-setting" min="860" max="4000" step="10" placeholder="上次" aria-label="默认窗口宽度（像素；留空使用上次窗口尺寸）"/);
  assert.match(html, /id="window-height-setting" min="600" max="4000" step="10" placeholder="上次" aria-label="默认窗口高度（像素；留空使用上次窗口尺寸）"/);
  assert.match(renderer, /window-width-setting'\)\.addEventListener\('change'/);
  assert.match(renderer, /window-height-setting'\)\.addEventListener\('change'/);
  assert.match(renderer, /settings\.windowWidth = null/);
  assert.match(renderer, /settings\.windowHeight = null/);
  assert.match(renderer, /settings\.windowWidth = Math\.max\(860, Math\.min\(4000, Math\.round\(value\)\)\)/);
  assert.match(renderer, /settings\.windowHeight = Math\.max\(600, Math\.min\(4000, Math\.round\(value\)\)\)/);
});

test('find toolbar button has a concise accessible name and hides its decorative glyph', () => {
  assert.match(html, /<button class="tool-button" id="find-button"[^>]*aria-label="查找与替换"[^>]*aria-controls="search-panel"[^>]*aria-expanded="false"><span aria-hidden="true">⌕<\/span> <span>查找<\/span><\/button>/);
});

test('status-bar selectors keep a visible keyboard focus indicator', () => {
  for (const id of ['language-select', 'encoding-select', 'eol-select']) {
    assert.ok(html.includes(`id="${id}"`), `${id} should be present in the status bar`);
  }
  assert.match(styles, /\.status-right select:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\);[^}]*outline-offset:\s*2px/);
});

test('outline navigation exposes named keyboard controls and announces the current item', () => {
  assert.match(html, /<nav id="navigation-bar"[^>]*aria-label="文稿导航栏"/);
  assert.match(html, /<select id="outline-navigation-select" aria-label="大纲菜单"/);
  assert.match(html, /id="outline-previous"[^>]*aria-label="上一个大纲项"/);
  assert.match(html, /id="outline-next"[^>]*aria-label="下一个大纲项"/);
  assert.match(html, /id="outline-navigation-status"[^>]*role="status" aria-live="polite"/);
  assert.match(renderer, /outline-navigation-select'\)\.addEventListener\('change'/);
  assert.match(renderer, /select\.focus\(\);[\s\S]*select\.showPicker/);
  assert.match(renderer, /navigation-bar-setting'\)\.addEventListener\('change', event => \{ settings\.showNavigationBar = event\.target\.checked; persistSettings\(\); applySettings\(\); \}\)/);
});

test('status bar background preference is labelled, persistent, and follows editor/opaque surfaces', () => {
  assert.match(html, /<label class="setting-row" title="启用后，状态栏使用不透明的界面背景；关闭时背景与编辑器一致。"><span>状态栏使用不透明背景<\/span><input type="checkbox" id="status-bar-opaque-setting" \/><\/label>/);
  assert.match(renderer, /\$\('#status-bar-opaque-setting'\)\.checked = settings\.statusBarOpaqueBackground/);
  assert.match(renderer, /\$\('#status-bar-opaque-setting'\)\.addEventListener\('change', event => \{ settings\.statusBarOpaqueBackground = event\.target\.checked; persistSettings\(\); applySettings\(\); \}\)/);
  assert.match(renderer, /classList\.toggle\('opaque-background', settings\.statusBarOpaqueBackground\)/);
  assert.match(styles, /\.statusbar\s*\{[^}]*background:\s*var\(--editor-theme-background, var\(--panel\)\)/);
  assert.match(styles, /\.statusbar\.opaque-background\s*\{[^}]*background:\s*var\(--panel-soft\)/);
});

test('page setup and line-ending dialogs explicitly focus their intended entry control', () => {
  assert.match(renderer, /function showPageSetup\(\) \{[\s\S]*?showModal\(\)[\s\S]*?\$\('#print-page-size'\)\.focus\(\)/);
  assert.match(renderer, /function showLineEndingDiagnostics\(\) \{[\s\S]*?showModal\(\)[\s\S]*?\$\('#line-ending-close'\)\.focus\(\)/);
});

test('floating panels restore focus and clear expanded state when dismissed', () => {
  assert.match(renderer, /function closePanel\(id, restoreFocus = false\)/);
  assert.match(renderer, /trigger\.setAttribute\('aria-expanded', 'false'\)/);
  assert.match(renderer, /if \(restoreFocus\) selectionPopover \? activeEditor\(\)\?\.focus\(\) : trigger\.focus\(\)/);
  assert.match(renderer, /const selectionPopover = id === 'character-panel' && panel\.dataset\.mode === 'selection'/);
  assert.match(renderer, /closePanel\(button\.dataset\.closePanel, true\)/);
  assert.match(renderer, /closePanel\(id, \$\(`#\$\{id\}`\)\.contains\(activeElement\)\)/);
  assert.match(renderer, /Escape[^\n]+clearDirectorySearch\(true\)/);
  assert.match(renderer, /function showLineEndingDiagnostics\(\)/);
  assert.match(renderer, /line-ending-dialog'\)\.addEventListener\('close'/);
});

test('outline navigation closes its panel and requests centered vertical scrolling', () => {
  assert.match(renderer, /function renderOutline\(\)[\s\S]*list\.querySelectorAll\('\[data-line\]'\)[\s\S]*closePanel\('outline-panel'\)[\s\S]*jumpToLine\(Number\(button\.dataset\.line\)\)/);
  assert.match(renderer, /function editorScrollIntoView\(position\) \{[\s\S]*?return settings\.verticalText[\s\S]*?x: 'center', y: 'center'/);
  assert.match(renderer, /function jumpToLine\(lineNumber\) \{[\s\S]*?effects: editorScrollIntoView\(line\.from\)/);
});

test('folder navigation controls are named and inactive sidebar content is hidden', () => {
  assert.match(html, /id="folder-navigation-toggle"[^>]*aria-label="打开文件夹导航"/);
  assert.match(html, /id="folder-navigation-view"[^>]*aria-label="文件夹导航"[^>]*hidden/);
  assert.match(html, /id="folder-history-previous"[^>]*aria-label="上一个文稿"/);
  assert.match(html, /id="folder-history-next"[^>]*aria-label="下一个文稿"/);
  assert.match(html, /id="folder-add-toggle"[^>]*aria-label="添加文件或文件夹"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*disabled/);
  assert.match(html, /id="folder-add-options"[^>]*role="menu"[^>]*aria-label="添加文件或文件夹"[^>]*hidden/);
  assert.match(html, /id="folder-add-file"[^>]*role="menuitem"[^>]*disabled>新建文件/);
  assert.match(html, /id="folder-add-folder"[^>]*role="menuitem"[^>]*disabled>新建文件夹/);
  assert.match(html, /class="folder-browser-footer"[\s\S]*id="directory-name-filter"[\s\S]*id="folder-add-menu"/);
  assert.match(styles, /\.folder-browser-footer #folder-add-toggle:focus-visible \{ outline: 2px solid var\(--accent\)/);
  assert.match(renderer, /function handleFolderAddMenuKeydown\(event\)[\s\S]*?ArrowDown[\s\S]*?ArrowUp/);
  assert.match(renderer, /event\.key === 'Escape'[\s\S]*?stopPropagation\(\)[\s\S]*?setFolderAddMenuOpen\(false, false, true\)/);
  assert.match(html, /id="directory-name-filter" type="search" aria-label="筛选当前文件夹中的文件和子文件夹名称" aria-controls="folder-navigation-items"/);
  assert.match(styles, /\.folder-name-filter input:focus \{ outline: 2px solid/);
  assert.match(html, /id="folder-search-form"[^>]*role="search"/);
  assert.match(html, /id="folder-preview"[^>]*aria-label="文件预览"[^>]*hidden/);
  assert.match(html, /id="folder-preview-open-plain"[^>]*>以纯文本打开/);
  assert.match(html, /id="folder-preview-open-new-window"[^>]*>在新窗口打开/);
  assert.match(html, /id="folder-preview-open-external"[^>]*aria-label="使用系统默认应用打开"[^>]*>外部编辑器/);
  assert.match(html, /id="folder-preview-external-menu-toggle"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*aria-controls="folder-preview-external-menu"[^>]*disabled/);
  assert.match(html, /id="folder-preview-external-menu"[^>]*role="menu"[^>]*aria-label="外部编辑器选项"[^>]*hidden/);
  assert.match(html, /id="folder-preview-open-default"[^>]*role="menuitem"[^>]*disabled>默认应用/);
  assert.match(html, /id="folder-preview-open-with"[^>]*role="menuitem"[^>]*disabled>其他应用…/);
  assert.match(styles, /\.folder-preview-external-control > button:focus-visible \{[^}]*outline: 2px solid var\(--accent\)/);
  assert.match(renderer, /function handleFolderPreviewExternalMenuKeydown\(event\)[\s\S]*?ArrowDown[\s\S]*?ArrowUp[\s\S]*?event\.key === 'Escape'/);
  assert.match(renderer, /function setFolderNavigationView\(open\)/);
  assert.match(renderer, /\$\('#sidebar-documents-view'\)\.toggleAttribute\('hidden', open\)/);
});

test('editor theme CSS resolves system colors against the active light or dark appearance', () => {
  assert.match(styles, /:root\s*\{\s*color-scheme:\s*light;/);
  assert.match(styles, /:root\[data-theme='dark'\]\s*\{\s*color-scheme:\s*dark;/);
  assert.match(styles, /--editor-theme-highlight-text/);
  assert.match(renderer, /resolveCotEditorThemeStyles\(customEditorTheme, supportsCssColor\)/);
});

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('secondary text colors meet 4.5:1 contrast on light and dark application surfaces', () => {
  const light = styles.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];
  const dark = styles.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(light && dark, 'light and dark theme tokens exist');
  const token = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  for (const [theme, block, surfaces] of [
    ['light', light, ['#ffffff', '#f7f8fa', '#f4f5f7']],
    ['dark', dark, ['#20232b', '#1b1d24', '#17191f']]
  ]) {
    for (const name of ['--muted', '--muted-2']) {
      const foreground = token(block, name);
      assert.ok(foreground, `${theme} ${name} is defined`);
      for (const background of surfaces) assert.ok(contrastRatio(foreground, background) >= 4.5, `${theme} ${name} on ${background}`);
    }
  }
});

test('reduced-motion preference disables transitions and animations', () => {
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none\s*!important/);
});

test('vertical text mode keeps line numbers in a reserved, readable column gap', () => {
  assert.match(styles, /\.editor-shell\.vertical-text\.vertical-line-numbers \.cm-line::before\s*\{[\s\S]*content:\s*attr\(data-line-number\)/);
  assert.match(styles, /\.editor-shell\.vertical-text \.cm-gutters\s*\{\s*display:\s*none\s*;?\s*\}/);
  assert.match(renderer, /vertical-line-numbers', settings\.showLineNumbers/);
  assert.match(renderer, /!settings\.showInvisibles && !settings\.showIndentGuides && !settings\.verticalText && !hangingIndentActive\) return Decoration\.none/);
  assert.match(renderer, /const hangingIndentActive = settings\.enablesHangingIndent && settings\.wrap && !settings\.verticalText/);
  assert.match(renderer, /verticalColumnDecoration\(line, columnStep, view\.lineBlockAt\(line\.from\)\.top\)/);
  assert.match(renderer, /const verticalColumnViewport = ViewPlugin\.fromClass/);
  assert.match(renderer, /update\.geometryChanged \|\| update\.selectionSet/);
  assert.match(renderer, /const verticalPointerSelection = EditorView\.domEventHandlers\(/);
  assert.match(renderer, /verticalTextPositionAtPoint\(view, event\.clientX, event\.clientY\)/);
  assert.match(renderer, /verticalPointerSelection,\s*pairedDoubleClickSelection,\s*search\(\)/);
  assert.match(renderer, /const verticalTextNavigation = Prec\.highest\(keymap\.of/);
  assert.match(renderer, /verticalTextAdjacentPosition\(view\.state\.doc, range\.head, direction\)/);
  assert.match(renderer, /verticalTextNavigation,\s*verticalTextScrollHandler,\s*verticalColumnViewport,\s*minimalSetup/);
});

test('settings popover can close on outside pointer input without claiming modal behavior', () => {
  assert.match(html, /id="settings-popover"[^>]*aria-modal="false"/);
  assert.match(renderer, /closest\('#settings-popover, #settings-toggle'\)[\s\S]*setSettingsPopover\(false\)/);
  assert.match(html, /<label class="setting-row"><span>纵排文本（适合中日韩文字）<\/span><input type="checkbox" id="vertical-text-setting"/);
  assert.match(renderer, /\$\('#vertical-text-setting'\)\.addEventListener\('change'/);
  assert.match(html, /<label class="setting-row"><span>新文稿默认书写方向<\/span><select id="writing-direction-setting"/);
  assert.match(renderer, /\$\('#writing-direction-setting'\)\.addEventListener\('change'/);
});

test('selected-text match delay is labelled, bounded and persisted through the settings handler', () => {
  assert.match(html, /<label class="setting-row"><span>高亮所选文字的其他匹配项<\/span><input type="checkbox" id="selected-text-matches-setting"/);
  assert.match(html, /id="selected-text-match-delay-setting" min="0" max="10" step="0\.25"[^>]*aria-label="所选文字匹配高亮延迟（秒）"/);
  assert.match(renderer, /\$\('#selected-text-match-delay-setting'\)\.addEventListener\('change'/);
  assert.match(renderer, /selectionInstanceHighlightDelay/);
  assert.match(renderer, /selectionInstanceHighlightExtension\(settings\.selectionInstanceHighlightDelay\)/);
});

test('search and tab overflow controls expose expanded state and keyboard navigation', () => {
  assert.match(html, /id="find-button"[^>]*aria-controls="search-panel"[^>]*aria-expanded="false"/);
  assert.match(html, /id="tab-overflow"[^>]*aria-controls="tab-overflow-menu"/);
  assert.match(renderer, /function showSearchPanel\(\) \{[\s\S]*?setAttribute\('aria-expanded', 'true'\)/);
  assert.match(renderer, /function closeSearchPanel\(\) \{[\s\S]*?setAttribute\('aria-expanded', 'false'\)/);
  assert.match(renderer, /searchPanelVisible\(\) && !document\.querySelector\('dialog\[open\]'\)\)\s*\{\s*event\.preventDefault\(\);\s*closeSearchPanel\(\);/);
  assert.match(renderer, /event\.key === 'Home' \? 0 : event\.key === 'End' \? items\.length - 1/);
  assert.match(renderer, /function setOverflowMenu\(open, focusActive = false\)[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?active\?\.focus\(\)/);
  assert.match(renderer, /if \(event\.key === 'Escape'\) \{[\s\S]*?setOverflowMenu\(false\);\s*requestAnimationFrame\(\(\) => \$\('#tab-overflow'\)\.focus\(\)\)/);
  assert.match(renderer, /requestAnimationFrame\(\(\) => \[\.\.\.\$\('#tabs'\)/);
});

test('Show Fonts offers an accessible cross-platform family chooser with clear fallback behavior', () => {
  assert.match(html, /id="font-picker-dialog"[^>]*aria-labelledby="font-picker-title"[^>]*aria-describedby="font-picker-description font-picker-status"/);
  assert.match(html, /id="font-family-input"[^>]*list="font-family-suggestions"[^>]*aria-describedby="font-picker-description font-picker-status"/);
  assert.match(html, /id="font-family-preview"[^>]*aria-label="字体预览"/);
  assert.match(html, /不可用字体会回退到“字体类型”设置/);
  assert.match(renderer, /function showFontPicker\(\)[\s\S]*?requestAnimationFrame\(\(\) => \$\('#font-family-input'\)\.focus\(\)\)/);
  assert.match(renderer, /font-picker-dialog'[\s\S]*?restoreDialogFocus\(\$\('#font-picker-dialog'\), target\)/);
});

test('whole-word search option has an accessible toggle and reaches the shared query builder', () => {
  assert.match(html, /id="match-whole-word"[^>]*aria-label="整词匹配"[^>]*aria-pressed="false"/);
  assert.match(renderer, /wholeWord: searchOptions\.wholeWord/);
  assert.match(renderer, /searchOptions\.wholeWord = !searchOptions\.wholeWord/);
});

test('document tabs label the active editor tabpanel and hide the relation without a document', () => {
  assert.match(html, /id="editor" class="editor" role="tabpanel"/);
  assert.match(renderer, /id="document-tab-\$\{escapeHtml\(doc\.id\)\}"[\s\S]*?role="tab"[\s\S]*?aria-controls="editor"/);
  assert.match(renderer, /editor\.setAttribute\('aria-labelledby', `document-tab-\$\{activeDoc\.id\}`\)/);
  assert.match(renderer, /editor\.removeAttribute\('aria-labelledby'\)/);
});

test('custom surround dialog exposes labelled delimiter inputs and a named action', () => {
  assert.match(html, /id="custom-surround-dialog"[^>]*aria-labelledby="custom-surround-title"/);
  assert.match(html, /for="custom-surround-begin"/);
  assert.match(html, /for="custom-surround-end"/);
  assert.match(html, /id="custom-surround-cancel"[^>]*>取消/);
  assert.match(renderer, /custom-surround-form'\)\.addEventListener\('submit'/);
});

test('encoding warning inspector exposes named controls, a live summary and safe list nodes', () => {
  assert.match(html, /id="warnings-toggle"[^>]*aria-label="编码警告检查器"/);
  assert.match(html, /id="warnings-panel"[^>]*aria-label="编码警告检查器"/);
  assert.match(html, /id="warnings-summary"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="warnings-refresh"[^>]*>重新检查/);
  assert.match(renderer, /location\.textContent = `\$\{item\.codePoint\}/);
});

test('browser shortcut filtering does not treat the CodeMirror editor as a form control', () => {
  assert.match(renderer, /closest\('input, textarea, select, \[contenteditable="true"\]:not\(\.cm-content\)'\)/);
});

test('document tablist contains tabs only and exposes a separate named close control', () => {
  assert.match(html, /<div id="tab-strip" class="tab-strip"><div id="tabs" class="tabs" role="tablist" aria-label="打开的文稿"><\/div><button id="tab-close" class="tab-close"[^>]*aria-label="关闭文稿"/);
  const tabMarkup = renderer.match(/function renderTabs\(\) \{([\s\S]*?)const editor =/);
  assert.ok(tabMarkup, 'renderTabs should render a stable tablist');
  assert.match(tabMarkup[1], /role="tab"/);
  assert.doesNotMatch(tabMarkup[1], /tab-close|data-close/);
  assert.match(renderer, /function syncTabCloseButton\(/);
  assert.match(renderer, /closeButton\.setAttribute\('aria-label', `关闭 \$\{doc\.name\}`\)/);
  assert.match(renderer, /\$\('#tab-close'\)\.addEventListener\('click'/);
  assert.match(renderer, /\$\('#tabs'\)\.addEventListener\('pointerover'/);
});
