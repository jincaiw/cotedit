import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { automaticSymbolBalancingEnabledForLanguage, normalizeSettings, setAutomaticSymbolBalancingOverride } from '../lib/settings.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('Mode defaults keep pair insertion off for plain text and on for code unless overridden', () => {
  const settings = normalizeSettings({});
  const defaultFor = language => language !== 'plaintext';
  assert.equal(automaticSymbolBalancingEnabledForLanguage(settings, 'plaintext', defaultFor('plaintext')), false);
  assert.equal(automaticSymbolBalancingEnabledForLanguage(settings, 'javascript', defaultFor('javascript')), true);
  const syntaxOff = setAutomaticSymbolBalancingOverride(settings.automaticSymbolBalancingByLanguage, 'javascript', false);
  assert.equal(automaticSymbolBalancingEnabledForLanguage({ ...settings, automaticSymbolBalancingByLanguage: syntaxOff }, 'javascript', true), false);
  const plainOn = setAutomaticSymbolBalancingOverride(syntaxOff, 'plaintext', true);
  assert.equal(automaticSymbolBalancingEnabledForLanguage({ ...settings, automaticSymbolBalancingByLanguage: plainOn }, 'plaintext', false), true);
});

test('settings expose an accessible current-syntax tri-state selector with CotEditor Mode defaults', () => {
  assert.match(html, /id="symbol-balancing-language-setting" aria-label="当前语法自动插入匹配括号与引号"/);
  assert.match(html, /option value="mode-default">跟随模式默认/);
  assert.match(html, /代码语法开启、纯文本关闭/);
  assert.match(renderer, /function syncSymbolBalancingControls\(\)[\s\S]*?control\.value = language && Object\.prototype\.hasOwnProperty\.call\(overrides, language\)/);
  assert.match(renderer, /symbol-balancing-language-setting'\)\.addEventListener\('change'/);
  assert.match(renderer, /setAutomaticSymbolBalancingOverride\(settings\.automaticSymbolBalancingByLanguage, language, value\)/);
});

test('CodeMirror close-bracket behavior is isolated per active syntax and updates on changes', () => {
  assert.match(renderer, /function symbolBalancingExtension\(doc = activeDoc\)[\s\S]*?automaticSymbolBalancingEnabledForLanguage\(settings, doc\?\.language, symbolBalancingModeDefault\(doc\?\.language\)\)[\s\S]*?closeBrackets\(\)/);
  assert.match(renderer, /symbolBalancingCompartment\.of\(symbolBalancingExtension\(doc\)\)/);
  assert.match(renderer, /symbolBalancingCompartment\.reconfigure\(symbolBalancingExtension\(activeDoc\)\)/);
  assert.match(renderer, /function switchDocument\(doc\)[\s\S]*?symbolBalancingCompartment\.reconfigure/);
  assert.match(renderer, /function changeLanguage\(id\)[\s\S]*?symbolBalancingCompartment\.reconfigure/);
});
