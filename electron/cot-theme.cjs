'use strict';

const STYLE_KEYS = Object.freeze([
  'text', 'background', 'invisibles', 'selection', 'insertionPoint', 'lineHighlight',
  'highlight', 'keywords', 'commands', 'types', 'attributes', 'variables', 'values',
  'numbers', 'strings', 'characters', 'comments'
]);
const COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i;
const MAX_THEME_NAME = 100;
const SYSTEM_SETTING_STYLE_KEYS = new Set(['selection', 'insertionPoint', 'highlight']);

function normalizeCotEditorTheme(value, fallbackName = '导入主题') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('主题文件格式无效：顶层必须是 JSON 对象。');
  }
  const rawName = typeof value.name === 'string' ? value.name : fallbackName;
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_THEME_NAME) || fallbackName;
  const styles = {};
  for (const key of STYLE_KEYS) {
    const color = value[key]?.color;
    if (typeof color === 'string' && COLOR_PATTERN.test(color)) styles[key] = color.toLowerCase();
  }
  if (!styles.text || !styles.background) {
    throw new Error('主题文件必须包含有效的 text.color 和 background.color。');
  }
  const metadata = value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)
      ? {
        author: typeof value.metadata.author === 'string' ? value.metadata.author.slice(0, 160) : undefined,
        description: typeof value.metadata.description === 'string' ? value.metadata.description.slice(0, 500) : undefined,
        license: typeof value.metadata.license === 'string' ? value.metadata.license.slice(0, 240) : undefined,
        distributionURL: typeof value.metadata.distributionURL === 'string' ? value.metadata.distributionURL.slice(0, 500) : undefined
      }
    : {};
  const systemSettings = STYLE_KEYS.filter(key => SYSTEM_SETTING_STYLE_KEYS.has(key) && value[key]?.usesSystemSetting === true);
  return { format: 'cottheme', name, styles, metadata, systemSettings };
}

module.exports = { STYLE_KEYS, normalizeCotEditorTheme };
