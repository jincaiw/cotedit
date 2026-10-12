import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('settings expose a labelled current-syntax automatic completion override with inheritance', () => {
  assert.match(html, /全局默认：输入时显示补全建议/);
  assert.match(html, /<label class="setting-row" title="仅覆盖活动文稿的语法；选择“跟随全局默认”会移除此语法的单独设置。"><span>当前语法自动补全<\/span><select id="suggest-completions-language-setting" aria-label="当前语法自动补全策略"><option value="global">跟随全局默认<\/option><option value="on">开启<\/option><option value="off">关闭<\/option><\/select><\/label>/);
  assert.match(renderer, /function syncAutoCompletionControls\(\)[\s\S]*?control\.value = language && Object\.prototype\.hasOwnProperty\.call\(overrides, language\)/);
  assert.match(renderer, /suggest-completions-language-setting'\)\.addEventListener\('change'/);
  assert.match(renderer, /setAutoCompletionOverride\(settings\.suggestCompletionsByLanguage, language, value\)/);
});

test('automatic completion uses the active document syntax when states are created and switched', () => {
  assert.match(renderer, /function completionExtension\(doc = activeDoc\)[\s\S]*?autoCompletionEnabledForLanguage\(settings, doc\?\.language\)/);
  assert.match(renderer, /override\s*\}\);/);
  assert.match(renderer, /if \(wordTypes\.syntax\) override\.push\(syntaxWordCompletionSource\)/);
  assert.match(renderer, /if \(wordTypes\.document\) override\.push\(context => documentWordCompletionSource/);
  assert.match(renderer, /completionCompartment\.of\(completionExtension\(doc\)\)/);
  assert.match(renderer, /function switchDocument\(doc\)[\s\S]*?completionCompartment\.reconfigure\(completionExtension\(activeDoc\)\)/);
  assert.match(renderer, /function changeLanguage\(id\)[\s\S]*?completionCompartment\.reconfigure\(completionExtension\(activeDoc\)\)/);
  assert.match(renderer, /completionCompartment\.reconfigure\(completionExtension\(activeDoc\)\)/);
});

test('completion word sources are labelled per syntax, resettable, and never fake a system dictionary', () => {
  assert.match(html, /id="completion-document-setting" aria-label="包含文稿中的词"/);
  assert.match(html, /id="completion-syntax-setting" aria-label="包含语法定义的词"/);
  assert.match(html, /id="completion-standard-setting" aria-label="包含标准词" disabled/);
  assert.match(html, /id="completion-sources-reset"[^>]*>恢复当前语法默认来源/);
  assert.match(renderer, /setCompletionWordTypesOverride\(settings\.completionWordTypesByLanguage, language, current\)/);
  assert.match(renderer, /setCompletionWordTypesOverride\(settings\.completionWordTypesByLanguage, language, null\)/);
  assert.match(html, /标准词由 macOS 系统词典提供，跨平台版本暂不提供/);
});

test('per-syntax suggestion preference adds no command or shortcut and keeps explicit completion', () => {
  assert.match(renderer, /'menu:complete': \(\) => startCompletion\(activeEditor\(\)\)/);
  assert.match(html, /Alt\+Escape 手动补全/);
});
