import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js';
import { parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('matching-brace highlighting defaults on and accepts only explicit booleans', () => {
  assert.equal(DEFAULT_SETTINGS.highlightBraces, true);
  assert.equal(normalizeSettings({}).highlightBraces, true);
  assert.equal(normalizeSettings({ highlightBraces: false }).highlightBraces, false);
  assert.equal(normalizeSettings({ highlightBraces: 'off' }).highlightBraces, true);
});

test('settings import and export preserve the matching-brace highlighting choice', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ highlightBraces: true })).highlightBraces, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ highlightBraces: false })).highlightBraces, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ highlightBraces: 'no' })).highlightBraces, true);
});

test('settings expose an accessible default-on control separate from closing-symbol insertion', () => {
  assert.match(html, /id="highlight-braces-setting" aria-label="高亮匹配括号" checked/);
  assert.match(html, /不影响自动插入闭括号与引号/);
});

test('matching-brace highlighter is conditionally installed through its own compartment', () => {
  assert.match(renderer, /function matchingBracesExtension\(\)\s*\{\s*return settings\.highlightBraces \? bracketMatching\(\) : \[\];\s*\}/);
  assert.match(renderer, /bracketMatchingCompartment\.of\(matchingBracesExtension\(\)\)/);
  assert.doesNotMatch(renderer, /^\s*bracketMatching\(\),\s*$/m);
});

test('toggle persists and reconfigures the active editor views and restores the preference on document switch', () => {
  assert.match(renderer, /highlight-braces-setting'\)\.addEventListener\('change', event => \{ settings\.highlightBraces = event\.target\.checked; persistSettings\(\); applySettings\(\); \}\)/);
  assert.match(renderer, /function applySettings\(\)[\s\S]*?bracketMatchingCompartment\.reconfigure\(matchingBracesExtension\(\)\)/);
  assert.match(renderer, /function switchDocument\(doc\)[\s\S]*?bracketMatchingCompartment\.reconfigure\(matchingBracesExtension\(\)\)/);
});
