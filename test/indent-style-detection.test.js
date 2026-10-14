import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectIndentStyle, effectiveAutoExpandTab, resolveTabInsertionMode } from '../lib/indent-style-detection.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../lib/settings.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('indent-style detection recognizes repeated space indentation and ignores blank or unindented lines', () => {
  assert.equal(detectIndentStyle('root\n  child\n\n    grandchild\nlast'), 'spaces');
  assert.equal(detectIndentStyle('root\r\n\tchild\r\n\t\tgrandchild\r\nlast'), 'tabs');
});

test('indent-style detection requires enough consistent indented lines and declines mixed evidence', () => {
  assert.equal(detectIndentStyle('  one'), null);
  assert.equal(detectIndentStyle('  one\n\ttwo'), null);
  assert.equal(detectIndentStyle('  one\n\t  mixed\n    three'), 'spaces');
  assert.equal(detectIndentStyle('\t  mixed\nplain'), null);
  assert.equal(detectIndentStyle('   \n\t\t\nplain'), null);
});

test('indent-style detection respects bounded code-unit and line samples', () => {
  assert.equal(detectIndentStyle('plain\n  later\n    later', { maxLines: 2 }), null);
  assert.equal(detectIndentStyle('plain\n  later\n    later', { maxCodeUnits: 8 }), null);
  const oversized = `${'plain\n'.repeat(10_001)}  late\n    late`;
  assert.equal(detectIndentStyle(oversized), null);
});

test('detected styles override ordinary Tab insertion while inconclusive documents retain existing preferences', () => {
  assert.equal(resolveTabInsertionMode('spaces', false, 'tab'), 'soft-tabs');
  assert.equal(resolveTabInsertionMode('tabs', true, '4'), 'tab');
  assert.equal(resolveTabInsertionMode(null, true, 'tab'), 'soft-tabs');
  assert.equal(resolveTabInsertionMode(null, false, 'tab'), 'tab');
  assert.equal(resolveTabInsertionMode(null, false, '4'), 'syntax');
  assert.equal(resolveTabInsertionMode('spaces', false, 'tab', false), 'tab', 'an explicit Mode choice wins over detected document style');
  assert.equal(resolveTabInsertionMode('tabs', false, '4', true), 'soft-tabs');
  assert.equal(resolveTabInsertionMode(null, false, 'tab', true), 'soft-tabs');
  assert.equal(resolveTabInsertionMode(null, true, '4', false), 'tab');
  assert.equal(effectiveAutoExpandTab('spaces', false), true);
  assert.equal(effectiveAutoExpandTab('tabs', true), false);
  assert.equal(effectiveAutoExpandTab(null, true), true);
});

test('CotEditor default preference and open-document Tab routing are wired without a new shortcut', () => {
  assert.match(settings, /detectsIndentStyle: true/);
  assert.match(settings, /detectsIndentStyle: typeof value\.detectsIndentStyle === 'boolean' \? value\.detectsIndentStyle : DEFAULT_SETTINGS\.detectsIndentStyle/);
  assert.match(settings, /autoExpandTab: false/);
  assert.match(settings, /autoExpandTabByLanguage: Object\.freeze\(\{\}\)/);
  assert.match(settings, /normalizeLanguageBooleanOverrides\(value\.autoExpandTabByLanguage\)/);
  assert.match(html, /id="detect-indent-style-setting"/);
  assert.match(html, /id="auto-expand-tab-setting"/);
  assert.match(html, /id="tab-expansion-language-setting"/);
  assert.match(renderer, /saved && settings\.detectsIndentStyle \? detectIndentStyle\(originalText\) : null/);
  assert.match(renderer, /resolveTabInsertionMode\(doc\?\.detectedIndentStyle, settings\.autoExpandTab, indentationFor\(doc\), autoExpandTabOverrideForLanguage\(settings, doc\?\.language\)\)/);
  assert.match(renderer, /effectiveAutoExpandTab\(doc\?\.detectedIndentStyle, settings\.autoExpandTab\)/);
  assert.match(renderer, /'menu:auto-expand-tab': \(\) => \{[\s\S]*settings\.autoExpandTabByLanguage = setAutoExpandTabOverride[\s\S]*else settings\.autoExpandTab = !current/);
  assert.match(renderer, /detect-indent-style-setting'[\s\S]*settings\.detectsIndentStyle = event\.target\.checked/);
});
