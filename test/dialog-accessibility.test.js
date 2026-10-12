import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('Help dialog and document inspector panel have accessible names, descriptions and close controls', () => {
  assert.match(html, /<dialog id="help-dialog"[^>]*aria-labelledby="help-title"[^>]*aria-describedby="help-description"/);
  assert.match(html, /id="help-close"[^>]*aria-label="关闭使用说明"/);
  assert.match(html, /id="help-open-shortcuts"/);
  assert.match(html, /<aside id="document-inspector-panel"[^>]*aria-labelledby="document-inspector-title"[^>]*aria-describedby="document-inspector-description"/);
  assert.match(html, /id="document-inspector-close"[^>]*data-close-panel="document-inspector-panel"[^>]*aria-label="关闭文稿检查器"/);
  assert.doesNotMatch(html, /<dialog id="document-inspector-/,
    'the inspector remains modeless so the editor stays usable while it is open');
  for (const heading of ['文件', '文本设置', '计数', '字符']) {
    assert.match(html, new RegExp(`<details class="document-inspector-section" open>[\\s\\S]*?<summary>${heading}</summary>`));
  }
  for (const id of ['name', 'path', 'encoding', 'lineEnding', 'syntax', 'lineCount', 'wordCount', 'characterCount', 'length', 'cursorPosition', 'selectionCharacters', 'saveState', 'character-state', 'character-code-points', 'character-name', 'character-block', 'character-category']) {
    assert.match(html, new RegExp(`id="document-inspector-${id}"`));
  }
  assert.match(html, /id="document-inspector-character-state"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /字符数（字素簇）/);
});

test('Help dialog and document inspector panel restore editor access and refresh current document details', () => {
  assert.match(renderer, /function showHelp\(\)/);
  assert.match(renderer, /function toggleDocumentInspector\(\)/);
  assert.match(renderer, /help-dialog'\)\.addEventListener\('close'/);
  assert.match(renderer, /document-inspector-close'\)\.addEventListener\('click', \(\) => closePanel\('document-inspector-panel', true\)\)/);
  assert.match(renderer, /function toggleDocumentInspector\(\)[\s\S]*?panel\.classList\.remove\('hidden'\)/);
  assert.match(renderer, /restoreFocus && id === 'document-inspector-panel'[\s\S]*?activeEditor\(\)\?\.focus\(\)/);
  assert.match(renderer, /'document-inspector-panel': null/);
  assert.match(renderer, /shortcutsReturnFocus = target/);
  assert.match(renderer, /if \(\$\('#document-inspector-panel'\) && !\$\('#document-inspector-panel'\)\.classList\.contains\('hidden'\)\) refreshDocumentInspector\(\)/);
  assert.match(styles, /\.document-inspector-panel \{[^}]*flex: 0 0 clamp\(/);
  assert.match(styles, /\.document-inspector-section > summary:focus-visible/);
});
