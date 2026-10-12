'use strict';

function createRecoveryOwnership() {
  const byWindow = new Map();
  const activeIds = () => new Set([...byWindow.values()].flatMap(ids => [...ids]));
  return {
    claim(windowId, drafts) {
      if (!Array.isArray(drafts)) throw new TypeError('恢复占用记录必须是数组。');
      byWindow.set(windowId, new Set(drafts.map(draft => draft?.id).filter(id => typeof id === 'string' && id.length > 0)));
    },
    release(windowId) {
      return byWindow.delete(windowId);
    },
    activeIds() {
      return activeIds();
    },
    annotate(drafts) {
      if (!Array.isArray(drafts)) throw new TypeError('恢复记录必须是数组。');
      const active = activeIds();
      return drafts.map(draft => ({ ...draft, inUse: active.has(draft.id) }));
    }
  };
}

module.exports = { createRecoveryOwnership };
