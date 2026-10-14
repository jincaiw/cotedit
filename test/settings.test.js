import test from 'node:test';
import assert from 'node:assert/strict';
import { autoCompletionEnabledForLanguage, automaticSymbolBalancingEnabledForLanguage, clearIndentOverride, completionWordTypesForLanguage, DEFAULT_SETTINGS, fontTypeForLanguage, normalizeKeyBindings, normalizeSettings, parseStoredSettings, setAutoCompletionOverride, setAutomaticSymbolBalancingOverride, setCompletionWordTypesOverride, setFontTypeOverride } from '../lib/settings.js';

test('settings default safely for malformed storage values', () => {
  assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings([]), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings({ theme: 'auto', indent: 3, wrap: 'yes', fontSize: 'huge' }), { ...DEFAULT_SETTINGS });
});

test('per-syntax automatic period substitution defaults off and accepts only valid boolean overrides', () => {
  assert.deepEqual(DEFAULT_SETTINGS.automaticPeriodSubstitutionByLanguage, {});
  assert.deepEqual(normalizeSettings({ automaticPeriodSubstitutionByLanguage: { plaintext: true, javascript: false, 'bad key': true, markdown: 'yes' } }).automaticPeriodSubstitutionByLanguage, { plaintext: true, javascript: false });
});

test('default window dimensions may be blank while explicit dimensions remain bounded and portable', () => {
  assert.equal(DEFAULT_SETTINGS.windowWidth, null);
  assert.equal(DEFAULT_SETTINGS.windowHeight, null);
  assert.equal(normalizeSettings({}).windowWidth, null);
  assert.deepEqual(normalizeSettings({ windowWidth: 1360, windowHeight: null }), { ...DEFAULT_SETTINGS, windowWidth: 1360 });
  assert.deepEqual(normalizeSettings({ windowWidth: 500, windowHeight: 5001 }), { ...DEFAULT_SETTINGS, windowWidth: 860, windowHeight: 4000 });
  assert.equal(normalizeSettings({ windowWidth: '1360' }).windowWidth, null);
});

test('navigation bar visibility defaults on and accepts only an explicit boolean', () => {
  assert.equal(DEFAULT_SETTINGS.showNavigationBar, true);
  assert.equal(normalizeSettings({}).showNavigationBar, true);
  assert.equal(normalizeSettings({ showNavigationBar: false }).showNavigationBar, false);
  assert.equal(normalizeSettings({ showNavigationBar: true }).showNavigationBar, true);
  assert.equal(normalizeSettings({ showNavigationBar: 'off' }).showNavigationBar, true);
});

test('syntax-specific automatic completion inherits the global default and can be overridden or reset', () => {
  assert.deepEqual(DEFAULT_SETTINGS.suggestCompletionsByLanguage, {});
  const globalOff = normalizeSettings({ suggestCompletionsWhileTyping: false });
  assert.equal(autoCompletionEnabledForLanguage(globalOff, 'javascript'), false);
  const withJavascriptOn = {
    ...globalOff,
    suggestCompletionsByLanguage: setAutoCompletionOverride(globalOff.suggestCompletionsByLanguage, 'javascript', true)
  };
  assert.equal(autoCompletionEnabledForLanguage(withJavascriptOn, 'javascript'), true);
  assert.equal(autoCompletionEnabledForLanguage(withJavascriptOn, 'python'), false);
  const withJavascriptOff = {
    ...normalizeSettings({ suggestCompletionsWhileTyping: true }),
    suggestCompletionsByLanguage: { javascript: false }
  };
  assert.equal(autoCompletionEnabledForLanguage(withJavascriptOff, 'javascript'), false);
  assert.equal(autoCompletionEnabledForLanguage(withJavascriptOff, 'python'), true);
  const reset = setAutoCompletionOverride(withJavascriptOn.suggestCompletionsByLanguage, 'javascript', null);
  assert.deepEqual(reset, {});
  assert.equal(autoCompletionEnabledForLanguage({ ...withJavascriptOn, suggestCompletionsByLanguage: reset }, 'javascript'), false);
});

test('syntax-specific automatic completion overrides keep only bounded valid boolean entries', () => {
  const invalid = normalizeSettings({ suggestCompletionsByLanguage: { 'bad key': true, javascript: 'yes', Python: false } });
  assert.deepEqual(invalid.suggestCompletionsByLanguage, { Python: false });
  const many = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`syntax-${index}`, index % 2 === 0]));
  const bounded = normalizeSettings({ suggestCompletionsByLanguage: many }).suggestCompletionsByLanguage;
  assert.equal(Object.keys(bounded).length, 200);
  assert.equal(Object.hasOwn(bounded, 'syntax-0'), false);
  assert.equal(Object.hasOwn(bounded, 'syntax-204'), true);
  assert.equal(setAutoCompletionOverride({}, '../bad', true).javascript, undefined);
});

test('automatic symbol balancing inherits Mode defaults and supports per-syntax overrides or reset', () => {
  assert.deepEqual(DEFAULT_SETTINGS.automaticSymbolBalancingByLanguage, {});
  const defaults = normalizeSettings({});
  assert.equal(automaticSymbolBalancingEnabledForLanguage(defaults, 'plaintext', false), false);
  assert.equal(automaticSymbolBalancingEnabledForLanguage(defaults, 'javascript', true), true);
  const overrides = setAutomaticSymbolBalancingOverride({}, 'plaintext', true);
  assert.equal(automaticSymbolBalancingEnabledForLanguage({ ...defaults, automaticSymbolBalancingByLanguage: overrides }, 'plaintext', false), true);
  const codeOff = setAutomaticSymbolBalancingOverride(overrides, 'javascript', false);
  assert.equal(automaticSymbolBalancingEnabledForLanguage({ ...defaults, automaticSymbolBalancingByLanguage: codeOff }, 'javascript', true), false);
  assert.deepEqual(setAutomaticSymbolBalancingOverride(codeOff, 'javascript', null), { plaintext: true });
});

test('automatic symbol balancing overrides accept only bounded syntax ids and boolean values', () => {
  assert.deepEqual(normalizeSettings({ automaticSymbolBalancingByLanguage: { 'bad key': true, javascript: 'yes', Python: false } }).automaticSymbolBalancingByLanguage, { Python: false });
  const many = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`syntax-${index}`, index % 2 === 0]));
  const bounded = normalizeSettings({ automaticSymbolBalancingByLanguage: many }).automaticSymbolBalancingByLanguage;
  assert.equal(Object.keys(bounded).length, 200);
  assert.equal(Object.hasOwn(bounded, 'syntax-0'), false);
  assert.equal(Object.hasOwn(bounded, 'syntax-204'), true);
  assert.equal(setAutomaticSymbolBalancingOverride({}, '../bad', true).javascript, undefined);
});

test('substitution Mode overrides validate per-syntax smart quotes, dashes and text replacement flags', () => {
  const settings = normalizeSettings({
    smartQuotesByLanguage: { plaintext: true, javascript: false, invalid: 'on' },
    smartDashesByLanguage: { markdown: true, 'bad key': true },
    automaticTextReplacementByLanguage: { plaintext: false, markdown: true }
  });
  assert.deepEqual(settings.smartQuotesByLanguage, { plaintext: true, javascript: false });
  assert.deepEqual(settings.smartDashesByLanguage, { markdown: true });
  assert.deepEqual(settings.automaticTextReplacementByLanguage, { plaintext: false, markdown: true });
});

test('editor font family defaults to automatic fallback and accepts only safe bounded family names', () => {
  assert.equal(DEFAULT_SETTINGS.fontFamily, '');
  assert.equal(normalizeSettings({}).fontFamily, '');
  assert.equal(normalizeSettings({ fontFamily: 'Noto Sans SC' }).fontFamily, 'Noto Sans SC');
  assert.equal(normalizeSettings({ fontFamily: '思源黑体' }).fontFamily, '思源黑体');
  assert.equal(normalizeSettings({ fontFamily: 'Arial; color:red' }).fontFamily, '');
  assert.equal(normalizeSettings({ fontFamily: 'A'.repeat(81) }).fontFamily, '');
});

test('per-syntax completion word source overrides validate document and syntax flags', () => {
  assert.deepEqual(DEFAULT_SETTINGS.completionWordTypesByLanguage, {});
  const overrides = setCompletionWordTypesOverride({}, 'javascript', { document: false, syntax: true });
  assert.deepEqual(completionWordTypesForLanguage({ completionWordTypesByLanguage: overrides }, 'javascript'), {
    standard: false, document: false, syntax: true
  });
  assert.deepEqual(normalizeSettings({ completionWordTypesByLanguage: {
    javascript: { document: false, syntax: true, standard: true },
    'bad key': { document: true },
    python: { document: 'yes' }
  } }).completionWordTypesByLanguage, { javascript: { document: false, syntax: true } });
  assert.deepEqual(setCompletionWordTypesOverride(overrides, 'javascript', null), {});
});

test('Tab display width is independent, bounded and defaults to four-column tab indentation', () => {
  assert.equal(DEFAULT_SETTINGS.indent, 'tab');
  assert.equal(DEFAULT_SETTINGS.tabWidth, 4);
  assert.equal(normalizeSettings({}).tabWidth, 4);
  assert.equal(normalizeSettings({ tabWidth: 1 }).tabWidth, 1);
  assert.equal(normalizeSettings({ tabWidth: 100 }).tabWidth, 99);
  assert.equal(normalizeSettings({ tabWidth: 2.6 }).tabWidth, 3);
  assert.equal(normalizeSettings({ tabWidth: -5 }).tabWidth, 1);
  assert.equal(normalizeSettings({ tabWidth: '8' }).tabWidth, 4);
  assert.equal(normalizeSettings({ indent: '5' }).indent, '5');
  assert.equal(normalizeSettings({ indent: '100' }).indent, 'tab');
});

test('Use Spaces for Indentation defaults off and accepts only an explicit boolean', () => {
  assert.equal(DEFAULT_SETTINGS.autoExpandTab, false);
  assert.equal(normalizeSettings({}).autoExpandTab, false);
  assert.equal(normalizeSettings({ autoExpandTab: true }).autoExpandTab, true);
  assert.equal(normalizeSettings({ autoExpandTab: false }).autoExpandTab, false);
  assert.equal(normalizeSettings({ autoExpandTab: 'yes' }).autoExpandTab, false);
});

test('automatic indentation defaults on and accepts only an explicit boolean', () => {
  assert.equal(DEFAULT_SETTINGS.autoIndent, true);
  assert.equal(normalizeSettings({}).autoIndent, true);
  assert.equal(normalizeSettings({ autoIndent: true }).autoIndent, true);
  assert.equal(normalizeSettings({ autoIndent: false }).autoIndent, false);
  assert.equal(normalizeSettings({ autoIndent: 'no' }).autoIndent, true);
});

test('automatic completion suggestions default off and accept only an explicit boolean', () => {
  assert.equal(DEFAULT_SETTINGS.suggestCompletionsWhileTyping, false);
  assert.equal(normalizeSettings({}).suggestCompletionsWhileTyping, false);
  assert.equal(normalizeSettings({ suggestCompletionsWhileTyping: true }).suggestCompletionsWhileTyping, true);
  assert.equal(normalizeSettings({ suggestCompletionsWhileTyping: false }).suggestCompletionsWhileTyping, false);
  assert.equal(normalizeSettings({ suggestCompletionsWhileTyping: 'yes' }).suggestCompletionsWhileTyping, false);
});

test('detecting indentation style when opening documents defaults on and accepts only an explicit boolean', () => {
  assert.equal(DEFAULT_SETTINGS.detectsIndentStyle, true);
  assert.equal(normalizeSettings({}).detectsIndentStyle, true);
  assert.equal(normalizeSettings({ detectsIndentStyle: true }).detectsIndentStyle, true);
  assert.equal(normalizeSettings({ detectsIndentStyle: false }).detectsIndentStyle, false);
  assert.equal(normalizeSettings({ detectsIndentStyle: 'no' }).detectsIndentStyle, true);
});

test('Indent selection with Tab defaults off and accepts only an explicit boolean', () => {
  assert.equal(DEFAULT_SETTINGS.indentWithTabKey, false);
  assert.equal(normalizeSettings({}).indentWithTabKey, false);
  assert.equal(normalizeSettings({ indentWithTabKey: true }).indentWithTabKey, true);
  assert.equal(normalizeSettings({ indentWithTabKey: false }).indentWithTabKey, false);
  assert.equal(normalizeSettings({ indentWithTabKey: 'yes' }).indentWithTabKey, false);
});

test('comment delimiters append a spacer by default and accept only explicit booleans', () => {
  assert.equal(DEFAULT_SETTINGS.appendsCommentSpacer, true);
  assert.equal(normalizeSettings({}).appendsCommentSpacer, true);
  assert.equal(normalizeSettings({ appendsCommentSpacer: true }).appendsCommentSpacer, true);
  assert.equal(normalizeSettings({ appendsCommentSpacer: false }).appendsCommentSpacer, false);
  assert.equal(normalizeSettings({ appendsCommentSpacer: 'yes' }).appendsCommentSpacer, true);
});

test('font ligature preference defaults to the current rendering and accepts only booleans', () => {
  assert.equal(DEFAULT_SETTINGS.ligatures, true);
  assert.equal(normalizeSettings({}).ligatures, true);
  assert.equal(normalizeSettings({ ligatures: false }).ligatures, false);
  assert.equal(normalizeSettings({ ligatures: 'off' }).ligatures, true);
});

test('editor font type defaults to the existing monospaced rendering and only accepts supported modes', () => {
  assert.equal(DEFAULT_SETTINGS.fontType, 'monospaced');
  assert.equal(normalizeSettings({}).fontType, 'monospaced');
  assert.equal(normalizeSettings({ fontType: 'standard' }).fontType, 'standard');
  assert.equal(normalizeSettings({ fontType: 'monospaced' }).fontType, 'monospaced');
  assert.equal(normalizeSettings({ fontType: 'serif' }).fontType, 'monospaced');
});

test('font type defaults by Mode, preserves legacy global choices, and supports per-syntax overrides', () => {
  assert.equal(fontTypeForLanguage(normalizeSettings({}), 'plaintext', 'standard'), 'standard');
  assert.equal(fontTypeForLanguage(normalizeSettings({}), 'javascript', 'monospaced'), 'monospaced');
  assert.deepEqual(normalizeSettings({ fontType: 'standard' }).fontTypeByLanguage, { '*': 'standard' });
  const overrides = setFontTypeOverride({}, 'javascript', 'standard');
  assert.deepEqual(overrides, { javascript: 'standard' });
  assert.equal(fontTypeForLanguage({ fontTypeByLanguage: overrides }, 'javascript', 'monospaced'), 'standard');
  assert.equal(fontTypeForLanguage({ fontTypeByLanguage: overrides }, 'python', 'monospaced'), 'monospaced');
  assert.deepEqual(setFontTypeOverride(overrides, 'javascript', 'mode-default'), {});
  assert.deepEqual(normalizeSettings({ fontTypeByLanguage: { javascript: 'standard', python: 'serif', '*': 'monospaced', bad: 'mode-default' } }).fontTypeByLanguage, { javascript: 'standard', '*': 'monospaced', bad: 'mode-default' });
});

test('diacritic-insensitive find preference defaults off and accepts only booleans', () => {
  assert.equal(DEFAULT_SETTINGS.findIgnoresDiacritics, false);
  assert.equal(normalizeSettings({}).findIgnoresDiacritics, false);
  assert.equal(normalizeSettings({ findIgnoresDiacritics: true }).findIgnoresDiacritics, true);
  assert.equal(normalizeSettings({ findIgnoresDiacritics: false }).findIgnoresDiacritics, false);
  assert.equal(normalizeSettings({ findIgnoresDiacritics: 'yes' }).findIgnoresDiacritics, false);
});

test('snippet settings default empty and keep normalized command snippets', () => {
  const snippets = [{ id: 'sample-1', name: 'Example', scope: 'javascript', format: 'const x = <<<SELECTION>>>;' }];
  assert.deepEqual(DEFAULT_SETTINGS.snippets, []);
  assert.deepEqual(normalizeSettings({ snippets: [...snippets, { id: 'bad', name: 'Broken' }] }).snippets, snippets);
  assert.deepEqual(normalizeSettings({ snippets: 'invalid' }).snippets, []);
});

test('text replacement settings default empty and preserve bounded local literal rules', () => {
  const textReplacements = [
    { id: 'omw', trigger: 'omw', replacement: 'on my way', enabled: true },
    { id: 'brb', trigger: 'brb', replacement: 'be right back', enabled: false }
  ];
  assert.deepEqual(DEFAULT_SETTINGS.textReplacements, []);
  assert.deepEqual(normalizeSettings({ textReplacements }), { ...DEFAULT_SETTINGS, textReplacements });
  assert.deepEqual(normalizeSettings({ textReplacements: [{ ...textReplacements[0], trigger: '' }] }).textReplacements, []);
  assert.equal(normalizeSettings({ textReplacements: 'invalid' }).textReplacements.length, 0);
});

test('File Drop settings use CotEditor-style ordered rules and normalize bounded custom definitions', () => {
  assert.equal(DEFAULT_SETTINGS.fileDropRules.length, 6);
  assert.deepEqual(DEFAULT_SETTINGS.fileDropRules[0].extensions, ['jpg', 'jpeg', 'gif', 'png']);
  const normalized = normalizeSettings({ fileDropRules: [
    { id: 'custom-image', scope: 'HTML', extensions: 'JPG, jpg, png', description: '尺寸模板', formatString: '<img src="<<<RELATIVE-PATH>>>" />' },
    { id: '../invalid', scope: '', extensions: [], format: 'unsafe id' }
  ] }).fileDropRules;
  assert.deepEqual(normalized, [{ id: 'custom-image', scope: 'html', extensions: ['JPG', 'png'], description: '尺寸模板', format: '<img src="<<<RELATIVE-PATH>>>" />' }]);
  assert.equal(normalizeSettings({ fileDropRules: [] }).fileDropRules.length, 0);
  assert.equal(normalizeSettings({ fileDropRules: [{ id: 'too-large', format: 'x'.repeat(9 * 1024) }] }).fileDropRules.length, 0);
});

test('multiple replace definitions default empty and normalize bounded steps and scope preference', () => {
  const definitions = [{ id: 'rename-vars', name: '重命名变量', textualAnchored: true, replacements: [
    { id: 'one', findString: 'old', replacementString: 'new', usesRegularExpression: true, ignoresCase: true }
  ] }];
  assert.deepEqual(DEFAULT_SETTINGS.multipleReplaceDefinitions, []);
  assert.equal(DEFAULT_SETTINGS.multipleReplaceInSelection, false);
  assert.deepEqual(normalizeSettings({ multipleReplaceDefinitions: [{ ...definitions[0], regexAllowCommentsAndWhitespace: true }], multipleReplaceInSelection: true }).multipleReplaceDefinitions, [{
    ...definitions[0], regexAllowCommentsAndWhitespace: true, replacements: [{ ...definitions[0].replacements[0], isEnabled: true }]
  }]);
  assert.equal(normalizeSettings({ multipleReplaceInSelection: true }).multipleReplaceInSelection, true);
  assert.equal(normalizeSettings({ multipleReplaceInSelection: 'yes' }).multipleReplaceInSelection, false);
  assert.deepEqual(normalizeSettings({ multipleReplaceDefinitions: [{ ...definitions[0], id: '../unsafe' }] }).multipleReplaceDefinitions, []);
});

test('new documents wrap lines by default while explicit stored choices remain unchanged', () => {
  assert.equal(DEFAULT_SETTINGS.wrap, true);
  assert.equal(normalizeSettings({}).wrap, true);
  assert.equal(normalizeSettings({ wrap: false }).wrap, false);
  assert.equal(normalizeSettings({ wrap: true }).wrap, true);
});

test('overscroll rate defaults to zero and is bounded to 0–100 percent in ten-point steps', () => {
  assert.equal(DEFAULT_SETTINGS.overscrollRate, 0);
  assert.equal(normalizeSettings({}).overscrollRate, 0);
  assert.equal(normalizeSettings({ overscrollRate: 0.5 }).overscrollRate, 0.5);
  assert.equal(normalizeSettings({ overscrollRate: 1 }).overscrollRate, 1);
  assert.equal(normalizeSettings({ overscrollRate: -0.2 }).overscrollRate, 0);
  assert.equal(normalizeSettings({ overscrollRate: 1.5 }).overscrollRate, 1);
  assert.equal(normalizeSettings({ overscrollRate: 0.36 }).overscrollRate, 0.4);
  assert.equal(normalizeSettings({ overscrollRate: '0.5' }).overscrollRate, 0);
});

test('current-line background highlighting defaults off and preserves an explicit preference', () => {
  assert.equal(DEFAULT_SETTINGS.highlightCurrentLine, false);
  assert.equal(normalizeSettings({}).highlightCurrentLine, false);
  assert.equal(normalizeSettings({ highlightCurrentLine: true }).highlightCurrentLine, true);
  assert.equal(normalizeSettings({ highlightCurrentLine: 'yes' }).highlightCurrentLine, false);
});

test('selected-text instance highlighting defaults on and preserves an explicit preference', () => {
  assert.equal(DEFAULT_SETTINGS.highlightSelectionInstances, true);
  assert.equal(normalizeSettings({}).highlightSelectionInstances, true);
  assert.equal(normalizeSettings({ highlightSelectionInstances: false }).highlightSelectionInstances, false);
  assert.equal(normalizeSettings({ highlightSelectionInstances: 'yes' }).highlightSelectionInstances, true);
});

test('status bar opaque background defaults off and accepts only explicit booleans', () => {
  assert.equal(DEFAULT_SETTINGS.statusBarOpaqueBackground, false);
  assert.equal(normalizeSettings({}).statusBarOpaqueBackground, false);
  assert.equal(normalizeSettings({ statusBarOpaqueBackground: true }).statusBarOpaqueBackground, true);
  assert.equal(normalizeSettings({ statusBarOpaqueBackground: false }).statusBarOpaqueBackground, false);
  assert.equal(normalizeSettings({ statusBarOpaqueBackground: 'yes' }).statusBarOpaqueBackground, false);
  const hiddenOpaqueStatusBar = normalizeSettings({ showStatusBar: false, statusBarOpaqueBackground: true });
  assert.equal(hiddenOpaqueStatusBar.showStatusBar, false);
  assert.equal(hiddenOpaqueStatusBar.statusBarOpaqueBackground, true);
});

test('selected-text match highlight delay defaults to half a second and is bounded to quarter-second steps', () => {
  assert.equal(DEFAULT_SETTINGS.selectionInstanceHighlightDelay, 0.5);
  assert.equal(normalizeSettings({}).selectionInstanceHighlightDelay, 0.5);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: 0 }).selectionInstanceHighlightDelay, 0);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: 2.75 }).selectionInstanceHighlightDelay, 2.75);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: 10 }).selectionInstanceHighlightDelay, 10);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: -1 }).selectionInstanceHighlightDelay, 0);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: 12 }).selectionInstanceHighlightDelay, 10);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: 0.38 }).selectionInstanceHighlightDelay, 0.5);
  assert.equal(normalizeSettings({ selectionInstanceHighlightDelay: '1' }).selectionInstanceHighlightDelay, 0.5);
});

test('stored settings safely parse cross-window values and reject malformed JSON', () => {
  assert.deepEqual(parseStoredSettings(null), { ...DEFAULT_SETTINGS });
  assert.deepEqual(parseStoredSettings('{broken'), { ...DEFAULT_SETTINGS });
  assert.deepEqual(parseStoredSettings(JSON.stringify({ theme: 'dark', fontSize: 18, unknown: true })), {
    ...DEFAULT_SETTINGS, theme: 'dark', fontSize: 18
  });
});

test('settings clamp numeric values and preserve valid preferences', () => {
  assert.deepEqual(normalizeSettings({ theme: 'dark', fontSize: 100, indent: 'tab', wrap: true, showLineNumbers: false, stale: 1 }), {
    ...DEFAULT_SETTINGS, theme: 'dark', fontSize: 28, indent: 'tab', wrap: true, showLineNumbers: false
  });
  assert.equal(normalizeSettings({ fontSize: 1 }).fontSize, 10);
  assert.equal(normalizeSettings({ fontSize: 16.4 }).fontSize, 16);
  assert.deepEqual(normalizeSettings({ showInvisibles: true, showIndentGuides: true, showSidebar: false, showStatusBar: false }), {
    ...DEFAULT_SETTINGS, showInvisibles: true, showIndentGuides: true, showSidebar: false, showStatusBar: false
  });
});

test('vertical text preference defaults off and accepts only a boolean', () => {
  assert.equal(DEFAULT_SETTINGS.verticalText, false);
  assert.equal(normalizeSettings({ verticalText: true }).verticalText, true);
  assert.equal(normalizeSettings({ verticalText: 'yes' }).verticalText, false);
});

test('writing direction defaults to left-to-right and accepts only ltr/rtl', () => {
  assert.equal(DEFAULT_SETTINGS.writingDirection, 'ltr');
  assert.equal(normalizeSettings({ writingDirection: 'rtl' }).writingDirection, 'rtl');
  assert.equal(normalizeSettings({ writingDirection: 'vertical' }).writingDirection, 'ltr');
});

test('page guide defaults off at column 80 and bounds its configurable column', () => {
  assert.equal(DEFAULT_SETTINGS.showPageGuide, false);
  assert.equal(DEFAULT_SETTINGS.pageGuideColumn, 80);
  assert.deepEqual(normalizeSettings({ showPageGuide: true, pageGuideColumn: 120 }), {
    ...DEFAULT_SETTINGS, showPageGuide: true, pageGuideColumn: 120
  });
  assert.equal(normalizeSettings({ pageGuideColumn: 0 }).pageGuideColumn, 1);
  assert.equal(normalizeSettings({ pageGuideColumn: 2000 }).pageGuideColumn, 999);
  assert.equal(normalizeSettings({ pageGuideColumn: '120' }).pageGuideColumn, 80);
});

test('blank default window dimensions follow the last size while explicit values stay within supported bounds', () => {
  assert.equal(DEFAULT_SETTINGS.windowWidth, null);
  assert.equal(DEFAULT_SETTINGS.windowHeight, null);
  assert.deepEqual(normalizeSettings({ windowWidth: 1440, windowHeight: 900 }), {
    ...DEFAULT_SETTINGS, windowWidth: 1440, windowHeight: 900
  });
  assert.deepEqual(normalizeSettings({ windowWidth: 1440, windowHeight: null }), {
    ...DEFAULT_SETTINGS, windowWidth: 1440, windowHeight: null
  });
  assert.deepEqual(normalizeSettings({ windowWidth: 100, windowHeight: 5000 }), {
    ...DEFAULT_SETTINGS, windowWidth: 860, windowHeight: 4000
  });
  assert.deepEqual(normalizeSettings({ windowWidth: '1400', windowHeight: null }), { ...DEFAULT_SETTINGS });
});

test('tab bar, toolbar and split-editor orientation have safe persistent defaults', () => {
  assert.equal(DEFAULT_SETTINGS.showTabBar, true);
  assert.equal(DEFAULT_SETTINGS.showToolbar, true);
  assert.equal(DEFAULT_SETTINGS.splitEditorsVertically, false);
  assert.deepEqual(normalizeSettings({ showTabBar: false, showToolbar: false, splitEditorsVertically: true }), {
    ...DEFAULT_SETTINGS, showTabBar: false, showToolbar: false, splitEditorsVertically: true
  });
  assert.deepEqual(normalizeSettings({ showTabBar: 'no', showToolbar: 0, splitEditorsVertically: 'yes' }), { ...DEFAULT_SETTINGS });
});

test('toolbar item order is a complete unique permutation and hidden items are restricted to known IDs', () => {
  assert.deepEqual(normalizeSettings({}).toolbarItemOrder, [...DEFAULT_SETTINGS.toolbarItemOrder]);
  assert.deepEqual(normalizeSettings({}).hiddenToolbarItems, []);
  assert.deepEqual(normalizeSettings({ toolbarItemOrder: ['split', 'find', 'find', 'unknown'] }).toolbarItemOrder,
    ['split', 'find', ...DEFAULT_SETTINGS.toolbarItemOrder.filter(id => !['split', 'find'].includes(id))]);
  assert.deepEqual(normalizeSettings({ hiddenToolbarItems: ['outline', 'outline', 'unknown', 3] }).hiddenToolbarItems, ['outline']);
  assert.deepEqual(normalizeSettings({ toolbarItemOrder: 'find', hiddenToolbarItems: 'outline' }), { ...DEFAULT_SETTINGS });
});

test('recent syntax history is unique, normalized and bounded to six entries', () => {
  assert.deepEqual(DEFAULT_SETTINGS.recentSyntaxes, []);
  assert.deepEqual(normalizeSettings({ recentSyntaxes: ['JavaScript', 'python', 'javascript', 'bad id', 7, 'COT-SYNTAX-FOO'] }).recentSyntaxes,
    ['javascript', 'python', 'cot-syntax-foo']);
  const recentSyntaxes = Array.from({ length: 9 }, (_, index) => `mode-${index}`);
  assert.deepEqual(normalizeSettings({ recentSyntaxes }).recentSyntaxes, recentSyntaxes.slice(-6));
  assert.deepEqual(normalizeSettings({ recentSyntaxes: 'javascript' }).recentSyntaxes, []);
});

test('recent Unicode code point history persists only bounded unique Unicode scalars', () => {
  assert.deepEqual(DEFAULT_SETTINGS.recentUnicodeCodePoints, []);
  assert.deepEqual(normalizeSettings({ recentUnicodeCodePoints: [0x41, 0x1f600, 0x41, 0xd800, -1, 0x110000] }).recentUnicodeCodePoints, [0x41, 0x1f600]);
  assert.deepEqual(normalizeSettings({ recentUnicodeCodePoints: 'invalid' }).recentUnicodeCodePoints, []);
  const codes = Array.from({ length: 12 }, (_, index) => 0x41 + index);
  assert.deepEqual(normalizeSettings({ recentUnicodeCodePoints: codes }).recentUnicodeCodePoints, codes.slice(0, 10));
});

test('settings validate bounded per-syntax indentation overrides', () => {
  assert.deepEqual(normalizeSettings({ indentByLanguage: { python: '2', javascript: 'tab', 'bad id': '8', json: '100', custom: '99', zero: '0', overflow: '100' } }).indentByLanguage, {
    python: '2', javascript: 'tab', custom: '99'
  });
  const widths = ['2', '4', '8', 'tab', '99'];
  const many = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`mode-${index}`, widths[index % widths.length]]));
  assert.equal(Object.keys(normalizeSettings({ indentByLanguage: many }).indentByLanguage).length, 200);
  assert.deepEqual(normalizeSettings({ indentByLanguage: ['4'] }).indentByLanguage, {});
});

test('clearing a syntax indentation override preserves other modes and the global fallback', () => {
  const source = { python: '2', javascript: 'tab' };
  const result = clearIndentOverride(source, 'python');
  assert.deepEqual(result, { javascript: 'tab' });
  assert.deepEqual(source, { python: '2', javascript: 'tab' }, 'clearing is non-mutating');
  assert.equal(normalizeSettings({ indent: '4', indentByLanguage: result }).indent, '4');
  assert.deepEqual(clearIndentOverride(source, 'unknown'), source);
  assert.deepEqual(clearIndentOverride(source, ''), source);
});

test('settings retain only bounded, well-formed shortcut overrides', () => {
  assert.deepEqual(normalizeKeyBindings({
    save: { key: 'X', mod: true, alt: true, unexpected: true },
    multi: { key: 'Sß', mod: true, alt: true },
    unicode: { key: 'ẞ', mod: true },
    blank: { key: 'a', mod: false, ctrl: false, alt: false, shift: false },
    unsafe: { key: 'javascript:alert (1)', mod: true },
    'bad id': { key: 'z', mod: true },
    functionKey: { key: 'F12' }
  }), {
    save: { key: 'x', mod: true, ctrl: false, alt: true, shift: false },
    multi: { key: 'Sß', mod: true, ctrl: false, alt: true, shift: false },
    unicode: { key: 'ß', mod: true, ctrl: false, alt: false, shift: false },
    functionKey: { key: 'f12', mod: false, ctrl: false, alt: false, shift: false }
  });
  const many = Object.fromEntries(Array.from({ length: 105 }, (_, index) => [`shortcut${index}`, { key: 'f1' }]));
  assert.equal(Object.keys(normalizeKeyBindings(many)).length, 100);
  assert.deepEqual(normalizeSettings({ keyBindings: { save: { key: 'z', mod: true } } }).keyBindings.save, {
    key: 'z', mod: true, ctrl: false, alt: false, shift: false
  });
});

test('shortcut settings accept long multi-character outputs within one aggregate Unicode-scalar budget', () => {
  const maximum = '😀'.repeat(16_384);
  const normalized = normalizeKeyBindings({
    save: { key: maximum, mod: true },
    find: { key: 'x', mod: true }
  });
  assert.equal(normalized.save.key, maximum);
  assert.equal(normalized.find, undefined);
});

test('stored shortcut preferences preserve case-distinct multi-character bindings', () => {
  const keyBindings = {
    upper: { key: 'SS', mod: true },
    lower: { key: 'ss', mod: true }
  };
  const expected = {
    upper: { key: 'SS', mod: true, ctrl: false, alt: false, shift: false },
    lower: { key: 'ss', mod: true, ctrl: false, alt: false, shift: false }
  };
  assert.deepEqual(normalizeSettings({ keyBindings }).keyBindings, expected);
  assert.deepEqual(parseStoredSettings(JSON.stringify({ keyBindings })).keyBindings, expected);
});

test('page setup settings accept known paper presets and clamp print font size', () => {
  assert.deepEqual(normalizeSettings({ printPageSize: 'Letter', printOrientation: 'landscape', printMargins: 'narrow', printTitle: false, printFontSize: 99 }), {
    ...DEFAULT_SETTINGS, printPageSize: 'Letter', printOrientation: 'landscape', printMargins: 'narrow', printTitle: false, printFontSize: 18
  });
  assert.deepEqual(normalizeSettings({ printPageSize: 'custom', printOrientation: 'sideways', printMargins: 'none', printTitle: 'yes', printFontSize: 1 }), {
    ...DEFAULT_SETTINGS, printFontSize: 8
  });
  assert.equal(DEFAULT_SETTINGS.printLineNumbers, false);
  assert.equal(normalizeSettings({ printLineNumbers: true }).printLineNumbers, true);
  assert.equal(normalizeSettings({ printLineNumbers: 'yes' }).printLineNumbers, false);
});

test('advanced character count preferences default to CotEditor values and reject unsupported options', () => {
  assert.deepEqual({
    unit: DEFAULT_SETTINGS.countUnit,
    normalizationForm: DEFAULT_SETTINGS.countNormalizationForm,
    normalizes: DEFAULT_SETTINGS.countNormalizes,
    ignoresNewlines: DEFAULT_SETTINGS.countIgnoresNewlines,
    ignoresWhitespaces: DEFAULT_SETTINGS.countIgnoresWhitespaces,
    collapsesWhitespace: DEFAULT_SETTINGS.countTreatsConsecutiveWhitespaceAsSingle,
    encoding: DEFAULT_SETTINGS.countEncoding
  }, {
    unit: 'grapheme', normalizationForm: 'NFC', normalizes: false,
    ignoresNewlines: false, ignoresWhitespaces: false, collapsesWhitespace: false,
    encoding: 'utf8'
  });
  assert.deepEqual(normalizeSettings({
    countUnit: 'byte', countNormalizationForm: 'NFKC_CF', countNormalizes: true,
    countIgnoresNewlines: true, countIgnoresWhitespaces: true,
    countTreatsConsecutiveWhitespaceAsSingle: true, countEncoding: 'shift_jis'
  }), {
    ...DEFAULT_SETTINGS, countUnit: 'byte', countNormalizationForm: 'NFKC_CF', countNormalizes: true,
    countIgnoresNewlines: true, countIgnoresWhitespaces: true,
    countTreatsConsecutiveWhitespaceAsSingle: true, countEncoding: 'shift_jis'
  });
  assert.equal(normalizeSettings({ countNormalizationForm: 'MODIFIED_NFD' }).countNormalizationForm, 'MODIFIED_NFD');
  assert.equal(normalizeSettings({ countNormalizationForm: 'MODIFIED_NFC' }).countNormalizationForm, 'MODIFIED_NFC');
  assert.deepEqual(normalizeSettings({ countUnit: 'words', countNormalizationForm: 'modifiedNFC', countEncoding: 'made-up' }), {
    ...DEFAULT_SETTINGS
  });
});

test('default syntax defaults to plain text and preserves only safe syntax identifiers', () => {
  assert.equal(DEFAULT_SETTINGS.defaultSyntax, 'plaintext');
  assert.equal(normalizeSettings({}).defaultSyntax, 'plaintext');
  assert.equal(normalizeSettings({ defaultSyntax: 'Markdown' }).defaultSyntax, 'markdown');
  assert.equal(normalizeSettings({ defaultSyntax: 'cot-syntax-markup' }).defaultSyntax, 'cot-syntax-markup');
  assert.equal(normalizeSettings({ defaultSyntax: '../markdown' }).defaultSyntax, 'plaintext');
  assert.equal(normalizeSettings({ defaultSyntax: 3 }).defaultSyntax, 'plaintext');
});
