'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzip, gunzip } = require('node:zlib');
const { promisify } = require('node:util');

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const STORE_VERSION = 1;
const MAX_DRAFTS_PER_WINDOW = 20;
const MAX_TOTAL_DRAFTS = 100;
const MAX_STORE_BYTES = 64 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 128 * 1024 * 1024;
const MAX_TEXT_CHARS = 12_000_000;
const MAX_NAME_CHARS = 160;
const VALID_LINE_ENDINGS = new Set(['LF', 'CRLF', 'CR', 'NEL', 'LS', 'PS']);

function storeError(message, code = 'RECOVERY_INVALID') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeWindowId(value) {
  const id = String(value ?? 'main');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw storeError('恢复窗口编号无效。');
  return id;
}

function normalizeDraft(value, windowId, now = new Date().toISOString()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw storeError('恢复文稿格式无效。');
  if (typeof value.id !== 'string' || !value.id || value.id.length > 128) throw storeError('恢复文稿编号无效。');
  if (typeof value.text !== 'string' || value.text.length > MAX_TEXT_CHARS) throw storeError('恢复文稿超过长度限制。');
  if (typeof value.savedText === 'string' && value.savedText.length > MAX_TEXT_CHARS) throw storeError('已保存基线超过长度限制。');
  const lineEndings = Array.isArray(value.lineEndings)
    ? value.lineEndings.map(item => VALID_LINE_ENDINGS.has(item) ? item : 'LF')
    : [];
  const savedLineEndings = Array.isArray(value.savedLineEndings)
    ? value.savedLineEndings.map(item => VALID_LINE_ENDINGS.has(item) ? item : 'LF')
    : [];
  if (lineEndings.length > MAX_TEXT_CHARS || savedLineEndings.length > MAX_TEXT_CHARS) throw storeError('行尾元数据超过限制。');
  const name = typeof value.name === 'string' ? value.name : '恢复文稿.txt';
  const stamp = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
    ? new Date(value.updatedAt).toISOString() : now;
  const eol = VALID_LINE_ENDINGS.has(value.eol) ? value.eol : 'LF';
  const savedEol = VALID_LINE_ENDINGS.has(value.savedEol) ? value.savedEol : eol;
  return {
    id: value.id,
    windowId: safeWindowId(windowId),
    name: name.slice(0, MAX_NAME_CHARS),
    text: value.text,
    savedText: typeof value.savedText === 'string' ? value.savedText : '',
    language: typeof value.language === 'string' ? value.language.slice(0, 100) : 'plaintext',
    encoding: typeof value.encoding === 'string' ? value.encoding.slice(0, 64) : 'utf8',
    savedEncoding: typeof value.savedEncoding === 'string' ? value.savedEncoding.slice(0, 64) : (typeof value.encoding === 'string' ? value.encoding.slice(0, 64) : 'utf8'),
    eol,
    savedEol,
    lineEndings,
    savedLineEndings,
    bom: value.bom === true,
    savedBom: value.savedBom === true,
    preventEditing: value.preventEditing === true,
    writingDirection: value.writingDirection === 'rtl' ? 'rtl' : 'ltr',
    updatedAt: stamp
  };
}

function isDirtyDraft(draft) {
  return draft.text !== draft.savedText
    || draft.encoding !== draft.savedEncoding
    || draft.eol !== draft.savedEol
    || JSON.stringify(draft.lineEndings) !== JSON.stringify(draft.savedLineEndings)
    || draft.bom !== draft.savedBom;
}

function serializePayload(draft) {
  const { updatedAt, ...payload } = draft;
  return JSON.stringify(payload);
}

function cloneDrafts(drafts) {
  return drafts.map(draft => ({ ...draft, lineEndings: [...draft.lineEndings], savedLineEndings: [...draft.savedLineEndings] }));
}

function legacyDraftId(windowId, index, value) {
  const fingerprint = JSON.stringify([windowId, index, value.name || '', value.text || '', value.savedText || '']);
  return `legacy-${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 40)}`;
}

function createRecoveryStore(filePath) {
  let queue = Promise.resolve();
  let cached = null;

  function enqueue(operation) {
    const result = queue.then(operation, operation);
    queue = result.catch(() => {});
    return result;
  }

  async function readUnlocked() {
    if (cached) return cached;
    let compressed;
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) throw storeError('恢复库路径不是普通文件。');
      if (stat.size > MAX_STORE_BYTES) throw storeError('恢复库超过 64 MiB 安全上限，请先手动检查或清理。', 'RECOVERY_LIMIT');
      compressed = await fs.readFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        cached = { version: STORE_VERSION, drafts: [] };
        return cached;
      }
      throw error;
    }
    let data;
    try {
      const uncompressed = await gunzipAsync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
      data = JSON.parse(uncompressed.toString('utf8'));
    } catch {
      throw storeError('恢复库无法读取；为避免覆盖数据，已保留原文件且暂停自动写入。', 'RECOVERY_CORRUPT');
    }
    if (!data || data.version !== STORE_VERSION || !Array.isArray(data.drafts) || data.drafts.length > MAX_TOTAL_DRAFTS) {
      throw storeError('恢复库版本或结构无效；原文件已保留。', 'RECOVERY_CORRUPT');
    }
    const drafts = data.drafts.map(item => normalizeDraft(item, item.windowId));
    const ids = new Set();
    for (const draft of drafts) {
      if (ids.has(draft.id)) throw storeError('恢复库包含重复编号；原文件已保留。', 'RECOVERY_CORRUPT');
      ids.add(draft.id);
    }
    cached = { version: STORE_VERSION, drafts };
    return cached;
  }

  async function writeUnlocked(drafts) {
    if (drafts.length > MAX_TOTAL_DRAFTS) throw storeError('恢复库最多保留 100 份草稿；未删除任何现有草稿。', 'RECOVERY_LIMIT');
    const data = { version: STORE_VERSION, updatedAt: new Date().toISOString(), drafts };
    const json = Buffer.from(JSON.stringify(data), 'utf8');
    if (json.length > MAX_UNCOMPRESSED_BYTES) throw storeError('恢复数据超过解压后安全上限；未删除任何现有草稿。', 'RECOVERY_LIMIT');
    const compressed = await gzipAsync(json);
    if (compressed.length > MAX_STORE_BYTES) throw storeError('恢复库将超过 64 MiB 上限；未删除任何现有草稿。请在恢复管理器中手动清理。', 'RECOVERY_LIMIT');

    const directory = path.dirname(filePath);
    const temporary = path.join(directory, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(compressed);
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temporary, filePath);
      cached = { version: STORE_VERSION, drafts };
      return cached;
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  return {
    list() {
      return enqueue(async () => cloneDrafts((await readUnlocked()).drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },

    replaceWindow(windowIdValue, values) {
      return enqueue(async () => {
        const windowId = safeWindowId(windowIdValue);
        if (!Array.isArray(values) || values.length > MAX_DRAFTS_PER_WINDOW) {
          throw storeError('每个窗口最多恢复 20 份草稿；未删除任何现有草稿。', 'RECOVERY_LIMIT');
        }
        const current = (await readUnlocked()).drafts;
        const incoming = values.map(value => normalizeDraft(value, windowId));
        const ids = new Set();
        for (const draft of incoming) {
          if (!isDirtyDraft(draft)) throw storeError('恢复库只接受未保存文稿。');
          if (ids.has(draft.id)) throw storeError('本次恢复快照包含重复文稿编号。');
          ids.add(draft.id);
        }
        const oldById = new Map(current.map(draft => [draft.id, draft]));
        const now = new Date().toISOString();
        const updatedIncoming = incoming.map(draft => {
          const previous = oldById.get(draft.id);
          return previous && serializePayload(previous) === serializePayload(draft)
            ? { ...draft, updatedAt: previous.updatedAt }
            : { ...draft, updatedAt: now };
        });
        const retained = current.filter(draft => draft.windowId !== windowId && !ids.has(draft.id));
        const next = [...retained, ...updatedIncoming];
        if (next.length > MAX_TOTAL_DRAFTS) throw storeError('整个恢复库最多保留 100 份草稿；未删除任何现有草稿。请在恢复管理器中手动清理。', 'RECOVERY_LIMIT');
        return cloneDrafts((await writeUnlocked(next)).drafts);
      });
    },

    importLegacy(sessions) {
      return enqueue(async () => {
        if (!Array.isArray(sessions) || sessions.length > 100) throw storeError('旧恢复数据格式无效。');
        const current = (await readUnlocked()).drafts;
        const known = new Set(current.map(draft => draft.id));
        const imports = [];
        const importedIds = new Set();
        const perWindow = new Map();
        for (const session of sessions) {
          const windowId = safeWindowId(session?.windowId);
          if (!Array.isArray(session?.drafts) || session.drafts.length > MAX_DRAFTS_PER_WINDOW) throw storeError('旧恢复数据超过每窗口上限。', 'RECOVERY_LIMIT');
          for (let index = 0; index < session.drafts.length; index++) {
            const value = session.drafts[index];
            const id = typeof value?.id === 'string' && value.id ? value.id : legacyDraftId(windowId, index, value || {});
            const draft = normalizeDraft({ ...value, id }, windowId);
            if (!isDirtyDraft(draft)) continue;
            if (known.has(draft.id) || importedIds.has(draft.id)) continue;
            importedIds.add(draft.id);
            perWindow.set(windowId, (perWindow.get(windowId) || 0) + 1);
            imports.push(draft);
          }
        }
        for (const [windowId, count] of perWindow) {
          const existingCount = current.filter(draft => draft.windowId === windowId).length;
          if (existingCount + count > MAX_DRAFTS_PER_WINDOW) throw storeError(`旧窗口 ${windowId} 的草稿超过每窗口 20 份上限；旧数据未清理。`, 'RECOVERY_LIMIT');
        }
        const next = [...current, ...imports];
        if (next.length > MAX_TOTAL_DRAFTS) throw storeError('迁移将超过 100 份草稿上限；旧数据未清理。', 'RECOVERY_LIMIT');
        const result = imports.length ? await writeUnlocked(next) : { drafts: current };
        return { imported: imports.length, drafts: cloneDrafts(result.drafts) };
      });
    },

    remove(ids) {
      return enqueue(async () => {
        if (!Array.isArray(ids) || ids.length > MAX_TOTAL_DRAFTS) throw storeError('要删除的恢复文稿编号无效。');
        const selected = new Set(ids.filter(id => typeof id === 'string'));
        const current = (await readUnlocked()).drafts;
        const next = current.filter(draft => !selected.has(draft.id));
        if (next.length === current.length) return cloneDrafts(current);
        return cloneDrafts((await writeUnlocked(next)).drafts);
      });
    },

    clear() {
      return enqueue(async () => cloneDrafts((await writeUnlocked([])).drafts));
    },

    flush() {
      return queue;
    }
  };
}

module.exports = {
  createRecoveryStore,
  MAX_DRAFTS_PER_WINDOW,
  MAX_TOTAL_DRAFTS,
  MAX_STORE_BYTES,
  normalizeDraft,
  isDirtyDraft
};
