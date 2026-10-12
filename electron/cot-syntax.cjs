const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_RULES = 2500;
const MAX_ARRAY_ITEMS = 256;
const MAX_TOKEN_LENGTH = 512;
const HIGHLIGHT_CATEGORIES = new Set(['keywords', 'commands', 'types', 'attributes', 'variables', 'values', 'numbers', 'strings', 'characters', 'comments']);
const OUTLINE_KINDS = new Set(['container', 'value', 'function', 'title', 'heading', 'heading.1', 'heading.2', 'heading.3', 'heading.4', 'heading.5', 'heading.6', 'heading.7', 'mark', 'separator']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, maximum = 128) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum);
}

function cleanPattern(value, maximum = MAX_TOKEN_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, maximum);
}

function stringList(value, { lowerCase = false, extension = false } = {}) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
    const text = cleanText(item, 128);
    if (!text) continue;
    let normalized = lowerCase ? text.toLowerCase() : text;
    if (extension) {
      normalized = normalized.replace(/^\.+/, '');
      if (!/^[a-z0-9_+-]+$/i.test(normalized)) continue;
    }
    if (normalized && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function normalizeCompletions(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, MAX_RULES).flatMap(item => {
    if (!isObject(item)) return [];
    const text = cleanText(item.text, MAX_TOKEN_LENGTH);
    if (!text || seen.has(text)) return [];
    seen.add(text);
    return [text];
  });
}

function normalizePairs(value, { includePrefixes = false } = {}) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ARRAY_ITEMS).flatMap(item => {
    if (!isObject(item)) return [];
    const begin = cleanPattern(item.begin);
    const end = cleanPattern(item.end);
    if (!begin || !end) return [];
    const pair = { begin, end, escapeCharacter: cleanPattern(item.escapeCharacter, 4), isMultiline: item.isMultiline === true, isNestable: item.isNestable === true };
    if (includePrefixes && Array.isArray(item.prefixes)) {
      const prefixes = [...new Set(item.prefixes.slice(0, MAX_ARRAY_ITEMS).map(prefix => cleanText(prefix, 128)).filter(Boolean))]
        .sort((left, right) => right.length - left.length);
      if (prefixes.length) pair.prefixes = prefixes;
    }
    return [pair];
  });
}

function normalizeIndentation(value) {
  const source = isObject(value) && Array.isArray(value.blockDelimiters) ? value.blockDelimiters : [];
  let skipped = 0;
  const blockDelimiters = source.slice(0, MAX_ARRAY_ITEMS).flatMap(item => {
    if (!isObject(item)) { skipped++; return []; }
    const begin = cleanPattern(item.begin);
    const end = cleanPattern(item.end);
    if (!begin) { skipped++; return []; }
    return [{ begin, end: end || null, ignoreCase: item.ignoreCase === true, description: cleanText(item.description, 128) }];
  });
  skipped += Math.max(0, source.length - MAX_ARRAY_ITEMS);
  return { value: { blockDelimiters }, skipped };
}

function normalizeOutlines(value) {
  if (!Array.isArray(value)) return { value: [], skipped: 0 };
  let skipped = 0;
  const outlines = value.slice(0, MAX_RULES).flatMap(item => {
    if (!isObject(item)) { skipped++; return []; }
    const pattern = cleanPattern(item.pattern);
    const kind = cleanText(item.kind, 32);
    if (!pattern || (kind && !OUTLINE_KINDS.has(kind))) { skipped++; return []; }
    return [{
      pattern,
      template: cleanPattern(item.template, 512),
      ignoreCase: item.ignoreCase === true,
      kind: kind || null,
      description: cleanText(item.description, 128)
    }];
  });
  skipped += Math.max(0, value.length - MAX_RULES);
  return { value: outlines, skipped };
}

function makeSyntaxId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'custom';
  const hash = crypto.createHash('sha256').update(name).digest('hex').slice(0, 10);
  return `cot-syntax-${slug}-${hash}`;
}

function normalizeCotEditorSyntax(name, info, edit = {}, highlights = {}, outlines = [], completions = []) {
  if (!isObject(info) || !isObject(info.fileMap ?? {})) throw new Error('CotEditor 语法包缺少有效的 Info.json。');
  const displayName = cleanText(name, 96).replace(/\.cotsyntax$/i, '') || '导入语法';
  const fileMap = info.fileMap || {};
  const comments = isObject(edit?.comment) ? edit.comment : {};
  const inlines = Array.isArray(comments.inlines) ? comments.inlines.slice(0, MAX_ARRAY_ITEMS).flatMap(item => {
    const value = isObject(item) ? item : { begin: item };
    const begin = cleanPattern(value.begin);
    return begin ? [{ begin, leadingOnly: value.leadingOnly === true }] : [];
  }) : [];
  const blocks = normalizePairs(comments.blocks);
  const stringDelimiters = normalizePairs(edit?.stringDelimiters, { includePrefixes: true });
  const characterDelimiters = normalizePairs(edit?.characterDelimiters, { includePrefixes: true });

  const rules = [];
  let skippedHighlightRules = 0;
  if (!isObject(highlights)) highlights = {};
  for (const [category, categoryRules] of Object.entries(highlights)) {
    if (!HIGHLIGHT_CATEGORIES.has(category) || !Array.isArray(categoryRules)) {
      if (Array.isArray(categoryRules)) skippedHighlightRules += categoryRules.length;
      continue;
    }
    for (const rule of categoryRules.slice(0, MAX_RULES)) {
      if (!isObject(rule)) { skippedHighlightRules++; continue; }
      const begin = cleanPattern(rule.begin);
      if (!begin) { skippedHighlightRules++; continue; }
      const regularExpression = rule.regularExpression === true || rule.isRegularExpression === true;
      const end = cleanPattern(rule.end);
      rules.push({
        category,
        begin,
        end: end || null,
        regularExpression,
        ignoreCase: rule.ignoreCase === true,
        isMultiline: rule.isMultiline === true,
        description: cleanText(rule.description, 128)
      });
      if (rules.length > MAX_RULES) throw new Error('语法包高亮规则过多。');
    }
  }
  const totalHighlightRules = Object.values(highlights).reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);
  if (totalHighlightRules > MAX_RULES) throw new Error('语法包高亮规则过多。');

  const outlineRules = normalizeOutlines(outlines);
  const indentationRules = normalizeIndentation(edit?.indentation);

  return {
    format: 'cotsyntax',
    id: makeSyntaxId(displayName),
    name: displayName,
    kind: info.kind === 'code' ? 'code' : 'general',
    extensions: stringList(fileMap.extensions, { lowerCase: true, extension: true }),
    filenames: stringList(fileMap.filenames, { lowerCase: true }),
    interpreters: stringList(fileMap.interpreters),
    completions: normalizeCompletions(completions),
    comments: { inline: inlines, blocks },
    strings: stringDelimiters,
    characters: characterDelimiters,
    rules,
    outlines: outlineRules.value,
    indentation: indentationRules.value,
    unsupported: {
      highlightRules: skippedHighlightRules,
      outlineRules: outlineRules.skipped,
      indentationRules: indentationRules.skipped
    }
  };
}

async function loadCotEditorSyntax(directory) {
  const root = path.resolve(String(directory || ''));
  if (!root || !path.extname(root).toLowerCase().endsWith('.cotsyntax')) throw new Error('请选择 `.cotsyntax` 语法包文件夹。');
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('语法包必须是普通文件夹。');
  let totalBytes = 0;

  async function readJson(relativePath, required = false) {
    const parts = relativePath.split(path.sep);
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      parent = path.join(parent, part);
      let directoryStat;
      try { directoryStat = await fs.lstat(parent); }
      catch (error) { if (error.code === 'ENOENT' && !required) return null; throw error; }
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('语法包不能包含符号链接或异常目录。');
    }
    const filename = path.join(root, relativePath);
    let stat;
    try { stat = await fs.lstat(filename); }
    catch (error) { if (error.code === 'ENOENT' && !required) return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('语法包文件必须是普通文件。');
    if (stat.size > MAX_FILE_BYTES) throw new Error('语法包中的 JSON 文件超过 1 MB。');
    totalBytes += stat.size;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('语法包总大小超过 3 MB。');
    try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
    catch (error) { throw new Error(`无法解析 ${relativePath}：${error.message}`); }
  }

  const info = await readJson('Info.json', true);
  const edit = await readJson('Edit.json') || {};
  const highlights = await readJson(path.join('Regex', 'Highlights.json')) || {};
  const outlines = await readJson(path.join('Regex', 'Outlines.json')) || [];
  const completions = await readJson('Completion.json') || [];
  return normalizeCotEditorSyntax(path.basename(root), info, edit, highlights, outlines, completions);
}

function normalizeDroppedCotEditorSyntaxPaths(directories) {
  if (!Array.isArray(directories) || directories.length < 1 || directories.length > 20) {
    throw new Error('一次最多拖入 20 个 `.cotsyntax` 文件夹。');
  }
  const paths = [];
  const seen = new Set();
  for (const directory of directories) {
    if (typeof directory !== 'string' || !directory || directory.length > 4096 || directory.includes('\0') || !path.isAbsolute(directory)) {
      throw new Error('拖入的语法包路径无效。');
    }
    const resolved = path.resolve(directory);
    if (path.extname(resolved).toLowerCase() !== '.cotsyntax') throw new Error('拖入项必须是 `.cotsyntax` 语法包文件夹。');
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(resolved);
    }
  }
  if (!paths.length) throw new Error('没有可导入的语法包。');
  return paths;
}

async function loadCotEditorSyntaxPackages(directories) {
  const packages = [];
  for (const directory of normalizeDroppedCotEditorSyntaxPaths(directories)) {
    packages.push(await loadCotEditorSyntax(directory));
  }
  return packages;
}

module.exports = { loadCotEditorSyntax, loadCotEditorSyntaxPackages, normalizeCotEditorSyntax, normalizeDroppedCotEditorSyntaxPaths };
