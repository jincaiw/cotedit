import JSON5 from 'json5';
import {
  MAX_MULTIPLE_REPLACE_RULES,
  MAX_MULTIPLE_REPLACE_TEXT_BYTES,
  COTEDITOR_TEXTUAL_CASE_INSENSITIVE_OPTION,
  COTEDITOR_TEXTUAL_LITERAL_OPTION,
  COTEDITOR_TEXTUAL_ANCHORED_OPTION,
  COTEDITOR_REGEX_CASE_INSENSITIVE_OPTION,
  COTEDITOR_REGEX_ALLOW_COMMENTS_AND_WHITESPACE_OPTION,
  COTEDITOR_REGEX_IGNORE_METACHARACTERS_OPTION,
  COTEDITOR_REGEX_DOT_MATCHES_LINE_SEPARATORS_OPTION,
  COTEDITOR_REGEX_ANCHORS_MATCH_LINES_OPTION,
  COTEDITOR_REGEX_UNIX_LINE_SEPARATORS_OPTION,
  COTEDITOR_REGEX_UNICODE_WORD_BOUNDARIES_OPTION,
  normalizeMultipleReplaceDefinitions
} from './multiple-replace.js';

export const MAX_MULTIPLE_REPLACE_IMPORT_BYTES = 64 * 1024;

const encoder = new TextEncoder();
const JSON_EXTENSIONS = new Set(['.cotrpl', '.json', '.json5']);

function optionIsSet(mask, option) {
  return Math.floor(mask / option) % 2 === 1;
}

function hasUnsupportedOptions(mask, supportedOptions) {
  let remaining = mask;
  for (const option of supportedOptions) {
    if (optionIsSet(remaining, option)) remaining -= option;
  }
  return remaining !== 0;
}

function extensionOf(fileName) {
  const baseName = String(fileName || '').split(/[\\/]/).at(-1) || '';
  const dot = baseName.lastIndexOf('.');
  return dot >= 0 ? baseName.slice(dot).toLowerCase() : '';
}

function nameOf(fileName) {
  const baseName = String(fileName || '').split(/[\\/]/).at(-1) || '';
  const extension = extensionOf(baseName);
  const name = (extension ? baseName.slice(0, -extension.length) : baseName).trim();
  if (!name) throw new Error('文件名不能为空。');
  if (name.length > 80) throw new Error('定义名称不能超过 80 个字符。');
  return name;
}

function normalizeImportedDefinition(replacements, name, settings = {}) {
  if (!Array.isArray(replacements) || replacements.length === 0) {
    throw new Error('文件中没有替换规则。');
  }
  if (replacements.length > MAX_MULTIPLE_REPLACE_RULES) {
    throw new Error(`规则超过 ${MAX_MULTIPLE_REPLACE_RULES} 条上限。`);
  }

  const rules = replacements.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)
        || typeof rule.findString !== 'string' || typeof rule.replacementString !== 'string') {
      throw new Error(`第 ${index + 1} 条规则缺少字符串类型的查找或替换字段。`);
    }
    if (encoder.encode(rule.findString).byteLength > MAX_MULTIPLE_REPLACE_TEXT_BYTES
        || encoder.encode(rule.replacementString).byteLength > MAX_MULTIPLE_REPLACE_TEXT_BYTES) {
      throw new Error(`第 ${index + 1} 条规则的文本超过单字段大小限制。`);
    }
    return {
      id: `rule-${index + 1}`,
      isEnabled: rule.isEnabled !== false,
      findString: rule.findString,
      replacementString: rule.replacementString,
      usesRegularExpression: rule.usesRegularExpression === true,
      ignoresCase: rule.ignoresCase === true,
      ...(typeof rule.description === 'string' && rule.description.trim()
        ? { description: rule.description.trim().slice(0, 120) }
        : {})
    };
  });
  if (!rules.some(rule => rule.findString.trim())) {
    throw new Error('至少需要一条查找文本非空的规则。');
  }

  const [definition] = normalizeMultipleReplaceDefinitions([{
    id: 'coteditor-import',
    name,
    matchesFullWord: settings.matchesFullWord === true,
    textualCaseInsensitive: optionIsSet(settings.textualOptions ?? 0, COTEDITOR_TEXTUAL_CASE_INSENSITIVE_OPTION),
    textualLiteral: optionIsSet(settings.textualOptions ?? 0, COTEDITOR_TEXTUAL_LITERAL_OPTION),
    textualAnchored: optionIsSet(settings.textualOptions ?? 0, COTEDITOR_TEXTUAL_ANCHORED_OPTION),
    regexCaseInsensitive: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_CASE_INSENSITIVE_OPTION),
    regexAllowCommentsAndWhitespace: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_ALLOW_COMMENTS_AND_WHITESPACE_OPTION),
    regexIgnoreMetacharacters: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_IGNORE_METACHARACTERS_OPTION),
    regexDotMatchesLineSeparators: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_DOT_MATCHES_LINE_SEPARATORS_OPTION),
    regexAnchorsMatchLines: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_ANCHORS_MATCH_LINES_OPTION),
    regexUnixLineSeparators: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_UNIX_LINE_SEPARATORS_OPTION),
    regexUseUnicodeWordBoundaries: optionIsSet(settings.regexOptions ?? 0, COTEDITOR_REGEX_UNICODE_WORD_BOUNDARIES_OPTION),
    unescapesReplacementString: settings.unescapesReplacementString === true,
    replacements: rules
  }]);
  if (!definition || definition.replacements.length !== rules.length) {
    throw new Error('定义超过 CotEdit 的 48 KiB 容量限制。');
  }
  return {
    definition,
    ignoredSettings: Object.entries(settings).some(([key, value]) => {
      if (['matchesFullWord', 'unescapesReplacementString'].includes(key)) return false;
      if (key === 'textualOptions' && !hasUnsupportedOptions(value, [
        COTEDITOR_TEXTUAL_CASE_INSENSITIVE_OPTION,
        COTEDITOR_TEXTUAL_LITERAL_OPTION,
        COTEDITOR_TEXTUAL_ANCHORED_OPTION
      ])) return false;
      if (key === 'regexOptions' && !hasUnsupportedOptions(value, [
        COTEDITOR_REGEX_CASE_INSENSITIVE_OPTION,
        COTEDITOR_REGEX_ALLOW_COMMENTS_AND_WHITESPACE_OPTION,
        COTEDITOR_REGEX_IGNORE_METACHARACTERS_OPTION,
        COTEDITOR_REGEX_DOT_MATCHES_LINE_SEPARATORS_OPTION,
        COTEDITOR_REGEX_ANCHORS_MATCH_LINES_OPTION,
        COTEDITOR_REGEX_UNIX_LINE_SEPARATORS_OPTION,
        COTEDITOR_REGEX_UNICODE_WORD_BOUNDARIES_OPTION
      ])) return false;
      return true;
    })
  };
}

function parseTsv(source, name) {
  const replacements = [];
  const lines = source.split(/\r\n|\r|\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line) continue;
    const columns = line.split('\t');
    if (columns.length !== 2 || !columns[0]) {
      throw new Error(`TSV 第 ${index + 1} 行必须恰好两列，且查找列不能为空。`);
    }
    replacements.push({ findString: columns[0], replacementString: columns[1] });
  }
  return normalizeImportedDefinition(replacements, name);
}

/** Parse one CotEditor replacement-definition (.cotrpl) or TSV file. */
export function parseCotEditorReplacementImport(source, fileName) {
  if (typeof source !== 'string') throw new Error('导入内容必须是文本。');
  if (encoder.encode(source).byteLength > MAX_MULTIPLE_REPLACE_IMPORT_BYTES) {
    throw new Error(`导入文件超过 ${MAX_MULTIPLE_REPLACE_IMPORT_BYTES / 1024} KiB 限制。`);
  }

  const extension = extensionOf(fileName);
  const name = nameOf(fileName);
  if (extension === '.tsv') return parseTsv(source, name);
  if (!JSON_EXTENSIONS.has(extension)) {
    throw new Error('仅支持 CotEditor .cotrpl/JSON5 或 TSV 替换定义。');
  }

  let payload;
  try {
    payload = JSON5.parse(source);
  } catch {
    throw new Error('替换定义不是有效的 JSON5。');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('JSON5 顶层必须是替换定义对象。');
  }
  if (payload.settings != null && (typeof payload.settings !== 'object' || Array.isArray(payload.settings))) {
    throw new Error('替换定义的 settings 字段格式无效。');
  }
  if (payload.settings?.matchesFullWord != null && typeof payload.settings.matchesFullWord !== 'boolean') {
    throw new Error('替换定义的 matchesFullWord 必须是布尔值。');
  }
  if (payload.settings?.unescapesReplacementString != null && typeof payload.settings.unescapesReplacementString !== 'boolean') {
    throw new Error('替换定义的 unescapesReplacementString 必须是布尔值。');
  }
  if (payload.settings?.textualOptions != null
      && (!Number.isSafeInteger(payload.settings.textualOptions) || payload.settings.textualOptions < 0)) {
    throw new Error('替换定义的 textualOptions 必须是非负安全整数。');
  }
  if (payload.settings?.regexOptions != null
      && (!Number.isSafeInteger(payload.settings.regexOptions) || payload.settings.regexOptions < 0)) {
    throw new Error('替换定义的 regexOptions 必须是非负安全整数。');
  }
  return normalizeImportedDefinition(payload.replacements, name, payload.settings || {});
}
