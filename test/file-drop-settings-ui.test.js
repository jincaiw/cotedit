import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');

test('File Drop settings are discoverable from the editor settings and expose ordered accessible controls', () => {
  for (const id of ['file-drop-settings-open', 'file-drop-settings-dialog', 'file-drop-rule-list', 'file-drop-rule-new', 'file-drop-rule-up', 'file-drop-rule-down', 'file-drop-rule-scope', 'file-drop-rule-extensions', 'file-drop-rule-description', 'file-drop-rule-format', 'file-drop-rule-reset', 'file-drop-rule-save']) {
    assert.ok(html.includes(`id="${id}"`), `missing File Drop UI control ${id}`);
  }
  assert.match(html, /file-drop-settings-dialog[^>]*aria-labelledby="file-drop-settings-title"/);
  assert.match(html, /role="listbox" aria-label="文件拖放规则"/);
  assert.match(renderer, /function showFileDropRuleManager[\s\S]*?dialog\.showModal\(\)/);
  assert.match(renderer, /function moveFileDropRule\(direction\)[\s\S]*?fileDropDraftRules\[index\], fileDropDraftRules\[nextIndex\]/);
  assert.match(renderer, /function saveFileDropRules\(\)[\s\S]*?settings\.fileDropRules = normalized[\s\S]*?persistSettings\(\)/);
  assert.match(renderer, /confirmDiscardFileDropDraft/);
});

test('File Drop formatting receives settings only, and the main process revalidates bounded rules', () => {
  assert.match(renderer, /formatDroppedFilePaths\(payload\?\.paths, targetDocument\.path, targetDocument\.language, settings\.fileDropRules\)/);
  assert.match(renderer, /'DIRECTORY', 'FILECONTENT', 'IMAGEWIDTH', 'IMAGEHEIGHT'/, 'the variable picker exposes content and image dimensions');
  assert.match(preload, /formatDroppedFilePaths: \(paths, documentPath, syntaxId, rules\) => ipcRenderer\.invoke\('file-drop:format', paths, documentPath, syntaxId, rules\)/);
  assert.match(main, /file-drop:format', \(_event, paths, documentPath, syntaxId, rules\) => formatDroppedFilePaths\(paths, documentPath, syntaxId, process\.platform, rules\)/);
  assert.match(html, /FILECONTENT/);
  assert.match(html, /正文限普通 UTF-8 文本，每个文件及每次拖放最多 64 KiB/);
  assert.match(html, /支持 PNG、GIF、JPEG、BMP、WebP，不解码图片/);
  assert.match(html, /最多 1 MiB\/文件、4 MiB\/次/);
  assert.match(html, /macOS \.textClipping 尚不支持/);
});
