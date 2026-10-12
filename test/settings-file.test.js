import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../lib/settings.js';
import { MAX_SETTINGS_FILE_BYTES, SETTINGS_FILE_FORMAT, SETTINGS_FILE_VERSION, parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';

test('settings export round-trips validated preferences', () => {
  const serialized = serializeSettingsFile({ theme: 'dark', printPageSize: 'Letter', printOrientation: 'landscape' });
  const payload = JSON.parse(serialized);
  assert.equal(payload.format, SETTINGS_FILE_FORMAT);
  assert.equal(payload.version, SETTINGS_FILE_VERSION);
  assert.deepEqual(parseSettingsFile(serialized), { ...DEFAULT_SETTINGS, theme: 'dark', printPageSize: 'Letter', printOrientation: 'landscape' });
});

test('settings export/import preserves navigation bar visibility', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ showNavigationBar: true })).showNavigationBar, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ showNavigationBar: false })).showNavigationBar, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ showNavigationBar: 'off' })).showNavigationBar, true);
});

test('settings export/import preserves bounded default window dimensions', () => {
  assert.deepEqual(parseSettingsFile(serializeSettingsFile({ windowWidth: 1440, windowHeight: 960 })), {
    ...DEFAULT_SETTINGS, windowWidth: 1440, windowHeight: 960
  });
  assert.deepEqual(parseSettingsFile(serializeSettingsFile({ windowWidth: 1, windowHeight: 5000 })), {
    ...DEFAULT_SETTINGS, windowWidth: 860, windowHeight: 4000
  });
});

test('settings export/import preserves the selected editor font type and rejects unsupported values', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ fontType: 'standard' })).fontType, 'standard');
  assert.equal(parseSettingsFile(serializeSettingsFile({ fontType: 'monospaced' })).fontType, 'monospaced');
  assert.equal(parseSettingsFile(serializeSettingsFile({ fontType: 'serif' })).fontType, 'monospaced');
});

test('settings export/import preserves Use Spaces for Indentation and normalizes invalid values', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoExpandTab: true })).autoExpandTab, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoExpandTab: false })).autoExpandTab, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoExpandTab: 'yes' })).autoExpandTab, false);
});

test('settings export/import preserves automatic indentation and normalizes invalid values', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoIndent: true })).autoIndent, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoIndent: false })).autoIndent, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoIndent: 'no' })).autoIndent, true);
});

test('settings export/import preserves bounded overscroll rate', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ overscrollRate: 0.7 })).overscrollRate, 0.7);
  assert.equal(parseSettingsFile(serializeSettingsFile({ overscrollRate: 1.2 })).overscrollRate, 1);
  assert.equal(parseSettingsFile(serializeSettingsFile({ overscrollRate: '0.7' })).overscrollRate, 0);
});

test('settings export/import preserves indentation-style detection and normalizes invalid values', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ detectsIndentStyle: true })).detectsIndentStyle, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ detectsIndentStyle: false })).detectsIndentStyle, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ detectsIndentStyle: 'no' })).detectsIndentStyle, true);
});

test('settings export/import preserves automatic completion suggestions and normalizes invalid values', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ suggestCompletionsWhileTyping: true })).suggestCompletionsWhileTyping, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ suggestCompletionsWhileTyping: false })).suggestCompletionsWhileTyping, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ suggestCompletionsWhileTyping: 'yes' })).suggestCompletionsWhileTyping, false);
});

test('settings export/import preserves per-syntax automatic completion overrides', () => {
  const imported = parseSettingsFile(serializeSettingsFile({
    suggestCompletionsWhileTyping: true,
    suggestCompletionsByLanguage: { javascript: false, python: true }
  }));
  assert.equal(imported.suggestCompletionsWhileTyping, true);
  assert.deepEqual(imported.suggestCompletionsByLanguage, { javascript: false, python: true });
  assert.deepEqual(parseSettingsFile(serializeSettingsFile({
    suggestCompletionsByLanguage: { javascript: 'yes', 'bad key': false }
  })).suggestCompletionsByLanguage, {});
});

test('settings export/import preserves validated per-syntax completion word sources', () => {
  const imported = parseSettingsFile(serializeSettingsFile({
    completionWordTypesByLanguage: {
      javascript: { document: false, syntax: true },
      plaintext: { document: true, syntax: false, standard: true }
    }
  }));
  assert.deepEqual(imported.completionWordTypesByLanguage, {
    javascript: { document: false, syntax: true },
    plaintext: { document: true, syntax: false }
  });
  assert.deepEqual(parseSettingsFile(serializeSettingsFile({
    completionWordTypesByLanguage: { '../bad': { document: true }, python: { document: 'yes' } }
  })).completionWordTypesByLanguage, {});
});

test('settings export/import preserves validated per-syntax automatic symbol balancing', () => {
  const imported = parseSettingsFile(serializeSettingsFile({
    automaticSymbolBalancingByLanguage: { javascript: true, plaintext: false }
  }));
  assert.deepEqual(imported.automaticSymbolBalancingByLanguage, { javascript: true, plaintext: false });
  assert.deepEqual(parseSettingsFile(serializeSettingsFile({
    automaticSymbolBalancingByLanguage: { '../bad': true, python: 'yes' }
  })).automaticSymbolBalancingByLanguage, {});
});

test('settings export/import preserves selection indentation with Tab', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ indentWithTabKey: true })).indentWithTabKey, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ indentWithTabKey: false })).indentWithTabKey, false);
});

test('settings export/import preserves the comment delimiter spacer preference', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ appendsCommentSpacer: true })).appendsCommentSpacer, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ appendsCommentSpacer: false })).appendsCommentSpacer, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ appendsCommentSpacer: 'yes' })).appendsCommentSpacer, true);
});

test('settings export/import preserves the opaque status bar background preference', () => {
  assert.equal(parseSettingsFile(serializeSettingsFile({ statusBarOpaqueBackground: true })).statusBarOpaqueBackground, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ statusBarOpaqueBackground: false })).statusBarOpaqueBackground, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ statusBarOpaqueBackground: 'yes' })).statusBarOpaqueBackground, false);
});

test('settings export/import preserves case-distinct multi-character shortcuts', () => {
  const keyBindings = {
    upper: { key: 'SS', mod: true },
    lower: { key: 'ss', mod: true }
  };
  const imported = parseSettingsFile(serializeSettingsFile({ keyBindings }));
  assert.deepEqual(imported.keyBindings, {
    upper: { key: 'SS', mod: true, ctrl: false, alt: false, shift: false },
    lower: { key: 'ss', mod: true, ctrl: false, alt: false, shift: false }
  });
});

test('settings export/import preserves the selected-text match highlight delay', () => {
  const settings = { highlightSelectionInstances: false, selectionInstanceHighlightDelay: 2.75 };
  const imported = parseSettingsFile(serializeSettingsFile(settings));
  assert.equal(imported.highlightSelectionInstances, false);
  assert.equal(imported.selectionInstanceHighlightDelay, 2.75);
});

test('settings export/import preserves the diacritic-insensitive find preference', () => {
  const imported = parseSettingsFile(serializeSettingsFile({ findIgnoresDiacritics: true }));
  assert.equal(imported.findIgnoresDiacritics, true);
});

test('settings export/import preserves Tab Width, custom indentation, snippets, replacements and Unicode input history', () => {
  const snippets = [{ id: 'hello-world', name: 'Hello', scope: 'javascript', format: 'hello <<<SELECTION>>>', shortcut: { key: 'q', mod: true, ctrl: false, alt: true, shift: true } }];
  const multipleReplaceDefinitions = [{ id: 'rename', name: '重命名', matchesFullWord: true, textualCaseInsensitive: true, textualLiteral: true, textualAnchored: true, regexCaseInsensitive: true, regexIgnoreMetacharacters: true, regexDotMatchesLineSeparators: true, regexAnchorsMatchLines: true, regexUnixLineSeparators: true, unescapesReplacementString: true, replacements: [{ id: 'a', findString: 'old', replacementString: 'new', isEnabled: true, usesRegularExpression: false, ignoresCase: false }] }];
  const textReplacements = [{ id: 'omw', trigger: 'omw', replacement: 'on my way', enabled: true }];
  const recentUnicodeCodePoints = [0x1f600, 0x00a9];
  const settings = { indent: 'tab', tabWidth: 6, indentByLanguage: { python: '5', javascript: 'tab' }, snippets, textReplacements, multipleReplaceDefinitions, multipleReplaceInSelection: true, recentUnicodeCodePoints };
  assert.deepEqual(parseSettingsFile(serializeSettingsFile(settings)), {
    ...DEFAULT_SETTINGS, indent: 'tab', tabWidth: 6, indentByLanguage: { python: '5', javascript: 'tab' }, snippets, textReplacements, multipleReplaceDefinitions, multipleReplaceInSelection: true, recentUnicodeCodePoints
  });
});

test('settings import rejects malformed, foreign, and oversized files', () => {
  assert.throws(() => parseSettingsFile('{'), /有效的 JSON/);
  assert.throws(() => parseSettingsFile(JSON.stringify({ format: 'other', version: 1, settings: {} })), /不受支持/);
  assert.throws(() => parseSettingsFile(' '.repeat(MAX_SETTINGS_FILE_BYTES + 1)), /过大/);
});

test('settings export/import preserves the chosen default syntax', () => {
  const imported = parseSettingsFile(serializeSettingsFile({ defaultSyntax: 'markdown' }));
  assert.equal(imported.defaultSyntax, 'markdown');
});

test('settings export/import preserves HFS+ modified advanced-count normalization forms', () => {
  for (const form of ['MODIFIED_NFD', 'MODIFIED_NFC']) {
    assert.equal(parseSettingsFile(serializeSettingsFile({ countNormalizationForm: form })).countNormalizationForm, form);
  }
});
