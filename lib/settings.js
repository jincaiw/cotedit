import { MAX_PRINTABLE_SHORTCUT_KEY_SCALARS, normalizeShortcutKey } from './shortcuts.js';
import { DEFAULT_TOOLBAR_ITEM_ORDER, normalizeHiddenToolbarItems, normalizeToolbarItemOrder } from './toolbar-items.js';
import { normalizeSnippets } from './snippets.js';
import { DEFAULT_FILE_DROP_RULES, normalizeFileDropRules } from './file-drop-rules.js';
import { normalizeMultipleReplaceDefinitions } from './multiple-replace.js';
import { normalizeRecentUnicodeCodePoints } from './unicode-input.js';
import { normalizeTextReplacements } from './text-replacements.js';
import { DEFAULT_SELECTION_INSTANCE_HIGHLIGHT_DELAY, normalizeSelectionInstanceHighlightDelay } from './selection-highlight-delay.js';
import { normalizeDefaultSyntaxId } from './default-syntax.js';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',
  fontSize: 14,
  lineHeight: 1.3,
  windowWidth: null,
  windowHeight: null,
  ligatures: true,
  fontType: 'monospaced',
  defaultSyntax: 'plaintext',
  indent: 'tab',
  autoExpandTab: false,
  autoIndent: true,
  suggestCompletionsWhileTyping: false,
  suggestCompletionsByLanguage: Object.freeze({}),
  completionWordTypesByLanguage: Object.freeze({}),
  automaticSymbolBalancingByLanguage: Object.freeze({}),
  continuousSpellCheckingByLanguage: Object.freeze({}),
  smartQuotesByLanguage: Object.freeze({}),
  smartDashesByLanguage: Object.freeze({}),
  automaticTextReplacementByLanguage: Object.freeze({}),
  detectsIndentStyle: true,
  indentWithTabKey: false,
  appendsCommentSpacer: true,
  autoTrimsTrailingWhitespace: false,
  trimsWhitespaceOnlyLines: false,
  enablesHangingIndent: true,
  hangingIndentWidth: 0,
  tabWidth: 4,
  indentByLanguage: {},
  snippets: Object.freeze([]),
  textReplacements: Object.freeze([]),
  fileDropRules: DEFAULT_FILE_DROP_RULES,
  multipleReplaceDefinitions: Object.freeze([]),
  multipleReplaceInSelection: false,
  hiddenSyntaxes: [],
  recentSyntaxes: [],
  recentUnicodeCodePoints: Object.freeze([]),
  findIgnoresDiacritics: false,
  wrap: true,
  overscrollRate: 0,
  verticalText: false,
  writingDirection: 'ltr',
  showLineNumbers: true,
  highlightCurrentLine: false,
  highlightBraces: true,
  highlightSelectionInstances: true,
  autoLinkDetection: false,
  selectionInstanceHighlightDelay: DEFAULT_SELECTION_INSTANCE_HIGHLIGHT_DELAY,
  showInvisibles: false,
  showInvisibleNewLine: true,
  showInvisibleTab: true,
  showInvisibleSpace: false,
  showInvisibleWhitespaces: true,
  showInvisibleControl: true,
  showIndentGuides: false,
  showPageGuide: false,
  pageGuideColumn: 80,
  showSidebar: true,
  showStatusBar: true,
  statusBarOpaqueBackground: false,
  showTabBar: true,
  showToolbar: true,
  showNavigationBar: true,
  toolbarItemOrder: DEFAULT_TOOLBAR_ITEM_ORDER,
  hiddenToolbarItems: Object.freeze([]),
  splitEditorsVertically: false,
  keyBindings: Object.freeze({}),
  printPageSize: 'A4',
  printOrientation: 'portrait',
  printMargins: 'normal',
  printTitle: true,
  printLineNumbers: false,
  printFontSize: 10,
  countUnit: 'grapheme',
  countNormalizationForm: 'NFC',
  countNormalizes: false,
  countIgnoresNewlines: false,
  countIgnoresWhitespaces: false,
  countTreatsConsecutiveWhitespaceAsSingle: false,
  countEncoding: 'utf8'
});

const THEMES = new Set(['system', 'light', 'dark']);
const WRITING_DIRECTIONS = new Set(['ltr', 'rtl']);
const INDENTS = new Set(['tab', '2', '4', '8']);
function normalizeIndentValue(value) {
  if (value === 'tab') return 'tab';
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) return null;
  const width = Number(value);
  return width >= 1 && width <= 99 ? String(width) : null;
}
function normalizeOverscrollRate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.overscrollRate;
  return Math.round(Math.max(0, Math.min(1, value)) * 10) / 10;
}
export function normalizeLineHeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.lineHeight;
  return Math.round(Math.max(0.1, Math.min(10, value)) * 10) / 10;
}
const PAGE_SIZES = new Set(['A4', 'A3', 'Letter', 'Legal', 'Tabloid']);
const PAGE_ORIENTATIONS = new Set(['portrait', 'landscape']);
const PAGE_MARGINS = new Set(['normal', 'narrow', 'wide']);
const FONT_TYPES = new Set(['standard', 'monospaced']);
const COUNT_UNITS = new Set(['grapheme', 'scalar', 'utf16', 'byte']);
const COUNT_NORMALIZATION_FORMS = new Set(['NFD', 'NFC', 'NFKD', 'NFKC', 'NFKC_CF', 'MODIFIED_NFD', 'MODIFIED_NFC']);
const COUNT_ENCODINGS = new Set(['utf8', 'utf16le', 'utf16be', 'shift_jis', 'gbk', 'big5', 'windows-1252', 'iso-8859-1']);
const SHORTCUT_PUNCTUATION = new Set([',', '.', '/', '\\', '[', ']', '=', '-', ';', "'", '`']);
const SHORTCUT_NAMED_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'backspace', 'delete', 'escape', 'tab', 'enter', 'space', 'pageup', 'pagedown', 'home', 'end']);

export function normalizeKeyBindings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  let totalKeyScalars = 0;
  for (const [id, binding] of Object.entries(value).slice(0, 100)) {
    if (!/^[a-z][a-z0-9]{0,39}$/i.test(id) || !binding || typeof binding !== 'object' || Array.isArray(binding)) continue;
    const key = normalizeShortcutKey(binding.key);
    const keyScalars = Array.from(key).length;
    if (totalKeyScalars + keyScalars > MAX_PRINTABLE_SHORTCUT_KEY_SCALARS) continue;
    const validKey = Boolean(key) && (SHORTCUT_PUNCTUATION.has(key) || SHORTCUT_NAMED_KEYS.has(key) || /^[a-z0-9]$/.test(key) || /^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key) || Array.from(key).length > 1 || /[^\x00-\x7F]/u.test(key));
    if (!validKey) continue;
    const entry = {
      key,
      mod: binding.mod === true,
      ctrl: binding.ctrl === true,
      alt: binding.alt === true,
      shift: binding.shift === true
    };
    if (!entry.mod && !entry.ctrl && !entry.alt && !entry.shift && !/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) continue;
    normalized[id] = entry;
    totalKeyScalars += keyScalars;
  }
  return normalized;
}

function normalizeLanguageBooleanOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([language, enabled]) => /^[a-z0-9_-]{1,80}$/i.test(language) && typeof enabled === 'boolean')
    .slice(-200));
}

function normalizeLanguageCompletionWordTypeOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([language, sources]) => {
    if (!/^[a-z0-9_-]{1,80}$/i.test(language) || !sources || typeof sources !== 'object' || Array.isArray(sources)) return [];
    const normalized = Object.fromEntries(['document', 'syntax']
      .filter(source => typeof sources[source] === 'boolean')
      .map(source => [source, sources[source]]));
    return Object.keys(normalized).length ? [[language, normalized]] : [];
  }).slice(-200));
}

/** Validate persisted preferences before they are used to update the UI. */
export function normalizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const fontSize = Number.isFinite(value.fontSize) ? Math.round(value.fontSize) : DEFAULT_SETTINGS.fontSize;
  const printFontSize = Number.isFinite(value.printFontSize) ? Math.round(value.printFontSize) : DEFAULT_SETTINGS.printFontSize;
  const indentByLanguage = Object.fromEntries(Object.entries(value.indentByLanguage && typeof value.indentByLanguage === 'object' && !Array.isArray(value.indentByLanguage) ? value.indentByLanguage : {})
    .filter(([language, indent]) => /^[a-z0-9_-]{1,80}$/i.test(language) && normalizeIndentValue(indent) !== null)
    .map(([language, indent]) => [language, normalizeIndentValue(indent)])
    .slice(-200));
  const suggestCompletionsByLanguage = normalizeLanguageBooleanOverrides(value.suggestCompletionsByLanguage);
  const completionWordTypesByLanguage = normalizeLanguageCompletionWordTypeOverrides(value.completionWordTypesByLanguage);
  const automaticSymbolBalancingByLanguage = normalizeLanguageBooleanOverrides(value.automaticSymbolBalancingByLanguage);
  const continuousSpellCheckingByLanguage = normalizeLanguageBooleanOverrides(value.continuousSpellCheckingByLanguage);
  const smartQuotesByLanguage = normalizeLanguageBooleanOverrides(value.smartQuotesByLanguage);
  const smartDashesByLanguage = normalizeLanguageBooleanOverrides(value.smartDashesByLanguage);
  const automaticTextReplacementByLanguage = normalizeLanguageBooleanOverrides(value.automaticTextReplacementByLanguage);
  const hiddenSyntaxes = Array.isArray(value.hiddenSyntaxes)
    ? [...new Set(value.hiddenSyntaxes.filter(id => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,80}$/i.test(id)).map(id => id.toLowerCase()))].slice(0, 200)
    : [];
  const recentSyntaxes = Array.isArray(value.recentSyntaxes)
    ? [...new Set(value.recentSyntaxes.filter(id => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,80}$/i.test(id)).map(id => id.toLowerCase()))].slice(-6)
    : [];
  return {
    theme: THEMES.has(value.theme) ? value.theme : DEFAULT_SETTINGS.theme,
    fontSize: Math.max(10, Math.min(28, fontSize)),
    lineHeight: normalizeLineHeight(value.lineHeight),
    windowWidth: value.windowWidth === null ? null : Number.isFinite(value.windowWidth) ? Math.max(860, Math.min(4000, Math.round(value.windowWidth))) : DEFAULT_SETTINGS.windowWidth,
    windowHeight: value.windowHeight === null ? null : Number.isFinite(value.windowHeight) ? Math.max(600, Math.min(4000, Math.round(value.windowHeight))) : DEFAULT_SETTINGS.windowHeight,
    ligatures: typeof value.ligatures === 'boolean' ? value.ligatures : DEFAULT_SETTINGS.ligatures,
    fontType: FONT_TYPES.has(value.fontType) ? value.fontType : DEFAULT_SETTINGS.fontType,
    defaultSyntax: normalizeDefaultSyntaxId(value.defaultSyntax),
    indent: normalizeIndentValue(value.indent) ?? DEFAULT_SETTINGS.indent,
    autoExpandTab: typeof value.autoExpandTab === 'boolean' ? value.autoExpandTab : DEFAULT_SETTINGS.autoExpandTab,
    autoIndent: typeof value.autoIndent === 'boolean' ? value.autoIndent : DEFAULT_SETTINGS.autoIndent,
    suggestCompletionsWhileTyping: typeof value.suggestCompletionsWhileTyping === 'boolean' ? value.suggestCompletionsWhileTyping : DEFAULT_SETTINGS.suggestCompletionsWhileTyping,
    suggestCompletionsByLanguage,
    completionWordTypesByLanguage,
    automaticSymbolBalancingByLanguage,
    continuousSpellCheckingByLanguage,
    smartQuotesByLanguage,
    smartDashesByLanguage,
    automaticTextReplacementByLanguage,
    detectsIndentStyle: typeof value.detectsIndentStyle === 'boolean' ? value.detectsIndentStyle : DEFAULT_SETTINGS.detectsIndentStyle,
    indentWithTabKey: typeof value.indentWithTabKey === 'boolean' ? value.indentWithTabKey : DEFAULT_SETTINGS.indentWithTabKey,
    appendsCommentSpacer: typeof value.appendsCommentSpacer === 'boolean' ? value.appendsCommentSpacer : DEFAULT_SETTINGS.appendsCommentSpacer,
    autoTrimsTrailingWhitespace: typeof value.autoTrimsTrailingWhitespace === 'boolean' ? value.autoTrimsTrailingWhitespace : DEFAULT_SETTINGS.autoTrimsTrailingWhitespace,
    trimsWhitespaceOnlyLines: typeof value.trimsWhitespaceOnlyLines === 'boolean' ? value.trimsWhitespaceOnlyLines : DEFAULT_SETTINGS.trimsWhitespaceOnlyLines,
    enablesHangingIndent: typeof value.enablesHangingIndent === 'boolean' ? value.enablesHangingIndent : DEFAULT_SETTINGS.enablesHangingIndent,
    hangingIndentWidth: Math.max(0, Math.min(99, Math.round(Number.isFinite(value.hangingIndentWidth) ? value.hangingIndentWidth : DEFAULT_SETTINGS.hangingIndentWidth))),
    tabWidth: Math.max(1, Math.min(99, Math.round(Number.isFinite(value.tabWidth) ? value.tabWidth : DEFAULT_SETTINGS.tabWidth))),
    indentByLanguage,
    snippets: normalizeSnippets(value.snippets),
    textReplacements: normalizeTextReplacements(value.textReplacements),
    fileDropRules: normalizeFileDropRules(value.fileDropRules),
    multipleReplaceDefinitions: normalizeMultipleReplaceDefinitions(value.multipleReplaceDefinitions),
    multipleReplaceInSelection: typeof value.multipleReplaceInSelection === 'boolean' ? value.multipleReplaceInSelection : DEFAULT_SETTINGS.multipleReplaceInSelection,
    hiddenSyntaxes,
    recentSyntaxes,
    recentUnicodeCodePoints: normalizeRecentUnicodeCodePoints(value.recentUnicodeCodePoints),
    findIgnoresDiacritics: typeof value.findIgnoresDiacritics === 'boolean' ? value.findIgnoresDiacritics : DEFAULT_SETTINGS.findIgnoresDiacritics,
    wrap: typeof value.wrap === 'boolean' ? value.wrap : DEFAULT_SETTINGS.wrap,
    overscrollRate: normalizeOverscrollRate(value.overscrollRate),
    verticalText: typeof value.verticalText === 'boolean' ? value.verticalText : DEFAULT_SETTINGS.verticalText,
    writingDirection: WRITING_DIRECTIONS.has(value.writingDirection) ? value.writingDirection : DEFAULT_SETTINGS.writingDirection,
    showLineNumbers: typeof value.showLineNumbers === 'boolean' ? value.showLineNumbers : DEFAULT_SETTINGS.showLineNumbers,
    highlightCurrentLine: typeof value.highlightCurrentLine === 'boolean' ? value.highlightCurrentLine : DEFAULT_SETTINGS.highlightCurrentLine,
    highlightBraces: typeof value.highlightBraces === 'boolean' ? value.highlightBraces : DEFAULT_SETTINGS.highlightBraces,
    highlightSelectionInstances: typeof value.highlightSelectionInstances === 'boolean' ? value.highlightSelectionInstances : DEFAULT_SETTINGS.highlightSelectionInstances,
    autoLinkDetection: typeof value.autoLinkDetection === 'boolean' ? value.autoLinkDetection : DEFAULT_SETTINGS.autoLinkDetection,
    selectionInstanceHighlightDelay: normalizeSelectionInstanceHighlightDelay(value.selectionInstanceHighlightDelay),
    showInvisibles: typeof value.showInvisibles === 'boolean' ? value.showInvisibles : DEFAULT_SETTINGS.showInvisibles,
    showInvisibleNewLine: typeof value.showInvisibleNewLine === 'boolean' ? value.showInvisibleNewLine : DEFAULT_SETTINGS.showInvisibleNewLine,
    showInvisibleTab: typeof value.showInvisibleTab === 'boolean' ? value.showInvisibleTab : DEFAULT_SETTINGS.showInvisibleTab,
    showInvisibleSpace: typeof value.showInvisibleSpace === 'boolean' ? value.showInvisibleSpace : DEFAULT_SETTINGS.showInvisibleSpace,
    showInvisibleWhitespaces: typeof value.showInvisibleWhitespaces === 'boolean' ? value.showInvisibleWhitespaces : DEFAULT_SETTINGS.showInvisibleWhitespaces,
    showInvisibleControl: typeof value.showInvisibleControl === 'boolean' ? value.showInvisibleControl : DEFAULT_SETTINGS.showInvisibleControl,
    showIndentGuides: typeof value.showIndentGuides === 'boolean' ? value.showIndentGuides : DEFAULT_SETTINGS.showIndentGuides,
    showPageGuide: typeof value.showPageGuide === 'boolean' ? value.showPageGuide : DEFAULT_SETTINGS.showPageGuide,
    pageGuideColumn: Math.max(1, Math.min(999, Math.round(Number.isFinite(value.pageGuideColumn) ? value.pageGuideColumn : DEFAULT_SETTINGS.pageGuideColumn))),
    showSidebar: typeof value.showSidebar === 'boolean' ? value.showSidebar : DEFAULT_SETTINGS.showSidebar,
    showStatusBar: typeof value.showStatusBar === 'boolean' ? value.showStatusBar : DEFAULT_SETTINGS.showStatusBar,
    statusBarOpaqueBackground: typeof value.statusBarOpaqueBackground === 'boolean' ? value.statusBarOpaqueBackground : DEFAULT_SETTINGS.statusBarOpaqueBackground,
    showTabBar: typeof value.showTabBar === 'boolean' ? value.showTabBar : DEFAULT_SETTINGS.showTabBar,
    showToolbar: typeof value.showToolbar === 'boolean' ? value.showToolbar : DEFAULT_SETTINGS.showToolbar,
    showNavigationBar: typeof value.showNavigationBar === 'boolean' ? value.showNavigationBar : DEFAULT_SETTINGS.showNavigationBar,
    toolbarItemOrder: normalizeToolbarItemOrder(value.toolbarItemOrder),
    hiddenToolbarItems: normalizeHiddenToolbarItems(value.hiddenToolbarItems),
    splitEditorsVertically: typeof value.splitEditorsVertically === 'boolean' ? value.splitEditorsVertically : DEFAULT_SETTINGS.splitEditorsVertically,
    keyBindings: normalizeKeyBindings(value.keyBindings),
    printPageSize: PAGE_SIZES.has(value.printPageSize) ? value.printPageSize : DEFAULT_SETTINGS.printPageSize,
    printOrientation: PAGE_ORIENTATIONS.has(value.printOrientation) ? value.printOrientation : DEFAULT_SETTINGS.printOrientation,
    printMargins: PAGE_MARGINS.has(value.printMargins) ? value.printMargins : DEFAULT_SETTINGS.printMargins,
    printTitle: typeof value.printTitle === 'boolean' ? value.printTitle : DEFAULT_SETTINGS.printTitle,
    printLineNumbers: typeof value.printLineNumbers === 'boolean' ? value.printLineNumbers : DEFAULT_SETTINGS.printLineNumbers,
    printFontSize: Math.max(8, Math.min(18, printFontSize)),
    countUnit: COUNT_UNITS.has(value.countUnit) ? value.countUnit : DEFAULT_SETTINGS.countUnit,
    countNormalizationForm: COUNT_NORMALIZATION_FORMS.has(value.countNormalizationForm) ? value.countNormalizationForm : DEFAULT_SETTINGS.countNormalizationForm,
    countNormalizes: typeof value.countNormalizes === 'boolean' ? value.countNormalizes : DEFAULT_SETTINGS.countNormalizes,
    countIgnoresNewlines: typeof value.countIgnoresNewlines === 'boolean' ? value.countIgnoresNewlines : DEFAULT_SETTINGS.countIgnoresNewlines,
    countIgnoresWhitespaces: typeof value.countIgnoresWhitespaces === 'boolean' ? value.countIgnoresWhitespaces : DEFAULT_SETTINGS.countIgnoresWhitespaces,
    countTreatsConsecutiveWhitespaceAsSingle: typeof value.countTreatsConsecutiveWhitespaceAsSingle === 'boolean' ? value.countTreatsConsecutiveWhitespaceAsSingle : DEFAULT_SETTINGS.countTreatsConsecutiveWhitespaceAsSingle,
    countEncoding: COUNT_ENCODINGS.has(value.countEncoding) ? value.countEncoding : DEFAULT_SETTINGS.countEncoding
  };
}

/** Return a copy of the per-syntax indentation map without one syntax override. */
export function clearIndentOverride(indentByLanguage, language) {
  const overrides = indentByLanguage && typeof indentByLanguage === 'object' && !Array.isArray(indentByLanguage)
    ? { ...indentByLanguage }
    : {};
  if (typeof language === 'string') delete overrides[language];
  return overrides;
}

/** Resolve a syntax-specific automatic-completion preference, falling back to the global default. */
export function autoCompletionEnabledForLanguage(settings, language) {
  const overrides = settings?.suggestCompletionsByLanguage;
  if (typeof language === 'string' && overrides && Object.prototype.hasOwnProperty.call(overrides, language)) {
    return overrides[language] === true;
  }
  return settings?.suggestCompletionsWhileTyping === true;
}

/** Set a syntax-specific automatic-completion override; null removes it and resumes inheritance. */
export function setAutoCompletionOverride(overrides, language, enabled) {
  const next = normalizeLanguageBooleanOverrides(overrides);
  if (typeof language !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(language)) return next;
  if (typeof enabled === 'boolean') next[language] = enabled;
  else delete next[language];
  return Object.fromEntries(Object.entries(next).slice(-200));
}

/** Resolve syntax-specific automatic symbol balancing, using the Mode default when unset. */
export function automaticSymbolBalancingEnabledForLanguage(settings, language, modeDefault = false) {
  const overrides = settings?.automaticSymbolBalancingByLanguage;
  if (typeof language === 'string' && overrides && Object.prototype.hasOwnProperty.call(overrides, language)) {
    return overrides[language] === true;
  }
  return modeDefault === true;
}

/** Set or reset a syntax-specific automatic symbol-balancing override. */
export function setAutomaticSymbolBalancingOverride(overrides, language, enabled) {
  const next = normalizeLanguageBooleanOverrides(overrides);
  if (typeof language !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(language)) return next;
  if (typeof enabled === 'boolean') next[language] = enabled;
  else delete next[language];
  return Object.fromEntries(Object.entries(next).slice(-200));
}

/** Resolve syntax-specific continuous spell checking with the supplied Mode default. */
export function continuousSpellCheckingEnabledForLanguage(settings, language, modeDefault = false) {
  const overrides = settings?.continuousSpellCheckingByLanguage;
  if (typeof language === 'string' && overrides && Object.hasOwn(overrides, language)) {
    return overrides[language] === true;
  }
  return modeDefault === true;
}

/** Set or reset a per-syntax continuous spell-checking preference. */
export function setContinuousSpellCheckingOverride(overrides, language, enabled) {
  const next = normalizeLanguageBooleanOverrides(overrides);
  if (typeof language !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(language)) return next;
  if (typeof enabled === 'boolean') next[language] = enabled;
  else delete next[language];
  return Object.fromEntries(Object.entries(next).slice(-200));
}

/** Resolve document and syntax word sources over the active syntax's defaults. */
export function completionWordTypesForLanguage(settings, language, defaults = { document: true, syntax: true }) {
  const base = {
    standard: false,
    document: defaults?.document === true,
    syntax: defaults?.syntax === true
  };
  const overrides = settings?.completionWordTypesByLanguage;
  if (typeof language !== 'string' || !overrides || !Object.hasOwn(overrides, language)) return base;
  return {
    ...base,
    document: typeof overrides[language]?.document === 'boolean' ? overrides[language].document : base.document,
    syntax: typeof overrides[language]?.syntax === 'boolean' ? overrides[language].syntax : base.syntax
  };
}

/** Set or reset per-syntax word sources; the standard dictionary source is platform-only. */
export function setCompletionWordTypesOverride(overrides, language, value) {
  const next = normalizeLanguageCompletionWordTypeOverrides(overrides);
  if (typeof language !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(language)) return next;
  if (value === null) {
    delete next[language];
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    next[language] = { document: value.document === true, syntax: value.syntax === true };
  }
  return Object.fromEntries(Object.entries(next).slice(-200));
}

export function parseStoredSettings(raw) {
  try { return normalizeSettings(JSON.parse(typeof raw === 'string' ? raw : '{}')); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
