export const TOOLBAR_ITEMS = Object.freeze([
  Object.freeze({ id: 'find', label: '查找与替换', elementId: 'find-button' }),
  Object.freeze({ id: 'directorySearch', label: '在文件夹中查找', elementId: 'directory-search-button' }),
  Object.freeze({ id: 'outline', label: '文稿大纲', elementId: 'outline-toggle' }),
  Object.freeze({ id: 'split', label: '切换分屏', elementId: 'split-toggle' }),
  Object.freeze({ id: 'characterInspector', label: 'Unicode 字符检查器', elementId: 'inspector-toggle' }),
  Object.freeze({ id: 'warningsInspector', label: '编码警告检查器', elementId: 'warnings-toggle' }),
  Object.freeze({ id: 'wrap', label: '自动换行', elementId: 'wrap-toggle' }),
  Object.freeze({ id: 'lineNumbers', label: '显示/隐藏行号', elementId: 'line-toggle' })
]);

export const DEFAULT_TOOLBAR_ITEM_ORDER = Object.freeze(TOOLBAR_ITEMS.map(item => item.id));
const TOOLBAR_ITEM_IDS = new Set(DEFAULT_TOOLBAR_ITEM_ORDER);

export function normalizeToolbarItemOrder(value) {
  if (!Array.isArray(value)) return [...DEFAULT_TOOLBAR_ITEM_ORDER];
  const order = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !TOOLBAR_ITEM_IDS.has(id) || seen.has(id)) continue;
    order.push(id);
    seen.add(id);
  }
  for (const id of DEFAULT_TOOLBAR_ITEM_ORDER) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

export function normalizeHiddenToolbarItems(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === 'string' && TOOLBAR_ITEM_IDS.has(id)))];
}
