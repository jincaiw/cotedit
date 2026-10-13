import { minimalSetup, EditorView } from 'codemirror';
import { Decoration, lineNumbers, keymap, highlightActiveLineGutter, highlightActiveLine, rectangularSelection, crosshairCursor, ViewPlugin, WidgetType } from '@codemirror/view';
import { automaticSubstitutionsExtension } from '../lib/automatic-substitutions.js';
import { EditorState, EditorSelection, StateEffect, StateField, Compartment } from '@codemirror/state';
import { StreamLanguage, indentUnit, foldGutter, indentOnInput, bracketMatching, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { undo, redo, undoDepth, redoDepth, indentMore, indentLess, copyLineDown, deleteCharBackward, deleteLine, insertNewline, moveLineUp, moveLineDown, selectLine } from '@codemirror/commands';
import { blockCommentSelection, canUncommentToggleSelection as canUncommentToggleSelectionForState, commentOutSelection, lineCommentSelection, toggleCommentAtVisualIndent, uncommentSelection as uncommentSelectionCommand } from '../lib/comment-commands.js';
import { autocompletion, closeBrackets, startCompletion } from '@codemirror/autocomplete';
import { setSearchQuery, search } from '@codemirror/search';
import { collectSearchMatches, createSearchQuery, createSearchReplacementChanges, nextSearchMatchIndex, normalizeSearchLineEndings } from '../lib/search-tools.js';
import { collectVisibleSearchHighlights } from '../lib/search-highlights.js';
import { selectionInstanceHighlightExtension } from '../lib/selection-match-highlights.js';
import { pasteExactText } from '../lib/clipboard-commands.js';
import { parseUnicodeCodePoint, recordRecentUnicodeCodePoint } from '../lib/unicode-input.js';
import { COLOR_CODE_FORMATS, colorPickerHex, formatColorCode, parseColorCode, withColorAlpha } from '../lib/color-code.js';
import { editabilityExtensions } from '../lib/editability.js';
import { documentLineEndingExtensions, setDocumentLineEndings, setDocumentLineEndingFallback, synchronizeDocumentLineEndingMetadata } from '../lib/document-line-ending-history.js';
import { automaticTrailingWhitespaceExtension } from '../lib/auto-trim-trailing-whitespace.js';
import { invisibleCharacterPresentation, invisibleLineEndingPresentation } from '../lib/invisible-characters.js';
import { documentWritingDirection as resolveDocumentWritingDirection, normalizeDocumentWritingDirections, withDocumentWritingDirection } from '../lib/document-directions.js';
import { resolveCotEditorThemeStyles } from '../lib/cot-theme-colors.js';
import { MAX_CUSTOM_EDITOR_THEMES, normalizeCustomEditorThemes, upsertCustomEditorTheme, renameCustomEditorTheme, removeCustomEditorTheme } from '../lib/custom-editor-themes.js';
import { builtinThemeNames, isBuiltinThemeName, loadBuiltinTheme } from './builtin-themes.js';
import { textTransformationTransaction } from '../lib/text-transform-range.js';
import { documentWordCompletionSource } from '../lib/document-completions.js';
import { syntaxWordCompletionSource } from '../lib/completion-word-types.js';
import { urlLinkExtension as createUrlLinkExtension } from '../lib/url-links.js';
import { readLastWindowSize, rememberLastWindowSize, resolveWindowSize } from '../lib/window-size-preferences.js';
import { editorFontFamilyStack, normalizeEditorFontFamily } from '../lib/font-family.js';
import { adjacentOutlineItem, nearestOutlineItemAtOrBefore } from '../lib/outline-navigation.js';
import { applyShortcutOverrides, findShortcutConflict, formatShortcut, isShortcutCompositionEvent, matchesShortcut, removeDefaultShortcutOverrides, resolveShortcut, shortcutFromEvent } from '../lib/shortcuts.js';
import { filterQuickActions } from '../lib/quick-actions.js';
import { expandSnippetFormat, normalizeSnippets, snippetsForSyntax } from '../lib/snippets.js';
import { detectIndentStyle, effectiveAutoExpandTab, resolveTabInsertionMode } from '../lib/indent-style-detection.js';
import { applyTextReplacements, normalizeTextReplacements } from '../lib/text-replacements.js';
import { DEFAULT_FILE_DROP_RULES, MAX_FILE_DROP_FORMAT_BYTES, MAX_FILE_DROP_RULES, normalizeFileDropRules } from '../lib/file-drop-rules.js';
import { applyMultipleReplace, findMultipleReplaceMatches, MAX_MULTIPLE_REPLACE_DEFINITIONS, DEFAULT_MULTIPLE_REPLACE_OPTIONS, normalizeMultipleReplaceDefinitions } from '../lib/multiple-replace.js';
import { MAX_MULTIPLE_REPLACE_IMPORT_BYTES, parseCotEditorReplacementImport } from '../lib/multiple-replace-import.js';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { translateIcuRegex } from '../lib/icu-regexp.js';
import { delimitedSortKeyRange as getDelimitedSortKeyRange, regexSortKeyRange as getRegexSortKeyRange } from '../lib/pattern-sort-preview.js';
import { buildFolderPreviewAttributes } from '../lib/folder-preview-attributes.js';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { go } from '@codemirror/legacy-modes/mode/go';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { r } from '@codemirror/legacy-modes/mode/r';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { coffeeScript } from '@codemirror/legacy-modes/mode/coffeescript';
import { fortran } from '@codemirror/legacy-modes/mode/fortran';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { octave } from '@codemirror/legacy-modes/mode/octave';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { vhdl } from '@codemirror/legacy-modes/mode/vhdl';
import { vb } from '@codemirror/legacy-modes/mode/vb';
import { d } from '@codemirror/legacy-modes/mode/d';
import { factor } from '@codemirror/legacy-modes/mode/factor';
import { scheme } from '@codemirror/legacy-modes/mode/scheme';
import { pascal } from '@codemirror/legacy-modes/mode/pascal';
import { csharp, kotlin, scala, dart, objectiveC } from '@codemirror/legacy-modes/mode/clike';
import { fSharp, oCaml, sml } from '@codemirror/legacy-modes/mode/mllike';
import { cobol } from '@codemirror/legacy-modes/mode/cobol';
import { commonLisp } from '@codemirror/legacy-modes/mode/commonlisp';
import { crystal } from '@codemirror/legacy-modes/mode/crystal';
import { cypher } from '@codemirror/legacy-modes/mode/cypher';
import { eiffel } from '@codemirror/legacy-modes/mode/eiffel';
import { elm } from '@codemirror/legacy-modes/mode/elm';
import { gherkin } from '@codemirror/legacy-modes/mode/gherkin';
import { haxe } from '@codemirror/legacy-modes/mode/haxe';
import { liveScript } from '@codemirror/legacy-modes/mode/livescript';
import { sas } from '@codemirror/legacy-modes/mode/sas';
import { smalltalk } from '@codemirror/legacy-modes/mode/smalltalk';
import { sparql } from '@codemirror/legacy-modes/mode/sparql';
import { tcl } from '@codemirror/legacy-modes/mode/tcl';
import { webIDL } from '@codemirror/legacy-modes/mode/webidl';
import { xQuery } from '@codemirror/legacy-modes/mode/xquery';
import { turtle } from '@codemirror/legacy-modes/mode/turtle';
import { pug } from '@codemirror/legacy-modes/mode/pug';
import { vbScript } from '@codemirror/legacy-modes/mode/vbscript';
import { z80 } from '@codemirror/legacy-modes/mode/z80';
import { LANGUAGE_OPTIONS, languageForFilename, getTextStats, countCharacters, isDirty, selectRecoverableDrafts } from '../lib/document.js';
import { formatDocumentFileOwnerIds, formatDocumentFileSize, formatDocumentFileTimestamp, getDocumentInspectorCharacter, getDocumentInspectorStats, normalizeDocumentFileOwnerIds, normalizeDocumentFileTags } from '../lib/document-inspector.js';
import { findSyntaxMappingConflicts } from '../lib/syntax-mapping-conflicts.js';
import { getSingleGraphemeSelection, getSingleGraphemeSelectionInText, startsInsideRegionalIndicatorRun } from '../lib/character-selection.js';
import { countAdvancedCharacterStrings, getUnicodeScalarInfo } from '../lib/unicode-character-info.js';
import { ENCODING_OPTIONS, LINE_ENDING_TYPES, applyLineEndings, capitalizeWords, characterInfo, convertIndentation, convertRomanToFullWidth, convertRomanToHalfWidth, convertToFullWidth, convertToHalfWidth, decodeURLComponent, detectLineEnding, dominantLineEnding, encodeURLComponent, findEnclosingSymbolRange, getLineEndings, getOutline, lowercaseText, normalizeLineEndings, normalizeUnicode, replaceDoubleHyphensWithEmDash, replacePairedStraightQuotes, straightenCurlyQuotes, summarizeLineEndings, transformLineBlock, trailingWhitespaceChanges, uppercaseText } from '../lib/text-tools.js';
import SHORTCUTS from '../lib/shortcuts.json';
import { scrollVerticalSelectionIntoView, setEditorStatePreservingScroll, verticalColumnDecoration } from '../lib/editor-viewport.js';
import { createCotSyntaxMode, getCotSyntaxOutline, getCotSyntaxSupportSummary } from '../lib/cot-syntax-mode.js';
import { mergeImportedCotSyntaxes } from '../lib/cot-syntax-import.js';
import { compileCotSyntaxRegex } from '../lib/cot-syntax-regexp.js';
import { verticalTextPositionAtPoint } from '../lib/vertical-pointer.js';
import { verticalTextAdjacentPosition } from '../lib/vertical-navigation.js';
import { selectEnclosingPairAtDoubleClick } from '../lib/double-click-selection.js';
import { formatExternalApplicationLabel } from '../lib/external-application-label.js';
import { Prec } from '@codemirror/state';
import { autoCompletionEnabledForLanguage, automaticSymbolBalancingEnabledForLanguage, clearIndentOverride, completionWordTypesForLanguage, continuousSpellCheckingEnabledForLanguage, fontTypeForLanguage, setFontTypeOverride, setContinuousSpellCheckingOverride, DEFAULT_SETTINGS, normalizeKeyBindings, normalizeLineHeight, normalizeSettings, parseStoredSettings, setAutoCompletionOverride, setAutomaticSymbolBalancingOverride, setCompletionWordTypesOverride } from '../lib/settings.js';
import { defaultSyntaxFileExtension, normalizeDefaultSyntaxId, resolveDefaultSyntaxId } from '../lib/default-syntax.js';
import { deleteSoftTab, insertSoftTab } from '../lib/soft-tabs.js';
import { handleSelectedLinesTab } from '../lib/tab-selection-indent.js';
import { collapseMultipleInsertionPoints } from '../lib/multi-cursor.js';
import { hangingIndentLineStyle } from '../lib/hanging-indent.js';
import { calculateOverscrollPadding } from '../lib/overscroll.js';
import { DEFAULT_TOOLBAR_ITEM_ORDER, TOOLBAR_ITEMS } from '../lib/toolbar-items.js';
import packageMetadata from '../package.json';
import './style.css';

const $ = selector => document.querySelector(selector);
$('#app-version').textContent = packageMetadata.version;
const root = document.documentElement;
const lineEndingSummaryCache = new WeakMap();
const languageCompartment = new Compartment();
const lineNumberCompartment = new Compartment();
const wrapCompartment = new Compartment();
const overscrollCompartment = new Compartment();
const currentLineCompartment = new Compartment();
const bracketMatchingCompartment = new Compartment();
const selectionMatchCompartment = new Compartment();
const indentCompartment = new Compartment();
const autoIndentCompartment = new Compartment();
const symbolBalancingCompartment = new Compartment();
const spellCheckingCompartment = new Compartment();
const automaticSubstitutionsCompartment = new Compartment();
const completionCompartment = new Compartment();
const urlLinkCompartment = new Compartment();
const customThemeCompartment = new Compartment();
const displayCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const directionCompartment = new Compartment();
const windowId = new URLSearchParams(location.search).get('windowId') || 'main';
const localStorageKey = `cotedit.session.v1.${windowId}`;
const legacyLocalStorageKey = 'cotedit.session.v1';
const settingsKey = 'cotedit.settings.v1';
const cotEditorThemeKey = 'cotedit.cot-theme.v1';
const cotEditorThemesKey = 'cotedit.cot-themes.v1';
const editorThemeNameKey = 'cotedit.editor-theme-name.v1';
const DEFAULT_EDITOR_THEME_NAME = 'Anura';
const cotSyntaxKey = 'cotedit.cot-syntax.v1';
const legacyLanguages = { go, ruby, shell, swift, powershell: powerShell, toml, properties, clojure, haskell, groovy, lua, perl, r, diff, dockerfile: dockerFile, nginx, protobuf, cmake, coffeescript: coffeeScript, fortran, erlang, julia, octave, verilog, vhdl, vb, d, factor, scheme, pascal, csharp, kotlin, scala, dart, objectivec: objectiveC, fsharp: fSharp, ocaml: oCaml, sml, cobol, commonlisp: commonLisp, crystal, cypher, eiffel, elm, gherkin, haxe: haxe, livescript: liveScript, sas, smalltalk, sparql, tcl, webidl: webIDL, xquery: xQuery, turtle, pug, vbscript: vbScript, z80 };

let settings = loadSettings();
let lastShortcutBindingsSent = null;
let lastSnippetMenuSignature = null;
let lastMultipleReplaceMenuSignature = null;
let customEditorTheme = null;
let customEditorThemes = [];
let editorThemeName = '';
let customSyntaxes = [];
let syntaxMappingConflicts = { extensions: [], filenames: [], interpreters: [] };
let draftHiddenSyntaxes = null;
let toolbarCustomizationDraft = null;
let toolbarCustomizationReturnFocus = null;
let snippetManagerReturnFocus = null;
let selectedSnippetId = null;
let snippetDraftIsNew = false;
let snippetFormDirty = false;
let snippetDraftShortcut = null;
let recordingSnippetShortcut = false;
let textReplacementManagerReturnFocus = null;
let selectedTextReplacementId = null;
let textReplacementDraftIsNew = false;
let textReplacementFormDirty = false;
let fileDropManagerReturnFocus = null;
let fileDropDraftRules = null;
let selectedFileDropRuleId = null;
let fileDropDraftDirty = false;
let multipleReplaceManagerReturnFocus = null;
let selectedMultipleReplaceId = null;
let multipleReplaceDraft = null;
let multipleReplaceDraftIsNew = false;
let multipleReplaceDraftDirty = false;
let multipleReplaceDraftInSelection = false;
let documents = [];
let remoteEditingStatus = { enabled: false, port: 52698, listening: false, error: '' };
let remoteEditingReturnFocus = null;
let donationReturnFocus = null;
let customWidthMode = 'tab';
let customWidthReturnFocus = null;
let pendingRemoteDocuments = [];
const pendingRemoteDisconnects = new Set();
let recoveryDrafts = [];
let recoveryStartupPending = false;
let recoveryWriteTimer = null;
let pendingRecoveryWrite = Promise.resolve();
let recoveryQuotaWarningShown = false;
let recoveryReturnFocus = null;
let activeDoc = null;
let editorView = null;
let secondaryView = null;
let focusedView = null;
let newDocNumber = 1;
let toastTimer;
let warningsScanTimer;
let warningsScanId = 0;
let characterDetailsRenderId = 0;
let advancedCountTimer = null;
let advancedCountRequestId = 0;
let advancedCountReturnFocus = null;
let advancedCharacterCountActive = false;
let speechActive = false;
let speechRequestId = 0;
let fontPickerReturnFocus = null;
let colorCodeTarget = null;
let pageGuideFrame = 0;
let lastAppliedWindowSize = null;
let pendingWindowSizeForStorage = null;
let windowSizeStorageTimer = null;
const pageGuideScrollHandlers = new WeakMap();
const pageGuideMeasureContext = document.createElement('canvas').getContext('2d');
let searchOptions = { caseSensitive: false, regexp: false, wholeWord: false, diacriticInsensitive: settings.findIgnoresDiacritics };
let searchNavigation = null;
let findAllHighlightsActive = false;
let searchHighlightsSuppressed = false;
let directoryRoot = null;
let folderNavigationRoot = null;
let folderNavigationPath = null;
let folderNavigationParentPath = null;
let folderNavigationRequest = 0;
let folderNameFilterTimer = null;
let directorySearchRequest = 0;
let folderPreviewRequest = 0;
let folderPreviewPath = null;
let folderExternalApplicationRequest = 0;
let folderDocumentHistory = [];
let folderDocumentHistoryIndex = -1;
let splitEnabled = false;
let columnAnchor = null;
let programmaticColumnSelection = false;
const verticalPointerDrags = new WeakMap();

const customThemeTagMap = {
  keywords: tags.keyword,
  commands: tags.function(tags.variableName),
  types: tags.typeName,
  attributes: tags.attributeName,
  variables: tags.variableName,
  values: [tags.bool, tags.null, tags.atom],
  numbers: tags.number,
  strings: tags.string,
  characters: tags.character,
  comments: tags.comment
};

function normalizeStoredCotSyntax(value) {
  if (!value || value.format !== 'cotsyntax' || typeof value.id !== 'string' || !/^cot-syntax-[a-z0-9-]{1,56}$/.test(value.id)
      || typeof value.name !== 'string' || !Array.isArray(value.rules)) return null;
  const categories = new Set(Object.keys(customThemeTagMap));
  const clean = (text, maximum = 512) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : '';
  const cleanPattern = (text, maximum = 512) => typeof text === 'string' ? text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, maximum) : '';
  const list = (items, lower = false) => Array.isArray(items) ? items.slice(0, 256).map(item => clean(item, 128)).filter(Boolean).map(item => lower ? item.toLowerCase() : item) : [];
  const pairs = items => Array.isArray(items) ? items.slice(0, 256).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const begin = cleanPattern(item.begin);
    const end = cleanPattern(item.end);
    return begin && end ? [{ begin, end, escapeCharacter: clean(item.escapeCharacter, 4), isMultiline: item.isMultiline === true, isNestable: item.isNestable === true }] : [];
  }) : [];
  const rules = value.rules.slice(0, 2500).flatMap(rule => {
    if (!rule || !categories.has(rule.category)) return [];
    const begin = cleanPattern(rule.begin);
    const end = cleanPattern(rule.end);
    return begin ? [{
      category: rule.category, begin, end: end || null,
      regularExpression: rule.regularExpression === true || rule.isRegularExpression === true,
      ignoreCase: rule.ignoreCase === true, isMultiline: rule.isMultiline === true
    }] : [];
  });
  const outlineKinds = new Set(['container', 'value', 'function', 'title', 'heading', 'heading.1', 'heading.2', 'heading.3', 'heading.4', 'heading.5', 'heading.6', 'heading.7', 'mark', 'separator']);
  const outlines = Array.isArray(value.outlines) ? value.outlines.slice(0, 2500).flatMap(item => {
    const pattern = cleanPattern(item?.pattern);
    const kind = clean(item?.kind, 32);
    if (!pattern || (kind && !outlineKinds.has(kind))) return [];
    return [{ pattern, template: cleanPattern(item?.template), ignoreCase: item.ignoreCase === true, kind: kind || null }];
  }) : [];
  const indentationSource = Array.isArray(value.indentation?.blockDelimiters) ? value.indentation.blockDelimiters : [];
  const blockDelimiters = indentationSource.slice(0, 256).flatMap(item => {
    const begin = cleanPattern(item?.begin);
    if (!begin) return [];
    const end = cleanPattern(item?.end);
    return [{ begin, end: end || null, ignoreCase: item.ignoreCase === true }];
  });
  return {
    format: 'cotsyntax', id: value.id, name: clean(value.name, 96) || '导入语法', kind: value.kind === 'code' ? 'code' : 'general',
    extensions: list(value.extensions, true).filter(item => /^[a-z0-9_+-]+$/i.test(item)),
    filenames: list(value.filenames, true), interpreters: list(value.interpreters),
    completions: Array.isArray(value.completions) ? [...new Set(value.completions.slice(0, 2500).map(item => clean(item, 512)).filter(Boolean))] : [],
    comments: {
      inline: Array.isArray(value.comments?.inline) ? value.comments.inline.slice(0, 256).flatMap(item => {
        const begin = cleanPattern(item?.begin);
        return begin ? [{ begin, leadingOnly: item.leadingOnly === true }] : [];
      }) : [],
      blocks: pairs(value.comments?.blocks)
    },
    strings: pairs(value.strings), characters: pairs(value.characters), rules,
    outlines, indentation: { blockDelimiters },
    unsupported: value.unsupported && typeof value.unsupported === 'object' ? {
      highlightRules: Math.max(0, Math.min(2500, Number(value.unsupported.highlightRules) || 0)),
      outlineRules: Math.max(0, Math.min(2500, Number(value.unsupported.outlineRules) || 0)),
      indentationRules: Math.max(0, Math.min(256, Number(value.unsupported.indentationRules) || 0))
    } : { highlightRules: 0, outlineRules: 0, indentationRules: 0 }
  };
}

function loadCustomCotSyntaxes() {
  try {
    const value = JSON.parse(localStorage.getItem(cotSyntaxKey) || '[]');
    return Array.isArray(value) ? value.slice(-20).map(normalizeStoredCotSyntax).filter(Boolean) : [];
  } catch { return []; }
}

customSyntaxes = loadCustomCotSyntaxes();
refreshSyntaxMappingConflicts();

function languageForDocument(filename = '', content = '') {
  return languageForFilename(filename, customSyntaxes, content);
}
function languageForRemoteFileType(fileType, filename = '', content = '') {
  const value = String(fileType || '').trim().toLocaleLowerCase();
  if (value) {
    const options = [...LANGUAGE_OPTIONS, ...customSyntaxes.map(syntax => ({ id: syntax.id, label: syntax.name }))];
    const match = options.find(option => option.id.toLocaleLowerCase() === value || option.label.toLocaleLowerCase() === value);
    if (match) return match.id;
  }
  return languageForDocument(filename, content);
}
function updateCustomSyntaxMenu() {
  window.cotedit?.updateCustomSyntaxMenu(customSyntaxes.map(({ id, name }) => ({ id, label: name })));
}

function hasSyntaxMappingConflicts() {
  return Object.values(syntaxMappingConflicts).some(items => items.length > 0);
}

function refreshSyntaxMappingConflicts() {
  syntaxMappingConflicts = findSyntaxMappingConflicts(customSyntaxes, LANGUAGE_OPTIONS);
  const button = $('#syntax-mapping-conflicts-settings');
  if (button) button.disabled = !hasSyntaxMappingConflicts();
  return syntaxMappingConflicts;
}

function normalizeStoredCotTheme(value) {
  if (!value || typeof value !== 'object' || value.format !== 'cottheme' || typeof value.name !== 'string' || !value.styles || typeof value.styles !== 'object') return null;
  const styleKeys = new Set([...Object.keys(customThemeTagMap), 'text', 'background', 'selection', 'lineHighlight', 'invisibles', 'insertionPoint', 'highlight']);
  const styles = {};
  for (const [key, color] of Object.entries(value.styles)) {
    if (Object.hasOwn(customThemeTagMap, key) || ['text', 'background', 'selection', 'lineHighlight', 'invisibles', 'insertionPoint', 'highlight'].includes(key)) {
      if (typeof color === 'string' && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color)) styles[key] = color.toLowerCase();
    }
  }
  if (!styles.text || !styles.background) return null;
  const metadataSource = value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata) ? value.metadata : {};
  const cleanMetadataText = (text, maximum) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : undefined;
  const metadata = {
    author: cleanMetadataText(metadataSource.author, 160), description: cleanMetadataText(metadataSource.description, 500),
    license: cleanMetadataText(metadataSource.license, 240), distributionURL: cleanMetadataText(metadataSource.distributionURL, 500)
  };
  const systemSettings = Array.isArray(value.systemSettings) ? [...new Set(value.systemSettings.filter(key => ['selection', 'insertionPoint', 'highlight'].includes(key)))] : [];
  return { format: 'cottheme', name: value.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100) || '导入主题', styles, metadata, systemSettings };
}

function loadCustomEditorTheme() {
  try { return normalizeStoredCotTheme(JSON.parse(localStorage.getItem(cotEditorThemeKey) || 'null')); }
  catch { return null; }
}

function loadEditorThemeName() {
  try { return localStorage.getItem(editorThemeNameKey) || ''; } catch { return ''; }
}

function loadCustomEditorThemes() {
  try {
    const value = JSON.parse(localStorage.getItem(cotEditorThemesKey) || '[]');
    return normalizeCustomEditorThemes(value, normalizeStoredCotTheme, builtinThemeNames());
  } catch { return []; }
}

function persistCustomEditorThemes() {
  try { localStorage.setItem(cotEditorThemesKey, JSON.stringify(customEditorThemes)); }
  catch { showToast('自定义主题无法保存到本机设置。'); }
}

function applyCustomEditorTheme(name) {
  const theme = customEditorThemes.find(item => item.name === name);
  if (!theme) return false;
  customEditorTheme = normalizeStoredCotTheme(theme);
  if (!customEditorTheme) return false;
  editorThemeName = customEditorTheme.name;
  try {
    localStorage.setItem(cotEditorThemeKey, JSON.stringify(customEditorTheme));
    localStorage.setItem(editorThemeNameKey, editorThemeName);
  } catch { /* storage may be unavailable */ }
  return true;
}

const COT_THEME_BASE_KEYS = ['text', 'background', 'selection', 'lineHighlight', 'invisibles', 'insertionPoint', 'highlight'];
const COT_THEME_COLOR_LABELS = {
  text: '正文', background: '背景', selection: '选区', lineHighlight: '当前行', invisibles: '不可见字符',
  insertionPoint: '插入点', highlight: '搜索高亮', keywords: '关键字', commands: '命令', types: '类型',
  attributes: '属性', variables: '变量', values: '值', numbers: '数字', strings: '字符串', characters: '字符', comments: '注释'
};
const COT_THEME_SYSTEM_COLOR_ROLES = ['selection', 'insertionPoint', 'highlight'];
const COT_THEME_COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i;

/** Normalizes a raw .cottheme JSON document (bundled or imported) for the renderer. */
function normalizeRawCotTheme(value, fallbackName = '导入主题') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const styles = {};
  for (const key of [...Object.keys(customThemeTagMap), ...COT_THEME_BASE_KEYS]) {
    const color = value[key]?.color;
    if (typeof color === 'string' && COT_THEME_COLOR_PATTERN.test(color)) styles[key] = color.toLowerCase();
  }
  if (!styles.text || !styles.background) return null;
  const metadataSource = value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata) ? value.metadata : {};
  const cleanMetadataText = (text, maximum) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : undefined;
  const metadata = {
    author: cleanMetadataText(metadataSource.author, 160), description: cleanMetadataText(metadataSource.description, 500),
    license: cleanMetadataText(metadataSource.license, 240), distributionURL: cleanMetadataText(metadataSource.distributionURL, 500)
  };
  const systemSettings = [...new Set(Object.keys(value).filter(key => ['selection', 'insertionPoint', 'highlight'].includes(key) && value[key]?.usesSystemSetting === true))];
  const rawName = typeof value.name === 'string' ? value.name : '';
  return { format: 'cottheme', name: rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || fallbackName, styles, metadata, systemSettings };
}

function prefersDarkEditorAppearance(appearance) {
  if (appearance === 'dark' || appearance === 'light') return appearance === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies a bundled theme by name, mirroring CotEditor's built-in theme settings. */
function applyBuiltinEditorTheme(name) {
  const parsed = loadBuiltinTheme(name);
  if (!parsed) return false;
  const normalized = normalizeRawCotTheme(parsed, name);
  if (!normalized) return false;
  customEditorTheme = normalized;
  editorThemeName = name;
  try {
    localStorage.setItem(cotEditorThemeKey, JSON.stringify(normalized));
    localStorage.setItem(editorThemeNameKey, name);
  } catch { /* storage may be unavailable */ }
  return true;
}

/**
 * Resolves the theme name for the current appearance the way CotEditor does:
 * built-in light/dark pairs switch with the appearance, and custom themes
 * stay as-is.
 */
function resolveEditorThemeNameForAppearance(name, appearance) {
  if (!isBuiltinThemeName(name)) return name;
  const base = name.replace(/ \((Dark|Light)\)$/, '');
  const paired = `${base} ${prefersDarkEditorAppearance(appearance) ? '(Dark)' : '(Light)'}`;
  if (isBuiltinThemeName(paired)) return paired;
  if (isBuiltinThemeName(base)) return base;
  return name;
}

function currentEditorThemeName() {
  return editorThemeName || customEditorTheme?.name || DEFAULT_EDITOR_THEME_NAME;
}

/** Keeps the stored editor theme in sync with the appearance on boot and on appearance changes. */
function syncEditorThemeForAppearance(appearance) {
  const storedName = loadEditorThemeName();
  const effective = resolveEditorThemeNameForAppearance(storedName || DEFAULT_EDITOR_THEME_NAME, appearance);
  if (effective === storedName && customEditorTheme) return;
  applyBuiltinEditorTheme(effective);
}

/** Mirrors CotEditor's bundled theme list in the Appearance settings. */
function syncBuiltinThemeSelect() {
  const select = $('#builtin-theme-select');
  if (!select) return;
  const current = currentEditorThemeName();
  const customOptions = customEditorThemes.map(theme => `<option value="custom:${escapeHtml(theme.name)}">自定义：${escapeHtml(theme.name)}</option>`).join('');
  select.innerHTML = builtinThemeNames().map(name => `<option value="builtin:${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('') + customOptions;
  select.value = customEditorThemes.some(theme => theme.name === current) ? `custom:${current}` : `builtin:${current}`;
}

function syncCustomThemeEditor() {
  const active = customEditorThemes.find(theme => theme.name === currentEditorThemeName());
  const controls = $('#custom-theme-controls');
  const colorEditor = $('#custom-theme-colors');
  if (!controls || !colorEditor) return;
  controls.hidden = !active;
  colorEditor.replaceChildren();
  if (!active) return;
  $('#custom-theme-name').value = active.name;
  for (const [key, label] of Object.entries(COT_THEME_COLOR_LABELS)) {
    const color = active.styles[key];
    if (!color) continue;
    const row = document.createElement('label');
    row.className = 'custom-theme-color-row';
    const name = document.createElement('span');
    name.textContent = label;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = color.slice(0, 7);
    picker.dataset.themeStyle = key;
    picker.setAttribute('aria-label', `${label}颜色`);
    row.append(name, picker);
    if (COT_THEME_SYSTEM_COLOR_ROLES.includes(key)) {
      const system = document.createElement('span');
      system.className = 'custom-theme-system-color';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = active.systemSettings.includes(key);
      checkbox.dataset.themeSystemRole = key;
      checkbox.setAttribute('aria-label', `${label}跟随系统颜色`);
      system.append(checkbox, document.createTextNode('跟随系统'));
      row.append(system);
    }
    colorEditor.append(row);
  }
}

function customThemeExtension() {
  if (!customEditorTheme) return [];
  const styles = Object.entries(customThemeTagMap)
    .filter(([key]) => customEditorTheme.styles[key])
    .map(([key, tag]) => ({ tag, color: customEditorTheme.styles[key] }));
  return styles.length ? syntaxHighlighting(HighlightStyle.define(styles)) : [];
}

customEditorTheme = loadCustomEditorTheme();
editorThemeName = loadEditorThemeName();
customEditorThemes = loadCustomEditorThemes();
if (customEditorTheme && !isBuiltinThemeName(editorThemeName || customEditorTheme.name)) {
  try {
    customEditorThemes = upsertCustomEditorTheme(customEditorThemes, customEditorTheme, normalizeStoredCotTheme, builtinThemeNames());
    persistCustomEditorThemes();
  } catch { /* keep a legacy active custom theme usable even when migration cannot be stored */ }
}
if (!customEditorTheme) applyBuiltinEditorTheme(resolveEditorThemeNameForAppearance(DEFAULT_EDITOR_THEME_NAME));
else if (customEditorThemes.some(theme => theme.name === (editorThemeName || customEditorTheme.name))) {
  applyCustomEditorTheme(editorThemeName || customEditorTheme.name);
}

window.addEventListener('storage', event => {
  if (event.key === settingsKey) {
    const previousDiacriticPreference = settings.findIgnoresDiacritics;
    settings = normalizeAppSettings(event.newValue);
    applySettings();
    if (previousDiacriticPreference !== settings.findIgnoresDiacritics) {
      searchOptions.diacriticInsensitive = settings.findIgnoresDiacritics;
      syncDiacriticSearchButton();
      applySearch(false);
    }
    syncMenuState();
  } else if (event.key === cotEditorThemeKey) {
    try { customEditorTheme = normalizeStoredCotTheme(JSON.parse(event.newValue || 'null')); }
    catch { customEditorTheme = null; }
    applySettings();
  } else if (event.key === cotEditorThemesKey) {
    customEditorThemes = loadCustomEditorThemes();
    const activeName = currentEditorThemeName();
    if (customEditorThemes.some(theme => theme.name === activeName)) applyCustomEditorTheme(activeName);
    else if (!isBuiltinThemeName(activeName)) {
      customEditorTheme = null;
      applyBuiltinEditorTheme(resolveEditorThemeNameForAppearance(DEFAULT_EDITOR_THEME_NAME, settings.theme === 'system' ? undefined : settings.theme));
    }
    applySettings();
  } else if (event.key === editorThemeNameKey) {
    editorThemeName = event.newValue || '';
    applySettings();
  } else if (event.key === cotSyntaxKey) {
    customSyntaxes = loadCustomCotSyntaxes();
    refreshSyntaxMappingConflicts();
    populateLanguageMenu();
    populateDefaultSyntaxOptions();
    updateCustomSyntaxMenu();
    syncMenuState();
  }
});

function loadSettings() {
  return normalizeAppSettings(localStorage.getItem(settingsKey));
}

function normalizeAppSettings(value) {
  const normalized = value && typeof value === 'object' && !Array.isArray(value) ? normalizeSettings(value) : parseStoredSettings(value);
  normalized.keyBindings = removeDefaultShortcutOverrides(SHORTCUTS, normalized.keyBindings);
  return normalized;
}

function syncShortcutBindings() {
  if (typeof window.cotedit?.setShortcutBindings !== 'function') return;
  const bindings = normalizeSettings(settings).keyBindings;
  const serialized = JSON.stringify(bindings);
  if (serialized === lastShortcutBindingsSent) return;
  lastShortcutBindingsSent = serialized;
  window.cotedit.setShortcutBindings(bindings);
}

function persistSettings() {
  settings = normalizeAppSettings(settings);
  try { localStorage.setItem(settingsKey, JSON.stringify(settings)); }
  catch { showToast('无法保存设置；当前窗口仍会沿用本次设置。'); }
  syncShortcutBindings();
  syncMultipleReplaceMenu();
}

const documentWritingDirectionsKey = 'cotedit.document-writing-directions.v1';

function readDocumentWritingDirections() {
  try { return normalizeDocumentWritingDirections(JSON.parse(localStorage.getItem(documentWritingDirectionsKey) || 'null')); }
  catch { return {}; }
}

function rememberDocumentWritingDirection(filePath, direction) {
  if (!filePath) return;
  const next = withDocumentWritingDirection(readDocumentWritingDirections(), filePath, direction);
  try { localStorage.setItem(documentWritingDirectionsKey, JSON.stringify(next)); }
  catch { showToast('无法保存该文稿的书写方向偏好。'); }
}

function defaultDocumentWritingDirection(filePath) {
  return resolveDocumentWritingDirection(readDocumentWritingDirections(), filePath, settings.writingDirection || 'ltr');
}

function restoreSession() {
  try {
    const stored = localStorage.getItem(localStorageKey) ?? (windowId === 'main' ? localStorage.getItem(legacyLocalStorageKey) : null);
    const data = JSON.parse(stored || 'null');
    return selectRecoverableDrafts(data).map(item => ({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(), name: String(item.name || '恢复文稿.txt').slice(0, 160),
      path: null, text: item.text, savedText: item.savedText ?? '', language: item.language || languageForDocument(item.name || '恢复文稿.txt', item.text),
      encoding: item.encoding || 'utf8', savedEncoding: item.savedEncoding || item.encoding || 'utf8',
      eol: item.eol || detectLineEnding(item.text), savedEol: item.savedEol || item.eol || detectLineEnding(item.text),
      lineEndings: item.lineEndings || getLineEndings(item.text), savedLineEndings: item.savedLineEndings || item.lineEndings || getLineEndings(item.text),
      bom: item.bom === true, savedBom: item.savedBom ?? item.bom ?? false,
      preventEditing: item.preventEditing === true,
      writingDirection: item.writingDirection === 'rtl' ? 'rtl' : (settings.writingDirection || 'ltr'),
      editorState: null, restored: true
    }));
  } catch { return []; }
}

function collectLegacyRecoverySessions() {
  const sessions = [];
  const keys = [];
  let invalidCount = 0;
  let localKeys = [];
  try { localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean); }
  catch { return { sessions, keys, invalidCount: 1 }; }
  for (const key of localKeys.filter(item => item === legacyLocalStorageKey || item.startsWith('cotedit.session.v1.'))) {
    let data;
    try { data = JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { invalidCount++; continue; }
    if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || typeof item.text !== 'string')) {
      if (data !== null) invalidCount++;
      continue;
    }
    const recovered = selectRecoverableDrafts(data);
    const storedWindowId = key === legacyLocalStorageKey ? 'main' : key.slice('cotedit.session.v1.'.length);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(storedWindowId)) { invalidCount++; continue; }
    sessions.push({ windowId: storedWindowId, drafts: recovered });
    keys.push(key);
  }
  return { sessions, keys, invalidCount };
}

async function loadStartupRecovery() {
  if (!window.cotedit?.isDesktop || !window.cotedit.listRecoveryDrafts) {
    return { drafts: [], fallbackDocuments: restoreSession() };
  }
  try {
    const legacy = collectLegacyRecoverySessions();
    if (legacy.sessions.length) {
      await window.cotedit.importLegacyRecoveryDrafts(legacy.sessions);
      const verified = await window.cotedit.listRecoveryDrafts();
      for (const key of legacy.keys) localStorage.removeItem(key);
      if (legacy.invalidCount) showToast('部分旧恢复数据无法迁移；原有本地数据已保留。');
      return { drafts: verified, fallbackDocuments: [] };
    }
    if (legacy.invalidCount) showToast('旧恢复数据无法读取；原有本地数据已保留。');
    return { drafts: await window.cotedit.listRecoveryDrafts(), fallbackDocuments: [] };
  } catch (error) {
    showToast(`恢复库未能载入；原有草稿保持不变。${error.message ? ` ${error.message}` : ''}`);
    return { drafts: [], fallbackDocuments: restoreSession() };
  }
}

function recoverySnapshot() {
  return documents.filter(doc => isDirty(doc)).map(({ id, name, text, savedText, language, encoding, savedEncoding, eol, savedEol, lineEndings, savedLineEndings, bom, savedBom, preventEditing, writingDirection }) => ({
    id, name, text, savedText, language, encoding, savedEncoding, eol, savedEol,
    lineEndings, savedLineEndings, bom, savedBom, preventEditing, writingDirection
  }));
}

function persistSession({ immediate = false } = {}) {
  const recovery = recoverySnapshot();
  if (!window.cotedit?.isDesktop || !window.cotedit.saveRecoveryDrafts) {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(recovery.map(({ id, ...draft }) => draft).slice(0, 20)));
      return Promise.resolve(true);
    } catch {
      showToast('恢复草稿空间不足，当前文稿仍可正常编辑。');
      return Promise.resolve(false);
    }
  }
  clearTimeout(recoveryWriteTimer);
  const flush = () => {
    const request = pendingRecoveryWrite.catch(() => {}).then(() => window.cotedit.saveRecoveryDrafts(recovery));
    pendingRecoveryWrite = request.catch(() => {});
    return request.then(drafts => {
      recoveryDrafts = Array.isArray(drafts) ? drafts : recoveryDrafts;
      recoveryQuotaWarningShown = false;
      syncMenuState();
      if ($('#recovery-dialog')?.open) renderRecoveryDialog();
      return true;
    }).catch(error => {
      if (!recoveryQuotaWarningShown) {
        recoveryQuotaWarningShown = true;
        showToast(`恢复草稿未能保存，未删除旧草稿：${error.message || '请在恢复管理器中检查空间'}`);
      }
      return false;
    });
  };
  if (immediate) return flush();
  return new Promise(resolve => {
    recoveryWriteTimer = setTimeout(() => { recoveryWriteTimer = null; void flush().then(resolve); }, 1000);
  });
}

function languageExtension(id, filename = '') {
  const mode = id || languageForDocument(filename);
  const customSyntax = customSyntaxes.find(syntax => syntax.id === mode);
  if (customSyntax) return createCotSyntaxMode(customSyntax);
  if (legacyLanguages[mode]) return StreamLanguage.define(legacyLanguages[mode]);
  switch (mode) {
    case 'javascript': return javascript();
    case 'typescript': return javascript({ typescript: true });
    case 'jsx': return javascript({ jsx: true });
    case 'json': return json();
    case 'html': return html();
    case 'css': return css();
    case 'markdown': return markdown();
    case 'python': return python();
    case 'java': return java();
    case 'cpp': return cpp();
    case 'rust': return rust();
    case 'php': return php();
    case 'sql': return sql();
    case 'xml': return xml();
    case 'yaml': return yaml();
    default: return [];
  }
}

function numberExtension(enabled = settings.showLineNumbers) {
  if (!enabled) return [];
  return [lineNumbers(), highlightActiveLineGutter()];
}

function indentationFor(doc = activeDoc) {
  return (doc?.language && settings.indentByLanguage?.[doc.language]) || settings.indent;
}

function useGlobalIndentForActiveLanguage() {
  const language = activeDoc?.language;
  if (!language || !Object.prototype.hasOwnProperty.call(settings.indentByLanguage, language)) return false;
  settings.indentByLanguage = clearIndentOverride(settings.indentByLanguage, language);
  persistSettings();
  applySettings();
  return true;
}

function tabInsertionMode(doc = activeDoc) {
  return resolveTabInsertionMode(doc?.detectedIndentStyle, settings.autoExpandTab, indentationFor(doc));
}

function indentExtensions(doc = activeDoc) {
  const indentation = indentationFor(doc);
  const indentWidth = indentation === 'tab' ? settings.tabWidth : Number(indentation) || settings.tabWidth;
  return [indentUnit.of(indentation === 'tab' ? '\t' : ' '.repeat(indentWidth)), EditorState.tabSize.of(settings.tabWidth)];
}

class InvisibleCharacterWidget extends WidgetType {
  constructor(character, width, category, guide = false, title = '') { super(); this.character = character; this.width = width; this.category = category; this.guide = guide; this.title = title; }
  eq(other) { return this.character === other.character && this.width === other.width && this.category === other.category && this.guide === other.guide && this.title === other.title; }
  toDOM() {
    const element = document.createElement('span');
    element.className = `cm-invisible-character ${this.category}${this.guide ? ' cm-indent-guide' : ''}`;
    element.style.width = `${this.width}ch`;
    element.textContent = this.character;
    if (this.title) element.title = this.title;
    element.setAttribute('aria-hidden', 'true');
    return element;
  }
  ignoreEvent() { return true; }
}

function verticalColumnStep(view) {
  const line = view.contentDOM.querySelector('.cm-line');
  const style = getComputedStyle(line || view.contentDOM);
  const number = key => parseFloat(style[key]) || 0;
  const fontSize = number('fontSize') || 12;
  const lineHeight = parseFloat(style.lineHeight) || fontSize * settings.lineHeight;
  return Math.max(1, lineHeight + number('paddingLeft') + number('paddingRight') + number('marginLeft') + number('marginRight'));
}

function displayDecorations(view) {
  const columnStep = settings.verticalText ? verticalColumnStep(view) : 0;
  const hangingIndentActive = settings.enablesHangingIndent && settings.wrap && !settings.verticalText;
  if (!settings.showInvisibles && !settings.showIndentGuides && !settings.verticalText && !hangingIndentActive) return Decoration.none;
  const ranges = [];
  const doc = view.state.doc;
  const indentation = indentationFor();
  const tabSize = settings.tabWidth;
  const guideSize = indentation === 'tab' ? settings.tabWidth : Number(indentation) || settings.tabWidth;
  let hangingIndentMetrics = null;
  if (hangingIndentActive && pageGuideMeasureContext) {
    const contentStyle = getComputedStyle(view.contentDOM);
    pageGuideMeasureContext.font = contentStyle.font;
    const measuredSpace = pageGuideMeasureContext.measureText(' ').width;
    const letterSpacing = Number.parseFloat(contentStyle.letterSpacing) || 0;
    const spaceWidth = measuredSpace + letterSpacing;
    if (spaceWidth > 0) {
      hangingIndentMetrics = {
        tabWidth: tabSize,
        hangingIndentWidth: settings.hangingIndentWidth,
        spaceWidth,
        contentWidth: view.contentDOM.clientWidth || Infinity,
        direction: view.contentDOM.getAttribute('dir') || 'ltr'
      };
    }
  }
  const seenLines = new Set();
  for (const visible of view.visibleRanges) {
    const first = doc.lineAt(visible.from).number;
    const last = doc.lineAt(visible.to).number;
    for (let number = first; number <= last; number++) {
      if (seenLines.has(number)) continue;
      seenLines.add(number);
      const line = doc.line(number);
      if (settings.verticalText) ranges.push(verticalColumnDecoration(line, columnStep, view.lineBlockAt(line.from).top));
      if (hangingIndentMetrics) {
        const style = hangingIndentLineStyle(line.text, hangingIndentMetrics);
        if (style) ranges.push(Decoration.line({ attributes: { style, 'data-hanging-indent': 'true' } }).range(line.from));
      }
      const guideBoundaries = new Set();
      if (settings.showIndentGuides) {
        let column = 0;
        for (let index = 0; index < line.text.length; index++) {
          const character = line.text[index];
          if (character !== ' ' && character !== '\t') break;
          column += character === '\t' ? tabSize - (column % tabSize) : 1;
          if (column % guideSize === 0) guideBoundaries.add(line.from + index + 1);
        }
      }
      if (settings.showInvisibles) {
        const lineEnding = invisibleLineEndingPresentation(settings);
        if (lineEnding && line.to < doc.length && line.to >= visible.from && line.to <= visible.to) {
          ranges.push(Decoration.widget({ widget: new InvisibleCharacterWidget(lineEnding.glyph, lineEnding.width, lineEnding.category), side: -1 }).range(line.to));
        }
        let column = 0;
        const from = Math.max(line.from, visible.from);
        const to = Math.min(line.to, visible.to);
        for (let position = line.from; position < to;) {
          const codePoint = line.text.codePointAt(position - line.from);
          const sourceLength = codePoint > 0xffff ? 2 : 1;
          const presentation = invisibleCharacterPresentation(codePoint, settings);
          const width = codePoint === 0x0009 ? tabSize - (column % tabSize) : presentation?.width ?? (sourceLength === 2 ? 2 : 1);
          if (position >= from && presentation) {
            ranges.push(Decoration.replace({ widget: new InvisibleCharacterWidget(presentation.glyph, width, presentation.category, guideBoundaries.has(position + sourceLength), presentation.title) }).range(position, position + sourceLength));
          }
          column += width;
          position += sourceLength;
        }
      } else if (settings.showIndentGuides) {
        let column = 0;
        let chunkStart = line.from;
        for (let index = 0; index < line.text.length; index++) {
          const character = line.text[index];
          if (character !== ' ' && character !== '\t') break;
          column += character === '\t' ? tabSize - (column % tabSize) : 1;
          if (column % guideSize === 0) {
            ranges.push(Decoration.mark({ class: 'cm-indent-guide' }).range(chunkStart, line.from + index + 1));
            chunkStart = line.from + index + 1;
          }
        }
      }
    }
  }
  if (settings.verticalText) {
    const activeLine = doc.lineAt(view.state.selection.main.head);
    if (!seenLines.has(activeLine.number)) ranges.push(verticalColumnDecoration(activeLine, columnStep, view.lineBlockAt(activeLine.from).top));
  }
  return ranges.length ? Decoration.set(ranges, true) : Decoration.none;
}

function displayExtensions() {
  if (!settings.showInvisibles && !settings.showIndentGuides && !settings.verticalText && !(settings.enablesHangingIndent && settings.wrap)) return [];
  return [ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = displayDecorations(view); }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.geometryChanged || update.selectionSet) this.decorations = displayDecorations(update.view);
    }
  }, { decorations: value => value.decorations })];
}

const verticalPointerSelection = EditorView.domEventHandlers({
  pointerdown(event, view) {
    if (!settings.verticalText || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey) return false;
    const position = verticalTextPositionAtPoint(view, event.clientX, event.clientY);
    if (position == null) return false;
    let selection = EditorSelection.cursor(position);
    let anchor = position;
    let fixedEnd = null;
    if (event.detail >= 3) {
      const line = view.state.doc.lineAt(position);
      selection = EditorSelection.range(line.from, line.to);
      anchor = line.from;
      fixedEnd = line.to;
    } else if (event.detail === 2) {
      const word = view.state.wordAt(position);
      if (word && word.from < word.to) {
        selection = EditorSelection.range(word.from, word.to);
        anchor = word.from;
        fixedEnd = word.to;
      }
    } else if (event.shiftKey) {
      anchor = view.state.selection.main.anchor;
      selection = EditorSelection.range(anchor, position);
    }
    verticalPointerDrags.set(view, { anchor, fixedEnd, pointerId: event.pointerId });
    view.dispatch({ selection });
    view.focus();
    try { view.contentDOM.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
    return true;
  },
  pointermove(event, view) {
    const drag = verticalPointerDrags.get(view);
    if (!settings.verticalText || !drag || drag.pointerId !== event.pointerId) return false;
    const position = verticalTextPositionAtPoint(view, event.clientX, event.clientY);
    if (position != null) {
      let anchor = drag.anchor;
      let head = position;
      if (drag.fixedEnd != null) {
        if (position < drag.anchor) { anchor = position; head = drag.fixedEnd; }
        else if (position <= drag.fixedEnd) head = drag.fixedEnd;
      }
      view.dispatch({ selection: EditorSelection.range(anchor, head) });
    }
    event.preventDefault();
    return true;
  },
  pointerup(event, view) {
    const drag = verticalPointerDrags.get(view);
    if (!drag || drag.pointerId !== event.pointerId) return false;
    verticalPointerDrags.delete(view);
    try { view.contentDOM.releasePointerCapture(event.pointerId); } catch {}
    event.preventDefault();
    return true;
  },
  pointercancel(event, view) {
    const drag = verticalPointerDrags.get(view);
    if (!drag || drag.pointerId !== event.pointerId) return false;
    verticalPointerDrags.delete(view);
    try { view.contentDOM.releasePointerCapture(event.pointerId); } catch {}
    return true;
  }
});

const pairedDoubleClickSelection = EditorView.domEventHandlers({
  dblclick(event, view) {
    const position = settings.verticalText
      ? verticalTextPositionAtPoint(view, event.clientX, event.clientY)
      : view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
    return selectEnclosingPairAtDoubleClick(view, position, event);
  }
});

function moveVerticalTextSelection(view, direction, extend) {
  const current = view.state.selection;
  const ranges = current.ranges.map(range => {
    const position = verticalTextAdjacentPosition(view.state.doc, range.head, direction);
    return extend ? EditorSelection.range(range.anchor, position) : EditorSelection.cursor(position);
  });
  view.dispatch({ selection: EditorSelection.create(ranges, current.mainIndex), scrollIntoView: true });
  return true;
}

const verticalTextNavigation = Prec.highest(keymap.of([
  { key: 'ArrowUp', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'up', false) : false },
  { key: 'ArrowDown', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'down', false) : false },
  { key: 'ArrowLeft', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'left', false) : false },
  { key: 'ArrowRight', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'right', false) : false },
  { key: 'Shift-ArrowUp', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'up', true) : false },
  { key: 'Shift-ArrowDown', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'down', true) : false },
  { key: 'Shift-ArrowLeft', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'left', true) : false },
  { key: 'Shift-ArrowRight', run: view => settings.verticalText ? moveVerticalTextSelection(view, 'right', true) : false }
]));

const verticalTextScrollHandler = EditorView.scrollHandler.of((view, range, options) => {
  if (!settings.verticalText) return false;
  scrollVerticalSelectionIntoView(view, range, { ...options, verticalWritingMode: true });
  return false;
});

const verticalColumnViewport = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.columnStep = 0;
    this.documentWidth = 0;
    this.lineWidth = 0;
    this.lastScrollLeft = view.scrollDOM.scrollLeft;
    this.frame = 0;
    this.wasVertical = false;
    this.onScroll = () => {
      if (!settings.verticalText) return;
      const scroller = view.scrollDOM;
      if (scroller.scrollLeft === this.lastScrollLeft) return;
      this.lastScrollLeft = scroller.scrollLeft;
      this.scheduleHorizontalViewport();
    };
    view.scrollDOM.addEventListener('scroll', this.onScroll, { passive: true });
    this.updateLayout(view);
    if (this.wasVertical) this.scheduleSelectionAlignment();
  }

  update(update) {
    const wasVertical = this.wasVertical;
    this.updateLayout(update.view);
    if ((!wasVertical && settings.verticalText) || (update.docChanged && settings.verticalText)) {
      this.scheduleSelectionAlignment();
    }
  }

  updateLayout(view) {
    const content = view.contentDOM;
    const scroller = view.scrollDOM;
    if (!settings.verticalText) {
      if (this.wasVertical) {
        content.style.position = '';
        content.style.minWidth = '';
        content.style.transform = '';
      }
      this.wasVertical = false;
      this.lastScrollLeft = scroller.scrollLeft;
      return;
    }

    this.columnStep = verticalColumnStep(view);
    const contentStyle = getComputedStyle(content);
    const padding = (parseFloat(contentStyle.paddingLeft) || 0) + (parseFloat(contentStyle.paddingRight) || 0);
    this.documentWidth = Math.max(scroller.clientWidth, view.state.doc.lines * this.columnStep + padding);
    content.style.position = 'relative';
    content.style.minWidth = `${this.documentWidth}px`;
    const line = content.querySelector('.cm-line');
    this.lineWidth = line?.getBoundingClientRect().width || this.columnStep;
    this.wasVertical = true;
  }

  scheduleSelectionAlignment() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const view = this.view;
      if (!settings.verticalText || !this.columnStep) return;
      this.updateLayout(view);
      const lineNumber = view.state.doc.lineAt(view.state.selection.main.head).number;
      const maxScroll = Math.max(0, view.scrollDOM.scrollWidth - view.scrollDOM.clientWidth);
      const lineCenter = this.documentWidth - (lineNumber - 1) * this.columnStep - this.lineWidth / 2;
      view.scrollDOM.scrollLeft = Math.max(0, Math.min(maxScroll, lineCenter - view.scrollDOM.clientWidth / 2));
      this.lastScrollLeft = view.scrollDOM.scrollLeft;
    });
  }

  scheduleHorizontalViewport() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const view = this.view;
      if (!settings.verticalText || !this.columnStep) return;
      const center = view.scrollDOM.scrollLeft + view.scrollDOM.clientWidth / 2;
      const fromRight = this.documentWidth - center - this.lineWidth / 2;
      const number = Math.max(1, Math.min(view.state.doc.lines, Math.round(fromRight / this.columnStep) + 1));
      const line = view.state.doc.line(number);
      const rendered = view.visibleRanges.some(range => line.from >= range.from && line.from <= range.to);
      if (!rendered) {
        const block = view.lineBlockAt(line.from);
        const targetTop = block.top - Math.max(0, (view.scrollDOM.clientHeight - block.height) / 2);
        view.scrollDOM.scrollTop = Math.max(0, Math.min(view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight, targetTop));
      }
    });
  }

  destroy() {
    this.view.scrollDOM.removeEventListener('scroll', this.onScroll);
    if (this.frame) cancelAnimationFrame(this.frame);
  }
});

function lineWrappingExtension() {
  return settings.wrap && !settings.verticalText ? EditorView.lineWrapping : [];
}
function overscrollExtension() {
  const rate = settings.overscrollRate;
  if (rate <= 0 || settings.verticalText) return [];
  const plugin = ViewPlugin.fromClass(class {
    constructor() {
      this.padding = -1;
      this.attrs = { style: 'padding-block-end: 1000px' };
    }
    update(update) {
      const view = update.view;
      const padding = calculateOverscrollPadding(view.scrollDOM.clientHeight, view.defaultLineHeight, view.documentPadding.top, rate);
      if (padding !== this.padding) {
        this.padding = padding;
        this.attrs = { style: `padding-block-end: ${padding}px` };
      }
    }
  });
  return [plugin, EditorView.contentAttributes.of(view => view.plugin(plugin)?.attrs ?? null)];
}
function autoIndentExtension() {
  return settings.autoIndent ? [] : Prec.highest(keymap.of([{ key: 'Enter', run: insertNewline }]));
}

function completionExtension(doc = activeDoc) {
  const wordTypes = completionWordTypesForDocument(doc);
  const override = [];
  if (wordTypes.syntax) override.push(syntaxWordCompletionSource);
  if (wordTypes.document) override.push(context => documentWordCompletionSource(context, { includeWhileTyping: true }));
  return autocompletion({
    activateOnTyping: autoCompletionEnabledForLanguage(settings, doc?.language),
    activateOnTypingDelay: 250,
    override
  });
}

function completionWordTypeDefaults(language) {
  const syntax = customSyntaxes.find(item => item.id === language);
  const isCodeMode = syntax ? syntax.kind === 'code' || syntax.completions.length > 0 : language !== 'plaintext';
  return { document: true, syntax: isCodeMode };
}

function completionWordTypesForDocument(doc = activeDoc) {
  return completionWordTypesForLanguage(settings, doc?.language, completionWordTypeDefaults(doc?.language));
}

function symbolBalancingModeDefault(language) {
  const syntax = customSyntaxes.find(item => item.id === language);
  return syntax ? syntax.kind === 'code' || syntax.completions.length > 0 : Boolean(language && language !== 'plaintext');
}

function symbolBalancingExtension(doc = activeDoc) {
  return automaticSymbolBalancingEnabledForLanguage(settings, doc?.language, symbolBalancingModeDefault(doc?.language))
    ? closeBrackets()
    : [];
}

function fontTypeModeDefault(language) {
  const syntax = customSyntaxes.find(item => item.id === language);
  if (syntax) return syntax.kind === 'general' ? 'standard' : 'monospaced';
  return ['plaintext', 'markdown'].includes(language) ? 'standard' : 'monospaced';
}

function fontTypeForDocument(doc = activeDoc) {
  return fontTypeForLanguage(settings, doc?.language, fontTypeModeDefault(doc?.language));
}

function syncFontTypeControl() {
  const language = activeDoc?.language;
  const overrides = settings.fontTypeByLanguage;
  const exact = language && Object.hasOwn(overrides, language) ? overrides[language] : null;
  const inherited = overrides['*'];
  $('#font-type-language-setting').value = exact || (inherited && inherited !== 'mode-default' ? inherited : 'mode-default');
}

function spellCheckingModeDefault(language) {
  const syntax = customSyntaxes.find(item => item.id === language);
  if (syntax) return syntax.kind === 'general';
  return ['plaintext', 'markdown'].includes(language);
}

function spellCheckingEnabled(language = activeDoc?.language) {
  return continuousSpellCheckingEnabledForLanguage(settings, language, spellCheckingModeDefault(language));
}

function spellCheckingExtension(doc = activeDoc) {
  return EditorView.contentAttributes.of({ spellcheck: spellCheckingEnabled(doc?.language) ? 'true' : 'false' });
}

const SUBSTITUTION_MODE_OPTIONS = Object.freeze({
  smartQuotes: { setting: 'smartQuotesByLanguage', modeDefault: false, controlId: 'smart-quotes-language-setting' },
  smartDashes: { setting: 'smartDashesByLanguage', modeDefault: false, controlId: 'smart-dashes-language-setting' },
  textReplacement: { setting: 'automaticTextReplacementByLanguage', modeDefault: true, controlId: 'automatic-text-replacement-language-setting' }
});

function substitutionModeEnabled(option, language = activeDoc?.language) {
  const descriptor = SUBSTITUTION_MODE_OPTIONS[option];
  if (!descriptor) return false;
  const overrides = settings[descriptor.setting];
  return language && typeof overrides?.[language] === 'boolean' ? overrides[language] : descriptor.modeDefault;
}

function setSubstitutionModeOverride(option, language, value) {
  const descriptor = SUBSTITUTION_MODE_OPTIONS[option];
  if (!descriptor || typeof language !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(language)) return;
  const overrides = { ...settings[descriptor.setting] };
  if (typeof value === 'boolean') overrides[language] = value;
  else delete overrides[language];
  settings[descriptor.setting] = Object.fromEntries(Object.entries(overrides).slice(-200));
}

function automaticSubstitutionEditorExtension(doc = activeDoc) {
  const language = doc?.language;
  return automaticSubstitutionsExtension(() => ({
    smartQuotes: substitutionModeEnabled('smartQuotes', language),
    smartDashes: substitutionModeEnabled('smartDashes', language),
    textReplacement: substitutionModeEnabled('textReplacement', language),
    rules: settings.textReplacements
  }));
}

function urlLinksExtension() {
  if (!settings.autoLinkDetection) return [];
  return createUrlLinkExtension(url => {
    if (typeof window.cotedit?.openExternalUrl !== 'function') return false;
    return window.cotedit.openExternalUrl(url).catch(() => showToast('无法在系统浏览器中打开此 URL。'));
  });
}

function currentLineHighlightExtension() {
  return settings.highlightCurrentLine ? highlightActiveLine() : [];
}
function matchingBracesExtension() {
  return settings.highlightBraces ? bracketMatching() : [];
}
function selectionMatchExtension() {
  return settings.highlightSelectionInstances ? selectionInstanceHighlightExtension(settings.selectionInstanceHighlightDelay) : [];
}

function createState(doc) {
  const language = languageCompartment.of(languageExtension(doc.language, doc.name));
  const lineNumbers = lineNumberCompartment.of(numberExtension());
  const wrap = wrapCompartment.of(lineWrappingExtension());
  const overscroll = overscrollCompartment.of(overscrollExtension());
  const currentLine = currentLineCompartment.of(currentLineHighlightExtension());
  const matchingBraces = bracketMatchingCompartment.of(matchingBracesExtension());
  const selectionMatches = selectionMatchCompartment.of(selectionMatchExtension());
  const indent = indentCompartment.of(indentExtensions(doc));
  const autoIndent = autoIndentCompartment.of(autoIndentExtension());
  const symbolBalancing = symbolBalancingCompartment.of(symbolBalancingExtension(doc));
  const spellChecking = spellCheckingCompartment.of(spellCheckingExtension(doc));
  const automaticSubstitutions = automaticSubstitutionsCompartment.of(automaticSubstitutionEditorExtension(doc));
  const completions = completionCompartment.of(completionExtension(doc));
  const urlLinks = urlLinkCompartment.of(urlLinksExtension());
  const customTheme = customThemeCompartment.of(customThemeExtension());
  const editability = readOnlyCompartment.of(editabilityExtensions(doc.preventEditing === true));
  const direction = directionCompartment.of(EditorView.contentAttributes.of({ dir: doc.writingDirection || settings.writingDirection || 'ltr' }));
  return EditorState.create({
    doc: doc.text,
    extensions: [
      verticalTextNavigation,
      verticalTextScrollHandler,
      verticalColumnViewport,
      minimalSetup,
      EditorState.allowMultipleSelections.of(true),
      ...documentLineEndingExtensions(doc.lineEndings || [], doc.eol || 'LF'),
      foldGutter(),
      autoIndent,
      automaticTrailingWhitespaceExtension(() => ({
        autoTrimsTrailingWhitespace: settings.autoTrimsTrailingWhitespace,
        trimsWhitespaceOnlyLines: settings.trimsWhitespaceOnlyLines
      })),
      indentOnInput(),
      matchingBraces,
      symbolBalancing,
      spellChecking,
      automaticSubstitutions,
      completions,
      urlLinks,
      currentLine,
      selectionMatches,
      rectangularSelection(),
      crosshairCursor(),
      verticalPointerSelection,
      pairedDoubleClickSelection,
      search(),
      editorSearchHighlightPlugin,
      multipleReplaceHighlightField,
      language,
      customTheme,
      displayCompartment.of(displayExtensions()),
      lineNumbers,
      wrap,
      overscroll,
      indent,
      editability,
      direction,
      Prec.highest(keymap.of([
        { key: 'Backspace', run: view => tabInsertionMode() === 'soft-tabs' && deleteSoftTab(view, settings.tabWidth) },
        { key: 'Shift-Tab', run: view => handleSelectedLinesTab(view, settings.indentWithTabKey, true) }
      ])),
      keymap.of([
        { key: 'Tab', run: view => {
          if (handleSelectedLinesTab(view, settings.indentWithTabKey)) return true;
          const insertionMode = tabInsertionMode(activeDoc);
          if (insertionMode === 'soft-tabs') return insertSoftTab(view, settings.tabWidth);
          if (insertionMode === 'tab') {
            view.dispatch(view.state.replaceSelection('\t'));
            return true;
          }
          const indentation = indentationFor(activeDoc);
          const insert = indentation === 'tab' ? '\t' : ' '.repeat(Number(indentation) || 4);
          view.dispatch(view.state.replaceSelection(insert));
          return true;
        } },
        { key: 'Mod-/', run: view => toggleCommentAtVisualIndent(view, settings.tabWidth, settings.appendsCommentSpacer) }
      ]),
      EditorView.updateListener.of(update => {
        schedulePageGuideUpdate();
        if (activeDoc && (update.view === editorView || update.view === secondaryView)) {
          focusedView = update.view;
          activeDoc.editorState = update.state;
          mirrorEditorState(update.view === editorView ? secondaryView : editorView, update.state);
          const lineEndingMetadataChanged = synchronizeDocumentLineEndingMetadata(activeDoc, update);
          if (update.docChanged) {
            columnAnchor = null;
            searchNavigation = null;
            activeDoc.text = update.state.doc.toString();
            renderOutline();
          } else if (update.selectionSet) {
            renderOutlineNavigation();
          }
          if (update.docChanged || lineEndingMetadataChanged) {
            scheduleEncodingWarnings();
            renderTabs();
            renderSidebar();
            persistSession();
            syncWindowTitle();
          }
          if (update.selectionSet && !programmaticColumnSelection) columnAnchor = null;
          renderStatus();
          if (searchPanelVisible()) updateSearchCount();
          if (update.docChanged || update.selectionSet) syncMenuState();
        }
      })
    ]
  });
}

async function handleFileDrop(payload) {
  const x = Number(payload?.x);
  const y = Number(payload?.y);
  const target = Number.isFinite(x) && Number.isFinite(y) ? document.elementFromPoint(x, y) : null;
  const view = secondaryView?.dom.contains(target) ? secondaryView : editorView?.dom.contains(target) ? editorView : null;
  if (payload?.error) { showToast('无法读取拖放文件路径；文稿未更改。'); return; }
  if (!view || !activeDoc) return;
  if (activeDoc.preventEditing) { showToast('当前文稿为只读，未插入文件路径。'); return; }
  const targetDocument = activeDoc;
  const targetDoc = view.state.doc;
  const targetSelection = view.state.selection;
  try {
    const { text, fileCount } = await window.cotedit.formatDroppedFilePaths(payload?.paths, targetDocument.path, targetDocument.language, settings.fileDropRules);
    if (activeDoc !== targetDocument || targetDocument.preventEditing || view.state.doc !== targetDoc || !view.state.selection.eq(targetSelection)) {
      showToast('文稿或选区在拖放处理期间已更改；文件未插入。');
      return;
    }
    const selection = view.state.selection.main;
    const dropPosition = view.posAtCoords({ x, y });
    const replaceSelection = Number.isInteger(dropPosition) && dropPosition >= selection.from && dropPosition <= selection.to;
    const from = replaceSelection ? selection.from : Number.isInteger(dropPosition) ? dropPosition : selection.from;
    const to = replaceSelection ? selection.to : from;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, userEvent: 'input.drop' });
    view.focus();
    showToast(`已插入 ${fileCount} 个文件拖放结果。`);
  } catch (error) {
    showToast(`文件拖放未完成：${error?.message || '请减少文件数量或检查路径长度'}。`);
  }
}

async function createEditor() {
  const startup = await loadStartupRecovery();
  recoveryDrafts = startup.drafts;
  documents = startup.fallbackDocuments;
  activeDoc = documents[0] || null;
  if (!activeDoc) {
    const first = createDocument('', '未命名.txt', null, false);
    documents.push(first);
    activeDoc = first;
  }
  activeDoc.editorState ||= createState(activeDoc);
  editorView = new EditorView({ state: activeDoc.editorState, parent: $('#editor') });
  bindPageGuideView(editorView);
  window.cotedit?.onFileDrop?.(handleFileDrop);
  window.cotedit?.onSyntaxPackageDrop?.(handleSyntaxPackageDrop);
  editorView.dom.addEventListener('focusin', () => { focusedView = editorView; });
  focusedView = editorView;
  $('#welcome').classList.add('hidden');
  applySettings();
  renderAll();
  setTimeout(() => {
    if (!$('#recovery-dialog')?.open && (document.activeElement === document.body || document.activeElement === root)) editorView?.focus();
  }, 80);
  if (availableRecoveryDrafts().length) void showRecoveryManagerDialog();
  else if (recoveryDrafts.length > 0) {
    recoveryStartupPending = true;
    void refreshRecoveryDrafts();
  }
  for (const remoteDocument of pendingRemoteDocuments.splice(0)) openRemoteDocument(remoteDocument);
}

function createDocument(text = '', name = `未命名-${newDocNumber++}.txt`, path = null, saved = true, metadata = {}) {
  const originalText = String(text);
  const normalizedText = normalizeLineEndings(originalText);
  const detectedIndentStyle = saved && settings.detectsIndentStyle ? detectIndentStyle(originalText) : null;
  const newDocumentLanguage = typeof metadata.newDocumentLanguage === 'string'
    ? resolveDefaultSyntaxId(metadata.newDocumentLanguage, LANGUAGE_OPTIONS, customSyntaxes)
    : null;
  let language = newDocumentLanguage || languageForDocument(name, originalText);
  if (metadata.remoteFileType) language = languageForRemoteFileType(metadata.remoteFileType, name, originalText);
  if (!metadata.plainText) noteRecentSyntax(language);
  const encoding = metadata.encoding || 'utf8';
  const eol = metadata.eol || detectLineEnding(originalText);
  const lineEndings = metadata.lineEndings || getLineEndings(originalText);
  const bom = metadata.bom === true;
  const writingDirection = metadata.writingDirection === 'rtl' || metadata.writingDirection === 'ltr'
    ? metadata.writingDirection : defaultDocumentWritingDirection(path);
  const doc = { id: crypto.randomUUID(), name, path, text: normalizedText, savedText: saved ? normalizedText : '', language, encoding, savedEncoding: saved ? encoding : 'utf8', eol, savedEol: saved ? eol : 'LF', lineEndings, savedLineEndings: saved ? [...lineEndings] : [], bom, savedBom: saved ? bom : false, preventEditing: metadata.preventEditing === true, writingDirection, remoteSessionId: typeof metadata.remoteSessionId === 'string' ? metadata.remoteSessionId : null, remotePath: typeof metadata.remotePath === 'string' ? metadata.remotePath : '', remoteConnected: metadata.remoteConnected === true, detectedIndentStyle, editorState: null, restored: false };
  doc.fileSizeBytes = Number.isSafeInteger(metadata.fileSizeBytes) && metadata.fileSizeBytes >= 0 ? metadata.fileSizeBytes : null;
  doc.fileCreatedAtMs = Number.isFinite(metadata.fileCreatedAtMs) && metadata.fileCreatedAtMs > 0 ? metadata.fileCreatedAtMs : null;
  doc.fileModifiedAtMs = Number.isFinite(metadata.fileModifiedAtMs) && metadata.fileModifiedAtMs > 0 ? metadata.fileModifiedAtMs : null;
  doc.filePermissions = typeof metadata.filePermissions === 'string' && /^[0-7]{3,4} \(-[rwxstST-]{9}\)$/.test(metadata.filePermissions) ? metadata.filePermissions : null;
  doc.fileOwnerIds = normalizeDocumentFileOwnerIds(metadata.fileOwnerIds);
  doc.fileTags = normalizeDocumentFileTags(metadata.fileTags);
  doc.editorState = createState(doc);
  return doc;
}

function mirrorEditorState(peer, state) {
  if (!peer || peer.state === state) return;
  setEditorStatePreservingScroll(peer, state);
}

function createSecondaryEditor() {
  if (secondaryView || !editorView) return;
  secondaryView = new EditorView({ state: editorView.state, parent: $('#editor-secondary') });
  bindPageGuideView(secondaryView);
  secondaryView.dom.addEventListener('focusin', () => { focusedView = secondaryView; });
  syncEditorAccessibility();
  $('#split-editor').classList.remove('hidden');
  $('#split-toggle').classList.add('selected');
  splitEnabled = true;
}

function destroySecondaryEditor() {
  if (secondaryView) { unbindPageGuideView(secondaryView); secondaryView.destroy(); secondaryView = null; }
  $('#split-editor').classList.add('hidden');
  $('#split-toggle').classList.remove('selected');
  splitEnabled = false;
  focusedView = editorView;
}

function switchDocument(doc) {
  if (!doc || doc === activeDoc) return;
  if (activeDoc && editorView) activeDoc.editorState = (focusedView || editorView).state;
  activeDoc = doc;
  activeDoc.editorState ||= createState(activeDoc);
  editorView.setState(activeDoc.editorState);
  if (secondaryView) secondaryView.setState(activeDoc.editorState);
  for (const view of new Set([editorView, secondaryView].filter(Boolean))) {
    view.dispatch({ effects: [
      languageCompartment.reconfigure(languageExtension(activeDoc.language, activeDoc.name)),
      bracketMatchingCompartment.reconfigure(matchingBracesExtension()),
      symbolBalancingCompartment.reconfigure(symbolBalancingExtension(activeDoc)),
      spellCheckingCompartment.reconfigure(spellCheckingExtension(activeDoc)),
      automaticSubstitutionsCompartment.reconfigure(automaticSubstitutionEditorExtension(activeDoc)),
      completionCompartment.reconfigure(completionExtension(activeDoc)),
      lineNumberCompartment.reconfigure(numberExtension()),
      wrapCompartment.reconfigure(lineWrappingExtension()),
      currentLineCompartment.reconfigure(currentLineHighlightExtension()),
      selectionMatchCompartment.reconfigure(selectionMatchExtension()),
      autoIndentCompartment.reconfigure(autoIndentExtension()),
      urlLinkCompartment.reconfigure(urlLinksExtension()),
      indentCompartment.reconfigure(indentExtensions(activeDoc))
    ] });
  }
  renderAll();
  editorView.focus();
}

function addDocument(doc) {
  const duplicate = doc.path && documents.find(existing => existing.path === doc.path);
  if (duplicate) { switchDocument(duplicate); return; }
  documents.push(doc);
  switchDocument(doc);
  renderAll();
}

function renderAll() {
  renderTabs();
  syncEditorAccessibility();
  renderSidebar();
  renderDocumentInfo();
  renderStatus();
  renderOutline();
  $('#welcome').classList.toggle('hidden', documents.length > 0);
  $('#editor').classList.toggle('hidden', documents.length === 0);
  scheduleEncodingWarnings();
  syncWindowTitle();
}

function syncEditorAccessibility() {
  const name = activeDoc?.name || '未命名.txt';
  const labelEditor = (view, label) => {
    if (!view?.contentDOM) return;
    view.contentDOM.setAttribute('role', 'textbox');
    view.contentDOM.setAttribute('aria-multiline', 'true');
    view.contentDOM.setAttribute('aria-label', `${label}：${name}`);
    view.contentDOM.setAttribute('aria-describedby', 'cursor-position selection-info word-count');
    view.contentDOM.setAttribute('aria-readonly', String(activeDoc?.preventEditing === true));
  };
  labelEditor(editorView, '文本编辑器');
  labelEditor(secondaryView, '分屏文本编辑器');
}

let tabCloseTargetId = null;

function syncTabCloseButton(targetId = tabCloseTargetId) {
  const closeButton = $('#tab-close');
  const strip = $('#tab-strip');
  if (!closeButton || !strip) return;
  let doc = documents.find(item => item.id === targetId);
  let tab = doc ? document.getElementById(`document-tab-${doc.id}`) : null;
  if (!doc || !tab || (doc !== activeDoc && !tab.matches(':hover') && !tab.contains(document.activeElement))) {
    doc = activeDoc || documents[0] || null;
    tab = doc ? document.getElementById(`document-tab-${doc.id}`) : null;
  }
  if (!doc || !tab) {
    tabCloseTargetId = null;
    closeButton.hidden = true;
    closeButton.disabled = true;
    return;
  }
  tabCloseTargetId = doc.id;
  closeButton.hidden = false;
  closeButton.disabled = false;
  closeButton.dataset.close = doc.id;
  closeButton.setAttribute('aria-label', `关闭 ${doc.name}`);
  closeButton.title = `关闭 ${doc.name}`;
  const stripBounds = strip.getBoundingClientRect();
  const tabBounds = tab.getBoundingClientRect();
  const buttonWidth = closeButton.offsetWidth || 25;
  const maxLeft = Math.max(0, strip.clientWidth - buttonWidth);
  const tabRight = tabBounds.right - stripBounds.left - buttonWidth;
  closeButton.style.left = `${Math.max(0, Math.min(tabRight, maxLeft))}px`;
  closeButton.dataset.visible = String(doc === activeDoc || tab.matches(':hover') || tab.contains(document.activeElement));
}

function renderTabs() {
  $('#tabs').innerHTML = documents.map(doc => `<button id="document-tab-${escapeHtml(doc.id)}" class="tab ${doc === activeDoc ? 'active' : ''}" role="tab" aria-label="${escapeHtml(doc.name)}${isDirty(doc) ? '，有未保存的更改' : ''}" aria-selected="${doc === activeDoc}" aria-controls="editor" tabindex="${doc === activeDoc ? '0' : '-1'}" data-id="${escapeHtml(doc.id)}" title="${escapeHtml(doc.path || doc.name)}"><span class="tab-dot ${isDirty(doc) ? 'dirty' : ''}" aria-hidden="true"></span><span class="tab-name">${escapeHtml(doc.name)}</span></button>`).join('');
  syncTabCloseButton();
  const editor = $('#editor');
  if (activeDoc) {
    editor.setAttribute('role', 'tabpanel');
    editor.setAttribute('aria-labelledby', `document-tab-${activeDoc.id}`);
  } else {
    editor.removeAttribute('role');
    editor.removeAttribute('aria-labelledby');
  }
  const overflow = $('#tab-overflow');
  overflow.classList.toggle('hidden', documents.length < 6);
  if (documents.length < 6) overflow.setAttribute('aria-expanded', 'false');
  $('#tab-overflow-menu').innerHTML = documents.map(doc => `<button class="overflow-document" role="menuitemradio" aria-checked="${doc === activeDoc}" tabindex="-1" data-id="${doc.id}"><span class="tab-dot ${isDirty(doc) ? 'dirty' : ''}" aria-hidden="true"></span><span>${escapeHtml(doc.name)}</span><small>${escapeHtml(doc.path || (doc.restored ? '已恢复的本地草稿' : '本地文稿'))}</small></button>`).join('');
}

function renderSidebar() {
  $('#sidebar-documents').innerHTML = documents.map(doc => `<button class="sidebar-document ${doc === activeDoc ? 'active' : ''}" aria-current="${doc === activeDoc ? 'page' : 'false'}" aria-label="${escapeHtml(doc.name)}${isDirty(doc) ? '，有未保存的更改' : ''}" data-id="${doc.id}"><span class="sidebar-file-icon" aria-hidden="true">${escapeHtml(extensionLabel(doc.name))}</span><span class="sidebar-name">${escapeHtml(doc.name)}</span><span class="sidebar-dirty ${isDirty(doc) ? 'visible' : ''}" aria-hidden="true"></span></button>`).join('');
  $('#sidebar-documents').querySelectorAll('.sidebar-document').forEach(button => button.addEventListener('click', () => switchDocument(documents.find(doc => doc.id === button.dataset.id))));
}

function renderDocumentInfo() {
  if (!activeDoc) return;
  populateLanguageMenu();
  $('#active-filename').textContent = activeDoc.name;
  $('#file-path').textContent = activeDoc.remoteSessionId
    ? `远程文稿${activeDoc.remoteConnected ? '' : '（连接已断开）'} · ${activeDoc.remotePath || activeDoc.name}`
    : (activeDoc.path || (activeDoc.restored ? '已恢复的本地草稿' : '本地文稿'));
  $('#file-icon').textContent = extensionLabel(activeDoc.name);
  $('#file-icon').dataset.type = activeDoc.language;
  $('#language-select').value = activeDoc.language;
  $('#encoding-select').value = encodingOptionValue(activeDoc.encoding || 'utf8');
  $('#eol-select').value = displayedLineEnding(activeDoc);
  syncIndentControls();
  syncAutoCompletionControls();
  syncSymbolBalancingControls();
  syncEditorAccessibility();
}

function renderStatus() {
  if (!activeDoc || !editorView) {
    if (advancedCharacterCountActive) stopAdvancedCharacterCount();
    $('#advanced-character-counter').classList.add('hidden');
    updateLineEndingWarning({ mixed: false, types: [] }); syncMenuState(); return;
  }
  const view = focusedView || editorView;
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const col = countCharacters(view.state.doc.sliceString(line.from, head)) + 1;
  const stats = getTextStats(view.state.doc.toString());
  $('#cursor-position').textContent = `行 ${line.number}，列 ${col}`;
  const selectionLength = countCharacters(view.state.doc.sliceString(view.state.selection.main.from, view.state.selection.main.to));
  $('#selection-info').textContent = selectionLength ? `已选 ${selectionLength} 字符` : '';
  $('#word-count').textContent = `${stats.words} 个词 · ${stats.characters} 个字符`;
  scheduleAdvancedCharacterCount();
  if (document.activeElement !== $('#encoding-select')) $('#encoding-select').value = encodingOptionValue(activeDoc.encoding || 'utf8');
  if (document.activeElement !== $('#eol-select')) $('#eol-select').value = displayedLineEnding(activeDoc);
  updateLineEndingWarning(getLineEndingSummary(activeDoc));
  updateCharacterDetails();
  syncMenuState();
}

function encodingOptionValue(encoding) {
  const value = String(encoding).toLowerCase().replace(/_/g, '-');
  if (value === 'utf-8') return 'utf8';
  if (value === 'utf-16be') return 'utf16be';
  if (value === 'utf-16le') return 'utf16le';
  if (value === 'shift-jis') return 'shift_jis';
  return value;
}

function displayedLineEnding(doc) {
  const summary = getLineEndingSummary(doc);
  if (summary.mixed) return 'Mixed';
  return summary.types[0]?.type || doc.eol || 'LF';
}

function getLineEndingSummary(doc) {
  const endings = doc?.lineEndings || [];
  const cached = lineEndingSummaryCache.get(doc);
  if (cached?.endings === endings) return cached.summary;
  const summary = summarizeLineEndings(endings);
  if (doc) lineEndingSummaryCache.set(doc, { endings, summary });
  return summary;
}

function updateLineEndingWarning(summary) {
  const button = $('#line-ending-warning');
  if (!button) return;
  const mixed = Boolean(activeDoc && summary.mixed);
  button.classList.toggle('hidden', !mixed);
  button.toggleAttribute('hidden', !mixed);
  const label = mixed ? `检查混合换行符：${summary.types.map(item => item.type).join('、')}` : '检查混合换行符';
  button.setAttribute('aria-label', label);
  $('#line-ending-live').textContent = mixed ? `文稿包含 ${summary.types.length} 种换行符，共 ${summary.total} 处` : '';
}

function showLineEndingDiagnostics() {
  if (!activeDoc) return;
  const summary = getLineEndingSummary(activeDoc);
  if (!summary.mixed) return;
  $('#line-ending-report-list').innerHTML = summary.types.map(item => {
    const lines = item.lines.map(line => `第 ${line} 行`).join('、');
    const overflow = item.count > item.lines.length ? `，另有 ${item.count - item.lines.length} 处` : '';
    return `<li><div><strong>${item.type}</strong><span>${item.count} 处</span></div><p>${lines}${overflow}</p></li>`;
  }).join('');
  $('#line-ending-normalize').textContent = `统一为 ${dominantLineEnding(activeDoc.lineEndings || [], activeDoc.eol || 'LF')}`;
  $('#line-ending-normalize').dataset.value = dominantLineEnding(activeDoc.lineEndings || [], activeDoc.eol || 'LF');
  $('#line-ending-dialog').showModal();
  $('#line-ending-close').focus();
}

const outlineItemsCache = new WeakMap();

function outlineItemsForDocument(doc, text = doc?.text || '') {
  if (!doc) return [];
  const syntax = customSyntaxes.find(item => item.id === doc.language);
  const cached = outlineItemsCache.get(doc);
  if (cached && cached.text === text && cached.language === doc.language && cached.syntax === syntax) return cached.items;
  const items = syntax?.outlines?.length ? getCotSyntaxOutline(text, syntax) : getOutline(text, doc.language);
  outlineItemsCache.set(doc, { text, language: doc.language, syntax, items });
  return items;
}

function renderOutlineNavigation() {
  const select = $('#outline-navigation-select');
  if (!select) return [];
  const view = activeEditor();
  const text = view?.state.doc.toString() ?? activeDoc?.text ?? '';
  const items = outlineItemsForDocument(activeDoc, text);
  const signature = JSON.stringify(items.map(item => [item.line, item.level, item.label]));
  if (select.dataset.outlineSignature !== signature) {
    const options = [new Option(items.length ? '选择大纲项' : '无大纲项', '')];
    items.forEach((item, index) => {
      const option = new Option(`${'  '.repeat(Math.max(0, Math.min(6, Number(item.level) - 1 || 0)))}${item.label} · 第 ${item.line} 行`, String(index));
      options.push(option);
    });
    select.replaceChildren(...options);
    select.dataset.outlineSignature = signature;
  }
  const currentLine = view ? view.state.doc.lineAt(view.state.selection.main.head).number : 1;
  const current = nearestOutlineItemAtOrBefore(items, currentLine);
  const currentIndex = current ? items.indexOf(current) : -1;
  select.value = currentIndex >= 0 ? String(currentIndex) : '';
  select.disabled = !activeDoc || items.length === 0;
  select.title = current
    ? `当前大纲项：${current.label}（第 ${current.line} 行）；打开菜单跳转到其他大纲项`
    : items.length ? '当前插入点之前没有大纲项；选择一项以跳转' : '当前文稿未识别到大纲项';
  const previous = view ? adjacentOutlineItem(items, currentLine, -1) : null;
  const next = view ? adjacentOutlineItem(items, currentLine, 1) : null;
  $('#outline-previous').disabled = !previous;
  $('#outline-next').disabled = !next;
  $('#outline-navigation-status').textContent = current
    ? `当前大纲项：${current.label}，第 ${current.line} 行，共 ${items.length} 项`
    : items.length ? `共 ${items.length} 个大纲项，当前插入点之前没有大纲项` : '当前文稿没有可导航的大纲项';
  return items;
}

function openOutlineNavigationMenu() {
  const items = renderOutlineNavigation();
  if (!activeDoc || !items.length) return false;
  if (!settings.showNavigationBar) {
    settings.showNavigationBar = true;
    persistSettings();
    applySettings();
  }
  const select = $('#outline-navigation-select');
  select.focus();
  try { select.showPicker?.(); } catch { /* Keyboard focus remains available if the platform blocks programmatic popup. */ }
  return true;
}

function renderOutline() {
  const items = renderOutlineNavigation();
  const list = $('#outline-items');
  if (!list) return;
  if (!activeDoc) { list.replaceChildren(); return; }
  list.innerHTML = items.length
    ? items.map(item => `<button class="outline-item" data-line="${item.line}" data-level="${item.level}" data-kind="${escapeHtml(item.kind || '')}" title="第 ${item.line} 行">${escapeHtml(item.label)}</button>`).join('')
    : '<div class="empty-hint">未识别到标题或代码结构</div>';
  list.querySelectorAll('[data-line]').forEach(button => button.addEventListener('click', () => {
    closePanel('outline-panel');
    jumpToLine(Number(button.dataset.line));
  }));
}

function navigateOutlineItem(direction) {
  const view = activeEditor();
  if (!activeDoc || !view) return false;
  const text = view.state.doc.toString();
  const items = outlineItemsForDocument(activeDoc, text);
  const currentLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const target = adjacentOutlineItem(items, currentLine, direction);
  if (!target) return false;
  closePanel('outline-panel');
  jumpToLine(target.line);
  return true;
}

function selectPreviousOutlineItem() { return navigateOutlineItem(-1); }
function selectNextOutlineItem() { return navigateOutlineItem(1); }

function renderSelectedCharacterDetails(text) {
  let offset = 0;
  const scalars = [];
  for (const scalar of text) {
    const metrics = characterInfo(text, offset);
    if (metrics) scalars.push({ character: scalar, codePoint: metrics.codePoint, metrics });
    offset += scalar.length;
  }
  void renderUnicodeCharacterDetails(scalars, text);
}

function positionCharacterPopover(view, position) {
  const panel = $('#character-panel');
  const shell = $('.editor-shell');
  const anchor = view.coordsAtPos(position);
  if (!anchor || !shell) return;
  const shellRect = shell.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const margin = 8;
  const gap = 8;
  let left = anchor.left - shellRect.left;
  if (left + panelRect.width > shellRect.width - margin) left = shellRect.width - panelRect.width - margin;
  let top = anchor.bottom - shellRect.top + gap;
  if (top + panelRect.height > shellRect.height - margin) top = anchor.top - shellRect.top - panelRect.height - gap;
  panel.style.left = `${Math.max(margin, left)}px`;
  panel.style.top = `${Math.max(margin, Math.min(top, shellRect.height - panelRect.height - margin))}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}

function updateCharacterDetails() {
  const panel = $('#character-panel');
  if (!panel || panel.classList.contains('hidden') || !activeDoc) return;
  const view = activeEditor();
  if (panel.dataset.mode === 'selection') {
    const selected = selectedGraphemeSelection(view);
    if (!selected) { closePanel('character-panel'); return; }
    renderSelectedCharacterDetails(selected.text);
    positionCharacterPopover(selected.view, selected.from);
    return;
  }
  const selection = view.state.selection.main;
  const info = characterInfo(view.state.doc.toString(), selection.empty ? selection.head : selection.from);
  if (!info) { $('#character-details').textContent = '文稿末尾没有可检查的字符'; return; }
  void renderUnicodeCharacterDetails([{ character: info.character, codePoint: info.codePoint, metrics: info }], info.character);
}

function showSelectedCharacterInfo() {
  const selected = selectedGraphemeSelection(activeEditor());
  if (!selected) return;
  closePanel('outline-panel');
  closePanel('warnings-panel');
  const panel = $('#character-panel');
  panel.dataset.mode = 'selection';
  panel.setAttribute('aria-label', '已选字符信息');
  panel.querySelector('.floating-panel-head strong').textContent = '字符信息';
  panel.classList.remove('hidden');
  $('#inspector-toggle').setAttribute('aria-expanded', 'true');
  updateCharacterDetails();
}

const countUnitDescriptions = {
  grapheme: '按用户感知的字素簇计数；由多个 Unicode 标量组成的字符（例如组合音标或 emoji）可以计为一个字符。',
  scalar: '按 Unicode 标量计数，与 Unicode 码点计数相同。',
  utf16: '按 UTF-16 代码单元计数；代理对计为两个单元。',
  byte: '先以所选文本编码无损编码，再统计编码后的字节数。'
};
const countUnitLabels = { grapheme: '字符', scalar: 'Unicode 标量', utf16: 'UTF-16 单元', byte: '字节' };
const categoryLabelsChinese = {
  Lu: '大写字母', Ll: '小写字母', Lt: '首字母大写字母', Lm: '修饰字母', Lo: '其他字母',
  Mn: '非间距标记', Mc: '间距组合标记', Me: '封闭标记', Nd: '十进制数字', Nl: '字母数字', No: '其他数字',
  Pc: '连接标点', Pd: '破折号标点', Ps: '开括号', Pe: '闭括号', Pi: '起始引号标点', Pf: '结束引号标点', Po: '其他标点',
  Sm: '数学符号', Sc: '货币符号', Sk: '修饰符号', So: '其他符号', Zs: '空格分隔符', Zl: '行分隔符', Zp: '段落分隔符',
  Cc: '控制字符', Cf: '格式字符', Cs: '代理项', Co: '专用区字符', Cn: '未分配'
};

async function renderUnicodeCharacterDetails(scalars, preview) {
  const renderId = ++characterDetailsRenderId;
  const panel = $('#character-panel');
  const target = $('#character-details');
  if (!panel || !target) return;
  target.textContent = '正在读取 Unicode 字符数据…';
  try {
    const metadata = await Promise.all(scalars.map(scalar => getUnicodeScalarInfo(scalar.codePoint)));
    if (renderId !== characterDetailsRenderId || panel.classList.contains('hidden')) return;
    const rows = metadata.map((item, index) => {
      const scalar = scalars[index];
      if (!item) return '';
      const metrics = scalar.metrics || characterInfo(scalar.character, 0);
      const displayed = item.categoryCode.startsWith('C') ? `⟨${item.name || item.codePointLabel}⟩` : scalar.character;
      const name = item.name || (item.categoryCode === 'Cn' ? '未分配码位' : '无 Unicode 名称');
      const block = item.blockName || '无（未归入命名区块）';
      const category = categoryLabelsChinese[item.categoryCode] || item.categoryName;
      const age = item.age ? `<span>Unicode 版本：Unicode ${escapeHtml(item.age)}</span>` : '';
      return `<div class="unicode-scalar-info"><span class="unicode-scalar-preview">${escapeHtml(displayed)}</span><div class="unicode-scalar-metadata"><strong>${escapeHtml(name)}</strong><span><code>${item.codePointLabel}</code> · 十进制 ${item.codePoint} · UTF-16 单元 ${metrics?.utf16Length ?? 1} · UTF-8 字节 ${metrics?.utf8Bytes ?? 0}</span><span>Unicode 区块：${escapeHtml(block)}</span><span>一般类别：${item.categoryCode} · ${escapeHtml(category)}（${escapeHtml(item.categoryName)}）</span>${age}</div></div>`;
    }).join('');
    target.innerHTML = `<span class="character-preview">${escapeHtml(preview)}</span>${rows}`;
  } catch (error) {
    if (renderId !== characterDetailsRenderId) return;
    target.textContent = `Unicode 字符数据加载失败：${error.message || '请重试'}`;
  }
}

function countOptionsFromSettings() {
  return {
    unit: settings.countUnit,
    normalizes: settings.countNormalizes,
    normalizationForm: settings.countNormalizationForm,
    ignoresNewlines: settings.countIgnoresNewlines,
    ignoresWhitespaces: settings.countIgnoresWhitespaces,
    treatsConsecutiveWhitespaceAsSingle: settings.countTreatsConsecutiveWhitespaceAsSingle,
    encoding: settings.countEncoding
  };
}

function countSettingsFromForm() {
  return {
    countUnit: $('#count-unit').value,
    countNormalizes: $('#count-normalizes').checked,
    countNormalizationForm: $('#count-normalization-form').value,
    countIgnoresNewlines: $('#count-ignores-newlines').checked,
    countIgnoresWhitespaces: $('#count-ignores-whitespaces').checked,
    countTreatsConsecutiveWhitespaceAsSingle: $('#count-collapse-whitespace').checked,
    countEncoding: $('#count-encoding').value
  };
}

function updateCountOptionsForm() {
  const unit = $('#count-unit').value;
  const ignoresNewlines = $('#count-ignores-newlines').checked;
  const ignoresWhitespaces = $('#count-ignores-whitespaces').checked;
  const normalizes = $('#count-normalizes').checked;
  $('#count-unit-description').textContent = countUnitDescriptions[unit] || countUnitDescriptions.grapheme;
  $('#count-encoding-row').classList.toggle('hidden', unit !== 'byte');
  $('#count-normalization-row').classList.toggle('hidden', unit === 'grapheme');
  $('#count-normalization-form').disabled = !normalizes;
  $('#count-collapse-whitespace').disabled = ignoresNewlines && ignoresWhitespaces;
  $('#count-collapse-row').setAttribute('aria-disabled', String(ignoresNewlines && ignoresWhitespaces));
}

function showAdvancedCharacterCountOptions() {
  if (!activeDoc) return;
  const dialog = $('#character-count-dialog');
  if (dialog.open) return;
  const encodingSelect = $('#count-encoding');
  if (!encodingSelect.options.length) {
    encodingSelect.innerHTML = ENCODING_OPTIONS.map(option => `<option value="${option.id}">${escapeHtml(option.label)}</option>`).join('');
  }
  const options = countOptionsFromSettings();
  $('#count-unit').value = options.unit;
  $('#count-normalizes').checked = options.normalizes;
  $('#count-normalization-form').value = options.normalizationForm;
  $('#count-ignores-newlines').checked = options.ignoresNewlines;
  $('#count-ignores-whitespaces').checked = options.ignoresWhitespaces;
  $('#count-collapse-whitespace').checked = options.treatsConsecutiveWhitespaceAsSingle;
  $('#count-encoding').value = options.encoding;
  $('#character-count-error').textContent = '';
  $('#character-count-apply').textContent = advancedCharacterCountActive ? '应用' : '开始计数';
  updateCountOptionsForm();
  advancedCountReturnFocus = document.activeElement;
  dialog.showModal();
  $('#count-unit').focus();
}

function updateColorCodePreview(color, updateFields = true) {
  if (!color) return;
  const picker = $('#color-code-picker');
  const alpha = Math.round(color.a * 100);
  if (updateFields) {
    picker.value = colorPickerHex(color);
    $('#color-code-alpha').value = String(alpha);
    $('#color-code-alpha-value').value = `${alpha}%`;
  }
  const swatch = $('#color-code-swatch');
  swatch.style.setProperty('--color-code-swatch-color', `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
  swatch.setAttribute('aria-label', `颜色预览：RGB ${color.r}, ${color.g}, ${color.b}，不透明度 ${alpha}%`);
}

function validateColorCodeInput() {
  const input = $('#color-code-value');
  const insert = $('#color-code-insert');
  const color = parseColorCode(input.value);
  const error = $('#color-code-error');
  const hasInput = Boolean(input.value.trim());
  error.textContent = color || !hasInput ? '' : '请输入有效的 Hex、CSS RGB、HSL、HWB 或受支持的颜色关键字。';
  input.setAttribute('aria-invalid', String(hasInput && !color));
  insert.disabled = !color || !colorCodeTarget || !activeDoc || activeDoc.preventEditing;
  if (color) updateColorCodePreview(color);
  return color;
}

function showColorCodeEditor() {
  const view = activeEditor();
  if (!activeDoc || !view || activeDoc.preventEditing) {
    showToast('请先打开可编辑的文稿。');
    return;
  }
  const selection = view.state.selection.main;
  const selectedText = selection.empty ? '' : view.state.sliceDoc(selection.from, selection.to);
  const parsed = parseColorCode(selectedText);
  const color = parsed || { r: 0, g: 0, b: 0, a: 1 };
  const initialValue = parsed ? selectedText.trim() : '';
  const initialFormat = parsed?.format || 'hex';
  colorCodeTarget = { docId: activeDoc.id, view, from: selection.from, to: selection.to, originalText: parsed ? selectedText : null, initialValue, initialFormat };
  $('#color-code-value').value = initialValue;
  $('#color-code-format').value = parsed && COLOR_CODE_FORMATS.some(format => format.id === parsed.format) ? parsed.format : 'hex';
  $('#color-code-error').textContent = '';
  updateColorCodePreview(color);
  validateColorCodeInput();
  const dialog = $('#color-code-dialog');
  if (!dialog.open) dialog.showModal();
  $('#color-code-value').focus();
  $('#color-code-value').select();
}

function changeColorCodeFormat() {
  const color = parseColorCode($('#color-code-value').value);
  if (!color) return validateColorCodeInput();
  const output = formatColorCode(color, $('#color-code-format').value, color.uppercase);
  if (output) $('#color-code-value').value = output;
  validateColorCodeInput();
}

function updateColorCodeFromPicker() {
  const picked = parseColorCode($('#color-code-picker').value);
  if (!picked) return;
  const color = withColorAlpha(picked, Number($('#color-code-alpha').value) / 100);
  if (!color) return;
  const output = formatColorCode(color, $('#color-code-format').value);
  if (output) $('#color-code-value').value = output;
  updateColorCodePreview(color);
  validateColorCodeInput();
}

function insertEditedColorCode(event) {
  event.preventDefault();
  const color = validateColorCodeInput();
  const target = colorCodeTarget;
  if (!color || !target || !activeDoc || activeDoc.id !== target.docId || activeDoc.preventEditing) return;
  const input = $('#color-code-value').value;
  const format = $('#color-code-format').value;
  const preserveOriginal = target.originalText !== null && input === target.initialValue && format === target.initialFormat;
  const output = preserveOriginal ? target.originalText : formatColorCode(color, format, color.uppercase);
  if (!output) return;
  target.view.dispatch({
    changes: { from: target.from, to: target.to, insert: output },
    selection: { anchor: target.from + output.length },
    userEvent: 'input.type'
  });
  $('#color-code-dialog').close();
  target.view.focus();
  colorCodeTarget = null;
}

function applyAdvancedCharacterCountOptions() {
  Object.assign(settings, countSettingsFromForm());
  persistSettings();
  advancedCharacterCountActive = true;
  $('#advanced-character-counter').classList.remove('hidden');
  $('#character-count-dialog').close();
  syncMenuState();
  scheduleAdvancedCharacterCount();
}

function stopAdvancedCharacterCount(restoreFocus = false) {
  if (!advancedCharacterCountActive) return;
  advancedCharacterCountActive = false;
  clearTimeout(advancedCountTimer);
  advancedCountRequestId++;
  $('#advanced-character-counter').classList.add('hidden');
  syncMenuState();
  if (restoreFocus) $('#word-count').focus();
}

function toggleAdvancedCharacterCount() {
  if (advancedCharacterCountActive) stopAdvancedCharacterCount();
  else showAdvancedCharacterCountOptions();
}

function scheduleAdvancedCharacterCount() {
  if (!advancedCharacterCountActive || !activeDoc) return;
  clearTimeout(advancedCountTimer);
  const requestId = ++advancedCountRequestId;
  advancedCountTimer = setTimeout(() => { void updateAdvancedCharacterCount(requestId); }, 120);
}

async function updateAdvancedCharacterCount(requestId) {
  if (!advancedCharacterCountActive || !activeDoc) return;
  const view = activeEditor();
  const ranges = view.state.selection.ranges.filter(range => !range.empty);
  const selected = ranges.length > 0;
  const documentText = view.state.doc.toString();
  const strings = selected ? ranges.map(range => view.state.sliceDoc(range.from, range.to)) : [documentText];
  const result = countAdvancedCharacterStrings(strings, countOptionsFromSettings());
  let count = result.count;
  let error = '';
  if (result.unit === 'byte') {
    try {
      if (typeof window.cotedit?.countEncodedBytes === 'function') {
        const response = await window.cotedit.countEncodedBytes({ strings: result.preparedStrings, encoding: result.encoding });
        count = response?.count;
        error = response?.error || '';
      } else if (result.encoding === 'utf8') {
        count = result.preparedStrings.reduce((total, text) => total + new TextEncoder().encode(text).length, 0);
      } else {
        error = '当前运行环境不支持此编码的字节统计。';
      }
    } catch (failure) {
      error = failure.message || '编码字节统计失败。';
    }
  }
  if (requestId !== advancedCountRequestId || !advancedCharacterCountActive) return;
  const value = $('#advanced-count-value');
  const scope = $('#advanced-count-scope');
  if (Number.isSafeInteger(count) && count >= 0) {
    const unit = result.unit;
    value.textContent = `${new Intl.NumberFormat('zh-CN').format(count)} ${countUnitLabels[unit] || '字符'}`;
    value.removeAttribute('title');
  } else {
    const encodingLabel = ENCODING_OPTIONS.find(option => option.id === result.encoding)?.label || result.encoding;
    const message = error || (result.unit === 'byte' ? `文本无法使用 ${encodingLabel} 无损编码。` : '无法统计当前文稿。');
    value.textContent = '无法计数';
    value.title = message;
  }
  scope.textContent = selected ? (ranges.length === 1 ? '当前选区' : `${ranges.length} 个选区`) : '整个文稿';
}

function scheduleEncodingWarnings() {
  if ($('#warnings-panel').classList.contains('hidden')) return;
  clearTimeout(warningsScanTimer);
  warningsScanTimer = setTimeout(() => updateEncodingWarnings(), 180);
}

async function updateEncodingWarnings() {
  const panel = $('#warnings-panel');
  if (!activeDoc || panel.classList.contains('hidden')) return;
  const scanId = ++warningsScanId;
  const documentId = activeDoc.id;
  const encoding = activeDoc.encoding || 'utf8';
  const summary = $('#warnings-summary');
  const list = $('#warnings-items');
  summary.textContent = `正在检查 ${encoding}…`;
  list.replaceChildren();
  if (!window.cotedit?.checkEncodingCompatibility) {
    summary.textContent = '编码兼容性检查仅在桌面版可用。';
    return;
  }
  const view = activeEditor();
  const text = applyLineEndings(view?.state.doc.toString() ?? activeDoc.text, activeDoc.lineEndings || [], activeDoc.eol || 'LF');
  try {
    const report = await window.cotedit.checkEncodingCompatibility({ text, encoding });
    if (scanId !== warningsScanId || activeDoc?.id !== documentId || panel.classList.contains('hidden')) return;
    summary.textContent = report.distinctCount
      ? `${encoding} 无法无损表示 ${report.distinctCount} 种字符，共 ${report.occurrenceCount} 处。`
      : `当前文稿可使用 ${encoding} 编码无损保存。`;
    for (const item of report.items) {
      const row = document.createElement('li');
      row.className = 'warnings-item';
      const glyph = document.createElement('span');
      glyph.className = 'warnings-character';
      glyph.setAttribute('aria-label', item.codePoint);
      glyph.textContent = item.character;
      const location = document.createElement('span');
      location.className = 'warnings-location';
      location.textContent = `${item.codePoint} · 第 ${item.firstLine} 行，第 ${item.firstColumn} 列 · ${item.occurrences} 处`;
      row.append(glyph, location);
      list.append(row);
    }
    if (report.truncated) {
      const note = document.createElement('li');
      note.className = 'empty-hint';
      note.textContent = `列表最多显示 ${report.items.length} 种字符；共发现 ${report.distinctCount} 种。`;
      list.append(note);
    }
  } catch (error) {
    if (scanId !== warningsScanId || activeDoc?.id !== documentId) return;
    summary.textContent = `检查失败：${error.message || '请重试'}`;
  }
}

function extensionLabel(name) {
  const ext = name.split('.').pop()?.toUpperCase() || 'TXT';
  return ext.length > 4 ? ext.slice(0, 4) : ext;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function syncWindowTitle() {
  if (activeDoc) window.cotedit?.setTitle(`${isDirty(activeDoc) ? '● ' : ''}${activeDoc.remoteSessionId ? '远程 · ' : ''}${activeDoc.name}`);
}

function selectedGraphemeSelection(view = activeEditor()) {
  const ranges = view?.state.selection.ranges;
  if (!activeDoc || !view || !ranges || ranges.length !== 1 || ranges[0].empty) return null;
  const range = ranges[0];
  const doc = view.state.doc;
  let contextFrom = Math.max(0, range.from - 16);
  if (contextFrom > 0) {
    const firstUnit = doc.sliceString(contextFrom, contextFrom + 1).charCodeAt(0);
    const previousUnit = doc.sliceString(contextFrom - 1, contextFrom).charCodeAt(0);
    if (firstUnit >= 0xdc00 && firstUnit <= 0xdfff && previousUnit >= 0xd800 && previousUnit <= 0xdbff) contextFrom--;
  }
  const contextTo = Math.min(doc.length, range.to + 16);
  const context = doc.sliceString(contextFrom, contextTo);
  const precedingText = contextFrom > 0 ? doc.sliceString(Math.max(0, contextFrom - 2), contextFrom) : '';
  const selected = startsInsideRegionalIndicatorRun(precedingText, context)
    ? getSingleGraphemeSelectionInText(doc.toString(), range.from, range.to, ranges.length)
    : getSingleGraphemeSelection(context, range.from - contextFrom, range.to - contextFrom, ranges.length);
  return selected ? { view, from: range.from, to: range.to, text: selected.text } : null;
}

function syncMenuState() {
  const view = activeEditor();
  const selection = view?.state.selection.main;
  const hasOutlineItems = Boolean(activeDoc && outlineItemsForDocument(activeDoc, view?.state.doc.toString() ?? activeDoc.text).length);
  const canInspectCharacter = Boolean(selectedGraphemeSelection(view));
  const toggleCommentUncommentable = Boolean(view && canUncommentToggleSelectionForState(view.state));
  if ($('#document-inspector-panel') && !$('#document-inspector-panel').classList.contains('hidden')) refreshDocumentInspector();
  window.cotedit?.setMenuState({
    hasDocument: Boolean(activeDoc && editorView),
    dirty: Boolean(activeDoc && isDirty(activeDoc)),
    canSave: Boolean(activeDoc && (!activeDoc.path || isDirty(activeDoc))),
    dirtyDocumentCount: documents.filter(isDirty).length,
    saveableDocumentCount: documents.filter(doc => !doc.path || isDirty(doc)).length,
    canUndo: Boolean(view && undoDepth(view.state) > 0),
    canRedo: Boolean(view && redoDepth(view.state) > 0),
    hasSelection: Boolean(selection && !selection.empty),
    toggleCommentUncommentable,
    canInspectCharacter,
    advancedCountActive: advancedCharacterCountActive,
    continuousSpellChecking: spellCheckingEnabled(),
    smartQuotes: substitutionModeEnabled('smartQuotes'),
    smartDashes: substitutionModeEnabled('smartDashes'),
    automaticTextReplacement: substitutionModeEnabled('textReplacement'),
    speechAvailable: typeof window.speechSynthesis?.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function',
    hasSpeechText: Boolean(view?.state.doc.length),
    speechActive,
    inspectorVisible: inspectorPanelIsVisible(),
    hasAnySelection: Boolean(view?.state.selection.ranges.some(range => !range.empty)),
    hasTextReplacements: settings.textReplacements.some(rule => rule.enabled),
    hasRichTextSelection: Boolean(view?.state.selection.ranges.some(range => !range.empty)),
    hasPath: Boolean(activeDoc?.path),
    hasRemotePath: Boolean(activeDoc?.remoteSessionId && activeDoc?.remotePath),
    preventEditing: activeDoc?.preventEditing === true,
    splitEnabled: Boolean(splitEnabled),
    hasSearchQuery: Boolean($('#search-query')?.value.trim()),
    hasSearchHighlights: Boolean($('#search-query')?.value.trim() && !searchHighlightsSuppressed && (searchPanelVisible() || findAllHighlightsActive)),
    hasMappingConflicts: hasSyntaxMappingConflicts(),
    language: activeDoc?.language || 'plaintext',
    hiddenSyntaxes: settings.hiddenSyntaxes,
    encoding: activeDoc?.encoding || 'utf8',
    bom: activeDoc?.bom === true,
    eol: activeDoc ? displayedLineEnding(activeDoc) : 'LF',
    indent: indentationFor(),
    hasIndentOverride: Boolean(activeDoc?.language && Object.prototype.hasOwnProperty.call(settings.indentByLanguage, activeDoc.language)),
    tabWidth: settings.tabWidth,
    autoExpandTab: effectiveAutoExpandTab(activeDoc?.detectedIndentStyle, settings.autoExpandTab),
    theme: settings.theme,
    fontType: fontTypeForDocument(),
    wrap: Boolean(settings.wrap),
    verticalText: Boolean(settings.verticalText),
    ligatures: Boolean(settings.ligatures),
    showLineNumbers: Boolean(settings.showLineNumbers),
    showInvisibles: Boolean(settings.showInvisibles),
    showIndentGuides: Boolean(settings.showIndentGuides),
    showPageGuide: Boolean(settings.showPageGuide),
    writingDirection: activeDoc?.writingDirection || settings.writingDirection || 'ltr',
    recoveryDraftCount: availableRecoveryDrafts().length,
    showSidebar: Boolean(settings.showSidebar),
    showStatusBar: Boolean(settings.showStatusBar),
    showTabBar: Boolean(settings.showTabBar),
    showToolbar: Boolean(settings.showToolbar),
    showNavigationBar: Boolean(settings.showNavigationBar),
    hasOutlineItems,
    splitEditorsVertically: Boolean(settings.splitEditorsVertically),
    documentCount: documents.length
  });
  syncSnippetMenu();
  syncMultipleReplaceMenu();
}

function syncSnippetMenu() {
  if (typeof window.cotedit?.updateSnippetMenu !== 'function') return;
  const entries = activeDoc
    ? snippetsForSyntax(settings.snippets, activeDoc.language).map(({ id, name, shortcut }) => ({ id, label: name, shortcut }))
    : [];
  const signature = JSON.stringify(entries);
  if (signature === lastSnippetMenuSignature) return;
  lastSnippetMenuSignature = signature;
  window.cotedit.updateSnippetMenu(entries);
}

function syncMultipleReplaceMenu() {
  if (typeof window.cotedit?.updateMultipleReplaceMenu !== 'function') return;
  const entries = settings.multipleReplaceDefinitions.map(({ id, name }) => ({ id, label: name }));
  const signature = JSON.stringify(entries);
  if (signature === lastMultipleReplaceMenuSignature) return;
  lastMultipleReplaceMenuSignature = signature;
  window.cotedit.updateMultipleReplaceMenu(entries);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function startSpeechSynthesis() {
  const view = activeEditor();
  const synth = window.speechSynthesis;
  if (!view || !synth || typeof window.SpeechSynthesisUtterance !== 'function') return;
  const selection = view.state.selection.main;
  const text = selection.empty ? view.state.doc.toString() : view.state.doc.sliceString(selection.from, selection.to);
  if (!text.trim()) { showToast('没有可朗读的文本。'); return; }
  const requestId = ++speechRequestId;
  synth.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = navigator.language;
  const finish = () => {
    if (speechRequestId !== requestId) return;
    speechActive = false;
    syncMenuState();
  };
  utterance.onstart = () => { if (speechRequestId === requestId) { speechActive = true; syncMenuState(); } };
  utterance.onend = finish;
  utterance.onerror = event => {
    finish();
    if (event.error !== 'canceled' && event.error !== 'interrupted') showToast('系统朗读服务不可用。');
  };
  speechActive = true;
  syncMenuState();
  try { synth.speak(utterance); }
  catch { finish(); showToast('系统朗读服务不可用。'); }
}

function stopSpeechSynthesis() {
  speechRequestId++;
  window.speechSynthesis?.cancel();
  speechActive = false;
  syncMenuState();
}

function toggleSubstitutionMode(option) {
  const language = activeDoc?.language;
  if (!language || !SUBSTITUTION_MODE_OPTIONS[option]) return;
  setSubstitutionModeOverride(option, language, !substitutionModeEnabled(option, language));
  persistSettings();
  applySettings();
}

function changeFontSize(delta) {
  settings.fontSize = Math.max(10, Math.min(28, settings.fontSize + delta));
  persistSettings();
  applySettings();
}

function setEditorFontType(value) {
  if (value !== 'standard' && value !== 'monospaced') return false;
  const language = activeDoc?.language;
  if (!language) return false;
  settings.fontTypeByLanguage = setFontTypeOverride(settings.fontTypeByLanguage, language, value);
  persistSettings();
  applySettings();
  return true;
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  persistSettings();
  applySettings();
}

function syncIndentControls() {
  const indentation = indentationFor();
  const select = $('#indent-select');
  for (const option of select.querySelectorAll('option[data-custom-width]')) option.remove();
  if (!['tab', '2', '4', '8'].includes(indentation)) {
    const option = document.createElement('option');
    option.dataset.customWidth = 'true';
    option.value = indentation;
    option.textContent = `${indentation} 个空格（自定义）`;
    select.insertBefore(option, select.querySelector('option[value="custom"]'));
  }
  select.value = indentation;
  $('#indent-toggle').textContent = indentation === 'tab' ? '制表符' : `空格: ${indentation}`;
  $('#indent-toggle').title = activeDoc ? `当前语法缩进：${indentation === 'tab' ? '制表符' : `${indentation} 个空格`}` : '默认缩进';
}

function syncAutoCompletionControls() {
  const control = $('#suggest-completions-language-setting');
  if (!control) return;
  const language = activeDoc?.language;
  const overrides = settings.suggestCompletionsByLanguage;
  control.value = language && Object.prototype.hasOwnProperty.call(overrides, language)
    ? (overrides[language] ? 'on' : 'off')
    : 'global';
  control.disabled = !language;
  syncCompletionWordTypeControls();
}

function syncSymbolBalancingControls() {
  const control = $('#symbol-balancing-language-setting');
  if (!control) return;
  const language = activeDoc?.language;
  const overrides = settings.automaticSymbolBalancingByLanguage;
  control.value = language && Object.prototype.hasOwnProperty.call(overrides, language)
    ? (overrides[language] ? 'on' : 'off')
    : 'mode-default';
  control.disabled = !language;
}

function syncSpellCheckingControls() {
  const control = $('#spell-check-language-setting');
  if (!control) return;
  const language = activeDoc?.language;
  const overrides = settings.continuousSpellCheckingByLanguage;
  control.value = language && Object.hasOwn(overrides, language)
    ? (overrides[language] ? 'on' : 'off')
    : 'mode-default';
  control.disabled = !language;
}

function syncSubstitutionControls() {
  for (const [option, descriptor] of Object.entries(SUBSTITUTION_MODE_OPTIONS)) {
    const control = $(`#${descriptor.controlId}`);
    if (!control) continue;
    const overrides = settings[descriptor.setting];
    const language = activeDoc?.language;
    control.value = language && Object.hasOwn(overrides, language)
      ? (overrides[language] ? 'on' : 'off')
      : 'mode-default';
    control.disabled = !language;
  }
}

function syncCompletionWordTypeControls() {
  const language = activeDoc?.language;
  const types = completionWordTypesForDocument(activeDoc);
  $('#completion-document-setting').checked = types.document;
  $('#completion-syntax-setting').checked = types.syntax;
  $('#completion-standard-setting').checked = false;
  $('#completion-document-setting').disabled = !language;
  $('#completion-syntax-setting').disabled = !language;
  $('#completion-sources-reset').disabled = !language || !Object.hasOwn(settings.completionWordTypesByLanguage, language);
}

function schedulePageGuideUpdate() {
  if (pageGuideFrame) return;
  pageGuideFrame = requestAnimationFrame(() => {
    pageGuideFrame = 0;
    updatePageGuidePositions();
  });
}

function bindPageGuideView(view) {
  view.scrollDOM.addEventListener('scroll', schedulePageGuideUpdate, { passive: true });
  pageGuideScrollHandlers.set(view, schedulePageGuideUpdate);
}

function unbindPageGuideView(view) {
  const handler = pageGuideScrollHandlers.get(view);
  if (handler) view.scrollDOM.removeEventListener('scroll', handler);
  pageGuideScrollHandlers.delete(view);
}

function updatePageGuidePositions() {
  const columns = settings.pageGuideColumn;
  const contexts = [[$('#editor'), editorView], [$('#editor-secondary'), secondaryView]];
  for (const [host, view] of contexts) {
    if (!host) continue;
    let guide = host.querySelector('.page-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'page-guide';
      guide.setAttribute('aria-hidden', 'true');
      guide.hidden = true;
      host.append(guide);
    }
    if (!settings.showPageGuide || !view || host.classList.contains('hidden')) {
      guide.hidden = true;
      continue;
    }
    const content = view.contentDOM;
    const scroller = view.scrollDOM;
    const line = content.querySelector('.cm-line');
    if (!content.isConnected || !scroller.clientWidth || !scroller.clientHeight) {
      guide.hidden = true;
      continue;
    }
    const contentStyle = getComputedStyle(content);
    const lineStyle = getComputedStyle(line || content);
    const hostRect = host.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const px = value => Number.parseFloat(value) || 0;
    const vertical = settings.verticalText;
    guide.classList.toggle('vertical', vertical);
    guide.hidden = false;
    if (vertical) {
      const lineHeight = px(getComputedStyle(view.dom).lineHeight) || px(contentStyle.fontSize) * settings.lineHeight;
      const top = contentRect.top - hostRect.top + px(contentStyle.paddingTop) + px(lineStyle.paddingTop) + columns * lineHeight + 2;
      guide.style.left = `${scrollerRect.left - hostRect.left}px`;
      guide.style.top = `${top}px`;
      guide.style.width = `${scroller.clientWidth}px`;
      guide.style.height = '0px';
      continue;
    }
    let advance = columns * px(contentStyle.fontSize) * 0.6;
    if (pageGuideMeasureContext) {
      pageGuideMeasureContext.font = `${contentStyle.fontWeight} ${contentStyle.fontSize} ${contentStyle.fontFamily}`;
      advance = pageGuideMeasureContext.measureText('0'.repeat(columns)).width;
    }
    const letterSpacing = contentStyle.letterSpacing === 'normal' ? 0 : px(contentStyle.letterSpacing);
    advance += letterSpacing * Math.max(0, columns - 1);
    const rtl = contentStyle.direction === 'rtl';
    const left = rtl
      ? contentRect.right - hostRect.left - px(contentStyle.paddingRight) - px(lineStyle.paddingRight) - advance - 2
      : contentRect.left - hostRect.left + px(contentStyle.paddingLeft) + px(lineStyle.paddingLeft) + advance + 2;
    guide.style.left = `${left}px`;
    guide.style.top = `${scrollerRect.top - hostRect.top}px`;
    guide.style.width = '1px';
    guide.style.height = `${scroller.clientHeight}px`;
  }
}

function scheduleRememberWindowSize(size) {
  pendingWindowSizeForStorage = size;
  clearTimeout(windowSizeStorageTimer);
  windowSizeStorageTimer = setTimeout(() => {
    rememberLastWindowSize(localStorage, pendingWindowSizeForStorage);
    pendingWindowSizeForStorage = null;
    windowSizeStorageTimer = null;
  }, 180);
}

function flushRememberedWindowSize() {
  clearTimeout(windowSizeStorageTimer);
  windowSizeStorageTimer = null;
  if (!pendingWindowSizeForStorage) return;
  rememberLastWindowSize(localStorage, pendingWindowSizeForStorage);
  pendingWindowSizeForStorage = null;
}

function syncDefaultWindowSize() {
  const size = resolveWindowSize(settings, readLastWindowSize(localStorage));
  const signature = `${size.width}x${size.height}`;
  if (signature === lastAppliedWindowSize) return Promise.resolve(true);
  lastAppliedWindowSize = signature;
  try {
    const request = window.cotedit?.setWindowSize?.(size);
    return Promise.resolve(request).catch(() => false);
  } catch { return Promise.resolve(false); }
}

function applySettings() {
  const actualTheme = settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : settings.theme;
  syncEditorThemeForAppearance(actualTheme);
  populateLanguageMenu();
  populateDefaultSyntaxOptions();
  root.dataset.theme = actualTheme;
  root.dataset.ligatures = settings.ligatures ? 'on' : 'off';
  const fontType = fontTypeForDocument();
  root.dataset.fontType = fontType;
  applyCustomEditorThemeStyles();
  $('#theme-toggle').setAttribute('aria-pressed', String(actualTheme === 'dark'));
  $('#theme-toggle').setAttribute('aria-label', `当前为${actualTheme === 'dark' ? '深色' : '浅色'}外观；切换外观`);
  root.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
  root.style.setProperty('--editor-font-family', editorFontFamilyStack(settings.fontFamily, fontType));
  root.style.setProperty('--editor-line-height', String(settings.lineHeight));
  $('#font-size').textContent = settings.fontSize;
  $('#line-height-setting').value = settings.lineHeight.toFixed(1);
  $('#window-width-setting').value = settings.windowWidth == null ? '' : String(settings.windowWidth);
  $('#window-height-setting').value = settings.windowHeight == null ? '' : String(settings.windowHeight);
  $('#ligatures-setting').checked = settings.ligatures;
  syncFontTypeControl();
  syncIndentControls();
  $('#theme-select').value = settings.theme;
  syncBuiltinThemeSelect();
  syncCustomThemeEditor();
  $('#custom-theme-count').textContent = `自定义主题 ${customEditorThemes.length}/${MAX_CUSTOM_EDITOR_THEMES}`;
  $('#cot-theme-status').textContent = `编辑器：${currentEditorThemeName()}`;
  $('#clear-cot-theme').disabled = currentEditorThemeName() === DEFAULT_EDITOR_THEME_NAME
    || currentEditorThemeName() === resolveEditorThemeNameForAppearance(DEFAULT_EDITOR_THEME_NAME, settings.theme === 'system' ? undefined : settings.theme);
  $('#wrap-setting').checked = settings.wrap;
  $('#overscroll-rate-setting').value = String(Math.round(settings.overscrollRate * 100));
  $('#hanging-indent-setting').checked = settings.enablesHangingIndent;
  $('#hanging-indent-width').value = String(settings.hangingIndentWidth);
  $('#hanging-indent-width').disabled = !settings.enablesHangingIndent;
  $('#auto-indent-setting').checked = settings.autoIndent;
  $('#suggest-completions-setting').checked = settings.suggestCompletionsWhileTyping;
  syncAutoCompletionControls();
  syncSymbolBalancingControls();
  syncSpellCheckingControls();
  syncSubstitutionControls();
  $('#detect-indent-style-setting').checked = settings.detectsIndentStyle;
  $('#indent-with-tab-setting').checked = settings.indentWithTabKey;
  $('#comment-spacer-setting').checked = settings.appendsCommentSpacer;
  $('#auto-trim-whitespace-setting').checked = settings.autoTrimsTrailingWhitespace;
  $('#trim-whitespace-only-lines-setting').checked = settings.trimsWhitespaceOnlyLines;
  $('#trim-whitespace-only-lines-setting').disabled = !settings.autoTrimsTrailingWhitespace;
  $('#vertical-text-setting').checked = settings.verticalText;
  $('#writing-direction-setting').value = settings.writingDirection;
  $('#default-syntax-setting').value = normalizeDefaultSyntaxId(settings.defaultSyntax);
  $('#line-setting').checked = settings.showLineNumbers;
  $('#highlight-current-line-setting').checked = settings.highlightCurrentLine;
  $('#highlight-braces-setting').checked = settings.highlightBraces;
  $('#selected-text-matches-setting').checked = settings.highlightSelectionInstances;
  $('#selected-text-match-delay-setting').value = String(settings.selectionInstanceHighlightDelay);
  $('#selected-text-match-delay-setting').disabled = !settings.highlightSelectionInstances;
  $('#link-urls-setting').checked = settings.autoLinkDetection;
  $('#invisibles-setting').checked = settings.showInvisibles;
  $('#invisible-newline-setting').checked = settings.showInvisibleNewLine;
  $('#invisible-tab-setting').checked = settings.showInvisibleTab;
  $('#invisible-space-setting').checked = settings.showInvisibleSpace;
  $('#invisible-whitespace-setting').checked = settings.showInvisibleWhitespaces;
  $('#invisible-control-setting').checked = settings.showInvisibleControl;
  $('#indent-guides-setting').checked = settings.showIndentGuides;
  $('#page-guide-setting').checked = settings.showPageGuide;
  $('#page-guide-column').value = String(settings.pageGuideColumn);
  $('#page-guide-column').disabled = !settings.showPageGuide;
  $('#sidebar-setting').checked = settings.showSidebar;
  $('#status-bar-setting').checked = settings.showStatusBar;
  $('#status-bar-opaque-setting').checked = settings.statusBarOpaqueBackground;
  $('#tabbar-setting').checked = settings.showTabBar;
  $('#toolbar-setting').checked = settings.showToolbar;
  $('#navigation-bar-setting').checked = settings.showNavigationBar;
  $('#split-orientation-setting').checked = settings.splitEditorsVertically;
  $('#app').classList.toggle('sidebar-hidden', !settings.showSidebar);
  const editorShell = $('.editor-shell');
  editorShell.classList.toggle('vertical-text', settings.verticalText);
  editorShell.classList.toggle('vertical-line-numbers', settings.showLineNumbers);
  editorShell.classList.toggle('split-vertical', settings.splitEditorsVertically);
  $('.tabbar').classList.toggle('hidden', !settings.showTabBar);
  $('.document-toolbar').classList.toggle('hidden', !settings.showToolbar);
  $('#navigation-bar').classList.toggle('hidden', !settings.showNavigationBar);
  applyToolbarItemSettings();
  if (!settings.showTabBar) setOverflowMenu(false);
  $('.statusbar').classList.toggle('hidden', !settings.showStatusBar);
  $('.statusbar').classList.toggle('opaque-background', settings.statusBarOpaqueBackground);
  $('#wrap-toggle').classList.toggle('selected', settings.wrap);
  $('#line-toggle').classList.toggle('selected', settings.showLineNumbers);
  $('#wrap-toggle').setAttribute('aria-pressed', String(settings.wrap));
  $('#line-toggle').setAttribute('aria-pressed', String(settings.showLineNumbers));
  for (const view of new Set([editorView, secondaryView].filter(Boolean))) {
    view.dispatch({ effects: [
      lineNumberCompartment.reconfigure(numberExtension()),
      wrapCompartment.reconfigure(lineWrappingExtension()),
      overscrollCompartment.reconfigure(overscrollExtension()),
      currentLineCompartment.reconfigure(currentLineHighlightExtension()),
      bracketMatchingCompartment.reconfigure(matchingBracesExtension()),
      selectionMatchCompartment.reconfigure(selectionMatchExtension()),
      autoIndentCompartment.reconfigure(autoIndentExtension()),
      symbolBalancingCompartment.reconfigure(symbolBalancingExtension(activeDoc)),
      spellCheckingCompartment.reconfigure(spellCheckingExtension(activeDoc)),
      automaticSubstitutionsCompartment.reconfigure(automaticSubstitutionEditorExtension(activeDoc)),
      completionCompartment.reconfigure(completionExtension(activeDoc)),
      urlLinkCompartment.reconfigure(urlLinksExtension()),
      indentCompartment.reconfigure(indentExtensions(activeDoc)),
      customThemeCompartment.reconfigure(customThemeExtension()),
      displayCompartment.reconfigure(displayExtensions())
    ] });
  }
  syncShortcutBindings();
  syncMenuState();
  schedulePageGuideUpdate();
}

function applyCustomEditorThemeStyles() {
  const supportsCssColor = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? color => CSS.supports('color', color) : () => false;
  const styles = customEditorTheme ? resolveCotEditorThemeStyles(customEditorTheme, supportsCssColor) : {};
  const highlightText = customEditorTheme?.systemSettings.includes('highlight') && supportsCssColor('AccentColorText') ? 'AccentColorText' : undefined;
  const variables = {
    '--editor-theme-text': styles.text,
    '--editor-theme-background': styles.background,
    '--editor-theme-selection': styles.selection,
    '--editor-theme-line-highlight': styles.lineHighlight,
    '--editor-theme-insertion-point': styles.insertionPoint,
    '--editor-theme-invisibles': styles.invisibles,
    '--editor-theme-highlight': styles.highlight,
    '--editor-theme-highlight-text': highlightText
  };
  for (const [name, value] of Object.entries(variables)) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}

async function importCotEditorTheme() {
  if (!window.cotedit?.isDesktop) { showToast('CotEditor 主题导入需要桌面版'); return; }
  try {
    const imported = await window.cotedit.importCotEditorTheme();
    if (!imported) return;
    const normalized = normalizeStoredCotTheme(imported);
    if (!normalized) throw new Error('主题文件没有可用的颜色定义。');
    customEditorThemes = upsertCustomEditorTheme(customEditorThemes, normalized, normalizeStoredCotTheme, builtinThemeNames());
    persistCustomEditorThemes();
    if (!applyCustomEditorTheme(normalized.name)) throw new Error('主题无法保存或激活。');
    applySettings();
    showToast(`已导入主题：${normalized.name}`);
  } catch (error) { showToast(`主题导入失败：${error.message || '请检查文件格式'}`); }
}

async function exportSettingsFile() {
  if (!window.cotedit?.isDesktop) { showToast('设置导出需要桌面版'); return; }
  try {
    const result = await window.cotedit.exportSettings(settings);
    if (!result?.canceled) showToast(`设置已导出：${result?.path || '完成'}`);
  } catch (error) { showToast(`设置导出失败：${error.message || '请重试'}`); }
}

async function importSettingsFile() {
  if (!window.cotedit?.isDesktop) { showToast('设置导入需要桌面版'); return; }
  if (!window.confirm('导入将替换本机 CotEdit 的编辑器和打印偏好设置。继续吗？')) return;
  try {
    const result = await window.cotedit.importSettings();
    if (result?.canceled) return;
    settings = normalizeSettings(result?.settings);
    persistSettings();
    applySettings();
    syncDefaultWindowSize();
    syncMenuState();
    showToast('偏好设置已导入。');
  } catch (error) { showToast(`设置导入失败：${error.message || '请检查文件格式'}`); }
}

function renderRemoteEditingStatus(status = remoteEditingStatus) {
  remoteEditingStatus = { ...remoteEditingStatus, ...status };
  const port = Number(remoteEditingStatus.port) || 52698;
  const summary = remoteEditingStatus.enabled
    ? (remoteEditingStatus.listening ? `SSH rmate 已启用 · 127.0.0.1:${port}` : 'SSH rmate 已启用，但当前未监听')
    : 'SSH rmate 远程编辑（默认关闭）';
  $('#remote-editing-summary').textContent = summary;
  $('#remote-editing-ssh-command').textContent = `ssh -R ${port}:127.0.0.1:${port} 用户名@远端主机`;
  $('#remote-editing-client-command').textContent = `rmate -p ${port} 文件名`;
  $('#remote-editing-status').textContent = remoteEditingStatus.error
    ? `未监听：${remoteEditingStatus.error}`
    : remoteEditingStatus.enabled && remoteEditingStatus.listening
      ? `已启用；仅监听 127.0.0.1:${port}。远端保存请求通过 RMate 回传，不提供远端磁盘写入确认。`
      : '远程编辑默认关闭；启用后只绑定本机回环地址，不会在局域网或公网开放端口。';
}

function openDonationLink(url) {
  if (typeof window.cotedit?.openExternalUrl !== 'function') {
    showToast('无法在系统浏览器中打开此链接。');
    return;
  }
  window.cotedit.openExternalUrl(url).catch(() => showToast('无法在系统浏览器中打开此链接。'));
}

function showDonationDialog() {
  const dialog = $('#donation-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  donationReturnFocus = document.activeElement;
  dialog.showModal();
  $('#donation-cancel')?.focus();
}

async function showRemoteEditingDialog() {
  if (!window.cotedit?.isDesktop || !window.cotedit.getRemoteEditingSettings) {
    showToast('外部集成设置仅在桌面版可用。');
    return;
  }
  try {
    const activeElement = document.activeElement;
    remoteEditingReturnFocus = activeElement?.closest?.('#settings-popover') ? $('#settings-toggle') : activeElement;
    setSettingsPopover(false);
    const status = await window.cotedit.getRemoteEditingSettings();
    renderRemoteEditingStatus(status);
    $('#remote-editing-enabled').checked = status.enabled === true;
    $('#remote-editing-port').value = String(status.port || 52698);
    $('#remote-editing-dialog').showModal();
    $('#remote-editing-enabled').focus();
  } catch (error) {
    showToast(`无法读取外部集成设置：${error.message || '请重试'}`);
    if (remoteEditingReturnFocus?.isConnected) remoteEditingReturnFocus.focus();
    remoteEditingReturnFocus = null;
  }
}

async function applyRemoteEditingSettings(event) {
  event?.preventDefault();
  const port = Number($('#remote-editing-port').value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    $('#remote-editing-status').textContent = '端口号必须是 1–65535 之间的整数。';
    $('#remote-editing-port').focus();
    return;
  }
  const button = $('#remote-editing-apply');
  button.disabled = true;
  try {
    const status = await window.cotedit.configureRemoteEditing({ enabled: $('#remote-editing-enabled').checked, port });
    renderRemoteEditingStatus(status);
    showToast(status.error ? `远程编辑设置已保存，但服务未启动：${status.error}` : status.enabled ? `远程编辑服务已启用，仅监听 127.0.0.1:${status.port}。` : '远程编辑服务已关闭。');
  } catch (error) {
    $('#remote-editing-status').textContent = `设置未保存：${error.message || '请重试'}`;
  } finally { button.disabled = false; }
}

function syncFontFamilyPreview() {
  const input = $('#font-family-input');
  const family = normalizeEditorFontFamily(input.value);
  const valid = !input.value.trim() || Boolean(family);
  $('#font-picker-status').textContent = valid ? '' : '字体名称仅可包含字母、数字、空格、点、下划线和连字符，最多 80 个字符。';
  $('#font-picker-apply').disabled = !valid;
  $('#font-family-preview').style.fontFamily = editorFontFamilyStack(family, fontTypeForDocument());
}

function showFontPicker() {
  const dialog = $('#font-picker-dialog');
  fontPickerReturnFocus = document.activeElement;
  $('#font-family-input').value = settings.fontFamily;
  syncFontFamilyPreview();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  requestAnimationFrame(() => $('#font-family-input').focus());
}

function applyFontFamily() {
  syncFontFamilyPreview();
  if ($('#font-picker-apply').disabled) return;
  settings.fontFamily = normalizeEditorFontFamily($('#font-family-input').value);
  persistSettings();
  applySettings();
  $('#font-picker-dialog').close();
}

function showPageSetup() {
  $('#print-page-size').value = settings.printPageSize;
  $('#print-orientation').value = settings.printOrientation;
  $('#print-margins').value = settings.printMargins;
  $('#print-title').checked = settings.printTitle;
  $('#print-line-numbers').checked = settings.printLineNumbers;
  $('#print-font-size').value = String(settings.printFontSize);
  const dialog = $('#page-setup-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  $('#print-page-size').focus();
}

function applyPageSetup(event) {
  event.preventDefault();
  settings = normalizeSettings({
    ...settings,
    printPageSize: $('#print-page-size').value,
    printOrientation: $('#print-orientation').value,
    printMargins: $('#print-margins').value,
    printTitle: $('#print-title').checked,
    printLineNumbers: $('#print-line-numbers').checked,
    printFontSize: Number($('#print-font-size').value)
  });
  persistSettings();
  applySettings();
  $('#page-setup-dialog').close();
  showToast('打印页面设置已保存。');
}

function registerImportedCotEditorSyntaxes(importedValues, { activate = false, rejectOverflow = false } = {}) {
  const values = Array.isArray(importedValues) ? importedValues : [importedValues];
  const normalized = values.map(normalizeStoredCotSyntax);
  if (!normalized.length || normalized.some(item => !item)) throw new Error('语法包格式无效或包含过多规则。');
  const next = mergeImportedCotSyntaxes(customSyntaxes, normalized, { rejectOverflow });
  localStorage.setItem(cotSyntaxKey, JSON.stringify(next));
  customSyntaxes = next;
  refreshSyntaxMappingConflicts();
  populateLanguageMenu();
  populateDefaultSyntaxOptions();
  updateCustomSyntaxMenu();
  syncMenuState();
  if (activate && activeDoc) changeLanguage(normalized.at(-1).id);
  if ($('#syntax-menu-dialog')?.open) renderSyntaxMenuDialog();
  return normalized;
}

function importedCotSyntaxToast(normalized, { dragged = false } = {}) {
  const rules = normalized.reduce((total, item) => total + item.rules.length, 0);
  const unsupported = normalized.reduce((total, item) => {
    const support = getCotSyntaxSupportSummary(item);
    return total + support.highlightRules + support.outlineRules + support.indentationRules;
  }, 0);
  const names = normalized.map(item => item.name).join('、');
  const prefix = dragged
    ? (normalized.length === 1 ? `已拖入 CotEditor 语法：${names}` : `已拖入 ${normalized.length} 个 CotEditor 语法：${names}`)
    : `已导入 CotEditor 语法：${names}`;
  const detail = normalized.length === 1
    ? `（${rules} 条高亮、${normalized[0].outlines.length} 条大纲、${normalized[0].indentation.blockDelimiters.length} 条缩进规则）`
    : `（共 ${rules} 条高亮规则）`;
  return `${prefix}${detail}${unsupported ? `；${unsupported} 条规则因兼容或安全边界未启用` : ''}`;
}

async function importCotEditorSyntax() {
  if (!window.cotedit?.isDesktop) { showToast('CotEditor 语法包导入需要桌面版'); return; }
  try {
    const imported = await window.cotedit.importCotEditorSyntax();
    if (!imported) return;
    const normalized = registerImportedCotEditorSyntaxes(imported, { activate: true });
    showToast(importedCotSyntaxToast(normalized));
  } catch (error) { showToast(`语法导入失败：${error.message || '请检查文件格式'}`); }
}

function handleSyntaxPackageDrop(result = {}) {
  if (result.error) { showToast(`语法拖放导入失败：${result.error}`); return; }
  try {
    const normalized = registerImportedCotEditorSyntaxes(result.packages, { rejectOverflow: true });
    showToast(importedCotSyntaxToast(normalized, { dragged: true }));
  } catch (error) { showToast(`语法拖放导入失败：${error.message || '请检查文件格式'}`); }
}

function persistActiveCustomEditorTheme() {
  const active = customEditorThemes.find(theme => theme.name === editorThemeName);
  if (!active) return false;
  customEditorTheme = normalizeStoredCotTheme(active);
  if (!customEditorTheme) return false;
  try {
    localStorage.setItem(cotEditorThemeKey, JSON.stringify(customEditorTheme));
    localStorage.setItem(editorThemeNameKey, editorThemeName);
  } catch { showToast('主题更改无法保存到本机设置。'); }
  applySettings();
  return true;
}

function renameActiveCustomEditorTheme() {
  const oldName = currentEditorThemeName();
  const requestedName = $('#custom-theme-name').value.replace(/[\u0000-\u001f\u007f]/gu, '').trim().slice(0, 100);
  try {
    customEditorThemes = renameCustomEditorTheme(customEditorThemes, oldName, requestedName, normalizeStoredCotTheme, builtinThemeNames());
    editorThemeName = customEditorThemes.find(theme => theme.name.toLocaleLowerCase('en-US') === requestedName.toLocaleLowerCase('en-US')).name;
    persistCustomEditorThemes();
    persistActiveCustomEditorTheme();
    showToast(`已重命名主题：${editorThemeName}`);
  } catch (error) {
    showToast(error.message || '无法重命名主题。');
    $('#custom-theme-name').focus();
  }
}

function deleteActiveCustomEditorTheme() {
  const name = currentEditorThemeName();
  if (!customEditorThemes.some(theme => theme.name === name)) return;
  if (!window.confirm(`删除自定义主题“${name}”？`)) return;
  try {
    customEditorThemes = removeCustomEditorTheme(customEditorThemes, name, normalizeStoredCotTheme, builtinThemeNames());
    persistCustomEditorThemes();
    customEditorTheme = null;
    editorThemeName = '';
    localStorage.removeItem(cotEditorThemeKey);
    localStorage.removeItem(editorThemeNameKey);
    applyBuiltinEditorTheme(resolveEditorThemeNameForAppearance(DEFAULT_EDITOR_THEME_NAME, settings.theme === 'system' ? undefined : settings.theme));
    applySettings();
    showToast(`已删除主题：${name}`);
  } catch (error) { showToast(error.message || '无法删除主题。'); }
}

function handleCustomThemeColorChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const style = target.dataset.themeStyle;
  const systemRole = target.dataset.themeSystemRole;
  if (!style && !systemRole) return;
  const theme = customEditorThemes.find(item => item.name === currentEditorThemeName());
  if (!theme) return;
  const updated = { ...theme, styles: { ...theme.styles }, systemSettings: [...theme.systemSettings] };
  if (style) {
    const prior = updated.styles[style] || '';
    updated.styles[style] = `${target.value.toLowerCase()}${prior.length === 9 ? prior.slice(7) : ''}`;
  } else {
    updated.systemSettings = target.checked
      ? [...new Set([...updated.systemSettings, systemRole])]
      : updated.systemSettings.filter(role => role !== systemRole);
  }
  try {
    customEditorThemes = upsertCustomEditorTheme(customEditorThemes, updated, normalizeStoredCotTheme, builtinThemeNames());
    persistCustomEditorThemes();
    persistActiveCustomEditorTheme();
  } catch (error) { showToast(error.message || '无法应用主题颜色。'); }
}

function clearCotEditorTheme() {
  customEditorTheme = null;
  editorThemeName = '';
  localStorage.removeItem(cotEditorThemeKey);
  try { localStorage.removeItem(editorThemeNameKey); } catch { /* storage may be unavailable */ }
  applyBuiltinEditorTheme(resolveEditorThemeNameForAppearance(DEFAULT_EDITOR_THEME_NAME, settings.theme === 'system' ? undefined : settings.theme));
  applySettings();
  showToast('已恢复默认编辑器主题');
}

async function refreshScriptStatus() {
  if (!window.cotedit?.isDesktop) return;
  try {
    const scripts = await window.cotedit.listScripts();
    $('#script-status').textContent = scripts.length ? `可用脚本：${scripts.length}` : '尚无脚本（添加 .js 文件）';
  } catch { $('#script-status').textContent = '无法读取脚本'; }
}

/**
 * Restores focus to `target` after a modal dialog closes, but only while the
 * current focus is stale (detached, body, or still inside the closed dialog).
 * The `close` event is dispatched as a queued task, so focus may have already
 * moved to newly-opened UI by the time this runs; restoring unconditionally
 * would yank focus away from it.
 */
function restoreDialogFocus(dialog, target) {
  const active = document.activeElement;
  const stale = !active || active === document.body || !active.isConnected || (dialog && dialog.contains(active));
  if (!stale) return;
  if (target?.isConnected && target !== document.body && !target.closest?.('.hidden, [hidden]')) target.focus();
  else activeEditor()?.focus();
}

function setSettingsPopover(open, restoreFocus = false) {
  const popover = $('#settings-popover');
  const isOpen = !popover.classList.contains('hidden');
  const nextOpen = typeof open === 'boolean' ? open : !isOpen;
  if (nextOpen === isOpen) return;
  popover.classList.toggle('hidden', !nextOpen);
  popover.setAttribute('aria-hidden', String(!nextOpen));
  $('#settings-toggle').setAttribute('aria-expanded', String(nextOpen));
  if (nextOpen) setTimeout(() => $('#font-down').focus(), 0);
  else if (restoreFocus) $('#settings-toggle').focus();
}

const syntaxMenuCollator = new Intl.Collator(undefined, { usage: 'sort', numeric: true, sensitivity: 'base' });

function syntaxMenuOptions() {
  return [
    ...LANGUAGE_OPTIONS,
    ...customSyntaxes.map(syntax => ({ id: syntax.id, label: `CotEditor · ${syntax.name}`, sortLabel: syntax.name, extensions: syntax.extensions }))
  ].sort((a, b) => syntaxMenuCollator.compare(a.sortLabel || a.label, b.sortLabel || b.label));
}

function defaultSyntaxId() {
  return resolveDefaultSyntaxId(settings.defaultSyntax, LANGUAGE_OPTIONS, customSyntaxes);
}

function defaultSyntaxExtension() {
  return defaultSyntaxFileExtension(settings.defaultSyntax, LANGUAGE_OPTIONS, customSyntaxes);
}

function populateDefaultSyntaxOptions() {
  const select = $('#default-syntax-setting');
  if (!select) return;
  const options = syntaxMenuOptions();
  const selectedId = normalizeDefaultSyntaxId(settings.defaultSyntax);
  select.replaceChildren();
  for (const option of options) {
    const element = document.createElement('option');
    element.value = option.id.toLowerCase();
    element.textContent = option.label;
    select.append(element);
  }
  if (!options.some(option => option.id.toLowerCase() === selectedId)) {
    const missing = document.createElement('option');
    missing.value = selectedId;
    missing.textContent = `未安装语法 · ${selectedId}`;
    missing.disabled = true;
    select.append(missing);
  }
  select.value = selectedId;
}

const FILE_DROP_VARIABLES = [
  'ABSOLUTE-PATH', 'RELATIVE-PATH', 'FILENAME', 'FILENAME-NOSUFFIX',
  'FILEEXTENSION', 'FILEEXTENSION-LOWER', 'FILEEXTENSION-UPPER', 'DIRECTORY', 'FILECONTENT', 'IMAGEWIDTH', 'IMAGEHEIGHT'
];

function cloneFileDropRules(rules = settings.fileDropRules) {
  return normalizeFileDropRules(rules).map(rule => ({ ...rule, extensions: [...rule.extensions] }));
}

function populateFileDropScopeOptions() {
  const select = $('#file-drop-rule-scope');
  select.replaceChildren();
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = '所有语法';
  select.append(allOption);
  for (const option of syntaxMenuOptions()) {
    const element = document.createElement('option');
    element.value = option.id.toLowerCase();
    element.textContent = option.label;
    select.append(element);
  }
}

function fileDropScopeLabel(scope) {
  if (!scope) return '所有语法';
  return syntaxMenuOptions().find(option => option.id.toLowerCase() === scope)?.label || `未安装语法 · ${scope}`;
}

function fileDropRuleExtensions(rule) {
  if (Array.isArray(rule?.extensions)) return rule.extensions.join(', ');
  return typeof rule?.extensions === 'string' ? rule.extensions : '';
}

function renderFileDropRuleList() {
  const list = $('#file-drop-rule-list');
  list.tabIndex = 0;
  list.replaceChildren();
  if (!fileDropDraftRules?.length) {
    const empty = document.createElement('p');
    empty.className = 'file-drop-rules-empty';
    empty.textContent = '尚无规则；未匹配文件会插入绝对路径。';
    list.append(empty);
  }
  for (const [index, rule] of (fileDropDraftRules || []).entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-drop-rule-entry';
    button.id = `file-drop-rule-option-${index}`;
    button.dataset.fileDropRuleId = rule.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(rule.id === selectedFileDropRuleId));
    button.tabIndex = -1;
    const name = document.createElement('strong');
    name.textContent = rule.description || `规则 ${index + 1}`;
    const summary = document.createElement('small');
    const extensionText = fileDropRuleExtensions(rule).trim() || '全部扩展名';
    summary.textContent = `${fileDropScopeLabel(rule.scope)} · ${extensionText}`;
    button.append(name, summary);
    button.addEventListener('click', () => selectFileDropRule(rule.id));
    list.append(button);
  }
  const index = (fileDropDraftRules || []).findIndex(rule => rule.id === selectedFileDropRuleId);
  if (index >= 0) list.setAttribute('aria-activedescendant', `file-drop-rule-option-${index}`);
  else list.removeAttribute('aria-activedescendant');
  $('#file-drop-rule-up').disabled = index <= 0;
  $('#file-drop-rule-down').disabled = index < 0 || index >= fileDropDraftRules.length - 1;
  $('#file-drop-rule-delete').disabled = index < 0;
  $('#file-drop-rule-new').disabled = (fileDropDraftRules?.length || 0) >= MAX_FILE_DROP_RULES;
  $('#file-drop-rule-save').disabled = !fileDropDraftRules;
  $('#file-drop-rule-reset').disabled = !fileDropDraftRules;
  for (const selector of ['#file-drop-rule-scope', '#file-drop-rule-extensions', '#file-drop-rule-description', '#file-drop-rule-format']) {
    $(selector).disabled = index < 0;
  }
}

function setFileDropRuleForm(rule) {
  const scope = $('#file-drop-rule-scope');
  const scopeId = rule?.scope || '';
  if (scopeId && ![...scope.options].some(option => option.value === scopeId)) {
    const missing = document.createElement('option');
    missing.value = scopeId;
    missing.textContent = fileDropScopeLabel(scopeId);
    scope.append(missing);
  }
  scope.value = scopeId;
  $('#file-drop-rule-extensions').value = fileDropRuleExtensions(rule);
  $('#file-drop-rule-description').value = rule?.description || '';
  $('#file-drop-rule-format').value = rule?.format || '';
}

function renderFileDropRuleManager() {
  renderFileDropRuleList();
  setFileDropRuleForm(fileDropDraftRules?.find(rule => rule.id === selectedFileDropRuleId));
}

function updateFileDropRuleDraftFromForm() {
  const rule = fileDropDraftRules?.find(candidate => candidate.id === selectedFileDropRuleId);
  if (!rule) return;
  rule.scope = $('#file-drop-rule-scope').value;
  rule.extensions = $('#file-drop-rule-extensions').value;
  rule.description = $('#file-drop-rule-description').value;
  rule.format = $('#file-drop-rule-format').value;
  fileDropDraftDirty = true;
}

function confirmDiscardFileDropDraft() {
  if (!fileDropDraftDirty) return true;
  if (!confirm('放弃尚未保存的文件拖放规则修改？')) return false;
  fileDropDraftRules = cloneFileDropRules();
  selectedFileDropRuleId = fileDropDraftRules[0]?.id || null;
  fileDropDraftDirty = false;
  return true;
}

function selectFileDropRule(id) {
  if (id === selectedFileDropRuleId) return;
  if (!confirmDiscardFileDropDraft()) {
    renderFileDropRuleManager();
    return;
  }
  selectedFileDropRuleId = id;
  $('#file-drop-rule-status').textContent = '';
  renderFileDropRuleManager();
}

function showFileDropRuleManager(returnFocus = null) {
  const dialog = $('#file-drop-settings-dialog');
  if (dialog.open) return;
  const current = returnFocus || document.activeElement;
  fileDropManagerReturnFocus = current?.isConnected && current !== document.body && !current.closest?.('.hidden, [hidden]')
    ? current
    : activeEditor()?.contentDOM;
  populateFileDropScopeOptions();
  fileDropDraftRules = cloneFileDropRules();
  selectedFileDropRuleId = fileDropDraftRules[0]?.id || null;
  fileDropDraftDirty = false;
  renderFileDropRuleManager();
  renderFileDropVariableButtons();
  dialog.showModal();
  setTimeout(() => (selectedFileDropRuleId ? $('#file-drop-rule-list') : $('#file-drop-rule-new')).focus(), 0);
}

function closeFileDropRuleManager() {
  if (!confirmDiscardFileDropDraft()) return;
  $('#file-drop-settings-dialog').close();
}

function restoreFileDropRuleManagerFocus() {
  fileDropDraftRules = null;
  selectedFileDropRuleId = null;
  fileDropDraftDirty = false;
  const target = fileDropManagerReturnFocus;
  fileDropManagerReturnFocus = null;
  restoreDialogFocus($('#file-drop-settings-dialog'), target);
}

function addFileDropRule() {
  if (!confirmDiscardFileDropDraft()) return;
  fileDropDraftRules = cloneFileDropRules();
  const id = globalThis.crypto?.randomUUID?.() || `file-drop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  fileDropDraftRules.push({ id, scope: '', extensions: [], description: '', format: '<<<ABSOLUTE-PATH>>>' });
  selectedFileDropRuleId = id;
  fileDropDraftDirty = true;
  $('#file-drop-rule-status').textContent = '新规则尚未保存。';
  renderFileDropRuleManager();
  $('#file-drop-rule-scope').focus();
}

function moveFileDropRule(direction) {
  updateFileDropRuleDraftFromForm();
  const index = fileDropDraftRules?.findIndex(rule => rule.id === selectedFileDropRuleId) ?? -1;
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= fileDropDraftRules.length) return;
  [fileDropDraftRules[index], fileDropDraftRules[nextIndex]] = [fileDropDraftRules[nextIndex], fileDropDraftRules[index]];
  renderFileDropRuleManager();
  $(`#file-drop-rule-${direction < 0 ? 'up' : 'down'}`).focus();
}

function deleteFileDropRule() {
  updateFileDropRuleDraftFromForm();
  const index = fileDropDraftRules?.findIndex(rule => rule.id === selectedFileDropRuleId) ?? -1;
  if (index < 0) return;
  fileDropDraftRules.splice(index, 1);
  selectedFileDropRuleId = fileDropDraftRules[Math.min(index, fileDropDraftRules.length - 1)]?.id || null;
  fileDropDraftDirty = true;
  $('#file-drop-rule-status').textContent = '删除仅在保存后生效。';
  renderFileDropRuleManager();
  if (!selectedFileDropRuleId) $('#file-drop-rule-new').focus();
}

function resetFileDropRulesToDefaults() {
  fileDropDraftRules = cloneFileDropRules(DEFAULT_FILE_DROP_RULES);
  selectedFileDropRuleId = fileDropDraftRules[0]?.id || null;
  fileDropDraftDirty = true;
  $('#file-drop-rule-status').textContent = '已载入默认规则预览；保存后生效。';
  renderFileDropRuleManager();
}

function saveFileDropRules() {
  updateFileDropRuleDraftFromForm();
  if (!fileDropDraftRules || fileDropDraftRules.length > MAX_FILE_DROP_RULES) return;
  const extensionPattern = /^[a-z0-9][a-z0-9_+-]{0,31}$/i;
  for (const rule of fileDropDraftRules) {
    const extensions = fileDropRuleExtensions(rule).split(',').map(extension => extension.trim()).filter(Boolean);
    if (extensions.length > 32 || extensions.some(extension => !extensionPattern.test(extension))) {
      $('#file-drop-rule-status').textContent = '扩展名仅可包含字母、数字、下划线、加号或连字符；多个扩展名用逗号分隔且不带句点。';
      $('#file-drop-rule-extensions').focus();
      return;
    }
    if (!rule.format || new TextEncoder().encode(rule.format).byteLength > MAX_FILE_DROP_FORMAT_BYTES || rule.format.includes('\0')) {
      $('#file-drop-rule-status').textContent = '插入格式不能为空，且最多为 8 KiB。';
      $('#file-drop-rule-format').focus();
      return;
    }
  }
  const normalized = normalizeFileDropRules(fileDropDraftRules);
  if (normalized.length !== fileDropDraftRules.length) {
    $('#file-drop-rule-status').textContent = '规则包含无效或超限字段；请检查语法范围、规则数量和总大小。';
    return;
  }
  settings.fileDropRules = normalized;
  persistSettings();
  fileDropDraftRules = cloneFileDropRules(normalized);
  fileDropDraftDirty = false;
  renderFileDropRuleManager();
  $('#file-drop-rule-status').textContent = `已保存 ${normalized.length} 条文件拖放规则。`;
  showToast('文件拖放规则已保存。');
}

function renderFileDropVariableButtons() {
  const container = $('#file-drop-variable-buttons');
  container.replaceChildren();
  for (const variable of FILE_DROP_VARIABLES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.fileDropVariable = variable;
    button.textContent = `<<<${variable}>>>`;
    button.title = `插入变量 <<<${variable}>>>`;
    button.addEventListener('click', () => {
      const input = $('#file-drop-rule-format');
      const token = `<<<${variable}>>>`;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.setRangeText(token, start, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    container.append(button);
  }
}

function populateSnippetScopeOptions() {
  const select = $('#snippet-scope');
  select.replaceChildren();
  const globalOption = document.createElement('option');
  globalOption.value = '';
  globalOption.textContent = '所有语法';
  select.append(globalOption);
  for (const option of syntaxMenuOptions()) {
    const element = document.createElement('option');
    element.value = option.id;
    element.textContent = option.label;
    select.append(element);
  }
}

function renderSnippetManagerList() {
  const list = $('#snippet-manager-list');
  list.replaceChildren();
  if (!settings.snippets.length) {
    const empty = document.createElement('p');
    empty.className = 'snippet-manager-empty';
    empty.textContent = '尚无已保存片段。选择“新建”来添加。';
    list.append(empty);
  }
  const labels = new Map(syntaxMenuOptions().map(option => [option.id, option.label]));
  for (const snippet of settings.snippets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'snippet-manager-entry';
    button.setAttribute('aria-pressed', String(snippet.id === selectedSnippetId));
    button.dataset.snippetId = snippet.id;
    const name = document.createElement('strong');
    name.textContent = snippet.name;
    const scope = document.createElement('small');
    const scopeLabel = snippet.scope ? (labels.get(snippet.scope) || `未安装语法 · ${snippet.scope}`) : '所有语法';
    const shortcutLabel = snippet.shortcut ? formatShortcut(snippet.shortcut, window.cotedit?.platform || navigator.platform) : '';
    scope.textContent = [scopeLabel, shortcutLabel].filter(Boolean).join(' · ');
    button.append(name, scope);
    button.addEventListener('click', () => selectSnippetForEdit(snippet.id));
    list.append(button);
  }
  const index = settings.snippets.findIndex(snippet => snippet.id === selectedSnippetId);
  $('#snippet-delete').disabled = snippetDraftIsNew || index < 0;
  $('#snippet-move-up').disabled = snippetDraftIsNew || index <= 0;
  $('#snippet-move-down').disabled = snippetDraftIsNew || index < 0 || index >= settings.snippets.length - 1;
}

function setSnippetForm(snippet = null) {
  $('#snippet-name').value = snippet?.name || '';
  snippetDraftShortcut = snippet?.shortcut || null;
  const scope = $('#snippet-scope');
  const scopeId = snippet?.scope || '';
  if (scopeId && ![...scope.options].some(option => option.value === scopeId)) {
    const missing = document.createElement('option');
    missing.value = scopeId;
    missing.textContent = `未安装语法 · ${scopeId}`;
    scope.append(missing);
  }
  scope.value = scopeId;
  $('#snippet-format').value = snippet?.format || '';
  $('#snippet-manager-error').textContent = '';
  renderSnippetShortcutControl();
  snippetFormDirty = false;
}

function renderSnippetShortcutControl() {
  const button = $('#snippet-shortcut-record');
  if (!button) return;
  button.textContent = recordingSnippetShortcut ? '按下组合键…' : snippetDraftShortcut
    ? formatShortcut(snippetDraftShortcut, window.cotedit?.platform || navigator.platform)
    : '未设置';
  button.classList.toggle('recording', recordingSnippetShortcut);
  button.setAttribute('aria-pressed', String(recordingSnippetShortcut));
  $('#snippet-shortcut-clear').disabled = recordingSnippetShortcut || !snippetDraftShortcut;
}

async function beginSnippetShortcutCapture() {
  try { await window.cotedit?.setShortcutCaptureMode?.(true); }
  catch { $('#snippet-shortcut-status').textContent = '无法暂时停用菜单快捷键，请重试。'; return; }
  if (!$('#snippet-manager-dialog').open) { void window.cotedit?.setShortcutCaptureMode?.(false); return; }
  recordingSnippetShortcut = true;
  renderSnippetShortcutControl();
  $('#snippet-shortcut-status').textContent = '正在录入片段快捷键；按 Escape 键取消。';
  $('#snippet-shortcut-record').focus();
}

function endSnippetShortcutCapture(message) {
  if (!recordingSnippetShortcut) return;
  recordingSnippetShortcut = false;
  void window.cotedit?.setShortcutCaptureMode?.(false);
  renderSnippetShortcutControl();
  $('#snippet-shortcut-status').textContent = message;
}

async function captureSnippetShortcut(event) {
  if (!recordingSnippetShortcut) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    endSnippetShortcutCapture('快捷键录入已取消。');
    return true;
  }
  const platform = window.cotedit?.platform || navigator.platform;
  const binding = shortcutFromEvent(event, platform);
  if (!binding) {
    $('#snippet-shortcut-status').textContent = '请按下带修饰键的组合；也可使用 F1–F24。';
    return true;
  }
  const candidate = { id: 'snippetShortcutCapture', label: '片段快捷键', ...binding, keyMac: binding.key, modMac: undefined, ctrlMac: undefined, ctrlNonMac: undefined, altMac: undefined, altNonMac: undefined, shiftMac: undefined, shiftNonMac: undefined };
  const conflict = findShortcutConflict(candidate, applyShortcutOverrides(SHORTCUTS, settings.keyBindings), platform);
  if (conflict) {
    $('#snippet-shortcut-status').textContent = `这个组合已分配给“${conflict.label}”；请换一个组合键。`;
    return true;
  }
  const sameBinding = (left, right) => ['darwin', 'linux'].every(target => formatShortcut(left, target) === formatShortcut(right, target));
  const duplicate = settings.snippets.find(item => item.id !== selectedSnippetId && item.shortcut && sameBinding(binding, item.shortcut));
  if (duplicate) {
    $('#snippet-shortcut-status').textContent = `这个组合已分配给片段“${duplicate.name}”；请换一个组合键。`;
    return true;
  }
  snippetDraftShortcut = binding;
  snippetFormDirty = true;
  renderSnippetShortcutControl();
  endSnippetShortcutCapture(`已录入：${formatShortcut(binding, platform)}。保存片段后生效。`);
  return true;
}

function selectSnippetForEdit(id) {
  if (id === selectedSnippetId && !snippetDraftIsNew) return;
  if (!confirmDiscardSnippetDraft()) return;
  const snippet = settings.snippets.find(item => item.id === id);
  if (!snippet) return;
  selectedSnippetId = id;
  snippetDraftIsNew = false;
  setSnippetForm(snippet);
  renderSnippetManagerList();
}

function beginNewSnippet() {
  if (!confirmDiscardSnippetDraft()) return;
  selectedSnippetId = null;
  snippetDraftIsNew = true;
  setSnippetForm();
  renderSnippetManagerList();
  $('#snippet-name').focus();
}

function confirmDiscardSnippetDraft() {
  if (!snippetFormDirty) return true;
  if (!confirm('放弃尚未保存的片段修改？')) return false;
  snippetFormDirty = false;
  return true;
}

function showSnippetManager(returnFocus = null) {
  const dialog = $('#snippet-manager-dialog');
  if (dialog.open) return;
  const current = returnFocus || document.activeElement;
  snippetManagerReturnFocus = current?.isConnected && current !== document.body && !current.closest?.('.hidden, [hidden]')
    ? current
    : activeEditor()?.contentDOM;
  populateSnippetScopeOptions();
  dialog.showModal();
  if (settings.snippets.length) selectSnippetForEdit(settings.snippets[0].id);
  else beginNewSnippet();
}

function saveSnippetManager(event) {
  event.preventDefault();
  const name = $('#snippet-name').value.trim();
  const format = $('#snippet-format').value;
  if (!name) {
    $('#snippet-manager-error').textContent = '请填写片段名称。';
    $('#snippet-name').focus();
    return;
  }
  if (!format) {
    $('#snippet-manager-error').textContent = '请填写插入内容；可仅使用光标标记来定位插入点。';
    $('#snippet-format').focus();
    return;
  }
  const id = snippetDraftIsNew
    ? (globalThis.crypto?.randomUUID?.() || `snippet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
    : selectedSnippetId;
  const draft = { id, name, scope: $('#snippet-scope').value, format, ...(snippetDraftShortcut ? { shortcut: snippetDraftShortcut } : {}) };
  const next = settings.snippets.slice();
  const index = next.findIndex(snippet => snippet.id === id);
  if (index >= 0) next[index] = draft;
  else next.push(draft);
  const normalized = normalizeSnippets(next);
  const saved = normalized.find(snippet => snippet.id === id);
  if (!saved) {
    $('#snippet-manager-error').textContent = '此片段超出数量或大小限制，请缩短内容后重试。';
    return;
  }
  settings.snippets = normalized;
  persistSettings();
  syncMenuState();
  selectedSnippetId = id;
  snippetDraftIsNew = false;
  setSnippetForm(saved);
  renderSnippetManagerList();
  showToast('片段已保存。');
}

function moveSelectedSnippet(direction) {
  if (!confirmDiscardSnippetDraft()) return;
  const index = settings.snippets.findIndex(snippet => snippet.id === selectedSnippetId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= settings.snippets.length) return;
  const next = settings.snippets.slice();
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  settings.snippets = next;
  persistSettings();
  syncMenuState();
  setSnippetForm(settings.snippets.find(snippet => snippet.id === selectedSnippetId));
  renderSnippetManagerList();
}

function deleteSelectedSnippet() {
  if (!confirmDiscardSnippetDraft()) return;
  const snippet = settings.snippets.find(item => item.id === selectedSnippetId);
  if (!snippet || !confirm(`删除片段“${snippet.name}”？`)) return;
  const deletedIndex = settings.snippets.findIndex(item => item.id === selectedSnippetId);
  settings.snippets = settings.snippets.filter(item => item.id !== selectedSnippetId);
  persistSettings();
  syncMenuState();
  if (settings.snippets.length) selectSnippetForEdit(settings.snippets[Math.min(deletedIndex, settings.snippets.length - 1)].id);
  else beginNewSnippet();
  renderSnippetManagerList();
}

function insertSnippetById(id) {
  const view = activeEditor();
  if (!activeDoc || !view || activeDoc.preventEditing) return false;
  const snippet = snippetsForSyntax(settings.snippets, activeDoc.language).find(item => item.id === id);
  if (!snippet) return false;
  const state = view.state;
  const replacements = state.selection.ranges.map(range => {
    const line = state.doc.lineAt(range.from);
    const indent = line.text.match(/^[\t ]*/)?.[0] || '';
    const selection = state.doc.sliceString(range.from, range.to);
    return { range, insertion: expandSnippetFormat(snippet.format, { selection, indent }) };
  });
  const changes = replacements.map(({ range, insertion }) => ({ from: range.from, to: range.to, insert: insertion.text }));
  const transaction = state.update({ changes });
  const selectionRanges = [];
  let mainIndex = 0;
  replacements.forEach(({ range, insertion }, index) => {
    const start = transaction.changes.mapPos(range.from, -1);
    const offsets = insertion.cursorOffsets.length ? insertion.cursorOffsets : [insertion.text.length];
    const firstIndex = selectionRanges.length;
    for (const offset of offsets) selectionRanges.push(EditorSelection.cursor(start + offset));
    if (index === state.selection.mainIndex) mainIndex = firstIndex + offsets.length - 1;
  });
  view.dispatch({
    changes: transaction.changes,
    selection: EditorSelection.create(selectionRanges, mainIndex),
    userEvent: 'input.type',
    scrollIntoView: true
  });
  view.focus();
  persistSession();
  showToast(`已插入片段：${snippet.name}`);
  return true;
}

function closeSnippetManager() {
  if (confirmDiscardSnippetDraft()) $('#snippet-manager-dialog').close();
}

function restoreSnippetManagerFocus() {
  if (recordingSnippetShortcut) endSnippetShortcutCapture('快捷键录入已取消。');
  const target = snippetManagerReturnFocus;
  snippetManagerReturnFocus = null;
  selectedSnippetId = null;
  snippetDraftIsNew = false;
  snippetFormDirty = false;
  restoreDialogFocus($('#snippet-manager-dialog'), target);
}

function renderTextReplacementList() {
  const list = $('#text-replacement-list');
  list.replaceChildren();
  if (!settings.textReplacements.length) {
    const empty = document.createElement('p');
    empty.className = 'snippet-manager-empty';
    empty.textContent = '尚无替换词。选择“新建”来添加。';
    list.append(empty);
  }
  for (const rule of settings.textReplacements) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'snippet-manager-entry';
    button.setAttribute('aria-pressed', String(rule.id === selectedTextReplacementId));
    button.dataset.textReplacementId = rule.id;
    const trigger = document.createElement('strong');
    trigger.textContent = rule.trigger;
    const detail = document.createElement('small');
    detail.textContent = `${rule.enabled ? '启用' : '已停用'} · ${rule.automatic ? '输入时自动应用' : '手动应用'} · 替换为：${rule.replacement || '（空字符串）'}`;
    button.append(trigger, detail);
    button.addEventListener('click', () => selectTextReplacementForEdit(rule.id));
    list.append(button);
  }
  $('#text-replacement-delete').disabled = textReplacementDraftIsNew || !settings.textReplacements.some(rule => rule.id === selectedTextReplacementId);
}

function setTextReplacementForm(rule = null) {
  $('#text-replacement-trigger').value = rule?.trigger ?? '';
  $('#text-replacement-value').value = rule?.replacement ?? '';
  $('#text-replacement-enabled').checked = rule?.enabled !== false;
  $('#text-replacement-automatic').checked = rule?.automatic === true;
  $('#text-replacement-manager-error').textContent = '';
  textReplacementFormDirty = false;
}

function selectTextReplacementForEdit(id) {
  if (id === selectedTextReplacementId && !textReplacementDraftIsNew) return;
  if (!confirmDiscardTextReplacementDraft()) return;
  const rule = settings.textReplacements.find(item => item.id === id);
  if (!rule) return;
  selectedTextReplacementId = id;
  textReplacementDraftIsNew = false;
  setTextReplacementForm(rule);
  renderTextReplacementList();
}

function beginNewTextReplacement() {
  if (!confirmDiscardTextReplacementDraft()) return;
  selectedTextReplacementId = null;
  textReplacementDraftIsNew = true;
  setTextReplacementForm();
  renderTextReplacementList();
  $('#text-replacement-trigger').focus();
}

function confirmDiscardTextReplacementDraft() {
  if (!textReplacementFormDirty) return true;
  if (!confirm('放弃尚未保存的文本替换词修改？')) return false;
  textReplacementFormDirty = false;
  return true;
}

function showTextReplacementManager(returnFocus = null) {
  const dialog = $('#text-replacement-manager-dialog');
  if (dialog.open) return;
  const current = returnFocus || document.activeElement;
  textReplacementManagerReturnFocus = current?.isConnected && current !== document.body && !current.closest?.('.hidden, [hidden]')
    ? current : activeEditor()?.contentDOM;
  dialog.showModal();
  renderTextReplacementList();
  if (settings.textReplacements.length) selectTextReplacementForEdit(settings.textReplacements[0].id);
  else beginNewTextReplacement();
}

function saveTextReplacementManager(event) {
  event.preventDefault();
  const trigger = $('#text-replacement-trigger').value;
  const replacement = $('#text-replacement-value').value;
  if (!trigger.length) {
    $('#text-replacement-manager-error').textContent = '触发词不能为空。';
    $('#text-replacement-trigger').focus();
    return;
  }
  const duplicate = settings.textReplacements.find(rule => rule.id !== selectedTextReplacementId && rule.trigger === trigger);
  if (duplicate) {
    $('#text-replacement-manager-error').textContent = '已有相同触发词；请编辑现有规则。';
    $('#text-replacement-trigger').focus();
    return;
  }
  const id = textReplacementDraftIsNew
    ? (globalThis.crypto?.randomUUID?.() || `text-replacement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
    : selectedTextReplacementId;
  const draft = { id, trigger, replacement, enabled: $('#text-replacement-enabled').checked, automatic: $('#text-replacement-automatic').checked };
  const next = settings.textReplacements.slice();
  const index = next.findIndex(rule => rule.id === id);
  if (index >= 0) next[index] = draft;
  else next.push(draft);
  const normalized = normalizeTextReplacements(next);
  const saved = normalized.find(rule => rule.id === id);
  if (!saved) {
    $('#text-replacement-manager-error').textContent = '规则超出数量或文本大小限制，或设置存储容量已满。';
    return;
  }
  settings.textReplacements = normalized;
  persistSettings();
  syncMenuState();
  selectedTextReplacementId = id;
  textReplacementDraftIsNew = false;
  setTextReplacementForm(saved);
  renderTextReplacementList();
  showToast('文本替换词已保存。');
}

function deleteSelectedTextReplacement() {
  if (!confirmDiscardTextReplacementDraft()) return;
  const index = settings.textReplacements.findIndex(rule => rule.id === selectedTextReplacementId);
  if (index < 0) return;
  const rule = settings.textReplacements[index];
  if (!confirm(`删除触发词“${rule.trigger}”的替换规则？`)) return;
  settings.textReplacements = settings.textReplacements.filter(item => item.id !== rule.id);
  persistSettings();
  syncMenuState();
  textReplacementFormDirty = false;
  if (settings.textReplacements.length) selectTextReplacementForEdit(settings.textReplacements[Math.min(index, settings.textReplacements.length - 1)].id);
  else beginNewTextReplacement();
  renderTextReplacementList();
}

function closeTextReplacementManager() {
  if (confirmDiscardTextReplacementDraft()) $('#text-replacement-manager-dialog').close();
}

function restoreTextReplacementManagerFocus() {
  const target = textReplacementManagerReturnFocus;
  textReplacementManagerReturnFocus = null;
  selectedTextReplacementId = null;
  textReplacementDraftIsNew = false;
  textReplacementFormDirty = false;
  restoreDialogFocus($('#text-replacement-manager-dialog'), target);
}

function makeMultipleReplaceId() {
  return globalThis.crypto?.randomUUID?.() || `replace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function makeMultipleReplaceRule() {
  return { id: makeMultipleReplaceId(), isEnabled: true, findString: '', replacementString: '', usesRegularExpression: false, ignoresCase: false };
}

function renderMultipleReplaceDefinitionList() {
  const list = $('#multiple-replace-definition-list');
  list.replaceChildren();
  if (!settings.multipleReplaceDefinitions.length) {
    const empty = document.createElement('p');
    empty.className = 'multiple-replace-empty';
    empty.textContent = '尚无已保存定义。点击“新建定义”开始。';
    list.append(empty);
  }
  for (const definition of settings.multipleReplaceDefinitions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'multiple-replace-definition-entry';
    button.dataset.definitionId = definition.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(definition.id === selectedMultipleReplaceId));
    const name = document.createElement('strong');
    name.textContent = definition.name;
    const detail = document.createElement('small');
    detail.textContent = `${definition.replacements.filter(rule => rule.isEnabled && rule.findString).length} 条启用规则`;
    button.append(name, detail);
    button.addEventListener('click', () => selectMultipleReplaceDefinition(definition.id));
    list.append(button);
  }
  const index = settings.multipleReplaceDefinitions.findIndex(item => item.id === selectedMultipleReplaceId);
  $('#multiple-replace-definition-up').disabled = multipleReplaceDraftIsNew || index <= 0;
  $('#multiple-replace-definition-down').disabled = multipleReplaceDraftIsNew || index < 0 || index >= settings.multipleReplaceDefinitions.length - 1;
  $('#multiple-replace-delete').disabled = multipleReplaceDraftIsNew || index < 0;
}

function renderMultipleReplaceRules() {
  const container = $('#multiple-replace-rules');
  container.replaceChildren();
  for (const [index, rule] of multipleReplaceDraft.replacements.entries()) {
    const row = document.createElement('div');
    row.className = 'multiple-replace-rule';
    row.dataset.ruleId = rule.id;
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = rule.isEnabled;
    enabled.dataset.multipleReplaceField = 'isEnabled';
    enabled.setAttribute('aria-label', `启用第 ${index + 1} 条规则`);
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'multiple-replace-check';
    enabledLabel.append(enabled);
    row.append(enabledLabel);
    for (const [field, label, placeholder] of [
      ['findString', `第 ${index + 1} 条规则的查找文本`, '查找文本'],
      ['replacementString', `第 ${index + 1} 条规则的替换文本`, '替换为']
    ]) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = rule[field];
      input.maxLength = 4096;
      input.placeholder = placeholder;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.dataset.multipleReplaceField = field;
      input.setAttribute('aria-label', label);
      row.append(input);
    }
    for (const [field, label, visible] of [
      ['usesRegularExpression', '正则表达式', '.*'],
      ['ignoresCase', '忽略大小写', 'Aa']
    ]) {
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = rule[field];
      check.dataset.multipleReplaceField = field;
      check.setAttribute('aria-label', `第 ${index + 1} 条规则：${label}`);
      const labelElement = document.createElement('label');
      labelElement.className = 'multiple-replace-check';
      labelElement.title = label;
      labelElement.append(check, document.createTextNode(visible));
      row.append(labelElement);
    }
    const actions = document.createElement('div');
    actions.className = 'multiple-replace-rule-actions';
    for (const [direction, text, labelText] of [['up', '↑', '上移'], ['down', '↓', '下移'], ['delete', '×', '删除']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.dataset.ruleAction = direction;
      button.setAttribute('aria-label', `${labelText}第 ${index + 1} 条规则`);
      if (direction === 'up' && index === 0) button.disabled = true;
      if (direction === 'down' && index === multipleReplaceDraft.replacements.length - 1) button.disabled = true;
      actions.append(button);
    }
    row.append(actions);
    container.append(row);
  }
}

function renderMultipleReplaceForm() {
  $('#multiple-replace-name').value = multipleReplaceDraft?.name || '';
  $('#multiple-replace-in-selection').checked = multipleReplaceDraftInSelection;
  $('#multiple-replace-textual-case-insensitive').checked = multipleReplaceDraft?.textualCaseInsensitive === true;
  $('#multiple-replace-textual-literal').checked = multipleReplaceDraft?.textualLiteral === true;
  $('#multiple-replace-textual-anchored').checked = multipleReplaceDraft?.textualAnchored === true;
  $('#multiple-replace-regex-case-insensitive').checked = multipleReplaceDraft?.regexCaseInsensitive === true;
  $('#multiple-replace-regex-allow-comments-and-whitespace').checked = multipleReplaceDraft?.regexAllowCommentsAndWhitespace === true;
  $('#multiple-replace-regex-ignore-metacharacters').checked = multipleReplaceDraft?.regexIgnoreMetacharacters === true;
  $('#multiple-replace-regex-dot-matches-line-separators').checked = multipleReplaceDraft?.regexDotMatchesLineSeparators === true;
  $('#multiple-replace-regex-anchors-match-lines').checked = multipleReplaceDraft?.regexAnchorsMatchLines === true;
  $('#multiple-replace-regex-unix-line-separators').checked = multipleReplaceDraft?.regexUnixLineSeparators === true;
  $('#multiple-replace-regex-unicode-word-boundaries').checked = multipleReplaceDraft?.regexUseUnicodeWordBoundaries === true;
  $('#multiple-replace-matches-full-word').checked = multipleReplaceDraft?.matchesFullWord === true;
  $('#multiple-replace-unescapes-replacement').checked = multipleReplaceDraft?.unescapesReplacementString === true;
  $('#multiple-replace-status').textContent = '';
  $('#multiple-replace-apply').disabled = !activeDoc || activeDoc.preventEditing === true;
  renderMultipleReplaceRules();
  renderMultipleReplaceDefinitionList();
}

function confirmDiscardMultipleReplaceDraft() {
  if (!multipleReplaceDraftDirty) return true;
  if (!confirm('放弃尚未保存的多重替换定义修改？')) return false;
  multipleReplaceDraftDirty = false;
  multipleReplaceDraftInSelection = settings.multipleReplaceInSelection;
  return true;
}

function selectMultipleReplaceDefinition(id) {
  if (id === selectedMultipleReplaceId && !multipleReplaceDraftIsNew) return;
  if (!confirmDiscardMultipleReplaceDraft()) return;
  const definition = settings.multipleReplaceDefinitions.find(item => item.id === id);
  if (!definition) return;
  clearMultipleReplaceHighlights();
  selectedMultipleReplaceId = id;
  multipleReplaceDraft = JSON.parse(JSON.stringify(definition));
  multipleReplaceDraftIsNew = false;
  multipleReplaceDraftDirty = false;
  renderMultipleReplaceForm();
}

function beginNewMultipleReplaceDefinition() {
  if (!confirmDiscardMultipleReplaceDraft()) return;
  clearMultipleReplaceHighlights();
  selectedMultipleReplaceId = null;
  multipleReplaceDraftIsNew = true;
  multipleReplaceDraftDirty = true;
  multipleReplaceDraftInSelection = settings.multipleReplaceInSelection;
  multipleReplaceDraft = { id: makeMultipleReplaceId(), name: '新定义', ...DEFAULT_MULTIPLE_REPLACE_OPTIONS, replacements: [makeMultipleReplaceRule()] };
  renderMultipleReplaceForm();
  $('#multiple-replace-name').focus();
  $('#multiple-replace-name').select();
}

function showMultipleReplaceManager(returnFocus = null) {
  const dialog = $('#multiple-replace-dialog');
  if (dialog.open) return;
  const current = returnFocus || document.activeElement;
  multipleReplaceManagerReturnFocus = current?.isConnected && current !== document.body && !current.closest?.('.hidden, [hidden]')
    ? current
    : activeEditor()?.contentDOM;
  multipleReplaceDraftInSelection = settings.multipleReplaceInSelection;
  dialog.showModal();
  if (settings.multipleReplaceDefinitions.length) selectMultipleReplaceDefinition(settings.multipleReplaceDefinitions[0].id);
  else beginNewMultipleReplaceDefinition();
}

function restoreMultipleReplaceDraftFromSettings() {
  const saved = settings.multipleReplaceDefinitions.find(item => item.id === selectedMultipleReplaceId);
  if (saved) {
    multipleReplaceDraft = JSON.parse(JSON.stringify(saved));
    multipleReplaceDraftIsNew = false;
  } else {
    selectedMultipleReplaceId = null;
    multipleReplaceDraft = { id: makeMultipleReplaceId(), name: '新定义', ...DEFAULT_MULTIPLE_REPLACE_OPTIONS, replacements: [makeMultipleReplaceRule()] };
    multipleReplaceDraftIsNew = true;
  }
  multipleReplaceDraftDirty = false;
  multipleReplaceDraftInSelection = settings.multipleReplaceInSelection;
  renderMultipleReplaceForm();
}

async function importMultipleReplaceFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !confirmDiscardMultipleReplaceDraft()) return;

  let definitions = settings.multipleReplaceDefinitions.slice();
  const importedIds = [];
  const failures = [];
  let skipped = 0;
  let ignoredSettings = false;
  for (const file of files) {
    try {
      if (Number.isFinite(file.size) && file.size > MAX_MULTIPLE_REPLACE_IMPORT_BYTES) {
        throw new Error(`导入文件超过 ${MAX_MULTIPLE_REPLACE_IMPORT_BYTES / 1024} KiB 限制。`);
      }
      const parsed = parseCotEditorReplacementImport(await file.text(), file.name);
      const existingIndex = definitions.findIndex(item => item.name === parsed.definition.name);
      if (existingIndex >= 0 && !confirm(`多重替换定义“${parsed.definition.name}”已存在，是否替换？`)) {
        skipped++;
        continue;
      }

      const candidate = {
        id: existingIndex >= 0 ? definitions[existingIndex].id : makeMultipleReplaceId(),
        name: parsed.definition.name,
        textualCaseInsensitive: parsed.definition.textualCaseInsensitive === true,
        textualLiteral: parsed.definition.textualLiteral === true,
        textualAnchored: parsed.definition.textualAnchored === true,
        regexCaseInsensitive: parsed.definition.regexCaseInsensitive === true,
        regexAllowCommentsAndWhitespace: parsed.definition.regexAllowCommentsAndWhitespace === true,
        regexIgnoreMetacharacters: parsed.definition.regexIgnoreMetacharacters === true,
        regexDotMatchesLineSeparators: parsed.definition.regexDotMatchesLineSeparators === true,
        regexAnchorsMatchLines: parsed.definition.regexAnchorsMatchLines === true,
        regexUnixLineSeparators: parsed.definition.regexUnixLineSeparators === true,
        regexUseUnicodeWordBoundaries: parsed.definition.regexUseUnicodeWordBoundaries === true,
        matchesFullWord: parsed.definition.matchesFullWord === true,
        unescapesReplacementString: parsed.definition.unescapesReplacementString === true,
        replacements: parsed.definition.replacements
      };
      const staged = definitions.slice();
      if (existingIndex >= 0) staged[existingIndex] = candidate;
      else staged.push(candidate);
      if (staged.length > MAX_MULTIPLE_REPLACE_DEFINITIONS) {
        throw new Error(`定义数量超过 ${MAX_MULTIPLE_REPLACE_DEFINITIONS} 个上限。`);
      }
      const normalized = normalizeMultipleReplaceDefinitions(staged);
      const saved = normalized.find(item => item.id === candidate.id);
      if (!saved || saved.replacements.length !== candidate.replacements.length
          || normalized.length !== staged.length
          || definitions.some(item => item.id !== candidate.id && !normalized.some(next => next.id === item.id))) {
        throw new Error('导入后会超过 CotEdit 的数量或 48 KiB 容量限制；现有定义保持不变。');
      }
      definitions = normalized;
      importedIds.push(saved.id);
      ignoredSettings ||= parsed.ignoredSettings;
    } catch (error) {
      failures.push(`${file?.name || '未知文件'}：${error?.message || '导入失败'}`);
    }
  }

  if (importedIds.length) {
    settings.multipleReplaceDefinitions = definitions;
    persistSettings();
    syncMenuState();
    selectedMultipleReplaceId = importedIds.at(-1);
    const selected = definitions.find(item => item.id === selectedMultipleReplaceId);
    multipleReplaceDraft = JSON.parse(JSON.stringify(selected));
    multipleReplaceDraftIsNew = false;
    multipleReplaceDraftDirty = false;
    multipleReplaceDraftInSelection = settings.multipleReplaceInSelection;
    renderMultipleReplaceForm();
  } else {
    restoreMultipleReplaceDraftFromSettings();
  }

  const summary = [];
  if (importedIds.length) summary.push(`已导入 ${importedIds.length} 个定义`);
  if (skipped) summary.push(`跳过 ${skipped} 个重名定义`);
  if (failures.length) summary.push(`失败 ${failures.length} 个：${failures.join('；')}`);
  if (ignoredSettings) summary.push('部分 CotEditor 定义级查找选项未采用（文字/正则规则忽略大小写、整词匹配、LF 行分隔符和正则替换转义已支持）');
  $('#multiple-replace-status').textContent = summary.join('。') || '没有导入定义。';
}

function saveMultipleReplaceDefinition(showFeedback = true) {
  if (!multipleReplaceDraft) return null;
  const name = $('#multiple-replace-name').value.trim();
  if (!name) {
    $('#multiple-replace-status').textContent = '请填写定义名称。';
    $('#multiple-replace-name').focus();
    return null;
  }
  if (!multipleReplaceDraft.replacements.some(rule => rule.findString.trim())) {
    $('#multiple-replace-status').textContent = '请至少填写一条查找文本非空的规则。';
    $('#multiple-replace-rules input[data-multiple-replace-field="findString"]')?.focus();
    return null;
  }
  const draft = { ...multipleReplaceDraft, name, replacements: multipleReplaceDraft.replacements };
  const next = settings.multipleReplaceDefinitions.slice();
  const index = next.findIndex(item => item.id === draft.id);
  if (index >= 0) next[index] = draft;
  else next.push(draft);
  const normalized = normalizeMultipleReplaceDefinitions(next);
  const saved = normalized.find(item => item.id === draft.id);
  if (!saved) {
    $('#multiple-replace-status').textContent = '定义超出数量或大小限制，请缩短名称或规则后重试。';
    return null;
  }
  settings.multipleReplaceDefinitions = normalized;
  settings.multipleReplaceInSelection = multipleReplaceDraftInSelection;
  persistSettings();
  selectedMultipleReplaceId = saved.id;
  multipleReplaceDraft = JSON.parse(JSON.stringify(saved));
  multipleReplaceDraftIsNew = false;
  multipleReplaceDraftDirty = false;
  renderMultipleReplaceDefinitionList();
  $('#multiple-replace-status').textContent = showFeedback ? '定义已保存。' : '';
  return saved;
}

function moveMultipleReplaceDefinition(direction) {
  if (!confirmDiscardMultipleReplaceDraft()) return;
  const index = settings.multipleReplaceDefinitions.findIndex(item => item.id === selectedMultipleReplaceId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= settings.multipleReplaceDefinitions.length) return;
  const definitions = settings.multipleReplaceDefinitions.slice();
  [definitions[index], definitions[nextIndex]] = [definitions[nextIndex], definitions[index]];
  settings.multipleReplaceDefinitions = definitions;
  persistSettings();
  renderMultipleReplaceDefinitionList();
}

function deleteMultipleReplaceDefinition() {
  if (!confirmDiscardMultipleReplaceDraft()) return;
  if (multipleReplaceDraftIsNew) { beginNewMultipleReplaceDefinition(); return; }
  const definition = settings.multipleReplaceDefinitions.find(item => item.id === selectedMultipleReplaceId);
  if (!definition || !confirm(`删除多重替换定义“${definition.name}”？`)) return;
  const index = settings.multipleReplaceDefinitions.findIndex(item => item.id === selectedMultipleReplaceId);
  settings.multipleReplaceDefinitions = settings.multipleReplaceDefinitions.filter(item => item.id !== selectedMultipleReplaceId);
  persistSettings();
  if (settings.multipleReplaceDefinitions.length) selectMultipleReplaceDefinition(settings.multipleReplaceDefinitions[Math.min(index, settings.multipleReplaceDefinitions.length - 1)].id);
  else beginNewMultipleReplaceDefinition();
}

function moveMultipleReplaceRule(ruleId, direction) {
  const index = multipleReplaceDraft.replacements.findIndex(rule => rule.id === ruleId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= multipleReplaceDraft.replacements.length) return;
  clearMultipleReplaceHighlights();
  [multipleReplaceDraft.replacements[index], multipleReplaceDraft.replacements[nextIndex]] = [multipleReplaceDraft.replacements[nextIndex], multipleReplaceDraft.replacements[index]];
  multipleReplaceDraftDirty = true;
  renderMultipleReplaceForm();
  $('#multiple-replace-rules .multiple-replace-rule:nth-child(' + (nextIndex + 1) + ') input')?.focus();
}

function executeMultipleReplaceDefinition(definition, { inSelection, statusTarget = null } = {}) {
  const report = message => {
    if (statusTarget) statusTarget.textContent = message;
    else showToast(message);
  };
  const view = activeEditor();
  if (!view || !activeDoc || activeDoc.preventEditing) {
    report('当前没有可编辑文稿，定义已保存但无法执行。');
    return false;
  }
  try {
    const before = view.state.doc.toString();
    const result = applyMultipleReplace(before, definition, {
      ranges: view.state.selection.ranges.map(range => ({ from: range.from, to: range.to })),
      inSelection: inSelection === true
    });
    if (!result.matchCount) {
      report('没有匹配项；文稿未更改。');
      return false;
    }
    if (result.text !== before) {
      const selection = inSelection === true && result.selectedRanges.length
        ? EditorSelection.create(result.selectedRanges.map(range => EditorSelection.range(range.from, range.to)), Math.min(view.state.selection.mainIndex, result.selectedRanges.length - 1))
        : undefined;
      view.dispatch({ changes: result.changes, ...(selection ? { selection } : {}), userEvent: 'input.replace.all', scrollIntoView: true });
      applySearch(false);
      syncMenuState();
      persistSession();
    }
    report(`完成：${result.matchCount} 项替换。整组操作可用一次“撤销”恢复。`);
    return true;
  } catch (error) {
    report(`无法执行：${error?.message || '请检查正则表达式或规则'}`);
    return false;
  }
}

function applyMultipleReplaceDefinition() {
  const definition = saveMultipleReplaceDefinition(false);
  if (!definition) return;
  executeMultipleReplaceDefinition(definition, {
    inSelection: $('#multiple-replace-in-selection').checked,
    statusTarget: $('#multiple-replace-status')
  });
}

function runMultipleReplaceDefinitionById(id) {
  if (typeof id !== 'string') return;
  const definition = settings.multipleReplaceDefinitions.find(item => item.id === id);
  if (!definition) {
    showToast('该多重替换定义已不存在；菜单已更新。');
    syncMultipleReplaceMenu();
    return;
  }
  executeMultipleReplaceDefinition(definition, { inSelection: settings.multipleReplaceInSelection });
}

function highlightMultipleReplaceDefinition() {
  const view = activeEditor();
  if (!view || !activeDoc) {
    $('#multiple-replace-status').textContent = '当前没有可高亮的文稿。';
    return;
  }
  const definition = saveMultipleReplaceDefinition(false);
  if (!definition) return;
  try {
    const inSelection = $('#multiple-replace-in-selection').checked;
    const matches = findMultipleReplaceMatches(view.state.doc.toString(), definition, {
      ranges: view.state.selection.ranges.map(range => ({ from: range.from, to: range.to })),
      inSelection
    });
    view.dispatch({ effects: multipleReplaceHighlightEffect.of(matches) });
    $('#multiple-replace-status').textContent = matches.length
      ? `已高亮 ${matches.length} 处匹配项；所有规则均按当前文稿原文独立匹配。`
      : '没有找到匹配项；已清除现有多重替换高亮。';
  } catch (error) {
    clearMultipleReplaceHighlights(view);
    $('#multiple-replace-status').textContent = `无法高亮：${error?.message || '请检查正则表达式或规则'}`;
  }
}

function closeMultipleReplaceManager() {
  if (confirmDiscardMultipleReplaceDraft()) $('#multiple-replace-dialog').close();
}

function restoreMultipleReplaceManagerFocus() {
  const target = multipleReplaceManagerReturnFocus;
  multipleReplaceManagerReturnFocus = null;
  selectedMultipleReplaceId = null;
  multipleReplaceDraft = null;
  multipleReplaceDraftIsNew = false;
  multipleReplaceDraftDirty = false;
  multipleReplaceDraftInSelection = settings.multipleReplaceInSelection;
  restoreDialogFocus($('#multiple-replace-dialog'), target);
}

function populateLanguageMenu() {
  const allOptions = syntaxMenuOptions();
  const hidden = new Set(settings.hiddenSyntaxes);
  const current = allOptions.find(option => option.id === activeDoc?.language);
  const recent = settings.recentSyntaxes.slice().reverse()
    .map(id => allOptions.find(option => option.id === id)).filter(Boolean);
  const recentIds = new Set(recent.map(option => option.id));
  const currentHidden = current && hidden.has(current.id) && !recentIds.has(current.id)
    ? { ...current, label: `${current.label}（当前文稿；已隐藏）`, disabled: true }
    : null;
  const available = allOptions.filter(option => !hidden.has(option.id));
  const selectorOptions = document.createDocumentFragment();
  const appendOption = (parent, option) => {
    const element = document.createElement('option');
    element.value = option.id;
    element.textContent = option.label;
    element.disabled = option.disabled === true;
    parent.append(element);
  };
  if (currentHidden) appendOption(selectorOptions, currentHidden);
  if (recent.length) {
    const recentGroup = document.createElement('optgroup');
    recentGroup.label = '最近使用';
    recent.forEach(option => appendOption(recentGroup, option));
    selectorOptions.append(recentGroup);
    const allGroup = document.createElement('optgroup');
    allGroup.label = '所有语法';
    available.forEach(option => appendOption(allGroup, option));
    selectorOptions.append(allGroup);
  } else {
    available.forEach(option => appendOption(selectorOptions, option));
  }
  const selector = $('#language-select');
  selector.replaceChildren(selectorOptions);
  if (current) selector.value = current.id;
  $('#encoding-select').innerHTML = ENCODING_OPTIONS.map(option => `<option value="${option.id}">${option.label}</option>`).join('');
  $('#eol-select').innerHTML = LINE_ENDING_TYPES.map(value => `<option value="${value}">${value}</option>`).join('') + '<option value="Mixed" disabled>混合</option>';
  if (!window.cotedit?.isDesktop) $('#encoding-select').disabled = true;
}

function updateSyntaxMenuDialogCount() {
  const options = syntaxMenuOptions();
  const visible = options.filter(option => !draftHiddenSyntaxes.has(option.id)).length;
  $('#syntax-menu-count').textContent = `显示 ${visible} / ${options.length} 个语法`;
}

function filterSyntaxMenuDialog() {
  const query = $('#syntax-menu-filter').value.trim().toLocaleLowerCase();
  $('#syntax-menu-list').querySelectorAll('[data-syntax-row]').forEach(row => {
    row.hidden = !`${row.dataset.syntaxName} ${row.dataset.syntaxId}`.toLocaleLowerCase().includes(query);
  });
}

function renderSyntaxMenuDialog() {
  const list = $('#syntax-menu-list');
  list.replaceChildren();
  for (const option of syntaxMenuOptions()) {
    const row = document.createElement('label');
    row.className = 'syntax-menu-option';
    row.dataset.syntaxRow = '';
    row.dataset.syntaxId = option.id;
    row.dataset.syntaxName = option.label;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.syntaxId = option.id;
    checkbox.checked = !draftHiddenSyntaxes.has(option.id);
    const name = document.createElement('span');
    name.textContent = option.label;
    row.append(checkbox, name);
    list.append(row);
  }
  filterSyntaxMenuDialog();
  updateSyntaxMenuDialogCount();
}

function showSyntaxMenuDialog() {
  const dialog = $('#syntax-menu-dialog');
  if (dialog.open) return;
  draftHiddenSyntaxes = new Set(settings.hiddenSyntaxes);
  $('#syntax-menu-filter').value = '';
  renderSyntaxMenuDialog();
  dialog.showModal();
  $('#syntax-menu-filter').focus();
}

function applySyntaxMenuDialog() {
  if (!draftHiddenSyntaxes) return;
  const knownIds = new Set(syntaxMenuOptions().map(option => option.id));
  const retainedHidden = settings.hiddenSyntaxes.filter(id => !knownIds.has(id));
  const selectedHidden = syntaxMenuOptions().filter(option => draftHiddenSyntaxes.has(option.id)).map(option => option.id);
  settings.hiddenSyntaxes = [...new Set([...retainedHidden, ...selectedHidden])].slice(0, 200);
  persistSettings();
  applySettings();
  $('#syntax-menu-dialog').close();
  showToast('语法菜单显示设置已保存。');
}

function showSyntaxMappingConflictDialog() {
  const conflicts = refreshSyntaxMappingConflicts();
  if (!hasSyntaxMappingConflicts()) {
    showToast('当前没有重复的语法文件映射。');
    return;
  }
  const container = $('#syntax-mapping-conflict-tables');
  container.replaceChildren();
  const groups = [
    { key: 'extensions', label: '文件扩展名', display: value => `.${value}` },
    { key: 'filenames', label: '文件名', display: value => value },
    { key: 'interpreters', label: '解释器', display: value => value }
  ];
  for (const group of groups) {
    const entries = conflicts[group.key];
    if (!entries.length) continue;
    const section = document.createElement('section');
    section.className = 'syntax-mapping-conflict-section';
    const heading = document.createElement('h3');
    heading.textContent = group.label;
    const table = document.createElement('table');
    table.className = 'syntax-mapping-conflict-table';
    table.setAttribute('aria-label', `${group.label}冲突`);
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const label of ['映射规则', '自动选择的语法', '其他重复语法']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headerRow.append(th);
    }
    thead.append(headerRow);
    const tbody = document.createElement('tbody');
    for (const entry of entries) {
      const row = document.createElement('tr');
      for (const value of [group.display(entry.name), entry.primarySyntax, entry.duplicatedSyntaxes.join('、')]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      tbody.append(row);
    }
    table.append(thead, tbody);
    section.append(heading, table);
    container.append(section);
  }
  const dialog = $('#syntax-mapping-conflicts-dialog');
  if (!dialog.open) dialog.showModal();
  $('#syntax-mapping-conflicts-close').focus();
}

function noteRecentSyntax(id) {
  if (!id || id === 'plaintext' || !syntaxMenuOptions().some(option => option.id === id)) return;
  if (settings.recentSyntaxes.at(-1) === id) return;
  settings.recentSyntaxes = [...settings.recentSyntaxes.filter(item => item !== id), id].slice(-6);
  persistSettings();
}

function changeLanguage(id) {
  if (!activeDoc || (!LANGUAGE_OPTIONS.some(option => option.id === id) && !customSyntaxes.some(syntax => syntax.id === id))) return;
  const didChange = activeDoc.language !== id;
  activeDoc.language = id;
  if (didChange) noteRecentSyntax(id);
  editorView.dispatch({ effects: [
    languageCompartment.reconfigure(languageExtension(id, activeDoc.name)),
    symbolBalancingCompartment.reconfigure(symbolBalancingExtension(activeDoc)),
    spellCheckingCompartment.reconfigure(spellCheckingExtension(activeDoc)),
    automaticSubstitutionsCompartment.reconfigure(automaticSubstitutionEditorExtension(activeDoc)),
    completionCompartment.reconfigure(completionExtension(activeDoc)),
    indentCompartment.reconfigure(indentExtensions(activeDoc))
  ] });
  renderDocumentInfo();
  renderOutline();
  persistSession();
}

function newDocument() {
  const syntax = defaultSyntaxId();
  const extension = defaultSyntaxExtension();
  const doc = createDocument('', `未命名-${newDocNumber++}.${extension}`, null, false, { newDocumentLanguage: syntax });
  addDocument(doc);
  editorView.dispatch({ selection: { anchor: 0 } });
  editorView.focus();
}

async function openFiles() {
  try {
    let opened;
    if (window.cotedit?.isDesktop) {
      opened = await window.cotedit.openFiles();
    } else {
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = true;
      input.accept = '.txt,.md,.markdown,.json,.js,.ts,.tsx,.jsx,.html,.css,.py,.java,.c,.h,.cpp,.rs,.php,.sql,.xml,.yml,.yaml,.sh,.toml,.log,.txt,*/*';
      opened = await new Promise(resolve => {
        input.addEventListener('change', async () => resolve(await Promise.all([...input.files].map(async file => ({ name: file.name, path: null, text: await file.text() })))), { once: true });
        input.addEventListener('cancel', () => resolve([]), { once: true });
        input.click();
      });
    }
    const openedDocuments = [];
    for (const item of opened || []) {
      const doc = createDocument(item.text, item.name, item.path || null, true, item);
      openedDocuments.push(doc);
      addDocument(doc);
    }
    if (opened?.length) {
      const mixedCount = openedDocuments.filter(doc => getLineEndingSummary(doc).mixed).length;
      showToast(mixedCount ? `${opened.length} 个文稿已打开；${mixedCount} 个包含混合换行符，可点状态栏 ⚠ 检查。` : `${opened.length} 个文稿已打开`);
    }
  } catch (error) { showToast(`打开失败：${error.message || '无法读取文件'}`); }
}

async function openRecent(filePath) {
  try {
    if (!window.cotedit?.isDesktop) return;
    const item = await window.cotedit.openRecentPath(filePath);
    const doc = createDocument(item.text, item.name, item.path || null, true, item);
    addDocument(doc);
    showToast(getLineEndingSummary(doc).mixed ? `已打开 ${item.name}；文稿包含混合换行符，可点状态栏 ⚠ 检查。` : `已打开 ${item.name}`);
  } catch (error) { showToast(`打开最近文稿失败：${error.message || '无法读取文件'}`); }
}

async function openExternalDocument(filePath) {
  try {
    if (!window.cotedit?.isDesktop || typeof filePath !== 'string') return;
    const item = await window.cotedit.openExternalPath(filePath);
    const doc = createDocument(item.text, item.name, item.path || null, true, item);
    addDocument(doc);
    showToast(getLineEndingSummary(doc).mixed ? `已打开 ${item.name}；文稿包含混合换行符，可点状态栏 ⚠ 检查。` : `已打开 ${item.name}`);
  } catch (error) { showToast(`无法打开外部文稿：${error.message || '无法读取文件'}`); }
}

function openRemoteDocument(item) {
  if (!item || typeof item.sessionId !== 'string' || typeof item.text !== 'string') return;
  if (!editorView) { pendingRemoteDocuments.push(item); return; }
  const existing = documents.find(doc => doc.remoteSessionId === item.sessionId);
  if (existing) { switchDocument(existing); return; }
  const disconnectedBeforeOpen = pendingRemoteDisconnects.delete(item.sessionId);
  const doc = createDocument(item.text, item.name || '远程文稿.txt', null, true, {
    encoding: item.encoding,
    eol: item.eol,
    lineEndings: item.lineEndings,
    bom: item.bom,
    remoteSessionId: item.sessionId,
    remotePath: item.remotePath,
    remoteConnected: !disconnectedBeforeOpen,
    remoteFileType: item.fileType
  });
  addDocument(doc);
  const view = activeEditor();
  const lineNumber = Number.isInteger(item.lineNumber) ? item.lineNumber : 1;
  if (view && lineNumber > 1 && lineNumber <= view.state.doc.lines) {
    view.dispatch({ selection: { anchor: view.state.doc.line(lineNumber).from } });
  }
  renderAll();
  view?.focus();
  showToast(`已打开远程文稿：${doc.name}`);
  if (disconnectedBeforeOpen) showToast(`远程连接已断开：${doc.name} 仍可编辑，请另存为本机文件。`);
}

function handleRemoteDisconnect(remoteFile) {
  const doc = documents.find(item => item.remoteSessionId === remoteFile?.id);
  if (!doc) { if (typeof remoteFile?.id === 'string') pendingRemoteDisconnects.add(remoteFile.id); return; }
  doc.remoteConnected = false;
  renderAll();
  if (isDirty(doc)) {
    const makeLocalCopy = confirm(`与远程文稿“${doc.name}”的连接已断开。是否立即另存为本机文件？\n\n选择“确定”另存副本；选择“取消”继续编辑，之后仍可通过“保存”另存。`);
    if (makeLocalCopy) {
      if (doc !== activeDoc) switchDocument(doc);
      void saveDocument(true);
      return;
    }
    showToast(`连接已断开；“${doc.name}”的更改仍在本机窗口中。`);
  } else showToast(`远程连接已断开：“${doc.name}”仍可编辑；保存时将另存为本机文件。`);
}

async function printDocument() {
  if (!activeDoc) return;
  if (!window.cotedit?.isDesktop) { window.print(); return; }
  try {
    const view = activeEditor();
    const selection = view?.state.selection.main;
    const result = await window.cotedit.printDocument({
      name: activeDoc.name,
      text: view?.state.doc.toString() ?? activeDoc.text,
      selectionText: selection && !selection.empty ? view.state.sliceDoc(selection.from, selection.to) : '',
      selectionStartLine: selection && !selection.empty ? view.state.doc.lineAt(selection.from).number : 1,
      pageSetup: { ...settings, fontType: fontTypeForDocument(), writingDirection: activeDoc.writingDirection }
    });
    if (result?.canceled) return;
    if (!result?.success) showToast(`打印未完成${result?.error ? `：${result.error}` : ''}`);
  } catch (error) { showToast(`无法打印：${error.message || '请重试'}`); }
}

async function runUserScript(id) {
  const view = activeEditor();
  if (!window.cotedit?.isDesktop || !view || !activeDoc) return;
  let worker;
  let workerUrl;
  try {
    const script = await window.cotedit.getScript(id);
    if (!script || typeof script.source !== 'string' || script.source.length > 256 * 1024) throw new Error('脚本不可用或超过大小限制。');
    const selection = view.state.selection.main;
    const from = selection.empty ? 0 : selection.from;
    const to = selection.empty ? view.state.doc.length : selection.to;
    const input = {
      text: view.state.doc.sliceString(from, to),
      selection: selection.empty ? '' : view.state.sliceDoc(selection.from, selection.to),
      filename: activeDoc.name,
      language: activeDoc.language
    };
    const workerSource = `self.onmessage = async ({ data }) => {\n  try {\n    const transform = async input => {\n${script.source}\n    };\n    const result = await transform(data);\n    if (typeof result !== 'string') throw new Error('脚本必须返回字符串。');\n    self.postMessage({ ok: true, result });\n  } catch (error) { self.postMessage({ ok: false, error: String(error?.message || error).slice(0, 500) }); }\n};`;
    workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    worker = new Worker(workerUrl);
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('脚本运行超时（1.5 秒）。')), 1500);
      worker.onmessage = event => {
        clearTimeout(timeout);
        if (!event.data?.ok) reject(new Error(event.data?.error || '脚本执行失败。'));
        else resolve(event.data.result);
      };
      worker.onerror = event => {
        clearTimeout(timeout);
        reject(new Error(event.message || '脚本无法运行。'));
      };
      worker.postMessage(input);
    });
    if (result.length > 12_000_000) throw new Error('脚本输出超过文稿大小限制。');
    view.dispatch({ changes: { from, to, insert: result }, selection: { anchor: from + result.length }, userEvent: 'input.script' });
    view.focus();
    showToast(`脚本已运行：${script.name}`);
  } catch (error) { showToast(`脚本运行失败：${error.message || '请检查脚本'}`); }
  finally {
    worker?.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
  }
}

async function saveDocument(saveAs = false) {
  if (!activeDoc || !editorView) return false;
  activeDoc.text = editorView.state.doc.toString();
  const textToSave = applyLineEndings(activeDoc.text, activeDoc.lineEndings || [], activeDoc.eol || 'LF');
  try {
    if (window.cotedit?.isDesktop) {
      if (!saveAs && activeDoc.remoteSessionId && activeDoc.remoteConnected) {
        const result = await window.cotedit.saveRemoteDocument({ sessionId: activeDoc.remoteSessionId, text: textToSave, encoding: activeDoc.encoding, bom: activeDoc.bom });
        if (!result?.success) throw new Error('远程端未接受保存请求。');
      } else {
        const result = await window.cotedit.saveFile({ path: saveAs ? null : activeDoc.path, name: activeDoc.name, text: textToSave, encoding: activeDoc.encoding, bom: activeDoc.bom });
        if (result.canceled) return false;
        activeDoc.path = result.path;
        activeDoc.name = result.name;
        activeDoc.fileSizeBytes = Number.isSafeInteger(result.fileSizeBytes) && result.fileSizeBytes >= 0 ? result.fileSizeBytes : null;
        activeDoc.fileCreatedAtMs = Number.isFinite(result.fileCreatedAtMs) && result.fileCreatedAtMs > 0 ? result.fileCreatedAtMs : null;
        activeDoc.fileModifiedAtMs = Number.isFinite(result.fileModifiedAtMs) && result.fileModifiedAtMs > 0 ? result.fileModifiedAtMs : null;
        activeDoc.filePermissions = typeof result.filePermissions === 'string' && /^[0-7]{3,4} \(-[rwxstST-]{9}\)$/.test(result.filePermissions) ? result.filePermissions : null;
        activeDoc.fileOwnerIds = normalizeDocumentFileOwnerIds(result.fileOwnerIds);
        activeDoc.fileTags = normalizeDocumentFileTags(result.fileTags);
        rememberDocumentWritingDirection(activeDoc.path, activeDoc.writingDirection);
        if (activeDoc.remoteSessionId) {
          await window.cotedit.closeRemoteDocument(activeDoc.remoteSessionId).catch(() => {});
          activeDoc.remoteSessionId = null;
          activeDoc.remotePath = '';
          activeDoc.remoteConnected = false;
        }
      }
    } else {
      const filename = saveAs ? (prompt('文件名', activeDoc.name) || '') : activeDoc.name;
      if (!filename) return false;
      if (activeDoc.encoding !== 'utf8') showToast('浏览器预览仅能以 UTF-8 下载；桌面版支持所选编码。');
      const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
      URL.revokeObjectURL(url);
      activeDoc.name = filename;
    }
    activeDoc.savedText = activeDoc.text;
    activeDoc.savedEncoding = activeDoc.encoding;
    activeDoc.savedEol = activeDoc.eol;
    activeDoc.savedLineEndings = [...(activeDoc.lineEndings || [])];
    activeDoc.savedBom = activeDoc.bom;
    activeDoc.restored = false;
    const nextLanguage = languageForDocument(activeDoc.name, activeDoc.text);
    if (activeDoc.language !== nextLanguage) {
      activeDoc.language = nextLanguage;
      editorView.dispatch({ effects: [
        languageCompartment.reconfigure(languageExtension(nextLanguage, activeDoc.name)),
        symbolBalancingCompartment.reconfigure(symbolBalancingExtension(activeDoc)),
        spellCheckingCompartment.reconfigure(spellCheckingExtension(activeDoc)),
        automaticSubstitutionsCompartment.reconfigure(automaticSubstitutionEditorExtension(activeDoc)),
        completionCompartment.reconfigure(completionExtension(activeDoc)),
        indentCompartment.reconfigure(indentExtensions(activeDoc))
      ] });
      syncIndentControls();
    }
    void persistSession({ immediate: true }); renderAll(); showToast('已保存');
    return true;
  } catch (error) { showToast(`保存失败：${error.message || '请重试'}`); return false; }
}

function revertToSaved() {
  if (!activeDoc || !editorView || !isDirty(activeDoc)) return;
  if (!confirm(`将“${activeDoc.name}”恢复到上次保存的版本？当前未保存的更改将丢失。`)) return;
  const view = activeEditor();
  const text = activeDoc.savedText;
  const savedLineEndings = Array.isArray(activeDoc.savedLineEndings) ? [...activeDoc.savedLineEndings] : getLineEndings(text);
  const savedEol = LINE_ENDING_TYPES.includes(activeDoc.savedEol) ? activeDoc.savedEol : detectLineEnding(text);
  const cursor = Math.min(view.state.selection.main.head, text.length);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: cursor },
    effects: [setDocumentLineEndings.of(savedLineEndings), setDocumentLineEndingFallback.of(savedEol)]
  });
  activeDoc.text = text;
  activeDoc.encoding = activeDoc.savedEncoding;
  activeDoc.eol = savedEol;
  activeDoc.lineEndings = savedLineEndings;
  activeDoc.bom = activeDoc.savedBom;
  void persistSession({ immediate: true });
  renderAll();
  showToast('已恢复到上次保存的版本');
}

async function revealActiveFile() {
  if (!activeDoc?.path || !window.cotedit?.isDesktop) return;
  try { await window.cotedit.revealFile(activeDoc.path); }
  catch (error) { showToast(`无法显示文件：${error.message || '请重试'}`); }
}

async function copyActiveFilePath() {
  const isRemote = Boolean(activeDoc?.remoteSessionId);
  const filePath = isRemote ? (activeDoc.remotePath || activeDoc.name) : activeDoc?.path;
  if (!filePath) return;
  if (!window.cotedit?.isDesktop) {
    try { await navigator.clipboard.writeText(filePath); showToast('已复制文件路径'); }
    catch { showToast('浏览器不允许访问剪贴板'); }
    return;
  }
  try {
    if (isRemote) await window.cotedit.copyRemoteFilePath(filePath);
    else await window.cotedit.copyFilePath(filePath);
    showToast('已复制文件路径');
  }
  catch (error) { showToast(`复制路径失败：${error.message || '请重试'}`); }
}

async function closeDocument(id) {
  const doc = documents.find(item => item.id === id);
  if (!doc) return;
  if (isDirty(doc)) {
    const save = confirm(`“${doc.name}”有未保存的更改。\n\n确定：保存并关闭\n取消：继续编辑`);
    if (save) {
      if (doc !== activeDoc) switchDocument(doc);
      if (!await saveDocument()) return;
    } else if (!confirm('放弃未保存的更改并关闭？')) return;
  }
  const wasActive = doc === activeDoc;
  if (doc.remoteSessionId && typeof window.cotedit?.closeRemoteDocument === 'function') {
    void window.cotedit.closeRemoteDocument(doc.remoteSessionId).catch(() => {});
  }
  documents = documents.filter(item => item !== doc);
  if (wasActive) {
    const next = documents[Math.max(0, documents.length - 1)];
    if (next) switchDocument(next);
    else newDocument();
  }
  void persistSession({ immediate: true }); renderAll();
}

function showSearchPanel() {
  searchHighlightsSuppressed = false;
  $('#search-panel').classList.remove('hidden');
  $('#find-button').setAttribute('aria-expanded', 'true');
  applySearch(false);
  updateSearchCount();
  $('#search-query').focus();
  $('#search-query').select();
  syncMenuState();
}

function searchPanelVisible() { return !$('#search-panel').classList.contains('hidden'); }
function syncDiacriticSearchButton() {
  const button = $('#match-diacritics');
  if (!button) return;
  button.classList.toggle('selected', searchOptions.diacriticInsensitive);
  button.setAttribute('aria-pressed', String(searchOptions.diacriticInsensitive));
  button.disabled = searchOptions.regexp;
  button.setAttribute('aria-disabled', String(searchOptions.regexp));
}
function makeSearchQuery() {
  const query = normalizeSearchLineEndings($('#search-query').value);
  return createSearchQuery({ search: searchOptions.regexp ? translateIcuRegex(query) : query, caseSensitive: searchOptions.caseSensitive, regexp: searchOptions.regexp, wholeWord: searchOptions.wholeWord, diacriticInsensitive: searchOptions.diacriticInsensitive, replace: $('#replace-query').value });
}

const searchMatchDecoration = Decoration.mark({ class: 'cm-searchMatch' });
const selectedSearchMatchDecoration = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' });

const multipleReplaceHighlightEffect = StateEffect.define();
const multipleReplaceMatchDecoration = Decoration.mark({ class: 'cm-multipleReplaceMatch' });
const multipleReplaceHighlightField = StateField.define({
  create: () => Decoration.none,
  update(decorations, transaction) {
    if (transaction.docChanged) return Decoration.none;
    let next = decorations;
    for (const effect of transaction.effects) {
      if (!effect.is(multipleReplaceHighlightEffect)) continue;
      const ranges = effect.value.map(match => multipleReplaceMatchDecoration.range(match.from, match.to));
      next = ranges.length ? Decoration.set(ranges, true) : Decoration.none;
    }
    return next;
  },
  provide: field => EditorView.decorations.from(field)
});

function clearMultipleReplaceHighlights(view = activeEditor()) {
  if (!view || view.state.field(multipleReplaceHighlightField) === Decoration.none) return;
  view.dispatch({ effects: multipleReplaceHighlightEffect.of([]) });
}

function searchDecorations(view) {
  if (searchHighlightsSuppressed || (!searchPanelVisible() && !findAllHighlightsActive)) return Decoration.none;
  try {
    const matches = collectVisibleSearchHighlights(view.state, makeSearchQuery(), view.visibleRanges);
    const decorations = matches.map(match => (match.selected ? selectedSearchMatchDecoration : searchMatchDecoration).range(match.from, match.to));
    return decorations.length ? Decoration.set(decorations, true) : Decoration.none;
  } catch { return Decoration.none; }
}

const editorSearchHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = searchDecorations(view); }
  update(update) { this.decorations = searchDecorations(update.view); }
}, { decorations: plugin => plugin.decorations });

function applySearch(move = false, backwards = false, { preserveHighlightSuppression = false } = {}) {
  const view = activeEditor();
  if (!view) return;
  if (!preserveHighlightSuppression) searchHighlightsSuppressed = false;
  try {
    view.dispatch({ effects: setSearchQuery.of(makeSearchQuery()) });
    if (move) moveToSearchMatch(backwards);
    updateSearchCount();
  } catch { $('#match-count').textContent = '正则无效'; }
}

function getSearchMatches() {
  const view = activeEditor();
  const query = $('#search-query').value;
  if (!query || !view) return [];
  return collectSearchMatches(view.state, makeSearchQuery());
}

function selectAllSearchMatches() {
  const view = activeEditor();
  if (!view) return;
  try {
    const matches = getSearchMatches();
    if (!matches.length) return;
    const ranges = matches.map(match => EditorSelection.range(match.index, match.index + match[0].length));
    searchNavigation = null;
    view.dispatch({ selection: EditorSelection.create(ranges), effects: editorScrollIntoView(matches[0].index) });
    view.focus();
  } catch { $('#match-count').textContent = '正则无效'; }
}

function findAllMatches() {
  if (!activeEditor()) return;
  findAllHighlightsActive = true;
  searchHighlightsSuppressed = false;
  showSearchPanel();
}

function highlightAllSearchMatches() {
  const view = activeEditor();
  if (!view) return;
  if (!$('#search-query').value.trim()) { showSearchPanel(); return; }
  findAllHighlightsActive = true;
  searchHighlightsSuppressed = false;
  applySearch(false);
  syncMenuState();
}

function removeSearchHighlights() {
  findAllHighlightsActive = false;
  searchHighlightsSuppressed = true;
  applySearch(false, false, { preserveHighlightSuppression: true });
  syncMenuState();
}

function selectedText() {
  const view = activeEditor();
  const selection = view?.state.selection.main;
  return selection && !selection.empty ? view.state.sliceDoc(selection.from, selection.to) : '';
}

function useSelectionForFind() {
  const text = selectedText();
  if (!text) return;
  $('#search-query').value = text;
  showSearchPanel();
  applySearch(false);
}

function useSelectionForReplace() {
  const text = selectedText();
  if (!text) return;
  $('#replace-query').value = text;
  showSearchPanel();
  $('#replace-query').focus();
  $('#replace-query').select();
}

function focusReplaceField() {
  showSearchPanel();
  $('#replace-query').focus();
}

function replaceAndFindNext() {
  replaceSearchMatch(false);
  applySearch(true);
}

function moveToSearchMatch(backwards = false) {
  const view = activeEditor();
  if (!view) return;
  const matches = getSearchMatches();
  if (!matches.length) return;
  const selection = view.state.selection.main;
  const key = JSON.stringify([$('#search-query').value, searchOptions.regexp, searchOptions.caseSensitive, searchOptions.wholeWord, searchOptions.diacriticInsensitive]);
  const previousIndex = searchNavigation?.key === key && searchNavigation.doc === view.state.doc
    ? searchNavigation.index
    : -1;
  const matchIndex = nextSearchMatchIndex(matches, selection, backwards, previousIndex);
  if (matchIndex < 0) return;
  const match = matches[matchIndex];
  searchNavigation = { key, doc: view.state.doc, index: matchIndex };
  view.dispatch({
    selection: { anchor: match.index, head: match.index + match[0].length },
    effects: editorScrollIntoView(match.index)
  });
  view.focus();
}

function updateSearchCount() {
  const query = $('#search-query').value;
  const canReplace = Boolean(query && activeDoc && !activeDoc.preventEditing);
  $('#replace-one').disabled = !canReplace;
  $('#replace-all').disabled = !canReplace;
  if (!query) { $('#match-count').textContent = ''; return; }
  try {
    $('#match-count').textContent = `${getSearchMatches().length} 项`;
  } catch { $('#match-count').textContent = '正则无效'; }
}

function expandReplacement(match, replacement) {
  if (!searchOptions.regexp) return replacement;
  return replacement.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>)/g, (token, key) => {
    if (key === '$') return '$';
    if (key === '&') return match[0];
    if (key === '0') return match[0];
    if (key === '`') return match.input.slice(0, match.index);
    if (key === "'") return match.input.slice(match.index + match[0].length);
    if (key.startsWith('<')) return match.groups?.[key.slice(1, -1)] ?? token;
    const group = Number(key);
    return group > 0 && group < match.length ? (match[group] ?? '') : token;
  });
}

function replaceSearchMatch(all = false) {
  const view = activeEditor();
  if (!view || activeDoc?.preventEditing) return;
  try {
    view.dispatch({ effects: setSearchQuery.of(makeSearchQuery()) });
    const matches = getSearchMatches();
    if (!matches.length) return;
    if (all) {
      const replacement = $('#replace-query').value;
      const changes = createSearchReplacementChanges(matches, match => expandReplacement(match, replacement));
      view.dispatch({ changes, userEvent: 'input.replace.all' });
    } else {
      const selection = view.state.selection.main;
      const match = matches.find(item => item.index === selection.from && item.index + item[0].length === selection.to)
        || matches.find(item => item.index >= selection.to)
        || matches[0];
      const replacement = $('#replace-query').value;
      const [change] = createSearchReplacementChanges([match], currentMatch => expandReplacement(currentMatch, replacement));
      view.dispatch({
        changes: change,
        selection: { anchor: change.from + change.insert.length },
        userEvent: 'input.replace'
      });
    }
    view.focus();
    updateSearchCount();
  } catch { $('#match-count').textContent = '正则无效'; }
}

function closeSearchPanel() {
  $('#search-panel').classList.add('hidden');
  $('#find-button').setAttribute('aria-expanded', 'false');
  applySearch(false, false, { preserveHighlightSuppression: true });
  editorView?.focus();
  syncMenuState();
}

function setTheme(theme) {
  settings.theme = theme;
  persistSettings(); applySettings();
}

function setIndent(value) {
  const indentation = value === 'tab' ? 'tab' : typeof value === 'string' && /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 99 ? String(Number(value)) : null;
  if (!indentation) { showToast('缩进宽度必须是 1–99 的整数。'); syncIndentControls(); return false; }
  if (activeDoc) {
    const indentByLanguage = { ...settings.indentByLanguage, [activeDoc.language]: indentation };
    settings.indentByLanguage = Object.fromEntries(Object.entries(indentByLanguage).slice(-200));
  } else settings.indent = indentation;
  persistSettings(); applySettings();
  return true;
}

function setTabWidth(value) {
  const width = Number(value);
  if (!Number.isInteger(width) || width < 1 || width > 99) { showToast('Tab 宽度必须是 1–99 的整数。'); return false; }
  settings.tabWidth = width;
  persistSettings();
  applySettings();
  return true;
}

function showCustomWidthDialog(mode = 'tab') {
  const dialog = $('#custom-width-dialog');
  if (dialog.open) return;
  customWidthMode = mode === 'indent' ? 'indent' : 'tab';
  customWidthReturnFocus = document.activeElement;
  const indentation = indentationFor();
  const currentWidth = customWidthMode === 'tab'
    ? settings.tabWidth
    : indentation === 'tab' ? settings.tabWidth : Number(indentation) || settings.tabWidth;
  $('#custom-width-title').textContent = customWidthMode === 'tab' ? '自定义 Tab 宽度' : '自定义当前语法缩进宽度';
  $('#custom-width-description').textContent = customWidthMode === 'tab'
    ? 'Tab 字符在编辑器与打印中的显示列数；独立于空格缩进宽度。'
    : '当前语法使用的空格缩进数量；制表符缩进可在格式菜单单独选择。';
  $('#custom-width-label').textContent = customWidthMode === 'tab' ? 'Tab 显示列数' : '空格数';
  $('#custom-width-value').value = String(currentWidth);
  $('#custom-width-status').textContent = '请输入 1–99 的整数。';
  if (customWidthMode === 'indent') syncIndentControls();
  dialog.showModal();
  $('#custom-width-value').focus();
  $('#custom-width-value').select();
}

function closeCustomWidthDialog() {
  const target = customWidthReturnFocus;
  customWidthReturnFocus = null;
  if (target?.isConnected && target !== document.body && !target.closest?.('.hidden, [hidden]')) target.focus();
  else activeEditor()?.focus();
}

function activeEditor() {
  if (secondaryView?.hasFocus) return secondaryView;
  if (editorView?.hasFocus) return editorView;
  return focusedView || editorView;
}

const PANEL_TRIGGER_IDS = Object.freeze({
  'outline-panel': 'outline-toggle',
  'character-panel': 'inspector-toggle',
  'warnings-panel': 'warnings-toggle',
  'document-inspector-panel': null
});

function closePanel(id, restoreFocus = false) {
  const panel = $(`#${id}`);
  const selectionPopover = id === 'character-panel' && panel.dataset.mode === 'selection';
  panel.classList.add('hidden');
  if (id === 'character-panel') {
    delete panel.dataset.mode;
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    panel.style.removeProperty('right');
    panel.style.removeProperty('bottom');
    panel.setAttribute('aria-label', 'Unicode 字符检查器');
    panel.querySelector('.floating-panel-head strong').textContent = 'Unicode 字符';
  }
  if (id === 'warnings-panel') { clearTimeout(warningsScanTimer); warningsScanId++; }
  const triggerId = PANEL_TRIGGER_IDS[id];
  if (!triggerId) {
    if (restoreFocus && id === 'document-inspector-panel') activeEditor()?.focus();
    syncMenuState();
    return;
  }
  const trigger = $(`#${triggerId}`);
  trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) selectionPopover ? activeEditor()?.focus() : trigger.focus();
  syncMenuState();
}

function togglePanel(id) {
  const panel = $(`#${id}`);
  const opening = panel.classList.contains('hidden');
  Object.keys(PANEL_TRIGGER_IDS).forEach(other => { if (other !== id) closePanel(other); });
  if (opening) {
    panel.classList.remove('hidden');
    $(`#${PANEL_TRIGGER_IDS[id]}`).setAttribute('aria-expanded', 'true');
  } else closePanel(id);
  if (id === 'character-panel' && opening) updateCharacterDetails();
  if (id === 'outline-panel' && opening) renderOutline();
  if (id === 'warnings-panel' && opening) updateEncodingWarnings();
  syncMenuState();
}

function toggleSplit() {
  if (splitEnabled) destroySecondaryEditor();
  else createSecondaryEditor();
  $('#split-toggle').setAttribute('aria-pressed', String(splitEnabled));
  syncMenuState();
  if (splitEnabled) secondaryView?.focus();
  else editorView?.focus();
}

function focusOtherSplitEditor() {
  if (!splitEnabled || !editorView || !secondaryView) return;
  (activeEditor() === secondaryView ? editorView : secondaryView).focus();
}

function togglePreventEditing() {
  const view = activeEditor();
  if (!activeDoc || !view) return;
  activeDoc.preventEditing = !activeDoc.preventEditing;
  view.dispatch({ effects: readOnlyCompartment.reconfigure(editabilityExtensions(activeDoc.preventEditing)) });
  syncEditorAccessibility();
  if (searchPanelVisible()) updateSearchCount();
  syncMenuState();
  persistSession();
}

function setDocumentWritingDirection(direction) {
  const view = activeEditor();
  if (!activeDoc || !view) return;
  const value = direction === 'rtl' ? 'rtl' : 'ltr';
  activeDoc.writingDirection = value;
  rememberDocumentWritingDirection(activeDoc.path, value);
  view.dispatch({ effects: directionCompartment.reconfigure(EditorView.contentAttributes.of({ dir: value })) });
  syncMenuState();
  persistSession();
}

function editorScrollIntoView(position) {
  return settings.verticalText
    ? EditorView.scrollIntoView(position, { x: 'center', y: 'center' })
    : EditorView.scrollIntoView(position);
}

function jumpToLine(lineNumber) {
  const view = activeEditor();
  if (!view) return;
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, Number(lineNumber) || 1)));
  view.dispatch({ selection: { anchor: line.from }, effects: editorScrollIntoView(line.from) });
  view.focus();
}

function jumpToSelection() {
  const view = activeEditor();
  const selection = view?.state.selection.main;
  if (!view || !selection || selection.empty) return;
  view.dispatch({ effects: editorScrollIntoView(selection.from) });
  view.focus();
}

let documentInspectorCharacterRenderId = 0;

async function refreshDocumentInspectorCharacter(character) {
  const renderId = ++documentInspectorCharacterRenderId;
  const state = $('#document-inspector-character-state');
  const codePoints = $('#document-inspector-character-code-points');
  const name = $('#document-inspector-character-name');
  const block = $('#document-inspector-character-block');
  const category = $('#document-inspector-character-category');
  if (!state || !codePoints || !name || !block || !category) return;

  if (!character) {
    state.textContent = '未选择单个字符';
    codePoints.textContent = '—';
    name.textContent = '—';
    block.textContent = '—';
    category.textContent = '—';
    return;
  }

  state.textContent = '正在读取 Unicode 字符信息…';
  try {
    const scalars = Array.from(character);
    const metadata = await Promise.all(scalars.map(scalar => getUnicodeScalarInfo(scalar.codePointAt(0))));
    if (renderId !== documentInspectorCharacterRenderId) return;
    codePoints.textContent = metadata.map(item => item?.codePointLabel || '未知码位').join(' ');
    state.textContent = scalars.length === 1
      ? '已选择一个字符'
      : `已选择一个字素簇（${scalars.length} 个 Unicode 标量）`;
    if (metadata.length === 1 && metadata[0]) {
      const item = metadata[0];
      name.textContent = item.name || (item.categoryCode === 'Cn' ? '未分配码位' : '无 Unicode 名称');
      block.textContent = item.blockName || '无命名 Unicode 区块';
      category.textContent = `${item.categoryCode} · ${categoryLabelsChinese[item.categoryCode] || item.categoryName}`;
    } else {
      name.textContent = '—';
      block.textContent = '—';
      category.textContent = '—';
    }
  } catch (error) {
    if (renderId !== documentInspectorCharacterRenderId) return;
    state.textContent = `Unicode 信息读取失败：${error.message || '请重试'}`;
    codePoints.textContent = '—';
    name.textContent = '—';
    block.textContent = '—';
    category.textContent = '—';
  }
}

function refreshDocumentInspectorFileTags() {
  const element = $('#document-inspector-fileTags');
  if (!element) return;
  element.replaceChildren();
  if (activeDoc.remoteSessionId) {
    element.textContent = '远程文稿无本地文件';
    return;
  }
  if (!activeDoc.path) {
    element.textContent = '无本地文件';
    return;
  }
  const tags = normalizeDocumentFileTags(activeDoc.fileTags);
  if (tags === null) {
    element.textContent = '仅 macOS';
    return;
  }
  if (!tags.length) {
    element.textContent = '—';
    return;
  }
  const list = document.createElement('span');
  list.className = 'document-inspector-tags';
  for (const tag of tags) {
    const chip = document.createElement('span');
    chip.className = 'document-inspector-tag';
    const swatch = document.createElement('span');
    swatch.className = `document-inspector-tag-swatch is-${tag.color}`;
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = tag.name;
    chip.append(swatch, name);
    list.append(chip);
  }
  element.append(list);
}

function refreshDocumentInspector() {
  if (!activeDoc) return;
  const view = activeEditor();
  const text = view?.state.doc.toString() ?? activeDoc.text ?? '';
  const selection = view?.state.selection.main;
  const inspectorCharacter = getDocumentInspectorCharacter(text, view?.state.selection.ranges?.[0]);
  const line = selection ? view.state.doc.lineAt(selection.head) : null;
  const stats = getDocumentInspectorStats({
    text,
    lineCount: view?.state.doc.lines,
    lineNumber: line?.number,
    linePrefix: line && selection ? view.state.doc.sliceString(line.from, selection.head) : '',
    selectionText: selection && !selection.empty
      ? view.state.doc.sliceString(selection.from, selection.to)
      : null
  });
  const values = {
    name: activeDoc.name || '未命名文稿',
    path: activeDoc.path || '尚未保存到文件',
    fileCreated: formatDocumentFileTimestamp(activeDoc.fileCreatedAtMs) || (activeDoc.path && !activeDoc.remoteSessionId ? '不可用' : '无本地文件'),
    fileModified: formatDocumentFileTimestamp(activeDoc.fileModifiedAtMs) || (activeDoc.path && !activeDoc.remoteSessionId ? '不可用' : '无本地文件'),
    fileSize: formatDocumentFileSize(activeDoc.fileSizeBytes) || (activeDoc.remoteSessionId ? '远程文稿无本地文件' : '无本地文件'),
    filePermissions: activeDoc.filePermissions || (activeDoc.remoteSessionId ? '远程文稿无本地文件' : activeDoc.path ? '不可用' : '无本地文件'),
    fileOwner: formatDocumentFileOwnerIds(activeDoc.fileOwnerIds) || (activeDoc.remoteSessionId ? '远程文稿无本地文件' : activeDoc.path ? '不可用' : '无本地文件'),
    encoding: activeDoc.encoding || 'utf8',
    lineEnding: displayedLineEnding(activeDoc),
    syntax: $('#language-select')?.selectedOptions?.[0]?.textContent || activeDoc.language || '纯文本',
    lineCount: String(stats.lineCount),
    wordCount: String(stats.words),
    characterCount: String(stats.characters),
    length: String(text.length),
    cursorPosition: view ? `行 ${stats.cursorLine}，列 ${stats.cursorColumn}` : '—',
    selectionCharacters: stats.selectionCharacters == null ? '无' : `${stats.selectionCharacters} 个字符`,
    saveState: activeDoc.path && !isDirty(activeDoc) ? '已保存' : '有未保存的更改'
  };
  for (const [key, value] of Object.entries(values)) {
    const element = $(`#document-inspector-${key}`);
    if (element) element.textContent = value;
  }
  refreshDocumentInspectorFileTags();
  const revealButton = $('#document-inspector-reveal');
  if (revealButton) revealButton.hidden = !(window.cotedit?.isDesktop === true && Boolean(activeDoc.path) && !activeDoc.remoteSessionId);
  void refreshDocumentInspectorCharacter(inspectorCharacter);
}

function toggleDocumentInspector() {
  const panel = $('#document-inspector-panel');
  if (!panel.classList.contains('hidden')) {
    closePanel('document-inspector-panel', true);
    return;
  }
  if (!activeDoc) { showToast('请先打开或新建文稿'); return; }
  Object.keys(PANEL_TRIGGER_IDS).forEach(id => {
    if (id !== 'document-inspector-panel') closePanel(id);
  });
  refreshDocumentInspector();
  panel.classList.remove('hidden');
  syncMenuState();
}

function inspectorPanelIsVisible() {
  return Object.keys(PANEL_TRIGGER_IDS).some(id => !$(`#${id}`).classList.contains('hidden'));
}

function toggleInspectorGroup() {
  const visiblePanel = Object.keys(PANEL_TRIGGER_IDS).find(id => !$(`#${id}`).classList.contains('hidden'));
  if (visiblePanel) closePanel(visiblePanel, true);
  else toggleDocumentInspector();
  syncMenuState();
}

function showGoToLineDialog() {
  const dialog = $('#goto-line-dialog');
  const input = $('#goto-line-number');
  const view = activeEditor();
  if (!dialog || !view) return;
  input.max = String(view.state.doc.lines);
  input.value = String(view.state.doc.lineAt(view.state.selection.main.head).number);
  $('#goto-line-error').textContent = '';
  dialog.showModal();
  input.focus();
  input.select();
}

function updateUnicodeCodePointPreview() {
  const input = $('#unicode-codepoint-input');
  const output = $('#unicode-codepoint-preview');
  const label = $('#unicode-codepoint-label');
  const error = $('#unicode-codepoint-error');
  const insertButton = $('#unicode-codepoint-insert');
  const codePoint = parseUnicodeCodePoint(input.value);
  insertButton.disabled = codePoint === null;
  if (codePoint === null) {
    output.textContent = input.value ? '无效' : '—';
    label.textContent = '';
    error.textContent = input.value ? '请输入有效的 Unicode 标量码点（U+0000–U+10FFFF，不含代理项）。' : '';
    return;
  }
  const character = String.fromCodePoint(codePoint);
  output.textContent = character === '\n' ? '↵' : character === '\r' ? '␍' : character === '\t' ? '⇥' : codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f) ? '◌' : character;
  label.textContent = `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
  error.textContent = '';
}

function renderRecentUnicodeCodePoints() {
  const section = $('#unicode-codepoint-history-section');
  const container = $('#unicode-codepoint-history');
  const input = $('#unicode-codepoint-input');
  container.replaceChildren();
  const recent = settings.recentUnicodeCodePoints;
  section.hidden = recent.length === 0;
  for (const codePoint of recent) {
    const label = `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button unicode-codepoint-history-button';
    button.textContent = label;
    button.setAttribute('aria-label', `填入最近使用的码点 ${label}`);
    button.addEventListener('click', () => {
      input.value = label;
      updateUnicodeCodePointPreview();
      input.focus();
      input.select();
    });
    container.append(button);
  }
}

function insertLiteralText(text) {
  const view = activeEditor();
  if (!view || !activeDoc || activeDoc.preventEditing || typeof text !== 'string') return false;
  view.dispatch({ ...view.state.replaceSelection(text), userEvent: 'input.type', scrollIntoView: true });
  view.focus();
  return true;
}

function showUnicodeCodePointDialog() {
  if (!activeDoc || activeDoc.preventEditing) return;
  const dialog = $('#unicode-codepoint-dialog');
  const input = $('#unicode-codepoint-input');
  input.value = '';
  renderRecentUnicodeCodePoints();
  updateUnicodeCodePointPreview();
  dialog.showModal();
  input.focus();
}

function insertUnicodeCodePoint(event) {
  event.preventDefault();
  const input = $('#unicode-codepoint-input');
  const codePoint = parseUnicodeCodePoint(input.value);
  const view = activeEditor();
  if (codePoint === null) {
    updateUnicodeCodePointPreview();
    input.focus();
    return;
  }
  if (!view || !activeDoc || activeDoc.preventEditing) {
    $('#unicode-codepoint-dialog').close();
    return;
  }
  view.dispatch(view.state.replaceSelection(String.fromCodePoint(codePoint)));
  settings.recentUnicodeCodePoints = recordRecentUnicodeCodePoint(settings.recentUnicodeCodePoints, codePoint);
  persistSettings();
  $('#unicode-codepoint-dialog').close();
}

function selectCurrentLine() {
  const view = activeEditor();
  if (!view) return;
  selectLine(view);
  view.focus();
}

function selectCurrentWord() {
  const view = activeEditor();
  if (!view) return;
  const range = view.state.wordAt(view.state.selection.main.head);
  if (range) view.dispatch({ selection: { anchor: range.from, head: range.to } });
  view.focus();
}

function createRichTextClipboardPayload(view) {
  if (!view) return null;
  const selections = view.state.selection.ranges.filter(range => !range.empty);
  if (!selections.length) return null;
  const baseStyle = getComputedStyle(view.contentDOM);
  const styledRanges = [];
  const walker = document.createTreeWalker(view.contentDOM, NodeFilter.SHOW_TEXT);
  while (walker.nextNode() && styledRanges.length < 20_000) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!node.nodeValue || !parent?.closest('.cm-line') || parent.closest('[aria-hidden="true"]')) continue;
    try {
      const from = view.posAtDOM(node, 0);
      const to = view.posAtDOM(node, node.nodeValue.length);
      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to <= from) continue;
      const style = getComputedStyle(parent);
      const bold = Number.parseInt(style.fontWeight, 10) >= 600;
      const italic = style.fontStyle === 'italic';
      if (style.color !== baseStyle.color || bold || italic) styledRanges.push({ from, to, color: style.color, bold, italic });
    } catch {}
  }

  const chunks = [];
  const runs = [];
  const eol = ['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS'].includes(activeDoc?.eol) ? activeDoc.eol : 'LF';
  const lineEnding = ({ LF: '\n', CRLF: '\r\n', CR: '\r', NEL: '\u0085', LS: '\u2028', PS: '\u2029' })[eol];
  let totalLength = 0;
  for (const range of selections) {
    if (chunks.length) { chunks.push(lineEnding); totalLength += lineEnding.length; }
    const text = view.state.sliceDoc(range.from, range.to);
    const offset = totalLength;
    chunks.push(text);
    totalLength += text.length;
    for (const styled of styledRanges) {
      const from = Math.max(range.from, styled.from);
      const to = Math.min(range.to, styled.to);
      if (to <= from) continue;
      runs.push({ from: offset + from - range.from, to: offset + to - range.from, color: styled.color, bold: styled.bold, italic: styled.italic });
    }
  }
  return {
    text: chunks.join(''),
    fontFamily: baseStyle.fontFamily,
    fontSize: Number.parseFloat(baseStyle.fontSize) || 12,
    color: baseStyle.color,
    runs
  };
}

async function copySelectionAsRichText(view = activeEditor()) {
  const payload = createRichTextClipboardPayload(view);
  if (!payload || !window.cotedit?.writeRichText) return false;
  try {
    const copied = await window.cotedit.writeRichText(payload);
    if (!copied) showToast('富文本复制失败或选区超出复制上限。');
    return copied === true;
  } catch {
    showToast('无法写入系统剪贴板。');
    return false;
  }
}

function selectEnclosingSymbols() {
  const view = activeEditor();
  if (!view) return;
  const selection = view.state.selection.main;
  const range = findEnclosingSymbolRange(view.state.doc.toString(), selection.from, selection.to);
  if (!range) { showToast('光标附近未找到匹配的包围符号'); return; }
  view.dispatch({ selection: { anchor: range.from, head: range.to }, userEvent: 'select.enclosing-symbols' });
  view.focus();
}

function surroundSelection(opening, closing = opening) {
  const view = activeEditor();
  if (!view) return;
  const selection = view.state.selection;
  const ranges = selection.ranges
    .map((range, index) => ({ range, index }))
    .filter(item => !item.range.empty)
    .sort((left, right) => left.range.from - right.range.from);
  if (!ranges.length) return;
  let offset = 0;
  const changes = [];
  const selections = [];
  for (const { range } of ranges) {
    const selected = view.state.doc.sliceString(range.from, range.to);
    changes.push({ from: range.from, to: range.to, insert: `${opening}${selected}${closing}` });
    const from = range.from + offset + opening.length;
    const to = from + selected.length;
    selections.push(EditorSelection.range(range.anchor <= range.head ? from : to, range.anchor <= range.head ? to : from));
    offset += opening.length + closing.length;
  }
  const mainIndex = ranges.findIndex(item => item.index === selection.mainIndex);
  view.dispatch({ changes, selection: EditorSelection.create(selections, Math.max(0, mainIndex)), userEvent: 'input.format.surround' });
  view.focus();
}

function showCustomSurroundDialog() {
  if (!selectedText()) return;
  let pair = { begin: '', end: '' };
  try {
    const stored = JSON.parse(localStorage.getItem('cotedit.customSurroundPair') || 'null');
    if (typeof stored?.begin === 'string' && typeof stored?.end === 'string') pair = stored;
  } catch {}
  $('#custom-surround-begin').value = pair.begin;
  $('#custom-surround-end').value = pair.end;
  $('#custom-surround-begin').setCustomValidity('');
  $('#custom-surround-dialog').showModal();
  $('#custom-surround-begin').focus();
  $('#custom-surround-begin').select();
}

function convertSelectedIndentation(target) {
  const view = activeEditor();
  if (!view || !['spaces', 'tabs'].includes(target)) return;
  const selection = view.state.selection.main;
  const first = view.state.doc.lineAt(selection.from);
  const last = view.state.doc.lineAt(Math.max(selection.from, selection.to - (selection.empty ? 0 : 1)));
  const changes = [];
  for (let number = first.number; number <= last.number; number++) {
    const line = view.state.doc.line(number);
    const indentation = /^[\t ]*/.exec(line.text)[0];
    if (!indentation) continue;
    const replacement = convertIndentation(indentation, target, view.state.tabSize);
    if (replacement !== indentation) changes.push({ from: line.from, to: line.from + indentation.length, insert: replacement });
  }
  if (changes.length) view.dispatch({ changes, userEvent: 'input.format.indentation' });
  view.focus();
}

function transformSelectedText(transform, errorLabel = '文本转换失败', selectionRequired = false) {
  const view = activeEditor();
  if (!view) return;
  let transaction;
  try { transaction = textTransformationTransaction(view.state, transform, { selectionRequired }); }
  catch { showToast(errorLabel); return; }
  if (!transaction) return;
  view.dispatch({ ...transaction, userEvent: 'input.format' });
  view.focus();
}

function replaceTextInSelection() {
  const view = activeEditor();
  if (!view || !activeDoc || activeDoc.preventEditing || !settings.textReplacements.some(rule => rule.enabled)) return false;
  const state = view.state;
  const selections = state.selection.ranges;
  if (!selections.some(range => !range.empty)) return false;
  const replacements = settings.textReplacements;
  if (!selections.some(range => !range.empty && applyTextReplacements(state.doc.sliceString(range.from, range.to), replacements) !== state.doc.sliceString(range.from, range.to))) return false;
  let transaction;
  try { transaction = textTransformationTransaction(state, text => applyTextReplacements(text, replacements), { selectionRequired: true }); }
  catch { showToast('替换文本失败'); return false; }
  if (!transaction || transaction.changes.empty) return false;
  view.dispatch({ ...transaction, userEvent: 'input.replace.text', scrollIntoView: true });
  view.focus();
  return true;
}

function transformActiveLineBlock(operation, options = {}) {
  const view = activeEditor();
  if (!view || !activeDoc) return false;
  const doc = view.state.doc;
  const selection = view.state.selection.main;
  const wholeDocument = selection.empty;
  const first = wholeDocument ? doc.line(1) : doc.lineAt(selection.from);
  const last = wholeDocument ? doc.line(doc.lines) : doc.lineAt(Math.max(selection.from, selection.to - 1));
  const from = wholeDocument ? 0 : first.from;
  const to = wholeDocument ? doc.length : Math.min(doc.length, last.to + (last.number < doc.lines ? 1 : 0));
  const source = doc.sliceString(from, to);
  const firstEndingIndex = first.number - 1;
  const sourceEndingCount = (source.match(/\n/g) || []).length;
  const currentEndings = activeDoc.lineEndings || [];
  const sourceEndings = currentEndings.slice(firstEndingIndex, firstEndingIndex + sourceEndingCount);
  const fallbackLineEnding = LINE_ENDING_TYPES.includes(activeDoc.eol)
    ? activeDoc.eol : dominantLineEnding(currentEndings, 'LF');
  const transformed = transformLineBlock(source, sourceEndings, operation, { ...options, fallbackLineEnding });
  if (transformed.text === source) return false;

  const nextText = `${doc.sliceString(0, from)}${transformed.text}${doc.sliceString(to)}`;
  const nextEndings = [
    ...currentEndings.slice(0, firstEndingIndex),
    ...transformed.lineEndings,
    ...currentEndings.slice(firstEndingIndex + sourceEndingCount)
  ];
  const nextSelection = selection.empty
    ? EditorSelection.cursor(from)
    : EditorSelection.range(from, from + transformed.text.length);
  view.dispatch({
    changes: { from, to, insert: transformed.text },
    selection: nextSelection,
    effects: setDocumentLineEndings.of(nextEndings),
    userEvent: `input.format.lines.${operation}`
  });
  view.focus();
  return true;
}

function sortSelectedLines(options = {}) { return transformActiveLineBlock('sort', options); }
function reverseSelectedLines() { return transformActiveLineBlock('reverse'); }
function shuffleSelectedLines() { return transformActiveLineBlock('shuffle'); }
function deleteDuplicateLines() { return transformActiveLineBlock('delete-duplicates'); }

function countRegexCaptures(source) {
  let count = 0;
  let inClass = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '\\') { index++; continue; }
    if (inClass) { if (character === ']') inClass = false; continue; }
    if (character === '[') { inClass = true; continue; }
    if (character !== '(') continue;
    if (source[index + 1] !== '?') { count++; continue; }
    if (source.startsWith('(?<', index) && !['=', '!'].includes(source[index + 3])) count++;
  }
  return count;
}

function renderPatternSortSample(sample, range) {
  const element = $('#pattern-sort-sample-line');
  const value = String(sample);
  if (!range || !Number.isInteger(range.from) || !Number.isInteger(range.to)
      || range.from < 0 || range.to > value.length || range.from >= range.to) {
    element.textContent = value;
    return;
  }
  const highlight = document.createElement('mark');
  highlight.className = 'pattern-sort-key-highlight';
  highlight.textContent = value.slice(range.from, range.to);
  element.replaceChildren(
    document.createTextNode(value.slice(0, range.from)),
    highlight,
    document.createTextNode(value.slice(range.to))
  );
}

function patternSortDraft() {
  const keyType = $('#pattern-sort-key').value;
  let getKey = line => line;
  let getRange = line => ({ from: 0, to: String(line).length });
  if (keyType === 'column') {
    const column = Number($('#pattern-sort-column').value);
    const delimiter = $('#pattern-sort-delimiter').value.replace(/\\t/g, '\t').replace(/\\\\/g, '\\') || ',';
    if (!Number.isInteger(column) || column < 1) return { error: '列序号必须为大于 0 的整数。' };
    getKey = line => line.split(delimiter)[column - 1]?.trim() ?? null;
    getRange = line => getDelimitedSortKeyRange(line, delimiter, column);
  } else if (keyType === 'regexp') {
    const pattern = $('#pattern-sort-regexp').value;
    if (!pattern) return { error: '正则表达式不能为空。' };
    let regexp;
    try {
      const compiled = compileCotSyntaxRegex(pattern, { ignoreCase: $('#pattern-sort-regexp-ignore-case').checked, global: false });
      regexp = new RegExp(compiled.source, `${compiled.flags}d`);
    } catch {
      return { error: '正则表达式无效或超出安全兼容范围。' };
    }
    const useCapture = $('#pattern-sort-use-capture').checked;
    const captureIndex = Number($('#pattern-sort-capture-index').value);
    const captureCount = countRegexCaptures(pattern);
    if (useCapture && (!Number.isInteger(captureIndex) || captureIndex < 0 || captureIndex > captureCount)) {
      return { error: `捕获组序号须在 0 到 ${captureCount} 之间。` };
    }
    getKey = line => {
      const match = regexp.exec(line);
      return match ? (useCapture ? match[captureIndex] ?? null : match[0]) : null;
    };
    getRange = line => getRegexSortKeyRange(regexp, line, useCapture ? captureIndex : 0);
  }
  return {
    options: {
      getKey,
      getRange,
      ignoreCase: $('#pattern-sort-ignore-case').checked,
      localized: $('#pattern-sort-localized').checked,
      numeric: $('#pattern-sort-numeric').checked,
      keepFirstLine: $('#pattern-sort-keep-first').checked,
      descending: $('#pattern-sort-descending').checked
    },
    error: ''
  };
}

function updatePatternSortDialog() {
  const keyType = $('#pattern-sort-key').value;
  $('#pattern-sort-column-fields').classList.toggle('hidden', keyType !== 'column');
  $('#pattern-sort-regexp-fields').classList.toggle('hidden', keyType !== 'regexp');
  const draft = patternSortDraft();
  $('#pattern-sort-error').textContent = draft.error;
  $('#pattern-sort-submit').disabled = Boolean(draft.error);
  const sample = $('#pattern-sort-sample-line').textContent;
  renderPatternSortSample(sample, draft.error ? null : draft.options.getRange(sample));
  if (draft.error) $('#pattern-sort-preview').textContent = '';
  else {
    const key = draft.options.getKey(sample);
    $('#pattern-sort-preview').textContent = key == null ? '未匹配' : `排序键：${key}`;
  }
}

function showPatternSortDialog() {
  const view = activeEditor();
  if (!view) return;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('cotedit.pattern-sort.v1') || '{}'); } catch {}
  const setValue = (selector, key, fallback) => { $(selector).value = typeof saved[key] === 'string' ? saved[key] : fallback; };
  const setChecked = (selector, key, fallback) => { $(selector).checked = typeof saved[key] === 'boolean' ? saved[key] : fallback; };
  setValue('#pattern-sort-key', 'key', 'column');
  setValue('#pattern-sort-delimiter', 'delimiter', ',');
  setValue('#pattern-sort-column', 'column', '1');
  setValue('#pattern-sort-regexp', 'regexp', '');
  setValue('#pattern-sort-capture-index', 'captureIndex', '1');
  setChecked('#pattern-sort-regexp-ignore-case', 'regexpIgnoreCase', true);
  setChecked('#pattern-sort-use-capture', 'useCapture', false);
  setChecked('#pattern-sort-ignore-case', 'ignoreCase', true);
  setChecked('#pattern-sort-localized', 'localized', true);
  setChecked('#pattern-sort-numeric', 'numeric', true);
  setChecked('#pattern-sort-keep-first', 'keepFirstLine', false);
  setChecked('#pattern-sort-descending', 'descending', false);
  const selection = view.state.selection.main;
  const sampleLine = view.state.doc.lineAt(selection.empty ? selection.head : selection.from);
  $('#pattern-sort-sample-line').textContent = sampleLine.text || '（空行）';
  $('#pattern-sort-error').textContent = '';
  updatePatternSortDialog();
  const dialog = $('#pattern-sort-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  $('#pattern-sort-key').focus();
}

function trimTrailingWhitespace() {
  const view = activeEditor();
  if (!view) return;
  const changes = trailingWhitespaceChanges(view.state.doc);
  if (changes.length) view.dispatch({ changes, userEvent: 'input.trim.trailing-whitespace' });
  view.focus();
}

function joinCurrentLines() {
  const view = activeEditor();
  if (!view) return;
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  if (line.number >= view.state.doc.lines) return;
  const next = view.state.doc.line(line.number + 1);
  const replacement = `${line.text.replace(/\s+$/, '')} ${next.text.trimStart()}`;
  view.dispatch({ changes: { from: line.from, to: next.to, insert: replacement }, selection: { anchor: line.from + replacement.length }, userEvent: 'input.format.join' });
  view.focus();
}

function splitSelectionByLines() {
  const view = activeEditor();
  if (!view) return;
  const selection = view.state.selection.main;
  if (selection.empty) return;
  const first = view.state.doc.lineAt(selection.from);
  const last = view.state.doc.lineAt(Math.max(selection.from, selection.to - 1));
  const ranges = [];
  for (let lineNumber = first.number; lineNumber <= last.number; lineNumber++) {
    const line = view.state.doc.line(lineNumber);
    ranges.push(EditorSelection.range(Math.max(selection.from, line.from), Math.min(selection.to, line.to)));
  }
  if (ranges.length) view.dispatch({ selection: EditorSelection.create(ranges) });
}

function selectColumn(direction) {
  const view = activeEditor();
  if (!view?.hasFocus) return;
  const doc = view.state.doc;
  const selection = view.state.selection.main;
  if (!columnAnchor) {
    const anchorLine = doc.lineAt(selection.anchor);
    const headLine = doc.lineAt(selection.head);
    columnAnchor = { anchorLine: anchorLine.number, anchorColumn: selection.anchor - anchorLine.from, headLine: headLine.number, headColumn: selection.head - headLine.from };
  }
  columnAnchor.headLine = Math.max(1, Math.min(doc.lines, columnAnchor.headLine + direction));
  const firstLine = Math.min(columnAnchor.anchorLine, columnAnchor.headLine);
  const lastLine = Math.max(columnAnchor.anchorLine, columnAnchor.headLine);
  const leftColumn = Math.min(columnAnchor.anchorColumn, columnAnchor.headColumn);
  const rightColumn = Math.max(columnAnchor.anchorColumn, columnAnchor.headColumn);
  const ranges = [];
  for (let number = firstLine; number <= lastLine; number++) {
    const line = doc.line(number);
    const from = Math.min(line.to, line.from + leftColumn);
    const to = Math.min(line.to, line.from + rightColumn);
    ranges.push(from === to ? EditorSelection.cursor(from) : columnAnchor.anchorColumn <= columnAnchor.headColumn ? EditorSelection.range(from, to) : EditorSelection.range(to, from));
  }
  programmaticColumnSelection = true;
  view.dispatch({ selection: EditorSelection.create(ranges, columnAnchor.headLine - firstLine) });
  programmaticColumnSelection = false;
  view.focus();
}

async function chooseDirectory() {
  if (!window.cotedit?.isDesktop) { showToast('文件夹搜索需要桌面版'); return; }
  await chooseFolderNavigationRoot();
  if (directoryRoot) $('#directory-query').focus();
}

function updateFolderHistoryButtons() {
  $('#folder-history-previous').disabled = folderDocumentHistoryIndex <= 0;
  $('#folder-history-next').disabled = folderDocumentHistoryIndex < 0 || folderDocumentHistoryIndex >= folderDocumentHistory.length - 1;
}

function updateFolderNavigationLocation(rootPath, currentPath = rootPath) {
  const rootName = rootPath?.split(/[\\/]/).filter(Boolean).at(-1);
  $('#folder-navigation-root').textContent = rootName ? `根目录：${rootName}` : '尚未打开文件夹';
  $('#folder-navigation-root').title = rootPath || '';
  const relativePath = rootPath && currentPath?.startsWith(rootPath)
    ? currentPath.slice(rootPath.length).replace(/^[\\/]+/, '').replace(/[\\/]+/g, ' / ')
    : '';
  $('#folder-navigation-current').textContent = rootPath ? (relativePath || '根目录') : '选择文件夹开始浏览';
  $('#folder-navigation-current').title = currentPath || '';
}

function setFolderNavigationRoot(rootPath) {
  const changed = folderNavigationRoot !== rootPath;
  folderNavigationRoot = rootPath;
  directoryRoot = rootPath;
  folderNavigationPath = rootPath;
  folderNavigationParentPath = null;
  updateFolderNavigationLocation(rootPath);
  $('#folder-navigation-status').textContent = '';
  if (changed) {
    setFolderAddMenuOpen(false);
    setFolderPreviewExternalMenuOpen(false);
    clearFolderPreviewExternalApplications();
    if (folderNameFilterTimer !== null) {
      clearTimeout(folderNameFilterTimer);
      folderNameFilterTimer = null;
    }
    directorySearchRequest++;
    folderPreviewRequest++;
    folderPreviewPath = null;
    $('#directory-name-filter').value = '';
    $('#directory-query').value = '';
    $('#directory-results').classList.add('hidden');
    $('#directory-results').replaceChildren();
    $('#folder-preview').classList.add('hidden');
    $('#folder-preview').setAttribute('hidden', '');
    folderDocumentHistory = [];
    folderDocumentHistoryIndex = -1;
    updateFolderHistoryButtons();
  }
}

function setFolderNavigationView(open) {
  $('#sidebar-documents-view').classList.toggle('hidden', open);
  $('#sidebar-documents-view').toggleAttribute('hidden', open);
  $('#folder-navigation-view').classList.toggle('hidden', !open);
  $('#folder-navigation-view').toggleAttribute('hidden', !open);
  $('#folder-navigation-toggle').setAttribute('aria-pressed', String(open));
  $('#folder-navigation-toggle').setAttribute('aria-label', open ? '显示打开的文稿' : '打开文件夹导航');
  $('#sidebar-mode-title').textContent = open ? '文件夹' : '文稿';
  $('.sidebar').classList.toggle('folder-navigation-active', open);
}

function setFolderAddMenuOpen(open, focusFirst = false, restoreToggleFocus = false) {
  const toggle = $('#folder-add-toggle');
  const menu = $('#folder-add-options');
  const isOpen = open === true && !toggle.disabled;
  menu.hidden = !isOpen;
  toggle.setAttribute('aria-expanded', String(isOpen));
  if (isOpen && focusFirst) menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  else if (!isOpen && restoreToggleFocus) toggle.focus();
}

function setFolderAddEnabled(enabled) {
  const canCreate = enabled === true && typeof window.cotedit?.createDirectoryEntry === 'function';
  $('#folder-add-toggle').disabled = !canCreate;
  for (const id of ['folder-add-file', 'folder-add-folder']) $(`#${id}`).disabled = !canCreate;
  if (!canCreate) setFolderAddMenuOpen(false);
}

function handleFolderAddMenuKeydown(event) {
  const menu = $('#folder-add-options');
  if (menu.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    setFolderAddMenuOpen(false, false, true);
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
  if (!items.length) return;
  event.preventDefault();
  event.stopPropagation();
  const current = items.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length
        : (current <= 0 ? items.length - 1 : current - 1);
  items[next].focus();
}

function setFolderPreviewExternalMenuOpen(open, focusFirst = false, restoreToggleFocus = false) {
  const toggle = $('#folder-preview-external-menu-toggle');
  const menu = $('#folder-preview-external-menu');
  const isOpen = open === true && !toggle.disabled && Boolean(folderPreviewPath);
  menu.hidden = !isOpen;
  toggle.setAttribute('aria-expanded', String(isOpen));
  if (isOpen && focusFirst) menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  else if (!isOpen && restoreToggleFocus) toggle.focus();
}

function clearFolderPreviewExternalApplications() {
  folderExternalApplicationRequest++;
  $('#folder-preview-registered-applications').replaceChildren();
  $('#folder-preview-registered-applications-separator').hidden = true;
  const defaultButton = $('#folder-preview-open-default');
  defaultButton.textContent = '默认应用';
  defaultButton.setAttribute('aria-label', '使用系统默认应用打开');
  defaultButton.title = '使用系统默认应用打开';
}

async function refreshFolderPreviewExternalApplications(filePath) {
  const request = ++folderExternalApplicationRequest;
  const container = $('#folder-preview-registered-applications');
  const separator = $('#folder-preview-registered-applications-separator');
  const defaultButton = $('#folder-preview-open-default');
  container.replaceChildren();
  separator.hidden = true;
  defaultButton.textContent = '默认应用';
  defaultButton.setAttribute('aria-label', '使用系统默认应用打开');
  defaultButton.title = '使用系统默认应用打开';
  if (typeof window.cotedit?.listExternalApplications !== 'function') return;
  try {
    const result = await window.cotedit.listExternalApplications(filePath);
    if (request !== folderExternalApplicationRequest || folderPreviewPath !== filePath || $('#folder-preview-external-menu').hidden) return;
    const applications = Array.isArray(result) ? result.filter(application =>
      application && typeof application.id === 'string' && typeof application.displayName === 'string'
      && application.displayName.trim() && typeof application.isDefault === 'boolean'
    ) : [];
    const defaultApplication = applications.find(application => application.isDefault);
    if (defaultApplication) {
      const label = formatExternalApplicationLabel(defaultApplication, applications, { isDefault: true });
      defaultButton.textContent = label;
      defaultButton.setAttribute('aria-label', `使用系统默认应用打开：${label}`);
      defaultButton.title = label;
    }
    const alternatives = applications.filter(application => application !== defaultApplication);
    for (const application of alternatives) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.dataset.registeredApplicationId = application.id;
      button.textContent = formatExternalApplicationLabel(application, applications);
      button.title = button.textContent;
      container.append(button);
    }
    separator.hidden = !defaultApplication || alternatives.length === 0;
  } catch {
    if (request !== folderExternalApplicationRequest || folderPreviewPath !== filePath) return;
    container.replaceChildren();
    separator.hidden = true;
    defaultButton.textContent = '默认应用';
    defaultButton.setAttribute('aria-label', '使用系统默认应用打开');
    defaultButton.title = '使用系统默认应用打开';
  }
}

function handleFolderPreviewExternalMenuKeydown(event) {
  const menu = $('#folder-preview-external-menu');
  if (menu.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    setFolderPreviewExternalMenuOpen(false, false, true);
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
  if (!items.length) return;
  event.preventDefault();
  event.stopPropagation();
  const current = items.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length
        : (current <= 0 ? items.length - 1 : current - 1);
  items[next].focus();
}

async function createFolderNavigationEntry(kind) {
  const createEntry = window.cotedit?.createDirectoryEntry;
  const parentPath = folderNavigationPath || folderNavigationRoot;
  if (!folderNavigationRoot || !parentPath || typeof createEntry !== 'function' || !['file', 'directory'].includes(kind)) return false;
  setFolderAddMenuOpen(false);
  let created;
  try {
    created = await createEntry({ path: parentPath, kind, ...(kind === 'file' ? { extension: defaultSyntaxExtension() } : {}) });
  } catch (error) {
    $('#folder-navigation-status').textContent = `新建失败：${error.message || '请重试'}`;
    return false;
  }

  if (folderNameFilterTimer !== null) {
    clearTimeout(folderNameFilterTimer);
    folderNameFilterTimer = null;
  }
  $('#directory-name-filter').value = '';
  clearDirectorySearch();
  hideFolderPreview();
  await renderFolderNavigation();
  const entry = [...$('#folder-navigation-items').querySelectorAll('.folder-navigation-entry')]
    .find(button => button.dataset.path === created.path);
  entry?.focus();
  if (created.kind === 'file') await previewFolderFile(created.path);
  $('#folder-navigation-status').textContent = `已新建${created.kind === 'directory' ? '文件夹' : '文件'}：${created.name}`;
  return true;
}

async function renderFolderNavigation() {
  const items = $('#folder-navigation-items');
  if (!folderNavigationRoot) {
    items.innerHTML = '<div class="empty-hint">选择文件夹开始浏览</div>';
    updateFolderNavigationLocation(null);
    setFolderAddEnabled(false);
    $('#folder-navigation-parent').disabled = true;
    $('#directory-name-filter').disabled = true;
    $('#directory-query').disabled = true;
    $('#directory-run').disabled = true;
    $('#directory-regex').disabled = true;
    $('#directory-case').disabled = true;
    return;
  }
  if (!window.cotedit?.listDirectory) {
    items.innerHTML = '<div class="empty-hint">本机文件夹浏览仅在桌面版可用</div>';
    setFolderAddEnabled(false);
    $('#directory-name-filter').disabled = true;
    return;
  }
  setFolderAddEnabled(true);
  $('#directory-name-filter').disabled = false;
  $('#directory-query').disabled = false;
  $('#directory-run').disabled = false;
  $('#directory-regex').disabled = false;
  $('#directory-case').disabled = false;
  const request = ++folderNavigationRequest;
  const nameFilter = $('#directory-name-filter').value;
  items.innerHTML = '<div class="empty-hint">正在读取文件夹…</div>';
  try {
    const result = await window.cotedit.listDirectory({ path: folderNavigationPath || folderNavigationRoot, nameFilter });
    if (request !== folderNavigationRequest) return;
    folderNavigationRoot = result.root;
    folderNavigationPath = result.path;
    folderNavigationParentPath = result.parentPath;
    updateFolderNavigationLocation(result.root, result.path);
    $('#folder-navigation-parent').disabled = !result.parentPath;
    items.innerHTML = result.entries.map(entry => `<div role="listitem"><button class="folder-navigation-entry" data-kind="${entry.kind}" data-path="${escapeHtml(entry.path)}" aria-current="${entry.kind === 'file' && entry.path === folderPreviewPath ? 'true' : 'false'}" aria-label="${entry.kind === 'directory' ? '文件夹' : '文件'} ${escapeHtml(entry.name)}" title="${escapeHtml(entry.name)}"><span class="folder-navigation-icon" aria-hidden="true">${entry.kind === 'directory' ? '▸' : '·'}</span><span class="folder-navigation-name">${escapeHtml(entry.name)}</span></button></div>`).join('') || `<div class="empty-hint">${nameFilter ? `没有匹配文件名“${escapeHtml(nameFilter)}”` : '此文件夹没有可显示的项目'}</div>`;
    $('#folder-navigation-status').textContent = result.truncatedByScan
      ? `目录过大，仅检查前 ${result.scanned} 项`
      : result.truncatedByEntries
        ? (nameFilter ? `匹配项目较多，仅显示前 ${result.entries.length} 项` : `目录项目较多，仅显示前 ${result.entries.length} 项`)
        : '';
    items.querySelectorAll('.folder-navigation-entry').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.kind === 'directory') {
        folderNavigationPath = button.dataset.path;
        hideFolderPreview();
        renderFolderNavigation();
      } else previewFolderFile(button.dataset.path);
    }));
  } catch (error) {
    if (request !== folderNavigationRequest) return;
    items.innerHTML = `<div class="empty-hint">${escapeHtml(error.message || '无法读取文件夹')}</div>`;
    $('#folder-navigation-parent').disabled = true;
  }
}

async function chooseFolderNavigationRoot() {
  if (!window.cotedit?.isDesktop) { showToast('文件夹导航需要桌面版'); return; }
  try {
    const selected = await window.cotedit.chooseDirectory();
    if (!selected) return;
    directoryRoot = selected;
    setFolderNavigationRoot(selected);
    await renderFolderNavigation();
    return true;
  } catch (error) { showToast(`打开文件夹失败：${error.message || '请重试'}`); }
  return false;
}

async function openFolderNavigation() {
  if (!settings.showSidebar) {
    settings.showSidebar = true;
    persistSettings();
    applySettings();
  }
  setFolderNavigationView(true);
  await chooseFolderNavigationRoot();
}

async function openFolderSearch() {
  if (!settings.showSidebar) {
    settings.showSidebar = true;
    persistSettings();
    applySettings();
  }
  setFolderNavigationView(true);
  if (!folderNavigationRoot) {
    if (!await chooseFolderNavigationRoot()) return;
  } else await renderFolderNavigation();
  $('#directory-query').focus();
}

function renderFolderPreviewAttributes(attributes) {
  const list = $('#folder-preview-attributes');
  const fragment = document.createDocumentFragment();
  for (const attribute of attributes) {
    if (typeof attribute?.label !== 'string' || typeof attribute?.value !== 'string') continue;
    const row = document.createElement('div');
    row.className = 'folder-preview-attribute';
    const term = document.createElement('dt');
    term.textContent = attribute.label;
    const value = document.createElement('dd');
    value.textContent = attribute.value;
    row.append(term, value);
    fragment.append(row);
  }
  list.replaceChildren(fragment);
}

function hideFolderPreview() {
  folderPreviewRequest++;
  setFolderPreviewExternalMenuOpen(false);
  clearFolderPreviewExternalApplications();
  renderFolderPreviewAttributes([]);
  folderPreviewPath = null;
  syncFolderNavigationSelection();
  $('#folder-preview').classList.add('hidden');
  $('#folder-preview').setAttribute('hidden', '');
  for (const id of ['folder-preview-open', 'folder-preview-open-plain', 'folder-preview-open-new-window', 'folder-preview-open-external', 'folder-preview-external-menu-toggle', 'folder-preview-open-default', 'folder-preview-open-with']) $(`#${id}`).disabled = true;
}

function syncFolderNavigationSelection() {
  $('#folder-navigation-items').querySelectorAll('.folder-navigation-entry').forEach(button => {
    button.setAttribute('aria-current', String(button.dataset.kind === 'file' && button.dataset.path === folderPreviewPath));
  });
}

async function previewFolderFile(filePath) {
  if (!window.cotedit?.previewFile) return;
  const request = ++folderPreviewRequest;
  setFolderPreviewExternalMenuOpen(false);
  clearFolderPreviewExternalApplications();
  folderPreviewPath = filePath;
  syncFolderNavigationSelection();
  const preview = $('#folder-preview');
  preview.classList.remove('hidden');
  preview.removeAttribute('hidden');
  $('#folder-preview-title').textContent = filePath.split(/[\\/]/).at(-1) || '文件预览';
  $('#folder-preview-meta').textContent = '正在读取…';
  renderFolderPreviewAttributes([]);
  $('#folder-preview-content').textContent = '';
  $('#folder-preview-open').disabled = true;
  $('#folder-preview-open-plain').disabled = true;
  $('#folder-preview-open-new-window').disabled = true;
  $('#folder-preview-open-external').disabled = true;
  $('#folder-preview-external-menu-toggle').disabled = true;
  $('#folder-preview-open-default').disabled = true;
  $('#folder-preview-open-with').disabled = true;
  try {
    const result = await window.cotedit.previewFile(filePath);
    if (request !== folderPreviewRequest || folderPreviewPath !== filePath) return;
    $('#folder-preview-title').textContent = result.name;
    const executable = result.executable === true;
    const binaryPropertyList = result.binaryPropertyList === true;
    const dimensions = result.imageDimensions;
    const image = result.image === true
      && Number.isSafeInteger(dimensions?.width) && dimensions.width > 0
      && Number.isSafeInteger(dimensions?.height) && dimensions.height > 0;
    const imageDpi = image && Number.isFinite(result.imageDpi) && result.imageDpi > 0
      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(result.imageDpi)
      : null;
    const imageColorModel = image && ['RGB', 'Gray'].includes(result.imageColorModel) ? result.imageColorModel : null;
    const imageColorProfile = image && ['sRGB', 'Display P3'].includes(result.imageColorProfile) ? result.imageColorProfile : null;
    const audioFile = result.audio === true;
    const audioKind = audioFile && ['WAVE', 'AIFF', 'AIFF-C'].includes(result.audioKind) ? result.audioKind : '未知格式';
    const audio = audioFile && Number.isFinite(result.audioDurationSeconds) && result.audioDurationSeconds >= 0;
    const isoBmff = result.isoBmff === true;
    const movie = isoBmff && result.movie === true;
    const blockedPlainText = executable || binaryPropertyList || image || audioFile || isoBmff;
    $('#folder-preview-meta').textContent = '';
    renderFolderPreviewAttributes(buildFolderPreviewAttributes(result));
    $('#folder-preview-content').textContent = executable
      ? '此文件具有 UNIX 执行权限。默认“打开”不会将其作为文本文稿载入；如明确要查看或编辑，可选择“以纯文本打开”，也可从“外部编辑器”菜单交由系统默认应用或其他应用打开。'
      : binaryPropertyList
      ? '此文件带有二进制 Property List 标记，不作默认纯文本预览。若明确需要将字节按检测到的编码解释，可选择“以纯文本打开”；保存可能改写原始二进制内容。也可交由系统默认应用或其他应用打开。'
      : audioFile
        ? audio
          ? audioKind === 'AIFF'
            ? '音频数据不会按文本解码；这里只根据经典 AIFF 的 COMM/SSND 头、采样帧数和扩展精度采样率计算未压缩 PCM 时长。AIFF-C、非末尾超限块、非零 blockSize 及不完整或矛盾的头部不推测时长。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。'
            : audioKind === 'AIFF-C'
              ? '音频数据不会按文本解码；这里只对具有唯一有效 FVER/COMM、合法 Pascal 压缩名，且压缩类型为 NONE 或 sowt（未压缩整数 PCM）的 AIFF-C，根据样本帧数和扩展精度采样率计算时长。其它 codec、未知版本、非零 blockSize 及不完整或矛盾的块不推测时长。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。'
              : '音频数据不会按文本解码；这里只根据 RIFF/WAVE PCM fmt/data 块字段与样本帧对齐计算时长。压缩编码、扩展/超大 RIFF、数据长度不齐及可见的重复或畸形块不推测时长；超出 512 KiB 前缀的尾部结构不完整验证。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。'
          : audioKind === 'AIFF-C'
            ? '已识别 AIFF-C 音频容器，但仅支持经过完整验证的 NONE/sowt 未压缩 PCM；其它 codec、未知版本、采样率或数据边界不满足条件时不推测时长，也不按文本解码音频字节。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。'
            : `已识别 ${audioKind} 音频容器，但其格式、采样率或数据边界不满足当前安全解析条件；不推测时长，也不按文本解码音频字节。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。`
      : movie
        ? '视频样本不会解码或播放；这里只从既有 512 KiB 预览前缀内完整可读的 ISO BMFF 元数据读取视频轨道显示尺寸和电影时长。若 moov 元数据在前缀之外、损坏或格式不支持，属性保持未知。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。'
        : isoBmff
          ? '已识别 ISO BMFF 媒体容器，但受限预览范围内未确认完整的视频轨道元数据；不解码媒体，也不作默认纯文本预览。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。'
      : image
        ? `图像字节不会按文本解码；这里只显示从受限文件头识别出的像素尺寸${imageDpi === null ? '' : '、水平 DPI'}${imageColorModel === null && imageColorProfile === null ? '' : '及有限的色彩模型/配置文件名'}。可选择“以纯文本打开”查看原始字节文本，或交由系统默认应用及其他应用打开。`
        : (result.text || '（空文件）');
    $('#folder-preview-open').disabled = blockedPlainText;
    $('#folder-preview-open-plain').disabled = false;
    $('#folder-preview-open-new-window').disabled = blockedPlainText;
    $('#folder-preview-open-external').disabled = false;
    $('#folder-preview-external-menu-toggle').disabled = false;
    $('#folder-preview-open-default').disabled = false;
    $('#folder-preview-open-with').disabled = false;
  } catch (error) {
    if (request !== folderPreviewRequest) return;
    renderFolderPreviewAttributes([]);
    $('#folder-preview-meta').textContent = '无法预览';
    $('#folder-preview-content').textContent = error.message || '此文件无法作为文本预览。';
  }
}

async function openFolderNavigationDocument(filePath, lineNumber = 0, recordHistory = true, options = {}) {
  try {
    const item = await window.cotedit.openPath(filePath, { plainText: options.plainText === true });
    const existing = documents.find(doc => doc.path === item.path);
    if (existing) {
      switchDocument(existing);
      if (item.plainText) changeLanguage('plaintext');
    } else {
      const doc = createDocument(item.text, item.name, item.path, true, item);
      if (item.plainText) {
        doc.language = 'plaintext';
        doc.editorState = createState(doc);
      }
      addDocument(doc);
      if (getLineEndingSummary(doc).mixed) showToast(`已打开 ${doc.name}；文稿包含混合换行符，可点状态栏 ⚠ 检查。`);
    }
    hideFolderPreview();
    if (recordHistory) {
      folderDocumentHistory = folderDocumentHistory.slice(0, folderDocumentHistoryIndex + 1);
      if (folderDocumentHistory.at(-1) !== item.path) folderDocumentHistory.push(item.path);
      folderDocumentHistoryIndex = folderDocumentHistory.length - 1;
    }
    updateFolderHistoryButtons();
    if (lineNumber > 0) jumpToLine(lineNumber);
    return true;
  } catch (error) {
    showToast(`打开失败：${error.message || '请重试'}`);
    return false;
  }
}

async function openFolderPreviewInNewWindow(filePath) {
  const button = $('#folder-preview-open-new-window');
  if (!filePath || !window.cotedit?.openPathInNewWindow) return false;
  button.disabled = true;
  try {
    await window.cotedit.openPathInNewWindow(filePath);
    return true;
  } catch (error) {
    showToast(`无法在新窗口打开：${error.message || '请重试'}`);
    return false;
  } finally {
    if (folderPreviewPath === filePath && !$('#folder-preview').hidden) button.disabled = false;
  }
}

async function openFolderPreviewExternally(filePath) {
  const button = $('#folder-preview-open-external');
  if (!filePath || !window.cotedit?.openFileExternally) return false;
  button.disabled = true;
  try {
    await window.cotedit.openFileExternally(filePath);
    return true;
  } catch (error) {
    showToast(`无法使用系统默认应用打开：${error.message || '请检查系统文件关联'}`);
    return false;
  } finally {
    if (folderPreviewPath === filePath && !$('#folder-preview').hidden) button.disabled = false;
  }
}

async function openFolderPreviewWithApplication(filePath) {
  const button = $('#folder-preview-open-with');
  if (!filePath || !window.cotedit?.openFileWithApplication) return false;
  button.disabled = true;
  try {
    const result = await window.cotedit.openFileWithApplication(filePath);
    return result?.canceled !== true;
  } catch (error) {
    showToast(`无法使用所选应用打开：${error.message || '请重试'}`);
    return false;
  } finally {
    if (folderPreviewPath === filePath && !$('#folder-preview').hidden) button.disabled = false;
  }
}

async function openFolderPreviewWithRegisteredApplication(filePath, applicationId, button) {
  if (!filePath || typeof applicationId !== 'string' || typeof window.cotedit?.openRegisteredApplication !== 'function') return false;
  if (button) button.disabled = true;
  try {
    await window.cotedit.openRegisteredApplication(filePath, applicationId);
    return true;
  } catch (error) {
    showToast(`无法使用所选应用打开：${error.message || '请重试'}`);
    return false;
  } finally {
    if (button?.isConnected && folderPreviewPath === filePath) button.disabled = false;
  }
}

async function navigateFolderDocumentHistory(delta) {
  const index = folderDocumentHistoryIndex + delta;
  if (index < 0 || index >= folderDocumentHistory.length) return;
  if (await openFolderNavigationDocument(folderDocumentHistory[index], 0, false)) {
    folderDocumentHistoryIndex = index;
    updateFolderHistoryButtons();
  }
}

async function toggleFolderNavigation() {
  const open = $('#folder-navigation-view').classList.contains('hidden');
  setFolderNavigationView(open);
  if (open) await renderFolderNavigation();
}

async function runDirectorySearch() {
  const query = $('#directory-query').value;
  if (!query.trim()) { clearDirectorySearch(); return; }
  if (!directoryRoot && !await chooseFolderNavigationRoot()) return;
  const request = ++directorySearchRequest;
  $('#folder-navigation-items').classList.add('hidden');
  $('#directory-results').classList.remove('hidden');
  $('#directory-results').innerHTML = '<div class="empty-hint">正在搜索…</div>';
  $('#folder-navigation-status').textContent = '';
  try {
    const result = await window.cotedit.searchDirectory({ query, regexp: $('#directory-regex').checked, caseSensitive: $('#directory-case').checked });
    if (request !== directorySearchRequest) return;
    directoryRoot = result.root;
    const summary = `<div class="empty-hint">搜索 ${result.scanned} 个文件 · ${result.results.length} 项${result.truncated ? ' · 结果已截断' : ''}</div>`;
    $('#directory-results').innerHTML = result.results.length
      ? summary + result.results.map(hit => `<button class="directory-result" role="listitem" data-path="${escapeHtml(hit.path)}" data-line="${hit.line}"><span class="directory-result-path">${escapeHtml(hit.relativePath)}:${hit.line}</span><span class="directory-result-preview">${escapeHtml(hit.preview)}</span></button>`).join('')
      : summary;
    $('#directory-results').querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => openSearchResult(button.dataset.path, Number(button.dataset.line))));
  } catch (error) {
    if (request !== directorySearchRequest) return;
    $('#directory-results').innerHTML = `<div class="empty-hint">${escapeHtml(error.message || '搜索失败')}</div>`;
  }
}

function clearDirectorySearch(focus = false) {
  directorySearchRequest++;
  $('#directory-query').value = '';
  $('#directory-results').replaceChildren();
  $('#directory-results').classList.add('hidden');
  $('#folder-navigation-items').classList.remove('hidden');
  $('#folder-navigation-status').textContent = '';
  if (focus) $('#directory-query').focus();
}

async function openSearchResult(filePath, lineNumber) {
  if (await openFolderNavigationDocument(filePath, lineNumber)) clearDirectorySearch();
}

function setEncoding(value) {
  if (!activeDoc) return;
  if (activeDoc.encoding !== value) activeDoc.bom = value === 'utf16le' || value === 'utf16be';
  activeDoc.encoding = value;
  persistSession(); renderTabs(); renderSidebar(); renderStatus(); syncWindowTitle(); syncMenuState(); scheduleEncodingWarnings();
}

function toggleUtf8Bom() {
  if (!activeDoc || activeDoc.encoding !== 'utf8') return;
  activeDoc.bom = !activeDoc.bom;
  persistSession(); renderTabs(); renderSidebar(); syncWindowTitle(); syncMenuState();
}

function setLineEnding(value) {
  if (!activeDoc || !LINE_ENDING_TYPES.includes(value)) return;
  const view = activeEditor();
  activeDoc.eol = value;
  activeDoc.lineEndings = Array(Math.max(0, view?.state.doc.toString().match(/\n/g)?.length || 0)).fill(value);
  view?.dispatch({ effects: [setDocumentLineEndings.of(activeDoc.lineEndings), setDocumentLineEndingFallback.of(value)] });
  persistSession(); renderTabs(); renderSidebar(); renderStatus(); syncWindowTitle(); scheduleEncodingWarnings();
}

function cycleDocument(direction) {
  if (documents.length < 2) return;
  const index = documents.indexOf(activeDoc);
  const next = (index + direction + documents.length) % documents.length;
  switchDocument(documents[next]);
}

async function saveAllDocuments() {
  const previous = activeDoc;
  for (const doc of [...documents]) {
    if (doc.path && !isDirty(doc)) continue;
    switchDocument(doc);
    if (!await saveDocument()) break;
  }
  if (previous && documents.includes(previous)) switchDocument(previous);
}

function renderShortcuts(filter = '') {
  const query = filter.trim().toLocaleLowerCase();
  const platform = window.cotedit?.platform || navigator.platform;
  const shortcuts = applyShortcutOverrides(SHORTCUTS, settings.keyBindings);
  const items = shortcuts.filter(item => `${item.group} ${item.label} ${formatShortcut(item, platform)}`.toLocaleLowerCase().includes(query));
  const groups = [...new Set(items.map(item => item.group))];
  $('#shortcuts-list').innerHTML = groups.length
    ? groups.map(group => `<section class="shortcut-group" aria-label="${escapeHtml(group)}"><h3>${escapeHtml(group)}</h3>${items.filter(item => item.group === group).map(item => {
      const recording = recordingShortcutId === item.id;
      const label = recording ? '按下按键…' : (formatShortcut(item, platform) || '未设置');
      return `<div class="shortcut-row"><span>${escapeHtml(item.label)}</span><div class="shortcut-controls"><button class="shortcut-key${recording ? ' recording' : ''}" type="button" data-shortcut-id="${escapeHtml(item.id)}" aria-pressed="${recording}" aria-label="修改快捷键：${escapeHtml(item.label)}">${escapeHtml(label)}</button><button class="shortcut-reset" type="button" data-shortcut-reset-id="${escapeHtml(item.id)}" aria-label="恢复${escapeHtml(item.label)}默认快捷键" ${settings.keyBindings[item.id] ? '' : 'disabled'}>默认</button></div></div>`;
    }).join('')}</section>`).join('')
    : '<div class="empty-hint">没有匹配的快捷键</div>';
}

let helpReturnFocus = null;
let shortcutsReturnFocus = null;
let helpOpeningShortcuts = false;
let recordingShortcutId = null;

async function beginShortcutCapture(id) {
  if (!SHORTCUTS.some(item => item.id === id)) return;
  try { await window.cotedit?.setShortcutCaptureMode?.(true); }
  catch { showToast('无法暂时停用菜单快捷键，请重试。'); return; }
  if (!$('#shortcuts-dialog').open) { void window.cotedit?.setShortcutCaptureMode?.(false); return; }
  recordingShortcutId = id;
  $('#shortcut-capture-status').textContent = `正在录入“${SHORTCUTS.find(item => item.id === id).label}”；按 Escape 键取消。`;
  renderShortcuts($('#shortcuts-query').value);
  const button = [...$('#shortcuts-list').querySelectorAll('[data-shortcut-id]')].find(item => item.dataset.shortcutId === id);
  button?.focus();
}

function endShortcutCapture(message) {
  if (!recordingShortcutId) return;
  recordingShortcutId = null;
  void window.cotedit?.setShortcutCaptureMode?.(false);
  renderShortcuts($('#shortcuts-query').value);
  $('#shortcut-capture-status').textContent = message;
}

async function captureShortcutKey(event) {
  if (!recordingShortcutId) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    endShortcutCapture('快捷键录入已取消。');
    return true;
  }
  const binding = shortcutFromEvent(event, window.cotedit?.platform || navigator.platform);
  if (!binding) {
    $('#shortcut-capture-status').textContent = '请按下带修饰键的组合；也可使用 F1–F24。';
    return true;
  }
  const platform = window.cotedit?.platform || navigator.platform;
  const shortcuts = applyShortcutOverrides(SHORTCUTS, settings.keyBindings);
  const current = shortcuts.find(item => item.id === recordingShortcutId);
  const candidate = { ...current, ...binding, keyMac: binding.key, modMac: undefined, ctrlMac: undefined, ctrlNonMac: undefined, altMac: undefined, altNonMac: undefined, shiftMac: undefined, shiftNonMac: undefined };
  const conflict = findShortcutConflict(candidate, shortcuts, platform);
  if (conflict) {
    $('#shortcut-capture-status').textContent = `这个组合已分配给“${conflict.label}”；请换一个组合键。`;
    return true;
  }
  const id = recordingShortcutId;
  const label = current.label;
  settings.keyBindings = removeDefaultShortcutOverrides(SHORTCUTS, normalizeKeyBindings({ ...settings.keyBindings, [id]: binding }));
  recordingShortcutId = null;
  persistSettings();
  await window.cotedit?.setShortcutCaptureMode?.(false);
  renderShortcuts($('#shortcuts-query').value);
  $('#shortcut-capture-status').textContent = `已更改“${label}”的快捷键。`;
  [...$('#shortcuts-list').querySelectorAll('[data-shortcut-id]')].find(item => item.dataset.shortcutId === id)?.focus();
  showToast(`已更改快捷键：${label}`);
  return true;
}

function showHelp() {
  const dialog = $('#help-dialog');
  helpReturnFocus = document.activeElement;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  $('#help-close').focus();
}

function showShortcuts() {
  const dialog = $('#shortcuts-dialog');
  shortcutsReturnFocus = document.activeElement;
  $('#shortcuts-query').value = '';
  renderShortcuts();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  $('#shortcuts-query').focus();
}

function applyToolbarItemSettings() {
  const container = $('.document-tools');
  if (!container) return;
  const hidden = new Set(settings.hiddenToolbarItems);
  for (const id of settings.toolbarItemOrder) {
    const item = TOOLBAR_ITEMS.find(candidate => candidate.id === id);
    const button = item && document.getElementById(item.elementId);
    if (!button) continue;
    button.hidden = hidden.has(id);
    container.append(button);
  }
}

function updateToolbarCustomizationStatus() {
  if (!toolbarCustomizationDraft) return;
  const visibleCount = toolbarCustomizationDraft.order.filter(id => !toolbarCustomizationDraft.hidden.has(id)).length;
  $('#toolbar-customization-status').textContent = `将显示 ${visibleCount} / ${toolbarCustomizationDraft.order.length} 个工具栏项目。`;
}

function renderToolbarCustomizationDialog() {
  if (!toolbarCustomizationDraft) return;
  const list = $('#toolbar-customization-list');
  list.replaceChildren();
  toolbarCustomizationDraft.order.forEach((id, index) => {
    const item = TOOLBAR_ITEMS.find(candidate => candidate.id === id);
    if (!item) return;
    const row = document.createElement('li');
    row.className = 'toolbar-customization-item';
    row.dataset.toolbarItem = id;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !toolbarCustomizationDraft.hidden.has(id);
    checkbox.dataset.toolbarVisibility = id;
    checkbox.setAttribute('aria-label', `显示${item.label}`);
    const name = document.createElement('span');
    name.textContent = item.label;
    label.append(checkbox, name);
    const controls = document.createElement('div');
    controls.className = 'toolbar-customization-move';
    for (const direction of ['up', 'down']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.toolbarMove = direction;
      button.dataset.toolbarId = id;
      button.disabled = direction === 'up' ? index === 0 : index === toolbarCustomizationDraft.order.length - 1;
      button.setAttribute('aria-label', `将“${item.label}”${direction === 'up' ? '上移' : '下移'}`);
      button.textContent = direction === 'up' ? '↑' : '↓';
      controls.append(button);
    }
    row.append(label, controls);
    list.append(row);
  });
  updateToolbarCustomizationStatus();
}

function showToolbarCustomizationDialog() {
  const dialog = $('#toolbar-customization-dialog');
  if (dialog.open) return;
  const activeElement = document.activeElement;
  toolbarCustomizationReturnFocus = activeElement?.closest?.('#settings-popover') ? $('#settings-toggle') : activeElement;
  toolbarCustomizationDraft = {
    order: [...settings.toolbarItemOrder],
    hidden: new Set(settings.hiddenToolbarItems)
  };
  renderToolbarCustomizationDialog();
  setSettingsPopover(false);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  $('#toolbar-customization-list input[type="checkbox"]')?.focus();
}

function applyToolbarCustomizationDialog() {
  if (!toolbarCustomizationDraft) return;
  settings.toolbarItemOrder = [...toolbarCustomizationDraft.order];
  settings.hiddenToolbarItems = settings.toolbarItemOrder.filter(id => toolbarCustomizationDraft.hidden.has(id));
  persistSettings();
  applySettings();
  $('#toolbar-customization-dialog').close();
  showToast('工具栏项目与顺序已保存。');
}

function availableRecoveryDrafts() {
  const openIds = new Set(documents.map(doc => doc.id));
  return recoveryDrafts.filter(item => !item.inUse && !openIds.has(item.id));
}

function renderRecoveryDialog() {
  const dialog = $('#recovery-dialog');
  if (!dialog) return;
  const list = $('#recovery-list');
  list.replaceChildren();
  const openIds = new Set(documents.map(doc => doc.id));
  const ordered = [...recoveryDrafts].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  for (const item of ordered) {
    const row = document.createElement('div');
    row.className = 'recovery-item';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.recoveryId = item.id;
    checkbox.checked = !item.inUse && !openIds.has(item.id);
    checkbox.disabled = item.inUse === true || openIds.has(item.id);
    checkbox.setAttribute('aria-label', `选择恢复文稿 ${item.name}`);
    const details = document.createElement('span');
    details.className = 'recovery-item-details';
    const name = document.createElement('strong');
    name.textContent = item.name;
    const meta = document.createElement('small');
    const updatedAt = Number.isFinite(Date.parse(item.updatedAt)) ? new Date(item.updatedAt).toLocaleString() : '更新时间未知';
    const estimatedBytes = (item.text?.length || 0) * 2 + (item.savedText?.length || 0) * 2;
    const estimatedSize = estimatedBytes < 1024 * 1024 ? `${Math.max(1, Math.round(estimatedBytes / 1024))} KiB` : `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MiB`;
    meta.textContent = `${updatedAt} · 约 ${estimatedSize}（未压缩）${item.inUse || openIds.has(item.id) ? ' · 正在窗口中编辑' : ''}`;
    details.append(name, meta);
    label.append(checkbox, details);
    row.append(label);
    list.append(row);
  }
  const available = availableRecoveryDrafts().length;
  const inUse = recoveryDrafts.filter(item => item.inUse || openIds.has(item.id)).length;
  $('#recovery-status').textContent = `${recoveryDrafts.length} 份草稿 · ${available} 份可恢复或清理${inUse ? ` · ${inUse} 份正在窗口中编辑，需先保存或关闭` : ''}；草稿不会按时间自动过期。`;
  $('#recovery-restore-selected').disabled = list.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)').length === 0;
  $('#recovery-delete-selected').disabled = list.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)').length === 0;
  $('#recovery-restore-all').disabled = available === 0;
  $('#recovery-clear-all').disabled = recoveryDrafts.length === 0 || inUse > 0;
}

async function refreshRecoveryDrafts() {
  if (!window.cotedit?.isDesktop || !window.cotedit.listRecoveryDrafts) return;
  try {
    recoveryDrafts = await window.cotedit.listRecoveryDrafts();
    syncMenuState();
    if ($('#recovery-dialog')?.open) renderRecoveryDialog();
    if (recoveryStartupPending && availableRecoveryDrafts().length && !$('#recovery-dialog')?.open) {
      recoveryStartupPending = false;
      void showRecoveryManagerDialog();
    }
  } catch (error) {
    showToast(`无法读取恢复草稿：${error.message || '请重试'}`);
  }
}

async function showRecoveryManagerDialog() {
  if (!window.cotedit?.isDesktop) { showToast('恢复草稿管理器仅在桌面版可用。'); return; }
  const dialog = $('#recovery-dialog');
  if (dialog.open) return;
  recoveryStartupPending = false;
  recoveryReturnFocus = document.activeElement;
  await refreshRecoveryDrafts();
  if (!recoveryDrafts.length) { showToast('当前没有可恢复的草稿。'); return; }
  renderRecoveryDialog();
  dialog.showModal();
  ($('#recovery-list input:not(:disabled)') || $('#recovery-close')).focus();
}

function recoveredDocumentFromDraft(item) {
  const doc = createDocument(item.text, item.name, null, false, { ...item, plainText: true });
  doc.id = item.id;
  doc.path = null;
  doc.savedText = item.savedText;
  doc.savedEncoding = item.savedEncoding;
  doc.savedEol = item.savedEol;
  doc.savedLineEndings = [...(item.savedLineEndings || [])];
  doc.savedBom = item.savedBom === true;
  doc.restored = true;
  return doc;
}

async function restoreRecoveryDrafts(ids = null) {
  const selectedIds = ids ? new Set(ids) : new Set(availableRecoveryDrafts().map(item => item.id));
  const selected = recoveryDrafts.filter(item => selectedIds.has(item.id) && !item.inUse && !documents.some(doc => doc.id === item.id));
  if (!selected.length) { showToast('没有可恢复的草稿。'); return; }
  if (documents.length === 1 && documents[0].name === '未命名.txt' && !documents[0].path && !documents[0].text && !isDirty(documents[0])) {
    documents = [];
  }
  const restored = selected.map(recoveredDocumentFromDraft);
  documents.push(...restored);
  switchDocument(restored[0]);
  $('#recovery-dialog').close();
  await persistSession({ immediate: true });
  await refreshRecoveryDrafts();
  showToast(`已恢复 ${restored.length} 份草稿；之后保存或明确丢弃才会从恢复库移除。`);
}

function selectedRecoveryDraftIds() {
  return [...$('#recovery-list').querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')].map(input => input.dataset.recoveryId);
}

async function deleteSelectedRecoveryDrafts() {
  const ids = selectedRecoveryDraftIds();
  if (!ids.length) return;
  try {
    recoveryDrafts = await window.cotedit.deleteRecoveryDrafts(ids);
    renderRecoveryDialog();
    syncMenuState();
    showToast(`已删除 ${ids.length} 份本地恢复草稿。`);
  } catch (error) { showToast(`未能删除恢复草稿：${error.message || '请重试'}`); }
}

async function clearRecoveryDrafts() {
  if (!recoveryDrafts.length) return;
  if (!confirm(`将永久删除恢复库中的全部 ${recoveryDrafts.length} 份草稿。此操作不会关闭或修改当前打开的文稿，且不能撤销。继续？`)) return;
  try {
    recoveryDrafts = await window.cotedit.clearRecoveryDrafts();
    renderRecoveryDialog();
    syncMenuState();
    showToast('恢复库已清空。');
  } catch (error) { showToast(`未能清空恢复库：${error.message || '请先关闭或保存正在编辑的恢复稿'}`); }
}

function handleMenu(channel, value) {
  const commands = {
    'menu:new': newDocument, 'menu:new-tab': newDocument, 'menu:open': openFiles, 'menu:open-recent': openRecent, 'menu:recover-drafts': showRecoveryManagerDialog, 'menu:print': printDocument, 'menu:save': () => saveDocument(false), 'menu:save-as': () => saveDocument(true),
    'menu:revert': revertToSaved, 'menu:reveal-file': revealActiveFile, 'menu:copy-path': copyActiveFilePath,
    'menu:export-settings': exportSettingsFile, 'menu:import-settings': importSettingsFile, 'menu:page-setup': showPageSetup,
    'menu:save-all': saveAllDocuments, 'menu:find': showSearchPanel, 'menu:find-all': findAllMatches, 'menu:multiple-replace': showMultipleReplaceManager,
    'menu:multiple-replace-definition': runMultipleReplaceDefinitionById,
    'menu:select-all-find-matches': selectAllSearchMatches,
    'menu:highlight-all': highlightAllSearchMatches, 'menu:remove-highlights': removeSearchHighlights,
    'menu:replace': focusReplaceField, 'menu:replace-next': replaceAndFindNext, 'menu:replace-all': () => replaceSearchMatch(true),
    'menu:use-selection-for-find': useSelectionForFind, 'menu:use-selection-for-replace': useSelectionForReplace,
    'menu:jump-to-selection': jumpToSelection,
    'menu:insert-snippet': insertSnippetById, 'menu:manage-snippets': showSnippetManager,
    'menu:search-folder': openFolderSearch,
    'menu:folder-browser': openFolderNavigation, 'menu:folder-find': openFolderSearch,
    'menu:document-inspector': toggleDocumentInspector,
    'menu:toggle-inspector': toggleInspectorGroup,
    'menu:find-next': () => applySearch(true), 'menu:find-previous': () => applySearch(true, true),
    'menu:go-to-line': showGoToLineDialog, 'menu:select-line': selectCurrentLine, 'menu:select-word': selectCurrentWord, 'menu:select-enclosing-symbols': selectEnclosingSymbols,
    'menu:undo': () => undo(activeEditor()), 'menu:redo': () => redo(activeEditor()),
    'menu:paste-exactly': text => pasteExactText(activeEditor(), text),
    'menu:insert-backslash': () => insertLiteralText('\\'),
    'menu:insert-yen-mark': () => insertLiteralText('¥'),
    'menu:insert-unicode-code-point': showUnicodeCodePointDialog,
    'menu:copy-as-rich-text': () => copySelectionAsRichText(activeEditor()),
    'menu:indent-more': () => indentMore(activeEditor()), 'menu:indent-less': () => indentLess(activeEditor()),
    'menu:indent-to-spaces': () => convertSelectedIndentation('spaces'), 'menu:indent-to-tabs': () => convertSelectedIndentation('tabs'),
    'menu:duplicate-line': () => copyLineDown(activeEditor()), 'menu:delete-line': () => deleteLine(activeEditor()),
    'menu:delete': () => { const view = activeEditor(); return view ? deleteCharBackward(view) : false; },
    'menu:move-line-up': () => moveLineUp(activeEditor()), 'menu:move-line-down': () => moveLineDown(activeEditor()),
    'menu:join-current-lines': joinCurrentLines, 'menu:split-selection-lines': splitSelectionByLines, 'menu:complete': () => startCompletion(activeEditor()),
    'menu:select-column-up': () => selectColumn(-1), 'menu:select-column-down': () => selectColumn(1),
    'menu:uppercase': () => transformSelectedText(uppercaseText), 'menu:lowercase': () => transformSelectedText(lowercaseText),
    'menu:capitalize': () => transformSelectedText(capitalizeWords, '首字母大写转换失败'),
    'menu:replace-quotes': () => transformSelectedText(replacePairedStraightQuotes),
    'menu:straighten-quotes': () => transformSelectedText(straightenCurlyQuotes),
    'menu:replace-dashes': () => transformSelectedText(replaceDoubleHyphensWithEmDash, '破折号转换失败', true),
    'menu:replace-text': replaceTextInSelection,
    'menu:url-encode': () => transformSelectedText(encodeURLComponent, 'URL 编码失败'),
    'menu:url-decode': () => transformSelectedText(decodeURLComponent),
    'menu:unicode-nfc': () => transformSelectedText(text => normalizeUnicode(text, 'NFC'), 'Unicode NFC 规范化失败'),
    'menu:unicode-nfd': () => transformSelectedText(text => normalizeUnicode(text, 'NFD'), 'Unicode NFD 规范化失败'),
    'menu:unicode-nfkc': () => transformSelectedText(text => normalizeUnicode(text, 'NFKC'), 'Unicode NFKC 规范化失败'),
    'menu:unicode-nfkd': () => transformSelectedText(text => normalizeUnicode(text, 'NFKD'), 'Unicode NFKD 规范化失败'),
    'menu:unicode-nfkc-casefold': () => transformSelectedText(text => normalizeUnicode(text, 'NFKC_CF'), 'Unicode NFKC Case-Fold 规范化失败'),
    'menu:unicode-modified-nfd': () => transformSelectedText(text => normalizeUnicode(text, 'MODIFIED_NFD'), 'Modified NFD 规范化失败'),
    'menu:unicode-modified-nfc': () => transformSelectedText(text => normalizeUnicode(text, 'MODIFIED_NFC'), 'Modified NFC 规范化失败'),
    'menu:fullwidth': () => transformSelectedText(convertToFullWidth, '全角转换失败'),
    'menu:halfwidth': () => transformSelectedText(convertToHalfWidth, '半角转换失败'),
    'menu:fullwidth-roman': () => transformSelectedText(convertRomanToFullWidth, '字母数字全角转换失败'),
    'menu:halfwidth-roman': () => transformSelectedText(convertRomanToHalfWidth, '字母数字半角转换失败'),
    'menu:surround-single-quotes': () => surroundSelection("'"), 'menu:surround-double-quotes': () => surroundSelection('"'),
    'menu:surround-parentheses': () => surroundSelection('(', ')'), 'menu:surround-braces': () => surroundSelection('{', '}'), 'menu:surround-brackets': () => surroundSelection('[', ']'),
    'menu:surround-custom': showCustomSurroundDialog,
    'menu:sort-lines': () => sortSelectedLines(),
    'menu:sort-by-pattern': showPatternSortDialog,
    'menu:reverse-lines': reverseSelectedLines,
    'menu:shuffle-lines': shuffleSelectedLines,
    'menu:delete-duplicates': deleteDuplicateLines,
    'menu:join-lines': () => transformSelectedText(text => text.replace(/\s*\n\s*/g, ' '), '合并行失败', true),
    'menu:toggle-utf8-bom': toggleUtf8Bom,
    'menu:toggle-comment': () => toggleCommentAtVisualIndent(activeEditor(), settings.tabWidth, settings.appendsCommentSpacer),
    'menu:comment-out': () => commentOutSelection(activeEditor(), settings.appendsCommentSpacer),
    'menu:inline-comment': () => lineCommentSelection(activeEditor(), settings.appendsCommentSpacer),
    'menu:block-comment': () => blockCommentSelection(activeEditor(), settings.appendsCommentSpacer),
    'menu:uncomment': () => uncommentSelectionCommand(activeEditor(), settings.appendsCommentSpacer),
    'menu:trim-trailing-whitespace': trimTrailingWhitespace,
    'menu:reset-syntax': () => activeDoc && changeLanguage(languageForDocument(activeDoc.name, activeDoc.text)),
    'menu:speech-start': startSpeechSynthesis,
    'menu:speech-stop': stopSpeechSynthesis,
    'menu:toggle-smart-quotes': () => toggleSubstitutionMode('smartQuotes'),
    'menu:toggle-smart-dashes': () => toggleSubstitutionMode('smartDashes'),
    'menu:toggle-text-replacement': () => toggleSubstitutionMode('textReplacement'),
    'menu:toggle-spelling': () => {
      const language = activeDoc?.language;
      if (!language) return;
      settings.continuousSpellCheckingByLanguage = setContinuousSpellCheckingOverride(
        settings.continuousSpellCheckingByLanguage, language, !spellCheckingEnabled(language)
      );
      persistSettings();
      applySettings();
    },
    'menu:toggle-wrap': () => { settings.wrap = !settings.wrap; persistSettings(); applySettings(); },
    'menu:toggle-ligatures': () => toggleSetting('ligatures'),
    'menu:font-type': setEditorFontType,
    'menu:show-fonts': showFontPicker,
    'menu:orientation-horizontal': () => { settings.verticalText = false; persistSettings(); applySettings(); syncMenuState(); },
    'menu:orientation-vertical': () => { settings.verticalText = true; persistSettings(); applySettings(); syncMenuState(); },
    'menu:writing-direction-ltr': () => setDocumentWritingDirection('ltr'),
    'menu:writing-direction-rtl': () => setDocumentWritingDirection('rtl'),
    'menu:toggle-line-numbers': () => { settings.showLineNumbers = !settings.showLineNumbers; persistSettings(); applySettings(); },
    'menu:auto-expand-tab': () => {
      const current = effectiveAutoExpandTab(activeDoc?.detectedIndentStyle, settings.autoExpandTab);
      if (activeDoc) activeDoc.detectedIndentStyle = null;
      settings.autoExpandTab = !current;
      persistSettings();
      applySettings();
    },
    'menu:indent-follow-global': useGlobalIndentForActiveLanguage,
    'menu:toggle-invisibles': () => toggleSetting('showInvisibles'),
    'menu:toggle-indent-guides': () => toggleSetting('showIndentGuides'),
    'menu:toggle-page-guide': () => toggleSetting('showPageGuide'),
    'menu:toggle-sidebar': () => toggleSetting('showSidebar'),
    'menu:toggle-status-bar': () => toggleSetting('showStatusBar'),
    'menu:toggle-tab-bar': () => toggleSetting('showTabBar'),
    'menu:toggle-toolbar': () => toggleSetting('showToolbar'),
    'menu:toggle-navigation-bar': () => toggleSetting('showNavigationBar'),
    'menu:open-outline-menu': openOutlineNavigationMenu,
    'menu:customize-toolbar': showToolbarCustomizationDialog,
    'menu:insert-snippet': insertSnippetById, 'menu:manage-snippets': showSnippetManager,
    'menu:stack-editors-vertically': () => toggleSetting('splitEditorsVertically'),
    'menu:font-up': () => changeFontSize(1),
    'menu:font-down': () => changeFontSize(-1),
    'menu:font-reset': () => { settings.fontSize = DEFAULT_SETTINGS.fontSize; persistSettings(); applySettings(); },
    'menu:import-cot-syntax': importCotEditorSyntax,
    'menu:customize-syntax-menu': showSyntaxMenuDialog,
    'menu:show-file-mapping-conflicts': showSyntaxMappingConflictDialog,
    'menu:import-cot-theme': importCotEditorTheme,
    'menu:toggle-split': toggleSplit, 'menu:focus-next-editor': focusOtherSplitEditor, 'menu:focus-previous-editor': focusOtherSplitEditor,
    'menu:prevent-editing': togglePreventEditing,
    'menu:outline': () => togglePanel('outline-panel'), 'menu:inspector': () => togglePanel('character-panel'),
    'menu:select-previous-outline-item': selectPreviousOutlineItem, 'menu:select-next-outline-item': selectNextOutlineItem,
    'menu:inspect-character': showSelectedCharacterInfo,
    'menu:advanced-character-count': toggleAdvancedCharacterCount,
    'menu:edit-color-code': showColorCodeEditor,
    'menu:warnings': () => togglePanel('warnings-panel'),
    'menu:settings': () => runShortcut('settings'), 'menu:integration-settings': showRemoteEditingDialog, 'menu:donate': showDonationDialog,
    'menu:custom-tab-width': () => showCustomWidthDialog('tab'), 'menu:custom-indent-width': () => showCustomWidthDialog('indent'),
    'menu:previous-document': () => cycleDocument(-1),
    'menu:next-document': () => cycleDocument(1), 'menu:open-folder': openFolderNavigation,
    'menu:close-document': () => activeDoc && closeDocument(activeDoc.id), 'menu:help': showHelp,
    'menu:shortcuts': showShortcuts, 'menu:quick-actions': showQuickActions
  };
  if (channel === 'menu:syntax') changeLanguage(value);
  else if (channel === 'menu:encoding') setEncoding(value);
  else if (channel === 'menu:eol') setLineEnding(value);
  else if (channel === 'menu:inspect-line-endings') showLineEndingDiagnostics();
  else if (channel === 'menu:indent-width') setIndent(value);
  else if (channel === 'menu:tab-width') setTabWidth(value);
  else if (channel === 'menu:theme') setTheme(value);
  else if (channel === 'menu:run-script') runUserScript(value);
  else commands[channel]?.(value);
}

const shortcutActionHandlers = {
  new: newDocument, newTab: newDocument, newWindow: () => window.cotedit?.newWindow?.() || showToast('新窗口仅在桌面版可用。'),
  open: openFiles, openFolder: openFolderNavigation, print: printDocument, pageSetup: showPageSetup,
  save: () => saveDocument(false), saveAs: () => saveDocument(true), saveAll: saveAllDocuments,
  close: () => activeDoc && closeDocument(activeDoc.id),
  undo: () => undo(activeEditor()), redo: () => redo(activeEditor()), selectWord: selectCurrentWord,
  copyAsRichText: () => copySelectionAsRichText(activeEditor()),
  find: showSearchPanel, findNext: () => applySearch(true), findPrevious: () => applySearch(true, true), findAll: findAllMatches,
  jumpToSelection,
  highlightAll: highlightAllSearchMatches,
  removeHighlights: removeSearchHighlights,
  goToLine: showGoToLineDialog, surroundCustom: showCustomSurroundDialog, selectLine: selectCurrentLine,
  useSelectionForFind, useSelectionForReplace, replaceAndFindNext,
  searchFolder: openFolderSearch, folderBrowser: openFolderNavigation, folderFind: openFolderSearch,
  inspectCharacter: showSelectedCharacterInfo,
  editColorCode: showColorCodeEditor,
  duplicateLine: () => copyLineDown(activeEditor()), deleteLine: () => deleteLine(activeEditor()),
  moveLineUp: () => moveLineUp(activeEditor()), moveLineDown: () => moveLineDown(activeEditor()),
  joinCurrentLines, splitSelectionLines: splitSelectionByLines,
  toggleComment: () => toggleCommentAtVisualIndent(activeEditor(), settings.tabWidth, settings.appendsCommentSpacer),
  insertBackslash: () => insertLiteralText('\\'),
  insertYenMark: () => insertLiteralText('¥'),
  selectColumnUp: () => selectColumn(-1), selectColumnDown: () => selectColumn(1),
  indentLess: () => indentLess(activeEditor()), indentMore: () => indentMore(activeEditor()),
  complete: () => startCompletion(activeEditor()),
  toggleWrap: () => { settings.wrap = !settings.wrap; persistSettings(); applySettings(); },
  toggleSidebar: () => toggleSetting('showSidebar'), toggleTabBar: () => toggleSetting('showTabBar'), toggleToolbar: () => toggleSetting('showToolbar'),
  toggleInspector: toggleInspectorGroup,
  selectPreviousOutlineItem, selectNextOutlineItem,
  fontUp: () => changeFontSize(1), fontDown: () => changeFontSize(-1),
  fontReset: () => { settings.fontSize = DEFAULT_SETTINGS.fontSize; persistSettings(); applySettings(); },
  toggleSplit, focusNextEditor: focusOtherSplitEditor, focusPreviousEditor: focusOtherSplitEditor,
  previousDocument: () => cycleDocument(-1), nextDocument: () => cycleDocument(1),
  settings: () => setSettingsPopover(),
  openOutlineMenu: openOutlineNavigationMenu,
  quickActions: showQuickActions
};

function runShortcut(id) {
  return shortcutActionHandlers[id]?.();
}

let quickActionItems = [];
let quickActionMatches = [];
let quickActionActiveIndex = 0;
let quickActionReturnFocus = null;
let quickActionFocusRestorePending = false;
let quickActionLoadWarning = '';

function nativeAcceleratorLabel(value, platform) {
  const isMac = platform === 'darwin' || /Mac/i.test(String(platform));
  const labels = {
    CmdOrCtrl: isMac ? '⌘' : 'Ctrl', Command: isMac ? '⌘' : 'Ctrl', Cmd: isMac ? '⌘' : 'Ctrl',
    Control: isMac ? '⌃' : 'Ctrl', Ctrl: isMac ? '⌃' : 'Ctrl', Alt: isMac ? '⌥' : 'Alt', Option: isMac ? '⌥' : 'Alt',
    Shift: isMac ? '⇧' : 'Shift', Up: '↑', ArrowUp: '↑', Down: '↓', ArrowDown: '↓', Left: '←', ArrowLeft: '←', Right: '→', ArrowRight: '→',
    Escape: 'Escape', Backspace: isMac ? '⌫' : 'Backspace'
  };
  return String(value || '').split('+').map(part => labels[part] || part.toUpperCase()).join(isMac ? '' : ' + ');
}

function quickActionAccelerator(item) {
  const platform = window.cotedit?.platform || navigator.platform;
  const shortcutId = String(item.id || '').replace(/^menu-/, '').replace(/-([a-z0-9])/g, (_match, character) => character.toUpperCase());
  const shortcuts = applyShortcutOverrides(SHORTCUTS, settings.keyBindings);
  const shortcut = shortcuts.find(candidate => candidate.id === shortcutId)
    || shortcuts.find(candidate => item.accelerator && [candidate.accelerator, candidate.acceleratorMac].includes(item.accelerator));
  return shortcut ? formatShortcut(shortcut, platform) : nativeAcceleratorLabel(item.accelerator, platform);
}

function fallbackQuickActionItems() {
  const platform = window.cotedit?.platform || navigator.platform;
  return applyShortcutOverrides(SHORTCUTS, settings.keyBindings)
    .filter(item => item.id !== 'quickActions' && Object.prototype.hasOwnProperty.call(shortcutActionHandlers, item.id))
    .map(item => ({ id: item.id, label: item.label, group: item.group, accelerator: formatShortcut(item, platform), enabled: true, source: 'shortcut' }));
}

function renderQuickActions(query = $('#quick-actions-query').value) {
  const list = $('#quick-actions-results');
  const input = $('#quick-actions-query');
  quickActionMatches = filterQuickActions(quickActionItems, query, 100);
  quickActionActiveIndex = quickActionMatches.length ? Math.min(quickActionActiveIndex, quickActionMatches.length - 1) : -1;
  list.replaceChildren();
  quickActionMatches.forEach((item, index) => {
    const option = document.createElement('div');
    option.id = `quick-action-option-${index}`;
    option.className = 'quick-action-option';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(index === quickActionActiveIndex));
    option.dataset.quickActionIndex = String(index);
    if (item.enabled === false) option.setAttribute('aria-disabled', 'true');
    const main = document.createElement('span');
    main.className = 'quick-action-option-main';
    const label = document.createElement('span');
    label.className = 'quick-action-option-label';
    label.textContent = item.label;
    const group = document.createElement('span');
    group.className = 'quick-action-option-group';
    group.textContent = item.group || '菜单';
    main.append(label, group);
    option.append(main);
    const accelerator = quickActionAccelerator(item);
    if (accelerator) {
      const hint = document.createElement('span');
      hint.className = 'quick-action-accelerator';
      hint.textContent = accelerator;
      option.append(hint);
    }
    list.append(option);
  });
  if (!quickActionMatches.length) {
    const empty = document.createElement('div');
    empty.className = 'quick-actions-empty';
    empty.textContent = '没有匹配的菜单命令';
    list.append(empty);
  }
  if (quickActionActiveIndex >= 0) input.setAttribute('aria-activedescendant', `quick-action-option-${quickActionActiveIndex}`);
  else input.removeAttribute('aria-activedescendant');
  const count = quickActionMatches.length;
  $('#quick-actions-status').textContent = `${quickActionLoadWarning ? `${quickActionLoadWarning} · ` : ''}${count ? `${count} 个命令` : '没有匹配的菜单命令'} · ↑↓ 选择 · Enter 执行 · Escape 关闭`;
}

function restoreQuickActionFocus() {
  if (!quickActionFocusRestorePending) return;
  quickActionFocusRestorePending = false;
  const target = quickActionReturnFocus;
  quickActionReturnFocus = null;
  if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
  else activeEditor()?.focus();
}

async function performQuickAction(index = quickActionActiveIndex) {
  const item = quickActionMatches[index];
  if (!item) return;
  if (item.enabled === false) { showToast('此菜单命令当前不可用。'); return; }
  $('#quick-actions-dialog').close();
  restoreQuickActionFocus();
  try {
    if (item.source === 'native' && window.cotedit?.executeQuickAction) {
      if (!await window.cotedit.executeQuickAction(item.id)) showToast('此菜单命令当前不可用。');
    } else {
      await runShortcut(item.id);
    }
  } catch (error) { showToast(`无法执行菜单命令：${error.message || '请重试'}`); }
}

async function showQuickActions() {
  const dialog = $('#quick-actions-dialog');
  const input = $('#quick-actions-query');
  if (dialog.open) { input.focus(); input.select(); return; }
  const focused = document.activeElement;
  quickActionReturnFocus = focused instanceof HTMLElement && focused !== document.body ? focused : activeEditor()?.contentDOM || null;
  quickActionFocusRestorePending = true;
  quickActionItems = [];
  quickActionMatches = [];
  quickActionActiveIndex = 0;
  quickActionLoadWarning = '';
  input.value = '';
  $('#quick-actions-results').setAttribute('aria-busy', 'true');
  $('#quick-actions-status').textContent = '正在读取菜单命令…';
  dialog.showModal();
  input.focus();
  try {
    const nativeItems = window.cotedit?.isDesktop && window.cotedit.getQuickActionItems
      ? await window.cotedit.getQuickActionItems()
      : null;
    if (Array.isArray(nativeItems) && nativeItems.length) {
      quickActionItems = nativeItems.filter(item => item.id !== 'menu-quick-actions').map(item => ({ ...item, source: 'native' }));
    } else {
      quickActionItems = fallbackQuickActionItems();
      if (window.cotedit?.isDesktop) quickActionLoadWarning = '完整菜单暂不可用，仅显示快捷键命令';
    }
  } catch {
    quickActionItems = fallbackQuickActionItems();
    quickActionLoadWarning = '完整菜单暂不可用，仅显示快捷键命令';
  }
  if (!dialog.open) return;
  $('#quick-actions-results').setAttribute('aria-busy', 'false');
  renderQuickActions();
  input.focus();
}

function moveQuickActionSelection(delta) {
  if (!quickActionMatches.length) return;
  quickActionActiveIndex = (quickActionActiveIndex + delta + quickActionMatches.length) % quickActionMatches.length;
  renderQuickActions();
  $('#quick-actions-results').querySelector(`#quick-action-option-${quickActionActiveIndex}`)?.scrollIntoView?.({ block: 'nearest' });
}

function setOverflowMenu(open, focusActive = false) {
  const menu = $('#tab-overflow-menu');
  menu.classList.toggle('hidden', !open);
  $('#tab-overflow').setAttribute('aria-expanded', String(open));
  if (open && focusActive) {
    requestAnimationFrame(() => {
      if (menu.classList.contains('hidden')) return;
      const active = menu.querySelector('[aria-checked="true"]') || menu.querySelector('[role="menuitemradio"]');
      active?.focus();
    });
  }
}

function registerEvents() {
  $('#quick-actions-query').addEventListener('input', () => {
    quickActionActiveIndex = 0;
    renderQuickActions();
  });
  $('#quick-actions-query').addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); moveQuickActionSelection(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveQuickActionSelection(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); void performQuickAction(); }
  });
  $('#quick-actions-results').addEventListener('click', event => {
    const option = event.target.closest('[data-quick-action-index]');
    if (option) void performQuickAction(Number(option.dataset.quickActionIndex));
  });
  $('#quick-actions-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    $('#quick-actions-dialog').close();
    restoreQuickActionFocus();
  });
  $('#quick-actions-dialog').addEventListener('close', restoreQuickActionFocus);
  window.addEventListener('resize', schedulePageGuideUpdate, { passive: true });
  window.addEventListener('resize', syncTabCloseButton, { passive: true });
  $('#tabs').addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) switchDocument(documents.find(doc => doc.id === tab.dataset.id));
  });
  $('#tabs').addEventListener('pointerover', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) syncTabCloseButton(tab.dataset.id);
  });
  $('#tabs').addEventListener('focusin', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) syncTabCloseButton(tab.dataset.id);
  });
  $('#tabs').addEventListener('scroll', () => syncTabCloseButton(), { passive: true });
  $('#tab-strip').addEventListener('pointerleave', () => syncTabCloseButton(activeDoc?.id));
  $('#tab-close').addEventListener('click', event => {
    const documentId = event.currentTarget.dataset.close;
    if (documentId) closeDocument(documentId);
  });
  $('#tabs').addEventListener('keydown', event => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...$('#tabs').querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    const nextDocument = documents.find(doc => doc.id === nextTab?.dataset.id);
    if (!nextDocument) return;
    event.preventDefault();
    switchDocument(nextDocument);
    requestAnimationFrame(() => $('#tabs').querySelector(`[data-id="${nextDocument.id}"]`)?.focus());
  });
  $('#tab-overflow').addEventListener('click', () => setOverflowMenu($('#tab-overflow-menu').classList.contains('hidden'), true));
  $('#tab-overflow-menu').addEventListener('click', event => {
    const item = event.target.closest('[role="menuitemradio"]');
    if (!item) return;
    const documentId = item.dataset.id;
    switchDocument(documents.find(doc => doc.id === documentId));
    setOverflowMenu(false);
    requestAnimationFrame(() => [...$('#tabs').querySelectorAll('[role="tab"]')].find(tab => tab.dataset.id === documentId)?.focus());
  });
  $('#tab-overflow-menu').addEventListener('keydown', event => {
    const items = [...$('#tab-overflow-menu').querySelectorAll('[role="menuitemradio"]')];
    const index = items.indexOf(event.target.closest('[role="menuitemradio"]'));
    if (event.key === 'Escape') {
      event.preventDefault();
      setOverflowMenu(false);
      requestAnimationFrame(() => $('#tab-overflow').focus());
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && items.length) {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[nextIndex].focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#tab-overflow-menu, #tab-overflow')) setOverflowMenu(false);
    if (!event.target.closest('#settings-popover, #settings-toggle') && !$('#settings-popover').classList.contains('hidden')) setSettingsPopover(false);
    if (!event.target.closest('#folder-add-menu')) setFolderAddMenuOpen(false);
    if (!event.target.closest('#folder-preview-external-control')) setFolderPreviewExternalMenuOpen(false);
  });
  $('#new-file').addEventListener('click', newDocument);
  $('#sidebar-new').addEventListener('click', newDocument);
  $('#welcome-new').addEventListener('click', newDocument);
  $('#open-file').addEventListener('click', openFiles);
  $('#welcome-open').addEventListener('click', openFiles);
  $('#save-file').addEventListener('click', () => saveDocument(false));
  $('#folder-navigation-toggle').addEventListener('click', toggleFolderNavigation);
  $('#folder-navigation-open').addEventListener('click', chooseFolderNavigationRoot);
  $('#folder-add-toggle').addEventListener('click', () => setFolderAddMenuOpen($('#folder-add-options').hidden, $('#folder-add-options').hidden));
  $('#folder-add-options').addEventListener('keydown', handleFolderAddMenuKeydown);
  $('#folder-add-file').addEventListener('click', () => { void createFolderNavigationEntry('file'); });
  $('#folder-add-folder').addEventListener('click', () => { void createFolderNavigationEntry('directory'); });
  $('#folder-history-previous').addEventListener('click', () => navigateFolderDocumentHistory(-1));
  $('#folder-history-next').addEventListener('click', () => navigateFolderDocumentHistory(1));
  $('#folder-navigation-parent').addEventListener('click', () => {
    if (folderNavigationParentPath) {
      folderNavigationPath = folderNavigationParentPath;
      hideFolderPreview();
      renderFolderNavigation();
    }
  });
  $('#find-button').addEventListener('click', showSearchPanel);
  $('#directory-search-button').addEventListener('click', openFolderSearch);
  $('#outline-toggle').addEventListener('click', () => togglePanel('outline-panel'));
  $('#split-toggle').addEventListener('click', toggleSplit);
  $('#inspector-toggle').addEventListener('click', () => togglePanel('character-panel'));
  $('#word-count').addEventListener('click', showAdvancedCharacterCountOptions);
  $('#advanced-count-options').addEventListener('click', showAdvancedCharacterCountOptions);
  $('#advanced-count-stop').addEventListener('click', () => stopAdvancedCharacterCount(true));
  $('#count-unit').addEventListener('change', updateCountOptionsForm);
  $('#count-normalizes').addEventListener('change', updateCountOptionsForm);
  $('#count-ignores-newlines').addEventListener('change', updateCountOptionsForm);
  $('#count-ignores-whitespaces').addEventListener('change', updateCountOptionsForm);
  $('#character-count-apply').addEventListener('click', applyAdvancedCharacterCountOptions);
  $('#character-count-cancel').addEventListener('click', () => $('#character-count-dialog').close());
  $('#character-count-close').addEventListener('click', () => $('#character-count-dialog').close());
  $('#character-count-dialog').addEventListener('close', () => {
    const target = advancedCountReturnFocus;
    advancedCountReturnFocus = null;
    restoreDialogFocus($('#character-count-dialog'), target);
  });
  $('#color-code-value').addEventListener('input', () => {
    const color = parseColorCode($('#color-code-value').value);
    if (color && COLOR_CODE_FORMATS.some(format => format.id === color.format)) $('#color-code-format').value = color.format;
    validateColorCodeInput();
  });
  $('#color-code-picker').addEventListener('input', updateColorCodeFromPicker);
  $('#color-code-alpha').addEventListener('input', updateColorCodeFromPicker);
  $('#color-code-format').addEventListener('change', changeColorCodeFormat);
  $('#color-code-cancel').addEventListener('click', () => $('#color-code-dialog').close());
  $('#color-code-form').addEventListener('submit', insertEditedColorCode);
  $('#color-code-dialog').addEventListener('close', () => {
    colorCodeTarget = null;
    if (activeDoc) activeEditor()?.focus();
  });
  $('#warnings-toggle').addEventListener('click', () => togglePanel('warnings-panel'));
  $('#warnings-refresh').addEventListener('click', updateEncodingWarnings);
  $('#directory-name-filter').addEventListener('input', event => {
    const input = event.currentTarget;
    const characters = Array.from(input.value);
    if (characters.length > 256) input.value = characters.slice(0, 256).join('');
    if (folderNameFilterTimer !== null) clearTimeout(folderNameFilterTimer);
    folderNameFilterTimer = setTimeout(() => {
      folderNameFilterTimer = null;
      void renderFolderNavigation();
    }, 120);
  });
  $('#folder-search-form').addEventListener('submit', event => { event.preventDefault(); runDirectorySearch(); });
  $('#directory-search-clear').addEventListener('click', () => clearDirectorySearch(true));
  $('#directory-query').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); runDirectorySearch(); }
    if (event.key === 'Escape') { event.preventDefault(); clearDirectorySearch(true); }
  });
  $('#folder-preview-open').addEventListener('click', () => folderPreviewPath && openFolderNavigationDocument(folderPreviewPath));
  $('#folder-preview-open-plain').addEventListener('click', () => folderPreviewPath && openFolderNavigationDocument(folderPreviewPath, 0, true, { plainText: true }));
  $('#folder-preview-open-new-window').addEventListener('click', () => folderPreviewPath && openFolderPreviewInNewWindow(folderPreviewPath));
  $('#folder-preview-open-external').addEventListener('click', () => {
    setFolderPreviewExternalMenuOpen(false);
    if (folderPreviewPath) openFolderPreviewExternally(folderPreviewPath);
  });
  $('#folder-preview-external-menu-toggle').addEventListener('click', () => {
    const opening = $('#folder-preview-external-menu').hidden;
    setFolderPreviewExternalMenuOpen(opening, opening);
    if (opening && folderPreviewPath) void refreshFolderPreviewExternalApplications(folderPreviewPath);
  });
  $('#folder-preview-external-menu').addEventListener('keydown', handleFolderPreviewExternalMenuKeydown);
  $('#folder-preview-registered-applications').addEventListener('click', event => {
    const button = event.target.closest('button[data-registered-application-id]');
    if (!button || !event.currentTarget.contains(button)) return;
    const filePath = folderPreviewPath;
    const applicationId = button.dataset.registeredApplicationId;
    setFolderPreviewExternalMenuOpen(false, false, true);
    if (filePath && applicationId) void openFolderPreviewWithRegisteredApplication(filePath, applicationId, button);
  });
  $('#folder-preview-open-default').addEventListener('click', () => {
    setFolderPreviewExternalMenuOpen(false, false, true);
    if (folderPreviewPath) openFolderPreviewExternally(folderPreviewPath);
  });
  $('#folder-preview-open-with').addEventListener('click', () => {
    setFolderPreviewExternalMenuOpen(false, false, true);
    if (folderPreviewPath) openFolderPreviewWithApplication(folderPreviewPath);
  });
  document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', () => {
    closePanel(button.dataset.closePanel, true);
  }));
  $('#encoding-select').addEventListener('change', event => setEncoding(event.target.value));
  $('#eol-select').addEventListener('change', event => setLineEnding(event.target.value));
  $('#line-ending-warning').addEventListener('click', showLineEndingDiagnostics);
  $('#line-ending-close').addEventListener('click', () => $('#line-ending-dialog').close());
  $('#line-ending-dialog').addEventListener('close', () => $('#line-ending-warning').focus());
  $('#line-ending-normalize').addEventListener('click', event => {
    const value = event.currentTarget.dataset.value;
    if (!LINE_ENDING_TYPES.includes(value)) return;
    $('#line-ending-dialog').close();
    setLineEnding(value);
    $('#eol-select').focus();
    showToast(`所有换行符已统一为 ${value}`);
  });
  $('#wrap-toggle').addEventListener('click', () => { settings.wrap = !settings.wrap; persistSettings(); applySettings(); });
  $('#line-toggle').addEventListener('click', () => { settings.showLineNumbers = !settings.showLineNumbers; persistSettings(); applySettings(); });
  $('#language-select').addEventListener('change', event => changeLanguage(event.target.value));
  $('#indent-toggle').addEventListener('click', () => setIndent(indentationFor() === 'tab' ? '4' : 'tab'));
  $('#theme-toggle').addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#shortcuts-toggle').addEventListener('click', showShortcuts);
  $('#shortcut-settings-open').addEventListener('click', () => {
    setSettingsPopover(false);
    showShortcuts();
  });
  $('#syntax-menu-settings').addEventListener('click', showSyntaxMenuDialog);
  $('#syntax-mapping-conflicts-settings').addEventListener('click', () => {
    setSettingsPopover(false);
    showSyntaxMappingConflictDialog();
  });
  $('#syntax-mapping-conflicts-close').addEventListener('click', () => $('#syntax-mapping-conflicts-dialog').close());
  $('#syntax-menu-filter').addEventListener('input', filterSyntaxMenuDialog);
  $('#syntax-menu-list').addEventListener('change', event => {
    const checkbox = event.target instanceof HTMLInputElement && event.target.dataset.syntaxId ? event.target : null;
    if (!checkbox || !draftHiddenSyntaxes) return;
    if (checkbox.checked) draftHiddenSyntaxes.delete(checkbox.dataset.syntaxId);
    else draftHiddenSyntaxes.add(checkbox.dataset.syntaxId);
    updateSyntaxMenuDialogCount();
  });
  $('#syntax-menu-show-all').addEventListener('click', () => {
    draftHiddenSyntaxes?.clear();
    renderSyntaxMenuDialog();
    $('#syntax-menu-filter').focus();
  });
  $('#syntax-menu-cancel').addEventListener('click', () => $('#syntax-menu-dialog').close());
  $('#syntax-menu-apply').addEventListener('click', applySyntaxMenuDialog);
  $('#syntax-menu-dialog').addEventListener('close', () => {
    if (!$('#syntax-menu-dialog').open) draftHiddenSyntaxes = null;
  });
  $('#snippet-manager-open').addEventListener('click', () => {
    setSettingsPopover(false, false);
    showSnippetManager($('#settings-toggle'));
  });
  $('#snippet-new').addEventListener('click', beginNewSnippet);
  $('#snippet-move-up').addEventListener('click', () => moveSelectedSnippet(-1));
  $('#snippet-move-down').addEventListener('click', () => moveSelectedSnippet(1));
  $('#snippet-delete').addEventListener('click', deleteSelectedSnippet);
  $('#snippet-shortcut-record').addEventListener('click', () => { void beginSnippetShortcutCapture(); });
  $('#snippet-shortcut-clear').addEventListener('click', () => {
    snippetDraftShortcut = null;
    snippetFormDirty = true;
    renderSnippetShortcutControl();
    $('#snippet-shortcut-status').textContent = '快捷键已清除；保存片段后生效。';
  });
  $('#snippet-manager-close').addEventListener('click', closeSnippetManager);
  $('#snippet-manager-cancel').addEventListener('click', closeSnippetManager);
  $('#snippet-manager-form').addEventListener('submit', saveSnippetManager);
  for (const selector of ['#snippet-name', '#snippet-scope', '#snippet-format']) {
    $(selector).addEventListener(selector === '#snippet-scope' ? 'change' : 'input', () => {
      snippetFormDirty = true;
      $('#snippet-manager-error').textContent = '';
    });
  }
  $('#snippet-manager-dialog').addEventListener('cancel', event => {
    if (!confirmDiscardSnippetDraft()) event.preventDefault();
  });
  $('#snippet-manager-dialog').addEventListener('close', restoreSnippetManagerFocus);
  $('#text-replacements-open').addEventListener('click', () => {
    setSettingsPopover(false, false);
    showTextReplacementManager($('#settings-toggle'));
  });
  $('#text-replacement-new').addEventListener('click', beginNewTextReplacement);
  $('#text-replacement-delete').addEventListener('click', deleteSelectedTextReplacement);
  $('#text-replacement-manager-close').addEventListener('click', closeTextReplacementManager);
  $('#text-replacement-cancel').addEventListener('click', closeTextReplacementManager);
  $('#text-replacement-form').addEventListener('submit', saveTextReplacementManager);
  for (const selector of ['#text-replacement-trigger', '#text-replacement-value', '#text-replacement-enabled', '#text-replacement-automatic']) {
    $(selector).addEventListener(selector === '#text-replacement-enabled' || selector === '#text-replacement-automatic' ? 'change' : 'input', () => {
      textReplacementFormDirty = true;
      $('#text-replacement-manager-error').textContent = '';
    });
  }
  $('#text-replacement-manager-dialog').addEventListener('cancel', event => {
    if (!confirmDiscardTextReplacementDraft()) event.preventDefault();
  });
  $('#text-replacement-manager-dialog').addEventListener('close', restoreTextReplacementManagerFocus);
  $('#file-drop-settings-open').addEventListener('click', () => {
    setSettingsPopover(false, false);
    showFileDropRuleManager($('#settings-toggle'));
  });
  $('#file-drop-settings-close').addEventListener('click', closeFileDropRuleManager);
  $('#file-drop-settings-cancel').addEventListener('click', closeFileDropRuleManager);
  $('#file-drop-settings-dialog').addEventListener('cancel', event => {
    if (!confirmDiscardFileDropDraft()) event.preventDefault();
  });
  $('#file-drop-settings-dialog').addEventListener('close', restoreFileDropRuleManagerFocus);
  $('#file-drop-rule-new').addEventListener('click', addFileDropRule);
  $('#file-drop-rule-up').addEventListener('click', () => moveFileDropRule(-1));
  $('#file-drop-rule-down').addEventListener('click', () => moveFileDropRule(1));
  $('#file-drop-rule-delete').addEventListener('click', deleteFileDropRule);
  $('#file-drop-rule-reset').addEventListener('click', resetFileDropRulesToDefaults);
  $('#file-drop-rule-save').addEventListener('click', saveFileDropRules);
  $('#file-drop-rule-form').addEventListener('submit', event => event.preventDefault());
  $('#file-drop-rule-list').addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !fileDropDraftRules?.length) return;
    event.preventDefault();
    const current = fileDropDraftRules.findIndex(rule => rule.id === selectedFileDropRuleId);
    const next = current < 0
      ? (event.key === 'ArrowDown' ? 0 : fileDropDraftRules.length - 1)
      : Math.max(0, Math.min(fileDropDraftRules.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    selectFileDropRule(fileDropDraftRules[next].id);
  });
  $('#file-drop-rule-form').addEventListener('input', event => {
    if (!['file-drop-rule-extensions', 'file-drop-rule-description', 'file-drop-rule-format'].includes(event.target.id)) return;
    updateFileDropRuleDraftFromForm();
    $('#file-drop-rule-status').textContent = '有未保存的修改。';
  });
  $('#file-drop-rule-scope').addEventListener('change', () => {
    updateFileDropRuleDraftFromForm();
    $('#file-drop-rule-status').textContent = '有未保存的修改。';
  });
  $('#multiple-replace-open').addEventListener('click', () => showMultipleReplaceManager($('#multiple-replace-open')));
  $('#multiple-replace-close').addEventListener('click', closeMultipleReplaceManager);
  $('#multiple-replace-cancel').addEventListener('click', closeMultipleReplaceManager);
  $('#multiple-replace-new').addEventListener('click', beginNewMultipleReplaceDefinition);
  $('#multiple-replace-import').addEventListener('click', () => $('#multiple-replace-import-input').click());
  $('#multiple-replace-import-input').addEventListener('change', event => {
    const input = event.currentTarget;
    void importMultipleReplaceFiles(input.files);
    input.value = '';
  });
  const multipleReplaceDefinitionList = $('#multiple-replace-definition-list');
  const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files');
  multipleReplaceDefinitionList.addEventListener('dragenter', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    multipleReplaceDefinitionList.classList.add('is-drop-target');
  });
  multipleReplaceDefinitionList.addEventListener('dragover', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    multipleReplaceDefinitionList.classList.add('is-drop-target');
  });
  multipleReplaceDefinitionList.addEventListener('dragleave', event => {
    if (!event.relatedTarget || !multipleReplaceDefinitionList.contains(event.relatedTarget)) {
      multipleReplaceDefinitionList.classList.remove('is-drop-target');
    }
  });
  multipleReplaceDefinitionList.addEventListener('drop', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    multipleReplaceDefinitionList.classList.remove('is-drop-target');
    void importMultipleReplaceFiles(event.dataTransfer.files);
  });
  $('#multiple-replace-definition-up').addEventListener('click', () => moveMultipleReplaceDefinition(-1));
  $('#multiple-replace-definition-down').addEventListener('click', () => moveMultipleReplaceDefinition(1));
  $('#multiple-replace-delete').addEventListener('click', deleteMultipleReplaceDefinition);
  $('#multiple-replace-add-rule').addEventListener('click', () => {
    clearMultipleReplaceHighlights();
    multipleReplaceDraft.replacements.push(makeMultipleReplaceRule());
    multipleReplaceDraftDirty = true;
    renderMultipleReplaceRules();
    $('#multiple-replace-rules .multiple-replace-rule:last-child input[data-multiple-replace-field="findString"]')?.focus();
  });
  $('#multiple-replace-form').addEventListener('submit', event => {
    event.preventDefault();
    saveMultipleReplaceDefinition();
  });
  $('#multiple-replace-form').addEventListener('input', event => {
    const target = event.target;
    clearMultipleReplaceHighlights();
    if (target.id === 'multiple-replace-name') {
      multipleReplaceDraft.name = target.value;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    const field = target.dataset.multipleReplaceField;
    const row = target.closest('.multiple-replace-rule');
    if (!field || !row || target.type !== 'text') return;
    const rule = multipleReplaceDraft.replacements.find(item => item.id === row.dataset.ruleId);
    if (!rule) return;
    rule[field] = target.value;
    multipleReplaceDraftDirty = true;
    $('#multiple-replace-status').textContent = '';
  });
  $('#multiple-replace-form').addEventListener('change', event => {
    const target = event.target;
    clearMultipleReplaceHighlights();
    if (target.id === 'multiple-replace-textual-case-insensitive') {
      multipleReplaceDraft.textualCaseInsensitive = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-textual-literal') {
      multipleReplaceDraft.textualLiteral = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-textual-anchored') {
      multipleReplaceDraft.textualAnchored = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-case-insensitive') {
      multipleReplaceDraft.regexCaseInsensitive = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-allow-comments-and-whitespace') {
      multipleReplaceDraft.regexAllowCommentsAndWhitespace = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-ignore-metacharacters') {
      multipleReplaceDraft.regexIgnoreMetacharacters = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-dot-matches-line-separators') {
      multipleReplaceDraft.regexDotMatchesLineSeparators = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-anchors-match-lines') {
      multipleReplaceDraft.regexAnchorsMatchLines = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-unix-line-separators') {
      multipleReplaceDraft.regexUnixLineSeparators = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-regex-unicode-word-boundaries') {
      multipleReplaceDraft.regexUseUnicodeWordBoundaries = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-matches-full-word') {
      multipleReplaceDraft.matchesFullWord = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-unescapes-replacement') {
      multipleReplaceDraft.unescapesReplacementString = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    if (target.id === 'multiple-replace-in-selection') {
      multipleReplaceDraftInSelection = target.checked;
      multipleReplaceDraftDirty = true;
      $('#multiple-replace-status').textContent = '';
      return;
    }
    const field = target.dataset.multipleReplaceField;
    const row = target.closest('.multiple-replace-rule');
    if (!field || !row || target.type !== 'checkbox') return;
    const rule = multipleReplaceDraft.replacements.find(item => item.id === row.dataset.ruleId);
    if (!rule) return;
    rule[field] = target.checked;
    multipleReplaceDraftDirty = true;
    $('#multiple-replace-status').textContent = '';
  });
  $('#multiple-replace-rules').addEventListener('click', event => {
    const button = event.target.closest('button[data-rule-action]');
    if (!button || !multipleReplaceDraft) return;
    const row = button.closest('.multiple-replace-rule');
    if (!row) return;
    if (button.dataset.ruleAction === 'delete') {
      clearMultipleReplaceHighlights();
      multipleReplaceDraft.replacements = multipleReplaceDraft.replacements.filter(rule => rule.id !== row.dataset.ruleId);
      multipleReplaceDraftDirty = true;
      renderMultipleReplaceRules();
      return;
    }
    moveMultipleReplaceRule(row.dataset.ruleId, button.dataset.ruleAction === 'up' ? -1 : 1);
  });
  $('#multiple-replace-highlight').addEventListener('click', highlightMultipleReplaceDefinition);
  $('#multiple-replace-apply').addEventListener('click', applyMultipleReplaceDefinition);
  $('#multiple-replace-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    closeMultipleReplaceManager();
  });
  $('#multiple-replace-dialog').addEventListener('close', restoreMultipleReplaceManagerFocus);
  $('#toolbar-customize-open').addEventListener('click', showToolbarCustomizationDialog);
  $('#toolbar-customization-close').addEventListener('click', () => $('#toolbar-customization-dialog').close());
  $('#toolbar-customization-cancel').addEventListener('click', () => $('#toolbar-customization-dialog').close());
  $('#toolbar-customization-reset').addEventListener('click', () => {
    if (!toolbarCustomizationDraft) return;
    toolbarCustomizationDraft = { order: [...DEFAULT_TOOLBAR_ITEM_ORDER], hidden: new Set() };
    renderToolbarCustomizationDialog();
    $('#toolbar-customization-status').textContent = '已恢复默认预览；点击“应用”后保存。';
  });
  $('#toolbar-customization-apply').addEventListener('click', applyToolbarCustomizationDialog);
  $('#toolbar-customization-list').addEventListener('change', event => {
    const checkbox = event.target instanceof HTMLInputElement && event.target.dataset.toolbarVisibility ? event.target : null;
    if (!checkbox || !toolbarCustomizationDraft) return;
    if (checkbox.checked) toolbarCustomizationDraft.hidden.delete(checkbox.dataset.toolbarVisibility);
    else toolbarCustomizationDraft.hidden.add(checkbox.dataset.toolbarVisibility);
    updateToolbarCustomizationStatus();
  });
  $('#toolbar-customization-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-toolbar-move]');
    if (!button || !toolbarCustomizationDraft) return;
    const index = toolbarCustomizationDraft.order.indexOf(button.dataset.toolbarId);
    const nextIndex = index + (button.dataset.toolbarMove === 'up' ? -1 : 1);
    if (index < 0 || nextIndex < 0 || nextIndex >= toolbarCustomizationDraft.order.length) return;
    [toolbarCustomizationDraft.order[index], toolbarCustomizationDraft.order[nextIndex]] = [toolbarCustomizationDraft.order[nextIndex], toolbarCustomizationDraft.order[index]];
    renderToolbarCustomizationDialog();
    [...$('#toolbar-customization-list').querySelectorAll('button[data-toolbar-move]')]
      .find(item => item.dataset.toolbarId === button.dataset.toolbarId && item.dataset.toolbarMove === button.dataset.toolbarMove)?.focus();
  });
  $('#toolbar-customization-dialog').addEventListener('close', () => {
    toolbarCustomizationDraft = null;
    const target = toolbarCustomizationReturnFocus;
    toolbarCustomizationReturnFocus = null;
    restoreDialogFocus($('#toolbar-customization-dialog'), target);
  });
  $('#recovery-close').addEventListener('click', () => $('#recovery-dialog').close());
  $('#recovery-later').addEventListener('click', () => $('#recovery-dialog').close());
  $('#recovery-dialog').addEventListener('close', () => {
    const target = recoveryReturnFocus;
    recoveryReturnFocus = null;
    restoreDialogFocus($('#recovery-dialog'), target);
  });
  $('#recovery-list').addEventListener('change', () => {
    const selected = selectedRecoveryDraftIds().length > 0;
    $('#recovery-restore-selected').disabled = !selected;
    $('#recovery-delete-selected').disabled = !selected;
  });
  $('#recovery-restore-selected').addEventListener('click', () => { void restoreRecoveryDrafts(selectedRecoveryDraftIds()); });
  $('#recovery-restore-all').addEventListener('click', () => { void restoreRecoveryDrafts(); });
  $('#recovery-delete-selected').addEventListener('click', () => { void deleteSelectedRecoveryDrafts(); });
  $('#recovery-clear-all').addEventListener('click', () => { void clearRecoveryDrafts(); });
  $('#settings-toggle').addEventListener('click', () => {
    setSettingsPopover();
  });
  $('#remote-editing-open').addEventListener('click', () => { void showRemoteEditingDialog(); });
  $('#remote-editing-close').addEventListener('click', () => $('#remote-editing-dialog').close());
  $('#remote-editing-cancel').addEventListener('click', () => $('#remote-editing-dialog').close());
  $('#remote-editing-form').addEventListener('submit', applyRemoteEditingSettings);
  $('#remote-editing-dialog').addEventListener('close', () => {
    const target = remoteEditingReturnFocus;
    remoteEditingReturnFocus = null;
    restoreDialogFocus($('#remote-editing-dialog'), target);
  });
  $('#donation-close').addEventListener('click', () => $('#donation-dialog').close());
  $('#donation-cancel').addEventListener('click', () => $('#donation-dialog').close());
  $('#donation-appstore').addEventListener('click', () => openDonationLink('https://apps.apple.com/app/id1024640650'));
  $('#donation-sponsors').addEventListener('click', () => openDonationLink('https://github.com/sponsors/1024jp/'));
  $('#donation-dialog').addEventListener('close', () => {
    const target = donationReturnFocus;
    donationReturnFocus = null;
    restoreDialogFocus($('#donation-dialog'), target);
  });
  $('#font-down').addEventListener('click', () => changeFontSize(-1));
  $('#font-up').addEventListener('click', () => changeFontSize(1));
  $('#indent-select').addEventListener('change', event => {
    if (event.target.value === 'custom') { showCustomWidthDialog('indent'); syncIndentControls(); }
    else setIndent(event.target.value);
  });
  $('#custom-width-close').addEventListener('click', () => $('#custom-width-dialog').close());
  $('#custom-width-cancel').addEventListener('click', () => $('#custom-width-dialog').close());
  $('#custom-width-dialog').addEventListener('close', closeCustomWidthDialog);
  $('#custom-width-dialog').addEventListener('cancel', event => { event.preventDefault(); $('#custom-width-dialog').close(); });
  $('#custom-width-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = Number($('#custom-width-value').value);
    if (!Number.isInteger(value) || value < 1 || value > 99) {
      $('#custom-width-status').textContent = '请输入 1–99 的整数。';
      $('#custom-width-value').focus();
      return;
    }
    const applied = customWidthMode === 'tab' ? setTabWidth(value) : setIndent(String(value));
    if (applied) $('#custom-width-dialog').close();
  });
  $('#theme-select').addEventListener('change', event => setTheme(event.target.value));
  $('#builtin-theme-select').addEventListener('change', event => {
    const value = event.target.value;
    const isCustom = value.startsWith('custom:');
    const name = isCustom ? value.slice('custom:'.length) : value.slice('builtin:'.length);
    const applied = isCustom ? applyCustomEditorTheme(name) : applyBuiltinEditorTheme(name);
    if (!applied) { showToast('无法应用所选主题。'); applySettings(); return; }
    applySettings();
    showToast(`已应用编辑器主题：${name}`);
  });
  $('#window-width-setting').addEventListener('change', event => {
    if (event.target.value.trim() === '') {
      settings.windowWidth = null;
      persistSettings();
      applySettings();
      void syncDefaultWindowSize();
      return;
    }
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value)) { applySettings(); return; }
    settings.windowWidth = Math.max(860, Math.min(4000, Math.round(value)));
    event.target.value = String(settings.windowWidth);
    persistSettings();
    applySettings();
    void syncDefaultWindowSize();
  });
  $('#window-height-setting').addEventListener('change', event => {
    if (event.target.value.trim() === '') {
      settings.windowHeight = null;
      persistSettings();
      applySettings();
      void syncDefaultWindowSize();
      return;
    }
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value)) { applySettings(); return; }
    settings.windowHeight = Math.max(600, Math.min(4000, Math.round(value)));
    event.target.value = String(settings.windowHeight);
    persistSettings();
    applySettings();
    void syncDefaultWindowSize();
  });
  $('#default-syntax-setting').addEventListener('change', event => {
    const syntax = normalizeDefaultSyntaxId(event.target.value);
    if (!syntaxMenuOptions().some(option => option.id.toLowerCase() === syntax)) {
      populateDefaultSyntaxOptions();
      return;
    }
    settings.defaultSyntax = syntax;
    persistSettings();
  });
  $('#ligatures-setting').addEventListener('change', event => { settings.ligatures = event.target.checked; persistSettings(); applySettings(); });
  $('#line-height-setting').addEventListener('change', event => {
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value)) { applySettings(); return; }
    settings.lineHeight = normalizeLineHeight(value);
    event.target.value = settings.lineHeight.toFixed(1);
    persistSettings();
    applySettings();
  });
  $('#wrap-setting').addEventListener('change', event => { settings.wrap = event.target.checked; persistSettings(); applySettings(); });
  $('#overscroll-rate-setting').addEventListener('change', event => {
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value)) { event.target.value = String(Math.round(settings.overscrollRate * 100)); return; }
    settings.overscrollRate = Math.round(Math.max(0, Math.min(100, value)) / 10) / 10;
    event.target.value = String(Math.round(settings.overscrollRate * 100));
    persistSettings();
    applySettings();
  });
  $('#hanging-indent-setting').addEventListener('change', event => {
    settings.enablesHangingIndent = event.target.checked;
    $('#hanging-indent-width').disabled = !settings.enablesHangingIndent;
    persistSettings();
    applySettings();
  });
  $('#hanging-indent-width').addEventListener('change', event => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) { event.target.value = String(settings.hangingIndentWidth); return; }
    settings.hangingIndentWidth = Math.max(0, Math.min(99, Math.round(value)));
    event.target.value = String(settings.hangingIndentWidth);
    persistSettings();
    applySettings();
  });
  $('#auto-indent-setting').addEventListener('change', event => { settings.autoIndent = event.target.checked; persistSettings(); applySettings(); });
  $('#suggest-completions-setting').addEventListener('change', event => { settings.suggestCompletionsWhileTyping = event.target.checked; persistSettings(); applySettings(); });
  $('#suggest-completions-language-setting').addEventListener('change', event => {
    const language = activeDoc?.language;
    if (!language) { syncAutoCompletionControls(); return; }
    const value = event.target.value === 'on' ? true : event.target.value === 'off' ? false : null;
    settings.suggestCompletionsByLanguage = setAutoCompletionOverride(settings.suggestCompletionsByLanguage, language, value);
    persistSettings();
    applySettings();
  });
  $('#spell-check-language-setting').addEventListener('change', event => {
    const language = activeDoc?.language;
    if (!language) { syncSpellCheckingControls(); return; }
    const value = event.target.value === 'on' ? true : event.target.value === 'off' ? false : null;
    settings.continuousSpellCheckingByLanguage = setContinuousSpellCheckingOverride(settings.continuousSpellCheckingByLanguage, language, value);
    persistSettings();
    applySettings();
  });
  for (const [option, descriptor] of Object.entries(SUBSTITUTION_MODE_OPTIONS)) {
    $(`#${descriptor.controlId}`).addEventListener('change', event => {
      const language = activeDoc?.language;
      if (!language) { syncSubstitutionControls(); return; }
      const value = event.target.value === 'on' ? true : event.target.value === 'off' ? false : null;
      setSubstitutionModeOverride(option, language, value);
      persistSettings();
      applySettings();
    });
  }
  $('#symbol-balancing-language-setting').addEventListener('change', event => {
    const language = activeDoc?.language;
    if (!language) { syncSymbolBalancingControls(); return; }
    const value = event.target.value === 'on' ? true : event.target.value === 'off' ? false : null;
    settings.automaticSymbolBalancingByLanguage = setAutomaticSymbolBalancingOverride(settings.automaticSymbolBalancingByLanguage, language, value);
    persistSettings();
    applySettings();
  });
  for (const [controlId, source] of [['completion-document-setting', 'document'], ['completion-syntax-setting', 'syntax']]) {
    $(`#${controlId}`).addEventListener('change', event => {
      const language = activeDoc?.language;
      if (!language) { syncCompletionWordTypeControls(); return; }
      const current = completionWordTypesForDocument(activeDoc);
      current[source] = event.target.checked;
      settings.completionWordTypesByLanguage = setCompletionWordTypesOverride(settings.completionWordTypesByLanguage, language, current);
      persistSettings();
      applySettings();
    });
  }
  $('#completion-sources-reset').addEventListener('click', () => {
    const language = activeDoc?.language;
    if (!language) return;
    settings.completionWordTypesByLanguage = setCompletionWordTypesOverride(settings.completionWordTypesByLanguage, language, null);
    persistSettings();
    applySettings();
  });
  $('#detect-indent-style-setting').addEventListener('change', event => { settings.detectsIndentStyle = event.target.checked; persistSettings(); applySettings(); });
  $('#indent-with-tab-setting').addEventListener('change', event => { settings.indentWithTabKey = event.target.checked; persistSettings(); applySettings(); });
  $('#comment-spacer-setting').addEventListener('change', event => { settings.appendsCommentSpacer = event.target.checked; persistSettings(); });
  $('#auto-trim-whitespace-setting').addEventListener('change', event => {
    settings.autoTrimsTrailingWhitespace = event.target.checked;
    $('#trim-whitespace-only-lines-setting').disabled = !settings.autoTrimsTrailingWhitespace;
    persistSettings();
  });
  $('#trim-whitespace-only-lines-setting').addEventListener('change', event => {
    settings.trimsWhitespaceOnlyLines = event.target.checked;
    persistSettings();
  });
  $('#vertical-text-setting').addEventListener('change', event => { settings.verticalText = event.target.checked; persistSettings(); applySettings(); });
  $('#writing-direction-setting').addEventListener('change', event => { settings.writingDirection = event.target.value === 'rtl' ? 'rtl' : 'ltr'; persistSettings(); });
  $('#line-setting').addEventListener('change', event => { settings.showLineNumbers = event.target.checked; persistSettings(); applySettings(); });
  $('#highlight-current-line-setting').addEventListener('change', event => { settings.highlightCurrentLine = event.target.checked; persistSettings(); applySettings(); });
  $('#highlight-braces-setting').addEventListener('change', event => { settings.highlightBraces = event.target.checked; persistSettings(); applySettings(); });
  $('#selected-text-matches-setting').addEventListener('change', event => { settings.highlightSelectionInstances = event.target.checked; persistSettings(); applySettings(); });
  $('#selected-text-match-delay-setting').addEventListener('change', event => {
    if (!Number.isFinite(event.target.valueAsNumber)) { event.target.value = String(settings.selectionInstanceHighlightDelay); return; }
    settings.selectionInstanceHighlightDelay = event.target.valueAsNumber;
    persistSettings();
    applySettings();
  });
  $('#link-urls-setting').addEventListener('change', event => { settings.autoLinkDetection = event.target.checked; persistSettings(); applySettings(); });
  $('#invisibles-setting').addEventListener('change', event => { settings.showInvisibles = event.target.checked; persistSettings(); applySettings(); });
  for (const [controlId, settingKey] of [
    ['invisible-newline-setting', 'showInvisibleNewLine'],
    ['invisible-tab-setting', 'showInvisibleTab'],
    ['invisible-space-setting', 'showInvisibleSpace'],
    ['invisible-whitespace-setting', 'showInvisibleWhitespaces'],
    ['invisible-control-setting', 'showInvisibleControl']
  ]) {
    $(`#${controlId}`).addEventListener('change', event => { settings[settingKey] = event.target.checked; persistSettings(); applySettings(); });
  }
  $('#indent-guides-setting').addEventListener('change', event => { settings.showIndentGuides = event.target.checked; persistSettings(); applySettings(); });
  $('#page-guide-setting').addEventListener('change', event => { settings.showPageGuide = event.target.checked; persistSettings(); applySettings(); });
  $('#page-guide-column').addEventListener('change', event => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) { event.target.value = String(settings.pageGuideColumn); return; }
    settings.pageGuideColumn = Math.max(1, Math.min(999, Math.round(value)));
    event.target.value = String(settings.pageGuideColumn);
    persistSettings();
    applySettings();
  });
  $('#sidebar-setting').addEventListener('change', event => { settings.showSidebar = event.target.checked; persistSettings(); applySettings(); });
  $('#status-bar-setting').addEventListener('change', event => { settings.showStatusBar = event.target.checked; persistSettings(); applySettings(); });
  $('#status-bar-opaque-setting').addEventListener('change', event => { settings.statusBarOpaqueBackground = event.target.checked; persistSettings(); applySettings(); });
  $('#tabbar-setting').addEventListener('change', event => { settings.showTabBar = event.target.checked; persistSettings(); applySettings(); });
  $('#toolbar-setting').addEventListener('change', event => { settings.showToolbar = event.target.checked; persistSettings(); applySettings(); });
  $('#navigation-bar-setting').addEventListener('change', event => { settings.showNavigationBar = event.target.checked; persistSettings(); applySettings(); });
  $('#outline-navigation-select').addEventListener('change', event => {
    const index = Number(event.target.value);
    const item = Number.isInteger(index) ? renderOutlineNavigation()[index] : null;
    if (item) jumpToLine(item.line);
  });
  $('#outline-previous').addEventListener('click', selectPreviousOutlineItem);
  $('#outline-next').addEventListener('click', selectNextOutlineItem);
  $('#split-orientation-setting').addEventListener('change', event => { settings.splitEditorsVertically = event.target.checked; persistSettings(); applySettings(); });
  $('#import-cot-theme').addEventListener('click', importCotEditorTheme);
  $('#clear-cot-theme').addEventListener('click', clearCotEditorTheme);
  $('#custom-theme-rename').addEventListener('click', renameActiveCustomEditorTheme);
  $('#custom-theme-delete').addEventListener('click', deleteActiveCustomEditorTheme);
  $('#custom-theme-colors').addEventListener('change', handleCustomThemeColorChange);
  $('#open-script-folder').addEventListener('click', async () => {
    if (!window.cotedit?.isDesktop) { showToast('脚本文件夹仅在桌面版可用'); return; }
    try { await window.cotedit.openScriptsFolder(); await refreshScriptStatus(); }
    catch (error) { showToast(`无法打开脚本文件夹：${error.message || '请重试'}`); }
  });
  $('#search-close').addEventListener('click', closeSearchPanel);
  $('#search-query').addEventListener('input', () => applySearch(false));
  $('#search-query').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); applySearch(true, event.shiftKey); } if (event.key === 'Escape') closeSearchPanel(); });
  $('#find-next').addEventListener('click', () => applySearch(true));
  $('#find-prev').addEventListener('click', () => applySearch(true, true));
  $('#match-case').addEventListener('click', event => { searchOptions.caseSensitive = !searchOptions.caseSensitive; event.currentTarget.classList.toggle('selected', searchOptions.caseSensitive); event.currentTarget.setAttribute('aria-pressed', String(searchOptions.caseSensitive)); applySearch(false); });
  $('#match-regex').addEventListener('click', event => { searchOptions.regexp = !searchOptions.regexp; event.currentTarget.classList.toggle('selected', searchOptions.regexp); event.currentTarget.setAttribute('aria-pressed', String(searchOptions.regexp)); syncDiacriticSearchButton(); applySearch(false); });
  $('#match-whole-word').addEventListener('click', event => { searchOptions.wholeWord = !searchOptions.wholeWord; event.currentTarget.classList.toggle('selected', searchOptions.wholeWord); event.currentTarget.setAttribute('aria-pressed', String(searchOptions.wholeWord)); applySearch(false); });
  $('#match-diacritics').addEventListener('click', event => {
    searchOptions.diacriticInsensitive = !searchOptions.diacriticInsensitive;
    settings.findIgnoresDiacritics = searchOptions.diacriticInsensitive;
    persistSettings();
    syncDiacriticSearchButton();
    applySearch(false);
  });
  syncDiacriticSearchButton();
  $('#replace-one').addEventListener('click', () => replaceSearchMatch(false));
  $('#replace-all').addEventListener('click', () => replaceSearchMatch(true));
  $('#shortcuts-close').addEventListener('click', () => $('#shortcuts-dialog').close());
  $('#shortcuts-dialog').addEventListener('close', () => {
    endShortcutCapture('快捷键录入已取消。');
    const target = shortcutsReturnFocus;
    shortcutsReturnFocus = null;
    if (target?.isConnected) target.focus();
    else $('#shortcuts-toggle').focus();
  });
  $('#help-close').addEventListener('click', () => $('#help-dialog').close());
  $('#help-open-shortcuts').addEventListener('click', () => {
    const target = helpReturnFocus;
    helpOpeningShortcuts = true;
    $('#help-dialog').close();
    showShortcuts();
    shortcutsReturnFocus = target;
  });
  $('#help-dialog').addEventListener('close', () => {
    if (helpOpeningShortcuts) { helpOpeningShortcuts = false; helpReturnFocus = null; return; }
    const target = helpReturnFocus;
    helpReturnFocus = null;
    if (target?.isConnected) target.focus();
    else activeEditor()?.focus();
  });
  $('#document-inspector-close').addEventListener('click', () => closePanel('document-inspector-panel', true));
  $('#document-inspector-reveal').addEventListener('click', () => { void revealActiveFile(); });
  $('#shortcuts-query').addEventListener('input', event => renderShortcuts(event.target.value));
  $('#shortcuts-list').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.shortcutId) { void beginShortcutCapture(button.dataset.shortcutId); return; }
    const id = button?.dataset.shortcutResetId;
    if (!id || !settings.keyBindings[id]) return;
    if (recordingShortcutId) endShortcutCapture('快捷键录入已取消。');
    const bindings = { ...settings.keyBindings };
    delete bindings[id];
    settings.keyBindings = bindings;
    persistSettings();
    renderShortcuts($('#shortcuts-query').value);
    $('#shortcut-capture-status').textContent = '已恢复该命令的默认快捷键。';
  });
  $('#shortcuts-reset-all').addEventListener('click', () => {
    if (recordingShortcutId) endShortcutCapture('快捷键录入已取消。');
    settings.keyBindings = {};
    persistSettings();
    renderShortcuts($('#shortcuts-query').value);
    $('#shortcut-capture-status').textContent = '所有快捷键已恢复默认。';
  });
  $('#font-family-open').addEventListener('click', showFontPicker);
  $('#font-type-language-setting').addEventListener('change', event => {
    const language = activeDoc?.language;
    if (!language) { syncFontTypeControl(); return; }
    settings.fontTypeByLanguage = setFontTypeOverride(settings.fontTypeByLanguage, language, event.target.value);
    persistSettings();
    applySettings();
  });
  $('#font-family-input').addEventListener('input', syncFontFamilyPreview);
  $('#font-family-reset').addEventListener('click', () => { $('#font-family-input').value = ''; syncFontFamilyPreview(); });
  $('#font-picker-apply').addEventListener('click', applyFontFamily);
  $('#font-picker-cancel').addEventListener('click', () => $('#font-picker-dialog').close());
  $('#font-picker-dialog').addEventListener('close', () => {
    const target = fontPickerReturnFocus;
    fontPickerReturnFocus = null;
    restoreDialogFocus($('#font-picker-dialog'), target);
  });
  $('#page-setup-close').addEventListener('click', () => $('#page-setup-dialog').close());
  $('#page-setup-cancel').addEventListener('click', () => $('#page-setup-dialog').close());
  $('#page-setup-form').addEventListener('submit', applyPageSetup);
  $('#goto-line-cancel').addEventListener('click', () => $('#goto-line-dialog').close());
  $('#unicode-codepoint-cancel').addEventListener('click', () => $('#unicode-codepoint-dialog').close());
  $('#unicode-codepoint-input').addEventListener('input', updateUnicodeCodePointPreview);
  $('#unicode-codepoint-form').addEventListener('submit', insertUnicodeCodePoint);
  $('#unicode-codepoint-dialog').addEventListener('close', () => activeEditor()?.focus());
  $('#goto-line-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#goto-line-number');
    const value = Number(input.value);
    const max = activeEditor()?.state.doc.lines || 0;
    if (!Number.isInteger(value) || value < 1 || value > max) {
      $('#goto-line-error').textContent = `请输入 1 到 ${max} 之间的行号。`;
      input.focus();
      return;
    }
    $('#goto-line-dialog').close();
    jumpToLine(value);
  });
  $('#custom-surround-cancel').addEventListener('click', () => $('#custom-surround-dialog').close());
  $('#custom-surround-dialog').addEventListener('close', () => activeEditor()?.focus());
  $('#custom-surround-begin').addEventListener('input', event => {
    event.currentTarget.setCustomValidity('');
    $('#custom-surround-end').placeholder = event.currentTarget.value;
  });
  $('#custom-surround-form').addEventListener('submit', event => {
    event.preventDefault();
    const begin = $('#custom-surround-begin').value;
    if (!begin) {
      $('#custom-surround-begin').setCustomValidity('开始字符串不能为空。');
      $('#custom-surround-begin').reportValidity();
      return;
    }
    const rawEnd = $('#custom-surround-end').value;
    try { localStorage.setItem('cotedit.customSurroundPair', JSON.stringify({ begin, end: rawEnd })); } catch {}
    $('#custom-surround-dialog').close();
    surroundSelection(begin, rawEnd || begin);
  });
  $('#pattern-sort-cancel').addEventListener('click', () => $('#pattern-sort-dialog').close());
  $('#pattern-sort-close').addEventListener('click', () => $('#pattern-sort-dialog').close());
  $('#pattern-sort-dialog').addEventListener('close', () => activeEditor()?.focus());
  $('#pattern-sort-form').querySelectorAll('input, select').forEach(control => {
    control.addEventListener('input', updatePatternSortDialog);
    control.addEventListener('change', updatePatternSortDialog);
  });
  $('#pattern-sort-form').addEventListener('submit', event => {
    event.preventDefault();
    const draft = patternSortDraft();
    if (draft.error) { updatePatternSortDialog(); return; }
    const saved = {
      key: $('#pattern-sort-key').value,
      delimiter: $('#pattern-sort-delimiter').value,
      column: $('#pattern-sort-column').value,
      regexp: $('#pattern-sort-regexp').value,
      captureIndex: $('#pattern-sort-capture-index').value,
      regexpIgnoreCase: $('#pattern-sort-regexp-ignore-case').checked,
      useCapture: $('#pattern-sort-use-capture').checked,
      ignoreCase: $('#pattern-sort-ignore-case').checked,
      localized: $('#pattern-sort-localized').checked,
      numeric: $('#pattern-sort-numeric').checked,
      keepFirstLine: $('#pattern-sort-keep-first').checked,
      descending: $('#pattern-sort-descending').checked
    };
    try { localStorage.setItem('cotedit.pattern-sort.v1', JSON.stringify(saved)); } catch {}
    $('#pattern-sort-dialog').close();
    sortSelectedLines(draft.options);
  });
  document.addEventListener('keydown', async event => {
    if (isShortcutCompositionEvent(event)) return;
    if (recordingShortcutId) { await captureShortcutKey(event); return; }
    if (recordingSnippetShortcut) { await captureSnippetShortcut(event); return; }
    if (event.key === 'Escape') {
      const activeElement = document.activeElement;
      if (searchPanelVisible() && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        closeSearchPanel();
      }
      setSettingsPopover(false, $('#settings-popover').contains(activeElement));
      Object.keys(PANEL_TRIGGER_IDS).forEach(id => closePanel(id, $(`#${id}`).contains(activeElement)));
      setOverflowMenu(false);
      const view = activeEditor();
      if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
        && !event.defaultPrevented
        && !document.querySelector('dialog[open]')
        && view?.hasFocus && view.dom.contains(event.target)
        && collapseMultipleInsertionPoints(view)) {
        event.preventDefault();
        return;
      }
    }
    const platform = window.cotedit?.platform || navigator.platform;
    const view = activeEditor();
    const snippetWithShortcut = view?.hasFocus && !document.querySelector('dialog[open]')
      ? settings.snippets.find(snippet => snippet.shortcut && matchesShortcut(event, snippet.shortcut, platform))
      : null;
    if (snippetWithShortcut) {
      event.preventDefault();
      insertSnippetById(snippetWithShortcut.id);
      return;
    }
    const selection = view?.state.selection.main;
    const shortcut = resolveShortcut(event, applyShortcutOverrides(SHORTCUTS, settings.keyBindings), platform, {
      editorFocused: Boolean(view?.hasFocus),
      hasSelection: Boolean(selection && !selection.empty)
    });
    if (shortcut?.id === 'copyAsRichText' && !view?.hasFocus) return;
    if (['goToLine', 'surroundCustom'].includes(shortcut?.id) && document.querySelector('dialog[open]')) return;
    if (shortcut?.id === 'insertBackslash' && !view?.hasFocus) return;
    if (window.cotedit?.isDesktop) {
      if (shortcut && (settings.keyBindings[shortcut.id] || ['fontUp', 'fontDown', 'fontReset', 'goToLine', 'surroundCustom', 'focusNextEditor', 'focusPreviousEditor', 'toggleInspector', 'inspectCharacter', 'quickActions', 'insertBackslash'].includes(shortcut.id))) {
        event.preventDefault();
        await runShortcut(shortcut.id);
      }
      return;
    }
    if (!shortcut) return;
    const editorOnly = ['undo', 'redo', 'selectLine', 'copyAsRichText', 'toggleComment', 'insertYenMark', 'insertBackslash', 'duplicateLine', 'deleteLine', 'moveLineUp', 'moveLineDown', 'joinCurrentLines', 'splitSelectionLines', 'selectColumnUp', 'selectColumnDown', 'indentLess', 'indentMore', 'complete'];
    const targetIsControl = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]:not(.cm-content)');
    if (editorOnly.includes(shortcut.id) && (!activeEditor()?.hasFocus || targetIsControl)) return;
    if (targetIsControl && !['new', 'newTab', 'newWindow', 'open', 'save', 'saveAs', 'saveAll', 'close', 'print', 'pageSetup', 'settings', 'quickActions', 'find', 'findNext', 'findPrevious', 'searchFolder', 'goToLine', 'useSelectionForFind', 'useSelectionForReplace', 'replaceAndFindNext', 'fontUp', 'fontDown', 'fontReset', 'focusNextEditor', 'focusPreviousEditor', 'toggleInspector'].includes(shortcut.id)) return;
    event.preventDefault();
    await runShortcut(shortcut.id);
  });
  window.cotedit?.onMenu((channel, value) => handleMenu(channel, value));
  window.cotedit?.onWindowSizeChanged?.(scheduleRememberWindowSize);
  window.cotedit?.onOpenExternalDocument(filePath => { void openExternalDocument(filePath); });
  window.cotedit?.onRecoveryChanged(() => { void refreshRecoveryDrafts(); });
  window.cotedit?.onRemoteDocument(item => openRemoteDocument(item));
  window.cotedit?.onRemoteStatus(status => renderRemoteEditingStatus(status));
  window.cotedit?.onRemoteDisconnect(file => handleRemoteDisconnect(file));
  window.cotedit?.onRemoteError(error => showToast(`远程文稿无法打开：${error?.message || '请检查文件'}`));
  if (window.cotedit?.getRemoteEditingSettings) {
    void window.cotedit.getRemoteEditingSettings().then(renderRemoteEditingStatus).catch(() => {});
  }
  refreshScriptStatus();
  window.addEventListener('beforeunload', event => {
    flushRememberedWindowSize();
    void persistSession({ immediate: true });
    if (documents.some(isDirty)) { event.preventDefault(); event.returnValue = ''; }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (settings.theme === 'system') applySettings(); });
}

populateLanguageMenu();
updateCustomSyntaxMenu();
registerEvents();
void createEditor().then(async () => {
  await syncDefaultWindowSize();
  await window.cotedit?.showWindowWhenReady?.();
}).catch(error => {
  showToast(`CotEdit 启动失败：${error.message || '请重试'}`);
  void window.cotedit?.showWindowWhenReady?.();
});
