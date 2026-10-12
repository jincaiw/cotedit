'use strict';

function collectQuickActionMenuItems(template, { ignoreIds = [], rootLabel = '' } = {}) {
  const ignored = new Set(ignoreIds);
  const usedIds = new Set();
  const scanIds = items => {
    for (const item of items || []) {
      if (typeof item?.id === 'string') usedIds.add(item.id);
      if (Array.isArray(item?.submenu)) scanIds(item.submenu);
    }
  };
  scanIds(template);

  const entries = [];
  const handlers = new Map();
  let generatedID = 0;
  const visit = (items, parents = []) => {
    for (const item of items || []) {
      if (!item || item.type === 'separator') continue;
      if (Array.isArray(item.submenu)) {
        const label = typeof item.label === 'string' ? item.label.trim() : '';
        visit(item.submenu, label ? [...parents, label] : parents);
        continue;
      }
      if (typeof item.click !== 'function' || !String(item.label || '').trim()) continue;
      if (!item.id) {
        let id;
        do { id = `quick-action-generated-${generatedID++}`; } while (usedIds.has(id));
        item.id = id;
        usedIds.add(id);
      }
      if (ignored.has(item.id)) continue;
      const path = parents.filter(label => label && label !== rootLabel).join(' › ');
      entries.push({
        id: item.id,
        label: String(item.label),
        group: path,
        accelerator: typeof item.accelerator === 'string' ? item.accelerator : ''
      });
      handlers.set(item.id, item.click);
    }
  };
  visit(template);
  return { entries, handlers };
}

function executeQuickActionMenuItem(registry, id, menu, browserWindow) {
  if (typeof id !== 'string' || !registry?.handlers?.has(id)) return false;
  const entry = registry.entries.find(candidate => candidate.id === id);
  const item = menu?.getMenuItemById?.(id);
  if (!entry || !item || item.enabled === false || item.visible === false) return false;
  registry.handlers.get(id)(item, browserWindow, undefined);
  return true;
}

module.exports = { collectQuickActionMenuItems, executeQuickActionMenuItem };
