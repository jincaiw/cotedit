const MAX_CUSTOM_EDITOR_THEMES = 64;
const MAX_THEME_NAME_LENGTH = 100;

function normalizedName(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/gu, '').trim().slice(0, MAX_THEME_NAME_LENGTH)
    : '';
}

function nameKey(value) {
  return normalizedName(value).toLocaleLowerCase('en-US');
}

export function normalizeCustomEditorThemes(value, normalizeTheme, reservedNames = []) {
  if (!Array.isArray(value) || typeof normalizeTheme !== 'function') return [];
  const reserved = new Set(reservedNames.map(nameKey));
  const seen = new Set(reserved);
  const themes = [];
  for (const candidate of value) {
    const theme = normalizeTheme(candidate, candidate?.name);
    if (!theme) continue;
    const name = normalizedName(theme.name);
    const key = nameKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    themes.push({ ...theme, name });
    if (themes.length >= MAX_CUSTOM_EDITOR_THEMES) break;
  }
  return themes;
}

export function upsertCustomEditorTheme(themes, candidate, normalizeTheme, reservedNames = []) {
  const theme = normalizeTheme(candidate, candidate?.name);
  const name = normalizedName(theme?.name);
  const key = nameKey(name);
  if (!theme || !name) throw new TypeError('主题名称无效。');
  if (reservedNames.some(item => nameKey(item) === key)) throw new TypeError('主题名称与内置主题重名。');
  const current = normalizeCustomEditorThemes(themes, normalizeTheme, reservedNames);
  const index = current.findIndex(item => nameKey(item.name) === key);
  if (index < 0 && current.length >= MAX_CUSTOM_EDITOR_THEMES) throw new RangeError('最多保存 64 个自定义主题。');
  if (index < 0) current.push({ ...theme, name });
  else current[index] = { ...theme, name };
  return current;
}

export function renameCustomEditorTheme(themes, oldName, nextName, normalizeTheme, reservedNames = []) {
  const name = normalizedName(nextName);
  const key = nameKey(name);
  const current = normalizeCustomEditorThemes(themes, normalizeTheme, reservedNames);
  const index = current.findIndex(item => nameKey(item.name) === nameKey(oldName));
  if (index < 0) throw new Error('找不到要重命名的自定义主题。');
  if (!name) throw new TypeError('主题名称不能为空。');
  if (reservedNames.some(item => nameKey(item) === key)
      || current.some((item, itemIndex) => itemIndex !== index && nameKey(item.name) === key)) {
    throw new TypeError('主题名称已被使用。');
  }
  current[index] = { ...current[index], name };
  return current;
}

export function removeCustomEditorTheme(themes, name, normalizeTheme, reservedNames = []) {
  const current = normalizeCustomEditorThemes(themes, normalizeTheme, reservedNames);
  const filtered = current.filter(theme => nameKey(theme.name) !== nameKey(name));
  if (filtered.length === current.length) throw new Error('找不到要删除的自定义主题。');
  return filtered;
}

export { MAX_CUSTOM_EDITOR_THEMES, MAX_THEME_NAME_LENGTH };
